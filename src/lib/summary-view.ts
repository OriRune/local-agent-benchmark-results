import { conditionLabel } from './reasoning';
import type { PublicBenchmarkSummaryV1, ReaderClaim, Claim } from './public-summary';
import { archiveUrl } from './edition-client';
import type { ModelMention } from './model-mentions';

export type PeerRecord = {
  id: string; kind: string; suite_id: string; condition_id: string; rank: number;
  category?: { family?: string; band?: string; architecture?: string; budget_gb?: number; scope?:string; profile?: {memory_type?:string;context_tokens?:number;other_memory_gb?:number;hardware_id?:string;runtime?:string;runtime_build?:string|null;concurrency?:number;tool_adapter?:string;observed?:Record<string,number|null>} };
  subject_score: number; subject_scored: number; subject_planned: number;
  subject_timing?: TimingRow;
  members: {name:string;configuration_id:string;condition_id:string;slug:string;checkpoint_id:string;score:number;scored:number;planned:number;total_billions?:number|null}[];
};
export type TimingRow = {median_task_s:number;timed:number;generated_tokens_per_s:number|null;generation_timed:number;full_credit:number};
export type SpeedChart = {title:string;mode:string;date:string;binary:boolean;rows:(TimingRow & {name:string;score:number;scored:number;planned:number;subject:boolean;href?:string})[]};
export type PeerChart = { id: string; title: string; description: string; metric: string; metricExplanation: string; mode: string; cohort: string; date: string; binary:boolean; uniformCoverage:string|null; ceiling:boolean; stale:boolean; otherMode?:string; moe:boolean;
  rows: {name:string;score:number;scored:number;planned:number;subject:boolean;rank:number;tied:boolean;size?:number|null;gap:string;href?:string}[] };
export type SummaryReference = { id: string; label: string; detail: string; href?: string; answersHref?:string; group?: string; context?: string; chart?: PeerChart; speedChart?:SpeedChart; overview?: {label:string;detail:string}[]; metric?:string };
export type SummaryView = { summary: PublicBenchmarkSummaryV1; references: Record<string, SummaryReference>; modelMentions?: ModelMention[]; comparisonRefreshNeeded?: boolean; comparisonEvidenceDate?: string; visibleLimitations?: (Claim | ReaderClaim)[] };
export type SummaryPacket = { peer_refresh_needed?: boolean; analysis_input_hash?: string; origin_dataset_revision_id?: string; inputs: {
  subject?: { configuration: {name:string}; checkpoint?: {parameters:{total_billions:number|null;active_billions?:number|null}} };
  suites?: {id:string;name:string;description:string;metric:string;metric_kind:string}[];
  conditions?: {id:string;reasoning_requested:string;observed_reasoning?:string;verification?:string;kind:string}[];
  shared_limitation_ids?:string[];
  aggregates?: {id:string;suite_id:string;condition_id:string;score:number|null;scored:number;planned:number;full_credit:number;partial_credit:number;zero_credit:number;eligible:boolean}[];
  comparisons?: {id:string;suite_id:string;off_score:number|null;on_score:number|null;score_pairs:number;planned_pairs:number}[];
  repetitions?: {id:string;reasoning_requested:string}[];
  reader_context?: { policy?: {parameter_bands:{id:string;label:string}[]}; records: PeerRecord[] };
  numeric_facts: { id: string; record_id?: string; metric: string; value: number | null; unit: string; condition_id: string | null; suite_id: string | null }[];
  limitations: { id: string; text: string }[];
  examples: { attempt: { id: string; score?:number|null; status?:string }; trial: { question_id: string; configuration_id: string; condition_id: string }; question: { source_id: string; title: string; suite_id?:string } }[];
} };

