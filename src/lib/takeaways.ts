import { displayedMode, visibleCondition } from './reasoning';
import type { OverviewData } from './public-types';
import { BANDS, formatBytes, sizeBand } from './presentation';
import { comparisonUrl } from './comparison';
export const TAKEAWAY_POLICY = 'takeaways-v1';
export type Takeaway = { kind: 'quality' | 'compact' | 'thinking'; title: string; text: string; href: string; policy: string; template: string; factIds: string[]; cohortIds: string[]; cohort: string };
// Compare complete baseline setups under the same task bank and requested controls.
// Runtime differences remain whole-setup observations, not isolated weight effects.
export function takeaways(data: OverviewData, suiteId: string, mode: 'off' | 'on', releaseId: string): Takeaway[] {
  const suite = data.suites.find(s => s.id === suiteId);
  if (!suite) return [];
  const rows = data.checkpoints.flatMap(checkpoint => {
    const artifact = data.artifacts.find(a => a.id === checkpoint.baseline_artifact_id);
    const config = data.configurations.find(c => c.artifact_id === artifact?.id);
    const condition = data.conditions.find(c => c.configuration_id === config?.id && c.kind === 'baseline' && visibleCondition(c) && displayedMode(c) === mode);
    const fact = data.aggregates.find(a => a.configuration_id === config?.id && a.condition_id === condition?.id && a.suite_id === suiteId);
    if (!artifact || !config || !condition || !fact?.eligible || fact.score === null || config.compatibility !== 'known') return [];
    return [{ checkpoint, artifact, config, condition, fact }];
  });
  type Row = typeof rows[number];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const c = row.condition;
    const key = JSON.stringify([sizeBand(row.artifact.total_bytes), c.observed_reasoning, c.protocol_id, c.seed, c.temperature, c.max_tokens, c.thinking_tokens, c.reasoning_effort, c.agent_steps, c.agent_seconds, c.question_seconds]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const cohorts = [...groups.entries()].filter(([, rows]) => rows.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const out: Takeaway[] = [];
  const chosen = cohorts[0]?.[1];
  if (chosen) {
    const ordered = [...chosen].sort((a, b) => b.fact.score! - a.fact.score! || a.config.id.localeCompare(b.config.id));
    const best = ordered[0]!;
    const tied = ordered.filter(r => r.fact.score === best.fact.score);
    const band = BANDS.find(b => b.id === sizeBand(best.artifact.total_bytes))!.name;
    const cohort = `${band}; ${suite.name}; requested thinking ${mode}; ${chosen.length} complete baseline setups with matching test controls`;
    const factIds = tied.map(r => r.fact.id), cohortIds = chosen.map(r => r.fact.id).sort();
    const selections = (list: Row[]) => list.map(r => ({ configurationId: r.config.id, conditionId: r.condition.id }));
    const href = comparisonUrl({ releaseId, suiteId, selections: selections(ordered.slice(0, 2)) });
    const score = suite.metric_kind === 'binary' ? `${best.fact.full_credit}/${best.fact.scored} passed` : `${(best.fact.score! * 100).toFixed(1)}% ${suite.metric}`;
    out.push({ kind: 'quality', title: 'Highest observed score in this group',
      text: `${tied.map(r => r.checkpoint.name).join(', ')}${tied.length > 1 ? ' tied at' : ':'} ${score}. All ${best.fact.planned} planned questions scored.`,
      href, policy: TAKEAWAY_POLICY, template: 'quality-complete-ties', factIds, cohortIds, cohort });
    const smaller = chosen.filter(r => r.artifact.total_bytes !== null && best.artifact.total_bytes !== null && r.artifact.total_bytes < best.artifact.total_bytes)
      .sort((a, b) => a.artifact.total_bytes! - b.artifact.total_bytes! || b.fact.score! - a.fact.score! || a.config.id.localeCompare(b.config.id))[0];
    if (smaller) {
      const gap = suite.metric_kind === 'binary' ? `${best.fact.full_credit - smaller.fact.full_credit} fewer passed questions`
        : `${((best.fact.score! - smaller.fact.score!) * 100).toFixed(1)} percentage points less recorded credit`;
      out.push({ kind: 'compact', title: 'A smaller-file tradeoff',
        text: `${smaller.checkpoint.name}: ${formatBytes(smaller.artifact.total_bytes)} versus ${formatBytes(best.artifact.total_bytes)} for ${best.checkpoint.name}, with ${gap} on the same ${best.fact.planned} questions. File size is not a RAM requirement.`,
        href: comparisonUrl({ releaseId, suiteId, selections: selections([smaller, best]) }), policy: TAKEAWAY_POLICY,
        template: 'compact-complete-same-cohort', factIds: [smaller.fact.id, best.fact.id], cohortIds, cohort });
    }
  }
  const paired = data.comparisons.filter(p => rows.some(r => r.config.id === p.configuration_id) && p.suite_id === suiteId && p.verified && p.complete && p.timing_complete && p.off_condition_id && p.on_condition_id && p.delta_pp !== null && p.mean_added_s !== null)
    .sort((a, b) => a.configuration_id.localeCompare(b.configuration_id))[0];
  if (paired) {
    const row = rows.find(r => r.config.id === paired.configuration_id)!;
    const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
    out.push({ kind: 'thinking', title: 'A measured thinking tradeoff',
      text: `${row.checkpoint.name}: ${signed(paired.delta_pp!)} percentage points in paired credit and ${signed(paired.mean_added_s!)} seconds mean added task time. ${paired.improved} improved, ${paired.worsened} worsened, ${paired.unchanged} unchanged. ${paired.ceiling ? 'Both modes earned full credit on every matched question; no measured headroom on this set.' : 'Whether the change is worth the time depends on your task.'}`,
      href: comparisonUrl({ releaseId, suiteId, selections: [paired.off_condition_id!, paired.on_condition_id!].map(conditionId => ({ configurationId: paired.configuration_id, conditionId })) }),
      policy: TAKEAWAY_POLICY, template: 'thinking-complete-quality-time', factIds: [paired.id], cohortIds: [paired.id],
      cohort: `${suite.name}; ${paired.score_pairs}/${paired.planned_pairs} scored pairs and ${paired.time_pairs}/${paired.planned_pairs} timed pairs; verified control` });
  }
  return out;
}
