import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ANCIENS_CHEMINS, CHEMINS, type Route } from '@/lib/routes';
import { FRONTALIERS, INVESTISSEMENT_LOCATIF, RUBRIQUES, SIMULATEURS } from '@/lib/navigation';
import { META, sitemapXml } from '@/lib/seo';

describe('menus', () => {
  it('should split the advanced simulators into Frontaliers and Investissement locatif', () => {
    expect(RUBRIQUES.map((r) => r.titre)).toEqual(['Frontaliers', 'Investissement locatif']);
    expect(FRONTALIERS.map((e) => e.route)).toEqual(['frontalier', 'prevoyance']);
    expect(INVESTISSEMENT_LOCATIF.map((e) => e.route)).toEqual(['sci', 'saisonnier']);
  });

  it('should list each simulator once, under the path of its family', () => {
    const routes = SIMULATEURS.map((s) => s.route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const e of FRONTALIERS) expect(CHEMINS[e.route]).toMatch(/^\/frontalier\//);
    for (const e of INVESTISSEMENT_LOCATIF) expect(CHEMINS[e.route]).toMatch(/^\/locatif\//);
  });
});

describe('old paths', () => {
  const nginx = fs.readFileSync(path.resolve(__dirname, '../../../client/nginx.conf.template'), 'utf8');

  it.each(Object.entries(ANCIENS_CHEMINS))('%s should lead to its page, in the router and in nginx', (ancien, route) => {
    expect(Object.values(CHEMINS)).not.toContain(ancien);
    expect(nginx).toContain(`location = ${ancien} { return 301 ${CHEMINS[route as Route]}$is_args$args; }`);
  });

  it('should keep nginx redirects relative (it only sees http behind Caddy)', () => {
    expect(nginx).toMatch(/^\s*absolute_redirect off;/m);
  });
});

describe('account page', () => {
  it('should be neither indexed nor in the sitemap', () => {
    expect(CHEMINS.compte).toBe('/compte');
    expect(META.compte).toMatchObject({ indexer: false, sitemap: false });
    expect(sitemapXml()).not.toContain('/compte');
  });
});
