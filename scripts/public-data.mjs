import { validateCategories } from '../src/lib/categories.mjs';
import { searchRecords } from './search-index.mjs';
import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import Ajv from 'ajv/dist/2020.js';
import { canonical } from '../src/lib/canonical.mjs';
import { verifySummaryDependencies } from './summary-data.mjs';
import { validateDescriptions } from './test-descriptions.mjs';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const identity = (prefix, value, field) => prefix + hash(canonical(Object.fromEntries(Object.entries(value).filter(([key]) => key !== field))));
export async function safeFile(root, relative) {
  if (!relative || relative.startsWith('/') || relative.includes('\\') || relative.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('Unsafe data path');
  let path = resolve(root);
  for (const part of relative.split('/')) {
    path = join(path, part);
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Symlink in public data');
  }
  return path;
}
export function objectPath(record) {
  const suffix = record.media_type === 'application/json' ? '.json' : '.txt';
  const path = `objects/sha256/${record.id}${suffix}${record.encoding === 'gzip' ? '.gz' : ''}`;
  if (record.path !== path || !/^[a-f0-9]{64}$/.test(record.id)) throw new Error('Invalid object path');
  return path;
}
export async function readObject(root, record) {
  if (!record || record.bytes > 128 * 1024 ** 2) throw new Error('Missing or oversized evidence object');
  const raw = await readFile(await safeFile(root, objectPath(record)));
  return verifyObjectBytes(raw, record);
}
export function verifyObjectBytes(raw, record) {
  if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 || record.bytes > 128 * 1024 ** 2) throw new Error('Invalid decoded evidence size');
  const bytes = record.encoding === 'gzip' ? gunzipSync(raw, { maxOutputLength: Math.max(1, record.bytes) }) : raw;
  if (bytes.length !== record.bytes || hash(bytes) !== record.id) throw new Error('Evidence checksum mismatch');
  return bytes;
}
const contractRoot = new URL('../contracts/v1/', import.meta.url);
export async function verifyRelease(root, { progress = false, releasePath = 'release.json' } = {}) {
  const release = JSON.parse(await readFile(await safeFile(root, releasePath), 'utf8'));
  const ajv = new Ajv({ strict: true });
  const releaseSchema = JSON.parse(await readFile(new URL('release.schema.json', contractRoot), 'utf8'));
  const datasetSchemaBytes = await readFile(new URL('dataset.schema.json', contractRoot));
  if (!ajv.validate(releaseSchema, release)) throw new Error('Invalid public release schema');
  if (release.release_id !== identity('release-', release, 'release_id')) throw new Error('Release identity mismatch');
  if (![hash(datasetSchemaBytes), hash(await readFile(new URL('legacy-dataset.schema.json', contractRoot))), hash(await readFile(new URL('reader-dataset.schema.json', contractRoot)))].includes(release.contract_sha256)) throw new Error('Public contract pack differs');
  const records = new Map(release.objects.map(o => [o.id, o]));
  if (records.size !== release.objects.length) throw new Error('Duplicate object identity');
  let count = 0;
  for (const record of records.values()) {
    await readObject(root, record);
    if (progress && ++count % 4000 === 0) console.log(`Verified ${count} public objects`);
  }
  const required = [release.dataset_object_id, release.index_object_id, ...Object.values(release.model_objects), ...Object.values(release.question_objects), ...release.summary_objects.flatMap(s => [s.object_id, s.facts_object_id])];
  if (required.some(id => !records.has(id))) throw new Error('Dangling release reference');
  const dataset = JSON.parse(await readObject(root, records.get(release.dataset_object_id)));
  if (!ajv.validate(JSON.parse(datasetSchemaBytes), dataset)) throw new Error(`Invalid public dataset: ${ajv.errors?.[0]?.instancePath}`);
  if (dataset.dataset_revision_id !== identity('dataset-', dataset, 'dataset_revision_id') || dataset.dataset_revision_id !== release.dataset_revision_id) throw new Error('Dataset identity mismatch');
  validateCategories(dataset);
  const indexes = {};
  for (const kind of ['checkpoints', 'artifacts', 'configurations', 'conditions', 'suites', 'questions', 'trials', 'attempts', 'aggregates', 'objects']) {
    indexes[kind] = new Map(dataset[kind].map(r => [r.id, r]));
    if (indexes[kind].size !== dataset[kind].length) throw new Error(`Duplicate ${kind} identity`);
  }
  function get(kind, id) { const record = indexes[kind].get(id); if (!record) throw new Error(`Dangling ${kind} reference`); return record; }
  for (const c of dataset.checkpoints) if (get('artifacts', c.baseline_artifact_id).checkpoint_id !== c.id) throw new Error('Mismatched baseline artifact');
  for (const a of dataset.artifacts) get('checkpoints', a.checkpoint_id);
  for (const c of dataset.configurations) get('artifacts', c.artifact_id);
  for (const c of dataset.conditions) {
    get('configurations', c.configuration_id);
    if(c.verification==='native_reasoning' && (c.reasoning_requested!=='on'||dataset.conditions.some(other=>other.configuration_id===c.configuration_id&&other.reasoning_requested==='off'))) throw new Error('Native reasoning cannot have an off toggle');
    if(c.observed_reasoning==='enabled' && (c.reasoning_requested!=='off'||c.verification==='verified'||!c.presentation_included)) throw new Error('Observed reasoning is not a verified toggle');
  }
  const canonicalResults = new Map();
  for (const a of dataset.attempts) {
    get('trials', a.trial_id);
    if (a.canonical) {
      if (canonicalResults.has(a.trial_id)) throw new Error('Duplicate canonical outcome');
      canonicalResults.set(a.trial_id, a);
    }
    if ((a.status === 'scored') !== (a.score !== null)) throw new Error('Outcome/score mismatch');
    for (const id of a.supersedes_attempt_ids) if (get('attempts', id).canonical || get('attempts', id).trial_id !== a.trial_id) throw new Error('Invalid history link');
  }
  for (const t of dataset.trials) {
    if (get('conditions', t.condition_id).configuration_id !== t.configuration_id || get('questions', t.question_id).suite_id !== t.suite_id) throw new Error('Mixed trial conditions');
    get('configurations', t.configuration_id); get('suites', t.suite_id);
  }
  for (const a of dataset.aggregates) {
    const plan = dataset.trials.filter(t => t.primary && t.configuration_id === a.configuration_id && t.condition_id === a.condition_id && t.suite_id === a.suite_id);
    if (new Set(a.trial_ids).size !== plan.length || a.planned !== plan.length || plan.some(t => !a.trial_ids.includes(t.id))) throw new Error('Changed fixed denominator');
    const observed = a.trial_ids.map(id => canonicalResults.get(id)).filter(Boolean);
    const scored = observed.filter(r => r.status === 'scored');
    const score = scored.length ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length : null;
    if (scored.length !== a.scored || (score === null ? a.score !== null : a.score === null || Math.abs(score - a.score) > 1e-9)) throw new Error('Aggregate credit differs from recorded outcomes');
    if (a.eligible && (!a.planned || a.scored !== a.planned || a.ineligible_reasons.length)) throw new Error('Incomplete result marked eligible');
  }
  function refs(value) {
    if (value && typeof value === 'object') {
      if (Array.isArray(value.object_ids)) {
        if (['full', 'redacted'].includes(value.availability) !== Boolean(value.object_ids.length)) throw new Error('Availability mismatch');
        const states = value.object_ids.map(id => get('objects', id).availability);
        if (states.length && (states.some(state => !['full', 'redacted'].includes(state)) || value.availability !== (states.includes('redacted') ? 'redacted' : 'full'))) throw new Error('Component/object availability mismatch');
        if (value.availability === 'redacted' && !value.redaction_rule_ids?.length) throw new Error('Redacted evidence has no recorded rule');
      }
      for (const item of Object.values(value)) refs(item);
    }
  }
  refs(dataset.questions); refs(dataset.attempts);
  for (const record of dataset.objects) if (!records.has(record.id) || canonical(records.get(record.id)) !== canonical(record)) throw new Error('Dataset object differs from release graph');
  if (dataset.checkpoints.some(c => !release.model_objects[c.id]) || dataset.questions.some(q => !release.question_objects[q.id])) throw new Error('Missing public page object');
  if (release.summary_objects.length) {
    const schema = JSON.parse(await readFile(new URL('summary.schema.json', contractRoot), 'utf8'));
    const validateSummary = ajv.compile(schema), selected = new Set();
    for (const ref of release.summary_objects) {
      const summary = JSON.parse(await readObject(root, records.get(ref.object_id)));
      const packet = JSON.parse(await readObject(root, records.get(ref.facts_object_id)));
      if (!validateSummary(summary)) throw new Error('Invalid public summary schema');
      if (selected.has(ref.configuration_id) || ref.id !== summary.summary_id || ref.configuration_id !== summary.subject.configuration_id) throw new Error('Summary manifest reference differs or is duplicated');
      selected.add(ref.configuration_id); verifySummaryDependencies(summary, packet, dataset);
    }
  }
  if (release.quant_summary_objects?.length) {
    const {verifyQuantSummary}=await import('./quant-data.mjs');
    const validateQuant=ajv.compile(JSON.parse(await readFile(new URL('quant-summary.schema.json',contractRoot),'utf8'))),seen=new Set();
    for(const ref of release.quant_summary_objects) {
      const summary=JSON.parse(await readObject(root,records.get(ref.object_id))),packet=JSON.parse(await readObject(root,records.get(ref.facts_object_id)));
      if(!validateQuant(summary)||ref.id!==summary.summary_id||ref.checkpoint_id!==summary.checkpoint_id||seen.has(ref.checkpoint_id))throw new Error('Invalid or duplicated quant summary reference');
      seen.add(ref.checkpoint_id);verifyQuantSummary(summary,packet,dataset);
    }
  }
  const index = JSON.parse(await readObject(root, records.get(release.index_object_id)));
  if (['overview-v2','overview-v3'].includes(release.display_policy_version)) {
    const expected = await searchRecords(dataset, id => readObject(root, records.get(id)));
    if (canonical(Object.keys(index.search_objects || {}).sort()) !== canonical(Object.keys(expected).sort())) throw new Error('Incomplete search index graph');
    for (const [suite, payload] of Object.entries(expected)) {
      const actual = JSON.parse(await readObject(root, records.get(index.search_objects[suite])));
      if (canonical(actual) !== canonical(payload)) throw new Error('Search index differs from permitted evidence');
    }
  }
  if (index.test_descriptions) validateDescriptions(index.test_descriptions, dataset);
  return { release, index, records };
}
