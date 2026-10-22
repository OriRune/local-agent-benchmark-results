import type { OverviewData } from './public-types';
type Result = OverviewData['aggregates'][number];
type Suite = OverviewData['suites'][number];
export type QualityColumn = { id:string; suite:Suite; suiteIds:string[] };
export const QUALITY_INDEX_VERSION = 'balanced-categories-v1';
const FAMILIES=['basic','real_linux2','reasoning_gym','livebench','ifeval','squad2','drop','qasper','pushback'];
// Content/scorer equivalence reviewed in heatmap-inclusion-rating-20261021-v1.
// Immutable IDs only: a future changed question bank is not silently combined.
const INSTRUCTION_VERSIONS = ['ifeval-d2e088a636b3965f','ifeval-a08b1f61cf6ddde8'];
export function qualityColumns(data:OverviewData):QualityColumn[] {
  const original=data.suites.find(s=>s.id===INSTRUCTION_VERSIONS[0]);
  const newer=data.suites.find(s=>s.id===INSTRUCTION_VERSIONS[1]);
  const sourceIds=(s:Suite)=>data.questions.filter(q=>s.primary_question_ids.includes(q.id)).map(q=>q.source_id).sort().join('|');
  const equivalent=original&&newer&&original.scorer_revision===newer.scorer_revision&&original.metric_kind===newer.metric_kind&&original.scoring===newer.scoring&&sourceIds(original)===sourceIds(newer);
  return data.suites.filter(s=>!(equivalent&&s.id===newer.id)).map(s=>({id:s.id,suite:s,suiteIds:equivalent&&s.id===original.id?[...INSTRUCTION_VERSIONS]:[s.id]}));
}
export function columnResult(results:Result[],column:QualityColumn) {
  // Canonical version first when both are present; never select by score.
  return column.suiteIds.map(id=>results.find(r=>r.suite_id===id)).find(Boolean);
}
export function qualityIndex(data:OverviewData,results:Result[]) {
  const columns=qualityColumns(data);
  // This version has exactly one equally weighted contribution per task family.
  const policySupported=columns.length===9&&FAMILIES.every(f=>columns.some(c=>c.suite.family_id===f));
  let lower=0,upper=0,eligible=0,scored=0,planned=0;
  const categories=columns.map(column=>{
    const result=columnResult(results,column);
    const n=Math.max(column.suite.primary_question_ids.length,result?.planned??0,1);
    const count=result?.score!=null?Math.min(result.scored,n):0;
    const credit=(result?.score??0)*count;
    lower+=credit/n; upper+=(credit+n-count)/n; scored+=count; planned+=n;
    if(result?.eligible&&result.score!=null&&count===n)eligible++;
    return {column,result};
  });
  const complete=policySupported&&eligible===columns.length;
  return {version:QUALITY_INDEX_VERSION,policySupported,complete,score:complete?lower/columns.length:null,
    lower:lower/Math.max(1,columns.length),upper:upper/Math.max(1,columns.length),eligible,total:columns.length,scored,planned,categories};
}
export function indexLabel(index:ReturnType<typeof qualityIndex>) {
  if(!index.policySupported)return 'Not rated';
  if(index.complete)return (index.score!*100).toFixed(1);
  if(Math.abs(index.upper-index.lower)<1e-9)return `${(index.lower*100).toFixed(1)}*`;
  return `${Math.floor(index.lower*100+1e-9)}–${Math.ceil(index.upper*100-1e-9)}`;
}
