import { compileFromFile } from 'json-schema-to-typescript';
import { writeFile } from 'node:fs/promises';
for (const [name, filename] of [['dataset', 'public-contract'], ['release', 'public-release'], ['summary', 'public-summary'], ['quant-summary','public-quant-summary'], ['withdrawals', 'public-withdrawals']]) {
  const source = new URL(`../contracts/v1/${name}.schema.json`, import.meta.url);
  const target = new URL(`../src/lib/${filename}.d.ts`, import.meta.url);
  await writeFile(target, await compileFromFile(source.pathname, {
    bannerComment: `/* Generated from contracts/v1/${name}.schema.json. Do not edit. */`,
  }));
}
