import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { importRelease } from '../../scripts/import-data.mjs';
import { verifyRetained } from '../../scripts/retained-data.mjs';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
it('checks historical evidence even when the current edition remains valid', async () => {
  const root = await mkdtemp(join(tmpdir(), 'retained-test-')); roots.push(root);
  const source = resolve('tests/fixtures/edition-history-v1');
  const old = await importRelease(join(source, 'release'), root, { progress: false });
  const current = await importRelease(join(source, 'regraded'), root, { progress: false });
  expect(await verifyRetained(root)).toEqual({ selected: current, editions: [old, current], withdrawals: { version: 1, objects: {}, editions: {} } });
  const manifest = JSON.parse(await readFile(join(root, 'releases', old, 'release.json'), 'utf8'));
  const summary = manifest.objects.find((o: {id: string}) => o.id === manifest.summary_objects[0].object_id);
  await rm(join(root, summary.path));
  await expect(verifyRetained(root)).rejects.toThrow();
});
it('rejects an unlisted installed edition rather than silently excluding its graph', async () => {
  const root = await mkdtemp(join(tmpdir(), 'retained-test-')); roots.push(root);
  const source = resolve('tests/fixtures/edition-history-v1');
  await importRelease(join(source, 'release'), root, { progress: false });
  const current = await importRelease(join(source, 'regraded'), root, { progress: false });
  await writeFile(join(root, 'editions.json'), JSON.stringify([current]));
  await expect(verifyRetained(root)).rejects.toThrow('inventory');
});
