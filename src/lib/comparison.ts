import type { Condition, Configuration, Suite } from './public-contract';

export type Selection = { configurationId: string; conditionId: string };
export type Comparison = { releaseId: string; suiteId: string; selections: Selection[] };
export type ComparisonCatalog = { releaseId: string; configurations: Configuration[]; conditions: Condition[]; suites: Suite[] };
const PUBLIC_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function selectionKey(selection: Selection): string {
  if (!PUBLIC_ID.test(selection.configurationId) || !PUBLIC_ID.test(selection.conditionId)) throw new Error('Invalid public selection identity');
  return `${selection.configurationId}~${selection.conditionId}`;
}
export function addSelection(current: Selection[], next: Selection): Selection[] {
  if (current.some(s => selectionKey(s) === selectionKey(next))) return current;
  if (current.length >= 4) throw new Error('Four configurations are selected. Remove one before adding another.');
  return [...current, next];
}
export function parseComparison(search: string, catalog: ComparisonCatalog): Comparison {
  const query = new URLSearchParams(search);
  if (query.getAll('release').length !== 1 || query.get('release') !== catalog.releaseId) throw new Error('This results edition is unavailable.');
  if (query.getAll('suite').length !== 1 || !catalog.suites.some(s => s.id === query.get('suite'))) throw new Error('This test version is unavailable in the selected edition.');
  const values = query.getAll('selection');
  if (values.length < 2 || values.length > 4 || new Set(values).size !== values.length) throw new Error('Choose two to four distinct configurations.');
  const selections = values.map(value => {
    const parts = value.split('~');
    if (parts.length !== 2 || parts.some(p => !PUBLIC_ID.test(p))) throw new Error('Invalid comparison selection.');
    const [configurationId, conditionId] = parts as [string, string];
    if (!catalog.configurations.some(c => c.id === configurationId) ||
      !catalog.conditions.some(c => c.id === conditionId && c.configuration_id === configurationId)) {
      throw new Error('A selected configuration or condition is unavailable in this edition.');
    }
    return { configurationId, conditionId };
  });
  return { releaseId: catalog.releaseId, suiteId: query.get('suite')!, selections };
}
export function comparisonUrl(state: Comparison): string {
  const query = new URLSearchParams({ release: state.releaseId, suite: state.suiteId });
  state.selections.forEach(selection => query.append('selection', selectionKey(selection)));
  return `/compare/?${query}`;
}
