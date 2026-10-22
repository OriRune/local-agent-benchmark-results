import { suiteLabel } from '../lib/suite-label';
import { setupCandidates } from '../lib/setup-selection';
import { hardwareLabel, resultStatus } from '../lib/result-status';
import { conditionLabel } from '../lib/reasoning';
import { useEffect, useState } from 'react';
import Takeaways from './Takeaways';
import OutcomeMetrics from './OutcomeMetrics';
import CompletionNote from './CompletionNote';
import QualityTimeChart from './QualityTimeChart';
import type { OverviewData } from '../lib/public-types';
import { parseOverviewView, overviewViewQuery, type OverviewView } from '../lib/overview-view';
import ComparisonTray, { useComparisonSelection } from './ComparisonTray';
import { BANDS, formatBytes, sizeBand, topWithTies } from '../lib/presentation';

import { timingGroups } from '../lib/chart-data';
import { categoryPolicy, parameterBand, memoryFits } from '../lib/categories.mjs';

const GROUPS = [{ id: 'coding', name: 'Coding & tools' }, { id: 'reasoning', name: 'Reasoning' }, { id: 'instructions', name: 'Instructions' }, { id: 'reading', name: 'Reading & evidence' }, { id: 'corrections', name: 'Corrections' }];
export default function Overview({ data, releaseId }: { data: OverviewData; releaseId: string }) {
  const defaultSuite = data.suites.find(s => s.family_id === 'basic')!.id;
  const [view, setView] = useState<OverviewView>({ suiteId: defaultSuite, mode: 'all', search: '', showAll: true });
  const [filterError, setFilterError] = useState('');
  const { suiteId, mode, search, showAll } = view;
  const policy = categoryPolicy(data);
  const grouping = view.grouping ?? (data.memory_fits?.some(f => f.status === 'verified') ? 'memory' : data.checkpoints.some(c => parameterBand(c,policy)) ? 'parameters' : 'download');
  const memoryType = view.memoryType ?? 'system_ram';
  const fits = (id: string) => memoryFits(data,id,{budget:view.budget,type:memoryType,estimates:view.estimates});
  useEffect(() => {
    function restore() { try { setView(parseOverviewView(location.search, data.suites.map(s => s.id), defaultSuite)); setFilterError(''); } catch (e) { setFilterError((e as Error).message); } }
    restore(); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, [releaseId]);
  function choose(update: Partial<OverviewView>, replace = false) { const next = { ...view, ...update }; history[replace ? 'replaceState' : 'pushState'](null, '', `?${overviewViewQuery(next)}`); setView(next); setFilterError(''); }
  const setSuite = (suiteId: string) => choose({ suiteId });
  const setMode = (mode: OverviewView['mode']) => choose({ mode });
  const setSearch = (search: string) => choose({ search }, true);
  const setShowAll = (showAll: boolean) => choose({ showAll });
  const selection = useComparisonSelection(data, releaseId);
  const { selected, toggle } = selection;
  const suite = data.suites.find(s => s.id === suiteId)!;
  const rows = data.checkpoints.flatMap(checkpoint => {
    if (view.architecture && checkpoint.architecture !== view.architecture) return [];
    const candidates = setupCandidates(data, checkpoint.id, suiteId, mode);
    const selectedSetup = candidates.find(r => r.config.status !== 'withdrawn' && (!view.budget || fits(r.config.id).length > 0));
    if (!selectedSetup) return [];
    const { config, artifact, condition, result } = selectedSetup;
    if (![checkpoint.name, artifact.quantization, artifact.publisher || ''].join(' ').toLowerCase().includes(search.toLowerCase())) return [];
    return [{ id: config.id, checkpoint, artifact, config, condition, result, eligible: result.eligible && config.status !== 'withdrawn', score: result.score }];
  });
  const chartRows=rows.map(r=>({id:r.id,name:r.checkpoint.name,config:r.config,condition:r.condition,result:r.result,href:`/models/${r.checkpoint.slug}/?configuration=${r.config.id}&condition=${r.condition.id}&suite=${suiteId}`}));
  const hasTiming=timingGroups(chartRows).length>0;
  const rowGroup = (row: typeof rows[number]) => grouping === 'download' ? sizeBand(row.artifact.total_bytes) : grouping === 'parameters' ? (parameterBand(row.checkpoint,policy) ? `${row.checkpoint.architecture}-${parameterBand(row.checkpoint,policy)}` : 'unknown') : fits(row.config.id)[0] ? `memory-${fits(row.config.id)[0].budget_gb}` : 'unknown';
  const groups = grouping === 'download' ? BANDS : grouping === 'parameters' ? [...['dense','moe','unknown'].flatMap(architecture => policy.parameter_bands.map(b => ({id:`${architecture}-${b.id}`,name:`${architecture === 'moe' ? 'MoE' : architecture === 'dense' ? 'Dense' : 'Architecture unknown'} · ${b.label}`,description:'Total parameters; active MoE parameters shown separately when known.'}))),{id:'unknown',name:'Parameter size unverified',description:'Parameter metadata is not yet sourced for these entries.'}] : [...policy.memory_budgets_gb.map(b => ({id:`memory-${b}`,name:`${b} GB · smallest supported tier`,description:'Under the displayed runtime profile. Smaller untested budgets may also work.'})),{id:'unknown',name:'Memory fit unverified',description:'Download size alone does not establish memory requirements.'}];
  const renderRows = (items: typeof rows) => <div className="table-scroll" role="region" aria-label={`${suite.name} results`} tabIndex={0}><table className="overview-results"><thead><tr><th>Tested model</th><th>{suite.metric}</th><th>Task time</th><th>Download</th><th>Compare</th></tr></thead><tbody>{items.map(row => <tr key={row.id}>
    <td><a href={`/models/${row.checkpoint.slug}/?configuration=${row.config.id}&condition=${row.condition.id}&suite=${suiteId}`}><strong>{row.checkpoint.name}</strong></a><small>{row.artifact.quantization} · {conditionLabel(row.condition)}</small><small>{hardwareLabel(row.config)}</small><small><a href={`/models/${row.checkpoint.slug}/?configuration=${row.config.id}&condition=${row.condition.id}&suite=${suiteId}#weight-formats`}>All quants &amp; setups →</a></small>
      <small>{row.checkpoint.architecture === 'moe' ? 'MoE' : row.checkpoint.architecture} · {row.checkpoint.parameters.total_billions == null ? 'Parameters unverified' : `${row.checkpoint.parameters.total_billions.toFixed(1)}B total`}{row.checkpoint.architecture === 'moe' && (row.checkpoint.parameters.active_billions == null ? ' · Active parameter count not recorded' : ` · ${row.checkpoint.parameters.active_billions.toFixed(1)}B active`)}</small>
      {fits(row.config.id)[0] && <small>{fits(row.config.id)[0].status === 'verified' ? 'Verified fit' : 'Estimated fit'}: {fits(row.config.id)[0].budget_gb} GB {memoryType.replaceAll('_',' ')} · {fits(row.config.id)[0].profile.context_tokens.toLocaleString()} context · {fits(row.config.id)[0].profile.runtime}</small>}

      <details><summary>Setup and weight sources</summary>
        <p>{row.config.runtime || 'Runtime unrecorded'} · context {row.config.observed.context ?? 'unrecorded'} · GPU layers {row.config.observed.gpu_layers ?? 'unrecorded'}</p>
        <p>Temperature {row.condition.temperature ?? 'provider default (not set)'} · {row.config.execution_kind === 'cloud' ? 'sample index' : 'seed'} {row.condition.seed} · output limit {row.condition.max_tokens ?? 'unrecorded'}</p>
        <p>Thinking control: {row.condition.verification.replaceAll('_', ' ')}</p><p>Control check scope: {row.condition.verification_scope ?? 'unrecorded'}. Requested off does not prove an absence of reasoning.</p>
        <p>Weight identity: {row.artifact.provenance_status.replaceAll('_', ' ')}</p>
        {row.artifact.files.map(file => <p key={file.name}>{file.name}{file.url ? <> · <a href={file.url}>Exact GGUF file →</a></> : <small>Exact download source unresolved.</small>}{file.hash_type === 'header_1m_sha256' && <small>Historical first-MiB hash only; not a full-file identity.</small>}</p>)}
      </details>
    </td>
    <td><OutcomeMetrics result={row.result} binary={suite.metric_kind === 'binary'}/><small className={!row.eligible ? 'warning' : ''}>{row.result.scored}/{row.result.planned} scored</small>{!row.eligible && <small className="warning">{resultStatus(row.config, row.result)}</small>}</td>
    <td className="number">{row.config.execution_kind === 'cloud' ? <>Excluded<small>Cloud · quality only</small></> : <>{row.result.median_task_s === null ? '—' : `${row.result.median_task_s.toFixed(1)}s`}<small>median · {row.result.timed} measured</small></>}</td>
    <td className="number">{row.config.execution_kind === 'cloud' ? <>Hosted<small>{row.config.cloud_provider}</small></> : <>{formatBytes(row.artifact.total_bytes)}<small>weights, not required RAM</small></>}</td>
    <td><button disabled={!selection.ready} aria-label={`Compare ${row.checkpoint.name}`} aria-pressed={selected.some(s => s.configurationId === row.config.id && s.conditionId === row.condition.id)} onClick={() => toggle({ configurationId: row.config.id, conditionId: row.condition.id })}>{selected.some(s => s.configurationId === row.config.id && s.conditionId === row.condition.id) ? 'Added ✓' : '+ Add'}</button></td>
  </tr>)}</tbody></table></div>;
  if (filterError) return <section className="panel"><p role="alert">{filterError}</p><button onClick={() => choose({ suiteId: defaultSuite, mode: 'all', search: '', showAll: true })}>Reset overview filters</button></section>;
  return <>
    <section className="task-selector" aria-label="Choose a task"><div className="tabs">{GROUPS.map(group => <button key={group.id} aria-pressed={suite.group === group.id} onClick={() => setSuite(data.suites.find(s => s.group === group.id)!.id)}>{group.name}</button>)}</div>
    <div className="tabs">{data.suites.filter(s => s.group === suite.group).map(s => <button key={s.id} aria-pressed={suite.id === s.id} onClick={() => setSuite(s.id)}>{suiteLabel(data,s)}</button>)}</div><p className="suite-caption">{suite.description} <small>{suite.primary_question_ids.length} fixed questions · <a href={`/tests/${suite.id}/`}>Questions and scoring →</a></small></p>
    <div className="toolbar primary-filters"><label htmlFor="model-search">Find a model</label><input id="model-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Model or quantization"/><label htmlFor="reasoning-mode">Thinking</label><select id="reasoning-mode" value={mode} onChange={e => setMode(e.target.value as OverviewView['mode'])}><option value="all">All tested modes</option><option value="off">Requested off</option><option value="on">Reasoning enabled / requested on</option></select><button aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show highlights' : 'Show all results'}</button>{hasTiming && <a className="speed-jump" href="#speed-quality">Speed &amp; quality ↘</a>}</div>
    <details className="advanced-filters"><summary>Size, architecture &amp; more filters{view.architecture || view.budget ? ' · Active' : ''}</summary><div className="toolbar" style={{marginTop:16}}><label>Group by <select aria-label="Group models by" value={grouping} onChange={e => choose({grouping:e.target.value as OverviewView['grouping']})}><option value="parameters">Parameters and architecture</option>{Boolean(data.memory_fits?.length || view.grouping === 'memory') && <option value="memory">Memory requirement</option>}<option value="download">Weight download size</option></select></label><label>Architecture <select aria-label="Architecture" value={view.architecture ?? ''} onChange={e => choose({architecture:(e.target.value || undefined) as OverviewView['architecture']})}><option value="">All architectures</option><option value="dense">Dense</option><option value="moe">Mixture of experts (MoE)</option><option value="unknown">Unverified</option></select></label>{Boolean(data.memory_fits?.length || view.budget || view.grouping === 'memory') && <><label>Memory <select aria-label="Memory type" value={memoryType} onChange={e => choose({memoryType:e.target.value as OverviewView['memoryType']})}><option value="system_ram">System RAM (CPU)</option><option value="gpu_vram">GPU VRAM</option><option value="unified_memory">Unified memory</option></select></label><label>Budget <select aria-label="Budget" value={view.budget ?? ''} onChange={e => choose({budget:e.target.value ? Number(e.target.value) : undefined})}><option value="">Any / unknown</option>{policy.memory_budgets_gb.map(b => <option key={b} value={b}>Up to {b} GB</option>)}</select></label><label><input type="checkbox" checked={view.estimates ?? false} onChange={e => choose({estimates:e.target.checked || undefined})}/> Include estimated fits</label></>}</div>
    {!data.memory_fits?.length && <p className="footnote">Memory requirements have not yet been verified for these setups. A budget filter shows only supported fits; browse by parameters or download size in the meantime.</p>}{data.configurations.some(c => c.execution_kind === 'cloud') && <p className="footnote">Cloud-labeled entries use the same tasks and grading, with hosted model precision and reasoning settings shown in their setup. They participate in quality results only: all speed and desktop-memory comparisons exclude cloud runs. A hosted model is not a test of its local quantization.</p>}</details>
    </section>
    <div className="result-context"><strong>{suite.name}</strong><span>{suite.metric} · {suite.primary_question_ids.length} questions</span><span>{showAll ? 'All matching models' : 'Top 3 per group, including ties'} · {mode === 'all' ? 'All tested modes · actual settings shown per row' : mode === 'on' ? 'Reasoning enabled / requested on' : 'Requested off'}</span></div>
    <p className="sr-only" aria-live="polite">{rows.length} matching models</p>
    {groups.map(band => { const candidates = rows.filter(r => rowGroup(r) === band.id); const visible = showAll ? [...candidates].sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.score??-1)-(a.score??-1)||a.id.localeCompare(b.id)) : topWithTies(candidates); return visible.length ? <section key={band.id}><div className="section-title"><div><h2>{band.name}</h2><p className="muted">{band.description} · {visible.length} shown</p></div></div>{renderRows(visible)}</section> : null; })}
    {!rows.length && <p className="empty">No supported setups match these filters. Try removing the memory budget or changing the architecture.</p>}
    {!showAll && rows.some(r => !r.eligible) && <section className="panel"><h2>Results with qualifications</h2><p className="muted">{rows.filter(r => !r.eligible).length} selected setups are outside the ranked results. Each row explains whether results are missing, held, withdrawn, or require a comparison qualification. Missing results are not zeros.</p><details><summary>Inspect qualified and unavailable results</summary>{renderRows(rows.filter(r => !r.eligible))}</details></section>}
    <p className="footnote">One setup per model: eligible results first, then greatest scored coverage, then the declared baseline; score and speed never select the setup. Other quants and hardware runs remain on the model page. Ordered by recorded score within each group; ties use a stable setup order, not speed. Coverage is shown beside every score. This table ranks the selected task; the heatmap also shows a balanced overall index. Weight download size is not required RAM.</p>
    <CompletionNote/>
    <QualityTimeChart metric={suite.metric} binary={suite.metric_kind === 'binary'} rows={chartRows}/>
    {mode !== 'all' && <details className="recorded-observations"><summary>More observations · separate download-size comparison groups</summary><Takeaways data={data} suiteId={suiteId} mode={mode} releaseId={releaseId}/></details>}
    <ComparisonTray data={data} releaseId={releaseId} suiteId={suiteId} {...selection}/>
  </>;
}
