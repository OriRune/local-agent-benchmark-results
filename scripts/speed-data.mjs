import {createHash} from 'node:crypto';
import {canonical} from '../src/lib/canonical.mjs';
const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
const sorted=rows=>[...rows].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const controls=['reasoning_requested','observed_reasoning','reasoning_effort','thinking_tokens','temperature','kind','protocol_id','seed','max_tokens','agent_steps','agent_seconds','question_seconds'];
export function profile(c){
  if(c.compatibility!=='known'||!c.hardware_id||!c.runtime||!c.concurrency||['context','gpu_layers','threads'].some(k=>c.observed[k]==null))return null;
  return {...Object.fromEntries(['hardware_id','runtime','runtime_build','concurrency','tool_adapter'].map(k=>[k,c[k]??null])),observed:c.observed};
}
export function speedRecords(data,id){
  const configs=new Map(data.configurations.map(c=>[c.id,c])),artifacts=new Map(data.artifacts.map(a=>[a.id,a])),checkpoints=new Map(data.checkpoints.map(c=>[c.id,c])),conditions=new Map(data.conditions.map(c=>[c.id,c]));
  const config=configs.get(id),execution=profile(config);if(!execution)return [];
  const checkpoint=checkpoints.get(artifacts.get(config.artifact_id).checkpoint_id);
  const baselines=new Map(data.checkpoints.map(cp=>[cp.id,data.configurations.filter(c=>c.artifact_id===cp.baseline_artifact_id).map(c=>c.id).sort()[0]]));
  const attempts=new Map(data.attempts.filter(a=>a.canonical&&a.status==='scored').map(a=>[a.trial_id,a]));
  function timing(row){
    const measured=row.trial_ids.filter(tid=>{const u=attempts.get(tid)?.usage;return u&&Number.isFinite(u.generated_tokens)&&u.generated_tokens>=0&&Number.isFinite(u.generation_s)&&u.generation_s>0;}).length;
    return {median_task_s:row.median_task_s,timed:row.timed,generated_tokens_per_s:measured===row.planned?row.generated_tokens_per_s:null,generation_timed:measured,full_credit:row.full_credit};
  }
  const complete=r=>r.eligible&&r.scored===r.planned&&r.timed===r.planned&&r.planned>0&&Number.isFinite(r.median_task_s)&&r.median_task_s>=0;
  const records=[];
  for(const subject of sorted(data.aggregates)){
    if(subject.configuration_id!==id||!complete(subject))continue;
    const control=conditions.get(subject.condition_id);if(control.kind!=='baseline')continue;
    const unique=new Map();
    for(const row of sorted(data.aggregates)){
      const c=configs.get(row.configuration_id),cp=checkpoints.get(artifacts.get(c.artifact_id).checkpoint_id);
      if(cp.id===checkpoint.id||baselines.get(cp.id)!==c.id||row.suite_id!==subject.suite_id||!complete(row)||canonical(profile(c))!==canonical(execution)||controls.some(k=>(conditions.get(row.condition_id)[k]??null)!==(control[k]??null)))continue;
      if(!unique.has(cp.id))unique.set(cp.id,{checkpoint_id:cp.id,configuration_id:c.id,name:cp.name,slug:cp.slug,condition_id:row.condition_id,aggregate_id:row.id,score:row.score,scored:row.scored,planned:row.planned,total_billions:cp.parameters.total_billions,architecture:cp.architecture,...timing(row)});
    }
    const members=[...unique.values()];if(members.length<2)continue;
    const record={kind:'speed',category:{scope:'same_machine_across_sizes',profile:execution},suite_id:subject.suite_id,condition_id:subject.condition_id,subject_aggregate_id:subject.id,subject_score:subject.score,subject_scored:subject.scored,subject_planned:subject.planned,subject_timing:timing(subject),members,memory_evidence:[],rank:1+members.filter(m=>m.score>subject.score+1e-9).length,tied_peers:members.filter(m=>Math.abs(m.score-subject.score)<=1e-9).length};
    record.id='peer-'+digest(record).slice(0,24);records.push(record);
  }
  return records;
}
