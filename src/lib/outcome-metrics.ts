import type { Aggregate } from './public-contract';

// Only assessed outcomes can establish either completion or correctness.
// Missing, technical and held results are unknown, not failed completions.
export function outcomeMetrics(result: Pick<Aggregate, 'outcome_counts'>) {
  const o = result.outcome_counts;
  if (!o) return null;
  const completed = o.full_credit + o.partial_credit + o.incorrect;
  const assessed = completed + o.failed_to_finish;
  return { full: o.full_credit, completed, assessed,
    unscored: o.technical_error + o.untested + o.review + o.unresolved };
}
export function rateText(n: number, d: number) {
  return `${n}/${d} · ${d ? `${Math.round(n / d * 100)}%` : '—'}`;
}
