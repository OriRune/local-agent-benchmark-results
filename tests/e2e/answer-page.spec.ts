import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Attempt } from '../../src/lib/public-contract';
import { answerText, findAttempt, index, modelName, objectBytes, objectPath, question } from './answer-data';

// Exact regression target from the answer-page audit (20261021).
const QID = 'q-93852fae313a9aeb23584dc1', ORIGINAL_GEMMA = 'attempt-45b22a57def6507de835af2e', ORIGINAL_QWEN = 'attempt-e41312434110135aaa5b4370';
const target = `/questions/${QID}/?configuration=config-cloud-gemma31-coreweave-cloud&condition=condition-3da38f0ffe89d9e6d8f8e4f7`;
const data = question(QID);
const originalGemma = data.attempts.find(a => a.id === ORIGINAL_GEMMA)!, originalQwen = data.attempts.find(a => a.id === ORIGINAL_QWEN)!;
const gemma = data.attempts.find(a => a.canonical && a.trial_id === originalGemma.trial_id)!, qwen = data.attempts.find(a => a.canonical && a.trial_id === originalQwen.trial_id)!;
const GEMMA = gemma.id, QWEN = qwen.id;
const third = data.attempts.find(a => a.canonical && a.components.answer.object_ids.length === 1 && ![gemma, qwen].some(b => modelName(data, b) === modelName(data, a) || answerText(b) === answerText(a)))!;
const canonical = data.attempts.filter(a => a.canonical).length;
const answerRegion = (page: Page) => page.getByRole('region', { name: 'Final answer text', exact: true });
const answerAlert = (page: Page) => page.locator('.reading-answer > .evidence').first().getByRole('alert');
const rowLink = (page: Page, id: string) => page.locator(`.answer-rows a[href*="attempt=${id}"]`);

async function expectSelected(page: Page, attempt: Attempt, owner = data) {
  const selected = page.locator('.selected-attempt');
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveAttribute('data-attempt-id', attempt.id);
  await expect(page.locator('#selected-answer-heading')).toHaveText(modelName(owner, attempt));
  await expect(answerRegion(page)).toHaveCount(1);
  await expect.poll(() => answerRegion(page).textContent()).toBe(answerText(attempt));
  await expect(page.getByRole('button', { name: /^(Read|Load the) final answer/ })).toHaveCount(0);
  const checks = JSON.parse(objectBytes(attempt.components.checks.object_ids[0]!).toString());
  const expectedChecks = Object.entries(checks).filter(([, value]) => typeof value !== 'object').map(([key, value]) => `${key.replaceAll('_', ' ')}${String(value)}`);
  await expect.poll(() => page.locator('.check-values > div').allTextContents()).toEqual(expect.arrayContaining(expectedChecks));
  const objectId = attempt.components.answer.object_ids[0]!;
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original final answer', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${objectId}.txt`);
  expect(await readFile((await file.path())!)).toEqual(objectBytes(objectId));
}

test('exact target link shows one selected answer with its recorded grade, reference and checks', async ({ page }) => {
  expect(answerText(gemma)).toBe('76.8%');
  expect(gemma.score).toBe(1);
  expect(originalGemma.score).toBe(0);
  for (const url of [target, `/questions/${QID}/?attempt=${GEMMA}`]) {
    await page.goto(url);
    await expectSelected(page, gemma);
    await expect(page.locator('.answer-outcome')).toContainText('Full credit');
    await expect(page.locator('.answer-outcome')).toContainText('100.0% credit awarded');
    await expect(page.getByRole('list', { name: 'Accepted reference values' })).toHaveText('76.8');
    await expect(page.locator('.scoring-correction')).toContainText('Original grade: 0%. Reviewed grade: 100%.');
    await expect(page.locator('.grade-block')).toContainText('no model was rerun');
    await expect(page.locator('.answer-timing')).toHaveText('Hosted by CoreWeave · quality reference; excluded from local speed comparison');
    await page.getByText('Test machine and run settings', { exact: true }).click();
    await expect(page.locator('.run-details')).toContainText('Not disclosed. The local test machine’s CPU, GPU, RAM and OS do not apply.');
    await expect(page.locator('.answer-identity')).not.toContainText('Ryzen');
    await expect(page.locator('.answer-identity')).not.toContainText('Linux Mint');
  }
});

