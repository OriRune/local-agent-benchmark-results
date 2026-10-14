// Display boundaries only. Original verified bytes remain the download source.
export function evidencePages(text: string, size = 24_000): number[] {
  if (!Number.isInteger(size) || size < 2) throw new Error('Invalid evidence page size');
  const offsets = [0];
  while (offsets.at(-1)! < text.length) {
    const start = offsets.at(-1)!;
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end - 1);
      if (newline >= start + size / 2) end = newline + 1;
      // Never split a surrogate pair or a CRLF sequence between pages.
      if ((text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff &&
           text.charCodeAt(end) >= 0xdc00 && text.charCodeAt(end) <= 0xdfff) ||
          (text[end - 1] === '\r' && text[end] === '\n')) end--;
    }
    offsets.push(end);
  }
  if (offsets.length === 1) offsets.push(0);
  return offsets;
}

export function evidencePageAt(offsets: number[], position: number): number {
  let low = 0, high = offsets.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= position) low = middle; else high = middle - 1;
  }
  return low;
}

// Search the complete text, including matches crossing display boundaries.
// No regular expressions or unbounded array of match locations.
export function findEvidence(text: string, query: string, current = -1, backwards = false): number {
  if (!query) return -1;
  if (backwards) {
    const found = current > 0 ? text.lastIndexOf(query, current - 1) : -1;
    return found >= 0 ? found : text.lastIndexOf(query);
  }
  const found = text.indexOf(query, current + 1);
  return found >= 0 ? found : text.indexOf(query);
}
