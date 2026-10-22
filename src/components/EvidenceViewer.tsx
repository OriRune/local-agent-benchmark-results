import { assertObjectAvailable } from '../lib/withdrawal-client';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Component, Object as EvidenceObject } from '../lib/public-contract';
import { fetchEvidence } from '../lib/evidence-client';
import { EvidenceError, evidenceErrorKind, retryable, type EvidenceErrorKind } from '../lib/evidence-error';
import { evidencePages, evidencePageAt, findEvidence } from '../lib/evidence-pages';
import { AUTO_LOAD_BYTES, componentBytes, formatBytes } from '../lib/answer-view';

type Loaded = { identity: string; text: string; parts: Uint8Array[] };
// Verified content-addressed text reused when the same object is shown again
// (for example the question while switching answers). Withdrawal status is
// re-checked on every reuse; large objects are never kept.
const recent = new Map<string, Loaded>();
function remember(identity: string, value: Loaded) {
  if (value.parts.reduce((n, part) => n + part.length, 0) > 512 * 1024) return;
  recent.delete(identity); recent.set(identity, value);
  if (recent.size > 40) recent.delete(recent.keys().next().value!);
}

const origins: Record<Component['origin'], string> = { captured: 'Captured during the run', frozen_definition: 'From the frozen task definition', derived: 'Derived public record', not_recorded: 'Not recorded' };
const absent: Record<Component['availability'], string> = { full: 'no saved text is available', redacted: 'redacted; no publishable text remains', not_recorded: 'not recorded', withheld: 'withheld from publication', source_link_only: 'available from its original source only' };

