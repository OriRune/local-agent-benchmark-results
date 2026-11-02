import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  trailingSlash: 'always',
  // Keep EQ chart, sorting and search clients external to comply with the inline-script allowlist.
  vite: { build: { sourcemap: false, assetsInlineLimit: (file) => ['Radar.astro', 'Frame.astro'].some(name => file.includes(name)) ? false : undefined } },
});
