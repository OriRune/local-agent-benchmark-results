import type { PublicBenchmarkFactsV1, Aggregate, Comparison, Repetition, Question, Trial, Attempt, Object as EvidenceObject } from './public-contract';
export type TestDescription = { source_sha256:string; title?:string; description:string; generator:{model_id_requested:string;display_name_at_generation:string};generated_at:string;prompt:{version:string;sha256:string} };
export type TestDescriptions = {version:1;questions:Record<string,TestDescription>;suites:Record<string,TestDescription>};
export type OverviewData = Pick<PublicBenchmarkFactsV1, 'outcome_policy' | 'investigations' | 'context_followups' | 'category_policy' | 'memory_fits' | 'schema_version' | 'dataset_revision_id' | 'campaign_created_at' | 'checkpoints' | 'artifacts' | 'configurations' | 'conditions' | 'suites' | 'availability' | 'amendments'> & {
  search_objects?: Record<string, string>;
  test_descriptions?: TestDescriptions;
  aggregates: Omit<Aggregate, 'trial_ids'>[];
  comparisons: Omit<Comparison, 'pairs'>[];
  repetitions: Omit<Repetition, 'seeds_by_question'>[];
  questions: Pick<Question, 'id' | 'suite_id' | 'source_id' | 'title' | 'scoring_status'>[];
};
export type QuestionData = { question: Question; trials: Trial[]; attempts: Attempt[]; objects: EvidenceObject[] };
