import type { OverviewData } from './public-types';
export function suiteLabel(data: OverviewData, suite: OverviewData['suites'][number]): string {
  if (data.suites.filter(s => s.family_id === suite.family_id).length < 2) return suite.name;
  const ids = new Set(data.aggregates.filter(a => a.suite_id === suite.id).map(a => a.configuration_id));
  const configs = data.configurations.filter(c => ids.has(c.id));
  const context = configs.length && configs.every(c => c.hardware_id === 'desktop-128gb') ? '128 GB campaign' : 'original campaign';
  return `${suite.name} · ${context}`;
}
