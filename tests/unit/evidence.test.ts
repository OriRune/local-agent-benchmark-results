import { afterEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fetchEvidence } from '../../src/lib/evidence-client';
import type { Object as EvidenceObject } from '../../src/lib/public-contract';

afterEach(() => vi.unstubAllGlobals());
const original = Buffer.from('{"answer":"Literal <script> text — exact whitespace\\n"}\n');
const hash = createHash('sha256').update(original).digest('hex');
const object: EvidenceObject = { id: hash, path: `objects/sha256/${hash}.json.gz`, bytes: original.length, encoding: 'gzip', media_type: 'application/json', availability: 'full' };
it.each(['file', 'http'] as const)('verifies exact bytes when gzip is decoded by %s', async transport => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/data/withdrawals.json' ? new Response('', { status: 404 }) : new Response(new Uint8Array(transport === 'file' ? gzipSync(original) : original))));
  expect(Buffer.from(await fetchEvidence(object))).toEqual(original);
});
it('rejects tampered payloads even when their length is unchanged', async () => {
  const changed = Buffer.from(original); changed[4] = 88;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/data/withdrawals.json' ? new Response('', { status: 404 }) : new Response(changed)));
  await expect(fetchEvidence(object)).rejects.toThrow('checksum');
});
it('stops expansion when gzip exceeds the declared decoded size', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/data/withdrawals.json' ? new Response('', { status: 404 }) : new Response(new Uint8Array(gzipSync(Buffer.alloc(1024 * 1024))))));
  await expect(fetchEvidence(object)).rejects.toThrow('declared size');
});
