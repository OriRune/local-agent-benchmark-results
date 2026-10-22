import type { OverviewData } from '../lib/public-types';
import { outcomeMetrics, rateText } from '../lib/outcome-metrics';
import OutcomeBar from './OutcomeBar';

export default function OutcomeMetrics({result, binary}: {result: OverviewData['aggregates'][number]; binary: boolean}) {
  const counts = outcomeMetrics(result);
  if (!counts) return <strong>{result.score == null ? 'Not scored' : binary ? <>{result.full_credit}/{result.scored} <span className="outcome-label" data-outcome="full_credit">full credit</span></> : `${(result.score * 100).toFixed(1)}% average credit`}</strong>;
  return <div className="outcome-metrics">
    <dl>
      {!binary && <div><dt>Average credit</dt><dd>{result.score == null ? '—' : `${(result.score * 100).toFixed(1)}%`}</dd></div>}
      <div><dt>{binary ? 'Pass rate' : 'Full-credit rate'}</dt><dd>{rateText(counts.full, counts.assessed)}</dd></div>
      <div><dt>Answers completed</dt><dd>{rateText(counts.completed, counts.assessed)}</dd></div>
      <div><dt>{binary ? 'Correct / completed' : 'Full credit / completed'}</dt><dd>{rateText(counts.full, counts.completed)}</dd></div>
    </dl>
    <OutcomeBar result={result}/>
    {counts.unscored > 0 && <small>{counts.unscored} unscored; excluded from these rates.</small>}
  </div>;
}
