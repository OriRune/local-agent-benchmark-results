import type { Aggregate, Artifact, Condition, Configuration } from './public-contract';

export const BANDS = [
  { id: 'under-3', name: 'Under 3 GB', description: 'Smallest downloads' },
  { id: '3-8', name: '3–8 GB', description: 'Compact downloads' },
  { id: '8-16', name: '8–16 GB', description: 'Larger downloads' },
  { id: '16-plus', name: '16 GB and up', description: 'Largest downloads' },
  { id: 'unknown', name: 'Size not recorded', description: 'Download size unavailable' },
] as const;
export type Band = (typeof BANDS)[number]['id'];
export function sizeBand(bytes: number | null): Band {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'unknown';
  return bytes < 3e9 ? 'under-3' : bytes < 8e9 ? '3-8' : bytes < 16e9 ? '8-16' : '16-plus';
}
export function formatBytes(bytes: number | null): string {
  return bytes === null ? 'Not recorded' : `${(bytes / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })} GB`;
}
export function compareNullable(a: number | null, b: number | null, descending = false): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return descending ? b - a : a - b;
}
export function topWithTies<T extends { id: string; score: number | null; eligible: boolean }>(rows: T[], count = 3): T[] {
  const sorted = rows.filter(r => r.eligible && r.score !== null)
    .sort((a, b) => compareNullable(a.score, b.score, true) || a.id.localeCompare(b.id));
  if (sorted.length <= count) return sorted;
  const cutoff = sorted[count - 1]!.score!;
  return sorted.filter((r, i) => i < count || r.score === cutoff);
}
export function scoreLabel(aggregate: Aggregate, binary: boolean): string {
  if (aggregate.score === null) return 'Not scored';
  if (binary) return `${aggregate.full_credit}/${aggregate.scored}`;
  return `${(aggregate.score * 100).toFixed(1)}% credit`;
}
export type Candidate = { configuration: Configuration; artifact: Artifact; condition: Condition; aggregate: Aggregate };
export function suggestedPeers(subject: Candidate, candidates: Candidate[]): Candidate[] {
  return candidates.filter(c => c.configuration.id !== subject.configuration.id &&
      c.aggregate.suite_id === subject.aggregate.suite_id &&
      c.condition.reasoning_requested === subject.condition.reasoning_requested &&
      c.condition.observed_reasoning === subject.condition.observed_reasoning &&
      c.condition.temperature === subject.condition.temperature && c.condition.kind === subject.condition.kind &&
      c.condition.protocol_id === subject.condition.protocol_id &&
      sizeBand(c.artifact.total_bytes) === sizeBand(subject.artifact.total_bytes))
    .sort((a, b) => Number(b.aggregate.eligible) - Number(a.aggregate.eligible) ||
      compareNullable(distance(a.artifact.total_bytes, subject.artifact.total_bytes), distance(b.artifact.total_bytes, subject.artifact.total_bytes)) ||
      a.configuration.id.localeCompare(b.configuration.id)).slice(0, 3);
}
function distance(a: number | null, b: number | null): number | null { return a === null || b === null ? null : Math.abs(a - b); }
