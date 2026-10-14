import { expect, it } from 'vitest';
import { overviewViewQuery, parseOverviewView } from '../../src/lib/overview-view';
it('round trips filters including literal punctuation and unicode', () => {
  const view = { suiteId: 'reading', mode: 'on' as const, search: 'Model & quant + 日本語', showAll: true };
  expect(parseOverviewView(overviewViewQuery(view), ['basic', 'reading'], 'basic')).toEqual(view);
});
it('rejects unknown and conflicting explicit filters', () => {
  for (const query of ['suite=missing', 'thinking=auto', 'all=yes', 'suite=basic&suite=basic']) expect(() => parseOverviewView(query, ['basic'], 'basic')).toThrow();
});
