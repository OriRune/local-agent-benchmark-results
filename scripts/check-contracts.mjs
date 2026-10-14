import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../contracts/checksums.json', import.meta.url), 'utf8'));
for (const [name, expected] of Object.entries(manifest)) {
  if (!/^v1\/[a-z-]+\.schema\.json$/.test(name)) throw new Error('Unsafe contract filename');
  const bytes = await readFile(new URL(`../contracts/${name}`, import.meta.url));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Contract checksum mismatch: ${name}`);
}
console.log('Public contract pack checksums verified.');
