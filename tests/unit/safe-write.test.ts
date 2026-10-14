import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicMutable, ensureDirectory, writeImmutable } from '../../scripts/safe-write.mjs';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'publication-write-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
it('preserves immutable bytes across retries and conflicting imports', async () => {
  expect(await writeImmutable(root, 'objects/fact', Buffer.from('original'))).toBe(true);
  expect(await writeImmutable(root, 'objects/fact', Buffer.from('original'))).toBe(false);
  await expect(writeImmutable(root, 'objects/fact', Buffer.from('changed'))).rejects.toThrow('immutable');
  expect(await readFile(join(root, 'objects/fact'), 'utf8')).toBe('original');
  expect(await readdir(join(root, 'objects'))).toEqual(['fact']);
});
it('rejects symlinked roots, parents and existing immutable files', async () => {
  await mkdir(join(root, 'outside')); await symlink(join(root, 'outside'), join(root, 'linked'));
  await expect(ensureDirectory(join(root, 'linked/data'))).rejects.toThrow('Unsafe');
  await expect(writeImmutable(root, 'linked/fact', Buffer.from('new'))).rejects.toThrow('Unsafe');
  await writeFile(join(root, 'outside/secret'), 'original');
  await symlink(join(root, 'outside/secret'), join(root, 'fact'));
  await expect(writeImmutable(root, 'fact', Buffer.from('new'))).rejects.toThrow('Unsafe');
  expect(await readFile(join(root, 'outside/secret'), 'utf8')).toBe('original');
});
it('refuses traversal and symlinked mutable pointers without touching their targets', async () => {
  for (const path of ['../escape', '/absolute', 'a/../b', 'a\\b']) await expect(writeImmutable(root, path, Buffer.from('new'))).rejects.toThrow('Unsafe');
  await writeFile(join(root, 'previous'), 'old release');
  await symlink(join(root, 'previous'), join(root, 'latest.json'));
  await expect(atomicMutable(root, 'latest.json', Buffer.from('new release'))).rejects.toThrow('Unsafe');
  expect(await readFile(join(root, 'previous'), 'utf8')).toBe('old release');
});
it('concurrent conflicting immutable writes cannot overwrite the winner', async () => {
  const outcomes = await Promise.allSettled(['one', 'two'].map(s => writeImmutable(root, 'release.json', Buffer.from(s))));
  expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  expect(['one', 'two']).toContain(await readFile(join(root, 'release.json'), 'utf8'));
  expect(await readdir(root)).toEqual(['release.json']);
});