const metricLabels: Record<string,string> = {
  'outcome_counts.full_credit':'Full-credit answers', 'outcome_counts.partial_credit':'Partially correct answers',
  'outcome_counts.incorrect':'Incorrect completed answers', 'outcome_counts.failed_to_finish':'Failed to finish',
  'outcome_counts.technical_error':'Unscored technical errors', 'outcome_counts.review':'Awaiting assessment',
  'outcome_counts.unresolved':'Unresolved outcomes', 'outcome_counts.untested':'Untested tasks',
  score:'Score', full_credit:'Full-credit results', partial_credit:'Partial-credit results', zero_credit:'No-credit results',
  planned:'Tasks planned', scored:'Tasks scored', timed:'Tasks timed', median_task_s:'Typical time per task (median)',
  generated_tokens_per_s:'Generation speed', score_pairs:'Tasks compared with thinking off and on', time_pairs:'Tasks timed in both modes', planned_pairs:'Paired tasks planned',
  off_score:'Score with thinking off', on_score:'Score with thinking on', delta_pp:'Score change with thinking on',
  mean_added_s:'Average extra time with thinking on', mean_off_s:'Average time with thinking off', mean_on_s:'Average time with thinking on',
  median_off_s:'Median time with thinking off', median_on_s:'Median time with thinking on', median_paired_delta_s:'Median time change with thinking on',
  ratio_summed_time:'Total time: thinking on ÷ off', improved:'Tasks improved with thinking on', worsened:'Tasks worsened with thinking on', unchanged:'Tasks unchanged',
  full_credit_repetitions:'Repetitions earning full credit', scored_repetitions:'Repetitions scored', planned_repetitions:'Repetitions planned',
  planned_questions:'Distinct questions planned', complete_questions:'Questions with all repetitions scored', all_repeats_full_credit:'Questions successful every repetition', memory_budget_gb:'Memory budget', memory_budget:'Memory budget',
};
export function metricLabel(metric: string): string {
  return metricLabels[metric] ?? metric.replace(/^states\./, 'Results marked ').replaceAll('_',' ');
}
export function evidenceGroups(ids: string[], references: Record<string, SummaryReference>) {
  const groups = new Map<string, {title:string;context?:string;rows:SummaryReference[]}>();
  for (const id of ids) {
    const ref = references[id]!;
    const key = ref.group ? `fact-group:${ref.group}` : ref.id;
    if (!groups.has(key)) groups.set(key, {title:ref.group ? ref.context ?? 'Recorded results' : ref.label, rows:[]});
    groups.get(key)!.rows.push(ref);
  }
  return [...groups.values()].map(group => {
    const overview=group.rows.find(r=>r.overview)?.overview;
    return {...group,overview,rows:overview ? group.rows.filter(r=>!['score','full_credit','partial_credit','zero_credit','scored','planned','off_score','on_score','score_pairs','planned_pairs'].includes(r.metric ?? '')) : group.rows,
      href:group.rows[0]?.href, answersHref:group.rows[0]?.answersHref, numerical:!!group.rows[0]?.group};
  });
}

