import { validatePreviews } from './preview-data.mjs';
import { cp, lstat, readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hash } from './public-data.mjs';
import { verifyRetained } from './retained-data.mjs';

const entries = ['src', 'scripts', 'contracts', 'tests', 'public', '.github',
  'package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json',
  'playwright.config.ts', 'vitest.config.ts', 'deployment-scan.json', 'vercel.json', '.vercelignore', 'README.md', '.gitignore'];
export async function packageSite(source, destination) {
  source = resolve(source); destination = resolve(destination);
  if (destination === source || destination.startsWith(source + '/')) throw new Error('Package destination must be outside the source package');
  await verifyRetained(join(source, 'public/data'));
  await validatePreviews(join(source, 'public'));
  const inventory = [];
  async function inspect(path) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error('Standalone package refuses symlinks');
    if (info.isDirectory()) { for (const name of (await readdir(path)).sort()) await inspect(join(path, name)); return; }
    if (!info.isFile()) throw new Error('Standalone package refuses non-regular files');
    inventory.push({ path: relative(source, path), bytes: info.size, sha256: hash(await readFile(path)) });
  }
  for (const entry of entries) await inspect(join(source, entry));
  await mkdir(destination); // New destination only; never overwrite user files.
  for (const entry of entries) await cp(join(source, entry), join(destination, entry), { recursive: true, errorOnExist: true, force: false });
  for (const record of inventory) if (hash(await readFile(join(destination, record.path))) !== record.sha256) throw new Error('Source changed while packaging; discard the incomplete destination');
  await writeFile(join(destination, 'PACKAGE_INVENTORY.json'), JSON.stringify({ version: 1, files: inventory }, null, 2) + '\n');
  return { files: inventory.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: npm run package:site -- /absolute/new/destination');
  const result = await packageSite(fileURLToPath(new URL('../', import.meta.url)), process.argv[2]);
  console.log(`Packaged ${result.files} files; no dependencies, build output, harness, credentials, or private receipts were copied.`);
}
