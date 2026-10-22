import {describe,it,expect} from 'vitest';
import {outcomeSegments} from '../../src/lib/task-outcomes';
import {outcomeText} from '../../src/components/QuestionMatrix';
import {validateOutcomeAssessment,validateScoringReview} from '../../scripts/task-outcomes.mjs';

describe('published task outcomes',()=>{
 it('separates failure to finish from an incorrect answer',()=>{
  expect(outcomeText({status:'scored',credit:'zero',category:'failed_to_finish'})).toBe('Failed to finish');
  expect(outcomeText({status:'scored',credit:'zero',category:'incorrect'})).toBe('Incorrect');
  expect(outcomeText({status:'scored',credit:'zero'})).toBe('○ Zero credit');
 });
 it('counts all tasks and keeps held outcomes distinct from scored failure',()=>{
  const segments=outcomeSegments({outcome_counts:{full_credit:6,partial_credit:2,incorrect:1,failed_to_finish:3,technical_error:1,untested:2,review:1,unresolved:1}});
  expect(segments.map(s=>s.count)).toEqual([6,2,1,3,5]);
  expect(segments.reduce((n,s)=>n+s.count,0)).toBe(17);
  expect(outcomeSegments({})).toEqual([]);
 });
 it('rejects invented credit or relabeling an unscored technical result as a scored failure',()=>{
  const assessment={policy_version:'task-outcomes-v1',category:'failed_to_finish',reason:'output_limit',recorded_status:'no_answer',recorded_score:null,evidence_sha256:['a'.repeat(64)],saved_agent_verdict:null};
  expect(()=>validateOutcomeAssessment({status:'scored',score:0,assessment})).not.toThrow();
  expect(()=>validateOutcomeAssessment({status:'blocked',score:null,assessment})).toThrow();
  expect(()=>validateOutcomeAssessment({status:'scored',score:1,assessment})).toThrow();
 });
 it('preserves a saved passing artifact check without requiring a final message',()=>{
  expect(()=>validateOutcomeAssessment({status:'scored',score:1,assessment:{policy_version:'task-outcomes-v1',category:'full_credit',reason:'saved_agent_checks',recorded_status:'context_hold',recorded_score:null,evidence_sha256:['a'.repeat(64)],saved_agent_verdict:'pass'}})).not.toThrow();
 });
 it('binds v2 reviewed references to their exact question and adjudication policy',()=>{
  const reviewed=(policy:string,reference:string)=>({status:'scored',score:1,grader_revision:policy,correction_ids:[policy],supersedes_attempt_ids:['attempt-original'],assessment:{recorded_score:0,reason:'reviewed_scoring_correction'},scoring_review:{policy_version:policy,original_score:0,reviewed_score:1,source_attempt_id:'attempt-original',reviewed_reference:[reference]}});
  for(const [question,reference] of [['q-e686b2b89840061edb47b5f1','24'],['q-9460eec31aa0746daf786602','BBBBB'],['q-607f5cc13ed44f0d9a577e6b','DDDDD'],['q-8533f3020a353b905555039c','104'],['q-9dc20a82cfffd8beaee15c04','073']]) {
   expect(()=>validateScoringReview(reviewed('scoring-adjudication-v2',reference!),undefined,question)).not.toThrow();
   expect(()=>validateScoringReview(reviewed('drop-adjudication-v1',reference!),undefined,question)).toThrow('no adjudicated reference');
  }
  expect(()=>validateScoringReview(reviewed('scoring-adjudication-v2','DDDDD'),undefined,'q-9460eec31aa0746daf786602')).toThrow('no adjudicated reference');
  expect(()=>validateScoringReview(reviewed('scoring-adjudication-v2','73'),undefined,'q-9dc20a82cfffd8beaee15c04')).toThrow('no adjudicated reference');
  expect(()=>validateScoringReview(reviewed('scoring-adjudication-v2','76.8'),undefined,'q-93852fae313a9aeb23584dc1')).toThrow('no adjudicated reference');
  expect(()=>validateScoringReview(reviewed('drop-adjudication-v1','76.8'),undefined,'q-93852fae313a9aeb23584dc1')).not.toThrow();
 });
});
