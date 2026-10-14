import { visibleCondition } from './reasoning';
import type { OverviewData } from './public-types';
import type { Selection } from './comparison';
import { categoryPolicy, parameterBand } from './categories.mjs';
import { sizeBand } from './presentation';

export type ModelView = Selection & { suiteId: string };
export function modelDefaults(data: OverviewData, checkpointId: string): ModelView {
  const checkpoint = data.checkpoints.find(c => c.id === checkpointId);
  if (!checkpoint) throw new Error('This model is unavailable.');
  const config = data.configurations.find(c => c.artifact_id === checkpoint.baseline_artifact_id)
    || data.configurations.find(c => data.artifacts.some(a => a.id === c.artifact_id && a.checkpoint_id === checkpointId));
  if (!config) throw new Error('No tested configuration is available for this model.');
  const condition = data.conditions.find(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c) && c.reasoning_requested === 'off')
    || data.conditions.find(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c))!;
  const suite = data.suites.find(s => s.family_id === 'basic') || data.suites[0];
  if (!condition || !suite) throw new Error('No baseline test selection is available for this model.');
  return { configurationId: config.id, conditionId: condition.id, suiteId: suite.id };
}
export function parseModelView(search: string, data: OverviewData, checkpointId: string): ModelView {
  const query = new URLSearchParams(search); const defaults = modelDefaults(data, checkpointId);
  for (const key of ['configuration', 'condition', 'suite']) if (query.getAll(key).length > 1) throw new Error('Duplicate model selection parameters.');
  const configurationId = query.get('configuration') || defaults.configurationId;
  const config = data.configurations.find(c => c.id === configurationId);
  if (!config || !data.artifacts.some(a => a.id === config.artifact_id && a.checkpoint_id === checkpointId)) throw new Error('This configuration does not belong to this model.');
  const conditionId = query.get('condition') || data.conditions.find(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c) && c.reasoning_requested === 'off')?.id || data.conditions.find(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c))?.id;
  if (!conditionId || !data.conditions.some(c => c.id === conditionId && c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c))) throw new Error('This baseline condition is unavailable for the selected configuration.');
  const suiteId = query.get('suite') || defaults.suiteId;
  if (!data.suites.some(s => s.id === suiteId)) throw new Error('This test version is unavailable.');
  return { configurationId, conditionId, suiteId };
}
export function modelViewQuery(view: ModelView): string {
  return new URLSearchParams({ configuration: view.configurationId, condition: view.conditionId, suite: view.suiteId }).toString();
}

export const SUGGESTION_POLICY = 'comparisons-v3';
export type Suggestion = { kind: 'weights' | 'thinking' | 'peer'; selection: Selection; reason: string; exploratory: boolean; factIds: string[]; cohortIds: string[]; policy: string; template: string };
export function modelSuggestions(data: OverviewData, view: ModelView): Suggestion[] {
  const config = data.configurations.find(c => c.id === view.configurationId)!;
  const artifact = data.artifacts.find(a => a.id === config.artifact_id)!;
  const condition = data.conditions.find(c => c.id === view.conditionId)!;
  const subject = data.aggregates.find(a => a.configuration_id === config.id && a.condition_id === condition.id && a.suite_id === view.suiteId);
  const candidates = data.aggregates.filter(a => a.suite_id === view.suiteId && a.configuration_id !== config.id).flatMap(aggregate => {
    const otherCondition = data.conditions.find(c => c.id === aggregate.condition_id)!;
    const otherConfig = data.configurations.find(c => c.id === aggregate.configuration_id)!;
    const otherArtifact = data.artifacts.find(a => a.id === otherConfig.artifact_id)!;
    const comparable = ['reasoning_requested', 'observed_reasoning', 'reasoning_effort', 'thinking_tokens', 'temperature', 'kind', 'protocol_id', 'seed', 'max_tokens', 'agent_steps', 'agent_seconds', 'question_seconds'] as const;
    if (comparable.some(key => condition[key] !== otherCondition[key])) return [];
    return [{ aggregate, config: otherConfig, artifact: otherArtifact, condition: otherCondition }];
  }).sort((a, b) => Number(b.aggregate.eligible) - Number(a.aggregate.eligible)
    || ((a.artifact.total_bytes !== null && artifact.total_bytes !== null ? Math.abs(a.artifact.total_bytes - artifact.total_bytes) : Infinity)
      - (b.artifact.total_bytes !== null && artifact.total_bytes !== null ? Math.abs(b.artifact.total_bytes - artifact.total_bytes) : Infinity) || 0)
    || a.config.id.localeCompare(b.config.id) || a.condition.id.localeCompare(b.condition.id));
  const checkpoint = data.checkpoints.find(c => c.id === artifact.checkpoint_id)!;
  const band = parameterBand(checkpoint,categoryPolicy(data));
  const parameterPeers = band && checkpoint.architecture !== 'unknown';
  const suggestions: Suggestion[] = [];
  for (const kind of ['weights', 'peer'] as const) {
    const cohort = candidates.filter(c => kind === 'weights'
      ? c.artifact.checkpoint_id === artifact.checkpoint_id && c.artifact.id !== artifact.id
      : c.artifact.checkpoint_id !== artifact.checkpoint_id && (parameterPeers ? data.checkpoints.some(p => p.id === c.artifact.checkpoint_id && p.architecture === checkpoint.architecture && parameterBand(p,categoryPolicy(data)) === band) : sizeBand(artifact.total_bytes) !== 'unknown' && sizeBand(c.artifact.total_bytes) === sizeBand(artifact.total_bytes)));
    const candidate = cohort[0]; if (!candidate) continue;
    suggestions.push({ kind, selection: { configurationId: candidate.config.id, conditionId: candidate.condition.id },
      reason: kind === 'weights' ? 'Another tested weight format of this checkpoint. Complete results first, then nearest download size.' : parameterPeers ? 'Another checkpoint in the same total-parameter band and architecture category, with matching task controls.' : 'Another checkpoint in the same download-size band. Complete results first, then nearest download size.',
      exploratory: !subject?.eligible || !candidate.aggregate.eligible,
      factIds: [subject?.id, candidate.aggregate.id].filter((x): x is string => Boolean(x)), cohortIds: cohort.map(c => c.aggregate.id), policy: SUGGESTION_POLICY, template: kind === 'weights' ? 'same-checkpoint-matching-controls' : parameterPeers ? 'same-parameter-architecture-matching-controls' : 'same-size-band-matching-controls' });
  }
  const paired = data.comparisons.find(p => p.configuration_id === config.id && p.suite_id === view.suiteId && p.verified && [p.off_condition_id, p.on_condition_id].includes(condition.id));
  const otherId = paired && (condition.id === paired.off_condition_id ? paired.on_condition_id : paired.off_condition_id);
  if (paired && otherId) suggestions.unshift({ kind: 'thinking', selection: { configurationId: config.id, conditionId: otherId }, reason: 'Verified requested on/off conditions of the same configuration, matched on the recorded test protocol.', exploratory: !paired.complete || !paired.timing_complete, factIds: [paired.id], cohortIds: [paired.id], policy: SUGGESTION_POLICY, template: 'verified-thinking-pair' });
  return suggestions;
}