export function factText(value: number | null, unit: string): string {
  if (value === null) return 'not measured';
  if (unit === 'normalized_credit') return `${(value * 100).toFixed(1)}% average credit`;
  if (unit === 'percentage_points') return `${value >= 0 ? '+' : ''}${value.toFixed(1)} percentage points`;
  if (unit === 'ratio') return `${value.toFixed(2)}×`;
  if (unit === 'seconds') return `${value.toFixed(1)} seconds`;
  if (unit === 'tokens_per_second') return `${value.toFixed(1)} tokens/second`;
  if (Math.abs(value) === 1 && ['trials', 'questions', 'pairs', 'repetitions'].includes(unit)) unit = unit.slice(0, -1);
  return `${value} ${unit}`;
}
export function summaryClaimText(claim: Claim | ReaderClaim): string {
  const facts = new Map(claim.numeric_facts.map(f => [f.fact_id, f]));
  return claim.text.replace(/\{\{(fact-[a-f0-9]+)\}\}/g, (placeholder, id: string, offset: number) => {
    const fact = facts.get(id); if (!fact) throw new Error('Summary fact is unavailable');
    const following=claim.text.slice(offset+placeholder.length);
    if(fact.value!==null){
      if(fact.unit==='seconds' && /^\s+seconds?\b/.test(following))return fact.value.toFixed(1);
      const labels:Record<string,string>={trials:'(?:trials?|tasks?)',questions:'questions?',pairs:'pairs?',repetitions:'repetitions?'};
      const label=labels[fact.unit];
      if(label){
        const count=following.match(new RegExp(`^(?:\\s+(?:of|out of)\\s+\\{\\{(fact-[a-f0-9]+)\\}\\})?\\s+${label}\\b`));
        if(count && (!count[1] || facts.get(count[1])?.unit===fact.unit))return String(fact.value);
      }
    }
    return factText(fact.value, fact.unit);
  });
}
export function summaryView(summary: PublicBenchmarkSummaryV1, packet: SummaryPacket, edition?: { releaseId: string; checkpointId: string }): SummaryView {
  // A later approval alone does not refresh a retained historical cohort.
  const basis = summary.editorial_basis;
  const reviewedAt = summary.editorial.reviewed_at;
  const currentEditorialEvidence = summary.editorial.state === 'approved' && basis && reviewedAt &&
    !packet.peer_refresh_needed && basis.review_dataset_revision_id !== basis.source_dataset_revision_id &&
    packet.origin_dataset_revision_id === basis.review_dataset_revision_id &&
    packet.analysis_input_hash === summary.evidence.analysis_input_hash &&
    Date.parse(reviewedAt) >= Date.parse(summary.generated_at);
  const comparisonEvidenceDate = (currentEditorialEvidence ? reviewedAt : summary.generated_at).slice(0,10);
  const claims = [summary.content.verdict, ...summary.content.strengths, ...summary.content.weaknesses, ...summary.content.thinking_tradeoffs, ...summary.content.limitations, ...('peer_comparisons' in summary.content ? summary.content.peer_comparisons : [])];
  const used = new Set(claims.flatMap(c => c.evidence_refs));
  const references: Record<string, SummaryReference> = {};
  const suites = new Map(packet.inputs.suites?.map(s => [s.id,s]));
  const conditions = new Map(packet.inputs.conditions?.map(c => [c.id,c]));
  const mode = (id: string | null, record?:string) => {
    const c = id ? conditions.get(id) : undefined;
    const repeat = packet.inputs.repetitions?.find(r => r.id === record);
    if (repeat) return `Thinking ${repeat.reasoning_requested} · sampled repetitions`;
    if (!c) return id ? 'Thinking setting not recorded' : 'Thinking off versus on';
    return `${conditionLabel(c)}${c.kind === 'repeat' ? ' · sampled repetition' : ''}`;
  };
  const scoreText = (value: number | null, suiteId: string | null) => value === null ? 'Not measured' : `${(value*100).toFixed(1)}${suites.get(suiteId ?? '')?.metric_kind === 'binary' ? '%' : '/100'} · ${suites.get(suiteId ?? '')?.metric ?? 'average credit'}`;
  const overview = (record?:string) => {
    const a=packet.inputs.aggregates?.find(a=>a.id===record);
    if(a){
      const binary=suites.get(a.suite_id)?.metric_kind==='binary';
      return [{label:binary ? 'Tasks passed' : 'Average score',detail:binary ? `${a.full_credit} of ${a.scored} (${a.score == null ? 'score unavailable' : (a.score*100).toFixed(1)+'%'})` : scoreText(a.score,a.suite_id)},
        {label:'Test coverage',detail:`${a.scored} of ${a.planned} tasks scored`},
        ...(!binary ? [{label:'Task outcomes',detail:`${a.full_credit} full credit · ${a.partial_credit} partial · ${a.zero_credit} no credit`}] : [])];
    }
    const pair=packet.inputs.comparisons?.find(p=>p.id===record);
    if(pair) return [{label:'Thinking off → on',detail:`${scoreText(pair.off_score,pair.suite_id)} → ${scoreText(pair.on_score,pair.suite_id)}`}, {label:'Paired test coverage',detail:`${pair.score_pairs} of ${pair.planned_pairs} tasks compared in both modes`}];
    return undefined;
  };

  for (const fact of packet.inputs.numeric_facts) if (used.has(fact.id)) {
    const query = new URLSearchParams({ configuration: summary.subject.configuration_id });
    if (fact.suite_id) query.set('suite', fact.suite_id);
    if (fact.condition_id) query.set('condition', fact.condition_id);
    const href = edition ? archiveUrl(edition.releaseId, { ...Object.fromEntries(query), checkpoint: edition.checkpointId }) : `?${query}`;
    references[fact.id] = { id: fact.id, label: fact.metric==='mean_added_s' ? 'Average time change with thinking on' : metricLabel(fact.metric), metric:fact.metric, overview:overview(fact.record_id), detail: fact.unit === 'normalized_credit' ? scoreText(fact.value,fact.suite_id) : fact.metric==='mean_added_s' && fact.value!==null ? (Math.abs(fact.value)<.05 ? 'No measurable change' : `${Math.abs(fact.value).toFixed(1)} seconds ${fact.value<0 ? 'faster' : 'slower'}`) : fact.unit==='percentage_points' && fact.value!==null ? (fact.value===0 ? 'No change' : `${fact.value>0 ? '+' : ''}${fact.value.toFixed(1)} score points`) : factText(fact.value, fact.unit==='trials' ? 'tasks' : fact.unit),
      group: fact.record_id ?? `${fact.suite_id}/${fact.condition_id}`,
      context: `${suites.get(fact.suite_id ?? '')?.name ?? 'Recorded test results'} · ${mode(fact.condition_id, fact.record_id)}`, href: `${href}#recorded-results`, ...(fact.suite_id ? {answersHref:`${href}#recorded-answers`} : {}) };
  }
  for (const limit of packet.inputs.limitations) if (used.has(limit.id)) references[limit.id] = { id: limit.id, label: 'Source limitation', detail: limit.text };
  let exampleNumber=0;
  for (const example of packet.inputs.examples) if (used.has(example.attempt.id)) {
    exampleNumber++;
    const query = new URLSearchParams({ configuration: example.trial.configuration_id, condition: example.trial.condition_id, attempt: example.attempt.id });
    references[example.attempt.id] = { id: example.attempt.id, label: `Example ${exampleNumber}: ${suites.get(example.question.suite_id ?? '')?.name ?? example.question.title}`, detail: `${mode(example.trial.condition_id)}. ${example.attempt.score == null ? 'No score recorded' : example.attempt.score===1 ? 'Final result: full credit' : example.attempt.score===0 ? 'Final result: no credit' : 'Final result: '+scoreText(example.attempt.score, example.question.suite_id ?? null)}. A final score does not describe every tool step; this example supports a behavior observation, not a whole-test conclusion.`, href: edition ? archiveUrl(edition.releaseId, { ...Object.fromEntries(query), question: example.trial.question_id }) : `/questions/${encodeURIComponent(example.trial.question_id)}/?${query}` };
  }
  for (const peer of packet.inputs.reader_context?.records ?? []) if (used.has(peer.id)) {
    const suite = suites.get(peer.suite_id);
    if(peer.kind==='speed'){
      if(!peer.subject_timing)throw new Error('Missing speed evidence');
      const answerLink=(checkpoint:string,configuration:string,condition:string,slug?:string)=>edition ? archiveUrl(edition.releaseId,{checkpoint,configuration,condition,suite:peer.suite_id})+'#recorded-answers' : `${slug ? '/models/'+slug+'/' : ''}?${new URLSearchParams({configuration,condition,suite:peer.suite_id})}#recorded-answers`;
      const rows=[{...peer.subject_timing,name:packet.inputs.subject?.configuration.name??'This model',score:peer.subject_score,scored:peer.subject_scored,planned:peer.subject_planned,subject:true,href:answerLink(edition?.checkpointId??summary.subject.checkpoint_id,summary.subject.configuration_id,peer.condition_id)},...peer.members.map(m=>({...(m as typeof m & TimingRow),subject:false,href:answerLink(m.checkpoint_id,m.configuration_id,m.condition_id,m.slug)}))];
      if(rows.some(r=>!Number.isFinite(r.median_task_s)||r.median_task_s<0||r.timed!==r.planned||r.scored!==r.planned||r.generated_tokens_per_s!==null&&(!Number.isFinite(r.generated_tokens_per_s)||r.generation_timed!==r.planned)))throw new Error('Invalid or incomplete speed evidence');
      rows.sort((a,b)=>a.median_task_s-b.median_task_s||a.name.localeCompare(b.name));
      references[peer.id]={id:peer.id,label:`Speed: ${suite?.name??'Recorded tasks'}`,detail:`${mode(peer.condition_id)}. Matching test-machine label and execution settings; spans model sizes. Timings include unsuccessful tasks, so read them alongside quality.`,speedChart:{title:suite?.name??'Recorded tasks',mode:mode(peer.condition_id),date:comparisonEvidenceDate,binary:suite?.metric_kind==='binary',rows}};
      continue;
    }
    const rows = [{name:packet.inputs.subject?.configuration.name ?? 'This model',score:peer.subject_score,scored:peer.subject_scored,planned:peer.subject_planned,subject:true,size:packet.inputs.subject?.checkpoint?.parameters.total_billions,href:undefined as string | undefined},
      ...peer.members.map(m => ({name:m.name,score:m.score,scored:m.scored,planned:m.planned,subject:false,size:m.total_billions,href:edition ? archiveUrl(edition.releaseId,{checkpoint:m.checkpoint_id,configuration:m.configuration_id,condition:m.condition_id,suite:peer.suite_id}) + '#recorded-results' : `/models/${m.slug}/?${new URLSearchParams({configuration:m.configuration_id,condition:m.condition_id,suite:peer.suite_id})}#recorded-results`}))];
    if (rows.some(r => !Number.isFinite(r.score) || r.score < 0 || r.score > 1)) throw new Error('Peer chart score is unavailable or invalid');
    rows.sort((a,b) => (Math.abs(b.score-a.score)>1e-9 ? b.score-a.score : 0) || a.name.localeCompare(b.name));
    const rank=1+rows.filter(r=>r.score>peer.subject_score+1e-9).length;
    if(rank!==peer.rank)throw new Error('Stored peer rank differs from chart evidence');
    const binary=suite?.metric_kind==='binary';
    const other=packet.inputs.aggregates?.find(a=>a.suite_id===peer.suite_id && a.eligible && conditions.get(a.condition_id)?.kind==='baseline' && ['on','off'].includes(conditions.get(a.condition_id)?.reasoning_requested ?? '') && conditions.get(a.condition_id)?.reasoning_requested!==conditions.get(peer.condition_id)?.reasoning_requested);
    const band = packet.inputs.reader_context?.policy?.parameter_bands.find(b => b.id === peer.category?.band)?.label ?? peer.category?.band ?? 'Similar size';
    const memory = peer.category?.profile;
    const memoryType = ({system_ram:'system RAM',gpu_vram:'VRAM',unified_memory:'unified memory'} as Record<string,string>)[memory?.memory_type ?? ''] ?? memory?.memory_type ?? 'memory';
    const cohort = peer.kind === 'family' ? `${peer.category?.family} · Instruct versus reasoning checkpoint` : peer.kind === 'memory' ? `Verified within ${peer.category?.budget_gb ?? '?'} GB ${memoryType} · ${memory?.context_tokens ?? 'unspecified'} token context${memory?.other_memory_gb ? ` · plus ${memory.other_memory_gb} GB other memory` : ''}` : `${band} · ${peer.category?.architecture === 'moe' ? 'MoE (total parameters)' : peer.category?.architecture ?? 'same architecture'}`;
    const chart: PeerChart = {id:peer.id,title:suite?.name ?? 'Recorded test category',description:suite?.description ?? '',metric:suite?.metric ?? 'Average credit',metricExplanation:/f1/i.test(suite?.metric ?? '') ? 'Answer overlap with the reference answer; partial matches earn credit.' : suite?.metric_kind === 'binary' ? 'Share of tasks that passed the recorded checks.' : 'Average credit per task; partly correct results can earn partial credit.',mode:mode(peer.condition_id),cohort,date:comparisonEvidenceDate,binary,moe:peer.category?.architecture==='moe',stale:!!packet.peer_refresh_needed,
      uniformCoverage:rows.every(r=>r.scored===rows[0]!.scored && r.planned===rows[0]!.planned) ? `${rows[0]!.scored} of ${rows[0]!.planned} tasks scored for each model` : null,
      ceiling:rows.filter(r=>Math.abs(r.score-1)<1e-9).length>1,
      otherMode:other ? `Other mode, this model only: ${mode(other.condition_id).toLowerCase()} · ${scoreText(other.score,other.suite_id)}.` : undefined,
      rows:rows.map(r => {const delta=r.score-peer.subject_score;const taskDelta=delta*r.scored; return {...r,rank:1+rows.filter(other=>other.score>r.score+1e-9).length,tied:rows.filter(other=>Math.abs(other.score-r.score)<=1e-9).length>1,
        gap:r.subject ? 'This model' : Math.abs(delta)<=1e-9 ? 'Same score' : binary && r.scored===peer.subject_scored && Math.abs(taskDelta-Math.round(taskDelta))<1e-6 ? `${Math.abs(Math.round(taskDelta))} ${Math.abs(Math.round(taskDelta))===1 ? 'task' : 'tasks'} ${delta>0 ? 'more' : 'fewer'} passed` : `${Math.abs(delta*100).toFixed(1)} points ${delta>0 ? 'higher' : 'lower'}`};})};
    references[peer.id] = {id:peer.id,label:chart.title,detail:`${chart.mode}. ${cohort}. ${rows.filter(r=>Math.abs(r.score-peer.subject_score)<=1e-9).length>1 ? 'Tied at rank' : 'Rank'} ${rank} of ${rows.length} in this recorded comparison.`,chart};
  }
  if ([...used].some(id => !references[id])) throw new Error('Summary evidence reference is unavailable');
  const common = new Set(packet.inputs.shared_limitation_ids ?? (summary.content.output_schema_version===2 ? summary.content.shared_limitation_refs : []));
  const visibleLimitations = summary.content.output_schema_version === 2 ? summary.content.limitations.filter(c => c.evidence_refs.some(id => !common.has(id))) : summary.content.limitations;
  const modelMentions = (packet.inputs.reader_context?.records ?? []).flatMap(peer => peer.members)
    .filter(member => member.configuration_id !== summary.subject.configuration_id)
    .map(member => ({name:member.name,href:(edition ? archiveUrl(edition.releaseId,{checkpoint:member.checkpoint_id,configuration:member.configuration_id}) : `/models/${encodeURIComponent(member.slug)}/?${new URLSearchParams({configuration:member.configuration_id})}`)+'#model-analysis'}));
  return { summary, references, modelMentions, visibleLimitations, comparisonEvidenceDate, ...(packet.peer_refresh_needed ? {comparisonRefreshNeeded:true} : {}) };
}
