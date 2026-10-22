import { useEffect, useId, useRef, useState } from 'react';
import { bankPage, bankQuery, defaultBankView, parseBankView, type BankQuestion, type BankView, type BankSearch, BANK_OUTCOMES } from '../lib/question-bank';
import { archiveUrl, editionObject, loadEdition } from '../lib/edition-client';
import { outcomeText } from './QuestionMatrix';
import type { TestDescription } from '../lib/public-types';

export default function QuestionBank({ questions, descriptions = {}, editionId, releaseId = editionId, configurationId, conditionId }: {
  questions: BankQuestion[]; editionId?: string; releaseId?: string; configurationId?: string; conditionId?: string;
  descriptions?: Record<string,TestDescription>;
}) {
  const bankRef=useRef<HTMLDivElement>(null);
  const [view, setView] = useState(defaultBankView), [error, setError] = useState(''), [ready, setReady] = useState(false);
  const [search, setSearch] = useState<BankSearch>();
  const [loading, setLoading] = useState(false), [searchError, setSearchError] = useState(''), [checked, setChecked] = useState(false);
  async function loadSearch() {
    if (!releaseId || loading || checked) return;
    setLoading(true); setSearchError('');
    try {
      const edition = await loadEdition(releaseId);
      const suite = questions[0]?.suite_id, objectId = suite && edition.index.search_objects?.[suite];
      if (objectId) {
        const value = await editionObject<BankSearch>(edition, objectId);
        if (value.version !== 1 || value.suite_id !== suite || value.questions.length !== questions.length || !questions.every(q => value.questions.some(row => row.question_id === q.id))) throw new Error('Search index does not match this question bank.');
        setSearch(value);
      }
      setChecked(true);
    } catch (error) { setSearchError((error as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (view.search || view.outcome) void loadSearch(); }, [view.search, view.outcome, releaseId]);
  useEffect(()=>{if(!configurationId||!conditionId||!bankRef.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){void loadSearch();observer.disconnect();}},{rootMargin:'200px'});observer.observe(bankRef.current);return()=>observer.disconnect();},[releaseId,configurationId,conditionId]);
  const id = useId(), scope = questions.map(question => question.id).join(',');
  useEffect(() => {
    function restore() { try { setView(parseBankView(location.search)); setError(''); } catch (error) { setError((error as Error).message); } setReady(true); }
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [scope]);
  const result = bankPage(questions, view, search, configurationId, conditionId, descriptions);
  function choose(next: BankView) {
    history.pushState(null, '', `${location.pathname}?${bankQuery(location.search, next)}${location.hash}`);
    setView(next); setError('');
  }
  function href(question: BankQuestion) {
    const values: Record<string, string> = {};
    if (configurationId) values.configuration = configurationId;
    if (conditionId) values.condition = conditionId;
    return editionId ? archiveUrl(editionId, { ...values, question: question.id })
      : `/questions/${question.id}/${Object.keys(values).length ? '?' + new URLSearchParams(values) : ''}`;
  }
  if (error) return <div><p role="alert">{error}</p><button onClick={() => choose(defaultBankView())}>Reset question filters</button></div>;
  return <div className="question-bank" ref={bankRef}>
    <div className="toolbar" role="search" aria-label="Question bank" onFocusCapture={() => void loadSearch()}>
      <label htmlFor={`${id}-search`}>Find a question</label>
      <input id={`${id}-search`} type="search" disabled={!ready} value={view.search} onChange={event => {
        const next = { ...view, search: event.target.value, page: 1 };
        history.replaceState(null, '', `${location.pathname}?${bankQuery(location.search, next)}${location.hash}`); setView(next);
      }} />
      <label htmlFor={`${id}-status`}>Question status</label>
      <select id={`${id}-status`} disabled={!ready} value={view.status} onChange={event => choose({ ...view, status: event.target.value as BankView['status'], page: 1 })}>
        <option value="all">All questions</option><option value="primary">Primary bank</option><option value="excluded">Excluded</option><option value="review">Review only</option>
      </select>
      <label htmlFor={`${id}-outcome`}>Recorded outcome</label><select id={`${id}-outcome`} disabled={!search} value={view.outcome || ''} onChange={event => choose({ ...view, outcome: event.target.value || undefined, page: 1 })}><option value="">Any recorded outcome</option>{BANK_OUTCOMES.map(value => <option key={value} value={value}>{({ full: 'Full credit', partial: 'Partial credit', zero: 'Zero credit' } as Record<string, string>)[value] || value.replaceAll('_', ' ')}</option>)}</select>
      {(view.search || view.status !== 'all' || view.outcome) && <button type="button" onClick={() => choose(defaultBankView())}>Clear question filters</button>}
    </div>
    {!search && !checked && <button disabled={!ready || loading} onClick={() => void loadSearch()}>Load prompt and outcome search</button>}
    {loading && <p>Loading prompt and outcome search…</p>}
    {searchError && <p role="alert">Extended search unavailable: {searchError} <button onClick={() => void loadSearch()}>Retry question search</button></p>}
    {checked && !search && <p>This older edition supports ID and title search only.</p>}
    {view.outcome && !search && <p role="alert">Outcome results are unavailable until this edition’s search index loads.</p>}
    <p role="status">{result.count ? `${result.start + 1}–${result.start + result.rows.length} of ${result.count} matching questions` : 'No matching questions.'} · {result.total} in this version</p>
    <ul className="question-list">{result.rows.map(question => <li key={question.id}><a href={href(question)}>{descriptions[question.id]?.title ?? question.title}</a>{configurationId && conditionId && search && <span className="question-outcome">{outcomeText(search.questions.find(q=>q.question_id===question.id)?.outcomes.find(o=>o.configuration_id===configurationId&&o.condition_id===conditionId))}</span>}{descriptions[question.id] && <p>{descriptions[question.id]!.description}</p>}<small>{question.source_id} · {question.scoring_status}</small></li>)}</ul>
    {result.pages > 1 && <nav className="toolbar" aria-label="Question pages">
      <button disabled={!ready || result.page === 1} onClick={() => choose({ ...view, page: result.page - 1 })}>Previous questions</button>
      <span>Page {result.page} of {result.pages}</span>
      <button disabled={!ready || result.page === result.pages} onClick={() => choose({ ...view, page: result.page + 1 })}>Next questions</button>
    </nav>}
    <small>Filters change this list, not the fixed scoring denominator. {search ? 'Search covers IDs, titles, task explanations and permitted prompt text. Outcome filters match any canonical attempt in the selected configuration/condition, or any configuration when none is selected. Repeats remain separate attempts; historical grades are excluded.' : 'Search currently covers question IDs, titles and available task explanations. Focus a control to load prompt/outcome search where this edition provides it.'}</small>
  </div>;
}
