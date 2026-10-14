import {expect,test} from '@playwright/test';

test('native reasoning versions link to their Instruct family and original answers',async({page})=>{
 await page.goto('/models/lfm12b_thinking/');
 await expect(page.getByRole('heading',{name:'Instruct vs Thinking / Reasoning',exact:true})).toBeVisible();
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Instruct vs Thinking / Reasoning',exact:true})});
 await expect(section).toContainText('separate GGUF checkpoints');
 await expect(section.getByRole('link',{name:'Answers and code'})).toHaveCount(2);
 await expect(page.getByText('No verified on/off comparison is available',{exact:false})).toBeVisible();
 await section.getByRole('link',{name:'Compare',exact:true}).click();
 await expect(page).toHaveURL(/\/compare\/\?release=/);
 await expect(page.locator('main')).toContainText('LFM');
 await expect(page.getByText('Unknown configuration',{exact:false})).toHaveCount(0);
 await expect(page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).resolves.toBe(true);
});

test('quant comparison is shared across the selected checkpoint',async({page})=>{
 await page.goto('/models/ornith9b/');
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Weight formats compared',exact:true})});
 await expect(section).toBeVisible();
 await expect(section).toContainText('Q5_K_M');
 await expect(section).toContainText('Q8_0');
 await expect(section.getByRole('link',{name:'Answers and code'})).toHaveCount(4);
 await expect(page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).resolves.toBe(true);
});
