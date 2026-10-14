import { expect, it } from 'vitest';
import { csvCell } from '../../src/lib/csv';
import { deploymentConfig, localHeaders } from '../../scripts/deployment-config.mjs';
it('quotes metadata and neutralizes spreadsheet formulas without changing numeric measurements', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-formula', '@command', '  =formula', '\tformula', '\nformula']) expect(csvCell(value)).toBe('"\'' + value + '"');
  expect(csvCell('alpha,"β"\nline')).toBe('"alpha,""β""\nline"');
  expect(csvCell(-2.5)).toBe('"-2.5"');
  expect(csvCell(0)).toBe('"0"');
  expect(csvCell(null)).toBe('""');
  expect(csvCell(false)).toBe('"false"');
});
it('serves CSV as a revalidated download with inert content typing', () => {
  const headers = localHeaders(deploymentConfig({ inline_scripts: {} }), '/results.csv');
  expect(headers['content-type']).toBe('text/csv; charset=utf-8');
  expect(headers['content-disposition']).toContain('attachment');
  expect(headers['cache-control']).toContain('must-revalidate');
  expect(headers['x-content-type-options']).toBe('nosniff');
});
