import { afterEach, beforeEach, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { canonical } from '../../src/lib/canonical.mjs';
import { hash, identity, readObject, verifyRelease } from '../../scripts/public-data.mjs';
import { importRelease } from '../../scripts/import-data.mjs';
import { buildSummaryPacket, verifySummaryClaims } from '../../scripts/summary-data.mjs';
import type { PublicBenchmarkSummaryV1 } from '../../src/lib/public-summary';
import type { PublicResultsReleaseV1 } from '../../src/lib/public-release';

const fixture = fileURLToPath(new URL('../fixtures/summary-release-v1/', import.meta.url));
let root: string, source: string, manifest: PublicResultsReleaseV1;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'summary-release-')); source = join(root, 'source');
  await cp(fixture, source, { recursive: true }); manifest = JSON.parse(await readFile(join(source, 'release.json'), 'utf8'));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function object(id: string) { return JSON.parse((await readObject(source, manifest.objects.find(o => o.id === id)!)).toString('utf8')); }
async function put(value: unknown) {
  const bytes = Buffer.from(canonical(value)), id = hash(bytes), path = `objects/sha256/${id}.json`;
  await writeFile(join(source, path), bytes);
  manifest.objects.push({ id, path, bytes: bytes.length, media_type: 'application/json', encoding: 'identity', availability: 'full' });
  return id;
}
async function save(summary: PublicBenchmarkSummaryV1) {
  summary.summary_id = identity('summary-', summary, 'summary_id');
  manifest.summary_objects[0]!.id = summary.summary_id; manifest.summary_objects[0]!.object_id = await put(summary);
  manifest.release_id = identity('release-', manifest, 'release_id');
  await writeFile(join(source, 'release.json'), canonical(manifest));
}
it('imports approved synthetic analysis with independently reconstructed facts and original attribution', async () => {
  const dataset = await object(manifest.dataset_object_id), ref = manifest.summary_objects[0]!;
  const summary = await object(ref.object_id), packet = await object(ref.facts_object_id);
  expect(buildSummaryPacket(dataset, ref.configuration_id)).toEqual(packet);
  expect(summary.generator.model_id_returned).toBe('gpt-6-astra');
  const destination = join(root, 'site'); expect(await importRelease(source, destination, { progress: false })).toBe(manifest.release_id);
  expect(JSON.parse(await readFile(join(destination, 'latest.json'), 'utf8')).release_id).toBe(manifest.release_id);
});
it('imports an attributed agent review only with separate user publication authorization', async () => {
  const summary: PublicBenchmarkSummaryV1 = await object(manifest.summary_objects[0]!.object_id);
  if (summary.editorial.state !== 'approved') throw new Error('Expected synthetic approved fixture');
  const author = structuredClone(summary.generator), generated = summary.generated_at;
  summary.editorial = { ...summary.editorial, reviewer_kind: 'agent', reviewer_name: 'Codex', publication_authorization: {
    authorized_by: 'user', authorized_at: '2026-10-21T23:00:00Z', instruction: 'Synthetic authorization to publish.' } };
  await save(summary);
  await expect(verifyRelease(source)).resolves.toHaveProperty('release.release_id', manifest.release_id);
  expect(summary.generator).toEqual(author); expect(summary.generated_at).toBe(generated);
  summary.editorial.publication_authorization.instruction = ''; await save(summary);
  await expect(verifyRelease(source)).rejects.toThrow();
});
it('verifies explicit offline source provenance and rejects invented condition-edit history', async () => {
  const summary: PublicBenchmarkSummaryV1 = await object(manifest.summary_objects[0]!.object_id);
  const packet = await object(manifest.summary_objects[0]!.facts_object_id);
  const conditions = [...summary.content.verdict.condition_ids];
  summary.provenance = { stage: 'direct', input_summary_ids: [], contributors: [] };
  summary.editorial = { state: 'approved', edited: true, edit_author: 'Codex', reviewed_at: '2026-10-21T23:00:00Z',
    reviewer_kind: 'agent', reviewer_name: 'Independent agent', supersedes_summary_id: null,
    publication_authorization: { authorized_by: 'user', authorized_at: '2026-10-21T22:00:00Z', instruction: 'Synthetic authorization.' } };
  summary.failed_response_editorial = { source_job_id: summary.job_id, source_input_sha256: 'a'.repeat(64), source_state_sha256: 'b'.repeat(64),
    source_receipt_sha256: 'c'.repeat(64), original_content_sha256: 'd'.repeat(64), source_status: 'claims_failed',
    source_validation_errors: 'Claim 0: wrong subject or condition', correction_kind: 'foreign_condition_ids_only', editor: 'Codex',
    changes: [{ claim_path: 'verdict', original_condition_ids: [...conditions, 'foreign-condition'], corrected_condition_ids: conditions }] };
  await save(summary); await expect(verifyRelease(source)).resolves.toHaveProperty('release.release_id',manifest.release_id);
  summary.failed_response_editorial.changes[0]!.corrected_condition_ids = [];
  expect(packet.analysis_input_hash).toBe(summary.evidence.analysis_input_hash);
  await save(summary); await expect(verifyRelease(source)).rejects.toThrow('condition-reference edit provenance differs');
});
it.each(['draft', 'number', 'limitations', 'stale', 'cycle'])('rejects %s even after the attacker recomputes object and release hashes', async kind => {
  const summary: PublicBenchmarkSummaryV1 = await object(manifest.summary_objects[0]!.object_id);
  if (kind === 'draft') summary.editorial = { state: 'draft', reviewed_at: null, edited: false, supersedes_summary_id: null };
  if (kind === 'number') summary.content.verdict.numeric_facts[0]!.value = 999;
  if (kind === 'limitations') summary.content.limitations = [];
  if (kind === 'stale') summary.evidence.analysis_input_hash = 'a'.repeat(64);
  if (kind === 'cycle') { const node = summary.provenance.contributors[0]!; node.stage = 'intermediate_synthesis'; node.input_summary_ids = [node.summary_id]; }
  await save(summary);
  await expect(verifyRelease(source)).rejects.toThrow();
});
it('rejects a self-consistent but changed fact packet against the actual dataset', async () => {
  const ref = manifest.summary_objects[0]!, summary = await object(ref.object_id), packet = await object(ref.facts_object_id);
  packet.inputs.history.unknown_attempt_attribution += 1;
  packet.analysis_input_hash = hash(canonical(packet.inputs)); summary.evidence.analysis_input_hash = packet.analysis_input_hash;
  ref.facts_object_id = await put(packet); await save(summary);
  await expect(verifyRelease(source)).rejects.toThrow('facts differ');
});
it('binds editorial authorship and source identity for refreshed proposals', async () => {
  const summary: PublicBenchmarkSummaryV1 = await object(manifest.summary_objects[0]!.object_id);
  if (summary.editorial.state !== 'approved') throw new Error('Expected synthetic approved fixture');
  summary.editorial.edit_author = 'Codex';
  summary.editorial_basis = { source_summary_id: summary.editorial.supersedes_summary_id!, source_analysis_input_hash: summary.evidence.analysis_input_hash, source_dataset_revision_id: summary.evidence.origin_dataset_revision_id, review_dataset_revision_id: summary.evidence.origin_dataset_revision_id, proposal_sha256: 'a'.repeat(64), edit_author: 'Codex' };
  await save(summary);
  await expect(verifyRelease(source)).resolves.toHaveProperty('release.release_id', manifest.release_id);
  summary.editorial.edit_author = 'Someone else'; await save(summary);
  await expect(verifyRelease(source)).rejects.toThrow('Editorial provenance differs');
});
it('permits only v2 limitation coverage counts for unverified thinking comparisons', async () => {
  const ref = manifest.summary_objects[0]!, summary = await object(ref.object_id), packet = await object(ref.facts_object_id);
  packet.inputs.comparisons.push({ id: 'comparison-test', verified: false, complete: false, timing_complete: false });
  const facts = ['score_pairs', 'time_pairs', 'planned_pairs'].map((metric, i) => ({ id: `fact-dead${i}`, record_id: 'comparison-test', metric,
    value: i === 2 ? 16 : 0, unit: 'pairs', condition_id: null, configuration_id: packet.configuration_id, suite_id: packet.inputs.suites[0].id }));
  packet.inputs.numeric_facts.push(...facts);
  const claim = { text: `No tradeoff is established; coverage is ${facts.map(f => `{{${f.id}}}`).join(', ')}.`, scope: 'limitation',
    configuration_id: packet.configuration_id, condition_ids: [], illustration: false,
    evidence_refs: [packet.inputs.limitations[0].id, ...facts.map(f => f.id)],
    numeric_facts: facts.map(f => ({ fact_id: f.id, metric: f.metric, value: f.value, unit: f.unit })) };
  summary.content.limitations.push(claim); summary.validation.claims += 1;
  expect(() => verifySummaryClaims(summary, packet)).toThrow('verified pair');
  summary.validation.validator_version = 'summary-validator-v2';
  expect(() => verifySummaryClaims(summary, packet)).not.toThrow();
  summary.content.limitations.pop(); summary.content.thinking_tradeoffs.push(claim);
  expect(() => verifySummaryClaims(summary, packet)).toThrow('verified pair');
});
it('imports reader summaries with hidden support and common limitations while retaining attribution', async () => {
  const { enrichReaderPacket } = await import('../../scripts/reader-data.mjs');
  const data = await object(manifest.dataset_object_id), ref = manifest.summary_objects[0]!;
  const summary = await object(ref.object_id), packet = enrichReaderPacket(buildSummaryPacket(data, ref.configuration_id), data);
  summary.summary_schema_version = 2;
  summary.content.output_schema_version = 2;
  summary.content.peer_comparisons = [];
  summary.content.shared_limitation_refs = packet.inputs.shared_limitation_ids;
  summary.content.limitations = summary.content.limitations.filter((c: {evidence_refs:string[]}) => !c.evidence_refs.every(id => packet.inputs.shared_limitation_ids.includes(id)));
  const claims = [summary.content.verdict,...summary.content.strengths,...summary.content.weaknesses,...summary.content.thinking_tradeoffs,...summary.content.limitations];
  for (const claim of claims) claim.comparison_refs = [];
  summary.content.verdict.text = 'Useful for the small tested task; broader coverage remains a preview.';
  summary.validation.validator_version = 'summary-validator-reader-v1'; summary.validation.claims = claims.length;
  summary.evidence.analysis_input_hash = packet.analysis_input_hash;
  ref.facts_object_id = await put(packet); await save(summary);
  await expect(verifyRelease(source)).resolves.toHaveProperty('release.release_id',manifest.release_id);
  summary.content.verdict.numeric_facts[0].value = 999; await save(summary);
  await expect(verifyRelease(source)).rejects.toThrow('numeric fact differs');
});
