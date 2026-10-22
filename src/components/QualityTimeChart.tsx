import { hardwareLabel } from '../lib/result-status';
import { TestMachineNote } from './TestMachine';
import { useId, useState } from 'react';
import { timingGroups, creditLabel, type ChartRow } from '../lib/chart-data';

export default function QualityTimeChart({ rows, metric, binary }: { rows: ChartRow[]; metric: string; binary: boolean }) {
  const groups=timingGroups(rows), [chosen,setChosen]=useState(''), [selectedId,setSelectedId]=useState(''), id=useId();
  if (!groups.length) return <p className="footnote">A speed–quality plot needs at least two complete, fully timed local setups with matching hardware and test controls. No such group is available in this selection.</p>;
  const [key,points]=groups.find(([key])=>key===chosen) ?? groups[0]!;
  const selected=points.find(p=>p.id===selectedId) ?? points[0]!;
  const times=points.map(p=>p.result.median_task_s!), min=Math.min(...times), max=Math.max(...times);
  const log=max/min>8, low=log ? Math.log10(min)-(Math.log10(max)-Math.log10(min))*.08 : 0, high=log ? Math.log10(max)+(Math.log10(max)-Math.log10(min))*.08 : max*1.08;
  const x=(time:number)=>62+((log?Math.log10(time):time)-low)/(high-low || 1)*650;
  const y=(score:number)=>255-score*215;
  return <section id="speed-quality" className="chart-section" aria-labelledby={`${id}-title`}>
    <div className="section-title"><h2 id={`${id}-title`}>How much quality for your time?</h2><span className="badge">Local measurements only</span></div>
    <p className="chart-description">Higher is more credit; further left is less time. Select a point to identify the model, then open its results. These are whole-task times, including tools and grading.</p>
    <label className="chart-cohort">Timing group <select value={key} onChange={e=>setChosen(e.target.value)}>{groups.map(([key,values],i)=><option key={key} value={key}>Group {i+1} · {values.length} setups · {values[0]!.condition.reasoning_requested === 'on'?'Requested on':'Requested off'} · {hardwareLabel(values[0]!.config, true)}</option>)}</select></label>
    <p className="footnote">{points.length} setups · {points[0]!.result.planned} questions, all scored and timed · matching hardware and requested test controls. Runtime and placement can differ; see the table. {rows.length-points.length} other setups are outside this timing group. {log?'Time uses a logarithmic scale.':''}</p>
    <TestMachineNote config={points[0]!.config}/>
    <p className="plot-selection" aria-live="polite"><strong>{selected.name}</strong><span>{creditLabel(selected.result,binary)} · {selected.result.median_task_s!.toFixed(1)}s median task time</span><a href={selected.href}>Open results →</a></p>
    <div className="plot-scroll"><div className="quality-time" role="group" aria-label={`${metric} versus median task seconds; exact values in the table below`}>
      <span className="plot-y-title" aria-hidden="true">{metric} · higher is better</span>
      {[0,.25,.5,.75,1].map(v=><div key={v} className="plot-grid-line" style={{top:`${y(v)/310*100}%`}} aria-hidden="true"><span>{v*100}%</span></div>)}
      {[0,.25,.5,.75,1].map(v=>{const value=log?10**(low+(high-low)*v):high*v;return <span key={v} className="plot-x-tick" style={{left:`${(62+650*v)/760*100}%`}} aria-hidden="true">{value.toFixed(value<10?1:0)}s</span>})}
      <span className="plot-x-title" aria-hidden="true">Median task time · less time ←</span>
      {points.map((p,i)=><button type="button" key={p.id} role="button" aria-pressed={selected.id===p.id} className="plot-point" style={{left:`${x(p.result.median_task_s!)/760*100}%`,top:`${y(p.result.score!)/310*100}%`}} onClick={()=>setSelectedId(p.id)} onFocus={()=>setSelectedId(p.id)} aria-label={`${p.name}: ${creditLabel(p.result,binary)}, ${p.result.median_task_s!.toFixed(1)} seconds; show model`} title={`${p.name} · ${creditLabel(p.result,binary)} · ${p.result.median_task_s!.toFixed(1)}s`}>{i+1}</button>)}
    </div></div>
    <details open><summary>Model key and exact values ({points.length} setups)</summary><p className="footnote">Recorded hardware profile: {hardwareLabel(points[0]!.config, true)}. All points have complete quality and timing coverage.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Speed and quality data"><table><thead><tr><th>Model</th><th>{metric}</th><th>Median time</th><th>Recorded setup</th></tr></thead><tbody>{points.map((p,i)=><tr key={p.id}><td><a href={p.href}>{i+1}. {p.name}</a></td><td>{creditLabel(p.result,binary)}</td><td>{p.result.median_task_s!.toFixed(1)}s</td><td>{p.config.runtime} · {p.config.observed.gpu_layers ?? 'Unknown'} GPU layers · {p.config.observed.context ?? 'Unknown'} context</td></tr>)}</tbody></table></div></details>
  </section>;
}
