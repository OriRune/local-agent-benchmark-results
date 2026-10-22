import GeneratedPagePreview from './GeneratedPagePreview';
import { READING_PAGE_QUESTION } from '../lib/page-preview';
import { useState } from 'react';
import type { Component, Object as EvidenceObject } from '../lib/public-contract';
import type { QuestionData } from '../lib/public-types';
import type { AnswerIndex } from './QuestionAnswers';
import { conditionLabel } from '../lib/reasoning';
import ReadingPageAssessment from './ReadingPageAssessment';
import { outcomeReasons } from '../lib/task-outcomes';
import { availabilitySummary, checkEntries, outcomeView, referenceEntries } from '../lib/answer-view';
import { runHardware } from '../lib/hardware';
import { archiveUrl } from '../lib/edition-client';
import EvidenceViewer from './EvidenceViewer';
import AttemptHistory from './AttemptHistory';

// A closed disclosure states what exists before it is opened, then loads
// reasonably sized content on opening. Very large content keeps a sized button.
export function EvidenceDisclosure({ title, label, component, objects }: { title: string; label: string; component: Component; objects: EvidenceObject[] }) {
  const [opened, setOpened] = useState(false);
  return <details className="evidence-disclosure" onToggle={event => { if (event.currentTarget.open) setOpened(true); }}>
    <summary><span>{title}</span> <small>· {availabilitySummary(component, objects)}</small></summary>
    {(opened || !component.object_ids.length) && <EvidenceViewer component={component} objects={objects} label={label} auto/>}
  </details>;
}

export function QuestionText({ data }: { data: QuestionData }) {
  const q = data.question;
  return <section className="reading-question" aria-labelledby="question-heading">
    <h3 id="question-heading">Original question</h3>
    <EvidenceViewer component={q.components.prompt} objects={data.objects} label="Question" auto prose/>
    {(q.components.context.object_ids.length > 0 || q.components.context.availability !== 'not_recorded') && <EvidenceDisclosure title="Supplied context" label="Supplied context" component={q.components.context} objects={data.objects}/>}
    {q.branches.map(b => <EvidenceDisclosure key={b.id} title={`${b.name}: question`} label={`${b.name} question`} component={b.prompt} objects={data.objects}/>)}
  </section>;
}

function CopyLink({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const url = new URL(path, location.origin).href;
  return <span className="copy-link">
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setState('copied'); } catch { setState('manual'); } }}>Copy exact link</button>
    <span aria-live="polite">{state === 'copied' ? ' Link copied' : ''}</span>
    {state === 'manual' && <label>Copy this exact link <input readOnly value={url} onFocus={event => event.currentTarget.select()}/></label>}
  </span>;
}

const more = [
  ['reasoning', 'Captured reasoning', 'Captured reasoning'],
  ['tools', 'Tool calls and results', 'Tool calls and results'],
  ['artifacts', 'Code and saved file changes', 'Code and saved files'],
  ['input', 'Captured input and tool schemas', 'Captured input'],
] as const;

