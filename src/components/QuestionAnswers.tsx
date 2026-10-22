import { useEffect, useMemo, useRef, useState } from 'react';
import type { OverviewData, QuestionData } from '../lib/public-types';
import { conditionLabel } from '../lib/reasoning';
import { hardwareLabel } from '../lib/result-status';
import { archiveUrl } from '../lib/edition-client';
import { outcomeView, resolveSelection } from '../lib/answer-view';
import AnswerList, { type AnswerRow } from './AnswerList';
import SelectedAttempt, { EvidenceDisclosure, QuestionText } from './SelectedAttempt';

export type AnswerIndex = Pick<OverviewData, 'checkpoints' | 'artifacts' | 'configurations' | 'conditions' | 'suites' | 'test_descriptions'>;

function answerRows(data: QuestionData, index: AnswerIndex): AnswerRow[] {
  return data.attempts.filter(a => a.canonical).map(attempt => {
    const trial = data.trials.find(t => t.id === attempt.trial_id);
    const config = index.configurations.find(c => c.id === trial?.configuration_id), condition = index.conditions.find(c => c.id === trial?.condition_id);
    const artifact = index.artifacts.find(a => a.id === config?.artifact_id), checkpoint = index.checkpoints.find(c => c.id === artifact?.checkpoint_id);
    const name = checkpoint?.name ?? config?.name ?? 'Unknown setup';
    const setup = [artifact?.quantization, condition && conditionLabel(condition), config && hardwareLabel(config), trial && `${trial.kind} seed ${trial.seed}`].filter(Boolean).join(' · ');
    return { attempt, name, setup, outcome: outcomeView(attempt), search: `${name} ${setup} ${config?.name ?? ''} ${attempt.id}`.toLowerCase() };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.setup.localeCompare(b.setup));
}

// One owner per selected attempt: SelectedAttempt is keyed by the attempt and
// is the only keyed child here. (The previous layout gave the answer viewer and
// the history list the same key, so React dropped the old answer's fiber
// without removing its DOM and stale answers accumulated on screen.)
export default function QuestionAnswers({ data, index, editionId }: { data: QuestionData; index: AnswerIndex; editionId?: string }) {
  const q = data.question, suite = index.suites.find(s => s.id === q.suite_id);
  const explanation = index.test_descriptions?.questions[q.id];
  // Static HTML cannot read the query string, so nothing is selected until the
  // browser resolves the exact link. No default model stands in for it.
  const [selection, setSelection] = useState<{ id: string | null; error: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const focusAnswer = useRef(false), shown = useRef<string | null | undefined>(undefined);
  const rows = useMemo(() => answerRows(data, index), [data, index]);
  useEffect(() => {
    function restore() { setSelection(resolveSelection(data, location.search)); }
    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, [data]);
  function href(id: string) {
    const attempt = data.attempts.find(a => a.id === id)!, trial = data.trials.find(t => t.id === attempt.trial_id)!;
    const values = { attempt: id, configuration: trial.configuration_id, condition: trial.condition_id };
    return editionId ? archiveUrl(editionId, { question: q.id, ...values }) : `/questions/${q.id}/?${new URLSearchParams(values)}`;
  }
  function open(id: string) {
    const url = new URL(href(id), location.href), current = new URLSearchParams(location.search);
    for (const key of ['answer_q', 'answer_status', 'answer_page']) { const value = current.get(key); if (value) url.searchParams.set(key, value); }
    history.pushState(null, '', `${url.pathname}${url.search}`);
    focusAnswer.current = true;
    setSelection({ id, error: '' });
  }
  const attempt = selection?.id ? data.attempts.find(a => a.id === selection.id) : undefined;
  useEffect(() => {
    if (!selection) return;
    const previous = shown.current; shown.current = selection.id;
    if (previous === undefined || previous === selection.id) return;
    const row = rows.find(r => r.attempt.id === selection.id);
    setAnnouncement(selection.error ? selection.error : attempt ? `Showing ${row?.name ?? 'historical attempt'}: ${outcomeView(attempt).label}` : '');
    if (focusAnswer.current) document.getElementById('selected-answer-heading')?.focus();
    focusAnswer.current = false;
  }, [selection]);
  const Title = editionId ? 'h2' : 'h1';
  const suiteHref = suite && (editionId ? archiveUrl(editionId, { suite: suite.id }) : `/tests/${suite.id}/`);
  const questionOnly = <div className="reading-grid single">
    <QuestionText data={data}/>
    <section className="reading-answer" aria-label="Accepted answers">
      <EvidenceDisclosure title="Reveal reference answers" label="Accepted reference" component={q.components.reference} objects={data.objects}/>
      {q.components.checks.object_ids.length > 0 && <EvidenceDisclosure title="Task check definition" label="Task check definition" component={q.components.checks} objects={data.objects}/>}
    </section>
  </div>;
  return <div className="answer-page">
    {suiteHref && <p className="answer-crumbs"><a href={suiteHref}>← {suite!.name}</a></p>}
    <header className="task-header">
      <Title className="task-title">{explanation?.title ?? q.title}</Title>
      {explanation && <p className="task-description">{explanation.description}</p>}
      <p className="task-meta">{q.title}{q.scoring_status === 'excluded' ? ' · excluded from published scores' : q.scoring_status === 'review' ? ' · task under review' : ''}</p>
      {explanation && <details className="task-explanation-source"><summary>About this description</summary><small>Generated by {explanation.generator.display_name_at_generation} ({explanation.generator.model_id_requested}) · {explanation.generated_at.slice(0, 10)}. Shared across models for this version of the test. The original question and checks remain the source of truth.</small></details>}
    </header>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    {!selection ? <p className="answer-pending" role="status">Opening the requested recorded answer… This page needs JavaScript to select and verify evidence. If this message remains, no other model’s answer is shown in its place.</p>
      : selection.error ? <><p className="warning" role="alert">{selection.error}</p>{questionOnly}</>
      : !attempt ? <><p className="empty">No canonical answer has been recorded for this question yet.</p>{questionOnly}</>
      : <SelectedAttempt key={attempt.id} data={data} index={index} attemptId={attempt.id} editionId={editionId} href={href} open={open}/>}
    {rows.length > 0 && <AnswerList rows={rows} selectedId={attempt?.id ?? null} href={href} open={open}/>}
    <p className="footnote question-source">Source item {q.source_id}. {q.source.attribution} {q.source.url && <a href={q.source.url}>Source</a>}</p>
  </div>;
}
