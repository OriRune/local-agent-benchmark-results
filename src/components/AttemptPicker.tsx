import { useEffect, useState } from 'react';
import type { Attempt } from '../lib/public-contract';

type View = { search: string; status: string; page: number };
const statuses = ['scored', 'blocked', 'review', 'infra_error', 'context_limit', 'interrupted', 'pending', 'not_scheduled'];
export default function AttemptPicker({ attempts, selectedId, label, choose }: { attempts: Attempt[]; selectedId: string; label: (id: string) => string; choose: (id: string) => void }) {
  const [view, setView] = useState<View>({ search: '', status: 'all', page: 1 });
  const [error, setError] = useState(''), [ready, setReady] = useState(false);
  useEffect(() => {
    function restore() {
      const query = new URLSearchParams(location.search);
      const status = query.get('answer_status') || 'all', rawPage = query.get('answer_page') || '1';
      if (['answer_q', 'answer_status', 'answer_page'].some(key => query.getAll(key).length > 1) || !['all', ...statuses].includes(status) || !/^[1-9]\d*$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage))) setError('The answer-list filters are invalid. Reset them to browse recorded answers.');
      else { setView({ search: query.get('answer_q') || '', status, page: Number(rawPage) }); setError(''); }
      setReady(true);
    }
    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, []);
  function update(next: View, replace = false) {
    const query = new URLSearchParams(location.search);
    for (const key of ['answer_q', 'answer_status', 'answer_page']) query.delete(key);
    if (next.search) query.set('answer_q', next.search);
    if (next.status !== 'all') query.set('answer_status', next.status);
    if (next.page !== 1) query.set('answer_page', String(next.page));
    history[replace ? 'replaceState' : 'pushState'](null, '', `${location.pathname}?${query}${location.hash}`);
    setView(next); setError('');
  }
  const canonical = attempts.filter(a => a.canonical);
  const matched = canonical.filter(a => (view.status === 'all' || a.status === view.status) && `${label(a.trial_id)} ${a.id}`.toLowerCase().includes(view.search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matched.length / 20)), page = Math.min(view.page, pages), rows = matched.slice((page - 1) * 20, page * 20);
  const selected = attempts.find(a => a.id === selectedId), pinned = selected && !rows.some(a => a.id === selectedId);
  return <div className="answer-picker">
    <div className="toolbar" role="search" aria-label="Recorded answers">
      <label style={{ maxWidth: '100%' }}>Find model, thinking mode, seed or attempt ID <input style={{ maxWidth: '100%' }} type="search" disabled={!ready} value={view.search} onChange={event => update({ ...view, search: event.target.value, page: 1 }, true)}/></label>
      <label htmlFor="answer-outcome">Answer outcome</label><select id="answer-outcome" disabled={!ready} value={view.status} onChange={event => update({ ...view, status: event.target.value, page: 1 })}><option value="all">All outcomes</option>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>
      {(error || view.search || view.status !== 'all') && <button onClick={() => update({ search: '', status: 'all', page: 1 })}>Reset answer filters</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    <p role="status">{matched.length ? `${(page - 1) * 20 + 1}–${(page - 1) * 20 + rows.length} of ${matched.length} matching answers` : 'No matching answers.'} · {canonical.length} canonical attempts in this question version</p>
    <label htmlFor="answer-model">Tested configuration and trial</label>
    <select id="answer-model" disabled={!ready} value={selectedId} onChange={event => choose(event.target.value)} style={{ width: '100%', marginTop: 10 }}>
      {!selected && <option value="" disabled>Choose a recorded answer</option>}
      {pinned && <option value={selected.id}>{label(selected.trial_id)} — {selected.canonical ? 'selected outside this page/filter' : 'historical grade'}</option>}
      {rows.map(a => <option key={a.id} value={a.id}>{label(a.trial_id)} — {a.status}</option>)}
    </select>
    {pinned && <p className="footnote">The selected answer remains open even when it is outside this page or filter. Filters do not change scores or select a different answer.</p>}
    {pages > 1 && <nav className="toolbar" aria-label="Answer pages"><button disabled={!ready || page === 1} onClick={() => update({ ...view, page: page - 1 })}>Previous answers</button><span>Page {page} of {pages}</span><button disabled={!ready || page === pages} onClick={() => update({ ...view, page: page + 1 })}>Next answers</button></nav>}
  </div>;
}
