// Read-only access to the current public release for answer-page tests.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { OverviewData, QuestionData } from '../../src/lib/public-types';
import type { Attempt } from '../../src/lib/public-contract';

const root = new URL('../../public/data/', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
export const releaseId: string = json('latest.json').release_id;
export const release = json(`releases/${releaseId}/release.json`);
export function objectBytes(id: string): Buffer {
  const o = release.objects.find((x: { id: string }) => x.id === id), b = readFileSync(new URL(o.path, root));
  return o.encoding === 'gzip' ? gunzipSync(b) : b;
}
export const objectPath = (id: string): string => release.objects.find((x: { id: string }) => x.id === id).path;
export const index: OverviewData = JSON.parse(objectBytes(release.index_object_id).toString());
const cache = new Map<string, QuestionData>();
export function question(id: string): QuestionData {
  if (!cache.has(id)) cache.set(id, JSON.parse(objectBytes(release.question_objects[id]).toString()));
  return cache.get(id)!;
}
export function answerText(attempt: Attempt): string {
  return attempt.components.answer.object_ids.map(id => objectBytes(id).toString('utf8')).join('\n');
}
export function modelName(data: QuestionData, attempt: Attempt): string {
  const trial = data.trials.find(t => t.id === attempt.trial_id)!, config = index.configurations.find(c => c.id === trial.configuration_id)!;
  const artifact = index.artifacts.find(a => a.id === config.artifact_id)!;
  return index.checkpoints.find(c => c.id === artifact.checkpoint_id)!.name;
}
// First canonical attempt satisfying a predicate, scanning questions in index order.
export function findAttempt(test: (attempt: Attempt, data: QuestionData) => boolean): { data: QuestionData; attempt: Attempt } {
  for (const q of index.questions) {
    const data = question(q.id), attempt = data.attempts.find(a => a.canonical && test(a, data));
    if (attempt) return { data, attempt };
  }
  throw new Error('Expected a matching recorded attempt in the current release');
}
