import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Decimal from 'decimal.js';
import { FrontalierRequestSchema } from '@shared/frontalier.js';
import { CANTONS, comparerAuDecompte, simulateFrontalier } from '../engine/frontalier/index.js';
import { CasReelSchema, type CasReel } from './cas-reels/format.js';

/**
 * The engine held against real assessments. Each JSON file of cas-reels/ is
 * one household; see cas-reels/README.md. A case waits (skipped, with the
 * reason) while its year or its canton is not in the engine yet, or while
 * its expected figures are still empty.
 */
const DOSSIER = path.join(__dirname, 'cas-reels');

const fichiers = fs
  .readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.json'))
  .sort();

function charger(fichier: string): CasReel {
  return CasReelSchema.parse(JSON.parse(fs.readFileSync(path.join(DOSSIER, fichier), 'utf8')));
}

/** Why a case cannot run yet, or null. */
function enAttente(cas: CasReel): string | null {
  const module = CANTONS[cas.source.canton];
  if (!module.disponible) return `canton ${module.nom} pas encore calcule`;
  if (module.annee !== cas.source.annee) return `bareme ${cas.source.annee} non charge (le moteur calcule ${module.annee})`;
  if (Object.keys(cas.attendu).length === 0) return 'montants du decompte a completer';
  return null;
}

function tableau(cas: CasReel): string {
  const result = simulateFrontalier(FrontalierRequestSchema.parse(cas.requete));
  return comparerAuDecompte(result, cas.attendu)
    .map((l) => `  ${l.libelle.padEnd(34)} calcule ${l.calcule.padStart(12)}  reel ${l.reel.padStart(12)}  ecart ${l.ecart.padStart(10)}`)
    .join('\n');
}

function dansLaTolerance(cas: CasReel): boolean {
  const result = simulateFrontalier(FrontalierRequestSchema.parse(cas.requete));
  const tolerance = new Decimal(cas.tolerance);
  return comparerAuDecompte(result, cas.attendu).every((l) => new Decimal(l.ecart).abs().lte(tolerance));
}

describe('cas reels — format', () => {
  it('should find the folder', () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });

  it.each(fichiers)('%s should be a valid, anonymised case', (fichier) => {
    const cas = charger(fichier);
    expect(cas.id).toBe(fichier.replace(/\.json$/, ''));
    expect(cas.id.startsWith(`${cas.source.annee}-${cas.source.canton.toLowerCase()}-`)).toBe(true);

    // Anonymised: no first name, no property label, nothing but figures.
    const req = cas.requete as { contribuable?: { prenom?: string }; conjoint?: { prenom?: string }; biensFrance?: { label?: string }[] };
    expect(req.contribuable?.prenom ?? '').toBe('');
    expect(req.conjoint?.prenom ?? '').toBe('');
    for (const b of req.biensFrance ?? []) expect(b.label ?? '').toBe('');
  });
});

describe('cas reels — le moteur contre les decomptes', () => {
  for (const fichier of fichiers) {
    const cas = charger(fichier);
    const attente = enAttente(cas);
    const nom = `${cas.id}${cas.exemple ? ' (exemple, pas un decompte)' : ''} — ${cas.description}`;

    if (attente) {
      it.skip(`${nom} [${attente}]`, () => {});
    } else if (cas.ecartConnu) {
      // Expected to miss: when it stops missing, this fails and asks to drop `ecartConnu`.
      it(`${nom} [ecart connu : ${cas.ecartConnu}]`, () => {
        expect(dansLaTolerance(cas), `Le moteur retrouve maintenant ce decompte : retirez « ecartConnu ».\n${tableau(cas)}`).toBe(false);
      });
    } else {
      it(nom, () => {
        expect(dansLaTolerance(cas), `Ecart au-dela de ${cas.tolerance} CHF :\n${tableau(cas)}`).toBe(true);
      });
    }
  }
});
