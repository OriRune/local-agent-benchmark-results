import { expect, it } from 'vitest';
import { canonical } from '../../src/lib/canonical';
it('uses interoperable number formatting and UTF-16 property order', () => {
  expect(canonical({ z: 1.0, tiny: 1e-7, fixed: 1e-6, large: 1e30, negativeZero: -0 }))
    .toBe('{"fixed":0.000001,"large":1e+30,"negativeZero":0,"tiny":1e-7,"z":1}');
  expect(canonical({ '\ue000': 1, '😀': 2 })).toBe('{"😀":2,"":1}');
  expect(canonical({ '2': 2, '10': 10 })).toBe('{"10":10,"2":2}');
});
it('does not drop unsupported values or accept nonfinite numbers', () => {
  expect(() => canonical({ invalid: undefined })).toThrow();
  expect(() => canonical(NaN)).toThrow();
});
