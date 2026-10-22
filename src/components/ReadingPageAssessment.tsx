import type { Attempt, Object as EvidenceObject } from '../lib/public-contract';
import { readingPageChecks } from '../lib/reading-page-checks';
import EvidenceViewer from './EvidenceViewer';

export default function ReadingPageAssessment({attempt, objects}: {attempt: Attempt; objects: EvidenceObject[]}) {
  return <section className="reading-page-assessment" aria-labelledby="reading-page-grade-heading">
    <h3 id="reading-page-grade-heading">Why this page received its grade</h3>
    <p>This all-or-nothing grade checks content and the final reply, not visual design. A good-looking page can receive zero. In particular, the checker requires a data-issue explanation that the prompt did not explicitly request.</p>
    {attempt.score === null && <p><strong>This attempt is unscored.</strong> Any saved checks below are diagnostic evidence, not an assessed result.</p>}
    <EvidenceViewer component={attempt.components.checks} objects={objects} label="Reading-page check" auto present={text => {
      const checks = readingPageChecks(text);
      if (!checks) return null;
      return <><p><strong>{checks.page ? 'A page was created.' : 'No HTML file was found by the saved check.'}</strong> {attempt.score === 0 && checks.page && 'Zero credit here does not mean the model failed to write HTML.'}</p>
        {checks.items.some(item => item.state === 'fail') && <p><strong>Failed checks:</strong> {checks.items.filter(item => item.state === 'fail').map(item => item.label).join('; ')}.</p>}
        <details><summary>What passed, what failed, and why</summary><ul className="reading-checks">{checks.items.map(item => <li key={item.label}><strong><span className="check-state" data-outcome={item.state === 'pass' ? 'full_credit' : item.state === 'fail' ? 'incorrect' : 'note'}>{item.state === 'pass' ? 'Passed check' : item.state === 'fail' ? 'Failed check' : 'Observation'}</span> {item.label}</strong><p>{item.detail}</p></li>)}</ul></details></>;
    }}/>
    <p className="footnote">These explanations translate the saved checks. They do not award new credit. A screenshot captured later can differ from what the original check saw. <a href="/methodology/#reading-page-grading">Grading limits and partial credit →</a></p>
  </section>;
}
