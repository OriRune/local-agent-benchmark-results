import type { OverviewData } from '../lib/public-types';
import { comparisonUrl } from '../lib/comparison';
import ThinkingPairs from './ThinkingPairs';
const value = (n: number | null, suffix = '', signed = false) => n === null ? 'Not measured' : `${signed && n > 0 ? '+' : ''}${n.toFixed(1)}${suffix}`;
export default function ThinkingTradeoff({ facts, releaseId }: { facts?: OverviewData['comparisons'][number]; releaseId: string }) {
  return <section className="panel"><h2>Thinking tradeoff</h2>{!facts || !facts.verified ? <p>No verified on/off comparison is available for this configuration and test suite. Requested modes alone do not establish a controlled thinking comparison.</p> : <>
    <p>{facts.score_pairs}/{facts.planned_pairs} matched scored questions · {facts.time_pairs}/{facts.planned_pairs} matched timed questions{!facts.complete || !facts.timing_complete ? ' · Preview: coverage is incomplete.' : ''}</p>
    {facts.ceiling && <p className="facts">Both modes earned full credit on every matched question. These matched results leave no measured quality headroom; unmatched questions are not covered by this observation.</p>}
    <div className="table-scroll" role="region" aria-label="Thinking measurements" tabIndex={0}><table><thead><tr><th>Matched measurement</th><th>Recorded result</th></tr></thead><tbody>
      <tr><td>Average credit, off → on</td><td>{value(facts.off_score === null ? null : facts.off_score * 100, '%')} → {value(facts.on_score === null ? null : facts.on_score * 100, '%')}</td></tr>
      <tr><td>Mean paired credit change</td><td>{value(facts.delta_pp, ' percentage points', true)}</td></tr>
      <tr><td>Question outcomes</td><td>{facts.improved} improved · {facts.unchanged} unchanged · {facts.worsened} worse</td></tr>
      <tr><td>Mean added task time</td><td>{value(facts.mean_added_s, 's', true)}</td></tr>
      <tr><td>Mean task time, off → on</td><td>{value(facts.mean_off_s, 's')} → {value(facts.mean_on_s, 's')}</td></tr>
      <tr><td>Median task time, off → on</td><td>{value(facts.median_off_s, 's')} → {value(facts.median_on_s, 's')}</td></tr>
      <tr><td>Median of paired time changes</td><td>{value(facts.median_paired_delta_s, 's', true)}</td></tr>
      <tr><td>Total added task time</td><td>{value(facts.total_added_s, 's', true)}</td></tr>
      <tr><td>Ratio of summed times, on / off</td><td>{value(facts.ratio_summed_time, '×')}</td></tr>
    </tbody></table></div><p className="footnote">Quality and timing can cover different subsets. Median paired change is calculated per question; it is not the difference between the two medians. Task time includes tools and grading.</p>
    {facts.off_condition_id && facts.on_condition_id && <a href={comparisonUrl({ releaseId, suiteId: facts.suite_id, selections: [facts.off_condition_id, facts.on_condition_id].map(conditionId => ({ configurationId: facts.configuration_id, conditionId })) })}>Inspect the matched modes and their answers →</a>}
    <ThinkingPairs key={`${releaseId}:${facts.id}`} facts={facts} releaseId={releaseId}/>
  </>}</section>;
}
