import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parse, walkSync, ELEMENT_NODE } from 'ultrahtml';
import { hash } from './public-data.mjs';
import { verifyRetained } from './retained-data.mjs';

const secrets = [
  ['provider-token', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}/],
  ['service-token', /\b(?:ghp_|github_pat_|hf_)[A-Za-z0-9_]{24,}/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9_.-]{24,}/i],
  ['aws-access-key', /\bAKIA[A-Z0-9]{16}\b/],
];
const maxBytes = 128 * 1024 ** 2;
function decoded(text) {
  return text.replace(/\\u([a-f\d]{4})|\\x([a-f\d]{2})/gi, (_, u, x) => String.fromCharCode(parseInt(u || x, 16)))
    .replace(/\\\//g, '/').replace(/&#(x[a-f\d]+|\d+);?/gi, (_, value) => {
      const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&colon;/gi, ':').replace(/&tab;|&newline;/gi, '');
}
export function inspectText(text, policy) {
  const variants = [text, decoded(text)]; const found = new Set();
  for (const value of variants) {
    if (policy.forbidden_literals.some(literal => value.includes(literal))) found.add('private-identifier');
    for (const [rule, pattern] of secrets) if (pattern.test(value)) found.add(rule);
  }
  return [...found];
}
export function inspectHtml(text, policy) {
  const found = new Set();
  walkSync(parse(text), node => {
    if (node.type !== ELEMENT_NODE) return;
    const name = node.name.toLowerCase(), attributes = Object.fromEntries(Object.entries(node.attributes).map(([key, value]) => [key.toLowerCase(), decoded(value)]));
    if (['iframe', 'object', 'embed', 'base', 'form', 'svg', 'math'].includes(name)) found.add('active-element');
    for (const [key, value] of Object.entries(attributes)) {
      if (/^on/i.test(key) || key === 'srcdoc') found.add('active-attribute');
      if (['href', 'src', 'action', 'formaction', 'xlink:href', 'poster'].includes(key)) {
        const clean = value.replace(/[\u0000-\u0020]/g, '');
        if (/^(?:javascript|vbscript|data):/i.test(clean)) found.add('active-url');
        if (key !== 'href' && /^(?:[a-z]+:|\/\/)/i.test(clean)) found.add('remote-resource');
        if (name === 'link' && key === 'href' && /^(?:[a-z]+:|\/\/)/i.test(clean)) found.add('remote-resource');
      }
      if (key === 'srcset' || (key === 'style' && /url\s*\(|expression\s*\(/i.test(value))) found.add('unexpected-resource-style');
      if (['component-url', 'renderer-url', 'before-hydration-url'].includes(key) && !/^\/_astro\/[A-Za-z\d_.-]+\.js$/.test(value)) found.add('unapproved-island-source');
    }
    if (name === 'meta' && attributes['http-equiv']) found.add('http-equiv');
    if (name === 'script') {
      if (attributes.src) {
        if (!/^\/_astro\/[A-Za-z\d_.-]+\.js$/.test(attributes.src)) found.add('unapproved-script-source');
      } else {
        const script = node.children.map(child => child.value || '').join('');
        if (!Object.hasOwn(policy.inline_scripts, hash(script))) found.add('unapproved-inline-script');
      }
    }
  });
  return [...found];
}
export async function scanDist(root, policy) {
  root = resolve(root);
  if (policy.version !== 1 || !Array.isArray(policy.forbidden_literals) || !policy.forbidden_literals.every(v => typeof v === 'string' && v) ||
      !policy.inline_scripts || !Array.isArray(policy.exceptions)) throw new Error('Invalid deployment scan policy');
  for (const item of policy.exceptions) if (!item.path || !/^[a-f0-9]{64}$/.test(item.sha256) || !item.rule || !item.reason) throw new Error('Invalid narrow scan exception');
  const findings = []; const allowedData = new Set(['latest.json', 'editions.json', 'withdrawals.json']);
  const add = (path, rule, sha256 = null) => {
    if (!policy.exceptions.some(e => e.path === path && e.rule === rule && e.sha256 === sha256)) findings.push({ path, rule, sha256 });
  };
  let editions = [];
  try {
    ({ editions } = await verifyRetained(join(root, 'data')));
    for (const id of editions) {
      const path = `releases/${id}/release.json`; allowedData.add(path);
      const manifest = JSON.parse(await readFile(join(root, 'data', path), 'utf8'));
      for (const object of manifest.objects) allowedData.add(object.path);
    }
  } catch { add('data', 'invalid-retained-release-graph'); }
  let files = 0, decodedBytes = 0;
  async function visit(relative = '') {
    const path = join(root, relative); const stat = await lstat(path);
    if (stat.isSymbolicLink()) { add(relative, 'symlink'); return; }
    if (stat.isDirectory()) { for (const name of await readdir(path)) await visit(relative ? `${relative}/${name}` : name); return; }
    if (!stat.isFile()) { add(relative, 'non-regular-file'); return; }
    files++;
    const data = relative.startsWith('data/');
    const allowed = data ? allowedData.has(relative.slice(5)) :
      /^(?:index\.html|results\.csv|(?:archive|compare|editions|evidence|heatmap|methodology|models|questions|tests)(?:\/[A-Za-z\d_.-]+)?\/index\.html|_astro\/[A-Za-z\d_.-]+\.(?:js|css))$/.test(relative);
    if (!allowed) add(relative, 'unexpected-file');
    if (stat.size > maxBytes) { add(relative, 'oversized-file'); return; }
    const raw = await readFile(path); let bytes;
    try { bytes = relative.endsWith('.gz') ? gunzipSync(raw, { maxOutputLength: maxBytes }) : raw; }
    catch { add(relative, 'invalid-or-oversized-gzip'); return; }
    decodedBytes += bytes.length; const digest = hash(bytes), text = bytes.toString('utf8');
    for (const rule of inspectText(text, policy)) add(relative, rule, digest);
    if (!data && relative.endsWith('.html')) for (const rule of inspectHtml(text, policy)) add(relative, rule, digest);
    if (!data && relative.endsWith('.css') && /@import|url\s*\(|expression\s*\(/i.test(text)) add(relative, 'unexpected-css-resource', digest);
  }
  await visit();
  return { version: 1, valid: findings.length === 0, files, decoded_bytes: decodedBytes, retained_editions: editions.length, findings };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const policy = JSON.parse(await readFile(new URL('../deployment-scan.json', import.meta.url), 'utf8'));
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  const report = await scanDist(root, policy);
  const destination = fileURLToPath(new URL('../.publication-reports/scan-dist.json', import.meta.url));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`Deployment scan ${report.valid ? 'passed' : 'failed'}: ${report.files} files, ${report.findings.length} findings. See the private .publication-reports/scan-dist.json report; no matched values are logged.`);
  if (!report.valid) process.exitCode = 1;
}
