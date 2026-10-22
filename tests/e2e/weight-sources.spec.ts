import {test,expect} from '@playwright/test';

test('prominent downloads follow the selected quant and retain immutable revisions',async({page})=>{
 await page.goto('/models/qwen9b/');const sources=page.getByRole('region',{name:'Get this tested model'});
 await expect(sources).toBeVisible();await expect(page.locator('#setup')).not.toHaveAttribute('open','');
 const config=page.getByLabel('Configuration',{exact:true});const option=config.locator('option').filter({hasText:'UD-Q2_K_XL'}).first();
 await config.selectOption((await option.getAttribute('value'))!);
 const link=sources.getByRole('link',{name:'Download tested GGUF'});
 await expect(link).toHaveAttribute('href',/huggingface\.co\/unsloth\/Qwen3\.5-9B-GGUF\/resolve\/[a-f0-9]{40}\/Qwen3\.5-9B-UD-Q2_K_XL\.gguf/);
 await expect(sources).toContainText('historical record does not include a full-file checksum');
 await page.reload();await expect(link).toHaveAttribute('href',/UD-Q2_K_XL\.gguf$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('split downloads expose every shard and cloud sources do not masquerade as GGUFs',async({page})=>{
 await page.goto('/models/flashnext/');const sources=page.locator('.model-sources');
 await expect(sources.getByRole('link',{name:/Download GGUF/})).toHaveCount(2);
 await expect(sources.getByRole('link',{name:/part 1 of 2/})).toHaveAttribute('href',/00001-of-00002\.gguf$/);
 await expect(sources.getByRole('link',{name:/part 2 of 2/})).toHaveAttribute('href',/00002-of-00002\.gguf$/);
 await page.goto('/models/cloud-gemma31-coreweave-cloud/');
 await expect(sources.getByRole('link',{name:'Open hosted model'})).toHaveAttribute('href','https://openrouter.ai/google/gemma-4-31b-it');
 await expect(sources).toContainText('not a downloadable GGUF');await expect(sources.getByRole('link',{name:/Download/})).toHaveCount(0);
 await page.goto('/models/lingflash/');await expect(sources).toContainText('Download source not verified');await expect(sources.getByRole('link',{name:/Download/})).toHaveCount(0);
});
