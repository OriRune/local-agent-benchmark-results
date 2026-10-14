import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deploymentConfig, localHeaders } from '../../scripts/deployment-config.mjs';
const policy = JSON.parse(readFileSync('deployment-scan.json', 'utf8'));
const config = deploymentConfig(policy);
it('keeps committed deployment settings in sync and gates deployment on scans', () => {
  expect(JSON.parse(readFileSync('vercel.json', 'utf8'))).toEqual(config);
  expect(config.buildCommand).toContain('npm run scan:dist');
  expect(config.outputDirectory).toBe('dist');
  expect(config).not.toHaveProperty('rewrites');
});
it('separates mutable page/pointer caching from immutable objects and editions', () => {
  for (const path of ['/', '/models/example/', '/data/latest.json', '/data/editions.json']) {
    expect(localHeaders(config, path)['cache-control']).toBe('public, max-age=0, must-revalidate');
  }
  for (const path of ['/_astro/example.js', '/data/objects/sha256/example.json.gz', '/data/releases/release-example/release.json']) {
    expect(localHeaders(config, path)['cache-control']).toContain('immutable');
  }
  const evidence = localHeaders(config, '/data/objects/sha256/example.txt.gz');
  expect(evidence['content-type']).toBe('application/octet-stream');
  expect(evidence['content-disposition']).toBe('attachment');
  expect(evidence['content-security-policy']).toContain("default-src 'none'; sandbox");
  expect(evidence['x-content-type-options']).toBe('nosniff');
});
it('allows only the reviewed inline script hashes and same-origin application scripts', () => {
  const csp = localHeaders(config, '/')['content-security-policy']!;
  for (const hash of Object.keys(policy.inline_scripts)) expect(csp).toContain(`'sha256-${Buffer.from(hash, 'hex').toString('base64')}'`);
  expect(csp).toContain("script-src-attr 'none'");
  expect(csp).not.toContain('unsafe-eval');
  expect(csp.split(';').find((part: string) => part.trim().startsWith('script-src '))).not.toContain('unsafe-inline');
});
