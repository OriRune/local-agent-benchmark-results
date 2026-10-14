/* Generated from contracts/v1/quant-summary.schema.json. Do not edit. */

export interface PublicCheckpointQuantSummaryV1 {
  quant_summary_version: 1;
  summary_type: "checkpoint_quant_comparison";
  summary_id: string;
  job_id: string;
  checkpoint_id: string;
  generator: {
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
  };
  generated_at: string;
  prompt: {
    version: string;
    sha256: string;
  };
  output_schema_sha256: string;
  evidence: {
    origin_dataset_revision_id: string;
    analysis_input_hash: string;
  };
  content: {
    output_schema_version: 1;
    synopsis: {
      text: string;
      /**
       * @minItems 1
       */
      group_ids: [string, ...string[]];
      /**
       * @minItems 2
       */
      artifact_ids: [string, string, ...string[]];
    };
    /**
     * @maxItems 3
     */
    observations:
      | []
      | [
          {
            text: string;
            /**
             * @minItems 1
             */
            group_ids: [string, ...string[]];
            /**
             * @minItems 2
             */
            artifact_ids: [string, string, ...string[]];
          }
        ]
      | [
          {
            text: string;
            /**
             * @minItems 1
             */
            group_ids: [string, ...string[]];
            /**
             * @minItems 2
             */
            artifact_ids: [string, string, ...string[]];
          },
          {
            text: string;
            /**
             * @minItems 1
             */
            group_ids: [string, ...string[]];
            /**
             * @minItems 2
             */
            artifact_ids: [string, string, ...string[]];
          }
        ]
      | [
          {
            text: string;
            /**
             * @minItems 1
             */
            group_ids: [string, ...string[]];
            /**
             * @minItems 2
             */
            artifact_ids: [string, string, ...string[]];
          },
          {
            text: string;
            /**
             * @minItems 1
             */
            group_ids: [string, ...string[]];
            /**
             * @minItems 2
             */
            artifact_ids: [string, string, ...string[]];
          },
          {
            text: string;
            /**
             * @minItems 1
             */
            group_ids: [string, ...string[]];
            /**
             * @minItems 2
             */
            artifact_ids: [string, string, ...string[]];
          }
        ];
  };
  validation: {
    status: "passed";
    validator_version: "quant-summary-validator-v1";
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
      };
}
