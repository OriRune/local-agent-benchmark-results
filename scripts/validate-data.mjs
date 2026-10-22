import { validatePreviews } from './preview-data.mjs';
import { fileURLToPath } from 'node:url';
import { verifyRetained } from './retained-data.mjs';
const root = fileURLToPath(new URL('../public/data/', import.meta.url));
const result = await verifyRetained(root);
console.log(`Validated ${result.editions.length} retained edition(s); selected ${result.selected}`);

const previews = await validatePreviews(fileURLToPath(new URL('../public/', import.meta.url)));
console.log(`Validated ${previews.previews} saved-page preview records.`);
