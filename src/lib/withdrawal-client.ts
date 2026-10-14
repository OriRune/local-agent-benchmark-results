import { readBounded } from './read-bounded';
import { emptyWithdrawals, validateWithdrawals, withdrawalMessage } from './withdrawals.mjs';
import type { PublicEvidenceWithdrawalsV1 as Registry } from './public-withdrawals';
let pending: Promise<Registry> | undefined;
export function loadWithdrawals(): Promise<Registry> {
  if (!pending) {
    pending = (async () => {
      const response = await fetch('/data/withdrawals.json', { cache: 'no-store' });
      if (response.status === 404) return emptyWithdrawals();
      if (!response.ok || !response.body) throw new Error('Withdrawal status could not be checked. Please retry.');
      return validateWithdrawals(JSON.parse(new TextDecoder().decode(await readBounded(response.body, 16 * 1024 ** 2))));
    })();
    const request = pending;
    request.finally(() => { if (pending === request) pending = undefined; }).catch(() => {});
  }
  return pending!;
}
export async function assertObjectAvailable(id: string) {
  const registry = await loadWithdrawals();
  if (registry.objects[id]) throw new Error(withdrawalMessage('This evidence', registry.objects[id]));
}
export async function assertEditionAvailable(id: string) {
  const registry = await loadWithdrawals();
  if (registry.editions[id]) throw new Error(withdrawalMessage('This results edition', registry.editions[id]));
}
