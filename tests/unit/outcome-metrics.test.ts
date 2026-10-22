import {it, expect} from 'vitest';
import {outcomeMetrics, rateText} from '../../src/lib/outcome-metrics';
const counts = {full_credit:8, partial_credit:0, incorrect:4, failed_to_finish:4, technical_error:0, untested:0, review:0, unresolved:0};
it('separates the user’s 8 correct, 4 wrong and 4 unfinished example', () => {
  const m = outcomeMetrics({outcome_counts:counts})!;
  expect(rateText(m.full,m.assessed)).toBe('8/16 · 50%');
  expect(rateText(m.completed,m.assessed)).toBe('12/16 · 75%');
  expect(rateText(m.full,m.completed)).toBe('8/12 · 67%');
});
it('keeps unknown outcomes outside the rates and partial answers within completed', () => {
  const m = outcomeMetrics({outcome_counts:{...counts,partial_credit:2,technical_error:3,review:1}})!;
  expect(m).toEqual({full:8,completed:14,assessed:18,unscored:4});
  expect(rateText(0,0)).toBe('0/0 · —');
});
it('does not fabricate completion data for older editions', () => {
  expect(outcomeMetrics({})).toBeNull();
});
