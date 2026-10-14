import type { PeerChart } from '../lib/summary-view';

export default function SummaryPeerChart({ chart }: { chart:PeerChart }) {
  return <figure className="summary-peer-chart">
    <figcaption><strong>{chart.title}</strong><span>{chart.mode} · {chart.cohort}</span></figcaption>
    <p className="chart-description">{chart.description}</p>
    <p className="chart-scale">{chart.metric} · {chart.binary ? '0–100%' : '0–100 points'} · higher is better{chart.uniformCoverage && <><br/>{chart.uniformCoverage}.</>}</p>
    <p className="chart-note">Gaps are relative to this model. Treat small gaps cautiously.</p>
    <ol className="peer-bars" aria-label={`${chart.title} ranking`}>
      {chart.rows.map((row,index) => <li key={index} className={row.subject ? 'peer-subject' : ''}>
        <div className="peer-label"><span><span className="peer-rank" aria-label={`${row.tied ? 'Tied rank' : 'Rank'} ${row.rank}`}>{row.tied ? '=' : '#'}{row.rank}</span> {row.href ? <a href={row.href}>{row.name}</a> : <strong>{row.name}</strong>}{row.size!=null && <small className="peer-size">{row.size.toFixed(1)}B total parameters</small>}</span><strong className="peer-score">{(row.score*100).toFixed(1)}{chart.binary ? '%' : '/100'}</strong></div>
        <div className="peer-track" aria-hidden="true"><span style={{width:`${row.score*100}%`}}/></div>
        <small className="peer-gap">{row.gap}{!chart.uniformCoverage && <> · {row.scored} of {row.planned} tasks scored</>}</small>
      </li>)}
    </ol>
    {chart.ceiling && <p className="chart-note">Several models reached full marks; this test cannot separate their top scores.</p>}
    {chart.otherMode && <p className="chart-note">{chart.otherMode}</p>}
    <details className="chart-details"><summary>How this comparison works</summary><p>{chart.metricExplanation} Family comparisons show the labeled Instruct and reasoning versions. Other peer comparisons use the same requested thinking setting, not necessarily each model’s best mode. Small differences on these short tests may not hold on other tasks. Peer membership varies by test coverage and compatible settings.</p>
    {chart.moe && <p className="chart-note">MoE models use only part of their parameters for each token. This group uses total size; active counts are not included in this saved comparison.</p>}
    </details>
    <p className="chart-note">Comparison saved with the {chart.date} assessment. {chart.stale && <span>Newer peer results exist; this chart preserves the original comparison. </span>}Task-specific results.</p>
  </figure>;
}
