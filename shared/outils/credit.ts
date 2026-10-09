import Decimal from 'decimal.js';

/**
 * Quick mortgage calculator — the public tools, not the engine. A
 * constant-payment loan with the borrower's insurance charged on the initial
 * capital, the way most French banks quote it. No TAEG: the figures here
 * answer "how much a month, how much in total, how much can I borrow".
 *
 * Amounts come in as `Decimal.Value` (the form holds numbers or strings) and
 * go out as Decimal; rates are fractions of 1.
 */

/** HCSF: debt service at most 35 % of net income, insurance included, over at most 25 years. */
export const TAUX_ENDETTEMENT_HCSF = 0.35;
export const DUREE_MAX_HCSF = 25;

export type TypeBien = 'ANCIEN' | 'NEUF';

/** Notary fees, as a share of the price: indicative, the user can override them. */
export const FRAIS_NOTAIRE: Record<TypeBien, number> = { ANCIEN: 0.075, NEUF: 0.025 };

const ZERO = new Decimal(0);
const d = (v: Decimal.Value | undefined) => new Decimal(v ?? 0);

/** Payment per euro borrowed: r / (1 − (1 + r)^−n), or 1/n at a zero rate. */
function facteurAnnuite(tauxAnnuel: Decimal.Value, mois: number): Decimal {
  const r = d(tauxAnnuel).div(12);
  if (r.isZero()) return new Decimal(1).div(mois);
  return r.div(new Decimal(1).minus(r.plus(1).pow(-mois)));
}

/** Monthly payment, insurance excluded. */
export function mensualite(capital: Decimal.Value, tauxAnnuel: Decimal.Value, mois: number): Decimal {
  const c = d(capital);
  if (mois <= 0 || c.lte(0)) return ZERO;
  return c.mul(facteurAnnuite(tauxAnnuel, mois));
}

export interface EntreeCredit {
  prix: Decimal.Value;
  typeBien: TypeBien;
  /** Overrides FRAIS_NOTAIRE[typeBien]. */
  tauxNotaire?: Decimal.Value;
  travaux?: Decimal.Value;
  /** Bank fees and guarantee (caution or mortgage), financed with the loan. */
  fraisDossier?: Decimal.Value;
  apport?: Decimal.Value;
  /** Nominal annual rate. */
  taux: Decimal.Value;
  annees: number;
  /** Annual insurance rate on the initial capital. */
  tauxAssurance?: Decimal.Value;
  /** Household net monthly income, for the debt ratio. */
  revenus?: Decimal.Value;
  /** Monthly payments of the loans already running. */
  chargesCredits?: Decimal.Value;
}

export interface ResultatCredit {
  fraisNotaire: Decimal;
  /** Price + notary + works + bank fees. */
  coutProjet: Decimal;
  capital: Decimal;
  mensualiteHorsAssurance: Decimal;
  assuranceMensuelle: Decimal;
  mensualiteTotale: Decimal;
  coutInterets: Decimal;
  coutAssurance: Decimal;
  /** Interest + insurance + bank fees. */
  coutTotal: Decimal;
  /** All monthly loans over income, or null without income. */
  tauxEndettement: Decimal | null;
  alertes: string[];
}

export function tauxNotaire(e: Pick<EntreeCredit, 'typeBien' | 'tauxNotaire'>): Decimal {
  return e.tauxNotaire !== undefined && e.tauxNotaire !== '' ? d(e.tauxNotaire) : new Decimal(FRAIS_NOTAIRE[e.typeBien]);
}

