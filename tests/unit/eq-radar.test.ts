import {expect, it} from 'vitest';
import {geometry, mean} from '../../src/lib/eq-radar';

it('leaves missing axes unplotted rather than inventing zero scores', () => {
  const missing = geometry([5, null, 5, 5], 0);
  expect(missing.points[1]).toBeNull();
  expect(missing.complete).toBe(false);
  expect(missing.path).not.toContain(' Z');
  const zero = geometry([5, 0, 5, 5], 0);
  expect(zero.points[1]).toEqual({x:220, y:200});
  expect(zero.complete).toBe(true);
});
it('uses the actual scale endpoints for relative abilities and neutral traits', () => {
  expect(geometry([1, 10, 5], 1).points[0]).toEqual({x:220, y:200});
  expect(geometry([0, 10, 5], 0).points[0]).toEqual({x:220, y:200});
  expect(geometry([10, 10, 10], 1).points[0]).toEqual({x:220, y:80});
});
it('excludes missing and non-finite values from model means while retaining zero', () => {
  expect(mean([0, 10, null, undefined, NaN, Infinity])).toBe(5);
  expect(mean([null, NaN])).toBeNull();
});
