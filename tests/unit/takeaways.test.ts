import { expect, it } from 'vitest';
import type { OverviewData } from '../../src/lib/public-types';
import { takeaways } from '../../src/lib/takeaways';
function fixture(): OverviewData {
  const ids = ['small', 'best', 'tied', 'preview', 'foreign'];
  return {
    checkpoints: ids.map(id => ({ id, name: id, baseline_artifact_id: id })),
    artifacts: ids.map((id, i) => ({ id, checkpoint_id: id, total_bytes: (4 + i / 10) * 1e9 })),
    configurations: ids.map(id => ({ id, artifact_id: id, compatibility: 'known' })),
    conditions: ids.map(id => ({ id: id + '-off', configuration_id: id, kind: 'baseline', reasoning_requested: 'off', protocol_id: id === 'foreign' ? 'other' : 'same', seed: 42, temperature: 0, max_tokens: 100, agent_steps: 10, agent_seconds: 100, question_seconds: 100 })),
    suites: [{ id: 'suite', name: 'Tasks', metric_kind: 'binary', metric: 'Pass rate' }],
    aggregates: ids.map(id => ({ id: 'fact-' + id, suite_id: 'suite', configuration_id: id, condition_id: id + '-off', eligible: id !== 'preview', score: id === 'small' ? .5 : 1, full_credit: id === 'small' ? 1 : 2, scored: 2, planned: 2 })),
    comparisons: [{ id: 'pair', configuration_id: 'best', suite_id: 'suite', verified: true, complete: true, timing_complete: true, off_condition_id: 'best-off', on_condition_id: 'best-on', delta_pp: 0, mean_added_s: -2, score_pairs: 2, time_pairs: 2, planned_pairs: 2, improved: 0, worsened: 0, unchanged: 2, ceiling: true }],
  } as unknown as OverviewData;
}
it('includes exact ties and a numeric smaller-file gap within the declared compatible cohort', () => {
  const result = takeaways(fixture(), 'suite', 'off', 'release-test');
  expect(result.map(r => r.kind)).toEqual(['quality', 'compact', 'thinking']);
  expect(result[0]!.text).toContain('best, tied tied at');
  expect(result[0]!.cohortIds).toEqual(['fact-best', 'fact-small', 'fact-tied']);
  expect(result[1]!.text).toContain('1 fewer passed questions');
  expect(result[1]!.href).toContain('selection=small%7Esmall-off');
  expect(result[2]!.text).toContain('-2.0 seconds');
  expect(result[2]!.text).toContain('no measured headroom');
});
it('suppresses unsupported slots rather than substituting incomplete, unverified or unknown-size claims', () => {
  const data = fixture();
  data.comparisons[0]!.timing_complete = false;
  data.artifacts.forEach(a => a.total_bytes = null);
  expect(takeaways(data, 'suite', 'off', 'release-test').map(r => r.kind)).toEqual(['quality']);
  data.aggregates.forEach(a => a.eligible = false);
  expect(takeaways(data, 'suite', 'off', 'release-test')).toEqual([]);
});
it('does not turn partial-credit differences into passed-question counts', () => {
  const data = fixture(); data.suites[0]!.metric_kind = 'partial_credit';
  const result = takeaways(data, 'suite', 'off', 'release-test');
  expect(result[0]!.text).not.toContain('passed');
  expect(result[1]!.text).toContain('percentage points');
});

it('keeps differing reasoning effort and token controls out of the same cohort', () => {
  const data = fixture(); data.conditions.find(c => c.configuration_id === 'small')!.thinking_tokens = 500;
  const quality = takeaways(data, 'suite', 'off', 'release-test').find(r => r.kind === 'quality')!;
  expect(quality.cohortIds).toEqual(['fact-best', 'fact-tied']);
});
