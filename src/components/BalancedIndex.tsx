import type {OverviewData} from '../lib/public-types';
import {qualityIndex,indexLabel} from '../lib/quality-index';
export default function BalancedIndex({data,configurationId,conditionId}:{data:OverviewData;configurationId:string;conditionId:string}) {
  const index=qualityIndex(data,data.aggregates.filter(r=>r.configuration_id===configurationId&&r.condition_id===conditionId));
  if(!index.policySupported||data.configurations.find(c=>c.id===configurationId)?.status==='withdrawn')return null;
  return <section className="balanced-index" aria-label="Balanced overall index"><div><h2>Overall across tasks</h2><p className="score">{indexLabel(index)} <small>/ 100</small></p></div><div><p>Nine categories, equally weighted · {index.eligible}/9 eligible</p><p className="footnote">{index.complete?'Complete coverage for this setup.':index.upper-index.lower>1e-9?'Possible score range with unscored tasks receiving zero to full credit. Incomplete results remain unranked; this is not a confidence interval.':'Recorded score with setup qualifications; not eligible for ranking.'} Quality only; speed is separate. <a href="/methodology/#balanced-index">How the index works →</a></p></div></section>;
}
