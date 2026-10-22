import type { Aggregate } from '../lib/public-contract';
import { outcomeSegments } from '../lib/task-outcomes';
export default function OutcomeBar({result}: {result:Pick<Aggregate,'planned'|'outcome_counts'>}) {
  const segments=outcomeSegments(result);
  if (!segments.length || !result.planned) return null;
  const label=segments.map(s=>`${s.count} ${s.label.toLowerCase()}`).join(', ');
  return <span className="outcome-distribution"><span className="outcome-track" role="img" aria-label={`${result.planned} planned tasks: ${label}`} title={label}>{segments.filter(s=>s.count).map(s=><span key={s.key} className={`outcome-segment outcome-${s.key}`} style={{width:`${s.count/result.planned*100}%`}}/>)}</span><span className="outcome-counts">{segments.filter(s=>s.count).map(s=><span key={s.key} data-outcome={s.key}><i aria-hidden="true" className={`outcome-key outcome-${s.key}`}/>{s.count} {s.label.toLowerCase()}</span>)}</span></span>;
}
