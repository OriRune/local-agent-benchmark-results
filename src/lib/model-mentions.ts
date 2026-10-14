export type ModelMention = { name: string; href: string };

// Longest exact names win, so a quant's name cannot link to a shorter sibling.
// Conflicting destinations stay plain text rather than guessing a configuration.
export function modelMentionParts(text: string, candidates: ModelMention[]) {
  const destinations = new Map<string, Set<string>>();
  for (const { name, href } of candidates) {
    if (!name || !href.startsWith('/') || href.startsWith('//')) continue;
    if (!destinations.has(name)) destinations.set(name, new Set());
    destinations.get(name)!.add(href);
  }
  const names = [...destinations.keys()].sort((a, b) => b.length - a.length);
  if (!names.length) return [{ text }];
  const pattern = new RegExp(names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
  const parts: { text: string; href?: string }[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!, stop = start + match[0].length;
    if (/[\p{L}\p{N}_]/u.test(text[start - 1] ?? '') || /[\p{L}\p{N}_]/u.test(text[stop] ?? '')) continue;
    if (start > end) parts.push({ text: text.slice(end, start) });
    const targets = destinations.get(match[0])!;
    parts.push({ text: match[0], ...(targets.size === 1 ? { href: [...targets][0] } : {}) });
    end = stop;
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}
