import type { Attempt, Component, Object as EvidenceObject } from './public-contract';
import type { QuestionData } from './public-types';
import { outcomeLabels } from './task-outcomes';

export const NO_MATCH = 'No recorded answer matches this exact link. No other answer has been substituted; choose one from the list below.';
export const AUTO_LOAD_BYTES = 256 * 1024;

export function defaultAttemptId(data: QuestionData): string | null {
  const choices = data.attempts.filter(a => a.canonical);
  return choices.find(a => a.status === 'scored')?.id ?? choices[0]?.id ?? null;
}

// An exact link selects exactly what it names or nothing at all.
export function resolveSelection(data: QuestionData, search: string): { id: string | null; error: string } {
  const query = new URLSearchParams(search);
  if (['attempt', 'configuration', 'condition'].some(key => query.getAll(key).length > 1)) return { id: null, error: NO_MATCH };
  const requested = query.get('attempt'), configuration = query.get('configuration'), condition = query.get('condition');
  const matches = (attempt: Attempt) => {
    const trial = data.trials.find(t => t.id === attempt.trial_id);
    return !!trial && (!configuration || trial.configuration_id === configuration) && (!condition || trial.condition_id === condition);
  };
  const selected = requested ? data.attempts.find(a => a.id === requested && matches(a))
    : configuration || condition ? data.attempts.find(a => a.canonical && matches(a))
    : data.attempts.find(a => a.id === defaultAttemptId(data));
  if (!selected && (requested || configuration || condition)) return { id: null, error: NO_MATCH };
  return { id: selected?.id ?? null, error: '' };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} byte${bytes === 1 ? '' : 's'}`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function componentBytes(component: Component, objects: EvidenceObject[]): number | null {
  let total = 0;
  for (const id of component.object_ids) { const object = objects.find(o => o.id === id); if (!object) return null; total += object.bytes; }
  return total;
}

const unavailable: Record<Component['availability'], string> = {
  full: 'no saved text', redacted: 'redacted', not_recorded: 'not recorded', withheld: 'withheld', source_link_only: 'original source only',
};
// Availability shown before a disclosure is opened; never a judgement of the run.
export function availabilitySummary(component: Component, objects: EvidenceObject[]): string {
  if (!component.object_ids.length) return unavailable[component.availability];
  const bytes = componentBytes(component, objects);
  const size = bytes === null ? 'size unknown' : bytes === 0 ? 'empty' : formatBytes(bytes);
  const parts = component.object_ids.length > 1 ? `${component.object_ids.length} parts · ` : '';
  return `${component.availability === 'redacted' ? 'redacted · ' : ''}${parts}${size}`;
}

export const UNSCORED = new Set(['technical_error', 'untested', 'review', 'unresolved']);
export type OutcomeView = { key: string; label: string; unscored: boolean; credit: string };
export function outcomeView(attempt: Attempt): OutcomeView {
  const category = attempt.assessment?.category;
  const unscored = category ? UNSCORED.has(category) : attempt.score === null;
  const status = attempt.status.replaceAll('_', ' ');
  const label = category ? outcomeLabels[category] ?? category : attempt.status === 'scored' ? 'Scored' : `${status[0]!.toUpperCase()}${status.slice(1)}`;
  const credit = attempt.score === null ? (unscored ? 'Unscored · no credit assessed' : 'No credit assessed') : `${(attempt.score * 100).toFixed(1)}% credit awarded`;
  return { key: category ?? attempt.status, label, unscored, credit };
}

// Readable view of a small saved check object. The original text stays available.
export function checkEntries(text: string): [string, string][] | null {
  if (text.length > 8192) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length || entries.length > 30) return null;
  return entries.map(([key, v]) => [key, typeof v === 'string' ? v : JSON.stringify(v)]);
}

// Reading presentation only: never used to score or normalize a model answer.
// Complex reference structures keep their original display and download.
export function referenceEntries(text: string): string[] | null {
  if (text.length > 8192) return null;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.length > 30 || !values.every(v => typeof v === 'string' || typeof v === 'number')) return null;
  return [...new Set(values.map(String))];
}
