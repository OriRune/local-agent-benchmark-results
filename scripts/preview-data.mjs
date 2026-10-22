import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { validateWithdrawals } from '../src/lib/withdrawals.mjs';
import { hash } from './public-data.mjs';
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function requireValid(value, message) { if (!value) throw Error(`Invalid page previews: ${message}`); }
export function validatePreviewPacket(packet, reference, manifest, attempt) {
  requireValid(packet.version === 1 && packet.release_id === manifest.release_id && packet.question_id === manifest.question_id && packet.attempt_id === reference.attempt_id, 'wrong answer identity');
  const evidence = [...attempt.components.tools.object_ids, ...attempt.components.checks.object_ids];
  requireValid(Array.isArray(packet.evidence_object_ids) && (packet.status === 'unavailable' || packet.evidence_object_ids.length > 0) && packet.evidence_object_ids.every(id => evidence.includes(id)), 'source evidence mismatch');
  requireValid(['available', 'unavailable'].includes(packet.status) && Array.isArray(packet.files) && !isNaN(Date.parse(packet.rendered_at)), 'state');
  requireValid(packet.status === 'available' ? packet.files.length > 0 && packet.reason === null : packet.files.length === 0 && typeof packet.reason === 'string', 'availability');
  const filenames = new Set();
  for (const file of packet.files) {
    requireValid(typeof file.filename === 'string' && /^[^\\\x00-\x1f]+\.html?$/i.test(file.filename) && !file.filename.startsWith('/') && !file.filename.split('/').includes('..') && !filenames.has(file.filename), 'filename'); filenames.add(file.filename);
    requireValid(typeof file.html === 'string' && Buffer.byteLength(file.html) <= 2_000_000 && sha(file.sha256) && hash(Buffer.from(file.html)) === file.sha256, 'HTML checksum');
    requireValid(Array.isArray(file.redaction_rule_ids) && file.redaction_rule_ids.every(id => typeof id === 'string'), 'redactions');
    requireValid(Array.isArray(file.views) && file.views.length <= 2 && new Set(file.views.map(v => v.name)).size === file.views.length, 'screen sizes');
    for (const view of file.views) {
      requireValid(['desktop', 'mobile'].includes(view.name) && view.width === (view.name === 'desktop' ? 1280 : 390) && Number.isInteger(view.height) && view.height > 0 && view.height <= 12000 && typeof view.cropped === 'boolean', 'dimensions');
      requireValid(typeof view.png_base64 === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(view.png_base64), 'image encoding');
      const png = Buffer.from(view.png_base64, 'base64');
      requireValid(png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && png.toString('ascii',12,16) === 'IHDR' && png.readUInt32BE(16) === view.width && png.readUInt32BE(20) === view.height && hash(png) === view.sha256, 'PNG checksum or dimensions');
      requireValid([view.blocked_requests, view.script_errors].every(n => Number.isSafeInteger(n) && n >= 0), 'capture counts');
    }
  }
}
export async function validatePreviews(publicRoot) {
  const directory = join(publicRoot, 'previews'); let names;
  try { names = await readdir(directory); } catch (e) { if (e.code === 'ENOENT') return { files: [], previews: 0 }; throw e; }
  const manifest = JSON.parse(await readFile(join(directory, 'index.json'), 'utf8'));
  requireValid(manifest.version === 1 && /^release-[a-f0-9]{64}$/.test(manifest.release_id) && manifest.question_id === 'q-bc4a880703cbea599dac4f30' && Array.isArray(manifest.previews), 'manifest');
  const withdrawals = validateWithdrawals(JSON.parse(await readFile(join(publicRoot, 'data', 'withdrawals.json'), 'utf8')));
  requireValid(!withdrawals.editions[manifest.release_id], 'remove previews for withdrawn edition');
  const data = join(publicRoot, 'data'), release = JSON.parse(await readFile(join(data, 'releases', manifest.release_id, 'release.json'), 'utf8'));
  const object = release.objects.find(o => o.id === release.question_objects[manifest.question_id]);
  requireValid(object && /^objects\/sha256\/[a-f0-9]{64}\.json(?:\.gz)?$/.test(object.path), 'question');
  const raw = await readFile(join(data, object.path)), bytes = object.encoding === 'gzip' ? gunzipSync(raw) : raw;
  requireValid(hash(bytes) === object.id, 'question checksum');
  const question = JSON.parse(bytes), ids = new Set(), files = ['previews/index.json'];
  for (const ref of manifest.previews) {
    requireValid(!ids.has(ref.attempt_id) && sha(ref.sha256) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 20 * 1024 ** 2, 'reference'); ids.add(ref.attempt_id);
    const attempt = question.attempts.find(a => a.id === ref.attempt_id); requireValid(attempt, 'unknown attempt');
    const filename = ref.sha256 + '.json', content = await readFile(join(directory, filename));
    requireValid(content.length === ref.bytes && hash(content) === ref.sha256, 'packet checksum');
    const packet = JSON.parse(content);
    requireValid(packet.evidence_object_ids.every(id => !withdrawals.objects[id]), 'remove previews for withdrawn evidence');
    validatePreviewPacket(packet, ref, manifest, attempt); files.push('previews/' + filename);
  }
  requireValid(names.length === files.length && names.every(name => files.includes('previews/' + name)), 'unexpected file');
  return { files, previews: ids.size };
}
