import { describe, expect, it } from 'vitest';
import { compareNullable, sizeBand, topWithTies } from '../../src/lib/presentation';
import { addSelection, comparisonUrl, parseComparison } from '../../src/lib/comparison';
import type { ComparisonCatalog } from '../../src/lib/comparison';

describe('public ranking rules', () => {
  it('uses decimal download boundaries and explicit unknowns', () => {
    expect([null, 0, 3e9 - 1, 3e9, 8e9, 16e9].map(sizeBand)).toEqual(['unknown', 'under-3', 'under-3', '3-8', '8-16', '16-plus']);
  });
  it('keeps exact cutoff ties and excludes incomplete perfect previews', () => {
    const rows = [1, .8, .7, .7, .699999].map((score, i) => ({ id: String(i), score, eligible: true }));
    rows.push({ id: 'preview', score: 1, eligible: false });
    expect(topWithTies(rows).map(x => x.id)).toEqual(['0', '1', '2', '3']);
  });
  it('keeps missing last for either sort direction while retaining zero', () => {
    expect([null, 0, .5].sort((a, b) => compareNullable(a, b))).toEqual([0, .5, null]);
    expect([null, 0, .5].sort((a, b) => compareNullable(a, b, true))).toEqual([.5, 0, null]);
  });
});
const catalog = { releaseId: 'release-one', configurations: [{ id: 'a' }, { id: 'b' }],
  conditions: [{ id: 'a-off', configuration_id: 'a' }, { id: 'b-on', configuration_id: 'b' }], suites: [{ id: 'basic-v1' }] } as ComparisonCatalog;
const state = { releaseId: 'release-one', suiteId: 'basic-v1', selections: [{ configurationId: 'a', conditionId: 'a-off' }, { configurationId: 'b', conditionId: 'b-on' }] };
describe('pinned comparisons', () => {
  it('round trips configuration-condition tuples and edition', () => {
    expect(parseComparison(comparisonUrl(state).split('?')[1]!, catalog)).toEqual(state);
  });
  it('rejects mismatched tuples rather than silently choosing a default', () => {
    expect(() => parseComparison('?release=release-one&suite=basic-v1&selection=a~b-on&selection=b~a-off', catalog)).toThrow('unavailable');
    expect(() => parseComparison(comparisonUrl(state).replace('release-one', 'old-edition').split('?')[1]!, catalog)).toThrow('edition');
  });
  it('requires deliberate removal before adding a fifth selection', () => {
    const selected = [0, 1, 2, 3].map(i => ({ configurationId: `c${i}`, conditionId: `s${i}` }));
    expect(() => addSelection(selected, { configurationId: 'c4', conditionId: 's4' })).toThrow('Remove one');
    expect(addSelection(selected, selected[0]!)).toBe(selected);
  });
});
