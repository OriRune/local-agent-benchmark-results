import { beforeEach, afterEach, expect, it } from 'vitest';
import { cp, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { importRelease } from '../../scripts/import-data.mjs';
import { verifyRelease } from '../../scripts/public-data.mjs';

const fixture = fileURLToPath(new URL('../fixtures/release-v1/', import.meta.url));
let root: string; let source: string; let destination: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'publication-import-')); source = join(root, 'source'); destination = join(root, 'site'); await cp(fixture, source, { recursive: true }); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

it('imports and retries a self-contained release without rewriting immutable bytes', async () => {
  const id = await importRelease(source, destination, { progress: false });
  const manifest = join(destination, 'releases', id, 'release.json'); const before = await stat(manifest);
  expect(await importRelease(source, destination, { progress: false })).toBe(id);
  expect((await stat(manifest)).mtimeMs).toBe(before.mtimeMs);
  expect(JSON.parse(await readFile(join(destination, 'editions.json'), 'utf8'))).toEqual([id]);
  expect(JSON.parse(await readFile(join(destination, 'latest.json'), 'utf8'))).toEqual({ release_id: id });
  expect(await verifyRelease(destination, { releasePath: `releases/${id}/release.json` })).toMatchObject({ release: { release_id: id } });
  await expect(stat(join(destination, '.import.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
});
it('does not advance the previous selection on an immutable-manifest conflict', async () => {
  const release = JSON.parse(await readFile(join(source, 'release.json'), 'utf8'));
  const edition = join(destination, 'releases', release.release_id); await mkdir(edition, { recursive: true });
  await writeFile(join(edition, 'release.json'), 'original protected bytes');
  await writeFile(join(destination, 'latest.json'), '{"release_id":"previous"}');
  await expect(importRelease(source, destination, { progress: false })).rejects.toThrow('immutable');
  expect(await readFile(join(edition, 'release.json'), 'utf8')).toBe('original protected bytes');
  expect(await readFile(join(destination, 'latest.json'), 'utf8')).toBe('{"release_id":"previous"}');
  await expect(stat(join(destination, '.import.lock'))).rejects.toMatchObject({ code: 'ENOENT' });
});
it('rejects a tampered source before creating a destination', async () => {
  const release = JSON.parse(await readFile(join(source, 'release.json'), 'utf8'));
  await writeFile(join(source, release.objects[0].path), 'tampered');
  await expect(importRelease(source, destination, { progress: false })).rejects.toThrow();
  await expect(stat(destination)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('rejects a redirected object directory and never writes outside its destination', async () => {
  await mkdir(destination); const outside = join(root, 'outside'); await mkdir(outside);
  await symlink(outside, join(destination, 'objects'));
  await expect(importRelease(source, destination, { progress: false })).rejects.toThrow('Unsafe');
  await expect(stat(join(outside, 'sha256'))).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(stat(join(destination, 'latest.json'))).rejects.toMatchObject({ code: 'ENOENT' });
});
it('does not steal an existing import lock', async () => {
  await mkdir(destination); const lock = join(destination, '.import.lock'); await writeFile(lock, 'other owner');
  await expect(importRelease(source, destination, { progress: false })).rejects.toThrow('locked');
  expect(await readFile(lock, 'utf8')).toBe('other owner');
});
