import { expect, it } from 'vitest';
import { filterCatalog, type CatalogCard } from '../../src/lib/catalog-view';
const cards: CatalogCard[] = [
  { id: 'one', slug: 'one', name: 'Example', formats: ['Q4', 'Q8'], publishers: ['Publisher'], bytes: 1e9,
    configurations: [{ id: 'config-a', name: 'Q4 runtime', status: 'completed' }, { id: 'config-b', name: 'Q8 second runtime', status: 'pending' }] },
  { id: 'two', slug: 'two', name: 'Unresolved', formats: ['Unknown'], publishers: [], bytes: null,
    configurations: [{ id: 'config-c', name: 'New setup', status: 'withdrawn' }] },
];
it('searches every configuration, publisher and state while retaining unknown and pending entries', () => {
  expect(filterCatalog(cards, '')).toEqual(cards);
  expect(filterCatalog(cards, ' PUBLISHER q8 pending ')).toEqual([cards[0]]);
  expect(filterCatalog(cards, 'config-b')).toEqual([cards[0]]);
  expect(filterCatalog(cards, 'withdrawn')).toEqual([cards[1]]);
  expect(filterCatalog(cards, 'nonexistent')).toEqual([]);
});
