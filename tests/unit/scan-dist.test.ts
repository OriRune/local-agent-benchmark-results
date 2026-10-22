import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { hash } from '../../scripts/public-data.mjs';
import { importRelease } from '../../scripts/import-data.mjs';
import { inspectHtml, inspectText, scanDist } from '../../scripts/scan-dist.mjs';
const policy = { version: 1, forbidden_literals: ['/private-test-owner'], inline_scripts: {}, exceptions: [] };
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dist-scan-')); roots.push(root);
  await importRelease(resolve('tests/fixtures/release-v1'), join(root, 'data'), { progress: false });
  await writeFile(join(root, 'index.html'), '<!doctype html><html><body><pre>&lt;script&gt;literal answer&lt;/script&gt;</pre></body></html>');
  await mkdir(join(root, 'heatmap'));
  await writeFile(join(root, 'heatmap', 'index.html'), '<!doctype html><html><body><h1>Model heatmap</h1></body></html>');
  return root;
}
it('finds raw and escaped credentials without returning their values', () => {
  const secret = 'sk-proj-' + 'a'.repeat(30);
  expect(inspectText(secret, policy)).toEqual(['provider-token']);
  expect(inspectText('\\u0073' + secret.slice(1), policy)).toEqual(['provider-token']);
  expect(inspectText('/private-test-owner/work', policy)).toEqual(['private-identifier']);
  expect(JSON.stringify(inspectText(secret, policy))).not.toContain(secret);
});
it('distinguishes literal escaped evidence from active HTML and requires exact script approval', () => {
  expect(inspectHtml('<pre>&lt;script&gt;alert(1)&lt;/script&gt;</pre>', policy)).toEqual([]);
  expect(inspectHtml('<a href="java&#115;cript:alert(1)">click</a>', policy)).toContain('active-url');
  expect(inspectHtml('<img src="https://example.test/track" onerror="alert(1)">', policy)).toEqual(expect.arrayContaining(['remote-resource', 'active-attribute']));
  expect(inspectHtml('<iframe srcdoc="literal"></iframe>', policy)).toContain('active-element');
  expect(inspectHtml('<astro-island component-url="https://example.test/evil.js"></astro-island>', policy)).toContain('unapproved-island-source');
  expect(inspectHtml('<script>alert(1)</script>', policy)).toContain('unapproved-inline-script');
  const approved = { ...policy, inline_scripts: { [hash('safe()')]: 'Test-only trusted code' } };
  expect(inspectHtml('<script>safe()</script>', approved)).toEqual([]);
  expect(inspectHtml('<script>safe();evil()</script>', approved)).toContain('unapproved-inline-script');
});
it('scans compressed unexpected files and source maps, rejects symlinks, and reports no secret values', async () => {
  const root = await fixture(); const secret = 'hf_' + 'z'.repeat(30);
  await writeFile(join(root, 'extra.txt.gz'), gzipSync(secret));
  await mkdir(join(root, '_astro'));
  await writeFile(join(root, '_astro', 'bundle.js.map'), JSON.stringify({ sourcesContent: ['/private-test-owner/file'] }));
  await symlink(join(root, 'index.html'), join(root, 'linked.html'));
  const report = await scanDist(root, policy);
  expect(report.valid).toBe(false);
  expect(report.findings).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'extra.txt.gz', rule: 'service-token' }),
    expect.objectContaining({ path: '_astro/bundle.js.map', rule: 'private-identifier' }),
    expect.objectContaining({ path: 'linked.html', rule: 'symlink' }),
  ]));
  expect(JSON.stringify(report)).not.toContain(secret);
});
it('accepts a complete inert fixture and binds an exception to exact file bytes', async () => {
  const root = await fixture(); expect((await scanDist(root, policy)).valid).toBe(true);
  const file = join(root, 'index.html'); await writeFile(file, '<p>/private-test-owner is synthetic</p>');
  const exceptions = [{ path: 'index.html', sha256: hash(await readFile(file)), rule: 'private-identifier', reason: 'Exact synthetic path fixture' }];
  expect((await scanDist(root, { ...policy, exceptions })).valid).toBe(true);
  await writeFile(file, '<p>/private-test-owner has changed</p>');
  expect((await scanDist(root, { ...policy, exceptions })).valid).toBe(false);
});
