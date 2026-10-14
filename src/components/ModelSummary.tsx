import type { Claim, ReaderClaim } from '../lib/public-summary';
import { summaryClaimText, type SummaryView } from '../lib/summary-view';
import SummaryAttribution from './SummaryAttribution';
import SummaryEvidence from './SummaryEvidence';
import SummaryPeerChart from './SummaryPeerChart';
import SummarySpeedChart from './SummarySpeedChart';
import { modelMentionParts } from '../lib/model-mentions';

export default function ModelSummary({ analysis, configurationId }: { analysis?: SummaryView; configurationId: string }) {
  if (!analysis || analysis.summary.editorial.state !== 'approved' || analysis.summary.subject.configuration_id !== configurationId) return <section id="model-analysis" className="facts"><h2>Factual assessment</h2><p>No approved cloud analysis is available for this configuration. The results below are recorded benchmark facts.</p></section>;
  const { summary, references, modelMentions = [] } = analysis;
  const displayedCharts=new Set<string>();
  function claim(value: Claim | ReaderClaim, index: number, showCharts=false) {
    return <div key={index}><p>{modelMentionParts(summaryClaimText(value),modelMentions).map((part,i)=>part.href ? <a key={i} href={part.href}>{part.text}</a> : part.text)}</p>{value.illustration && <small>Illustration from reviewed evidence; not a whole-bank conclusion.</small>}
      <SummaryEvidence ids={value.evidence_refs} references={references}/>
      {showCharts && value.evidence_refs.map(id=>{const chart=references[id]?.chart;if(!chart || displayedCharts.has(id))return null;displayedCharts.add(id);return <SummaryPeerChart key={id} chart={chart}/>;})}
      {value.evidence_refs.map(id=>{const chart=references[id]?.speedChart;if(!chart || displayedCharts.has(id))return null;displayedCharts.add(id);return <SummarySpeedChart key={id} chart={chart}/>;})}

    </div>;
  }
  return <section id="model-analysis" className="panel" aria-label="Reviewed model analysis"><h2>Model analysis</h2>
    <p className="muted">This analysis covers this configuration across its recorded thinking conditions and test suites.</p>
    {analysis.comparisonRefreshNeeded && <p className="muted">Newer peer results are available. This assessment and its supporting charts preserve the comparisons available on {summary.generated_at.slice(0,10)}.</p>}
    {claim(summary.content.verdict, 0)}
    <SummaryAttribution summary={summary}/>
    <div>
      {([['Good at', summary.content.strengths], ['Struggles with', summary.content.weaknesses], ['Should you enable thinking?', summary.content.thinking_tradeoffs], ['Compared with other models', 'peer_comparisons' in summary.content ? summary.content.peer_comparisons : []], ['Worth knowing', analysis.visibleLimitations ?? summary.content.limitations]] as const).map(([heading, claims]) => claims.length > 0 && <section key={heading}><h3>{heading}</h3>{claims.map((value,index)=>claim(value,index,heading === 'Compared with other models'))}</section>)}
    </div>
    <p className="footnote"><a href="/methodology/#summary-limitations">How to interpret these assessments and their limitations →</a></p>
  </section>;
}
