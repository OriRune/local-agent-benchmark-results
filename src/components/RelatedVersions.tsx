import type { OverviewData } from '../lib/public-types';
import { conditionLabel, visibleCondition } from '../lib/reasoning';
import { comparisonUrl } from '../lib/comparison';
import { archiveUrl } from '../lib/edition-client';
import { formatBytes } from '../lib/presentation';

export default function RelatedVersions({data, configurationId, conditionId, suiteId, releaseId, archived=false}: {data:OverviewData;configurationId:string;conditionId:string;suiteId:string;releaseId:string;archived?:boolean}) {
  const config=data.configurations.find(c=>c.id===configurationId)!;
  const artifact=data.artifacts.find(a=>a.id===config.artifact_id)!;
  const cp=data.checkpoints.find(c=>c.id===artifact.checkpoint_id)!;
  const condition=data.conditions.find(c=>c.id===conditionId)!;
  const suite=data.suites.find(s=>s.id===suiteId)!;
  const controls=['temperature','kind','protocol_id','seed','max_tokens','thinking_tokens','agent_steps','agent_seconds','question_seconds'] as const;
  const rows=data.aggregates.filter(a=>a.suite_id===suiteId).flatMap(a=>{
    const c=data.configurations.find(c=>c.id===a.configuration_id)!;
    const weight=data.artifacts.find(w=>w.id===c.artifact_id)!;
    const checkpoint=data.checkpoints.find(p=>p.id===weight.checkpoint_id)!;
    const mode=data.conditions.find(m=>m.id===a.condition_id)!;
    const quant=checkpoint.id===cp.id;
    const family=!!cp.family && checkpoint.family===cp.family;
    if ((!quant&&!family)||!visibleCondition(mode)||controls.some(k=>mode[k]!==condition[k])) return [];
    if (quant && (mode.reasoning_requested!==condition.reasoning_requested || mode.observed_reasoning!==condition.observed_reasoning)) return [];
    if (!quant && (weight.id!==checkpoint.baseline_artifact_id || !(mode.reasoning_requested==='off'||mode.verification==='native_reasoning'))) return [];
    const sameSetup=c.compatibility==='known' && config.compatibility==='known' && ['runtime','runtime_build','hardware_id','concurrency'].every(k=>c[k as keyof typeof c]===config[k as keyof typeof config]) && JSON.stringify(c.observed)===JSON.stringify(config.observed);
    const href=archived ? archiveUrl(releaseId,{checkpoint:checkpoint.id,configuration:c.id,condition:mode.id,suite:suiteId}) : `/models/${checkpoint.slug}/?${new URLSearchParams({configuration:c.id,condition:mode.id,suite:suiteId})}`;
    return [{a,c,weight,checkpoint,mode,quant,sameSetup,href}];
  });
  const groups=[{title:'Weight formats compared',items:rows.filter(r=>r.quant),show:new Set(rows.filter(r=>r.quant).map(r=>r.weight.id)).size>1,description:'All tested weight formats of this checkpoint, using the selected thinking setting. This shared comparison updates with new results; each saved model summary keeps its original date.'},
    {title:'Instruct vs Thinking / Reasoning',items:rows.filter(r=>r.c.id===config.id||!r.quant),show:rows.some(r=>!r.quant),description:'Two versions of the same model family, using separate GGUF checkpoints. Compare the extra task success with the extra time. This is a version comparison, not a switch within one file.'}];
  return <>{groups.filter(g=>g.show).map(g=><section className="panel" key={g.title}><h2>{g.title}</h2><p>{g.description}</p><h3>{suite.name}</h3><p>Scores and times describe this task bank. Quick failures are not a speed advantage. Different execution settings are labeled.</p><div className="table-scroll" tabIndex={0} role="region" aria-label={g.title}><table><thead><tr><th>Version</th><th>Task result</th><th>Typical task time</th><th>Weight download</th><th>Explore</th></tr></thead><tbody>{g.items.sort((a,b)=>a.c.id.localeCompare(b.c.id)).map(r=><tr key={r.a.id}><th><a href={r.href+'#model-analysis'}>{r.c.name}</a><small>{conditionLabel(r.mode)}{r.sameSetup?'':' · Different or uncertain execution settings'}</small></th><td>{r.a.score===null?'No assessed score':<><span>{(r.a.score*100).toFixed(1)}{suite.metric_kind==='binary'?'%':'/100'}</span><progress max={1} value={r.a.score} aria-label={`${r.c.name} average credit`}/></>}<small>{r.a.scored}/{r.a.planned} scored{r.a.eligible?'':' · Incomplete / not ranked'}</small></td><td>{r.a.median_task_s===null?'Not measured':`${r.a.median_task_s.toFixed(1)} seconds`}<small>{r.a.timed}/{r.a.planned} timed</small></td><td>{formatBytes(r.weight.total_bytes)}</td><td><a href={r.href+'#recorded-answers'}>Answers and code</a>{r.c.id!==config.id&&<p><a href={comparisonUrl({releaseId,suiteId,selections:[{configurationId,conditionId},{configurationId:r.c.id,conditionId:r.mode.id}]})}>Compare</a></p>}</td></tr>)}</tbody></table></div></section>)}</>;
}
