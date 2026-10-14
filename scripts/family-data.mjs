import {createHash} from 'node:crypto';
import {canonical} from '../src/lib/canonical.mjs';
import {profile} from './speed-data.mjs';
const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
export function familyRecords(data,id){
 const configs=new Map(data.configurations.map(c=>[c.id,c])), artifacts=new Map(data.artifacts.map(a=>[a.id,a])), cps=new Map(data.checkpoints.map(c=>[c.id,c])), conditions=new Map(data.conditions.map(c=>[c.id,c]));
 const config=configs.get(id),cp=cps.get(artifacts.get(config.artifact_id).checkpoint_id);
 if(!cp.family||profile(config)===null)return [];
 const result=[],controls=['reasoning_effort','thinking_tokens','temperature','kind','protocol_id','seed','max_tokens','agent_steps','agent_seconds','question_seconds'];
 for(const subject of data.aggregates){
  if(subject.configuration_id!==id||!subject.eligible)continue;
  const control=conditions.get(subject.condition_id);if(control.kind!=='baseline')continue;
  const members=[];
  for(const row of data.aggregates){
   const other=configs.get(row.configuration_id),artifact=artifacts.get(other.artifact_id),peer=cps.get(artifact.checkpoint_id),cond=conditions.get(row.condition_id);
   if(peer.id===cp.id||peer.family!==cp.family||artifact.id!==peer.baseline_artifact_id||row.suite_id!==subject.suite_id||!row.eligible||canonical(profile(other))!==canonical(profile(config)))continue;
   if(controls.some(k=>(control[k]??null)!==(cond[k]??null)))continue;
   if(cond.reasoning_requested!=='off'&&cond.verification!=='native_reasoning')continue;
   if(control.reasoning_requested!=='off'&&control.verification!=='native_reasoning')continue;
   members.push({checkpoint_id:peer.id,configuration_id:other.id,name:other.name,slug:peer.slug,condition_id:cond.id,aggregate_id:row.id,score:row.score,scored:row.scored,planned:row.planned,median_task_s:row.median_task_s,timed:row.timed,total_billions:peer.parameters.total_billions,architecture:peer.architecture});
  }
  if(!members.length)continue;
  const record={kind:'family',category:{family:cp.family},suite_id:subject.suite_id,condition_id:subject.condition_id,subject_aggregate_id:subject.id,subject_score:subject.score,subject_scored:subject.scored,subject_planned:subject.planned,members:members.sort((a,b)=>a.configuration_id<b.configuration_id?-1:a.configuration_id>b.configuration_id?1:0),memory_evidence:[],rank:1+members.filter(m=>m.score>subject.score+1e-9).length,tied_peers:members.filter(m=>Math.abs(m.score-subject.score)<=1e-9).length};
  record.id='peer-'+digest(record).slice(0,24);result.push(record);
 }
 return result;
}
