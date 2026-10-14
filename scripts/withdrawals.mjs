import { readFile } from 'node:fs/promises';
import { safeFile, hash } from './public-data.mjs';
import { canonical } from '../src/lib/canonical.mjs';
import { emptyWithdrawals, validateWithdrawals } from '../src/lib/withdrawals.mjs';
export async function readWithdrawals(root) {
  let registry = emptyWithdrawals(), present = false, latest;
  try { registry = validateWithdrawals(JSON.parse(await readFile(await safeFile(root, 'withdrawals.json'), 'utf8'))); present = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { latest = JSON.parse(await readFile(await safeFile(root, 'latest.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (latest?.withdrawals_sha256 || Object.keys(registry.objects).length) {
    if (!present || latest?.withdrawals_sha256 !== hash(canonical(registry))) throw new Error('Withdrawal registry is missing or differs from the selected pointer');
  }
  return registry;
}
export function checkRetainedWithdrawals(withdrawals, editions, releases) {
  if (editions.some(id => withdrawals.editions[id])) throw new Error('Withdrawn edition is still retained');
  for (const release of releases) if (release.objects.some(o => withdrawals.objects[o.id])) throw new Error('Retained edition still contains withdrawn evidence');
}
