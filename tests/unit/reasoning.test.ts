import { expect, it } from 'vitest';
import { conditionLabel, displayedMode, visibleCondition } from '../../src/lib/reasoning';

it('labels observed reasoning without rewriting the requested control or claiming verification', () => {
  const c = { reasoning_requested: 'off', observed_reasoning: 'enabled', presentation_included: true };
  expect(displayedMode(c)).toBe('on');
  expect(conditionLabel(c)).toBe('Reasoning enabled (observed; requested off)');
  expect(c.reasoning_requested).toBe('off');
  expect(visibleCondition(c)).toBe(true);
  expect(visibleCondition({ reasoning_requested: 'on', presentation_included: false })).toBe(false);
  expect(conditionLabel({ reasoning_requested: 'off' })).toBe('Thinking off');
});

it('labels a native checkpoint as a reasoning version rather than a verified switch', () => {
  const c = { reasoning_requested: 'on', verification: 'native_reasoning' };
  expect(conditionLabel(c)).toBe('Thinking / Reasoning version');
  expect(displayedMode(c)).toBe('on');
});
