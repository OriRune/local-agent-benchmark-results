import {familyRecords} from './family-data.mjs';
import { createHash } from 'node:crypto';
import { canonical } from '../src/lib/canonical.mjs';
import { categoryPolicy, parameterBand, verifiedFits, memoryProfile, validateCategories } from '../src/lib/categories.mjs';
import { speedRecords } from './speed-data.mjs';
const digest = v => createHash('sha256').update(canonical(v)).digest('hex');
const CONTROLS = ['reasoning_requested','observed_reasoning','reasoning_effort','thinking_tokens','temperature','kind','protocol_id','seed','max_tokens','agent_steps','agent_seconds','question_seconds'];
const sorted = rows => [...rows].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function peerContext(data, configurationId) {
  validateCategories(data);
  const policy = categoryPolicy(data), configs = new Map(data.configurations.map(c=>[c.id,c])), artifacts = new Map(data.artifacts.map(a=>[a.id,a])), checkpoints = new Map(data.checkpoints.map(c=>[c.id,c])), conditions = new Map(data.conditions.map(c=>[c.id,c]));
  const config = configs.get(configurationId), checkpoint = checkpoints.get(artifacts.get(config.artifact_id).checkpoint_id), band = parameterBand(checkpoint,policy), groups=[];
  if (band && ['dense','moe'].includes(checkpoint.architecture)) {
    const ids=[];
    for (const c of checkpoints.values()) if (parameterBand(c,policy)===band && c.architecture===checkpoint.architecture) {
      const candidates=[...configs.values()].filter(x=>x.artifact_id===c.baseline_artifact_id).map(x=>x.id).sort(); if(candidates.length) ids.push(candidates[0]);
    }
    groups.push(['parameters',{band,architecture:checkpoint.architecture},ids,[]]);
  }
  for (const fit of verifiedFits(data,configurationId)) for (const budget of policy.memory_budgets_gb) {
    if (fit.budget_gb>budget) continue;
    const matches=(data.memory_fits??[]).filter(f=>f.status==='verified'&&f.budget_gb<=budget&&canonical(memoryProfile(f))===canonical(memoryProfile(fit))).sort((a,b)=> a.configuration_id<b.configuration_id?-1:a.configuration_id>b.configuration_id?1:a.budget_gb-b.budget_gb||(a.id<b.id?-1:a.id>b.id?1:0));
    const selected=new Map();for(const f of matches){const c=configs.get(f.configuration_id),key=artifacts.get(c.artifact_id).checkpoint_id;if(!selected.has(key))selected.set(key,f);}
    groups.push(['memory',{budget_gb:budget,profile:memoryProfile(fit)},[...selected.values()].map(f=>f.configuration_id),[...selected.values()]]);
  }
  const records=new Map();
  for(const subject of sorted(data.aggregates)){
    if(subject.configuration_id!==configurationId||!subject.eligible)continue;
    const control=conditions.get(subject.condition_id);if(control.kind!=='baseline')continue;
    for(const [kind,category,ids,fits] of groups){
      const unique=new Map();
      for(const row of sorted(data.aggregates)){
        const cid=row.configuration_id,c=configs.get(cid),cp=checkpoints.get(artifacts.get(c.artifact_id).checkpoint_id),other=conditions.get(row.condition_id);
        if(!ids.includes(cid)||cp.id===checkpoint.id||row.suite_id!==subject.suite_id||!row.eligible||c.compatibility!=='known'||CONTROLS.some(k=>(other[k]??null)!==(control[k]??null)))continue;
        if(!unique.has(cp.id))unique.set(cp.id,{checkpoint_id:cp.id,configuration_id:cid,name:cp.name,slug:cp.slug,condition_id:row.condition_id,aggregate_id:row.id,score:row.score,scored:row.scored,planned:row.planned,median_task_s:row.median_task_s,timed:row.timed,total_billions:cp.parameters.total_billions,architecture:cp.architecture});
      }
      const members=[...unique.values()];if(members.length<policy.minimum_peer_checkpoints)continue;
      const record={kind,category,suite_id:subject.suite_id,condition_id:subject.condition_id,subject_aggregate_id:subject.id,subject_score:subject.score,subject_scored:subject.scored,subject_planned:subject.planned,members,memory_evidence:fits,rank:1+members.filter(m=>m.score>subject.score+1e-9).length,tied_peers:members.filter(m=>Math.abs(m.score-subject.score)<=1e-9).length};record.id='peer-'+digest(record).slice(0,24);records.set(record.id,record);
    }
  }
  return {policy,subject_band:band,subject_architecture:checkpoint.architecture,subject_memory_fits:verifiedFits(data,configurationId),records:sorted([...records.values()])};
}
export function enrichReaderPacket(packet,data){packet.inputs.reader_context=peerContext(data,packet.configuration_id);packet.inputs.reader_context.records=sorted([...packet.inputs.reader_context.records,...speedRecords(data,packet.configuration_id),...familyRecords(data,packet.configuration_id)]);for(const peer of packet.inputs.reader_context.records)if(peer.kind==='memory')packet.inputs.numeric_facts.push({id:'fact-'+digest([peer.id,'memory_budget']).slice(0,24),record_id:peer.id,metric:'memory_budget',value:peer.category.budget_gb,unit:'GB',configuration_id:packet.configuration_id,suite_id:peer.suite_id,condition_id:peer.condition_id});packet.inputs.numeric_facts=sorted(packet.inputs.numeric_facts);packet.inputs.shared_limitation_ids=packet.inputs.limitations.slice(0,4).map(l=>l.id);packet.analysis_input_hash=digest(packet.inputs);return packet;}
export function retainsPriorCohort(prior,current){
  if(['policy','subject_band','subject_architecture','subject_memory_fits'].some(k=>canonical(prior[k])!==canonical(current[k])))return false;
  const scope=r=>({...Object.fromEntries(['kind','category','suite_id','condition_id','subject_aggregate_id','subject_score','subject_scored','subject_planned'].map(k=>[k,r[k]])),...(r.kind==='speed'?{subject_timing:r.subject_timing}:{})});
  return prior.records.every(old=>current.records.some(now=>canonical(scope(old))===canonical(scope(now))&&old.members.every(m=>now.members.some(n=>canonical(m)===canonical(n)))&&old.memory_evidence.every(f=>now.memory_evidence.some(n=>canonical(f)===canonical(n))))&&old.id==='peer-'+digest(Object.fromEntries(Object.entries(old).filter(([k])=>k!=='id'))).slice(0,24)&&old.rank===1+old.members.filter(m=>m.score>old.subject_score+1e-9).length&&old.tied_peers===old.members.filter(m=>Math.abs(m.score-old.subject_score)<=1e-9).length);
}
