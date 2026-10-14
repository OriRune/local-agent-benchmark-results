import type { OverviewData } from '../lib/public-types';
type Result = OverviewData['aggregates'][number];
export function CoverageBadge({ result }: { result: Result }) { return <small className={result.eligible ? '' : 'warning'}>{result.scored}/{result.planned} scored{!result.eligible ? ' · Preview' : ''}</small>; }
export default function ScoreCell({ result, binary }: { result?: Result; binary: boolean }) {
  if (!result) return <span>Not planned</span>;
  return <><strong className="number">{result.score === null ? 'Not scored' : binary ? `${result.full_credit}/${result.scored} full credit` : `${(result.score * 100).toFixed(1)}% average credit`}</strong><CoverageBadge result={result}/><small>{result.median_task_s === null ? 'No measured time' : `${result.median_task_s.toFixed(1)}s median task time · ${result.timed} measured`}</small></>;
}
export function OutcomeBreakdown({ result }: { result?: Result }) {
  if (!result) return null;
  return <div><p>{result.full_credit} full credit · {result.partial_credit} partial credit · {result.zero_credit} zero credit</p><p>{Object.entries(result.states).filter(([key, count]) => key !== 'scored' && count > 0).map(([key, count]) => `${count} ${key.replaceAll('_', ' ')}`).join(' · ') || 'No unassessed planned outcomes.'}</p>{!result.eligible && <p className="warning">Ranking unavailable: {result.ineligible_reasons.join(', ').replaceAll('_', ' ')}.</p>}</div>;
}
