import { readWithdrawals, checkRetainedWithdrawals } from './withdrawals.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { safeFile, verifyRelease } from './public-data.mjs';

// A deployment serves historical URLs as well as latest, so all retained graphs
// must be complete before the build can publish any of them.
export async function verifyRetained(root, { progress = false } = {}) {
  const latest = JSON.parse(await readFile(await safeFile(root, 'latest.json'), 'utf8'));
  const editions = JSON.parse(await readFile(await safeFile(root, 'editions.json'), 'utf8'));
  const validId = id => typeof id === 'string' && /^release-[a-f0-9]{64}$/.test(id);
  if (!validId(latest.release_id) || !Array.isArray(editions) || !editions.length ||
      editions.some(id => !validId(id)) || new Set(editions).size !== editions.length ||
      !editions.includes(latest.release_id)) throw new Error('Invalid retained edition selection');
  const entries = await readdir(await safeFile(root, 'releases'), { withFileTypes: true });
  if (entries.length !== editions.length || entries.some(entry => !entry.isDirectory() || !editions.includes(entry.name))) {
    throw new Error('Retained edition inventory differs from installed manifests');
  }
  const withdrawals = await readWithdrawals(root), releases = [];
  for (const id of editions) {
    const { release } = await verifyRelease(root, { releasePath: `releases/${id}/release.json`, progress });
    releases.push(release);
    if (release.release_id !== id) throw new Error('Retained manifest path differs from its identity');
  }
  checkRetainedWithdrawals(withdrawals, editions, releases);
  return { selected: latest.release_id, editions, withdrawals }; 
}
