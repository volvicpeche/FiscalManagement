import Decimal from 'decimal.js';
import type { FrontalierRequest, PersonneFrontalier, Test90Result } from '@shared/frontalier.js';
import {
  INTERETS_PASSIFS_FRANCHISE,
  PILIER_3A_AVEC_LPP,
  PILIER_3A_SANS_LPP,
  PILIER_3A_SANS_LPP_TAUX,
  SEUIL_QUASI_RESIDENT,
} from '../baremesFederaux.js';

/**
 * What every canton shares: the household, the 90 % test, the net income of
 * the French properties, the rate set on worldwide income, and the
 * deductions that are identical at the IFD and in every cantonal law (LHID).
 */

export const ZERO = new Decimal(0);
export const d = (s: Decimal.Value) => new Decimal(s);
export const sum = (xs: Decimal[]) => xs.reduce((a, b) => a.plus(b), ZERO);
export const clamp = (x: Decimal, min: Decimal, max: Decimal) => Decimal.min(Decimal.max(x, min), max);
export const positive = (x: Decimal) => Decimal.max(x, ZERO);

/** Every deduction the engine knows, in the order of the tax return. */
export const DEDUCTIONS = {
  COTISATIONS: 'Cotisations AVS/AI/APG/AC/AANP',
  LPP: 'Cotisations LPP ordinaires',
  RACHATS_LPP: 'Rachats LPP',
  PILIER_3A: 'Pilier 3a',
  FRAIS_PRO: 'Frais professionnels',
  FORMATION: 'Formation continue',
  ASSURANCES: 'Primes d\'assurances',
  INTERETS_PASSIFS: 'Interets passifs',
  PENSION: 'Pension alimentaire',
  FRAIS_GARDE: 'Frais de garde',
  // Geneva grants it at the IFD only; revisit the label when a canton grants its own.
  DOUBLE_REVENU: 'Double revenu (IFD)',
  FRAIS_MEDICAUX: 'Frais medicaux',
  DONS: 'Dons',
  CHARGES_FAMILLE: 'Deductions sociales (enfants, couple)',
} as const;
export type CodeDeduction = keyof typeof DEDUCTIONS;
export const ORDRE_DEDUCTIONS = Object.keys(DEDUCTIONS) as CodeDeduction[];

// ─── Foyer ───────────────────────────────────────────────────────────────────

export interface Foyer {
  req: FrontalierRequest;
  fx: Decimal;
  marie: boolean;
  /** Single parent living with dependent children: splitting and bareme parental. */
  parentSeul: boolean;
  membres: PersonneFrontalier[];
  suisses: PersonneFrontalier[];
  nbEnfants: number;
}

export function foyer(req: FrontalierRequest): Foyer {
  const marie = req.etatCivil === 'MARIE';
  const membres = marie && req.conjoint ? [req.contribuable, req.conjoint] : [req.contribuable];
  return {
    req,
    fx: d(req.tauxChangeEurChf),
    marie,
    parentSeul: !marie && req.enfants.length > 0,
    membres,
    suisses: membres.filter((m) => m.activite === 'SUISSE'),
    nbEnfants: req.enfants.length,
  };
}

/** Salary net of social contributions and ordinary LPP — case 11 before rachats. */
export function salaireNet(p: PersonneFrontalier): Decimal {
  return positive(d(p.salaireBrut).minus(p.cotisationsSociales).minus(p.lppOrdinaire));
}

export function plafond3a(p: PersonneFrontalier): Decimal {
  if (p.affilieLpp) return PILIER_3A_AVEC_LPP;
  return Decimal.min(PILIER_3A_SANS_LPP, salaireNet(p).mul(PILIER_3A_SANS_LPP_TAUX));
}

// ─── Deductions : regles par colonne ─────────────────────────────────────────

/** What a deduction rule sees: the household, and the net income before it in its own column. */
export interface ContexteDeduction {
  f: Foyer;
  revenuBrut: Decimal;
  /** Revenu brut moins les deductions deja retenues dans cette colonne, avant celle-ci. */
  netAvant: Decimal;
}

export type RegleDeduction = (ctx: ContexteDeduction) => Decimal;

/** How one tax (the IFD, or one canton) computes each deduction. Zero where it grants none. */
export type ReglesColonne = Record<CodeDeduction, RegleDeduction>;

const parSuisse = (f: Foyer, x: (m: PersonneFrontalier) => Decimal) => sum(f.suisses.map(x));

/**
 * Deductions harmonised by the LHID: the same amount at the IFD and in every
 * canton. A canton module spreads these into its own rules.
 */
export const REGLES_COMMUNES = {
  COTISATIONS: ({ f }) => parSuisse(f, (m) => d(m.cotisationsSociales)),
  LPP: ({ f }) => parSuisse(f, (m) => d(m.lppOrdinaire)),
  RACHATS_LPP: ({ f }) => parSuisse(f, (m) => d(m.lppRachats)),
  PILIER_3A: ({ f }) => parSuisse(f, (m) => Decimal.min(d(m.pilier3a), plafond3a(m))),
  INTERETS_PASSIFS: ({ f }) => plafondInterets(f.req, d(f.req.deductions.interetsPassifs)),
  PENSION: ({ f }) => d(f.req.deductions.pensionAlimentaire),
} satisfies Partial<ReglesColonne>;

