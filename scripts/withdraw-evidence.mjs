import { readFile, writeFile, mkdir, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { verifyRetained } from './retained-data.mjs';
import { safeFile, hash } from './public-data.mjs';
import { ensureDirectory } from './safe-write.mjs';
import { canonical } from '../src/lib/canonical.mjs';
import { validateWithdrawals } from '../src/lib/withdrawals.mjs';

/** @param {string} source @param {{objectIds: string[], reason: string, withdrawnAt?: string, out?: string}} options */
export async function withdrawEvidence(source, { objectIds, reason, withdrawnAt = new Date().toISOString(), out } = {}) {
  source = resolve(source);
  if (!Array.isArray(objectIds) || !objectIds.length || objectIds.some(id => !/^[a-f0-9]{64}$/.test(id)) || new Set(objectIds).size !== objectIds.length) throw new Error('Choose distinct evidence object hashes');
  const retained = await verifyRetained(source);
  const manifests = await Promise.all(retained.editions.map(async id => JSON.parse(await readFile(await safeFile(source, `releases/${id}/release.json`), 'utf8'))));
  const affected = manifests.filter(release => release.objects.some(o => objectIds.includes(o.id)));
  if (!affected.length || objectIds.some(id => !affected.some(release => release.objects.some(o => o.id === id)))) throw new Error('Requested evidence is not present in a retained edition');
  if (affected.some(release => release.release_id === retained.selected)) throw new Error('Publish and select a sanitized replacement edition before withdrawing its evidence');
  const registry = structuredClone(retained.withdrawals);
  for (const id of objectIds) {
    if (registry.objects[id]) throw new Error('Evidence already has a withdrawal record');
    registry.objects[id] = { reason, withdrawn_at: withdrawnAt, release_ids: affected.filter(release => release.objects.some(o => o.id === id)).map(release => release.release_id).sort() };
  }
  for (const release of affected) registry.editions[release.release_id] = { reason, withdrawn_at: withdrawnAt, object_ids: objectIds.filter(id => release.objects.some(o => o.id === id)).sort() };
  validateWithdrawals(registry);
  const retired = new Set(affected.map(release => release.release_id));
  const keep = manifests.filter(release => !retired.has(release.release_id));
  const report = { selected: retained.selected, retired_editions: [...retired], retained_editions: keep.map(release => release.release_id), object_ids: objectIds, reason, withdrawn_at: withdrawnAt };
  if (!out) return { ...report, preview: true };
  out = resolve(out);
  if (out === source || out.startsWith(source + '/')) throw new Error('Withdrawal destination must be outside the source');
  try { await lstat(out); throw new Error('Withdrawal destination already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await ensureDirectory(dirname(out));
  const staging = await mkdtemp(join(dirname(out), '.withdrawal-'));
  try {
    const files = new Set();
    for (const release of keep) {
      const path = `releases/${release.release_id}/release.json`;
      await mkdir(dirname(join(staging, path)), { recursive: true });
      await writeFile(join(staging, path), canonical(release));
      for (const object of release.objects) files.add(object.path);
    }
    for (const path of files) {
      const bytes = await readFile(await safeFile(source, path));
      await mkdir(dirname(join(staging, path)), { recursive: true });
      await writeFile(join(staging, path), bytes);
    }
    await writeFile(join(staging, 'latest.json'), canonical({ release_id: retained.selected, withdrawals_sha256: hash(canonical(registry)) }));
    await writeFile(join(staging, 'editions.json'), canonical(report.retained_editions));
    await writeFile(join(staging, 'withdrawals.json'), canonical(registry));
    await verifyRetained(staging);
    await rename(staging, out);
    return { ...report, preview: false, out, retained_objects: files.size };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { source: { type: 'string' }, out: { type: 'string' }, object: { type: 'string', multiple: true }, reason: { type: 'string' } } });
  if (!values.source) throw new Error('Use --source DATA --object HASH --reason TEXT; add --out NEW_DATA_DIRECTORY to write the reviewed result');
  console.log(JSON.stringify(await withdrawEvidence(values.source, { objectIds: values.object, reason: values.reason, out: values.out }), null, 2));
}
