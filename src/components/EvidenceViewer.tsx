import { assertObjectAvailable } from '../lib/withdrawal-client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Component, Object as EvidenceObject } from '../lib/public-contract';
import { fetchEvidence } from '../lib/evidence-client';
import { evidencePages, evidencePageAt, findEvidence } from '../lib/evidence-pages';
export default function EvidenceViewer({ component, objects, label, auto = false }: { component: Component; objects: EvidenceObject[]; label: string; auto?: boolean }) {
  const [text, setText] = useState<string | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [originals, setOriginals] = useState<Uint8Array[]>([]);
  const searchId = useId();
  const [page, setPage] = useState(0); const [query, setQuery] = useState('');
  const [match, setMatch] = useState(-1); const [searched, setSearched] = useState(false);
  const offsets = useMemo(() => evidencePages(text ?? ''), [text]);
  const pageIndex = Math.min(page, offsets.length - 2);
  const start = offsets[pageIndex], end = offsets[pageIndex + 1];
  const visible = text?.slice(start, end) ?? '';
  const highlighted = match >= start && match < end && query.length > 0;
  const identity = component.object_ids.join(',');
  const version = useRef(0);
  async function load() {
    const requestVersion = ++version.current;
    setLoading(true); setError('');
    try { const parts = await Promise.all(component.object_ids.map(id => { const o = objects.find(o => o.id === id); if (!o) throw new Error('Evidence object is unavailable.'); return fetchEvidence(o); })); if (version.current === requestVersion) { setOriginals(parts); setPage(0); setMatch(-1); setSearched(false); setText(parts.map(b => new TextDecoder().decode(b)).join('\n')); } }
    catch (e) { if (version.current === requestVersion) setError((e as Error).message); } finally { if (version.current === requestVersion) setLoading(false); }
  }
  useEffect(() => { setText(null); setOriginals([]); setPage(0); setQuery(''); setMatch(-1); setSearched(false); setError(''); setLoading(false); if (auto && component.object_ids.length) void load(); return () => { version.current++; }; }, [identity, auto]);
  if (!component.object_ids.length) return <div className="evidence"><span className="badge">{component.availability.replaceAll('_', ' ')}</span><p className="muted">{component.reason}</p>{component.source?.url && <a href={component.source.url}>Original source →</a>}</div>;
  async function download(index: number) { try { await assertObjectAvailable(component.object_ids[index]); } catch (error) { setError((error as Error).message); setText(null); setOriginals([]); return; } const bytes = originals[index]; if (!bytes) return; const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${component.object_ids[index]}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function search(backwards = false) {
    const next = findEvidence(text ?? '', query, match, backwards);
    setMatch(next); setSearched(true);
    if (next >= 0) setPage(evidencePageAt(offsets, next));
  }
  return <div className="evidence">
    <small>{component.origin.replaceAll('_', ' ')} · {component.availability}{component.reason ? ` · ${component.reason}` : ''}</small>
    <div>{text === null && <button onClick={load} disabled={loading}>{loading ? 'Loading…' : `Read ${label.toLowerCase()}`}</button>}
      {originals.map((_, i) => <button key={component.object_ids[i]} onClick={() => download(i)}>{originals.length === 1 ? 'Download text' : `Download part ${i + 1}`}</button>)}
    </div>
    {error && <p role="alert" className="warning">{error} <button onClick={load}>Retry</button></p>}
    {text !== null && <>
      {text.length > 2000 && <form className="toolbar" role="search" aria-label={`Search ${label.toLowerCase()}`} onSubmit={event => { event.preventDefault(); search(); }}>
        <label htmlFor={searchId}>Find in {label.toLowerCase()} (case-sensitive)</label>
        <input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setMatch(-1); setSearched(false); }} />
        <button type="submit" disabled={!query}>Find next</button>
        <button type="button" disabled={!query} onClick={() => search(true)}>Find previous</button>
        <span role="status">{searched && (match < 0 ? 'No match in the complete text.' : 'Match highlighted; search wraps at the end.')}</span>
      </form>}
      {offsets.length > 2 && <div className="toolbar" role="group" aria-label={`${label} pages`}>
        <button disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>Previous page</button>
        <span aria-live="polite">Page {pageIndex + 1} of {offsets.length - 1}</span>
        <button disabled={pageIndex === offsets.length - 2} onClick={() => setPage(pageIndex + 1)}>Next page</button>
        <small>Download includes the complete text.</small>
      </div>}
      <pre role="region" tabIndex={0} aria-label={`${label} text`}>{highlighted ? <>{visible.slice(0, match - start)}<mark>{visible.slice(match - start, match - start + query.length)}</mark>{visible.slice(match - start + query.length)}</> : visible}</pre>
    </>}
  </div>;
}