export function simulerCredit(e: EntreeCredit): ResultatCredit {
  const prix = d(e.prix);
  const fraisNotaire = prix.mul(tauxNotaire(e));
  const fraisDossier = d(e.fraisDossier);
  const coutProjet = prix.plus(fraisNotaire).plus(d(e.travaux)).plus(fraisDossier);
  const capital = Decimal.max(ZERO, coutProjet.minus(d(e.apport)));
  const mois = Math.max(0, Math.round(e.annees * 12));

  const mensualiteHorsAssurance = mensualite(capital, e.taux, mois);
  const assuranceMensuelle = capital.mul(d(e.tauxAssurance)).div(12);
  const mensualiteTotale = mensualiteHorsAssurance.plus(assuranceMensuelle);
  const coutInterets = Decimal.max(ZERO, mensualiteHorsAssurance.mul(mois).minus(capital));
  const coutAssurance = assuranceMensuelle.mul(mois);

  const revenus = d(e.revenus);
  const tauxEndettement = revenus.gt(0) ? mensualiteTotale.plus(d(e.chargesCredits)).div(revenus) : null;

  const alertes: string[] = [];
  if (capital.isZero()) alertes.push('L’apport couvre tout le projet : rien a emprunter.');
  if (e.annees > DUREE_MAX_HCSF) alertes.push(`Au-dela de ${DUREE_MAX_HCSF} ans, les banques ne pretent plus qu’a titre derogatoire (HCSF).`);
  if (tauxEndettement?.gt(TAUX_ENDETTEMENT_HCSF)) {
    alertes.push('Taux d’endettement au-dessus de 35 % : la banque refusera le plus souvent (norme HCSF).');
  }

  return {
    fraisNotaire,
    coutProjet,
    capital,
    mensualiteHorsAssurance,
    assuranceMensuelle,
    mensualiteTotale,
    coutInterets,
    coutAssurance,
    coutTotal: coutInterets.plus(coutAssurance).plus(capital.isZero() ? ZERO : fraisDossier),
    tauxEndettement,
    alertes,
  };
}

export interface LigneDuree {
  annees: number;
  taux: Decimal.Value;
}

/** The same project over several durations, each at its own rate. */
export function comparerDurees(e: EntreeCredit, durees: LigneDuree[]) {
  return durees.map(({ annees, taux }) => ({ annees, taux: d(taux), ...simulerCredit({ ...e, annees, taux }) }));
}

export interface EntreeCapacite {
  revenus: Decimal.Value;
  chargesCredits?: Decimal.Value;
  tauxEndettementMax?: Decimal.Value;
  taux: Decimal.Value;
  tauxAssurance?: Decimal.Value;
  annees: number;
  apport?: Decimal.Value;
  typeBien: TypeBien;
  tauxNotaire?: Decimal.Value;
  travaux?: Decimal.Value;
}

export interface ResultatCapacite {
  mensualiteMax: Decimal;
  capitalMax: Decimal;
  /** Capital + apport. */
  budget: Decimal;
  /** Price such that price + notary + works = budget. */
  prixMax: Decimal;
  fraisNotaire: Decimal;
  resteAVivre: Decimal;
  alertes: string[];
}

/**
 * Borrowing capacity: the payment the debt ratio leaves room for, turned
 * back into capital. Insurance counts in the ratio (HCSF), and it is charged
 * on the capital, so it divides along with the annuity factor.
 */
export function capaciteEmprunt(e: EntreeCapacite): ResultatCapacite {
  const revenus = d(e.revenus);
  const charges = d(e.chargesCredits);
  const ratio = e.tauxEndettementMax !== undefined ? d(e.tauxEndettementMax) : new Decimal(TAUX_ENDETTEMENT_HCSF);
  const mois = Math.max(0, Math.round(e.annees * 12));

  const mensualiteMax = Decimal.max(ZERO, revenus.mul(ratio).minus(charges));
  const parEuro = mois > 0 ? facteurAnnuite(e.taux, mois).plus(d(e.tauxAssurance).div(12)) : ZERO;
  const capitalMax = parEuro.gt(0) ? mensualiteMax.div(parEuro) : ZERO;
  const budget = capitalMax.plus(d(e.apport));
  const notaire = tauxNotaire(e);
  const prixMax = Decimal.max(ZERO, budget.minus(d(e.travaux)).div(notaire.plus(1)));

  const alertes: string[] = [];
  if (mensualiteMax.isZero()) alertes.push('Les credits en cours occupent deja tout le taux d’endettement.');
  if (e.annees > DUREE_MAX_HCSF) alertes.push(`Au-dela de ${DUREE_MAX_HCSF} ans, les banques ne pretent plus qu’a titre derogatoire (HCSF).`);

  return {
    mensualiteMax,
    capitalMax,
    budget,
    prixMax,
    fraisNotaire: prixMax.mul(notaire),
    resteAVivre: revenus.minus(charges).minus(mensualiteMax),
    alertes,
  };
}
