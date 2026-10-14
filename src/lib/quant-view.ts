import type { PublicBenchmarkFactsV1 } from './public-contract';
import type { PublicCheckpointQuantSummaryV1 } from './public-quant-summary';
export type QuantRow = {artifact_id:string;configuration_id:string;condition_id:string;aggregate_id:string;score:number;planned:number;scored:number;full_credit:number;timed:number;median_task_s:number|null};
export type QuantGroup = {id:string;suite_id:string;controls:{reasoning_requested:string;observed_reasoning?:string|null};execution:{runtime:string;observed:{context:number}};rows:QuantRow[];timing_comparable:boolean;causal_quant_effect_verified:false};
export type QuantPacket = {quant_facts_version:1;checkpoint_id:string;origin_dataset_revision_id:string;analysis_input_hash:string;eligible:boolean;inputs:{policy:string;checkpoint:PublicBenchmarkFactsV1['checkpoints'][number];artifacts:PublicBenchmarkFactsV1['artifacts'];configurations:PublicBenchmarkFactsV1['configurations'];suites:PublicBenchmarkFactsV1['suites'];groups:QuantGroup[];limitations:string[]}};
export type QuantView = {summary:PublicCheckpointQuantSummaryV1;packet:QuantPacket};
