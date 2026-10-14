import defaultPolicy from './category-policy.json' with { type: 'json' };
export const DEFAULT_CATEGORY_POLICY = defaultPolicy;
export const categoryPolicy = data => data.category_policy ?? defaultPolicy;
export function parameterBand(checkpoint, policy = defaultPolicy) {
  const value = checkpoint.parameters?.total_billions ?? null;
  if (value === null || !checkpoint.parameters?.provenance) return null;
  return policy.parameter_bands.find(b => b.min_billions <= value && (b.max_billions === null || value < b.max_billions))?.id ?? null;
}
export const memoryProfile = fit => Object.fromEntries(['memory_type', 'runtime', 'runtime_build', 'context_tokens', 'concurrency', 'other_memory_gb'].map(k => [k, k === 'memory_type' ? fit[k] : fit.profile[k]]));
export const verifiedFits = (data, configurationId) => (data.memory_fits ?? []).filter(f => f.configuration_id === configurationId && f.status === 'verified');
export function memoryFits(data, configurationId, { budget, type = 'system_ram', estimates = false } = {}) {
  return (data.memory_fits ?? []).filter(f => f.configuration_id === configurationId && f.memory_type === type && (estimates || f.status === 'verified') && (budget === undefined || f.budget_gb <= budget)).sort((a,b) => a.budget_gb-b.budget_gb || a.id.localeCompare(b.id));
}
export function validateCategories(data) {
  const policy = categoryPolicy(data), bands = policy.parameter_bands;
  if (new Set(bands.map(b => b.id)).size !== bands.length) throw new Error('Duplicate category ID');
  bands.forEach((b,i) => { if (b.max_billions !== null && b.max_billions <= b.min_billions || i && (bands[i-1].max_billions === null || b.min_billions < bands[i-1].max_billions)) throw new Error('Overlapping or unordered categories'); });
  if (policy.memory_budgets_gb.some((b,i,a) => i && b <= a[i-1])) throw new Error('Memory budgets must increase');
  const seen = new Set();
  for (const fit of data.memory_fits ?? []) {
    if (seen.has(fit.id)) throw new Error('Duplicate memory-fit evidence'); seen.add(fit.id);
    const c = data.configurations.find(c => c.id === fit.configuration_id), p = fit.profile;
    if (!c || !policy.memory_budgets_gb.includes(fit.budget_gb) || fit.headroom_gb >= fit.budget_gb) throw new Error('Invalid memory tier');
    if (c.runtime !== p.runtime || c.runtime_build !== p.runtime_build || c.observed.context !== p.context_tokens || c.observed.gpu_layers !== p.gpu_layers || c.concurrency !== p.concurrency) throw new Error('Memory fit differs from tested profile');
    if (fit.memory_type === 'system_ram' && p.gpu_layers !== 0 || fit.status === 'verified' && fit.headroom_gb <= 0) throw new Error('Invalid memory fit profile or headroom');
  }
}
