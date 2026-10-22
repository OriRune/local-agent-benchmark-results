import type { Object as EvidenceObject } from './public-contract';
import { readBounded } from './read-bounded';
export { readBounded } from './read-bounded';
import { assertObjectAvailable } from './withdrawal-client';
import { EvidenceError } from './evidence-error';
export async function fetchEvidence(object: EvidenceObject): Promise<Uint8Array> {
  if (!/^objects\/sha256\/[a-f0-9]{64}\.(json|txt)(\.gz)?$/.test(object.path) || !Number.isSafeInteger(object.bytes) || object.bytes < 0 || object.bytes > 128 * 1024 ** 2) throw new EvidenceError('invalid', 'Invalid evidence location');
  await assertObjectAvailable(object.id);
  let response: Response;
  try { response = await fetch(`/data/${object.path}`); } catch { throw new EvidenceError('network', 'Evidence request failed (network error).'); }
  if (!response.ok) throw new EvidenceError('network', `Evidence request failed (${response.status}).`);
  if (!response.body) throw new EvidenceError('network', 'Evidence response has no body.');
  // Hosts may deliver a gzip file as a download or apply HTTP Content-Encoding,
  // which fetch transparently decodes. Inspect actual bytes, not the filename.
  const received = await readBounded(response.body, Math.min(128 * 1024 ** 2, object.bytes + 65536)).catch((error: Error) => {
    throw new EvidenceError(error.message.includes('declared size') ? 'integrity' : 'network', error.message);
  });
  const compressed = object.encoding === 'gzip' && received[0] === 0x1f && received[1] === 0x8b;
  const bytes = compressed
    ? await readBounded(new Blob([received]).stream().pipeThrough(new DecompressionStream('gzip')), object.bytes).catch((error: Error) => { throw new EvidenceError('integrity', error.message); })
    : received;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== object.id || bytes.length !== object.bytes) throw new EvidenceError('integrity', 'Evidence checksum mismatch.');
  return bytes;
}
