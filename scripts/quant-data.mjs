import { createHash } from 'node:crypto';
import { canonical } from '../src/lib/canonical.mjs';
import { profile } from './speed-data.mjs';
import { verifyEditorialReview } from './summary-data.mjs';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const ordered = values => [...values].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const pick = (value,keys) => Object.fromEntries(keys.map(k=>[k,value[k]??null]));
const qualityProfile = (config,v2) => profile(v2?{...config,speed_eligible:true}:config);
const CONTROLS=['reasoning_requested','observed_reasoning','reasoning_effort','thinking_tokens','temperature','kind','protocol_id','seed','max_tokens','agent_steps','agent_seconds','question_seconds'];
/**
 * @param {any} data
 * @param {string} checkpointId
 * @param {{artifactIds?:Set<string>|null,suiteIds?:Set<string>|null,policy?:string,configurationIds?:Set<string>|string[]|null,inclusionEvidenceSha256?:string|null}} [options]
 */
export function quantPacket(data,checkpointId,{artifactIds=null,suiteIds=null,policy='checkpoint-quant-facts-v1',configurationIds=null,inclusionEvidenceSha256=null}={}) {
  if(!['checkpoint-quant-facts-v1','checkpoint-quant-facts-v2'].includes(policy))throw new Error('Unknown quant facts policy');
  const v2=policy==='checkpoint-quant-facts-v2';
  if(v2){
    if(!(configurationIds instanceof Set||Array.isArray(configurationIds))||!configurationIds.size&&!configurationIds.length||[...configurationIds].some(id=>typeof id!=='string')||new Set(configurationIds).size!==[...configurationIds].length||typeof inclusionEvidenceSha256!=='string'||!/^([a-f0-9]{64})$/.test(inclusionEvidenceSha256))throw new Error('Quant v2 requires explicit completed configuration IDs and inclusion evidence hash');
    configurationIds=new Set(configurationIds);
    const known=new Set(data.configurations.map(c=>c.id));if([...configurationIds].some(id=>!known.has(id)))throw new Error('Unknown completed quant configuration');
  }else if(configurationIds!==null||inclusionEvidenceSha256!==null)throw new Error('Explicit quant inclusion requires the v2 policy');
  const checkpoint=data.checkpoints.find(c=>c.id===checkpointId);
  if(!checkpoint)throw new Error('Unknown quant checkpoint');
  let artifacts=ordered(data.artifacts.filter(a=>a.checkpoint_id===checkpointId&&(!artifactIds||artifactIds.has(a.id))));
  const ids=new Set(artifacts.map(a=>a.id));
  let configurations=ordered(data.configurations.filter(c=>ids.has(c.artifact_id)&&(!v2||configurationIds.has(c.id))));
  const includedIds=configurations.map(c=>c.id);
  let configs=new Map(configurations.map(c=>[c.id,c]));
  const conditions=new Map(data.conditions.filter(c=>configs.has(c.configuration_id)).map(c=>[c.id,c]));
  const grouped=new Map();let coverage=[];
  for(const aggregate of ordered(data.aggregates)) {
    if(!configs.has(aggregate.configuration_id))continue;
    if(suiteIds&&!suiteIds.has(aggregate.suite_id))continue;
    const config=configs.get(aggregate.configuration_id),condition=conditions.get(aggregate.condition_id);
    if(condition.kind!=='baseline'||condition.presentation_included===false)continue;
    coverage.push(pick(aggregate,['id','configuration_id','condition_id','suite_id','planned','scored','eligible']));
    const execution=qualityProfile(config,v2);
    if(!aggregate.eligible||!execution)continue;
    if(v2&&(aggregate.scored!==aggregate.planned||aggregate.planned<=0||config.execution_kind==='cloud'||config.runtime==='openrouter'))continue;
    const controls=pick(condition,CONTROLS),key=digest({suite_id:aggregate.suite_id,control:controls,...(v2?{context:execution.observed.context}:{execution})});
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push({aggregate,config,condition,controls,execution});
  }
  const groups=[],trialIds=new Set();
  for(const candidates of grouped.values()) {
    candidates.sort((a,b)=>a.config.id<b.config.id?-1:a.config.id>b.config.id?1:a.aggregate.id<b.aggregate.id?-1:a.aggregate.id>b.aggregate.id?1:0);
    const selected=new Map();for(const c of candidates)if(!selected.has(c.config.artifact_id))selected.set(c.config.artifact_id,c);
    if(selected.size<2)continue;
    const first=selected.values().next().value,rows=[];
    for(const [artifactId,{aggregate,config,condition}] of [...selected].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
      rows.push({artifact_id:artifactId,configuration_id:config.id,condition_id:condition.id,aggregate_id:aggregate.id,...pick(aggregate,['score','planned','scored','full_credit','timed','median_task_s']),...(v2?{execution_profile:qualityProfile(config,v2)}:{})});
      aggregate.trial_ids.forEach(id=>trialIds.add(id));
    }
    const group={suite_id:first.aggregate.suite_id,controls:first.controls,...(v2?{context:first.execution.observed.context}:{execution:first.execution}),rows,
      timing_comparable:rows.every(r=>configs.get(r.configuration_id).speed_eligible!==false&&r.timed===r.planned&&r.median_task_s!==null)&&(!v2||rows.every(r=>canonical(r.execution_profile)===canonical(rows[0].execution_profile)&&Number.isFinite(r.median_task_s)&&r.median_task_s>=0)),causal_quant_effect_verified:false};
    group.id='quant-group-'+digest(group).slice(0,24);groups.push(group);
  }
  if(groups.length){const memberConfigs=new Set(groups.flatMap(g=>g.rows.map(r=>r.configuration_id))),memberArtifacts=new Set(groups.flatMap(g=>g.rows.map(r=>r.artifact_id)));artifacts=artifacts.filter(a=>memberArtifacts.has(a.id));configurations=configurations.filter(c=>memberConfigs.has(c.id));configs=new Map(configurations.map(c=>[c.id,c]));coverage=coverage.filter(a=>memberConfigs.has(a.configuration_id));}
  const trials=ordered(data.trials.filter(t=>trialIds.has(t.id))),questionIds=new Set(trials.map(t=>t.question_id));
  const evidence=digest({trials,attempts:ordered(data.attempts.filter(a=>a.canonical&&trialIds.has(a.trial_id))),questions:ordered(data.questions.filter(q=>questionIds.has(q.id)))});
  const usedSuites=new Set(groups.map(g=>g.suite_id));
  const inputs={policy,checkpoint,artifacts,configurations,groups:ordered(groups),coverage,
    suites:ordered(data.suites.filter(s=>usedSuites.has(s.id))),evidence_sha256:evidence,
    investigations:(data.investigations??[]).filter(i=>configs.has(i.configuration_id)).map(i=>pick(i,['configuration_id','kind','text'])),
    limitations:[
      'These are comparisons of tested setups registered to one checkpoint. They do not isolate bit depth from conversion, publisher, runtime-build or template differences.',
      'Only complete eligible banks with matching recorded execution settings and task controls enter the comparison. Other results remain visible as coverage, not ranked evidence.',
      'Download size is not RAM or VRAM requirement. No memory-fit recommendation is established by this comparison.',
      'Small score differences can reflect a single question. Similar results are not proof of equivalence; timings describe this benchmark machine.'
    ]};
  if(v2){inputs.inclusion={configuration_ids:includedIds,evidence_sha256:inclusionEvidenceSha256};inputs.limitations[1]='Only complete eligible banks with matching task controls and recorded context enter the quality comparison. Execution profiles are shown per setup; timing is compared only when every recorded execution profile matches and timing coverage is complete. Other results remain coverage, not ranked evidence.';}
  return {quant_facts_version:v2?2:1,checkpoint_id:checkpointId,origin_dataset_revision_id:data.dataset_revision_id,analysis_input_hash:digest(inputs),eligible:groups.length>0,inputs};
}
export function quantPacketOptions(packet){
  if(packet.quant_facts_version===1&&packet.inputs.policy==='checkpoint-quant-facts-v1')return {};
  if(packet.quant_facts_version===2&&packet.inputs.policy==='checkpoint-quant-facts-v2'){
    const inclusion=packet.inputs.inclusion,ids=inclusion?.configuration_ids,evidence=inclusion?.evidence_sha256;
    if(!inclusion||Object.keys(inclusion).sort().join(',')!=='configuration_ids,evidence_sha256'||!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string')||canonical(ids)!==canonical([...new Set(ids)].sort())||typeof evidence!=='string'||!/^([a-f0-9]{64})$/.test(evidence))throw new Error('Invalid quant v2 completed configuration inclusion');
    return {policy:packet.inputs.policy,configurationIds:ids,inclusionEvidenceSha256:evidence};
  }
  throw new Error('Unknown quant facts version or policy');
}
export function verifyQuantClaims(content,packet) {
  quantPacketOptions(packet);
  const groups=new Map(packet.inputs.groups.map(g=>[g.id,g]));
  if(!packet.eligible||digest(packet.inputs)!==packet.analysis_input_hash)throw new Error('Invalid or ineligible quant evidence');
  const names=[packet.inputs.checkpoint.name,...packet.inputs.artifacts.map(a=>a.quantization)].sort((a,b)=>b.length-a.length);
  for(const claim of [content.synopsis,...content.observations]) {
    if(!claim.group_ids.every(id=>groups.has(id)))throw new Error('Unknown quant comparison reference');
    const allowed=new Set(claim.group_ids.flatMap(id=>groups.get(id).rows.map(r=>r.artifact_id)));
    if(!claim.artifact_ids.every(id=>allowed.has(id)))throw new Error('Quant artifact is outside its completed comparison');
    let text=claim.text;for(const name of names)text=text.split(name).join('');
    if(/\d/.test(text))throw new Error('Quant prose measurements must remain in validated charts');
    if(/\b(RAM|VRAM|memory|fits?|equivalent|equivalence)\b/i.test(text))throw new Error('Unsupported quant memory-fit or equivalence claim');
    if(/\b(faster|slower|quicker|speed|time|wait|latency)\b/i.test(text)&&claim.group_ids.some(id=>!groups.get(id).timing_comparable))throw new Error('Incomplete quant timing');
  }
  return {status:'passed',validator_version:'quant-summary-validator-v1',semantic_review_required:true,claims:1+content.observations.length};
}
export function verifyQuantSummary(summary,packet,data) {
  if(summary.summary_id!=='quant-summary-'+digest(Object.fromEntries(Object.entries(summary).filter(([k])=>k!=='summary_id'))))throw new Error('Quant summary identity differs');
  if(summary.editorial.state!=='approved')throw new Error('Quant summary is not approved');
  verifyEditorialReview(summary.editorial);
  const options=quantPacketOptions(packet);
  let expected=quantPacket(data,summary.checkpoint_id,options);
  if(summary.evidence.analysis_input_hash!==expected.analysis_input_hash)expected=quantPacket(data,summary.checkpoint_id,{...options,artifactIds:new Set(packet.inputs.artifacts.map(a=>a.id)),suiteIds:new Set(packet.inputs.coverage.map(a=>a.suite_id))});
  if(canonical({...packet,origin_dataset_revision_id:expected.origin_dataset_revision_id})!==canonical(expected)||summary.evidence.analysis_input_hash!==expected.analysis_input_hash)throw new Error('Quant summary evidence is stale or changed');
  if(canonical(verifyQuantClaims(summary.content,expected))!==canonical(summary.validation))throw new Error('Quant validation differs');
}
