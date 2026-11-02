export interface RadarAxis { key: string; label: string; shortLabel: string[] }
export interface RadarSeries { id: string; label: string; values: (number | null)[] }
export const isScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function mean(values: unknown[]): number | null {
  const scored = values.filter(isScore);
  return scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
}
export function point(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
  return { x: 220 + Math.cos(angle) * radius, y: 200 + Math.sin(angle) * radius };
}
export function geometry(values: (number | null)[], minimum: number) {
  const points = values.map((value, index) => isScore(value)
    ? point(index, values.length, 120 * Math.max(0, Math.min(1, (value - minimum) / (10 - minimum)))) : null);
  const complete = points.length >= 3 && points.every(p => p !== null);
  const path = complete ? points.map((p, i) => `${i ? 'L' : 'M'}${p!.x},${p!.y}`).join(' ') + ' Z'
    : points.map((p, i) => {
      const next = points[(i + 1) % points.length];
      return p && next ? `M${p.x},${p.y} L${next.x},${next.y}` : '';
    }).join(' ');
  return { points, path, complete };
}
