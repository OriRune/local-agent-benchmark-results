import { expect, it } from 'vitest';
import type { OverviewData } from '../../src/lib/public-types';
import { modelSuggestions, parseModelView } from '../../src/lib/model-view';

function fixture(): OverviewData {
  const names = ['subject', 'same', 'near', 'far', 'other-protocol', 'unknown-size'];
  return {
    checkpoints: [{ id: 'subject', baseline_artifact_id: 'subject' }, ...names.slice(2).map(id => ({ id, baseline_artifact_id: id }))],
    artifacts: names.map((id, i) => ({ id, checkpoint_id: id === 'same' ? 'subject' : id, total_bytes: id === 'unknown-size' ? null : (4 + i / 10) * 1e9 })),
    configurations: names.map(id => ({ id, artifact_id: id })),
    conditions: names.map(id => ({ id: `${id}-off`, configuration_id: id, reasoning_requested: 'off', kind: 'baseline', protocol_id: id === 'other-protocol' ? 'different' : 'protocol', temperature: 0, seed: 1, max_tokens: 1000, agent_steps: 10, agent_seconds: 100, question_seconds: 100 })),
    suites: [{ id: 'basic', family_id: 'basic' }, { id: 'reading', family_id: 'reading' }],
    aggregates: names.map(id => ({ id: `fact-${id}`, configuration_id: id, condition_id: `${id}-off`, suite_id: 'basic', eligible: id !== 'near', score: id === 'near' ? 1 : .5 })),
    comparisons: [],
  } as unknown as OverviewData;
}
const view = { configurationId: 'subject', conditionId: 'subject-off', suiteId: 'basic' };
it('rejects a foreign configuration or condition instead of showing a plausible default', () => {
  const data = fixture();
  expect(parseModelView('?configuration=same&suite=reading', data, 'subject')).toEqual({ configurationId: 'same', conditionId: 'same-off', suiteId: 'reading' });
  expect(() => parseModelView('?configuration=near', data, 'subject')).toThrow('belong');
  expect(() => parseModelView('?configuration=same&condition=subject-off', data, 'subject')).toThrow('condition');
  expect(() => parseModelView('?suite=missing', data, 'subject')).toThrow('version');
});
it('suggests complete compatible coverage before a closer incomplete perfect score', () => {
  const suggestions = modelSuggestions(fixture(), view);
  expect(suggestions.map(s => [s.kind, s.selection.configurationId])).toEqual([['weights', 'same'], ['peer', 'far']]);
  const peer = suggestions.find(s => s.kind === 'peer')!;
  expect(peer.exploratory).toBe(false);
  expect(peer.cohortIds).toEqual(['fact-far', 'fact-near']);
  expect(peer.factIds).toEqual(['fact-subject', 'fact-far']);
  expect(peer).toMatchObject({ policy: 'comparisons-v3', template: 'same-size-band-matching-controls' });
});
it('excludes peers and weight variants with different reasoning effort or thinking budgets', () => {
  for (const controls of [{ reasoning_effort: 'high' }, { thinking_tokens: 500 }]) {
    const data = fixture();
    Object.assign(data.conditions.find(c => c.configuration_id === 'same')!, controls);
    Object.assign(data.conditions.find(c => c.configuration_id === 'far')!, controls);
    const suggestions = modelSuggestions(data, view);
    expect(suggestions.map(s => [s.kind, s.selection.configurationId])).toEqual([['peer', 'near']]);
    expect(suggestions[0]).toMatchObject({ exploratory: true, cohortIds: ['fact-near'] });
    Object.assign(data.conditions.find(c => c.configuration_id === 'subject')!, controls);
    expect(modelSuggestions(data, view).map(s => s.selection.configurationId)).toEqual(['same', 'far']);
  }
});
it('does not infer size peers from unknown sizes or hide incomplete subject coverage', () => {
  const data = fixture(); data.artifacts[0]!.total_bytes = null;
  expect(modelSuggestions(data, view).some(s => s.kind === 'peer')).toBe(false);
  data.artifacts[0]!.total_bytes = 4e9; data.aggregates[0]!.eligible = false;
  expect(modelSuggestions(data, view).every(s => s.exploratory)).toBe(true);
});
it('offers thinking suggestions only for verified matching controls', () => {
  const data = fixture();
  data.comparisons = [{ id: 'paired', configuration_id: 'subject', suite_id: 'basic', off_condition_id: 'subject-off', on_condition_id: 'subject-on', verified: false, complete: true, timing_complete: true }] as OverviewData['comparisons'];
  expect(modelSuggestions(data, view).some(s => s.kind === 'thinking')).toBe(false);
  data.comparisons[0]!.verified = true; data.comparisons[0]!.timing_complete = false;
  expect(modelSuggestions(data, view)[0]).toMatchObject({ kind: 'thinking', exploratory: true, factIds: ['paired'] });
});
it('uses available suite metadata and reports missing baseline data clearly', () => {
  const data = fixture(); data.suites = data.suites.filter(s => s.family_id !== 'basic');
  expect(parseModelView('', data, 'subject').suiteId).toBe('reading');
  data.conditions = [];
  expect(() => parseModelView('', data, 'subject')).toThrow('No baseline test selection');
  data.configurations = [];
  expect(() => parseModelView('', data, 'subject')).toThrow('No tested configuration');
});

it('does not use observed reasoning as a matched thinking-off peer', () => {
  const data = fixture();
  data.conditions.find(c => c.configuration_id === 'far')!.observed_reasoning = 'enabled';
  expect(modelSuggestions(data, view).some(s => s.selection.configurationId === 'far')).toBe(false);
  const duplicate = { ...data.conditions[0]!, id: 'duplicate', reasoning_requested: 'on' as const, presentation_included: false };
  data.conditions.push(duplicate);
  expect(() => parseModelView('?condition=duplicate', data, 'subject')).toThrow('condition');
});
