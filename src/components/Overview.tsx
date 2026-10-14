import { conditionLabel, displayedMode, visibleCondition } from '../lib/reasoning';
import { useEffect, useState } from 'react';
import Takeaways from './Takeaways';
import type { OverviewData } from '../lib/public-types';
import { parseOverviewView, overviewViewQuery, type OverviewView } from '../lib/overview-view';
import ComparisonTray, { useComparisonSelection } from './ComparisonTray';
import { BANDS, formatBytes, sizeBand, topWithTies } from '../lib/presentation';

import { categoryPolicy, parameterBand, memoryFits } from '../lib/categories.mjs';

const GROUPS = [{ id: 'coding', name: 'Coding & tools' }, { id: 'reasoning', name: 'Reasoning' }, { id: 'instructions', name: 'Instructions' }, { id: 'reading', name: 'Reading & evidence' }, { id: 'corrections', name: 'Corrections' }];
export default function Overview({ data, releaseId }: { data: OverviewData; releaseId: string }) {
  const defaultSuite = data.suites.find(s => s.family_id === 'basic')!.id;
  const [view, setView] = useState<OverviewView>({ suiteId: defaultSuite, mode: 'off', search: '', showAll: false });
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
  const setMode = (mode: 'off' | 'on') => choose({ mode });
  const setSearch = (search: string) => choose({ search }, true);
  const setShowAll = (showAll: boolean) => choose({ showAll });
  const selection = useComparisonSelection(data, releaseId);
  const { selected, toggle } = selection;
  const suite = data.suites.find(s => s.id === suiteId)!;
  const rows = data.checkpoints.flatMap(checkpoint => {
    if (view.architecture && checkpoint.architecture !== view.architecture) return [];
    const artifacts = data.artifacts.filter(a => a.checkpoint_id === checkpoint.id);
    // A budget selects the first fitting setup by ID, never by score.
    const config = [...data.configurations].sort((a,b) => a.id.localeCompare(b.id)).find(c => view.budget ? artifacts.some(a => a.id === c.artifact_id) && fits(c.id).length > 0 : c.artifact_id === checkpoint.baseline_artifact_id);
    const artifact = artifacts.find(a => a.id === config?.artifact_id)!;
    const condition = data.conditions.find(c => c.configuration_id === config?.id && c.kind === 'baseline' && visibleCondition(c) && displayedMode(c) === mode);
    const result = data.aggregates.find(a => a.configuration_id === config?.id && a.condition_id === condition?.id && a.suite_id === suiteId);
    if (!config || !condition || !result) return [];
    if (![checkpoint.name, artifact.quantization, artifact.publisher || ''].join(' ').toLowerCase().includes(search.toLowerCase())) return [];
    return [{ id: config.id, checkpoint, artifact, config, condition, result, eligible: result.eligible, score: result.score }];
  });
  const rowGroup = (row: typeof rows[number]) => grouping === 'download' ? sizeBand(row.artifact.total_bytes) : grouping === 'parameters' ? (parameterBand(row.checkpoint,policy) ? `${row.checkpoint.architecture}-${parameterBand(row.checkpoint,policy)}` : 'unknown') : fits(row.config.id)[0] ? `memory-${fits(row.config.id)[0].budget_gb}` : 'unknown';
  const groups = grouping === 'download' ? BANDS : grouping === 'parameters' ? [...['dense','moe','unknown'].flatMap(architecture => policy.parameter_bands.map(b => ({id:`${architecture}-${b.id}`,name:`${architecture === 'moe' ? 'MoE' : architecture === 'dense' ? 'Dense' : 'Architecture unknown'} · ${b.label}`,description:'Total parameters; active MoE parameters shown separately when known.'}))),{id:'unknown',name:'Parameter size unverified',description:'These models remain available while their metadata is resolved.'}] : [...policy.memory_budgets_gb.map(b => ({id:`memory-${b}`,name:`${b} GB · smallest supported tier`,description:'Under the displayed runtime profile. Smaller untested budgets may also work.'})),{id:'unknown',name:'Memory fit unverified',description:'Download size alone does not establish memory requirements.'}];
  const renderRows = (items: typeof rows) => <div className="table-scroll" role="region" aria-label={`${suite.name} results`} tabIndex={0}><table className="overview-results"><thead><tr><th>Tested model</th><th>{suite.metric}</th><th>Task time</th><th>Download</th><th>Compare</th></tr></thead><tbody>{items.map(row => <tr key={row.id}>
    <td><a href={`/models/${row.checkpoint.slug}/?configuration=${row.config.id}&condition=${row.condition.id}&suite=${suiteId}`}><strong>{row.checkpoint.name}</strong></a><small>{row.artifact.quantization} · {row.artifact.publisher || 'Publisher unresolved'} · {conditionLabel(row.condition)}</small>
      <small>{row.checkpoint.architecture === 'moe' ? 'MoE' : row.checkpoint.architecture} · {row.checkpoint.parameters.total_billions?.toFixed(1) ?? 'Unknown'}B total{row.checkpoint.architecture === 'moe' && ` · ${row.checkpoint.parameters.active_billions?.toFixed(1) ?? 'Unknown'}B active`}</small>
      {fits(row.config.id)[0] && <small>{fits(row.config.id)[0].status === 'verified' ? 'Verified fit' : 'Estimated fit'}: {fits(row.config.id)[0].budget_gb} GB {memoryType.replaceAll('_',' ')} · {fits(row.config.id)[0].profile.context_tokens.toLocaleString()} context · {fits(row.config.id)[0].profile.runtime}</small>}
      <small>Thinking control: {row.condition.verification.replaceAll('_', ' ')}</small>
      <details><summary>Setup and weight sources</summary>
        <p>{row.config.runtime || 'Runtime unrecorded'} · context {row.config.observed.context ?? 'unrecorded'} · GPU layers {row.config.observed.gpu_layers ?? 'unrecorded'}</p>
        <p>Temperature {row.condition.temperature} · seed {row.condition.seed} · output limit {row.condition.max_tokens ?? 'unrecorded'}</p>
        <p>Control check scope: {row.condition.verification_scope ?? 'unrecorded'}. Requested off does not prove an absence of reasoning.</p>
        <p>Weight identity: {row.artifact.provenance_status.replaceAll('_', ' ')}</p>
        {row.artifact.files.map(file => <p key={file.name}>{file.name}{file.url ? <> · <a href={file.url}>Exact GGUF file →</a></> : <small>Exact download source unresolved.</small>}{file.hash_type === 'header_1m_sha256' && <small>Historical first-MiB hash only; not a full-file identity.</small>}</p>)}
      </details>
    </td>
    <td><span className="score number">{row.score === null ? '—' : suite.metric_kind === 'binary' ? `${row.result.full_credit}/${row.result.scored}` : `${(row.score * 100).toFixed(1)}%`}</span><small className={!row.eligible ? 'warning' : ''}>{row.result.scored}/{row.result.planned} scored{!row.eligible ? ' · Preview' : ''}</small>{row.score !== null && <div className="bar" aria-hidden="true"><span style={{ width: `${row.score * 100}%` }}/></div>}</td>
    <td className="number">{row.result.median_task_s === null ? '—' : `${row.result.median_task_s.toFixed(1)}s`}<small>median · {row.result.timed} measured</small></td>
    <td className="number">{formatBytes(row.artifact.total_bytes)}<small>weights, not required RAM</small></td>
    <td><button disabled={!selection.ready} aria-label={`Compare ${row.checkpoint.name}`} aria-pressed={selected.some(s => s.configurationId === row.config.id && s.conditionId === row.condition.id)} onClick={() => toggle({ configurationId: row.config.id, conditionId: row.condition.id })}>{selected.some(s => s.configurationId === row.config.id && s.conditionId === row.condition.id) ? 'Added ✓' : '+ Add'}</button></td>
  </tr>)}</tbody></table></div>;
  if (filterError) return <section className="panel"><p role="alert">{filterError}</p><button onClick={() => choose({ suiteId: defaultSuite, mode: 'off', search: '', showAll: false })}>Reset overview filters</button></section>;
  return <>
    <section className="panel" aria-label="Choose a task"><div className="eyebrow">What do you need a model to do?</div><div className="tabs">{GROUPS.map(group => <button key={group.id} aria-pressed={suite.group === group.id} onClick={() => setSuite(data.suites.find(s => s.group === group.id)!.id)}>{group.name}</button>)}</div>
    <div className="tabs">{data.suites.filter(s => s.group === suite.group).map(s => <button key={s.id} aria-pressed={suite.id === s.id} onClick={() => setSuite(s.id)}>{s.name}</button>)}</div><p>{suite.description}</p><small>{suite.primary_question_ids.length} fixed questions · <a href={`/tests/${suite.id}/`}>Questions and scoring →</a></small>
    <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '20px 0' }}/><div className="toolbar"><label htmlFor="model-search">Find a model</label><input id="model-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Model or quantization"/><label htmlFor="reasoning-mode">Thinking</label><select id="reasoning-mode" value={mode} onChange={e => setMode(e.target.value as 'off' | 'on')}><option value="off">Requested off</option><option value="on">Reasoning enabled / requested on</option></select><button aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show highlights' : 'Show all results'}</button></div>
    <div className="toolbar" style={{marginTop:16}}><label>Group by <select aria-label="Group models by" value={grouping} onChange={e => choose({grouping:e.target.value as OverviewView['grouping']})}><option value="parameters">Parameters and architecture</option><option value="memory">Memory requirement</option><option value="download">Weight download size</option></select></label><label>Architecture <select aria-label="Architecture" value={view.architecture ?? ''} onChange={e => choose({architecture:(e.target.value || undefined) as OverviewView['architecture']})}><option value="">All architectures</option><option value="dense">Dense</option><option value="moe">Mixture of experts (MoE)</option><option value="unknown">Unverified</option></select></label><label>Memory <select aria-label="Memory type" value={memoryType} onChange={e => choose({memoryType:e.target.value as OverviewView['memoryType']})}><option value="system_ram">System RAM (CPU)</option><option value="gpu_vram">GPU VRAM</option><option value="unified_memory">Unified memory</option></select></label><label>Budget <select aria-label="Budget" value={view.budget ?? ''} onChange={e => choose({budget:e.target.value ? Number(e.target.value) : undefined})}><option value="">Any / unknown</option>{policy.memory_budgets_gb.map(b => <option key={b} value={b}>Up to {b} GB</option>)}</select></label><label><input type="checkbox" checked={view.estimates ?? false} onChange={e => choose({estimates:e.target.checked || undefined})}/> Include estimated fits</label></div>
    {!data.memory_fits?.length && <p className="footnote">Memory requirements have not yet been verified for these setups. A budget filter shows only supported fits; browse by parameters or download size in the meantime.</p>}
    </section>
    <Takeaways data={data} suiteId={suiteId} mode={mode} releaseId={releaseId}/>
    <p className="footnote">{showAll ? 'All baseline configurations' : 'Up to three highest observed complete results in each size group; exact ties included'}. {grouping === 'download' ? 'Groups describe weight download size.' : grouping === 'parameters' ? 'Groups use total parameters and separate dense/MoE architectures.' : 'Memory tiers describe the exact tested setup; estimated fits are labeled.'} Task time includes tools and grading on this benchmark machine. Small score differences may represent one question.</p>
    <p className="sr-only" aria-live="polite">{rows.length} matching models</p>
    {groups.map(band => { const candidates = rows.filter(r => rowGroup(r) === band.id); const visible = showAll ? candidates : topWithTies(candidates); return visible.length ? <section key={band.id}><div className="section-title"><div><h2>{band.name}</h2><p className="muted">{band.description} · {visible.length} shown</p></div></div>{renderRows(visible)}</section> : null; })}
    {!rows.length && <p className="empty">No supported setups match these filters. Try removing the memory budget or changing the architecture.</p>}
    {!showAll && rows.some(r => !r.eligible) && <section className="panel"><h2>Unfinished or unassessed results</h2><p className="muted">{rows.filter(r => !r.eligible).length} configurations have incomplete coverage or uncertain comparison eligibility. A missing result is not a zero.</p><details><summary>Inspect all preview results</summary>{renderRows(rows.filter(r => !r.eligible))}</details></section>}
    <ComparisonTray data={data} releaseId={releaseId} suiteId={suiteId} {...selection}/>
  </>;
}