export function plafondInterets(req: FrontalierRequest, interets: Decimal): Decimal {
  return Decimal.min(interets, d(req.deductions.rendementFortune).plus(INTERETS_PASSIFS_FRANCHISE));
}

// ─── Biens en France ─────────────────────────────────────────────────────────

export type BienReq = FrontalierRequest['biensFrance'][number];

export interface MesureBienDec {
  fraisEntretien: Decimal;
  methode: 'EFFECTIFS' | 'FORFAIT';
  forfait: Decimal | null;
  energieReportable: Decimal;
  net: Decimal;
}

export const produitsBien = (b: BienReq) => d(b.loyersBrutsEur).plus(b.valeurLocativeEur);

/**
 * Net income of a French property under Swiss rules, in EUR, given the
 * maintenance forfait the tax at hand grants for it (null: none).
 *
 * Maintenance and restoration are deductible — replacing wiring or a
 * bathroom like for like included — and so are energy-saving investments;
 * the plus-value share of works never is. Taxe fonciere and interest come on
 * top of the maintenance costs, whichever way those are counted. The forfait
 * replaces the effective maintenance costs when it is higher.
 *
 * @aVerifier Energy costs beyond the year's income carry over two years
 * (art. 34 let. e LIPP). The law measures that on total income; for a
 * property that only sets the rate, it is measured on the property alone.
 * @aVerifier Taxe fonciere deducted on top of the forfait.
 */
export function mesurerBienAvecForfait(b: BienReq, forfait: Decimal | null): MesureBienDec {
  const produits = produitsBien(b);
  const autres = d(b.taxeFonciereEur).plus(b.interetsEmpruntEur);
  const courants = d(b.chargesCoproEur).plus(b.travauxEntretienEur).plus(b.assuranceEur);

  const disponible = positive(produits.minus(autres).minus(courants));
  const energie = Decimal.min(d(b.travauxEnergieEur), disponible);
  const effectifs = courants.plus(energie);

  // The forfait replaces every effective maintenance cost of the year,
  // energy works included: those are then lost, not carried over.
  if (forfait && forfait.gt(effectifs)) {
    return { fraisEntretien: forfait, methode: 'FORFAIT', forfait, energieReportable: ZERO, net: produits.minus(autres).minus(forfait) };
  }
  return {
    fraisEntretien: effectifs,
    methode: 'EFFECTIFS',
    forfait,
    energieReportable: d(b.travauxEnergieEur).minus(energie),
    net: produits.minus(autres).minus(effectifs),
  };
}

/**
 * Net foreign income in CHF, which sets the rate but is not taxed in
 * Switzerland. `mesurer` is the property measure of the tax at hand; without
 * `avecChargesBiens`, the properties count gross (to measure their charges).
 */
export function revenusEtrangersNets(
  f: Foyer,
  mesurer: (b: BienReq) => MesureBienDec,
  avecChargesBiens = true,
): Decimal {
  const salaires = sum(f.membres.map((m) => d(m.revenuFranceNetEur)));
  const biens = sum(f.req.biensFrance.map((b) => (avecChargesBiens ? mesurer(b).net : produitsBien(b))));
  return salaires.plus(biens).plus(f.req.autresRevenusEtrangersEur).mul(f.fx);
}

// ─── Test des 90 % ───────────────────────────────────────────────────────────

/**
 * Quasi-resident status: at least 90 % of the household's gross worldwide
 * income, the spouse's included, must be taxable in Switzerland.
 */
export function computeTest90(req: FrontalierRequest): Test90Result {
  const f = foyer(req);
  const suisses = sum(f.suisses.map((m) => d(m.salaireBrut)));
  const etrangers = sum(f.membres.map((m) => d(m.revenuFranceBrutEur)))
    .plus(sum(req.biensFrance.map(produitsBien)))
    .plus(req.autresRevenusEtrangersEur)
    .mul(f.fx);
  const mondiaux = suisses.plus(etrangers);
  const ratio = mondiaux.isZero() ? ZERO : suisses.div(mondiaux);

  return {
    revenusSuisses: suisses.toFixed(2),
    revenusMondiaux: mondiaux.toFixed(2),
    ratio: ratio.toDecimalPlaces(4).toNumber(),
    eligible: ratio.gte(SEUIL_QUASI_RESIDENT),
  };
}

// ─── Taux ────────────────────────────────────────────────────────────────────

/**
 * The tax rate is set on worldwide income, then applied to the Swiss part
 * only (exoneration avec reserve de progression). A foreign loss can lower
 * the rate but never below that of the Swiss income taxed alone at zero.
 */
export function tauxDeterminant(imposable: Decimal, etrangers: Decimal, impotSur: (r: Decimal) => Decimal) {
  const determinant = positive(imposable.plus(etrangers));
  const taux = determinant.isZero() ? ZERO : impotSur(determinant).div(determinant);
  return { determinant, taux };
}
