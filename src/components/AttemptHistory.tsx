import { useState } from 'react';
import type { QuestionData } from '../lib/public-types';
import { outcomeView } from '../lib/answer-view';
import EvidenceViewer from './EvidenceViewer';
import { openWithLink } from './AnswerList';
const PAGE = 20;
export default function AttemptHistory({ ids, data, href, open }: { ids: string[]; data: QuestionData; href: (id: string) => string; open: (id: string) => void }) {
  const [page, setPage] = useState(1);
  if (!ids.length) return null;
  const pages = Math.max(1, Math.ceil(ids.length / PAGE)), first = (page - 1) * PAGE;
  return <details className="attempt-history"><summary>Previous attempts and grades ({ids.length})</summary>
    <p>Earlier attempts and grades for this same setup are kept for inspection. They do not add votes to the canonical score.</p>
    <ol start={first + 1}>{ids.slice(first, first + PAGE).map((id, i) => {
      const old = data.attempts.find(a => a.id === id);
      if (!old) return <li key={id}>This historical attempt is unavailable.</li>;
      const outcome = outcomeView(old);
      return <li key={id}><p>{outcome.label} · {old.score === null ? 'Unscored' : `Credit: ${(old.score * 100).toFixed(1)}%`} · grader {old.grader_revision}</p>
        <a href={href(id)} aria-label={`Open historical attempt ${id}`} onClick={event => openWithLink(event, () => open(id))}>Read this historical attempt</a>
        <EvidenceViewer component={old.components.checks} objects={data.objects} label={`Checks for previous attempt ${first + i + 1}`}/></li>;
    })}</ol>
    {pages > 1 && <nav className="toolbar" aria-label="Previous attempt list"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous {PAGE} attempts</button><span>Attempts {first + 1}–{Math.min(first + PAGE, ids.length)} of {ids.length}</span><button type="button" disabled={page === pages} onClick={() => setPage(page + 1)}>Next {PAGE} attempts</button></nav>}
  </details>;
}
