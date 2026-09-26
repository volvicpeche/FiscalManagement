import Decimal from 'decimal.js';
import type {
  CalculICC,
  CalculImpot,
  FrontalierRequest,
  DetailBienFrance,
  FrontalierResult,
  ImpactDeduction,
  MesureBien,
  ImpotSourcePersonne,
  LigneDeduction,
  PersonneFrontalier,
  Test90Result,
} from '@shared/frontalier.js';
import {
  ANNEE_BAREME_GE,
  CENTIMES_COMMUNAUX,
  DATE_LIMITE_TOU,
  FORFAIT_ENTRETIEN_AGE_SEUIL,
  ICC_FORFAIT_ENTRETIEN_ANCIEN,
  ICC_FORFAIT_ENTRETIEN_RECENT,
  IFD_FORFAIT_ENTRETIEN_ANCIEN,
  IFD_FORFAIT_ENTRETIEN_RECENT,
  ICC_ASSURANCE_MALADIE_ADULTE,
  ICC_ASSURANCE_MALADIE_ENFANT,
  ICC_ASSURANCE_MALADIE_JEUNE_ADULTE,
  ICC_ASSURANCE_VIE_COUPLE,
  ICC_ASSURANCE_VIE_PAR_CHARGE,
  ICC_ASSURANCE_VIE_PAR_CHARGE_UN_AFFILIE,
  ICC_ASSURANCE_VIE_SEUL,
  ICC_CENTIMES_CANTONAUX,
  ICC_CHARGE_FAMILLE,
  ICC_CHARGE_FAMILLE_AVEC_GARDE,
  ICC_DEPLACEMENT_MAX,
  ICC_DONS_PLAFOND,
  ICC_FORMATION_MAX,
  ICC_FRAIS_GARDE_MAX,
  ICC_FRAIS_MEDICAUX_FRANCHISE,
  ICC_FRAIS_PRO_MAX,
  ICC_FRAIS_PRO_MIN,
  ICC_FRAIS_PRO_TAUX,
  ICC_REDUCTION_LDIRPP,
  ICC_SPLITTING,
  ICC_TRANCHES,
  IFD_ASSURANCES_MARIES,
  IFD_ASSURANCES_MARIES_SANS_PREVOYANCE,
  IFD_ASSURANCES_PAR_ENFANT,
  IFD_ASSURANCES_SEUL,
  IFD_ASSURANCES_SEUL_SANS_PREVOYANCE,
  IFD_BAREME_MARIES,
  IFD_BAREME_SEUL,
  IFD_DEDUCTION_ENFANT,
  IFD_DEDUCTION_MARIES,
  IFD_DEPLACEMENT_MAX,
  IFD_DONS_MINIMUM,
  IFD_DONS_PLAFOND,
  IFD_DOUBLE_REVENU_MAX,
  IFD_DOUBLE_REVENU_MIN,
  IFD_DOUBLE_REVENU_TAUX,
  IFD_FORMATION_MAX,
  IFD_FRAIS_GARDE_MAX,
  IFD_FRAIS_MEDICAUX_FRANCHISE,
  IFD_FRAIS_PRO_MAX,
  IFD_FRAIS_PRO_MIN,
  IFD_FRAIS_PRO_TAUX,
  IFD_MINIMUM_PERCU,
  IFD_REDUCTION_PAR_ENFANT,
  IFD_REPAS_CANTINE,
  IFD_REPAS_COMPLET,
  INTERETS_PASSIFS_FRANCHISE,
  PILIER_3A_AVEC_LPP,
  PILIER_3A_SANS_LPP,
  PILIER_3A_SANS_LPP_TAUX,
  SEUIL_QUASI_RESIDENT,
  type PalierIFD,
} from './baremesGeneve.js';
import { codeTarifConnu, impotSourceAnnuel } from './tarifSource.js';

