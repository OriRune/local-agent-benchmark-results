import { evidenceGroups, type SummaryReference } from '../lib/summary-view';

export default function SummaryEvidence({ ids, references }: { ids:string[]; references:Record<string,SummaryReference> }) {
  return <details className="summary-evidence"><summary>Evidence for this judgment</summary>
    {evidenceGroups(ids, references).map((group,index) => <div className="evidence-group" key={index}>
      {group.numerical ? <>
        <table><caption>{group.title}</caption><tbody>
          {group.overview?.map((row,i)=><tr key={`overview-${i}`}><th scope="row">{row.label}</th><td>{row.detail}</td></tr>)}
          {group.rows.map(ref => <tr key={ref.id}><th scope="row">{ref.label}</th><td>{ref.detail}</td></tr>)}
        </tbody></table>
        {group.href && <a className="evidence-link" href={group.href}>Explore these test results →</a>}
        {group.answersHref && <p><a className="evidence-link" href={group.answersHref}>View this model’s answers, code and tool activity →</a></p>}
      </> : group.rows.map(ref => <p key={ref.id}><strong>{ref.label}</strong><br/>{ref.detail}{ref.href && <><br/><a href={ref.href}>View the question and recorded answer →</a></>}</p>)}
    </div>)}
  </details>;
}
