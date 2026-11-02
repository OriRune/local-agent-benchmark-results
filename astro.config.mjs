import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  trailingSlash: 'always',
  // Keep the EQ chart client external to comply with the inline-script allowlist.
  vite: { build: { sourcemap: false, assetsInlineLimit: (file) => file.includes('Radar.astro') ? false : undefined } },
});
