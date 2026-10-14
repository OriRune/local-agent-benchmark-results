import { readWithdrawals } from './withdrawals.mjs';
import { readFile, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonical } from '../src/lib/canonical.mjs';
import { safeFile, verifyRelease, verifyObjectBytes, hash } from './public-data.mjs';
import { ensureDirectory, destinationPath, readRegular, writeImmutable, atomicMutable } from './safe-write.mjs';

export async function importRelease(source, destination, { progress = true } = {}) {
  source = resolve(source);
  const { release } = await verifyRelease(source, { progress });
  const root = await ensureDirectory(destination);
  const withdrawals = await readWithdrawals(root);
  if (withdrawals.editions[release.release_id] || release.objects.some(o => withdrawals.objects[o.id])) throw new Error('Import would restore withdrawn evidence or edition');
  const lockPath = destinationPath(root, '.import.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Publication import is locked. Inspect the owning process before removing a stale lock.'); throw e; }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, release_id: release.release_id }));
    let editions = [];
    try { editions = JSON.parse(await readRegular(destinationPath(root, 'editions.json'))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (!Array.isArray(editions) || editions.some(id => !/^release-[a-f0-9]{64}$/.test(id)) || new Set(editions).size !== editions.length) throw new Error('Invalid retained edition list');
    for (const object of release.objects) {
      const raw = await readFile(await safeFile(source, object.path));
      verifyObjectBytes(raw, object);
      await writeImmutable(root, object.path, raw);
    }
    await writeImmutable(root, `releases/${release.release_id}/release.json`, canonical(release));
    await verifyRelease(root, { releasePath: `releases/${release.release_id}/release.json` });
    if (!editions.includes(release.release_id)) editions.push(release.release_id);
    await atomicMutable(root, 'editions.json', canonical(editions));
    await atomicMutable(root, 'withdrawals.json', canonical(withdrawals));
    // Promotion is last. Failures leave the previous selected release intact.
    await atomicMutable(root, 'latest.json', canonical({ release_id: release.release_id, ...(Object.keys(withdrawals.objects).length ? { withdrawals_sha256: hash(canonical(withdrawals)) } : {}) }));
    return release.release_id;
  } finally { await lock.close(); await unlink(lockPath); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: npm run data:import -- /absolute/release/path');
  const root = fileURLToPath(new URL('../public/data/', import.meta.url));
  console.log(`Imported ${await importRelease(source, root)}`);
}
