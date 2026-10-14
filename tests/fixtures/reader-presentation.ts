import type { PublicBenchmarkSummaryV1, ReaderClaim } from '../../src/lib/public-summary';
import type { SummaryPacket } from '../../src/lib/summary-view';

// Rendering-only fixture: no publication approval is performed.
export function readerFixture(base: PublicBenchmarkSummaryV1, source: SummaryPacket) {
  const summary = structuredClone(base), packet = structuredClone(source);
  const toReader = (claim: typeof base.content.verdict):ReaderClaim => ({...claim,comparison_refs:[]});
  const peerClaim:ReaderClaim = {...toReader(base.content.verdict),text:'Competitive on this reading task.',evidence_refs:['peer-test'],numeric_facts:[],comparison_refs:['peer-test']};
  summary.summary_schema_version=2;
  summary.content={output_schema_version:2,verdict:toReader(base.content.verdict),strengths:[],weaknesses:[],thinking_tradeoffs:[],limitations:[],peer_comparisons:[peerClaim,{...peerClaim}],shared_limitation_refs:[]};
  packet.inputs.subject={configuration:{name:'Subject <model>'}};
  packet.inputs.suites=[{id:'reading',name:'Research-paper answers',description:'Find answers in a research paper.',metric:'Answer token F1',metric_kind:'partial_credit'}];
  packet.inputs.conditions=[{id:'off',reasoning_requested:'off',kind:'baseline'}];
  packet.inputs.reader_context={policy:{parameter_bands:[{id:'medium',label:'Medium · 5–under 20B'}]},records:[{
    id:'peer-test',kind:'parameters',category:{band:'medium',architecture:'moe'},suite_id:'reading',condition_id:'off',rank:1,subject_score:.75,subject_scored:8,subject_planned:8,
    members:[{name:'Zero peer',configuration_id:'zero',condition_id:'zero-off',slug:'zero',checkpoint_id:'zero',score:0,scored:8,planned:8},
      {name:'Tied peer',configuration_id:'tied',condition_id:'tied-off',slug:'tied',checkpoint_id:'tied',score:.75,scored:8,planned:8}]
  }]};
  return {summary,packet};
}
