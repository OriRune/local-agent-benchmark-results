/* Generated from contracts/v1/release.schema.json. Do not edit. */

export interface PublicResultsReleaseV1 {
  schema_version: 1;
  release_id: string;
  dataset_revision_id: string;
  dataset_object_id: string;
  index_object_id: string;
  model_objects: {
    [k: string]: string;
  };
  question_objects: {
    [k: string]: string;
  };
  summary_objects: {
    id: string;
    object_id: string;
    configuration_id: string;
    facts_object_id: string;
  }[];
  objects: Object[];
  contract_sha256: string;
  display_policy_version: string;
  changes: {
    previous_release_id: string | null;
    description: string;
    amendments: Amendment[];
    summary_generator_changes: string[];
  };
  quant_summary_objects?: {
    id: string;
    checkpoint_id: string;
    object_id: string;
    facts_object_id: string;
  }[];
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
