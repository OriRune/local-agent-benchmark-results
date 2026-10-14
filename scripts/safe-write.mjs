import { lstat, mkdir, readFile, writeFile, rename, link, unlink } from 'node:fs/promises';
import { resolve, parse, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

// Reject symlinks in every destination ancestor. This is for local imports, not
// a sandbox against hostile processes concurrently replacing parent directories.
export async function ensureDirectory(directory) {
  const absolute = resolve(directory); const { root } = parse(absolute);
  let current = root;
  for (const part of absolute.slice(root.length).split('/').filter(Boolean)) {
    current = join(current, part);
    try { await mkdir(current); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe publication destination directory');
  }
  return absolute;
}
export function destinationPath(root, relative) {
  if (!relative || relative.startsWith('/') || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe publication destination path');
  return join(resolve(root), relative);
}
export async function readRegular(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Unsafe publication destination file');
  return readFile(path);
}
export async function writeImmutable(root, relative, bytes) {
  const path = destinationPath(root, relative);
  await ensureDirectory(dirname(path));
  async function sameExisting() {
    const existing = await readRegular(path);
    if (!existing.equals(Buffer.from(bytes))) throw new Error('Refusing to replace immutable publication bytes');
  }
  try { await sameExisting(); return false; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: 'wx' });
    // Unlike rename, link cannot replace an existing edition.
    try { await link(temp, path); } catch (e) { if (e.code !== 'EEXIST') throw e; await sameExisting(); return false; }
    return true;
  } finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}
export async function atomicMutable(root, relative, bytes) {
  const path = destinationPath(root, relative);
  await ensureDirectory(dirname(path));
  try { await readRegular(path); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, bytes, { flag: 'wx' }); await rename(temp, path); }
  finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}
