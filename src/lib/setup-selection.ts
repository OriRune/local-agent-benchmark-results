import type { OverviewData } from './public-types';
import { displayedMode, visibleCondition } from './reasoning';
/** Coverage policy, never a quality/speed optimization. A declared baseline wins ties. */
export function setupCandidates(data: OverviewData, checkpointId: string, suiteId: string, mode?: string) {
  const checkpoint = data.checkpoints.find(c => c.id === checkpointId)!;
  const artifacts = data.artifacts.filter(a => a.checkpoint_id === checkpointId);
  return data.configurations.flatMap(config => {
    const artifact = artifacts.find(a => a.id === config.artifact_id);
    if (!artifact) return [];
    return data.conditions.filter(c => c.configuration_id === config.id && c.kind === 'baseline' && visibleCondition(c) && (!mode || mode === 'all' || displayedMode(c) === mode)).flatMap(condition => {
      const result = data.aggregates.find(a => a.configuration_id === config.id && a.condition_id === condition.id && a.suite_id === suiteId);
      return result ? [{ config, artifact, condition, result }] : [];
    });
  }).sort((a,b) => Number(a.config.status === 'withdrawn')-Number(b.config.status === 'withdrawn')
    || Number(b.result.eligible)-Number(a.result.eligible)
    || b.result.scored/Math.max(1,b.result.planned)-a.result.scored/Math.max(1,a.result.planned)
    || Number(b.artifact.id === checkpoint.baseline_artifact_id)-Number(a.artifact.id === checkpoint.baseline_artifact_id)
    || Number(b.config.compatibility === 'known')-Number(a.config.compatibility === 'known')
    || a.config.id.localeCompare(b.config.id) || a.condition.id.localeCompare(b.condition.id));
}
