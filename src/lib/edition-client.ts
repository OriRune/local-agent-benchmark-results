import { assertEditionAvailable } from './withdrawal-client';
import type { PublicResultsReleaseV1 } from './public-release';
import type { OverviewData } from './public-types';
import type { Object as EvidenceObject } from './public-contract';
import { fetchEvidence, readBounded } from './evidence-client';
import { canonical } from './canonical';

export type Edition = { release: PublicResultsReleaseV1; index: OverviewData; objects: Map<string, EvidenceObject> };
const RELEASE = /^release-[a-f0-9]{64}$/;
const cache = new Map<string, Promise<Edition>>();
export function requestedEdition(search: string): string {
  const query = new URLSearchParams(search), ids = query.getAll('release');
  if (ids.length !== 1 || !RELEASE.test(ids[0]!)) throw new Error('This results edition is unavailable.');
  return ids[0]!;
}
export function archiveUrl(release: string, values: Record<string, string> = {}): string {
  if (!RELEASE.test(release)) throw new Error('Invalid results edition.');
  return `/archive/?${new URLSearchParams({ ...values, release })}`;
}
export async function editionObject<T>(edition: Edition, id: string): Promise<T> {
  const object = edition.objects.get(id); if (!object) throw new Error('This object is unavailable in the pinned edition.');
  if (object.media_type !== 'application/json') throw new Error('Expected a JSON edition object.');
  return JSON.parse(new TextDecoder().decode(await fetchEvidence(object))) as T;
}
export async function loadEdition(id: string): Promise<Edition> {
  await assertEditionAvailable(id);
  if (!RELEASE.test(id)) return Promise.reject(new Error('Invalid results edition.'));
  if (!cache.has(id)) {
    const promise = (async () => {
      const response = await fetch(`/data/releases/${id}/release.json`);
      if (!response.ok || !response.body) throw new Error('This results edition is unavailable.');
      const release = JSON.parse(new TextDecoder().decode(await readBounded(response.body, 16 * 1024 ** 2))) as PublicResultsReleaseV1;
      if (release.schema_version !== 1 || release.release_id !== id || !Array.isArray(release.objects) || release.objects.length > 40000) throw new Error('Unsupported results edition.');
      const bytes = new TextEncoder().encode(canonical(Object.fromEntries(Object.entries(release).filter(([key]) => key !== 'release_id'))));
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (`release-${hash}` !== id) throw new Error('Results edition checksum differs.');
      const objects = new Map(release.objects.map(o => [o.id, o]));
      if (objects.size !== release.objects.length) throw new Error('Duplicate edition object identity.');
      const edition = { release, objects, index: undefined as unknown as OverviewData };
      const index = await editionObject<OverviewData>(edition, release.index_object_id);
      if (index.schema_version !== 1 || index.dataset_revision_id !== release.dataset_revision_id || !Array.isArray(index.configurations) || !Array.isArray(index.questions)) throw new Error('Index does not belong to the pinned edition.');
      return { ...edition, index };
    })();
    cache.set(id, promise);
    promise.catch(() => cache.delete(id));
  }
  return cache.get(id)!;
}