export default function SelectedAttempt({ data, index, attemptId, editionId, releaseId, href, open }: { data: QuestionData; index: AnswerIndex; attemptId: string; editionId?: string; releaseId?: string; href: (id: string) => string; open: (id: string) => void }) {
  const q = data.question, attempt = data.attempts.find(a => a.id === attemptId)!;
  const trial = data.trials.find(t => t.id === attempt.trial_id)!;
  const config = index.configurations.find(c => c.id === trial.configuration_id)!, condition = index.conditions.find(c => c.id === trial.condition_id)!;
  const artifact = index.artifacts.find(a => a.id === config.artifact_id), checkpoint = index.checkpoints.find(c => c.id === artifact?.checkpoint_id);
  const outcome = outcomeView(attempt), machine = runHardware(config), assessment = attempt.assessment;
  const model = checkpoint?.name ?? config.name;
  const timing = machine.kind === 'cloud' ? `${machine.summary} · quality reference; excluded from local speed comparison`
    : `${attempt.wall_s === null ? 'Task time not recorded' : `${attempt.wall_s.toFixed(1)} s whole-task time`} · ${machine.summary}`;
  const resultsHref = checkpoint && (editionId ? archiveUrl(editionId, { checkpoint: checkpoint.id, configuration: config.id, condition: condition.id, suite: q.suite_id })
    : `/models/${checkpoint.slug}/?${new URLSearchParams({ configuration: config.id, condition: condition.id, suite: q.suite_id })}`);
  const empty = assessment?.reason === 'saved_agent_checks' ? 'Credit came from the saved task checks on files or code, not from a final message; see Code and saved file changes below.'
    : 'An empty final message does not by itself determine the grade; see the recorded grade below.';
  const settings: [string, string][] = [
    ...machine.rows,
    ['Configuration', config.name],
    ['Weights', [artifact?.quantization, artifact?.publisher, artifact?.repository].filter(Boolean).join(' · ') || 'Not recorded'],
    ['Runtime', [config.runtime, config.runtime_build].filter(Boolean).join(' · ') || 'Not recorded'],
    ['Thinking', `${conditionLabel(condition)} · requested ${condition.reasoning_requested} · check: ${condition.verification.replaceAll('_', ' ')}`],
    ['Context and placement', `${config.observed.context ?? 'unknown'} context · ${config.observed.gpu_layers ?? 'unknown'} GPU layers · ${config.observed.threads ?? 'unknown'} threads`],
    ['Sampling', `temperature ${condition.temperature ?? 'not recorded'} · ${trial.kind} seed ${trial.seed}`],
    ['Limits', `${condition.max_tokens ?? 'unrecorded'} completion tokens · ${condition.thinking_tokens ?? 'unrecorded'} thinking-token cap · ${condition.agent_steps ?? 'unrecorded'} agent steps`],
    ['Time definition', machine.kind === 'cloud' ? 'Hosted timings are not published as speed measurements.' : 'Whole-task wall time, including tools, setup and grading. It is not answer-generation latency or tokens per second.'],
  ];
  if (machine.kind !== 'cloud' && attempt.usage.generated_tokens !== null) settings.push(['Generated tokens', `${attempt.usage.generated_tokens}${attempt.usage.generation_s !== null ? ` in ${attempt.usage.generation_s.toFixed(1)} s of generation` : ''}`]);
  return <div className="selected-attempt" data-attempt-id={attempt.id}>
    <header className="answer-identity" aria-labelledby="selected-answer-heading">
      <p className="eyebrow">Recorded answer</p>
      <h2 id="selected-answer-heading" tabIndex={-1}>{model}</h2>
      <p className="answer-setup">{[artifact?.quantization, conditionLabel(condition), `${trial.kind} seed ${trial.seed}`].filter(Boolean).join(' · ')}</p>
      {!attempt.canonical && <p><span className="badge">Historical · not counted in current score</span></p>}
      <p className="answer-outcome"><span className="badge outcome-badge" data-outcome={outcome.key}>{outcome.label}</span> <strong>{outcome.credit}</strong></p>
      {assessment?.category === 'failed_to_finish' && <p className="completion-context">This run stopped within the test’s limits without an accepted result. More budget or a retry might help; recovery was not measured. <a href="/methodology/#completion-and-retries">What this means for everyday use →</a></p>}
      <p className="answer-timing">{timing}</p>
      <details className="run-details"><summary>Test machine and run settings</summary>
        <dl className="spec-list">{settings.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <a href="/methodology/#test-machine">How hardware and timing are recorded →</a>
      </details>
      <div className="answer-actions">{resultsHref && <a href={resultsHref}>← {model} results for this setup</a>}<CopyLink path={href(attempt.id)}/></div>
    </header>
    {q.id === READING_PAGE_QUESTION && <ReadingPageAssessment key={attempt.id} attempt={attempt} objects={data.objects}/>}
    {q.id === READING_PAGE_QUESTION && (editionId || releaseId) && <GeneratedPagePreview key={attempt.id} attemptId={attempt.id} questionId={q.id} releaseId={(editionId || releaseId)!} evidenceIds={[...attempt.components.tools.object_ids, ...attempt.components.checks.object_ids]}/>}
    <div className="reading-grid">
      <QuestionText data={data}/>
      <section className="reading-answer" aria-labelledby="final-answer-heading">
        <h3 id="final-answer-heading">Original final answer</h3>
        <EvidenceViewer component={attempt.components.answer} objects={data.objects} label="Final answer" auto prose empty={empty}/>
        {attempt.branches.map(b => <EvidenceDisclosure key={b.id} title={`${b.name}: final answer`} label={`${b.name} answer`} component={b.answer} objects={data.objects}/>)}
        <section className="grade-block outcome-explanation" aria-labelledby="grade-heading">
          <h4 id="grade-heading">{attempt.scoring_review ? 'Reviewed grade and accepted answer' : 'Recorded grade and accepted answer'}</h4>
          {attempt.scoring_review && <div className="scoring-correction"><p><strong>Scoring corrected · same original answer.</strong> {attempt.scoring_review.reason}</p><p>Original grade: {(attempt.scoring_review.original_score * 100).toFixed(0)}%. Reviewed grade: {(attempt.score! * 100).toFixed(0)}%. Policy: {attempt.scoring_review.policy_version}. <a href={href(attempt.scoring_review.source_attempt_id)} onClick={event => { event.preventDefault(); open(attempt.scoring_review!.source_attempt_id); }}>View original grade and checks →</a></p></div>}
          {q.scoring_status === 'excluded' && <p><strong>This question is excluded from current scores and rankings.</strong> Its saved answer and original grade remain available for inspection.</p>}
          <p>{assessment ? outcomeReasons[assessment.reason] ?? 'This outcome follows the saved task record.' : outcome.unscored ? 'This attempt has no assessed score.' : 'The saved task checks determined this score.'}</p>
          <h5>Accepted reference answer</h5>
          {attempt.scoring_review ? <ul className="reference-values" aria-label="Accepted reference values">{attempt.scoring_review.reviewed_reference.map(value => <li key={value}>{value}</li>)}</ul> : <EvidenceViewer component={q.components.reference} objects={data.objects} label="Accepted reference" auto present={text => { const values = referenceEntries(text); return values && <ul className="reference-values" aria-label="Accepted reference values">{values.map(value => <li key={value}>{value}</li>)}</ul>; }}/>}
          {q.branches.map(b => <EvidenceDisclosure key={b.id} title={`${b.name}: reference`} label={`${b.name} reference`} component={b.reference} objects={data.objects}/>)}
          <h5>Saved check result</h5>
          <EvidenceViewer component={attempt.components.checks} objects={data.objects} label="Saved check record" auto present={text => { const entries = checkEntries(text); return entries && <dl className="check-values">{entries.map(([k, v]) => <div key={k}><dt>{k.replaceAll('_', ' ')}</dt><dd>{v}</dd></div>)}</dl>; }}/>
          <p className="footnote">{attempt.scoring_review ? 'This versioned review reassessed the saved answer. Original checks remain linked above; no model was rerun.' : 'Shown exactly as saved. This page does not re-grade answers and shows no grader explanation beyond these saved values.'}</p>
          {assessment && <details><summary>How this outcome was assessed</summary><p>Outcome policy: {assessment.policy_version}. Original recorded status: {assessment.recorded_status.replaceAll('_', ' ')}; original score: {assessment.recorded_score === null ? 'unscored' : `${(assessment.recorded_score * 100).toFixed(1)}%`}. Original evidence and previous editions are retained. {attempt.scoring_review ? 'A separate scoring amendment reassessed this saved answer without rerunning the model.' : 'This assessment did not rerun the model or grader.'}</p>{assessment.saved_agent_verdict && <p>Saved task check: {assessment.saved_agent_verdict}. Files and code can earn credit even when no final message was produced.</p>}</details>}
          {q.components.checks.object_ids.length > 0 && <EvidenceDisclosure title="Task check definition" label="Task check definition" component={q.components.checks} objects={data.objects}/>}
        </section>
      </section>
    </div>
    <section className="more-evidence" aria-labelledby="more-evidence-heading">
      <h3 id="more-evidence-heading">More evidence from this run</h3>
      <p className="muted">Availability is listed beside each item. Missing evidence is not itself a model failure; the recorded grade above is the assessment.</p>
      {more.map(([key, title, label]) => <EvidenceDisclosure key={key} title={title} label={label} component={attempt.components[key]} objects={data.objects}/>)}
      <AttemptHistory ids={attempt.supersedes_attempt_ids} data={data} href={href} open={open}/>
      <details className="record-details"><summary>Record details and identifiers</summary><dl className="spec-list">
        {([['Attempt', attempt.id], ['Trial', trial.id], ['Configuration', config.id], ['Condition', condition.id], ['Question', `${q.id} · source ${q.source_id}`], ['Grader revision', attempt.grader_revision], ['Recorded status', attempt.status.replaceAll('_', ' ')], ['Started', attempt.started_at ?? 'Not recorded'], ['Finished', attempt.finished_at ?? 'Not recorded'], ['Edition', editionId ?? 'Current results'], ['Corrections', attempt.correction_ids.join(', ') || 'None']] as const).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl></details>
    </section>
  </div>;
}
