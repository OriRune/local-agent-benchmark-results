import type { OverviewData } from './public-types';
// Quoting alone does not prevent spreadsheet formulas. Escape textual metadata
// only; numeric measurements keep their original signed numeric representation.
export function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value);
  if (typeof value === 'string' && (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function aggregateCsv(data: OverviewData, releaseId: string): string {
  const header = ['release_id', 'dataset_revision_id', 'fact_id', 'checkpoint', 'configuration_id', 'configuration', 'runtime', 'quantization', 'weight_bytes', 'suite_id', 'suite', 'metric', 'metric_kind', 'condition_id', 'thinking_requested', 'thinking_verification', 'planned', 'scored', 'score_0_to_1', 'eligible', 'ineligible_reasons', 'full_credit', 'partial_credit', 'zero_credit', 'median_task_seconds', 'timed', 'generated_tokens_per_second', 'outcome_counts', 'observed_reasoning'];
  const rows = data.aggregates.map(fact => {
    const config = data.configurations.find(c => c.id === fact.configuration_id)!;
    const artifact = data.artifacts.find(a => a.id === config.artifact_id)!;
    const checkpoint = data.checkpoints.find(c => c.id === artifact.checkpoint_id)!;
    const condition = data.conditions.find(c => c.id === fact.condition_id)!;
    const suite = data.suites.find(s => s.id === fact.suite_id)!;
    return [releaseId, data.dataset_revision_id, fact.id, checkpoint.name, config.id, config.name, config.runtime, artifact.quantization, artifact.total_bytes,
      suite.id, suite.name, suite.metric, suite.metric_kind, condition.id, condition.reasoning_requested, condition.verification,
      fact.planned, fact.scored, fact.score, fact.eligible, fact.ineligible_reasons.join('; '), fact.full_credit, fact.partial_credit, fact.zero_credit,
      fact.median_task_s, fact.timed, fact.generated_tokens_per_s, JSON.stringify(fact.states), condition.observed_reasoning ?? null];
  });
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
