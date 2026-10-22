import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { comparisonUrl } from '../../src/lib/comparison';

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} core pages have no detected accessibility violations`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const selected = JSON.parse(await readFile('public/data/latest.json', 'utf8'));
    const release = JSON.parse(await readFile(`public/data/releases/${selected.release_id}/release.json`, 'utf8'));
    const object = release.objects.find((object: { id: string }) => object.id === release.index_object_id);
    const bytes = await readFile(`public/data/${object.path}`);
    const index = JSON.parse((object.encoding === 'gzip' ? gunzipSync(bytes) : bytes).toString());
    const suite = index.suites.find((suite: any) => suite.family_id === 'basic');
    const question = index.questions.find((question: any) => question.suite_id === suite.id);
    const selections = index.configurations.slice(0, 2).map((config: any) => ({ configurationId: config.id,
      conditionId: index.conditions.find((condition: any) => condition.configuration_id === config.id && condition.kind === 'baseline' && condition.reasoning_requested === 'off').id }));
    await page.addInitScript(value => localStorage.setItem('agentbench-theme', value), theme);
    const routes = [
      { name: 'overview', url: '/' }, { name: 'catalog', url: '/models/' }, { name: 'model', url: `/models/${index.checkpoints[0].slug}/` },
      { name: 'tests', url: '/tests/' }, { name: 'suite', url: `/tests/${suite.id}/` }, { name: 'question', url: `/questions/${question.id}/` },
      { name: 'comparison', url: comparisonUrl({ releaseId: release.release_id, suiteId: suite.id, selections }) },
      { name: 'editions', url: '/editions/' },
    ];
    const reports = [];
    for (const route of routes) {
      await page.goto(route.url);
      await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
      if (route.name === 'overview') {
        const plain = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        reports.push({ page: 'overview without tray', url: route.url, violations: plain.violations, incomplete: plain.incomplete,
          passedRules: plain.passes.map(rule => rule.id) });
        await page.getByRole('button', { name: /^Compare / }).first().click();
        await expect(page.getByLabel('Comparison selection')).toBeVisible();
      }
      if (route.name === 'suite') await page.locator('.suite-method > summary').click();
      if (route.name === 'tests' || route.name === 'suite') await page.getByText('Recorded evidence availability', { exact: true }).first().click();
      if (route.name === 'model') await expect(page.getByLabel('Thinking condition', { exact: true })).toBeVisible();
      if (route.name === 'comparison') {
        await page.getByRole('button', { name: 'Open recorded answers' }).click();
        await expect(page.locator('.evidence pre').first()).toBeVisible();
      }
      if (route.name === 'question') {
        await expect(page.locator('.evidence pre').first()).toBeVisible();
        await expect(page.locator('.grade-block .evidence[data-state=loading]')).toHaveCount(0);
        await page.getByText('Test machine and run settings', { exact: true }).click();
      }
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const obscuredContrast = [];
      for (const check of result.incomplete.filter(check => check.id === 'color-contrast')) {
        for (const node of check.nodes) {
          const target = node.target[0];
          if (typeof target !== 'string') continue;
          const contrast = await page.locator(target).first().evaluate(element => {
            const channels = (value: string) => value.match(/[\d.]+/g)?.map(Number) ?? [];
            const foreground = channels(getComputedStyle(element).color);
            let current: Element | null = element, background: number[] = [];
            while (current) {
              const style = getComputedStyle(current);
              if (style.backgroundImage !== 'none' || Number(style.opacity) !== 1) return null;
              const color = channels(style.backgroundColor);
              if (color.length === 3 || color[3] === 1) { background = color; break; }
              if (color[3] !== 0) return null;
              current = current.parentElement;
            }
            if (foreground.length < 3 || background.length < 3 || (foreground.length === 4 && foreground[3] !== 1)) return null;
            const luminance = (color: number[]) => color.slice(0, 3).map(value => value / 255)
              .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
              .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
            const a = luminance(foreground), b = luminance(background);
            return { foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
          });
          obscuredContrast.push({ target, contrast, scope: 'Computed text/background colors; occlusion itself still needs visual/scroll review.' });
          expect(contrast, `Review obscured contrast at ${target}`).not.toBeNull();
          expect(contrast!.ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
      reports.push({ page: route.name, url: route.url, violations: result.violations, incomplete: result.incomplete,
        passedRules: result.passes.map(rule => rule.id), obscuredContrast });
    }
    const report = { releaseId: release.release_id, theme, viewport: info.project.name, measuredAt: new Date().toISOString(),
      scope: 'Automated WCAG 2.1 A/AA rule checks on these rendered states. Manual keyboard and visual checks are recorded separately.', pages: reports };
    await mkdir('.publication-reports', { recursive: true });
    await writeFile(`.publication-reports/accessibility-${info.project.name}-${theme}.json`, JSON.stringify(report, null, 2) + '\n');
    expect(reports.flatMap(report => report.violations.map(violation => ({ page: report.page, id: violation.id,
      impact: violation.impact, targets: violation.nodes.map(node => node.target), summary: violation.nodes.map(node => node.failureSummary) })))).toEqual([]);
  });
}
