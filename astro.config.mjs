// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// site is required for sitemap.xml (it needs a base URL to build absolute
// links) and doubles as the base for the canonical/OG/Twitter tags in
// Layout.astro. www is the canonical host (matches the site's own SEO
// report: "Final URL: https://www.favianizza.space/").
// https://astro.build/config
export default defineConfig({
  site: 'https://www.favianizza.space',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});