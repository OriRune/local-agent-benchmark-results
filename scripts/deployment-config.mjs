import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical } from '../src/lib/canonical.mjs';

export function deploymentConfig(policy) {
  const hashes = Object.keys(policy.inline_scripts).sort().map(hash => `'sha256-${Buffer.from(hash, 'hex').toString('base64')}'`).join(' ');
  const csp = `default-src 'self'; script-src 'self' ${hashes}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`;
  const rule = (source, values) => ({ source, headers: Object.entries(values).map(([key, value]) => ({ key, value })) });
  const immutable = 'public, max-age=31536000, immutable';
  const revalidate = 'public, max-age=0, must-revalidate';
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json', framework: 'astro',
    installCommand: 'npm ci', buildCommand: 'npm run deployment:check && npm run check && npm run build && npm run scan:dist',
    outputDirectory: 'dist', trailingSlash: true,
    headers: [
      rule('/(.*)', { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' }),
      rule('/((?!data/).*)', { 'Content-Security-Policy': csp }),
      rule('/((?!data/|_astro/).*)', { 'Cache-Control': revalidate }),
      rule('/results.csv', { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="results.csv"', 'Cache-Control': revalidate }),
      rule('/_astro/(.*)', { 'Cache-Control': immutable }),
      rule('/data/(.*)', { 'Content-Security-Policy': "default-src 'none'; sandbox; frame-ancestors 'none'" }),
      rule('/data/objects/(.*)', { 'Cache-Control': immutable, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment' }),
      rule('/data/releases/(.*)', { 'Cache-Control': immutable }),
      rule('/data/latest.json', { 'Cache-Control': revalidate }),
      rule('/data/editions.json', { 'Cache-Control': revalidate }),
      rule('/data/withdrawals.json', { 'Cache-Control': 'no-store' }),
    ],
  };
}
// This small matcher is only for local policy tests, not a Vercel router emulator.
export function localHeaders(config, pathname) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const rule of config.headers) {
    const expression = rule.source.includes('(') ? rule.source : rule.source.replace(/[.]/g, '\\.');
    if (new RegExp(`^${expression}$`).test(pathname)) for (const item of rule.headers) values[item.key.toLowerCase()] = item.value;
  }
  return values;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const policy = JSON.parse(await readFile(new URL('../deployment-scan.json', import.meta.url), 'utf8'));
  const expected = deploymentConfig(policy), target = new URL('../vercel.json', import.meta.url);
  if (process.argv.includes('--write')) await writeFile(target, JSON.stringify(expected, null, 2) + '\n');
  else if (canonical(JSON.parse(await readFile(target, 'utf8'))) !== canonical(expected)) throw new Error('Vercel config differs from the reviewed deployment policy. Regenerate and review it.');
  console.log('Vercel static deployment policy verified.');
}