test('reviewed score links to unchanged original grade and survives Back', async ({page}) => {
  await page.goto(target);
  await expectSelected(page,gemma);
  await page.getByRole('link',{name:'View original grade and checks →',exact:true}).click();
  await expectSelected(page,originalGemma);
  await expect(page.locator('.answer-outcome')).toContainText('0.0% credit awarded');
  await expect(page.locator('.answer-identity')).toContainText('Historical');
  await expect(page.locator('.scoring-correction')).toHaveCount(0);
  await page.goBack();
  await expectSelected(page,gemma);
  await expect(page.locator('.scoring-correction')).toBeVisible();
});

test('first mobile screen identifies task, model and outcome with the answer one scroll away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(target);
  await expectSelected(page, gemma);
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const locator of [page.locator('h1'), page.locator('#selected-answer-heading'), page.locator('.answer-outcome .outcome-badge')]) {
    const box = (await locator.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }
  expect((await answerRegion(page).boundingBox())!.y).toBeLessThan(844 * 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('repeated model switches and Back/Forward keep exactly one matching answer, check and download', async ({ page }) => {
  await page.goto(target);
  await expectSelected(page, gemma);
  const search = page.getByRole('searchbox', { name: 'Find model, setup, seed or attempt ID' });
  const before = await page.evaluate(() => history.length);
  await search.fill(QWEN);
  await page.getByLabel('Answer outcome', { exact: true }).selectOption('all');
  expect(await page.evaluate(() => history.length)).toBe(before);
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', GEMMA);
  await rowLink(page, QWEN).click();
  await expect(page.locator('#selected-answer-heading')).toBeFocused();
  await expectSelected(page, qwen);
  expect(await page.locator('pre').allTextContents()).not.toContain('76.8%');
  await search.fill(third.id);
  await rowLink(page, third.id).click();
  await expectSelected(page, third);
  await search.fill(QWEN);
  await rowLink(page, QWEN).click();
  await expectSelected(page, qwen);
  for (const [move, expected] of [['back', third], ['back', qwen], ['back', gemma], ['forward', qwen], ['forward', third]] as const) {
    await (move === 'back' ? page.goBack() : page.goForward());
    await expectSelected(page, expected);
    expect(new URL(page.url()).searchParams.get('attempt') ?? GEMMA).toBe(expected.id);
  }
});

test('a slow answer for the previous model never appears under the newly opened model', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/data/${objectPath(gemma.components.answer.object_ids[0]!)}`, async route => { await gate; await route.continue().catch(() => {}); });
  await page.goto(target);
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', GEMMA);
  await expect(page.locator('.reading-answer').getByText('Loading the final answer…', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find model, setup, seed or attempt ID' }).fill(QWEN);
  await rowLink(page, QWEN).click();
  await expectSelected(page, qwen);
  release();
  await page.waitForTimeout(750);
  await expect(answerRegion(page)).toHaveCount(1);
  expect(await answerRegion(page).textContent()).toBe(answerText(qwen));
  expect(await page.locator('pre').allTextContents()).not.toContain('76.8%');
});

test('answer list pages visibly, names its collection, keeps history clean and supports middle-click', async ({ page }) => {
  await page.goto(target);
  await expectSelected(page, gemma);
  const range = page.locator('.answer-list-range');
  await expect(range).toContainText(`Showing recorded answers 1–25 of ${canonical}`);
  const first = await page.locator('.answer-rows a').first().getAttribute('href');
  const before = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Next 25 answers', exact: true }).click();
  await expect(range).toContainText(`Showing recorded answers 26–50 of ${canonical}`);
  expect(await page.locator('.answer-rows a').first().getAttribute('href')).not.toBe(first);
  await expect(page).toHaveURL(/answer_page=2/);
  expect(await page.evaluate(() => history.length)).toBe(before);
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', GEMMA);
  await page.reload();
  await expect(range).toContainText('26–50');
  await page.getByRole('searchbox', { name: 'Find model, setup, seed or attempt ID' }).fill('no such recorded model 123456');
  await expect(range).toHaveText('No recorded answers match these filters. · sorted by model name');
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', GEMMA);
  await page.getByRole('button', { name: 'Reset answer filters', exact: true }).click();
  const link = rowLink(page, QWEN);
  await page.getByRole('searchbox', { name: 'Find model, setup, seed or attempt ID' }).fill(QWEN);
  const href = new URL((await link.getAttribute('href'))!, page.url());
  const trial = data.trials.find(t => t.id === qwen.trial_id)!;
  expect([href.searchParams.get('attempt'), href.searchParams.get('configuration'), href.searchParams.get('condition')]).toEqual([QWEN, trial.configuration_id, trial.condition_id]);
  const [popup] = await Promise.all([page.context().waitForEvent('page'), link.click({ button: 'middle' })]);
  await expect(popup.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', QWEN);
  await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', GEMMA);
  await popup.close();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the exact link never presents a default model as the requested answer', async ({ page }) => {
    await page.goto(target);
    await expect(page.locator('h1')).toHaveText(index.test_descriptions!.questions[QID]!.title!);
    // Playwright disables script execution without switching the parser to
    // no-script mode, so <noscript> is checked as markup; the static status is
    // what a reader sees if scripts never start.
    expect(await (await page.request.get(target)).text()).toMatch(/<noscript><p[^>]*>This page needs JavaScript to open the exact recorded answer named in its link/);
    await expect(page.locator('.answer-pending')).toContainText('no other model’s answer is shown in its place');
    await expect(page.locator('.selected-attempt')).toHaveCount(0);
    await expect(answerRegion(page)).toHaveCount(0);
    await expect(page.locator('#selected-answer-heading')).toHaveCount(0);
    const href = new URL((await page.locator('.answer-rows a').first().getAttribute('href'))!, page.url());
    expect(['attempt', 'configuration', 'condition'].every(key => href.searchParams.get(key))).toBe(true);
  });
});

test.describe('evidence states', () => {
  const answerObject = gemma.components.answer.object_ids[0]!;
  test('a network failure is explained and retries the same selected answer', async ({ page }) => {
    let fail = true;
    await page.route(`**/data/${objectPath(answerObject)}`, route => fail ? route.fulfill({ status: 503 }) : route.continue());
    await page.goto(target);
    const alert = answerAlert(page);
    await expect(alert).toContainText('Could not load the final answer. Evidence request failed (503).');
    await expect(answerRegion(page)).toHaveCount(0);
    fail = false;
    await alert.getByRole('button', { name: 'Retry loading the final answer', exact: true }).click();
    await expect.poll(() => answerRegion(page).textContent()).toBe('76.8%');
    await expect(page.locator('.selected-attempt')).toHaveAttribute('data-attempt-id', GEMMA);
  });
  test('changed bytes fail the checksum and are not shown', async ({ page }) => {
    await page.route(`**/data/${objectPath(answerObject)}`, route => route.fulfill({ body: Buffer.from('76.9%'), contentType: 'text/plain' }));
    await page.goto(target);
    const alert = answerAlert(page);
    await expect(alert).toContainText('did not match its recorded size or checksum');
    await expect(alert.getByRole('button', { name: 'Retry loading the final answer', exact: true })).toBeVisible();
    await expect(answerRegion(page)).toHaveCount(0);
    await expect(page.getByText('76.9%')).toHaveCount(0);
  });
  test('withdrawn evidence states its withdrawal without a retry', async ({ page }) => {
    const edition = `release-${'f'.repeat(64)}`, when = '2026-10-09T00:00:00.000Z', reason = 'Synthetic withdrawal for the answer-page state test.';
    const registry = { version: 1, objects: { [answerObject]: { reason, withdrawn_at: when, release_ids: [edition] } }, editions: { [edition]: { reason, withdrawn_at: when, object_ids: [answerObject] } } };
    await page.route('**/data/withdrawals.json', route => route.fulfill({ body: JSON.stringify(registry), contentType: 'application/json' }));
    await page.goto(target);
    const alert = answerAlert(page);
    await expect(alert).toContainText(`This evidence was intentionally withdrawn on 2026-10-09. ${reason}`);
    await expect(alert.getByRole('button')).toHaveCount(0);
    await expect(answerRegion(page)).toHaveCount(0);
  });
  test('an unavailable withdrawal registry withholds text and offers a retry', async ({ page }) => {
    await page.route('**/data/withdrawals.json', route => route.fulfill({ status: 503 }));
    await page.goto(target);
    const alert = answerAlert(page);
    await expect(alert).toContainText('Withdrawal status could not be checked');
    await expect(alert.getByRole('button', { name: 'Retry loading the final answer', exact: true })).toBeVisible();
    await expect(answerRegion(page)).toHaveCount(0);
  });
  test('an empty recorded answer is stated, not shown as a blank box or a failure', async ({ page }) => {
    const { data: owner, attempt } = findAttempt((a, d) => a.components.answer.object_ids.length === 1 && d.objects.find(o => o.id === a.components.answer.object_ids[0])?.bytes === 0);
    expect(objectBytes(attempt.components.answer.object_ids[0]!).length).toBe(0);
    await page.goto(`/questions/${owner.question.id}/?attempt=${attempt.id}`);
    await expect(page.locator('.reading-answer .evidence-empty').first()).toContainText('The recorded final answer is empty (0 characters).');
    await expect(answerRegion(page)).toHaveCount(0);
  });
  test('credit from saved files is kept without a final message and never relabelled unfinished', async ({ page }) => {
    const { data: owner, attempt } = findAttempt(a => a.assessment?.reason === 'saved_agent_checks');
    await page.goto(`/questions/${owner.question.id}/?attempt=${attempt.id}`);
    await expect(page.locator('.answer-outcome')).toContainText('Full credit');
    await expect(page.locator('.answer-outcome')).not.toContainText('Failed to finish');
    await expect(page.locator('.grade-block')).toContainText('saved task checks accepted the work');
    if (!attempt.components.answer.object_ids.length) await expect(page.locator('.reading-answer')).toContainText('Final answer: not recorded.');
  });
  test('not recorded, withheld, redacted and very large evidence each explain themselves', async ({ page }) => {
    const missing = findAttempt(a => !a.components.answer.object_ids.length && a.components.answer.availability === 'not_recorded');
    await page.goto(`/questions/${missing.data.question.id}/?attempt=${missing.attempt.id}`);
    await expect(page.locator('.reading-answer')).toContainText('Final answer: not recorded.');
    const withheld = findAttempt(a => a.components.artifacts.availability === 'withheld');
    await page.goto(`/questions/${withheld.data.question.id}/?attempt=${withheld.attempt.id}`);
    const files = page.locator('details').filter({ has: page.getByText('Code and saved file changes', { exact: true }) });
    await expect(files.locator('summary')).toContainText('· withheld');
    await files.locator('summary').click();
    await expect(files).toContainText('Code and saved files: withheld from publication.');
    const redacted = findAttempt((a, d) => a.components.reasoning.availability === 'redacted' && a.components.reasoning.object_ids.every(id => (d.objects.find(o => o.id === id)?.bytes ?? 1e9) < 256 * 1024));
    await page.goto(`/questions/${redacted.data.question.id}/?attempt=${redacted.attempt.id}`);
    const reasoning = page.locator('details').filter({ has: page.getByText('Captured reasoning', { exact: true }) });
    await expect(reasoning.locator('summary')).toContainText('redacted');
    await reasoning.locator('summary').click();
    await expect(reasoning.getByRole('region', { name: 'Captured reasoning text', exact: true })).toBeVisible();
    await expect(reasoning).toContainText('Named privacy rules replaced private details');
    const large = findAttempt((a, d) => a.components.input.object_ids.reduce((n, id) => n + (d.objects.find(o => o.id === id)?.bytes ?? 0), 0) > 256 * 1024);
    const requests: string[] = []; page.on('request', request => requests.push(request.url()));
    await page.goto(`/questions/${large.data.question.id}/?attempt=${large.attempt.id}`);
    const input = page.locator('details').filter({ has: page.getByText('Captured input and tool schemas', { exact: true }) });
    await input.locator('summary').click();
    const load = input.getByRole('button', { name: /^Load the captured input \(\d+\.\d (KB|MB)\)$/ });
    await expect(load).toBeVisible();
    expect(requests.some(url => large.attempt.components.input.object_ids.some(id => url.includes(id)))).toBe(false);
    await load.click();
    await expect(input.getByRole('region', { name: 'Captured input text', exact: true })).toBeVisible({ timeout: 30_000 });
  });
  test('unfinished, incorrect and unscored outcomes keep distinct labels; only assessed results show credit', async ({ page }) => {
    for (const [category, label, credit] of [['failed_to_finish', 'Failed to finish', '0.0% credit awarded'], ['incorrect', 'Incorrect', '0.0% credit awarded'], ['untested', 'Untested / blocked', 'Unscored · no credit assessed'], ['technical_error', 'Technical error', 'Unscored · no credit assessed']] as const) {
      const { data: owner, attempt } = findAttempt(a => a.assessment?.category === category);
      await page.goto(`/questions/${owner.question.id}/?attempt=${attempt.id}`);
      await expect(page.locator('.answer-outcome .outcome-badge')).toHaveText(label);
      await expect(page.locator('.answer-outcome strong')).toHaveText(credit);
    }
  });
});

test('selected local runs show their recorded RAM group and the methodology lists the test machine', async ({ page }) => {
  for (const [hardware, ram] of [['desktop-32gb', '32 GB'], ['desktop-128gb', '128 GB']] as const) {
    const { data: owner, attempt } = findAttempt((a, d) => index.configurations.find(c => c.id === d.trials.find(t => t.id === a.trial_id)?.configuration_id)?.hardware_id === hardware);
    await page.goto(`/questions/${owner.question.id}/?attempt=${attempt.id}`);
    await expect(page.locator('.answer-timing')).toContainText(`Local test desktop · ${ram} RAM group`);
    await page.getByText('Test machine and run settings', { exact: true }).click();
    await expect(page.locator('.run-details')).toContainText('AMD Ryzen 5 5600X (6 cores / 12 threads)');
    await expect(page.locator('.run-details')).toContainText(`${ram} (the RAM group recorded for this run)`);
    await expect(page.locator('.run-details')).toContainText('Exact version not recorded for this run.');
  }
  await page.goto('/methodology/#test-machine');
  const machine = page.locator('#test-machine');
  for (const text of ['AMD Ryzen 5 5600X (6 cores / 12 threads)', 'AMD Radeon RX 6700 XT (12 GB VRAM)', '128 GB now. Earlier campaign runs used 32 GB.', 'Linux Mint 22.3', 'not applied to them', 'never enter local speed comparisons']) await expect(machine).toContainText(text);
  await page.goto('/');
  await expect(page.locator('#speed-quality .test-machine-note')).toContainText('Full test machine details');
});