export default function EvidenceViewer({ component, objects, label, auto = false, prose = false, empty, present }: {
  component: Component; objects: EvidenceObject[]; label: string; auto?: boolean;
  // Proportional reading type for plain text; exact characters stay one click away.
  prose?: boolean;
  // Context for an empty recorded text. Emptiness alone never establishes failure.
  empty?: ReactNode;
  // Optional readable summary shown before the original text.
  present?: (text: string) => ReactNode;
}) {
  const identity = component.object_ids.join(',');
  const lower = label.toLowerCase();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<{ kind: EvidenceErrorKind; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [exact, setExact] = useState(false), [raw, setRaw] = useState(false);
  const searchId = useId();
  const [page, setPage] = useState(0); const [query, setQuery] = useState('');
  const [match, setMatch] = useState(-1); const [searched, setSearched] = useState(false);
  const text = loaded?.identity === identity ? loaded.text : null;
  const offsets = useMemo(() => evidencePages(text ?? ''), [text]);
  const pageIndex = Math.min(page, offsets.length - 2);
  const start = offsets[pageIndex], end = offsets[pageIndex + 1];
  const visible = text?.slice(start, end) ?? '';
  const highlighted = match >= start && match < end && query.length > 0;
  const size = componentBytes(component, objects);
  const automatic = auto && (size === null || size <= AUTO_LOAD_BYTES);
  const readable = prose && component.object_ids.every(id => objects.find(o => o.id === id)?.media_type === 'text/plain');
  const version = useRef(0);
  function fail(e: unknown) {
    const kind = evidenceErrorKind(e), message = (e as Error).message;
    const messages: Record<EvidenceErrorKind, string> = {
      withdrawn: message,
      status: `${message} The ${lower} is not shown until its withdrawal status is known.`,
      network: `Could not load the ${lower}. ${message}`,
      integrity: `The downloaded ${lower} did not match its recorded size or checksum, so it is not shown. ${message}`,
      invalid: `The recorded location for the ${lower} is invalid, so it was not requested.`,
      missing: `The ${lower} is listed for this record, but its evidence object is not in this edition.`,
    };
    if (kind === 'withdrawn') recent.delete(identity);
    setLoaded(null); setError({ kind, message: messages[kind] });
  }
  async function load() {
    const request = ++version.current;
    setLoading(true); setError(null);
    try {
      const parts = await Promise.all(component.object_ids.map(id => { const o = objects.find(o => o.id === id); if (!o) throw new EvidenceError('missing', 'Evidence object is unavailable.'); return fetchEvidence(o); }));
      if (version.current !== request) return;
      const value = { identity, parts, text: parts.map(b => new TextDecoder().decode(b)).join('\n') };
      remember(identity, value); setLoaded(value); setPage(0); setMatch(-1); setSearched(false);
    } catch (e) { if (version.current === request) fail(e); }
    finally { if (version.current === request) setLoading(false); }
  }
  async function recheck(cached: Loaded) {
    const request = ++version.current;
    setLoading(true); setError(null);
    try {
      for (const id of component.object_ids) await assertObjectAvailable(id);
      if (version.current === request) setLoaded(cached);
    }
    catch (e) { if (version.current === request) fail(e); }
    finally { if (version.current === request) setLoading(false); }
  }
  useEffect(() => {
    const cached = recent.get(identity) ?? null;
    setLoaded(null); setPage(0); setQuery(''); setMatch(-1); setSearched(false); setError(null); setLoading(false); setRaw(false);
    if (component.object_ids.length) { if (cached) void recheck(cached); else if (automatic) void load(); }
    return () => { version.current++; };
  }, [identity, automatic]);
  if (!component.object_ids.length) return <div className="evidence" data-state={component.availability}>
    <p className="evidence-status"><span className="badge">{component.availability.replaceAll('_', ' ')}</span> {label}: {absent[component.availability]}.</p>
    {component.reason && <p className="muted">{component.reason}</p>}
    {component.source?.url && <a href={component.source.url}>Original source for the {lower} →</a>}
  </div>;
  async function download(index: number) {
    try { await assertObjectAvailable(component.object_ids[index]!); } catch (e) { fail(e); return; }
    const bytes = loaded?.parts[index]; if (!bytes) return;
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${component.object_ids[index]}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function search(backwards = false) {
    const next = findEvidence(text ?? '', query, match, backwards);
    setMatch(next); setSearched(true);
    if (next >= 0) setPage(evidencePageAt(offsets, next));
  }
  const summary = text && present ? present(text) : null;
  const parts = loaded?.parts.length ?? 0;
  return <div className="evidence" data-state={error ? error.kind : text !== null ? (text.length ? 'loaded' : 'empty') : loading || automatic ? 'loading' : 'idle'} aria-busy={loading || undefined}>
    {component.availability === 'redacted' && <p className="evidence-note"><span className="badge">Redacted</span> Named privacy rules replaced private details before publication; the marked text is otherwise exact.</p>}
    {component.reason && <p className="evidence-note">{component.reason}</p>}
    {error && <p role="alert" className="warning">{error.message} {retryable(error.kind) && <button type="button" onClick={load}>Retry loading the {lower}</button>}</p>}
    {text === null && !error && (loading || automatic
      ? <p className="evidence-loading muted">Loading the {lower}…</p>
      : <button type="button" onClick={load}>Load the {lower}{size === null ? '' : ` (${formatBytes(size)})`}</button>)}
    {text !== null && <>
      {text.length === 0 ? <p className="evidence-empty">The recorded {lower} is empty (0 characters).{empty && <> {empty}</>}</p> : <>
        {summary}
        {summary && <button type="button" className="text-button" aria-expanded={raw} onClick={() => setRaw(!raw)}>{raw ? 'Hide' : 'Show'} the original {lower}</button>}
        {(!summary || raw) && <>
          {text.length > 2000 && <form className="toolbar" role="search" aria-label={`Search ${lower}`} onSubmit={event => { event.preventDefault(); search(); }}>
            <label htmlFor={searchId}>Find in {lower} (case-sensitive)</label>
            <input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setMatch(-1); setSearched(false); }} />
            <button type="submit" disabled={!query}>Find next</button>
            <button type="button" disabled={!query} onClick={() => search(true)}>Find previous</button>
            <span role="status">{searched && (match < 0 ? 'No match in the complete text.' : 'Match highlighted; search wraps at the end.')}</span>
          </form>}
          {offsets.length > 2 && <div className="toolbar" role="group" aria-label={`${label} parts`}>
            <button type="button" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>Previous part</button>
            <span aria-live="polite">Part {pageIndex + 1} of {offsets.length - 1} of this {lower}</span>
            <button type="button" disabled={pageIndex === offsets.length - 2} onClick={() => setPage(pageIndex + 1)}>Next part</button>
            <small>The download contains the complete original.</small>
          </div>}
          <pre className={readable && !exact ? 'reading-text' : undefined} role="region" tabIndex={0} aria-label={`${label} text`}>{highlighted ? <>{visible.slice(0, match - start)}<mark>{visible.slice(match - start, match - start + query.length)}</mark>{visible.slice(match - start + query.length)}</> : visible}</pre>
        </>}
      </>}
      <div className="evidence-actions">
        {readable && text.length > 0 && (!summary || raw) && <button type="button" className="text-button" aria-pressed={exact} onClick={() => setExact(!exact)}>Monospace</button>}
        {loaded!.parts.map((_, i) => <button type="button" className="text-button" key={component.object_ids[i]} onClick={() => download(i)}>{parts === 1 ? `Download original ${lower}` : `Download original ${lower}, part ${i + 1} of ${parts}`}</button>)}
        <small>{origins[component.origin]}{size === null ? '' : ` · ${formatBytes(size)}`}</small>
      </div>
    </>}
  </div>;
}