const ZERO = new Decimal(0);
const d = (s: string) => new Decimal(s);
const sum = (xs: Decimal[]) => xs.reduce((a, b) => a.plus(b), ZERO);
const clamp = (x: Decimal, min: Decimal, max: Decimal) => Decimal.min(Decimal.max(x, min), max);
const positive = (x: Decimal) => Decimal.max(x, ZERO);

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
  DOUBLE_REVENU: 'Double revenu (IFD)',
  FRAIS_MEDICAUX: 'Frais medicaux',
  DONS: 'Dons',
  CHARGES_FAMILLE: 'Deductions sociales (enfants, couple)',
} as const;
export type CodeDeduction = keyof typeof DEDUCTIONS;

/** Not a deduction from Swiss income, but it lowers the rate: the costs of the French properties. */
const CHARGES_BIENS_FRANCE = 'CHARGES_BIENS_FRANCE';
type CodeImpact = CodeDeduction | typeof CHARGES_BIENS_FRANCE;

// ─── Foyer ───────────────────────────────────────────────────────────────────

interface Foyer {
  req: FrontalierRequest;
  fx: Decimal;
  marie: boolean;
  /** Single parent living with dependent children: splitting ICC and bareme parental IFD. */
  parentSeul: boolean;
  membres: PersonneFrontalier[];
  suisses: PersonneFrontalier[];
  nbEnfants: number;
}

