import type { OverviewData } from '../lib/public-types';
import { takeaways } from '../lib/takeaways';
export default function Takeaways({ data, suiteId, mode, releaseId }: { data: OverviewData; suiteId: string; mode: 'off' | 'on'; releaseId: string }) {
  const items = takeaways(data, suiteId, mode, releaseId);
  if (!items.length) return null;
  return <section aria-label="Recorded takeaways"><h2>What these results show</h2><p className="footnote">Computed from complete baseline results for this test, across all models. Search filters do not change these comparison groups. These are observations of tested setups on one machine.</p>
    <div className="grid">{items.map(item => <article className="card" key={item.kind}><h3>{item.title}</h3><p>{item.text}</p><p><small>{item.cohort}</small></p><a href={item.href}>Inspect this comparison →</a>
      <details><summary>How this observation was selected</summary><p>Quality and file-size observations use the largest group with matching test controls within one download-size band. Thinking uses the first configuration by stable ID with complete verified quality and timing pairs. No overall ability or hardware-fit ranking is inferred.</p><small>Policy {item.policy} · template {item.template}</small><p>Supporting facts: {item.factIds.join(', ')}</p><p>Comparison group facts: {item.cohortIds.join(', ')}</p></details>
    </article>)}</div></section>;
}
