import { readBounded } from './read-bounded';
import { emptyWithdrawals, validateWithdrawals, withdrawalMessage } from './withdrawals.mjs';
import { EvidenceError } from './evidence-error';
import type { PublicEvidenceWithdrawalsV1 as Registry } from './public-withdrawals';
let pending: Promise<Registry> | undefined;
export function loadWithdrawals(): Promise<Registry> {
  if (!pending) {
    pending = (async () => {
      const unavailable = () => new EvidenceError('status', 'Withdrawal status could not be checked. Please retry.');
      const response = await fetch('/data/withdrawals.json', { cache: 'no-store' }).catch(() => { throw unavailable(); });
      if (response.status === 404) return emptyWithdrawals();
      if (!response.ok || !response.body) throw unavailable();
      try { return validateWithdrawals(JSON.parse(new TextDecoder().decode(await readBounded(response.body, 16 * 1024 ** 2)))); }
      catch { throw unavailable(); }
    })();
    const request = pending;
    request.finally(() => { if (pending === request) pending = undefined; }).catch(() => {});
  }
  return pending!;
}
export async function assertObjectAvailable(id: string) {
  const registry = await loadWithdrawals();
  if (registry.objects[id]) throw new EvidenceError('withdrawn', withdrawalMessage('This evidence', registry.objects[id]));
}
export async function assertEditionAvailable(id: string) {
  const registry = await loadWithdrawals();
  if (registry.editions[id]) throw new EvidenceError('withdrawn', withdrawalMessage('This results edition', registry.editions[id]));
}