function foyer(req: FrontalierRequest): Foyer {
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
function salaireNet(p: PersonneFrontalier): Decimal {
  return positive(d(p.salaireBrut).minus(p.cotisationsSociales).minus(p.lppOrdinaire));
}

function plafond3a(p: PersonneFrontalier): Decimal {
  if (p.affilieLpp) return PILIER_3A_AVEC_LPP;
  return Decimal.min(PILIER_3A_SANS_LPP, salaireNet(p).mul(PILIER_3A_SANS_LPP_TAUX));
}

// ─── Revenus etrangers ───────────────────────────────────────────────────────

type Regime = 'icc' | 'ifd';
type BienReq = FrontalierRequest['biensFrance'][number];

interface MesureBienDec {
  fraisEntretien: Decimal;
  methode: 'EFFECTIFS' | 'FORFAIT';
  forfait: Decimal | null;
  energieReportable: Decimal;
  net: Decimal;
}

/**
 * Net income of a French property under Swiss rules, in EUR.
 *
 * Maintenance and restoration are deductible — replacing wiring or a
 * bathroom like for like included — and so are energy-saving investments;
 * the plus-value share of works never is. Taxe fonciere and interest come on
 * top of the maintenance costs, whichever way those are counted.
 *
 * The forfait replaces the effective maintenance costs when it is higher:
 * at the ICC for an owner-occupied home only, at the IFD for any private
 * building.
 *
 * @aVerifier Energy costs beyond the year's income carry over two years
 * (art. 34 let. e LIPP). The law measures that on total income; for a
 * property that only sets the rate, it is measured on the property alone.
 * @aVerifier Taxe fonciere deducted on top of the forfait.
 */
export function mesurerBien(b: BienReq, regime: Regime): MesureBienDec {
  const produits = d(b.loyersBrutsEur).plus(b.valeurLocativeEur);
  const autres = d(b.taxeFonciereEur).plus(b.interetsEmpruntEur);
  const courants = d(b.chargesCoproEur).plus(b.travauxEntretienEur).plus(b.assuranceEur);

  const disponible = positive(produits.minus(autres).minus(courants));
  const energie = Decimal.min(d(b.travauxEnergieEur), disponible);
  const effectifs = courants.plus(energie);

  const recent = b.ageBatiment <= FORFAIT_ENTRETIEN_AGE_SEUIL;
  let forfait: Decimal | null = null;
  if (regime === 'ifd') {
    forfait = produits.mul(recent ? IFD_FORFAIT_ENTRETIEN_RECENT : IFD_FORFAIT_ENTRETIEN_ANCIEN);
  } else if (b.usage !== 'LOCATIF') {
    forfait = d(b.valeurLocativeEur).mul(recent ? ICC_FORFAIT_ENTRETIEN_RECENT : ICC_FORFAIT_ENTRETIEN_ANCIEN);
  }

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

/** Net foreign income in CHF, which sets the rate but is not taxed in Geneva. */
function revenusEtrangersNets(f: Foyer, regime: Regime, avecChargesBiens = true): Decimal {
  const salaires = sum(f.membres.map((m) => d(m.revenuFranceNetEur)));
  const biens = sum(
    f.req.biensFrance.map((b) =>
      avecChargesBiens ? mesurerBien(b, regime).net : d(b.loyersBrutsEur).plus(b.valeurLocativeEur),
    ),
  );
  return salaires.plus(biens).plus(f.req.autresRevenusEtrangersEur).mul(f.fx);
}

export function detailBiens(req: FrontalierRequest): DetailBienFrance[] {
  const fx = d(req.tauxChangeEurChf);
  const chf = (x: Decimal) => x.mul(fx).toFixed(2);
  const mesure = (m: MesureBienDec): MesureBien => ({
    fraisEntretien: chf(m.fraisEntretien),
    methode: m.methode,
    forfait: m.forfait ? chf(m.forfait) : null,
    energieReportable: chf(m.energieReportable),
    net: chf(m.net),
  });
  return req.biensFrance.map((b) => ({
    label: b.label,
    usage: b.usage,
    produits: chf(d(b.loyersBrutsEur).plus(b.valeurLocativeEur)),
    autresCharges: chf(d(b.taxeFonciereEur).plus(b.interetsEmpruntEur)),
    plusValueNonDeduite: chf(d(b.travauxPlusValueEur)),
    icc: mesure(mesurerBien(b, 'icc')),
    ifd: mesure(mesurerBien(b, 'ifd')),
  }));
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
    .plus(sum(req.biensFrance.map((b) => d(b.loyersBrutsEur).plus(b.valeurLocativeEur))))
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

// ─── Deductions ──────────────────────────────────────────────────────────────

interface Ligne {
  code: CodeDeduction;
  icc: Decimal;
  ifd: Decimal;
}

interface Assiettes {
  lignes: Ligne[];
  revenuBrut: Decimal;
  imposableIcc: Decimal;
  imposableIfd: Decimal;
}

/**
 * Swiss taxable income for the ICC and the IFD. A quasi-resident gets every
 * deduction in full, exactly like a resident — that is the whole point of the
 * status. `exclure` drops one deduction, to measure what it is worth.
 */
export function computeAssiettes(req: FrontalierRequest, exclure?: CodeDeduction): Assiettes {
  const f = foyer(req);
  const lignes: Ligne[] = [];
  const add = (code: CodeDeduction, icc: Decimal, ifd: Decimal) => {
    if (code === exclure) return;
    lignes.push({ code, icc, ifd });
  };
  const total = (k: 'icc' | 'ifd') => sum(lignes.map((l) => l[k]));

  const revenuBrut = sum(f.suisses.map((m) => d(m.salaireBrut)));
  const ded = req.deductions;

  // Deductions organiques, par personne
  add('COTISATIONS', sum(f.suisses.map((m) => d(m.cotisationsSociales))), sum(f.suisses.map((m) => d(m.cotisationsSociales))));
  add('LPP', sum(f.suisses.map((m) => d(m.lppOrdinaire))), sum(f.suisses.map((m) => d(m.lppOrdinaire))));
  add('RACHATS_LPP', sum(f.suisses.map((m) => d(m.lppRachats))), sum(f.suisses.map((m) => d(m.lppRachats))));

  const p3a = sum(f.suisses.map((m) => Decimal.min(d(m.pilier3a), plafond3a(m))));
  add('PILIER_3A', p3a, p3a);

  const fraisIcc = sum(
    f.suisses.map((m) => {
      const forfait = clamp(salaireNet(m).mul(ICC_FRAIS_PRO_TAUX), ICC_FRAIS_PRO_MIN, ICC_FRAIS_PRO_MAX);
      const effectifs = Decimal.min(d(m.fraisDeplacement), ICC_DEPLACEMENT_MAX).plus(m.autresFraisProfessionnels);
      return Decimal.max(forfait, effectifs);
    }),
  );
  const fraisIfd = sum(
    f.suisses.map((m) => {
      const forfait = clamp(salaireNet(m).mul(IFD_FRAIS_PRO_TAUX), IFD_FRAIS_PRO_MIN, IFD_FRAIS_PRO_MAX);
      const repas = m.repas === 'COMPLET' ? IFD_REPAS_COMPLET : m.repas === 'CANTINE' ? IFD_REPAS_CANTINE : ZERO;
      return Decimal.min(d(m.fraisDeplacement), IFD_DEPLACEMENT_MAX)
        .plus(repas)
        .plus(Decimal.max(forfait, d(m.autresFraisProfessionnels)));
    }),
  );
  add('FRAIS_PRO', fraisIcc, fraisIfd);

  add(
    'FORMATION',
    sum(f.suisses.map((m) => Decimal.min(d(m.fraisFormation), ICC_FORMATION_MAX))),
    sum(f.suisses.map((m) => Decimal.min(d(m.fraisFormation), IFD_FORMATION_MAX))),
  );

  // Assurances
  const affilies = f.membres.filter((m) => m.affilieLpp || d(m.pilier3a).gt(0)).length;
  const maladie = d(ded.primesAssuranceMaladie);
  const vie = d(ded.primesAssuranceVie);
  const plafondMaladieIcc = sum([
    ...f.membres.map(() => ICC_ASSURANCE_MALADIE_ADULTE),
    ...req.enfants.map((e) =>
      e.age < 19 ? ICC_ASSURANCE_MALADIE_ENFANT : e.age <= 25 ? ICC_ASSURANCE_MALADIE_JEUNE_ADULTE : ICC_ASSURANCE_MALADIE_ADULTE,
    ),
  ]);
  const plafondVieIcc = (() => {
    let base = f.marie ? ICC_ASSURANCE_VIE_COUPLE : ICC_ASSURANCE_VIE_SEUL;
    let parCharge = ICC_ASSURANCE_VIE_PAR_CHARGE;
    if (affilies === 0) {
      base = base.mul(2);
      parCharge = parCharge.mul(2);
    } else if (f.marie && affilies === 1) {
      base = base.mul(1.5);
      parCharge = ICC_ASSURANCE_VIE_PAR_CHARGE_UN_AFFILIE;
    }
    return base.plus(parCharge.mul(f.nbEnfants));
  })();
  const assurancesIcc = Decimal.min(maladie, plafondMaladieIcc).plus(Decimal.min(vie, plafondVieIcc));
  const plafondIfd = (f.marie
    ? affilies > 0 ? IFD_ASSURANCES_MARIES : IFD_ASSURANCES_MARIES_SANS_PREVOYANCE
    : affilies > 0 ? IFD_ASSURANCES_SEUL : IFD_ASSURANCES_SEUL_SANS_PREVOYANCE
  ).plus(IFD_ASSURANCES_PAR_ENFANT.mul(f.nbEnfants));
  add('ASSURANCES', assurancesIcc, Decimal.min(maladie.plus(vie), plafondIfd));

  const interets = Decimal.min(d(ded.interetsPassifs), d(ded.rendementFortune).plus(INTERETS_PASSIFS_FRANCHISE));
  add('INTERETS_PASSIFS', interets, interets);
  add('PENSION', d(ded.pensionAlimentaire), d(ded.pensionAlimentaire));

  const gardables = req.enfants.filter((e) => e.age < 14);
  add(
    'FRAIS_GARDE',
    sum(gardables.map((e) => Decimal.min(d(e.fraisGarde), ICC_FRAIS_GARDE_MAX))),
    sum(gardables.map((e) => Decimal.min(d(e.fraisGarde), IFD_FRAIS_GARDE_MAX))),
  );

  // Double revenu : la loi vise le revenu d'activite de chaque conjoint, ou
  // qu'il soit gagne — un conjoint travaillant en France y ouvre droit.
  if (f.marie && f.membres.length === 2) {
    const revenus = f.membres.map((m) =>
      m.activite === 'SUISSE' ? salaireNet(m) : m.activite === 'FRANCE' ? d(m.revenuFranceNetEur).mul(f.fx) : ZERO,
    );
    const bas = Decimal.min(revenus[0], revenus[1]);
    if (bas.gt(0)) {
      const montant = bas.lt(IFD_DOUBLE_REVENU_MIN)
        ? bas
        : clamp(bas.mul(IFD_DOUBLE_REVENU_TAUX), IFD_DOUBLE_REVENU_MIN, IFD_DOUBLE_REVENU_MAX);
      add('DOUBLE_REVENU', ZERO, montant);
    }
  }

  // Frais medicaux puis dons : leurs plafonds dependent du revenu net avant eux.
  const netAvantMedicaux = { icc: revenuBrut.minus(total('icc')), ifd: revenuBrut.minus(total('ifd')) };
  const medicaux = d(ded.fraisMedicaux);
  add(
    'FRAIS_MEDICAUX',
    positive(medicaux.minus(positive(netAvantMedicaux.icc).mul(ICC_FRAIS_MEDICAUX_FRANCHISE))),
    positive(medicaux.minus(positive(netAvantMedicaux.ifd).mul(IFD_FRAIS_MEDICAUX_FRANCHISE))),
  );

  const dons = d(ded.dons);
  const netAvantDons = { icc: positive(revenuBrut.minus(total('icc'))), ifd: positive(revenuBrut.minus(total('ifd'))) };
  add(
    'DONS',
    Decimal.min(dons, netAvantDons.icc.mul(ICC_DONS_PLAFOND)),
    dons.gte(IFD_DONS_MINIMUM) ? Decimal.min(dons, netAvantDons.ifd.mul(IFD_DONS_PLAFOND)) : ZERO,
  );

  // Deductions sociales
  const chargesIcc = sum(
    req.enfants.map((e) => (e.age < 14 && d(e.fraisGarde).gt(0) ? ICC_CHARGE_FAMILLE_AVEC_GARDE : ICC_CHARGE_FAMILLE)),
  );
  const socialesIfd = IFD_DEDUCTION_ENFANT.mul(f.nbEnfants).plus(f.marie ? IFD_DEDUCTION_MARIES : ZERO);
  add('CHARGES_FAMILLE', chargesIcc, socialesIfd);

  const nonNulles = lignes.filter((l) => !l.icc.isZero() || !l.ifd.isZero());
  return {
    lignes: nonNulles,
    revenuBrut,
    imposableIcc: positive(revenuBrut.minus(total('icc'))),
    imposableIfd: positive(revenuBrut.minus(total('ifd'))),
  };
}

// ─── Baremes ─────────────────────────────────────────────────────────────────

/** Geneva base tax, computed by tranche on the revenu determinant. */
export function impotBaseIcc(revenu: Decimal): Decimal {
  let impot = ZERO;
  let bas = ZERO;
  for (const { threshold, rate } of ICC_TRANCHES) {
    if (revenu.lte(bas)) break;
    impot = impot.plus(Decimal.min(revenu, threshold).minus(bas).mul(rate));
    bas = threshold;
  }
  return impot;
}

/** Base tax with splitting: the rate of half the income, applied to all of it. */
export function impotBaseIccSplitting(revenu: Decimal, splitting: boolean): Decimal {
  if (!splitting) return impotBaseIcc(revenu);
  return impotBaseIcc(revenu.mul(ICC_SPLITTING)).div(ICC_SPLITTING);
}

/**
 * Federal tax per the published table, fractions under CHF 100 dropped. The
 * floor to 5 ct applies to the tax finally due, not here: the AFC table
 * itself lists unrounded amounts (137.06 at CHF 33 000).
 */
export function impotIfdBareme(revenu: Decimal, bareme: PalierIFD[]): Decimal {
  const r = revenu.div(100).floor().mul(100);
  let palier = bareme[0];
  for (const p of bareme) if (r.gte(p.des)) palier = p;
  return palier.base.plus(r.minus(palier.des).div(100).floor().mul(palier.par100));
}

/**
 * The tax rate is set on worldwide income, then applied to the Swiss part
 * only (exoneration avec reserve de progression). A foreign loss can lower
 * the rate but never below that of the Swiss income taxed alone at zero.
 */
function tauxDeterminant(imposable: Decimal, etrangers: Decimal, impotSur: (r: Decimal) => Decimal) {
  const determinant = positive(imposable.plus(etrangers));
  const taux = determinant.isZero() ? ZERO : impotSur(determinant).div(determinant);
  return { determinant, taux };
}

export function computeIcc(req: FrontalierRequest, imposable: Decimal, etrangers: Decimal): CalculICC {
  const f = foyer(req);
  const splitting = f.marie || f.parentSeul;
  const { determinant, taux } = tauxDeterminant(imposable, etrangers, (r) => impotBaseIccSplitting(r, splitting));

  const impotBase = imposable.mul(taux);
  const cantonalBrut = impotBase.mul(ICC_CENTIMES_CANTONAUX.plus(1));
  const reduction = cantonalBrut.mul(ICC_REDUCTION_LDIRPP);
  const centimesCommunaux = CENTIMES_COMMUNAUX[req.communeTravail];
  const communal = impotBase.mul(centimesCommunaux);
  const total = cantonalBrut.minus(reduction).plus(communal).toDecimalPlaces(2);

  return {
    revenuImposable: imposable.toFixed(2),
    revenuDeterminantTaux: determinant.toFixed(2),
    tauxEffectif: imposable.isZero() ? 0 : total.div(imposable).toDecimalPlaces(4).toNumber(),
    impotBase: impotBase.toFixed(2),
    centimesCantonaux: impotBase.mul(ICC_CENTIMES_CANTONAUX).toFixed(2),
    reductionLdirpp: reduction.toFixed(2),
    impotCommunal: communal.toFixed(2),
    centimesCommunaux: centimesCommunaux.toNumber(),
    total: total.toFixed(2),
  };
}

export function computeIfd(req: FrontalierRequest, imposable: Decimal, etrangers: Decimal): CalculImpot {
  const f = foyer(req);
  const bareme = f.marie || f.parentSeul ? IFD_BAREME_MARIES : IFD_BAREME_SEUL;
  const reductionEnfants = IFD_REDUCTION_PAR_ENFANT.mul(f.nbEnfants);
  const impotSur = (r: Decimal) => positive(impotIfdBareme(r, bareme).minus(reductionEnfants));
  const { determinant, taux } = tauxDeterminant(imposable, etrangers, impotSur);

  let total = imposable.mul(taux).mul(20).floor().div(20);
  if (total.lt(IFD_MINIMUM_PERCU)) total = ZERO;

  return {
    revenuImposable: imposable.toFixed(2),
    revenuDeterminantTaux: determinant.toFixed(2),
    tauxEffectif: imposable.isZero() ? 0 : total.div(imposable).toDecimalPlaces(4).toNumber(),
    total: total.toFixed(2),
  };
}

function totalTou(req: FrontalierRequest, exclure?: CodeImpact): Decimal {
  const assiettes = computeAssiettes(req, exclure === CHARGES_BIENS_FRANCE ? undefined : exclure);
  const f = foyer(req);
  const avecCharges = exclure !== CHARGES_BIENS_FRANCE;
  return d(computeIcc(req, assiettes.imposableIcc, revenusEtrangersNets(f, 'icc', avecCharges)).total).plus(
    computeIfd(req, assiettes.imposableIfd, revenusEtrangersNets(f, 'ifd', avecCharges)).total,
  );
}

// ─── Impot a la source ───────────────────────────────────────────────────────

/** Code a household would normally be withheld under, when the user gives none. */
export function codeTarifParDefaut(req: FrontalierRequest): string {
  const enfants = Math.min(req.enfants.length, 5);
  if (req.etatCivil === 'CELIBATAIRE') return enfants > 0 ? `H${enfants}` : 'A0';
  const conjointActif =
    req.conjoint &&
    (req.conjoint.activite === 'SUISSE' ||
      (req.conjoint.activite === 'FRANCE' && d(req.conjoint.revenuFranceBrutEur).gt(0)));
  return `${conjointActif ? 'C' : 'B'}${enfants}`;
}

export function computeImpotSource(req: FrontalierRequest): ImpotSourcePersonne[] {
  return foyer(req).suisses.map((m) => {
    const code = m.codeTarifIS && codeTarifConnu(m.codeTarifIS) ? m.codeTarifIS : codeTarifParDefaut(req);
    const { taux, impot } = impotSourceAnnuel(code, d(m.salaireBrut));
    return {
      prenom: m.prenom,
      codeTarif: code,
      salaireBrut: d(m.salaireBrut).toFixed(2),
      tauxBareme: taux.toNumber(),
      impotTheorique: impot.toFixed(2),
      impotRetenu: d(m.impotSourceRetenu).toFixed(2),
    };
  });
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export function simulateFrontalier(req: FrontalierRequest): FrontalierResult {
  const f = foyer(req);
  const test90 = computeTest90(req);
  const assiettes = computeAssiettes(req);
  const icc = computeIcc(req, assiettes.imposableIcc, revenusEtrangersNets(f, 'icc'));
  const ifd = computeIfd(req, assiettes.imposableIfd, revenusEtrangersNets(f, 'ifd'));
  const tou = d(icc.total).plus(ifd.total);

  const impotSource = computeImpotSource(req);
  const isRetenu = sum(impotSource.map((p) => d(p.impotRetenu)));
  const isTheorique = sum(impotSource.map((p) => d(p.impotTheorique)));
  // Without the actual withholding, compare against the tariff instead of zero.
  const reference = isRetenu.isZero() ? isTheorique : isRetenu;

  const deductions: LigneDeduction[] = assiettes.lignes.map((l) => ({
    code: l.code,
    libelle: DEDUCTIONS[l.code],
    icc: l.icc.toFixed(2),
    ifd: l.ifd.toFixed(2),
  }));

  const impacts: ImpactDeduction[] = assiettes.lignes
    .map((l): ImpactDeduction => ({
      code: l.code,
      libelle: DEDUCTIONS[l.code],
      montant: Decimal.max(l.icc, l.ifd).toFixed(2),
      economie: totalTou(req, l.code).minus(tou).toFixed(2),
    }))
    .concat(chargesBiensImpact(req, tou))
    .filter((i) => d(i.economie).gt(0))
    .sort((a, b) => d(b.economie).comparedTo(d(a.economie)));

  return {
    annee: ANNEE_BAREME_GE,
    test90,
    deductions,
    icc,
    ifd,
    totalTou: tou.toFixed(2),
    impotSource,
    totalIsRetenu: isRetenu.toFixed(2),
    totalIsTheorique: isTheorique.toFixed(2),
    gainTou: reference.minus(tou).toFixed(2),
    impacts,
    biensFrance: detailBiens(req),
    dateLimite: DATE_LIMITE_TOU,
    avertissements: avertissements(req, f, test90, impotSource),
  };
}

function chargesBiensImpact(req: FrontalierRequest, tou: Decimal): ImpactDeduction[] {
  if (req.biensFrance.length === 0) return [];
  const f = foyer(req);
  const charges = revenusEtrangersNets(f, 'icc', false).minus(revenusEtrangersNets(f, 'icc', true));
  if (charges.lte(0)) return [];
  return [
    {
      code: CHARGES_BIENS_FRANCE,
      libelle: 'Charges et travaux des biens en France (taux)',
      montant: charges.toFixed(2),
      economie: totalTou(req, CHARGES_BIENS_FRANCE).minus(tou).toFixed(2),
    },
  ];
}

function avertissements(
  req: FrontalierRequest,
  f: Foyer,
  test90: Test90Result,
  impotSource: ImpotSourcePersonne[],
): string[] {
  const out: string[] = [];
  const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

  if (!test90.eligible) {
    out.push(
      `Seuls ${pct(test90.ratio)} des revenus bruts mondiaux du foyer sont imposables en Suisse : le seuil de 90 % n'est pas atteint, la TOU de quasi-resident n'est pas ouverte. Le calcul ci-dessous est indicatif.`,
    );
  } else if (test90.ratio < 0.92) {
    out.push(
      `Le test des 90 % passe de justesse (${pct(test90.ratio)}) : une variation de change ou un revenu francais oublie peut le faire echouer.`,
    );
  }

  if (req.etatCivil === 'CELIBATAIRE' && req.conjoint) {
    out.push(
      "Le conjoint saisi est ignore : un couple non marie (PACS compris) est impose comme deux celibataires, chacun avec sa propre demande.",
    );
  }

  for (const m of f.suisses) {
    const nom = m.prenom || 'le contribuable';
    if (d(m.pilier3a).gt(plafond3a(m))) {
      out.push(`Le versement 3a de ${nom} depasse le plafond 2026 (${plafond3a(m).toFixed(0)} CHF) : l'excedent n'est pas deductible.`);
    }
  }

  const plafondInterets = d(req.deductions.rendementFortune).plus(INTERETS_PASSIFS_FRANCHISE);
  if (d(req.deductions.interetsPassifs).gt(plafondInterets)) {
    out.push(`Les interets passifs sont limites au rendement de la fortune plus 50 000 CHF (${plafondInterets.toFixed(0)} CHF).`);
  }

  for (const p of impotSource) {
    const retenu = d(p.impotRetenu);
    const theorique = d(p.impotTheorique);
    if (retenu.gt(0) && theorique.gt(0) && retenu.minus(theorique).abs().div(theorique).gt(0.05)) {
      out.push(
        `L'impot retenu pour ${p.prenom || 'le contribuable'} s'ecarte de plus de 5 % du bareme ${p.codeTarif} : verifiez le code bareme, un 13e salaire ou un bonus verse en une fois.`,
      );
    }
    if (retenu.isZero()) {
      out.push(`Aucun impot retenu saisi pour ${p.prenom || 'le contribuable'} : la comparaison utilise le bareme ${p.codeTarif}.`);
    }
  }

  for (const b of detailBiens(req)) {
    const nom = b.label || 'un bien en France';
    if (d(b.plusValueNonDeduite).gt(0)) {
      out.push(
        `La part plus-value des travaux de ${nom} (${d(b.plusValueNonDeduite).toFixed(0)} CHF) n'est pas deductible : seuls l'entretien, la remise en etat a l'identique et les economies d'energie le sont.`,
      );
    }
    if (d(b.icc.energieReportable).gt(0)) {
      out.push(
        `Les travaux d'economie d'energie de ${nom} depassent son revenu de l'annee : ${d(b.icc.energieReportable).toFixed(0)} CHF sont reportables sur les deux annees suivantes.`,
      );
    }
    if (b.icc.methode === 'FORFAIT' || b.ifd.methode === 'FORFAIT') {
      out.push(
        `Pour ${nom}, le forfait d'entretien depasse les frais reels${b.icc.methode === 'FORFAIT' ? '' : ' a l\'IFD'} : il est retenu a leur place, et les travaux de l'annee ne comptent plus.`,
      );
    }
  }

  out.push(
    `La demande de TOU doit parvenir a l'AFC-GE au plus tard le 31 mars 2027. Une fois la taxation notifiee, elle remplace l'impot a la source de l'annee et ne peut plus etre retiree.`,
  );
  out.push("L'impot sur la fortune n'est pas calcule : un frontalier sans bien en Suisse n'y est pas soumis.");

  return out;
}
