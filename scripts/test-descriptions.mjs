import { createHash } from 'node:crypto';
import { canonical } from '../src/lib/canonical.mjs';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');

export function validateDescriptions(catalogue, data) {
  if (canonical(Object.keys(catalogue).sort()) !== canonical(['questions','suites','version']) || catalogue.version !== 1) throw new Error('Unsupported test descriptions catalogue');
  const questions = Object.fromEntries(data.questions.map(q => [q.id,digest(q)]));
  const suites = Object.fromEntries(data.suites.map(s => [s.id,digest({suite:s,questions:Object.fromEntries(s.question_ids.map(id=>[id,questions[id]]))})]));
  for (const [kind, fingerprints] of Object.entries({questions,suites})) for (const [id,entry] of Object.entries(catalogue[kind])) {
    const expected = ['source_sha256','description','generator','generated_at','prompt',...(kind === 'questions' ? ['title'] : [])].sort();
    if (canonical(Object.keys(entry).sort()) !== canonical(expected) || entry.source_sha256 !== fingerprints[id]) throw new Error('Test description source version differs');
    for (const [field,limit] of [['description',700],...(kind === 'questions' ? [['title',100]] : [])]) {
      if (typeof entry[field] !== 'string' || !entry[field].trim() || [...entry[field]].length > limit || /[\x00-\x1f]/.test(entry[field])) throw new Error('Invalid test description text');
    }
    if (!entry.generator?.model_id_requested || !entry.generator?.display_name_at_generation || typeof entry.generated_at !== 'string' || !entry.prompt?.version || !entry.prompt?.sha256) throw new Error('Test description attribution is missing');
  }
}
