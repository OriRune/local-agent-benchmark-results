// Independent consumer-side check of the public interpretation, not raw regrading.
export function validateOutcomeAssessment(attempt) {
  const a=attempt.assessment;if(!a)return;
  if(a.policy_version!=='task-outcomes-v1')throw new Error('Unknown task outcome policy');
  const scored=['full_credit','partial_credit','incorrect','failed_to_finish'].includes(a.category);
  if(scored!==(attempt.status==='scored'))throw new Error('Outcome category/score mismatch');
  if(scored){
    const expected=attempt.score>=1-1e-9?'full_credit':attempt.score<=1e-9?'incorrect':'partial_credit';
    if(a.category==='failed_to_finish'?attempt.score!==0:a.category!==expected)throw new Error('Outcome credit mismatch');
  }
  validateScoringReview(attempt);
  if(a.recorded_status==='scored'&&attempt.score!==a.recorded_score&&!attempt.scoring_review)throw new Error('Saved numeric grade changed');
  if(a.recorded_status!=='scored'&&scored){
    if(!['saved_agent_checks','output_limit','context_limit_after_progress'].includes(a.reason))throw new Error('Unsupported derived credit');
    if(!a.evidence_sha256.length || attempt.score>0&&a.saved_agent_verdict!=='pass')throw new Error('Derived credit lacks saved evidence');
  }
}

// A score revision is a linked, separately identified grade of the same saved answer.
export function validateScoringReview(row, original, questionId) {
  const r=row.scoring_review;if(!r)return;
  if(!['drop-adjudication-v1','scoring-adjudication-v2'].includes(r.policy_version)||row.grader_revision!==r.policy_version||!row.correction_ids.includes(r.policy_version)||row.status!=='scored'||row.score!==r.reviewed_score||row.assessment.recorded_score!==r.original_score||row.assessment.reason!=='reviewed_scoring_correction'||!row.supersedes_attempt_ids.includes(r.source_attempt_id))throw new Error('Invalid scoring review provenance');
  if(original){
    if(original.canonical||original.status!=='scored'||original.id!==r.source_attempt_id||original.trial_id!==row.trial_id||original.score!==r.original_score)throw new Error('Scoring review differs from history');
    const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    for(const k of ['wall_s','usage','resources','started_at','finished_at','attempted','branches'])if(!equal(row[k],original[k]))throw new Error('Review changed execution evidence');
    for(const [k,v] of Object.entries(original.components))if(k!=='checks'&&!equal(row.components[k],v))throw new Error('Review changed saved answer evidence');
  }
  const originalReferences={'q-93852fae313a9aeb23584dc1':['76.8'],'q-5b245a7eff21636b3bbd2f15':['38'],'q-eb862890adce270f123932c0':['24']};
  const followupReferences={"q-e686b2b89840061edb47b5f1":["24"],"q-e27bbcb019a2dcd7911c6ccc":["24"],"q-bd66d8c91a7d5b73da946b22":["24"],"q-ad1a449bf4908d9321f99b45":["24"],"q-4d412c3735dc8a208d82c1b8":["24"],"q-c2548f192bf3ce05e981b3c7":["24"],"q-9460eec31aa0746daf786602":["BBBBB"],"q-607f5cc13ed44f0d9a577e6b":["DDDDD"],"q-8533f3020a353b905555039c":["104"],"q-9dc20a82cfffd8beaee15c04":["073"]};
  const references=r.policy_version==='drop-adjudication-v1'?originalReferences:followupReferences;
  if(questionId&&JSON.stringify(references[questionId])!==JSON.stringify(r.reviewed_reference))throw new Error('Review has no adjudicated reference');
}
