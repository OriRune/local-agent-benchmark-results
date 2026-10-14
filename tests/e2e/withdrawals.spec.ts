import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { importRelease } from '../../scripts/import-data.mjs';
import { readObject } from '../../scripts/public-data.mjs';
import { withdrawEvidence } from '../../scripts/withdraw-evidence.mjs';
import { archiveUrl } from '../../src/lib/edition-client';

test('withdrawn evidence blocks cached downloads and explains old pinned links while replacement works', async ({ page }) => {
  const root = await mkdtemp(join(tmpdir(), 'withdrawal-browser-')), source = join(root, 'source'), out = join(root, 'withdrawn');
  const fixture = resolve('tests/fixtures/withdrawal-v2');
  try {
    const old = await importRelease(join(fixture, 'original'), source, { progress: false });
    const current = await importRelease(join(fixture, 'replacement'), source, { progress: false });
    const manifest = JSON.parse(await readFile(join(fixture, 'original/release.json'), 'utf8'));
    const dataset = JSON.parse((await readObject(join(fixture, 'original'), manifest.objects.find((o: { id: string }) => o.id === manifest.dataset_object_id))).toString());
    const objectId = dataset.attempts[0].components.answer.object_ids[0], question = dataset.questions[0].id;
    let served = source;
    await page.route('**/data/**', async route => {
      const path = new URL(route.request().url()).pathname.slice('/data/'.length);
      if (!/^(releases\/release-[a-f0-9]{64}\/release\.json|objects\/sha256\/[a-f0-9]{64}\.(json|txt)(\.gz)?|latest\.json|withdrawals\.json)$/.test(path)) return route.fulfill({ status: 404 });
      try { await route.fulfill({ body: await readFile(join(served, path)), contentType: path.endsWith('.gz') ? 'application/octet-stream' : 'application/json' }); }
      catch { await route.fulfill({ status: 404 }); }
    });
    await page.goto(archiveUrl(old, { question }));
    const answer = page.locator('.evidence').filter({ has: page.getByRole('region', { name: 'Final answer text', exact: true }) });
    await expect(answer.locator('pre')).toHaveText('a\n b');
    const result = await withdrawEvidence(source, { objectIds: [objectId], reason: 'Synthetic evidence removed by the owner.', withdrawnAt: '2026-10-09T00:00:00.000Z', out });
    expect(result.retired_editions).toEqual([old]); served = out;
    let downloads = 0; page.on('download', () => downloads++);
    await answer.getByRole('button', { name: 'Download text', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('This evidence was intentionally withdrawn');
    expect(downloads).toBe(0);
    await page.goto(archiveUrl(old, { question }));
    await expect(page.getByRole('alert')).toContainText('This results edition was intentionally withdrawn on 2026-10-09');
    await page.goto(`/evidence/?release=${old}&object=${objectId}`);
    await expect(page.getByRole('alert')).toContainText('Synthetic evidence removed by the owner.');
    await page.goto(archiveUrl(current, { question }));
    await expect(page.getByRole('heading', { name: 'Original question', exact: true })).toBeVisible();
    await expect(page.getByText('Synthetic answer intentionally withdrawn for lifecycle testing.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
