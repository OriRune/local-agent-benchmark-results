import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { archiveUrl, loadEdition, requestedEdition } from '../../src/lib/edition-client';
const root = resolve('tests/fixtures/release-v1');
const release = JSON.parse(readFileSync(resolve(root, 'release.json'), 'utf8'));
afterEach(() => vi.unstubAllGlobals());
it('requires one explicit immutable edition', () => {
  expect(requestedEdition(`?release=${release.release_id}`)).toBe(release.release_id);
  for (const search of ['', '?release=latest', `?release=${release.release_id}&release=${release.release_id}`]) expect(() => requestedEdition(search)).toThrow('unavailable');
  const url = archiveUrl(release.release_id, { question: 'literal & question', release: 'latest' });
  expect(new URLSearchParams(url.split('?')[1]).get('release')).toBe(release.release_id);
  expect(new URLSearchParams(url.split('?')[1]).get('question')).toBe('literal & question');
});
it('rejects a missing or corrupt edition without falling back and permits retry', async () => {
  const fetch = vi.fn(async (_url: string) => new Response('', { status: 404 })); vi.stubGlobal('fetch', fetch);
  await expect(loadEdition(release.release_id)).rejects.toThrow('unavailable');
  expect(fetch).toHaveBeenCalledWith(`/data/releases/${release.release_id}/release.json`);
  expect(fetch).toHaveBeenCalledWith('/data/withdrawals.json', { cache: 'no-store' });
  fetch.mockImplementation(async (url: string) => url === '/data/withdrawals.json' ? new Response('', { status: 404 }) : new Response(JSON.stringify({ ...release, changes: { ...release.changes, description: 'tampered' } })));
  await expect(loadEdition(release.release_id)).rejects.toThrow('checksum');
});
it('loads only the pinned index and shares successful requests', async () => {
  const fetch = vi.fn(async (url: string) => url === '/data/withdrawals.json' ? new Response('', { status: 404 }) : new Response(new Uint8Array(readFileSync(url.endsWith('/release.json') ? resolve(root, 'release.json') : resolve(root, url.replace('/data/', ''))))));
  vi.stubGlobal('fetch', fetch);
  const [first, second] = await Promise.all([loadEdition(release.release_id), loadEdition(release.release_id)]);
  expect(first).toBe(second); expect(first.index.dataset_revision_id).toBe(release.dataset_revision_id);
  expect(fetch.mock.calls.filter(([url]) => url !== '/data/withdrawals.json')).toHaveLength(2);
  expect(fetch.mock.calls.filter(([url]) => url.includes('/data/objects/'))[0]![0]).toBe(`/data/${release.objects.find((o: {id: string}) => o.id === release.index_object_id).path}`);
});
