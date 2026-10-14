import { describe, expect, it } from 'vitest';
import { evidencePages, evidencePageAt, findEvidence } from '../../src/lib/evidence-pages';

describe('complete paginated evidence', () => {
  it('preserves every character, including whitespace, astral Unicode and CRLF boundaries', () => {
    for (const text of ['', '   \n\t', 'a'.repeat(7) + '😀\r\n' + 'z'.repeat(90), 'x\r\n'.repeat(50)]) {
      const offsets = evidencePages(text, 8);
      const parts = offsets.slice(0, -1).map((start, i) => text.slice(start, offsets[i + 1]));
      expect(parts.join('')).toBe(text);
      expect(parts.every(part => part.length <= 8)).toBe(true);
      expect(parts.every(part => !/[\ud800-\udbff]$/.test(part) && !/^\n/.test(part))).toBe(true);
      for (let i = 0; i < text.length; i++) {
        const page = evidencePageAt(offsets, i);
        expect(offsets[page]).toBeLessThanOrEqual(i);
        expect(offsets[page + 1]).toBeGreaterThan(i);
      }
    }
  });
  it('finds literal matches across page boundaries and wraps in either direction', () => {
    const text = '0123456[.*]----[.*]';
    const offsets = evidencePages(text, 8);
    expect(findEvidence(text, '[.*]')).toBe(7);
    expect(findEvidence(text, '[.*]', 7)).toBe(15);
    expect(findEvidence(text, '[.*]', 15)).toBe(7);
    expect(findEvidence(text, '[.*]', 7, true)).toBe(15);
    expect(findEvidence(text, '[.*]', 15, true)).toBe(7);
    expect(evidencePageAt(offsets, 15)).toBe(1);
    expect(findEvidence(text, 'missing')).toBe(-1);
    expect(findEvidence(text, '')).toBe(-1);
  });
});
