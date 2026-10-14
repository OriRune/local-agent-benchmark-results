import { fileURLToPath } from 'node:url';
import { verifyRetained } from './retained-data.mjs';
const root = fileURLToPath(new URL('../public/data/', import.meta.url));
const result = await verifyRetained(root);
console.log(`Validated ${result.editions.length} retained edition(s); selected ${result.selected}`);
