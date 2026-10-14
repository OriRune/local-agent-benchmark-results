const HASH = /^[a-f0-9]{64}$/, RELEASE = /^release-[a-f0-9]{64}$/;
export const emptyWithdrawals = () => ({ version: 1, objects: {}, editions: {} });
function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === expected.sort().join(',');
}
export function validateWithdrawals(value) {
  if (!keys(value, ['version', 'objects', 'editions']) || value.version !== 1) throw new Error('Unsupported withdrawal registry');
  for (const [kind, pattern, field, target] of [['objects', HASH, 'release_ids', RELEASE], ['editions', RELEASE, 'object_ids', HASH]]) {
    const rows = value[kind];
    if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.keys(rows).length > 40000) throw new Error('Invalid withdrawal inventory');
    for (const [id, row] of Object.entries(rows)) {
      if (!pattern.test(id) || !keys(row, ['reason', 'withdrawn_at', field]) || typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 500 ||
          typeof row.withdrawn_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.withdrawn_at) || !Number.isFinite(Date.parse(row.withdrawn_at)) || new Date(row.withdrawn_at).toISOString() !== row.withdrawn_at ||
          !Array.isArray(row[field]) || !row[field].length || row[field].some(x => typeof x !== 'string' || !target.test(x)) || new Set(row[field]).size !== row[field].length) throw new Error('Invalid withdrawal record');
    }
  }
  for (const [id, row] of Object.entries(value.objects)) for (const release of row.release_ids) if (!value.editions[release]?.object_ids.includes(id)) throw new Error('Unlinked object withdrawal');
  for (const [id, row] of Object.entries(value.editions)) for (const object of row.object_ids) if (!value.objects[object]?.release_ids.includes(id)) throw new Error('Unlinked edition withdrawal');
  return value;
}
export function withdrawalMessage(kind, row) {
  return `${kind} was intentionally withdrawn on ${row.withdrawn_at.slice(0, 10)}. ${row.reason}`;
}
