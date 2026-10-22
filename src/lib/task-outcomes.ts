import type { Aggregate } from './public-contract';
export const outcomeLabels: Record<string,string> = {
  full_credit:'Full credit', partial_credit:'Partial credit', incorrect:'Incorrect',
  failed_to_finish:'Failed to finish', technical_error:'Technical error',
  untested:'Untested / blocked', review:'Needs review', unresolved:'Unresolved hold',
};
export const outcomeReasons: Record<string,string> = {
  reviewed_scoring_correction:'This score follows a versioned review of the saved answer. The original grade and evidence are retained.',
  recorded_grade:'The saved task checks determined this score.',
  step_limit:'The model reached the step limit without satisfying the task checks. This earns zero completion credit.',
  time_limit:'The model reached the time limit without satisfying the task checks. This earns zero completion credit.',
  context_limit:'The agent filled its allowed context without satisfying the task checks. This earns zero completion credit.',
  repeated_tool_loop:'The agent stopped after repeated tool actions without satisfying the task checks. This earns zero completion credit.',
  output_limit:'The model exhausted its output allowance without delivering a usable answer or passing the task checks. This earns zero completion credit.',
  context_limit_after_progress:'The agent began the task, then reached the test’s context boundary without passing the saved checks. This earns zero completion credit.',
  saved_agent_checks:'The saved task checks accepted the work produced before the run stopped. Credit is retained even without a final chat message.',
  ambiguous_answer_channel:'The provider ended the response without a usable final answer. The records do not establish a model failure, so this remains unscored.',
  context_guard_before_execution:'The harness blocked this input before the model began the task. This is untested, not an incorrect answer.',
  uncertain_context_guard:'A conservative harness guard stopped this run. The records do not establish that the model exhausted its usable context, so this remains unscored.',
  agent_checks_unavailable:'Saved task checks are insufficient to determine whether any completed work deserves credit. Review is needed.',
  recorded_infra_error:'A server or provider failure prevented a valid assessment. This remains unscored.',
  recorded_blocked:'Execution was blocked or deferred. This is not a measured model failure.',
  recorded_review:'The saved outcome requires review and remains unscored.',
  excluded_subjective_task:'This subjective task is excluded from published scores.',
};
export const outcomeSegments = (a: Pick<Aggregate,'outcome_counts'>) => a.outcome_counts ? [
  {key:'full',label:'Full credit',count:a.outcome_counts.full_credit},
  {key:'partial',label:'Partial credit',count:a.outcome_counts.partial_credit},
  {key:'incorrect',label:'Incorrect',count:a.outcome_counts.incorrect},
  {key:'unfinished',label:'Failed to finish',count:a.outcome_counts.failed_to_finish},
  {key:'unscored',label:'Technical / untested / held',count:a.outcome_counts.technical_error+a.outcome_counts.untested+a.outcome_counts.review+a.outcome_counts.unresolved},
] : [];
