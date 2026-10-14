import type { PublicBenchmarkFactsV1, CategoryPolicy, Checkpoint, MemoryFit } from './public-contract';
type Data = Pick<PublicBenchmarkFactsV1,'category_policy'|'memory_fits'|'configurations'>;
export const DEFAULT_CATEGORY_POLICY: CategoryPolicy;
export function categoryPolicy(data: Pick<Data,'category_policy'>): CategoryPolicy;
export function parameterBand(checkpoint: Checkpoint, policy?: CategoryPolicy): string | null;
export function memoryProfile(fit: MemoryFit): Record<string,string|number>;
export function verifiedFits(data: Pick<Data,'memory_fits'>, configurationId: string): MemoryFit[];
export function memoryFits(data: Pick<Data,'memory_fits'>, configurationId: string, options?: {budget?:number;type?:MemoryFit['memory_type'];estimates?:boolean}): MemoryFit[];
export function validateCategories(data: Data): void;
