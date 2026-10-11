import type { AssetInput, AssocieInput } from '@shared/schemas.js';
import { partsAreValid } from './partsAssocies';

/**
 * The real-estate pages, one step at a time, described as data: the steps,
 * which ones show, and what looks incomplete. No React here, so the step bar,
 * the recap and the tests read the same rules. A step is never a gate: the
 * user can move on with empty fields, the alerts only say what is missing.
 */

export type VueLocatif = 'accueil' | 'parcours' | 'resultats';

export type EtapeImmoId = 'projet' | 'bien' | 'financement' | 'loyers' | 'proprietaires' | 'hypotheses' | 'resultat';

export interface EtapeImmo {
  id: EtapeImmoId;
  titre: string;
  court: string;
  aide: string;
}

export const ETAPES_IMMO: EtapeImmo[] = [
  { id: 'projet', titre: 'Votre projet', court: 'Projet', aide: 'Quelques questions pour n’afficher que ce qui vous concerne.' },
  { id: 'bien', titre: 'Le bien', court: 'Bien', aide: 'Prix, frais de notaire, travaux, mobilier.' },
  { id: 'financement', titre: 'Le financement', court: 'Financement', aide: 'Le pret et ce qu’il reste a apporter.' },
  { id: 'loyers', titre: 'Loyers et charges', court: 'Loyers', aide: 'Ce que le bien rapporte et ce qu’il coute chaque annee.' },
  { id: 'proprietaires', titre: 'Les proprietaires', court: 'Proprietaires', aide: 'Qui detient le bien, et le foyer fiscal de chacun.' },
  { id: 'hypotheses', titre: 'Hypotheses', court: 'Hypotheses', aide: 'Horizon, inflation, revente ou transmission, couts de structure. Deja pre-remplies.' },
  { id: 'resultat', titre: 'Recapitulatif', court: 'Resultat', aide: 'Verifiez, puis comparez les montages.' },
];

/** What the steps read of the page's inputs. */
export interface SaisieImmo {
  asset: AssetInput;
  associes: AssocieInput[];
}

/** Steps shown for these inputs: without a loan, no financing step. */
export function etapesVisibles(s: SaisieImmo): EtapeImmo[] {
  return ETAPES_IMMO.filter((e) => e.id !== 'financement' || !!s.asset.loan);
}

const n = (x: string | undefined) => parseFloat(x ?? '0') || 0;

/** What looks incomplete or inconsistent at this step, in plain French. */
export function alertes(etape: EtapeImmoId, s: SaisieImmo): string[] {
  const a = s.asset;
  const out: string[] = [];
  if (etape === 'bien') {
    if (n(a.purchasePrice) <= 0) out.push('Le prix d’achat est vide.');
    if (n(a.purchasePrice) > 0 && n(a.notaryFees) <= 0) out.push('Pas de frais de notaire : environ 7 a 8 % dans l’ancien, 2 a 3 % dans le neuf.');
  }
  if (etape === 'financement' && a.loan) {
    const cout = n(a.purchasePrice) + n(a.notaryFees) + n(a.renovationCosts) + n(a.mobilier);
    if (n(a.loan.principal) <= 0) out.push('Le montant emprunte est vide.');
    if (cout > 0 && n(a.loan.principal) > cout) out.push('Le pret depasse le cout total de l’operation.');
  }
  if (etape === 'loyers') {
    if (n(a.annualRent) <= 0) out.push('Le loyer annuel est vide : aucun revenu ne sera simule.');
    if (n(a.propertyTax) <= 0) out.push('Pas de taxe fonciere : elle est due par tout proprietaire.');
  }
  if (etape === 'proprietaires') {
    if (s.associes.length === 0) out.push('Aucun proprietaire.');
    else if (!partsAreValid(s.associes)) out.push('La repartition des parts doit totaliser 100 %.');
  }
  return out;
}
