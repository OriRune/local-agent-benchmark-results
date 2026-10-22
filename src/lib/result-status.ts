import type { OverviewData } from './public-types';
import type { Aggregate, Configuration } from './public-contract';
export function hardwareLabel(config: Configuration): string {
  if (config.execution_kind === 'cloud') return `Cloud · ${config.cloud_provider ?? 'provider recorded in setup'}`;
  return config.hardware_id === 'desktop-32gb' ? 'Desktop · 32 GB RAM' : config.hardware_id === 'desktop-128gb' ? 'Desktop · 128 GB RAM' : 'Hardware profile: ' + (config.hardware_id ?? 'unrecorded');
}
export function resultStatus(config: Configuration, result?: Omit<Aggregate, 'trial_ids'>): string {
  if (config.status === 'withdrawn') return 'Withdrawn setup';
  if (!result) return 'Not scheduled for this selection';
  if (result.eligible) return 'Ready for comparison';
  const reasons: string[] = [];
  const s = result.states;
  if (result.outcome_counts) {
    const o=result.outcome_counts;
    if(o.technical_error) reasons.push(`${o.technical_error} technical / answer-channel errors`);
    if(o.untested) reasons.push(`${o.untested} untested or blocked`);
    if(o.review) reasons.push(`${o.review} awaiting review`);
    if(o.unresolved) reasons.push(`${o.unresolved} unresolved holds`);
  } else {
  if (s.infra_error) reasons.push(`${s.infra_error} technical error${s.infra_error === 1 ? '' : 's'}`);
  if (s.context_limit) reasons.push(`${s.context_limit} context limit${s.context_limit === 1 ? '' : 's'}`);
  if (s.review) reasons.push(`${s.review} unscored / held for review`);
  if (s.interrupted) reasons.push(`${s.interrupted} interrupted`);
  if (s.blocked) reasons.push(config.execution_kind === 'cloud' ? `${s.blocked} unscored cloud outcomes` : `${s.blocked} blocked`);
  if (s.pending) reasons.push(config.status === 'held' || config.status_reason?.includes('held') ? `${s.pending} held` : `${s.pending} not yet recorded`);
  if (s.not_scheduled) reasons.push(`${s.not_scheduled} not scheduled`);
  }
  if (result.ineligible_reasons.includes('incompatible_or_uncertain_cohort')) reasons.push('setup comparability unverified');
  if (result.ineligible_reasons.includes('unverified_reasoning_control')) reasons.push('thinking control unverified');
  return reasons.join(' · ') || 'Not eligible for ranking';
}

export function configurationLabel(data: OverviewData, config: Configuration): string {
  if (config.status === 'withdrawn') return 'Withdrawn';
  if (config.status === 'held' || config.status_reason?.includes('Integration check held')) return 'Held';
  const rows = data.aggregates.filter(a => a.configuration_id === config.id);
  if (rows.length && rows.every(a => a.eligible)) return 'Fully scored';
  if (rows.some(a => a.scored) && rows.every(a => !a.states.pending)) return 'Recorded · some results unscored or qualified';
  if (rows.some(a => a.scored)) return 'Partial coverage';
  return 'No scored results';
}
