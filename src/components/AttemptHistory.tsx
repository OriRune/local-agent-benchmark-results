import { useState } from 'react';
import type { QuestionData } from '../lib/public-types';
import EvidenceViewer from './EvidenceViewer';
export default function AttemptHistory({ ids, data, choose }: { ids: string[]; data: QuestionData; choose: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(ids.length / 20));
  return <details><summary>Previous attempts and grades ({ids.length})</summary>
    <p>Historical attempts do not add votes to the canonical score.</p>
    {ids.slice((page - 1) * 20, page * 20).map(id => {
      const old = data.attempts.find(a => a.id === id);
      return old ? <div key={id}><p>{old.status} · {old.score === null ? 'Unassessed' : `${old.score * 100}% credit`} · {old.grader_revision}</p><button aria-label={`Open historical attempt ${id}`} onClick={() => choose(id)}>Inspect this historical attempt</button><EvidenceViewer component={old.components.checks} objects={data.objects} label="Previous checks"/></div> : <p key={id}>This historical attempt is unavailable.</p>;
    })}
    {pages > 1 && <nav className="toolbar" aria-label="Historical attempt pages"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous history</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(page + 1)}>Next history</button></nav>}
  </details>;
}
