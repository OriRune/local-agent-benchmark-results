/* Generated from contracts/v1/summary.schema.json. Do not edit. */

export type PublicBenchmarkSummaryV1 = {
  summary_schema_version: 1 | 2;
  summary_id: string;
  job_id: string;
  subject: {
    checkpoint_id: string;
    configuration_id: string;
  };
  generator: Generator;
  generated_at: string;
  prompt: Prompt;
  output_schema_sha256: string;
  evidence: {
    origin_dataset_revision_id: string;
    analysis_input_hash: string;
    selection_policy_version: string;
  };
  content:
    | {
        output_schema_version: 1;
        verdict: Claim;
        strengths: Claim[];
        weaknesses: Claim[];
        thinking_tradeoffs: Claim[];
        limitations: Claim[];
      }
    | {
        output_schema_version: 2;
        verdict: ReaderClaim;
        /**
         * @maxItems 3
         */
        strengths: [] | [ReaderClaim] | [ReaderClaim, ReaderClaim] | [ReaderClaim, ReaderClaim, ReaderClaim];
        /**
         * @maxItems 3
         */
        weaknesses: [] | [ReaderClaim] | [ReaderClaim, ReaderClaim] | [ReaderClaim, ReaderClaim, ReaderClaim];
        /**
         * @maxItems 3
         */
        thinking_tradeoffs: [] | [ReaderClaim] | [ReaderClaim, ReaderClaim] | [ReaderClaim, ReaderClaim, ReaderClaim];
        /**
         * @maxItems 3
         */
        limitations: [] | [ReaderClaim] | [ReaderClaim, ReaderClaim] | [ReaderClaim, ReaderClaim, ReaderClaim];
        /**
         * @maxItems 2
         */
        peer_comparisons: [] | [ReaderClaim] | [ReaderClaim, ReaderClaim];
        shared_limitation_refs: string[];
      };
  validation: {
    status: "passed";
    validator_version: string;
    semantic_review_required: true;
    claims: number;
  };
  editorial:
    | {
        state: "draft";
        reviewed_at: null;
        edited: false;
        supersedes_summary_id: null;
      }
    | {
        state: "approved";
        reviewed_at: string;
        reviewer_kind: "human";
        edited: boolean;
        supersedes_summary_id: string;
        edit_author?: string;
      }
    | {
        state: "approved";
        reviewed_at: string;
        reviewer_kind: "agent";
        edited: boolean;
        supersedes_summary_id: string | null;
        edit_author?: string;
        reviewer_name: string;
        publication_authorization: {
          authorized_by: "user";
          authorized_at: string;
          instruction: string;
        };
      };
  provenance: {
    stage:
      | "direct"
      | "suite_analysis"
      | "example_analysis"
      | "evidence_segment"
      | "suite_synthesis"
      | "subject_synthesis"
      | "intermediate_synthesis";
    input_summary_ids: string[];
    contributors: {
      summary_id: string;
      job_id: string;
      configuration_id: string;
      generator: Generator;
      generated_at: string;
      prompt: Prompt;
      analysis_input_hash: string;
      stage:
        | "direct"
        | "suite_analysis"
        | "example_analysis"
        | "evidence_segment"
        | "suite_synthesis"
        | "subject_synthesis"
        | "intermediate_synthesis";
      input_summary_ids: string[];
    }[];
  };
  output_reference_encoding: "canonical-v1" | "local-references-v1";
  editorial_basis?: {
    source_summary_id: string;
    source_analysis_input_hash: string;
    source_dataset_revision_id: string;
    review_dataset_revision_id: string;
    proposal_sha256: string;
    edit_author: "Codex";
  };
  failed_response_editorial?: {
    source_job_id: string;
    source_input_sha256: string;
    source_state_sha256: string;
    source_receipt_sha256: string;
    original_content_sha256: string;
    source_status: "claims_failed";
    source_validation_errors: string;
    correction_kind: "foreign_condition_ids_only";
    editor: "Codex";
    /**
     * @minItems 1
     */
    changes: [
      {
        claim_path: string;
        original_condition_ids: string[];
        corrected_condition_ids: string[];
      },
      ...{
        claim_path: string;
        original_condition_ids: string[];
        corrected_condition_ids: string[];
      }[]
    ];
  };
};

export interface Generator {
  provider: "openai";
  display_name_at_generation: string;
  model_id_requested: string;
  model_id_returned: string | null;
  snapshot_id: string | null;
  identity_resolution: "requested_only" | "provider_reported_alias";
  provider_fingerprint: string | null;
  reasoning_effort_requested: string;
  settings: {
    reasoning_effort: string;
    max_input_tokens: number;
    max_output_tokens: number;
    tools_enabled: false;
    store_responses: false | null;
    truncation: "disabled" | "client_input_unchanged";
    request_timeout_seconds: number;
    max_transport_retries: number;
    execution?: {
      transport: "codex_exec";
      authentication: "chatgpt";
      cli_version: string;
      output_limit_enforcement: "post_completion";
      sandbox: "read-only";
      ephemeral: true;
      request_unit: "cli_invocation";
      provider_retries: "cli_managed";
    };
  };
  settings_sha256: string;
  sdk_version: string;
  policy_revision: string;
}
export interface Prompt {
  version: string;
  sha256: string;
}
export interface Claim {
  text: string;
  scope: "measured_fact" | "reviewed_examples" | "limitation";
  configuration_id: string;
  condition_ids: string[];
  evidence_refs: string[];
  numeric_facts: NumericFact[];
  illustration: boolean;
}
export interface NumericFact {
  fact_id: string;
  metric: string;
  value: number | null;
  unit: string;
}
export interface ReaderClaim {
  text: string;
  scope: "measured_fact" | "reviewed_examples" | "limitation" | "peer_comparison";
  configuration_id: string;
  condition_ids: string[];
  evidence_refs: string[];
  numeric_facts: ReaderNumericFact[];
  illustration: boolean;
  comparison_refs: string[];
}
export interface ReaderNumericFact {
  fact_id: string;
  metric: string;
  value: number | null;
  unit: string;
}
