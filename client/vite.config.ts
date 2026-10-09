import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { CHEMINS, type Route } from './src/lib/routes';
import { META, enteteHtml, robotsTxt, sitemapXml } from './src/lib/seo';

const SEO = /<!--seo:debut-->[\s\S]*?<!--seo:fin-->/;
const bloc = (route: Route) => `<!--seo:debut-->\n    ${enteteHtml(route)}\n    <!--seo:fin-->`;

/**
 * One HTML file per page, each with its own title, description and preview
 * tags, so crawlers and link previews get them without JavaScript. nginx
 * serves /outils/credit from outils/credit.html (try_files $uri.html); the
 * app itself is the same bundle everywhere. Plus sitemap.xml and robots.txt.
 */
function pagesSeo(): Plugin {
  let dist = '';
  return {
    name: 'patrimonia-pages-seo',
    configResolved(c) {
      dist = path.resolve(c.root, c.build.outDir);
    },
    // The home page, in dev as well as in the build.
    transformIndexHtml: (html) => html.replace(SEO, bloc('accueil')),
    writeBundle() {
      const base = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
      for (const route of Object.keys(META) as Route[]) {
        const chemin = CHEMINS[route];
        if (chemin === '/') continue;
        const fichier = path.join(dist, `${chemin}.html`);
        fs.mkdirSync(path.dirname(fichier), { recursive: true });
        fs.writeFileSync(fichier, base.replace(SEO, bloc(route)));
      }
      fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemapXml());
      fs.writeFileSync(path.join(dist, 'robots.txt'), robotsTxt());
    },
  };
}

export default defineConfig(({ mode }) => {
  // The Supabase project is configured once, in server/.env: the dev server
  // reads SUPABASE_URL from there to relay /supabase like nginx does.
  const { SUPABASE_URL } = loadEnv(mode, path.resolve(__dirname, '../server'), 'SUPABASE_');

  return {
    plugins: [react(), pagesSeo()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        // Same relay as nginx in production (see src/lib/supabase.ts): the
        // browser only ever talks to its own origin. Authentication only.
        ...(SUPABASE_URL && {
          '/supabase/auth/v1': {
            target: SUPABASE_URL,
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/supabase/, ''),
          },
        }),
      },
    },
  };
});
