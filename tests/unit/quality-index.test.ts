import {expect,it} from 'vitest';
import type {OverviewData} from '../../src/lib/public-types';
import {qualityColumns,qualityIndex,indexLabel} from '../../src/lib/quality-index';
import {heatmapRows} from '../../src/lib/heatmap';

const families=['basic','real_linux2','reasoning_gym','livebench','ifeval','squad2','drop','qasper','pushback'];
const fixture=()=>({suites:families.map(f=>({id:f,family_id:f,primary_question_ids:[f+'-1',f+'-2']})),questions:[],aggregates:families.map(f=>({suite_id:f,configuration_id:'config',condition_id:'condition',planned:2,scored:2,score:.5,eligible:true}))}) as unknown as OverviewData;
it('weights categories equally, independent of question count or roster additions',()=>{
 const d=fixture();d.suites[0]!.primary_question_ids=Array.from({length:100},(_,i)=>'q'+i);Object.assign(d.aggregates[0]!,{planned:100,scored:100,score:1});
 const index=qualityIndex(d,d.aggregates);expect(index.score).toBeCloseTo(5/9);expect(index.complete).toBe(true);
 expect(qualityIndex({...d,checkpoints:[{id:'new'}]} as OverviewData,d.aggregates).score).toBe(index.score);
});
it('bounds unscored tasks without treating them as failures or ranking the preview',()=>{
 const d=fixture();Object.assign(d.aggregates[0]!,{scored:1,score:1,eligible:false});
 const index=qualityIndex(d,d.aggregates);expect(index.score).toBeNull();expect(index.lower).toBeCloseTo(.5);expect(index.upper).toBeCloseTo(5/9);expect(indexLabel(index)).toBe('50–56');
 const missing=qualityIndex(d,[]);expect(indexLabel(missing)).toBe('0–100');expect(missing.eligible).toBe(0);
});
it('keeps fully scored qualifications unranked and rejects unreviewed category revisions',()=>{
 const d=fixture();d.aggregates[0]!.eligible=false;expect(indexLabel(qualityIndex(d,d.aggregates))).toBe('50.0*');expect(qualityIndex(d,d.aggregates).score).toBeNull();
 d.suites.push({...d.suites[0]!,id:'new-revision'});expect(qualityIndex(d,d.aggregates).policySupported).toBe(false);
});
it('combines only reviewed equivalent instruction IDs, preserving exact result references',()=>{
 const d=fixture();const original={...d.suites[4]!,id:'ifeval-d2e088a636b3965f',scorer_revision:'same',metric_kind:'binary',scoring:'same'};const newer={...original,id:'ifeval-a08b1f61cf6ddde8',primary_question_ids:['other-1','other-2']};
 d.suites[4]=original as typeof d.suites[number];d.suites.push(newer as typeof d.suites[number]);d.questions=[{id:'ifeval-1',source_id:'one'},{id:'ifeval-2',source_id:'two'},{id:'other-1',source_id:'one'},{id:'other-2',source_id:'two'}] as typeof d.questions;
 d.aggregates[4]!.suite_id=newer.id;expect(qualityColumns(d)).toHaveLength(9);const index=qualityIndex(d,d.aggregates);expect(index.complete).toBe(true);expect(index.categories[4]!.result?.suite_id).toBe(newer.id);
 newer.scorer_revision='changed';expect(qualityColumns(d)).toHaveLength(10);
});
it('all-modes discovery includes native cloud conditions without creating an off condition',()=>{
 const d={checkpoints:[{id:'cloud',name:'Cloud',baseline_artifact_id:'weights'}],artifacts:[{id:'weights',checkpoint_id:'cloud'}],configurations:[{id:'config',artifact_id:'weights'}],conditions:[{id:'native',configuration_id:'config',kind:'baseline',reasoning_requested:'on',verification:'native_reasoning'}],aggregates:[{configuration_id:'config',condition_id:'native',scored:1,planned:1,score:0.5,eligible:true}]} as unknown as OverviewData;
 expect(heatmapRows(d,'off')).toHaveLength(0);expect(heatmapRows(d,'all')).toHaveLength(1);expect(heatmapRows(d,'all')[0]!.condition.reasoning_requested).toBe('on');
});
