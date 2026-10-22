/* Generated from contracts/v1/dataset.schema.json. Do not edit. */

export interface PublicBenchmarkFactsV1 {
  schema_version: 1;
  dataset_revision_id: string;
  export_version: string;
  aggregation_version: string;
  publication_policy_hash: string;
  protocol_id: string;
  campaign_created_at: string;
  source_snapshot_hash: string;
  checkpoints: Checkpoint[];
  artifacts: Artifact[];
  configurations: Configuration[];
  conditions: Condition[];
  suites: Suite[];
  questions: Question[];
  trials: Trial[];
  attempts: Attempt[];
  aggregates: Aggregate[];
  objects: Object[];
  amendments: Amendment[];
  availability: AvailabilityCount[];
  comparisons: Comparison[];
  repetitions: Repetition[];
  category_policy?: CategoryPolicy;
  memory_fits?: MemoryFit[];
  investigations?: Investigation[];
  context_followups?: ContextFollowup[];
  /**
   * @minItems 1
   */
  protocol_ids?: [string, ...string[]];
  outcome_policy?: {
    version: "task-outcomes-v1";
    description: string;
  };
}
export interface Checkpoint {
  id: string;
  slug: string;
  name: string;
  family: string | null;
  upstream: Source | null;
  architecture: "dense" | "moe" | "unknown";
  parameters: Parameters;
  baseline_artifact_id: string;
  baseline_rule: string;
}
export interface Source {
  name: string;
  item: string | null;
  revision: string | null;
  url: string | null;
  terms_url: string | null;
  attribution: string | null;
}
export interface Parameters {
  total_billions: number | null;
  active_billions: number | null;
  effective_billions: number | null;
  provenance: string | null;
}
export interface Artifact {
  id: string;
  checkpoint_id: string;
  quantization: string;
  publisher: string | null;
  repository: string | null;
  revision: string | null;
  files: WeightFile[];
  total_bytes: number | null;
  template_id: string | null;
  provenance_status: "verified" | "recorded_source" | "legacy_partial" | "unresolved";
}
export interface WeightFile {
  name: string;
  bytes: number | null;
  hash_type: ("sha256" | "header_1m_sha256") | null;
  hash_value: string | null;
  url: string | null;
}
export interface Configuration {
  id: string;
  artifact_id: string;
  name: string;
  execution_kind?: "local" | "cloud";
  speed_eligible?: boolean;
  cloud_provider?: string;
  upstream_model?: string;
  execution_protocol?: string;
  runtime: string | null;
  runtime_build: string | null;
  template_override_id: string | null;
  tool_adapter: string | null;
  hardware_id: string | null;
  concurrency: number | null;
  intended: Placement;
  observed: Placement;
  compatibility: "known" | "uncertain";
  status: "completed" | "partial" | "pending" | "withdrawn" | "held";
  status_reason: string | null;
}
export interface Placement {
  context: number | null;
  gpu_layers: number | null;
  cpu_moe_layers: number | null;
  threads: number | null;
}
export interface Condition {
  id: string;
  configuration_id: string;
  reasoning_requested: "on" | "off";
  reasoning_effort: string | null;
  verification:
    | "verified"
    | "cannot_disable"
    | "ignored_switch"
    | "no_reasoning_observed"
    | "inconclusive"
    | "unknown"
    | "native_reasoning";
  probe_version: string | null;
  verification_scope: string | null;
  temperature: number | null;
  seed: number;
  kind: "baseline" | "repeat";
  max_tokens: number | null;
  thinking_tokens: number | null;
  agent_steps: number | null;
  agent_seconds: number | null;
  question_seconds: number | null;
  protocol_id: string;
  observed_reasoning?: "enabled" | "unobserved";
  presentation_included?: boolean;
}
export interface Suite {
  id: string;
  family_id: string;
  name: string;
  description: string;
  group: "coding" | "reasoning" | "instructions" | "reading" | "corrections";
  metric: string;
  metric_kind: "binary" | "partial_credit";
  scoring: string;
  source: Source;
  selection_revision: string;
  scorer_revision: string;
  question_ids: string[];
  primary_question_ids: string[];
  exclusions: Exclusion[];
}
export interface Exclusion {
  question_id: string;
  reason: string;
}
export interface Question {
  id: string;
  suite_id: string;
  source_id: string;
  title: string;
  components: Components;
  branches: Branch[];
  source: Source;
  scoring_status: "primary" | "excluded" | "review";
}
export interface Components {
  prompt: Component;
  context: Component;
  reference: Component;
  checks: Component;
  input: Component;
  answer: Component;
  reasoning: Component;
  tools: Component;
  artifacts: Component;
}
export interface Component {
  availability: "full" | "redacted" | "source_link_only" | "not_recorded" | "withheld";
  reason: string | null;
  origin: "captured" | "frozen_definition" | "derived" | "not_recorded";
  object_ids: string[];
  source: Source | null;
  redaction_rule_ids: string[];
}
export interface Branch {
  id: string;
  name: string;
  prompt: Component;
  answer: Component;
  reference: Component;
}
export interface Trial {
  id: string;
  configuration_id: string;
  condition_id: string;
  suite_id: string;
  question_id: string;
  seed: number;
  kind: "baseline" | "repeat";
  pair_key: string;
  primary: boolean;
}
export interface Attempt {
  id: string;
  trial_id: string;
  status:
    "scored" | "blocked" | "review" | "infra_error" | "context_limit" | "interrupted" | "pending" | "not_scheduled";
  score: number | null;
  canonical: boolean;
  attempted: boolean | null;
  grader_revision: string;
  started_at: string | null;
  finished_at: string | null;
  wall_s: number | null;
  usage: Usage;
  resources: Resources;
  components: Components;
  branches: Branch[];
  supersedes_attempt_ids: string[];
  correction_ids: string[];
  outcome_reason: string | null;
  assessment?: Assessment;
  scoring_review?: ScoringReview;
}
export interface Usage {
  generated_tokens: number | null;
  generation_s: number | null;
  prefill_s: number | null;
  truncated_turns: number | null;
}
export interface Resources {
  process_rss_bytes: number | null;
  device_vram_used_bytes: number | null;
  available_ram_bytes: number | null;
  method: string;
}
export interface Assessment {
  policy_version: "task-outcomes-v1";
  category:
    | "full_credit"
    | "partial_credit"
    | "incorrect"
    | "failed_to_finish"
    | "technical_error"
    | "untested"
    | "review"
    | "unresolved";
  reason: string;
  recorded_status: string;
  recorded_score: number | null;
  /**
   * @minItems 1
   */
  evidence_sha256: [string, ...string[]];
  saved_agent_verdict: "pass" | "fail" | "review" | null;
}
export interface ScoringReview {
  policy_version: "drop-adjudication-v1" | "scoring-adjudication-v2";
  source_attempt_id: string;
  original_score: number;
  reviewed_score: number;
  reason: string;
  /**
   * @minItems 1
   */
  reviewed_reference: [string, ...string[]];
  decision_sha256: string;
}
export interface Aggregate {
  id: string;
  configuration_id: string;
  condition_id: string;
  suite_id: string;
  trial_ids: string[];
  planned: number;
  scored: number;
  states: States;
  score: number | null;
  eligible: boolean;
  ineligible_reasons: string[];
  full_credit: number;
  partial_credit: number;
  zero_credit: number;
  median_task_s: number | null;
  timed: number;
  generated_tokens_per_s: number | null;
  outcome_counts?: OutcomeCounts;
}
export interface States {
  scored: number;
  blocked: number;
  review: number;
  infra_error: number;
  context_limit: number;
  interrupted: number;
  pending: number;
  not_scheduled: number;
}
export interface OutcomeCounts {
  full_credit: number;
  partial_credit: number;
  incorrect: number;
  failed_to_finish: number;
  technical_error: number;
  untested: number;
  review: number;
  unresolved: number;
}
export interface Object {
  id: string;
  path: string;
  media_type: "application/json" | "text/plain";
  bytes: number;
  availability: "full" | "redacted";
  encoding: "identity" | "gzip";
}
export interface Amendment {
  id: string;
  kind: "roster" | "exclusion" | "correction" | "recovery" | "availability";
  description: string;
}
export interface AvailabilityCount {
  suite_id: string;
  component: string;
  availability: "full" | "redacted" | "source_link_only" | "not_recorded" | "withheld";
  count: number;
}
export interface Comparison {
  id: string;
  configuration_id: string;
  suite_id: string;
  off_condition_id: string | null;
  on_condition_id: string | null;
  verified: boolean;
  score_pairs: number;
  time_pairs: number;
  planned_pairs: number;
  improved: number;
  worsened: number;
  unchanged: number;
  complete: boolean;
  timing_complete: boolean;
  ceiling: boolean;
  off_score: number | null;
  on_score: number | null;
  delta_pp: number | null;
  mean_off_s: number | null;
  mean_on_s: number | null;
  mean_added_s: number | null;
  median_off_s: number | null;
  median_on_s: number | null;
  median_paired_delta_s: number | null;
  total_added_s: number | null;
  ratio_summed_time: number | null;
  pairs: PairItem[];
}
export interface PairItem {
  pair_key: string;
  off_trial_id: string;
  on_trial_id: string;
  off_score: number;
  on_score: number;
  off_s: number | null;
  on_s: number | null;
}
export interface Repetition {
  id: string;
  configuration_id: string;
  suite_id: string;
  condition_ids: string[];
  reasoning_requested: "on" | "off";
  temperature: number | null;
  allowed: boolean;
  full_credit_repetitions: number;
  planned_repetitions: number;
  scored_repetitions: number;
  planned_questions: number;
  complete_questions: number;
  all_repeats_full_credit: number;
  seeds_by_question: RepeatSeeds[];
}
export interface RepeatSeeds {
  question_id: string;
  seeds: number[];
}
export interface CategoryPolicy {
  version: string;
  /**
   * @minItems 1
   */
  parameter_bands: [
    {
      id: string;
      label: string;
      min_billions: number;
      max_billions: number | null;
    },
    ...{
      id: string;
      label: string;
      min_billions: number;
      max_billions: number | null;
    }[]
  ];
  /**
   * @minItems 1
   */
  memory_budgets_gb: [number, ...number[]];
  memory_unit: "decimal GB";
  minimum_peer_checkpoints: number;
  baseline_rule: string;
}
export interface MemoryFit {
  id: string;
  configuration_id: string;
  status: "verified" | "estimated";
  budget_gb: number;
  memory_type: "system_ram" | "gpu_vram" | "unified_memory";
  profile: {
    runtime: string;
    runtime_build: string;
    context_tokens: number;
    gpu_layers: number;
    concurrency: number;
    other_memory_gb: number;
  };
  headroom_gb: number;
  method: string;
  evidence_ref: string;
  observed_at: string;
}
export interface Investigation {
  id: string;
  configuration_id: string;
  text: string;
  source_sha256: string;
  kind: string;
}
export interface ContextFollowup {
  trial_id: string;
  attempt_id: string;
  configuration_id: string;
  outcome:
    "answered" | "awaiting_review" | "failed_to_answer_context_limit" | "technical_error" | "blocked" | "pending";
  completion_credit: null | 0;
  source_sha256: string;
}
