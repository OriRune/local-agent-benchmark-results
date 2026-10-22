import { useEffect, useState, type MouseEvent } from 'react';
import type { Attempt } from '../lib/public-contract';
import type { OutcomeView } from '../lib/answer-view';

export type AnswerRow = { attempt: Attempt; name: string; setup: string; outcome: OutcomeView; search: string };
type View = { search: string; status: string; page: number };
const PAGE = 25, KEYS = ['answer_q', 'answer_status', 'answer_page'];
const order = ['full_credit', 'partial_credit', 'incorrect', 'failed_to_finish', 'technical_error', 'untested', 'review', 'unresolved', 'scored', 'blocked', 'infra_error', 'context_limit', 'interrupted', 'pending', 'not_scheduled'];

// Ordinary clicks open in place; modified and middle clicks keep browser behaviour.
export function openWithLink(event: MouseEvent<HTMLAnchorElement>, open: () => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); open();
}

export default function AnswerList({ rows, selectedId, href, open }: { rows: AnswerRow[]; selectedId: string | null; href: (id: string) => string; open: (id: string) => void }) {
  const [view, setView] = useState<View>({ search: '', status: 'all', page: 1 });
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [announced, setAnnounced] = useState('');
  const statuses = order.filter(key => rows.some(r => r.outcome.key === key));
  useEffect(() => {
    function restore() {
      const query = new URLSearchParams(location.search);
      const status = query.get('answer_status') || 'all', rawPage = query.get('answer_page') || '1';
      if (KEYS.some(key => query.getAll(key).length > 1) || !['all', ...order].includes(status) || !/^[1-9]\d*$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage))) setError('The answer-list filters in this link are invalid. Reset them to browse recorded answers.');
      else { setView({ search: query.get('answer_q') || '', status, page: Number(rawPage) }); setError(''); }
      setReady(true);
    }
    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, []);
  // Filters and list pages replace the current history entry; only opening an answer adds one.
  function update(next: View) {
    const query = new URLSearchParams(location.search);
    for (const key of KEYS) query.delete(key);
    if (next.search) query.set('answer_q', next.search);
    if (next.status !== 'all') query.set('answer_status', next.status);
    if (next.page !== 1) query.set('answer_page', String(next.page));
    history.replaceState(history.state, '', `${location.pathname}?${query}${location.hash}`);
    setView(next); setError('');
  }
  const term = view.search.trim().toLowerCase();
  const matched = rows.filter(r => (view.status === 'all' || r.attempt.status === view.status || r.attempt.assessment?.category === view.status) && r.search.includes(term));
  const filtered = matched.length !== rows.length;
  const pages = Math.max(1, Math.ceil(matched.length / PAGE)), page = Math.min(view.page, pages), first = (page - 1) * PAGE;
  const visible = matched.slice(first, first + PAGE);
  const range = matched.length ? `Showing recorded answers ${first + 1}–${first + visible.length} of ${matched.length}${filtered ? ` matching (${rows.length} in total)` : ''}` : 'No recorded answers match these filters.';
  useEffect(() => { const timer = setTimeout(() => setAnnounced(range), 600); return () => clearTimeout(timer); }, [range]);
  return <section className="answer-list" aria-labelledby="answer-list-heading">
    <h2 id="answer-list-heading">All recorded answers to this question</h2>
    <p className="muted">Each row is one recorded test trial: a model, weight format, thinking setting and seed. Open a row to read that answer above. Filtering this list never changes the open answer.</p>
    <div className="toolbar" role="search" aria-label="Filter recorded answers">
      <label>Find model, setup, seed or attempt ID <input type="search" disabled={!ready} value={view.search} onChange={event => update({ ...view, search: event.target.value, page: 1 })}/></label>
      <label htmlFor="answer-outcome">Answer outcome</label>
      <select id="answer-outcome" disabled={!ready} value={view.status} onChange={event => update({ ...view, status: event.target.value, page: 1 })}>
        <option value="all">All outcomes ({rows.length})</option>
        {view.status !== 'all' && !statuses.includes(view.status) && order.includes(view.status) && <option value={view.status}>Recorded status: {view.status.replaceAll('_', ' ')} ({rows.filter(r => r.attempt.status === view.status).length})</option>}
        {statuses.map(key => { const sample = rows.find(r => r.outcome.key === key)!; return <option key={key} value={key}>{sample.outcome.label} ({rows.filter(r => r.outcome.key === key).length})</option>; })}
      </select>
      {(error || view.search || view.status !== 'all') && <button type="button" onClick={() => update({ search: '', status: 'all', page: 1 })}>Reset answer filters</button>}
    </div>
    {error && <p role="alert" className="warning">{error}</p>}
    <p className="answer-list-range">{range} · sorted by model name</p>
    <p className="sr-only" role="status">{announced}</p>
    {visible.length > 0 && <ol className="answer-rows" start={first + 1} aria-label="Recorded answers">{visible.map(r => {
      const selected = r.attempt.id === selectedId;
      return <li key={r.attempt.id} className={selected ? 'is-selected' : undefined}>
        <a href={href(r.attempt.id)} aria-current={selected ? 'true' : undefined} onClick={event => openWithLink(event, () => open(r.attempt.id))}><strong>{r.name}</strong> <span>{r.setup}</span></a>
        <span className="answer-row-outcome"><span className="badge outcome-badge" data-outcome={r.outcome.key}>{r.outcome.label}</span>{selected && <small> Open above</small>}</span>
      </li>;
    })}</ol>}
    {pages > 1 && <nav className="toolbar answer-pages" aria-label="Recorded answer list pages">
      <button type="button" disabled={page === 1} onClick={() => update({ ...view, page: page - 1 })}>Previous {PAGE} answers</button>
      <span>List page {page} of {pages}</span>
      <button type="button" disabled={page === pages} onClick={() => update({ ...view, page: page + 1 })}>Next {PAGE} answers</button>
    </nav>}
  </section>;
}
