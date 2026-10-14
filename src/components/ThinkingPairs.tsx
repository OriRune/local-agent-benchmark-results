import { useState } from 'react';
import type { Comparison, Trial, Attempt } from '../lib/public-contract';
import type { OverviewData } from '../lib/public-types';
import { archiveUrl, editionObject, loadEdition } from '../lib/edition-client';

type ModelDetail = { checkpoint_id: string; comparisons: Comparison[]; trials: Trial[]; attempts: Pick<Attempt, 'id' | 'trial_id' | 'canonical'>[] };
type Filter = 'all' | 'improved' | 'unchanged' | 'worse';
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const seconds = (value: number | null) => value !== null && value > 0 ? `${value.toFixed(1)}s` : 'Not measured';
export default function ThinkingPairs({ facts, releaseId }: { facts: OverviewData['comparisons'][number]; releaseId: string }) {
  const [loaded, setLoaded] = useState<{ model: ModelDetail; index: OverviewData; comparison: Comparison }>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all'), [page, setPage] = useState(1);
  async function load() {
    if (busy || loaded) return;
    setBusy(true); setError('');
    try {
      const edition = await loadEdition(releaseId);
      const configuration = edition.index.configurations.find(c => c.id === facts.configuration_id);
      const artifact = edition.index.artifacts.find(a => a.id === configuration?.artifact_id);
      const objectId = artifact && edition.release.model_objects[artifact.checkpoint_id];
      if (!objectId) throw new Error('The matched records are unavailable in this edition.');
      const model = await editionObject<ModelDetail>(edition, objectId);
      const comparison = model.comparisons.find(c => c.id === facts.id);
      if (!comparison || !comparison.verified || model.checkpoint_id !== artifact.checkpoint_id) throw new Error('The matched records do not belong to this selection.');
      setLoaded({ model, index: edition.index, comparison });
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const pairs = loaded?.comparison.pairs.filter(pair => filter === 'all' || (filter === 'improved' ? pair.on_score > pair.off_score : filter === 'worse' ? pair.on_score < pair.off_score : pair.on_score === pair.off_score)) ?? [];
  const pages = Math.max(1, Math.ceil(pairs.length / 20));
  function answer(trial: Trial | undefined, label: string) {
    const attempt = loaded?.model.attempts.find(a => a.trial_id === trial?.id && a.canonical);
    if (!trial || !attempt) return <span>{label}: unavailable</span>;
    return <a href={archiveUrl(releaseId, { question: trial.question_id, configuration: trial.configuration_id, condition: trial.condition_id, attempt: attempt.id })}>{label} answer</a>;
  }
  return <details onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary>Inspect individual matched questions</summary>
    <noscript>Enable JavaScript to load the matched records and their exact answer links.</noscript>
    {busy && <p role="status">Loading matched records…</p>}
    {error && <div><p role="alert">{error}</p><button onClick={() => void load()}>Retry matched records</button></div>}
    {loaded && <>
      <p>Only questions scored in both verified modes appear here. Missing or unassessed counterparts remain outside this list. Timing changes require positive durations on both sides.</p>
      <label>Paired outcome <select value={filter} onChange={event => { setFilter(event.target.value as Filter); setPage(1); }}>
        <option value="all">All matched questions</option><option value="improved">Improved with thinking</option><option value="unchanged">Unchanged credit</option><option value="worse">Worse with thinking</option>
      </select></label>
      <p role="status">{pairs.length} matching pairs · {loaded.comparison.score_pairs} scored pairs in this version</p>
      {!pairs.length ? <p>No matched questions have this outcome.</p> : <div className="table-scroll" role="region" aria-label="Individual thinking pairs" tabIndex={0}><table><thead><tr><th>Question and trial</th><th>Credit off → on</th><th>Task time off → on</th><th>Added time</th><th>Recorded answers</th></tr></thead><tbody>{pairs.slice((page - 1) * 20, page * 20).map(pair => {
        const off = loaded.model.trials.find(t => t.id === pair.off_trial_id), on = loaded.model.trials.find(t => t.id === pair.on_trial_id);
        const question = loaded.index.questions.find(q => q.id === off?.question_id);
        const timed = pair.off_s !== null && pair.off_s > 0 && pair.on_s !== null && pair.on_s > 0;
        const delta = timed ? pair.on_s! - pair.off_s! : null;
        return <tr key={pair.pair_key}><td>{question?.source_id ?? 'Question unavailable'}<small>{off?.kind} · seed {off?.seed}</small></td><td>{percent(pair.off_score)} → {percent(pair.on_score)}<small>{pair.on_score > pair.off_score ? 'Improved' : pair.on_score < pair.off_score ? 'Worse' : 'Unchanged'} · {pair.on_score > pair.off_score ? '+' : ''}{((pair.on_score - pair.off_score) * 100).toFixed(1)} pp</small></td><td>{seconds(pair.off_s)} → {seconds(pair.on_s)}</td><td>{delta === null ? 'Not measured' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}s`}</td><td>{answer(off, 'Off')}<br/>{answer(on, 'On')}</td></tr>;
      })}</tbody></table></div>}
      {pages > 1 && <nav className="toolbar" aria-label="Matched question pages"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous pairs</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(page + 1)}>Next pairs</button></nav>}
    </>}
  </details>;
}
