import { useMemo, useRef, useState } from 'react';
import type { OverviewData } from '../lib/public-types';
import { heatmapRows, sortQualityRows, heatmapColor, type HeatmapRow } from '../lib/heatmap';
import { qualityColumns, columnResult, qualityIndex, indexLabel } from '../lib/quality-index';
import { conditionLabel } from '../lib/reasoning';
import { hardwareLabel, resultStatus } from '../lib/result-status';
import { suiteLabel } from '../lib/suite-label';

const SHORT: Record<string,string> = { basic:'Everyday coding',real_linux2:'Larger projects',reasoning_gym:'Logic & puzzles',livebench:'Hard problems',ifeval:'Instructions',squad2:'Reading accurately',drop:'Passage math',qasper:'Research papers',pushback:'Resisting corrections' };
export default function Heatmap({data}: {data:OverviewData}) {
  const [mode,setMode] = useState('all'), [search,setSearch] = useState(''), [architecture,setArchitecture] = useState(''), [size,setSize] = useState(''), [execution,setExecution] = useState('');
  const [allSetups,setAllSetups] = useState(false), [sort,setSort] = useState('overall'), [ascending,setAscending] = useState(false);
  const [selected,setSelected] = useState<{row:HeatmapRow;columnId:string}|null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const candidates = useMemo(()=>heatmapRows(data,mode,allSetups),[data,mode,allSetups]);
  const columns=qualityColumns(data);
  const rows = sortQualityRows(data,candidates.filter(r=>{
    const n=r.checkpoint.parameters.total_billions;
    return (!architecture || r.checkpoint.architecture===architecture) && (!execution || (r.config.execution_kind==='cloud'?'cloud':'local')===execution)
      && (!size || (n!=null && (size==='small'?n<5:size==='medium'?n>=5&&n<20:n>=20)))
      && `${r.checkpoint.name} ${r.artifact.quantization}`.toLowerCase().includes(search.toLowerCase());
  }),sort,ascending);
  const column=selected&&columns.find(c=>c.id===selected.columnId);
  const result=selected&&column?columnResult(selected.row.results,column):undefined;
  const selectedSuite=column&&data.suites.find(s=>s.id===(result?.suite_id??column.id));
  const index=selected?qualityIndex(data,selected.row.results):null;
  const href=(r:HeatmapRow,suiteId?:string)=>`/models/${r.checkpoint.slug}/?configuration=${encodeURIComponent(r.config.id)}&condition=${encodeURIComponent(r.condition.id)}${suiteId?`&suite=${encodeURIComponent(suiteId)}`:''}`;
  const chooseSort=(id:string)=>{setSort(id);setAscending(sort===id?!ascending:false);};
  const inspect=(row:HeatmapRow,columnId:string)=>{setSelected({row,columnId});dialog.current?.showModal();};
  const sortLabel=sort==='overall'?'Balanced index':SHORT[columns.find(c=>c.id===sort)!.suite.family_id];
  return <>
    <div className="heatmap-filters">
      <label>Find a model<input type="search" placeholder="Model or quantization" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <label>Thinking<select aria-label="Thinking" value={mode} onChange={e=>setMode(e.target.value)}><option value="all">All tested modes</option><option value="off">Requested off</option><option value="on">Reasoning enabled / requested on</option></select></label>
    </div>
    <details className="heatmap-more-filters"><summary>Size, architecture &amp; run location{size||architecture||execution?' · Active':''}</summary><div className="heatmap-filters">
      <label>Model size<select aria-label="Model size" value={size} onChange={e=>setSize(e.target.value)}><option value="">All sizes</option><option value="small">Small · under 5B</option><option value="medium">Medium · 5–20B</option><option value="large">Large · 20B and above</option></select></label>
      <label>Architecture<select aria-label="Architecture" value={architecture} onChange={e=>setArchitecture(e.target.value)}><option value="">Dense &amp; MoE</option><option value="dense">Dense</option><option value="moe">Mixture of experts</option></select></label>
      <label>Run location<select aria-label="Run location" value={execution} onChange={e=>setExecution(e.target.value)}><option value="">Local &amp; cloud</option><option value="local">Local only</option><option value="cloud">Cloud only</option></select></label>
    </div></details>
    <div className="heatmap-tools"><label><input type="checkbox" checked={allSetups} onChange={e=>setAllSetups(e.target.checked)}/> Show every quant, setup &amp; mode</label><span aria-live="polite">{rows.length} {allSetups?'setups':'models'} · sorted by {sortLabel} {ascending?'↑':'↓'}</span></div>
    <div className="heatmap-legend"><strong>Score</strong><span>0%</span><span className="heatmap-gradient" aria-hidden="true"/><span>100%</span><span className="heatmap-key">* Qualified / partial</span><span>— No scored result</span></div>
    <p className="heatmap-hint" id="heatmap-help">Click headings to sort. Overall: nine equally weighted categories. Ranges show possible scores for incomplete results, which stay unranked. Scroll across for all categories.</p>
    <div className="heatmap-scroll" role="region" aria-label="Model performance heatmap" aria-describedby="heatmap-help" tabIndex={0}>
      <table className="heatmap-table"><caption className="sr-only">Model scores by category, with an equally weighted overall index. Qualified and incomplete results are unranked. Each row retains its actual reasoning mode and setup.</caption><thead><tr>
        <th scope="col" className="heatmap-model">Tested model <small>One setup across the row</small></th>
        <th scope="col" className="heatmap-overall" aria-sort={sort==='overall'?(ascending?'ascending':'descending'):'none'}><button aria-label="Sort by Balanced index" onClick={()=>chooseSort('overall')}>Overall{sort==='overall'?(ascending?' ↑':' ↓'):''}<small>Balanced index</small><small>0–100 · 9 categories</small></button></th>
        {columns.map(c=><th key={c.id} scope="col" aria-sort={sort===c.id?(ascending?'ascending':'descending'):'none'}><button onClick={()=>chooseSort(c.id)} title={c.suite.name} aria-label={`Sort by ${c.suite.name}`}><span>{SHORT[c.suite.family_id]??c.suite.name}{sort===c.id?(ascending?' ↑':' ↓'):''}</span><small>{c.suite.metric_kind==='binary'?'Pass rate':'Avg. credit'}</small></button></th>)}
      </tr></thead><tbody>{rows.map(row=>{const overall=qualityIndex(data,row.results);return <tr key={`${row.config.id}-${row.condition.id}`}>
        <th scope="row" className="heatmap-model"><a href={href(row)}>{row.checkpoint.name}</a><small>{row.artifact.quantization} · {row.checkpoint.parameters.total_billions==null?'Size unknown':`${row.checkpoint.parameters.total_billions.toFixed(1)}B`}{row.checkpoint.architecture==='moe'?' · MoE':''}</small><small>{conditionLabel(row.condition)}</small><small>{hardwareLabel(row.config)}</small></th>
        <td className="heatmap-overall"><button className={`heatmap-cell ${overall.complete?'':'heatmap-qualified'}`} style={overall.complete?heatmapColor(overall.score!):undefined} onClick={()=>inspect(row,'overall')} aria-label={`${row.checkpoint.name}, Balanced index: ${indexLabel(overall)}${overall.complete?'':', unranked; incomplete or qualified'}`}><span>{indexLabel(overall)}</span><small>{overall.complete?'9/9 categories':`${overall.eligible}/${overall.total} eligible`}</small></button></td>
        {columns.map(c=>{const r=columnResult(row.results,c),score=r?.score;const available=score!=null,qualified=available&&!r?.eligible;return <td key={c.id}><button className={`heatmap-cell ${available?'':'heatmap-missing'} ${qualified?'heatmap-qualified':''}`} style={available&&!qualified?heatmapColor(score):undefined} onClick={()=>inspect(row,c.id)} aria-label={`${row.checkpoint.name}, ${c.suite.name}: ${available?`${(score*100).toFixed(1)}%${qualified?', qualified result':''}`:'no scored result'}${r?`, ${r.scored} of ${r.planned} scored`:''}`}><span>{available?`${Math.round(score*100)}${qualified?'*':''}`:'—'}</span></button></td>})}
      </tr>})}</tbody></table>
      {!rows.length&&<p className="empty">No models match these filters. Try another thinking setting or clear the filters.</p>}
    </div>
    <details className="heatmap-method"><summary>How to read this view</summary><p>The balanced index averages the nine category scores, giving each category 1/9 of the weight regardless of its question count. It measures quality on these test banks, not speed or general model ability. It is not Elo. Only setups with complete, eligible coverage in all nine categories receive a ranked index.</p><p>For incomplete results, the range runs from zero to full credit on every unscored task, keeping recorded scores fixed. It is a possible-score range, not a statistical confidence interval. Fully scored but qualified setups show an asterisk and remain unranked. Cells show rounded percentages; select one for exact scores and answers.</p><p>By default, all tested thinking modes are included. Each model uses the setup with the most eligible categories, then greatest scored coverage, then its declared baseline. Neither score nor speed chooses it. The same quant, configuration and thinking condition are used throughout a row. Enable all setups to inspect every quant and reasoning effort. Withdrawn setups are omitted.</p><p>Size means total parameters, not required RAM. Cloud results describe hosted versions and providers. The two instruction campaigns use identical questions and scorers and share one quality column; evidence IDs remain separate, as do hardware-specific speed comparisons. New, unverified test revisions will not be silently merged. Policy: {index?.version??'balanced-categories-v1'}.</p></details>
    <dialog ref={dialog} className="heatmap-dialog" aria-labelledby="heatmap-detail-title"><button className="heatmap-close" aria-label="Close score details" onClick={()=>dialog.current?.close()}>Close ×</button>{selected&&<>
      <p className="eyebrow">{selected.row.checkpoint.name}</p>
      {selected.columnId==='overall'&&index?<><h2 id="heatmap-detail-title">Balanced index</h2><p className="heatmap-detail-score">{indexLabel(index)}<small>out of 100 · {index.complete?'Complete coverage':'Unranked: incomplete or qualified'}</small></p><p>Each of the nine categories contributes equally. {index.scored} of {index.planned} planned tasks scored; {index.eligible} of {index.total} categories eligible.</p>{!index.complete&&<p>The range allows zero to full credit on unscored tasks. It is not a confidence interval. Setup qualifications remain in force even when all tasks are scored.</p>}<ul className="index-breakdown">{index.categories.map(({column:c,result:r})=><li key={c.id}><a href={href(selected.row,r?.suite_id??c.id)}>{c.suite.name}</a><strong>{r?.score==null?'—':`${(r.score*100).toFixed(1)}%`}</strong><small>{r?`${r.scored}/${r.planned} scored · ${resultStatus(selected.row.config,r)}`:'No scored result'}</small></li>)}</ul><p className="footnote">Policy {index.version}. New models do not change an existing setup’s index.</p></>:selectedSuite&&<><h2 id="heatmap-detail-title">{selectedSuite.name}</h2><p>{selectedSuite.description}</p><p className="heatmap-detail-score">{result?.score!=null?`${(result.score*100).toFixed(1)}%`:'No scored result'}<small>{selectedSuite.metric}</small></p><p>{result?`${result.scored} of ${result.planned} planned tasks scored${selectedSuite.metric_kind==='binary'?` · ${result.full_credit} fully correct`:''}`:'No results scheduled for this category and setup.'}</p><p className={!result?.eligible?'warning':''}>{resultStatus(selected.row.config,result)}</p>{column&&column.suiteIds.length>1&&<small>Evidence version: {suiteLabel(data,selectedSuite)}</small>}</>}
      <p className="muted">{selected.row.artifact.quantization} · {conditionLabel(selected.row.condition)}<br/>{hardwareLabel(selected.row.config)}</p><div className="heatmap-detail-links"><a href={href(selected.row,result?.suite_id??selectedSuite?.id)}>View this model’s answers →</a>{selectedSuite&&<a href={`/tests/${selectedSuite.id}/`}>About this test →</a>}</div>
    </>}</dialog>
  </>;
}
