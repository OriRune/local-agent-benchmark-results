import { conditionLabel, displayedMode, visibleCondition } from '../lib/reasoning';
import { useEffect, useState } from 'react';
import type { OverviewData } from '../lib/public-types';
import { modelDefaults, modelSuggestions, modelViewQuery, parseModelView, type ModelView } from '../lib/model-view';
import { comparisonUrl } from '../lib/comparison';
import { categoryPolicy, parameterBand } from '../lib/categories.mjs';
import { formatBytes } from '../lib/presentation';
import ComparisonTray, { useComparisonSelection } from './ComparisonTray';
import ScoreCell, { OutcomeBreakdown } from './ScoreCell';
import ThinkingTradeoff from './ThinkingTradeoff';
import QuestionBank from './QuestionBank';
import ModelSummary from './ModelSummary';
import RelatedVersions from './RelatedVersions';
import QuantSummary from './QuantSummary';
import type { QuantView } from '../lib/quant-view';
import { archiveUrl } from '../lib/edition-client';
import type { SummaryView } from '../lib/summary-view';

type ModelResultsProps = { data: OverviewData; checkpointId: string; releaseId: string; analyses?: SummaryView[]; quantAnalysis?:QuantView|null; archived?: boolean };
export default function ModelResults(props: ModelResultsProps) {
  try { modelDefaults(props.data, props.checkpointId); }
  catch (error) { return <section className="panel"><h2>Results unavailable</h2><p>{(error as Error).message}</p></section>; }
  return <AvailableModelResults {...props}/>;
}
function AvailableModelResults({ data, checkpointId, releaseId, analyses = [], quantAnalysis, archived = false }: ModelResultsProps) {
  const selection = useComparisonSelection(data, releaseId);
  const [view, setView] = useState(modelDefaults(data, checkpointId)); const [error, setError] = useState('');
  useEffect(() => {
    function restore() { try { setView(parseModelView(location.search, data, checkpointId)); setError(''); } catch (e) { setError((e as Error).message); } }
    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, [checkpointId]);
  function choose(next: ModelView) { history.pushState(null, '', archived ? archiveUrl(releaseId, { ...Object.fromEntries(new URLSearchParams(modelViewQuery(next))), checkpoint: checkpointId }) : `?${modelViewQuery(next)}`); setView(next); setError(''); }
  useEffect(() => {
    if (['#recorded-answers','#model-analysis'].includes(location.hash)) {
      const frame=requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
      return ()=>cancelAnimationFrame(frame);
    }
  }, [view]);
  const configs = data.configurations.filter(c => data.artifacts.some(a => a.id === c.artifact_id && a.checkpoint_id === checkpointId));
  const config = configs.find(c => c.id === view.configurationId)!;
  const checkpoint = data.checkpoints.find(c => c.id === checkpointId)!;
  const band = categoryPolicy(data).parameter_bands.find(b => b.id === parameterBand(checkpoint,categoryPolicy(data)));
  const memory = data.memory_fits?.filter(f => f.configuration_id === config.id) ?? [];
  const artifact = data.artifacts.find(a => a.id === config.artifact_id)!;
  const condition = data.conditions.find(c => c.id === view.conditionId)!;
  const conditions = data.conditions.filter(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c));
  const suite = data.suites.find(s => s.id === view.suiteId)!;
  const result = data.aggregates.find(a => a.configuration_id === config.id && a.condition_id === condition.id && a.suite_id === suite.id);
  const paired = data.comparisons.find(p => p.configuration_id === config.id && p.suite_id === suite.id && [p.off_condition_id, p.on_condition_id].includes(condition.id));
  const repeats = data.repetitions.filter(r => r.configuration_id === config.id && r.suite_id === suite.id && r.reasoning_requested === displayedMode(condition));
  const suggestions = modelSuggestions(data, view);
  if (error) return <section className="panel"><h2>Selection unavailable</h2><p role="alert">{error}</p><button onClick={() => choose(modelDefaults(data, checkpointId))}>Show this model’s baseline</button></section>;
  return <>
    <section className="panel" aria-label="Model configuration">
      <h2>Choose a tested configuration</h2><div className="toolbar">
        <label htmlFor="model-configuration">Configuration</label><select id="model-configuration" value={config.id} onChange={e => { const next = parseModelView(`?configuration=${e.target.value}&suite=${suite.id}`, data, checkpointId); const matching = data.conditions.find(c => c.configuration_id === next.configurationId && c.kind === 'baseline' && visibleCondition(c) && displayedMode(c) === displayedMode(condition)); choose({ ...next, conditionId: matching?.id || next.conditionId }); }}>{configs.map(c => <option key={c.id} value={c.id}>{c.name} · {c.runtime || 'runtime unknown'} · {c.status}</option>)}</select>
        <label htmlFor="model-condition">Thinking condition</label><select id="model-condition" value={condition.id} onChange={e => choose({ ...view, conditionId: e.target.value })}>{conditions.map(c => <option key={c.id} value={c.id}>{conditionLabel(c)} · {c.verification.replaceAll('_', ' ')}</option>)}</select>
      </div><p><button disabled={!selection.ready} onClick={() => selection.toggle(view)} aria-pressed={selection.selected.some(s => s.configurationId === config.id && s.conditionId === condition.id)}>{selection.selected.some(s => s.configurationId === config.id && s.conditionId === condition.id) ? 'Remove from comparison' : 'Add to comparison'}</button></p><p>{artifact.quantization} · {formatBytes(artifact.total_bytes)} of weights · {config.runtime || 'Runtime unrecorded'} · context {config.observed.context ?? 'unrecorded'} · GPU layers {config.observed.gpu_layers ?? 'unrecorded'}</p>
      <p>{band?.label ?? 'Parameter size unverified'} · {checkpoint.architecture === 'moe' ? 'MoE' : checkpoint.architecture}{checkpoint.parameters.total_billions !== null && ` · ${checkpoint.parameters.total_billions.toFixed(1)}B total`}{checkpoint.architecture === 'moe' && ` · ${checkpoint.parameters.active_billions?.toFixed(1) ?? 'Unknown'}B active`}</p>
      {!memory.length ? <p className="muted">Memory fit has not been verified for this configuration.</p> : memory.map(f => <details key={f.id}><summary>{f.status === 'verified' ? 'Verified fit' : 'Estimated fit'} · {f.budget_gb} GB {f.memory_type.replaceAll('_',' ')}</summary><p>{f.profile.context_tokens.toLocaleString()} context · {f.profile.runtime} {f.profile.runtime_build} · {f.profile.concurrency} concurrent request(s) · {f.headroom_gb} GB headroom · {f.profile.other_memory_gb} GB other memory required</p><p>{f.method}</p><small>{f.evidence_ref} · {f.observed_at}</small></details>)}
      <p><span className="badge">{config.status}</span> {config.status_reason}</p>{config.compatibility === 'uncertain' && <p className="warning">Execution details are incomplete. This configuration is not eligible for ranking.</p>}
      <details><summary>Recorded settings and thinking verification</summary><p>Temperature {condition.temperature} · seed {condition.seed} · output limit {condition.max_tokens ?? 'unrecorded'} · reasoning effort {condition.reasoning_effort ?? 'unrecorded'}</p><p>Runtime build: {config.runtime_build ?? 'unrecorded'} · hardware profile: {config.hardware_id ?? 'unrecorded'} · concurrency: {config.concurrency ?? 'unrecorded'}</p><p>Thinking status: {condition.verification.replaceAll('_', ' ')} · probe {condition.probe_version ?? 'unrecorded'} · scope {condition.verification_scope ?? 'unrecorded'}.</p><p className="footnote">Requested off does not prove an absence of reasoning. Saved checks do not establish unrecorded historical template or build details.</p></details>
    </section>
    <ModelSummary analysis={analyses.find(a => a.summary.subject.configuration_id === config.id)} configurationId={config.id}/>
    <QuantSummary analysis={quantAnalysis?.summary.checkpoint_id===checkpointId?quantAnalysis:null} artifactId={artifact.id} releaseId={releaseId} archived={archived}/>
    {data.investigations?.some(n => n.configuration_id === config.id) && <section className="panel"><h2>What changed in these results</h2>{data.investigations.filter(n => n.configuration_id === config.id).map(n => <p key={n.id}>{n.text}</p>)}</section>}
    <section className="panel"><h2>Results by test suite</h2><p>Each suite has its own metric and fixed task bank. Scores across suites do not form a combined ranking.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Per-suite results"><table><thead><tr><th>Test suite</th><th>{conditionLabel(condition)}</th><th>Details</th></tr></thead><tbody>{data.suites.map(s => <tr key={s.id}><td><a href={archived ? archiveUrl(releaseId, { suite: s.id }) : `/tests/${s.id}/`}>{s.name}</a><small>{s.metric}</small></td><td><ScoreCell result={data.aggregates.find(a => a.configuration_id === config.id && a.condition_id === condition.id && a.suite_id === s.id)} binary={s.metric_kind === 'binary'}/></td><td><button aria-pressed={suite.id === s.id} onClick={() => choose({ ...view, suiteId: s.id })}>Inspect {s.name}</button></td></tr>)}</tbody></table></div></section>
    <section className="panel" id="recorded-results"><h2>{suite.name}: recorded outcomes</h2><p>{suite.description}</p><OutcomeBreakdown result={result}/><p><a href={archived ? archiveUrl(releaseId, { suite: suite.id }) : `/tests/${suite.id}/`}>Scoring and fixed question bank →</a></p><div id="recorded-answers"><h3>This model’s answers, code and tool activity</h3><p>Select a question to read the original answer, tool calls and available code changes for this configuration and thinking setting.</p><QuestionBank releaseId={releaseId} key={`${suite.id}:${config.id}:${condition.id}`} questions={data.questions.filter(q => q.suite_id === suite.id)} descriptions={data.test_descriptions?.questions} editionId={archived ? releaseId : undefined} configurationId={config.id} conditionId={condition.id}/></div></section>
    <ThinkingTradeoff facts={paired} releaseId={releaseId}/>
    <RelatedVersions data={data} configurationId={config.id} conditionId={condition.id} suiteId={suite.id} releaseId={releaseId} archived={archived}/>
    <section className="panel"><h2>Sampled repetitions</h2><p>Repeated runs are a separate experiment and never add votes to the baseline score.</p>{!repeats.length ? <p className="muted">No repetition experiment is planned for this selection.</p> : repeats.map(r => <div key={r.id}><h3>{conditionLabel(condition)} · temperature {r.temperature}</h3>{!r.allowed ? <p className="warning">The required reasoning control was not verified. Repetition quality is not assessed.</p> : <><p>{r.scored_repetitions}/{r.planned_repetitions} repeats scored · {r.full_credit_repetitions} full-credit repeats.</p><p>{r.complete_questions}/{r.planned_questions} questions have every planned repeat scored. Of those, {r.all_repeats_full_credit} earned full credit on every repeat.</p>{r.complete_questions < r.planned_questions && <p className="warning">Incomplete repetition coverage; unresolved questions are not classified as passing all repeats.</p>}</>}<details><summary>Recorded repetition conditions</summary><ul>{r.condition_ids.map(id => { const c = data.conditions.find(c => c.id === id)!; return <li key={id}>Seed {c.seed} · requested {c.reasoning_requested} · {c.verification.replaceAll('_', ' ')}</li>; })}</ul></details></div>)}</section>
    <section className="panel"><h2>Suggested comparisons</h2><p>These are starting points for inspection, not claims that one setup is better. Runtime and placement differences remain visible.</p>{!suggestions.length ? <p className="muted">No matching suggestion is available for this selection.</p> : <div className="grid">{suggestions.map(s => { const target = data.configurations.find(c => c.id === s.selection.configurationId)!; const targetCondition = data.conditions.find(c => c.id === s.selection.conditionId)!; return <article className="card" key={s.kind}><h3>{s.kind === 'thinking' ? 'Thinking on versus off' : target.name}</h3><p>{s.reason}</p><small>Requested thinking {targetCondition.reasoning_requested}{s.exploratory ? ' · Exploratory: incomplete or uncertain evidence' : ' · Complete compared coverage'}</small><p><a href={comparisonUrl({ releaseId, suiteId: suite.id, selections: [view, s.selection] })}>Compare these configurations →</a></p><details><summary>Selection rule and evidence IDs</summary><small>Policy {s.policy} · Template {s.template}<br/>Facts: {s.factIds.join(', ')}<br/>Matching candidate set: {s.cohortIds.join(', ')}</small></details></article>; })}</div>}</section>
    <ComparisonTray data={data} releaseId={releaseId} suiteId={suite.id} {...selection}/>
  </>;
}
