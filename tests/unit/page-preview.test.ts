import { expect, it } from 'vitest';
import { validatePreviewPacket } from '../../scripts/preview-data.mjs';
import { retiredQuestion } from '../../src/lib/retired-questions';
import { createHash } from 'node:crypto';
const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const manifest = { release_id: 'release-a', question_id: 'q' }, ref = { attempt_id: 'a' };
const attempt = { components: { tools: { object_ids: ['tools'] }, checks: { object_ids: ['checks'] } } };
const html = '<html><body>Saved page</body></html>';
const packet = { version: 1, ...manifest, attempt_id: 'a', evidence_object_ids: ['tools'], status: 'available', reason: null, rendered_at: '2026-10-22T00:00:00Z', files: [{ filename: 'books/index.html', html, sha256: hash(html), redaction_rule_ids: [], views: [] }] };
it('binds visual output to the exact attempt and permitted evidence, without changing the source HTML', () => {
  expect(() => validatePreviewPacket(packet, ref, manifest, attempt)).not.toThrow();
  for (const update of [{ attempt_id: 'other' }, { release_id: 'old' }, { question_id: 'wrong' }, { evidence_object_ids: ['foreign'] }, { status: 'unavailable' }]) expect(() => validatePreviewPacket({ ...packet, ...update }, ref, manifest, attempt)).toThrow();
  const changed = structuredClone(packet); changed.files[0].html += '<p>edited</p>';
  expect(() => validatePreviewPacket(changed, ref, manifest, attempt)).toThrow(/HTML checksum/);
});
it('rejects unsafe source filenames and non-PNG image payloads', () => {
  for (const filename of ['../secret.html', '/absolute.html', 'books\\page.html', 'page.js']) {
    const changed = structuredClone(packet); changed.files[0].filename = filename;
    expect(() => validatePreviewPacket(changed, ref, manifest, attempt)).toThrow(/filename/);
  }
  const fakeImage = Buffer.from('<svg onload="alert(1)"></svg>');
  const value = { ...packet, files: [{ ...packet.files[0], views: [{ name: 'desktop', width: 1280, height: 900, cropped: false, png_base64: fakeImage.toString('base64'), sha256: hash(fakeImage), blocked_requests: 0, script_errors: 0 }] }] };
  expect(() => validatePreviewPacket(value, ref, manifest, attempt)).toThrow(/PNG/);
});
it('retires the sheet-music source identity across new suite versions without retiring other tasks', () => {
  expect(retiredQuestion({ source_id: 'real_linux2-R5' })).toContain('retired');
  expect(retiredQuestion({ source_id: 'real_linux2-R6' })).toBeNull();
});
