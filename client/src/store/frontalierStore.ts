import { create } from 'zustand';
import type {
  BienFrance,
  ChampCible,
  CommuneGe,
  DeductionsFoyer,
  DocumentExtraction,
  Enfant,
  EtatCivilGe,
  FrontalierRequestInput,
  FrontalierResult,
  PersonneFrontalier,
} from '@shared/frontalier.js';

/**
 * Inputs of the Geneva frontalier tab.
 *
 * The spouse block always exists in the store so that switching the civil
 * status back and forth never loses what was typed; it is only sent when the
 * household is married.
 *
 * `sources` remembers which document filled which field ("contribuable.
 * salaireBrut" → "certificat-2026.pdf"), so every figure read by the model
 * stays traceable and visibly different from a figure typed by hand.
 */

export type QuiPersonne = 'contribuable' | 'conjoint';

const personneVide = (activite: PersonneFrontalier['activite']): PersonneFrontalier => ({
  prenom: '',
  activite,
  salaireBrut: '0.00',
  cotisationsSociales: '0.00',
  lppOrdinaire: '0.00',
  lppRachats: '0.00',
  affilieLpp: activite === 'SUISSE',
  pilier3a: '0.00',
  fraisDeplacement: '0.00',
  repas: 'AUCUN',
  autresFraisProfessionnels: '0.00',
  fraisFormation: '0.00',
  impotSourceRetenu: '0.00',
  revenuFranceBrutEur: '0.00',
  revenuFranceNetEur: '0.00',
});

export const bienVide = (): BienFrance => ({
  label: '',
  usage: 'LOCATIF',
  loyersBrutsEur: '0.00',
  valeurLocativeEur: '0.00',
  chargesCoproEur: '0.00',
  taxeFonciereEur: '0.00',
  travauxEur: '0.00',
  assuranceEur: '0.00',
  interetsEmpruntEur: '0.00',
});

const DEDUCTIONS_VIDES: DeductionsFoyer = {
  primesAssuranceMaladie: '0.00',
  primesAssuranceVie: '0.00',
  interetsPassifs: '0.00',
  rendementFortune: '0.00',
  pensionAlimentaire: '0.00',
  fraisMedicaux: '0.00',
  dons: '0.00',
};

export interface FrontalierInputs {
  etatCivil: EtatCivilGe;
  communeTravail: CommuneGe;
  tauxChangeEurChf: string;
  contribuable: PersonneFrontalier;
  conjoint: PersonneFrontalier;
  enfants: Enfant[];
  deductions: DeductionsFoyer;
  biensFrance: BienFrance[];
  autresRevenusEtrangersEur: string;
  sources: Record<string, string>;
}

const DEFAULTS: FrontalierInputs = {
  etatCivil: 'CELIBATAIRE',
  communeTravail: 'GENEVE',
  tauxChangeEurChf: '0.9300',
  contribuable: { ...personneVide('SUISSE'), salaireBrut: '100000.00', cotisationsSociales: '6400.00', lppOrdinaire: '5000.00' },
  conjoint: personneVide('FRANCE'),
  enfants: [],
  deductions: DEDUCTIONS_VIDES,
  biensFrance: [],
  autresRevenusEtrangersEur: '0.00',
  sources: {},
};

/** A field is "manual" again as soon as the user edits it. */
function sansSources(sources: Record<string, string>, prefix: string, keys: string[]) {
  const next = { ...sources };
  for (const k of keys) delete next[`${prefix}.${k}`];
  return next;
}

interface FrontalierStore extends FrontalierInputs {
  result: FrontalierResult | null;

  updateFoyer: (p: Partial<Pick<FrontalierInputs, 'etatCivil' | 'communeTravail' | 'tauxChangeEurChf' | 'autresRevenusEtrangersEur'>>) => void;
  updatePersonne: (qui: QuiPersonne, p: Partial<PersonneFrontalier>) => void;
  setEnfants: (e: Enfant[]) => void;
  updateDeductions: (p: Partial<DeductionsFoyer>) => void;
  addBien: () => void;
  updateBien: (i: number, p: Partial<BienFrance>) => void;
  removeBien: (i: number) => void;
  /** Applies the selected fields of a read document. Returns messages for what could not be applied. */
  appliquerDocument: (doc: ExtractionAAppliquer) => string[];
  setResult: (r: FrontalierResult | null) => void;
  hydrate: (data: Partial<FrontalierInputs>) => void;
}

export interface ExtractionAAppliquer {
  fileName: string;
  extraction: DocumentExtraction;
  /** Indices of `extraction.champs` the user kept. */
  retenus: number[];
  personne: QuiPersonne;
  /** Target property for BIEN_* fields; -1 creates a new one. */
  bien: number;
  /** Add to the current value instead of replacing it. */
  cumuler: boolean;
}

// Where each extracted field lands, and in which currency the form holds it.
const CIBLES: Record<ChampCible, { zone: 'personne' | 'deductions' | 'bien' | 'garde'; cle: string; devise: 'CHF' | 'EUR' }> = {
  SALAIRE_BRUT: { zone: 'personne', cle: 'salaireBrut', devise: 'CHF' },
  COTISATIONS_SOCIALES: { zone: 'personne', cle: 'cotisationsSociales', devise: 'CHF' },
  LPP_ORDINAIRE: { zone: 'personne', cle: 'lppOrdinaire', devise: 'CHF' },
  LPP_RACHATS: { zone: 'personne', cle: 'lppRachats', devise: 'CHF' },
  PILIER_3A: { zone: 'personne', cle: 'pilier3a', devise: 'CHF' },
  IMPOT_SOURCE_RETENU: { zone: 'personne', cle: 'impotSourceRetenu', devise: 'CHF' },
  FRAIS_FORMATION: { zone: 'personne', cle: 'fraisFormation', devise: 'CHF' },
  PRIMES_ASSURANCE_MALADIE: { zone: 'deductions', cle: 'primesAssuranceMaladie', devise: 'CHF' },
  PRIMES_ASSURANCE_VIE: { zone: 'deductions', cle: 'primesAssuranceVie', devise: 'CHF' },
  INTERETS_PASSIFS: { zone: 'deductions', cle: 'interetsPassifs', devise: 'CHF' },
  FRAIS_MEDICAUX: { zone: 'deductions', cle: 'fraisMedicaux', devise: 'CHF' },
  DONS: { zone: 'deductions', cle: 'dons', devise: 'CHF' },
  FRAIS_GARDE: { zone: 'garde', cle: 'fraisGarde', devise: 'CHF' },
  BIEN_INTERETS_EMPRUNT: { zone: 'bien', cle: 'interetsEmpruntEur', devise: 'EUR' },
  BIEN_CHARGES_COPRO: { zone: 'bien', cle: 'chargesCoproEur', devise: 'EUR' },
  BIEN_TAXE_FONCIERE: { zone: 'bien', cle: 'taxeFonciereEur', devise: 'EUR' },
  BIEN_TRAVAUX: { zone: 'bien', cle: 'travauxEur', devise: 'EUR' },
  BIEN_ASSURANCE: { zone: 'bien', cle: 'assuranceEur', devise: 'EUR' },
  BIEN_LOYERS: { zone: 'bien', cle: 'loyersBrutsEur', devise: 'EUR' },
};

export const LIBELLES_CIBLES: Record<ChampCible, string> = {
  SALAIRE_BRUT: 'Salaire brut',
  COTISATIONS_SOCIALES: 'Cotisations AVS/AC',
  LPP_ORDINAIRE: 'LPP ordinaire',
  LPP_RACHATS: 'Rachats LPP',
  PILIER_3A: 'Pilier 3a',
  IMPOT_SOURCE_RETENU: 'Impot a la source retenu',
  FRAIS_FORMATION: 'Formation continue',
  PRIMES_ASSURANCE_MALADIE: 'Primes maladie/accidents',
  PRIMES_ASSURANCE_VIE: 'Primes assurance-vie',
  INTERETS_PASSIFS: 'Interets passifs',
  FRAIS_MEDICAUX: 'Frais medicaux',
  DONS: 'Dons',
  FRAIS_GARDE: 'Frais de garde',
  BIEN_INTERETS_EMPRUNT: 'Bien : interets d’emprunt',
  BIEN_CHARGES_COPRO: 'Bien : charges de copro',
  BIEN_TAXE_FONCIERE: 'Bien : taxe fonciere',
  BIEN_TRAVAUX: 'Bien : travaux',
  BIEN_ASSURANCE: 'Bien : assurance',
  BIEN_LOYERS: 'Bien : loyers',
};

export function cibleEstBien(c: ChampCible): boolean {
  return CIBLES[c].zone === 'bien';
}

export function cibleEstPersonnelle(c: ChampCible): boolean {
  return CIBLES[c].zone === 'personne';
}

export const useFrontalierStore = create<FrontalierStore>((set, get) => ({
  ...DEFAULTS,
  result: null,

  updateFoyer: (p) => set(p),

  updatePersonne: (qui, p) =>
    set((s) => ({
      [qui]: { ...s[qui], ...p },
      sources: sansSources(s.sources, qui, Object.keys(p)),
    })),

  setEnfants: (enfants) =>
    set((s) => ({
      enfants,
      sources: Object.fromEntries(Object.entries(s.sources).filter(([k]) => !k.startsWith('enfants.'))),
    })),

  updateDeductions: (p) =>
    set((s) => ({
      deductions: { ...s.deductions, ...p },
      sources: sansSources(s.sources, 'deductions', Object.keys(p)),
    })),

  addBien: () => set((s) => ({ biensFrance: [...s.biensFrance, bienVide()] })),

  updateBien: (i, p) =>
    set((s) => ({
      biensFrance: s.biensFrance.map((b, j) => (j === i ? { ...b, ...p } : b)),
      sources: sansSources(s.sources, `biensFrance.${i}`, Object.keys(p)),
    })),

  removeBien: (i) =>
    set((s) => ({
      biensFrance: s.biensFrance.filter((_, j) => j !== i),
      // Indices shift: drop every property source rather than mislabel one.
      sources: Object.fromEntries(Object.entries(s.sources).filter(([k]) => !k.startsWith('biensFrance.'))),
    })),

  appliquerDocument: ({ fileName, extraction, retenus, personne, bien, cumuler }) => {
    const s = get();
    const fx = parseFloat(s.tauxChangeEurChf) || 1;
    const erreurs: string[] = [];
    const next = {
      contribuable: { ...s.contribuable },
      conjoint: { ...s.conjoint },
      deductions: { ...s.deductions },
      biensFrance: s.biensFrance.map((b) => ({ ...b })),
      enfants: s.enfants.map((e) => ({ ...e })),
      sources: { ...s.sources },
    };

    let indexBien = bien;
    const champs = retenus.map((i) => extraction.champs[i]).filter(Boolean);
    if (indexBien < 0 && champs.some((c) => cibleEstBien(c.cible))) {
      next.biensFrance.push({ ...bienVide(), label: fileName.replace(/\.[^.]+$/, '') });
      indexBien = next.biensFrance.length - 1;
    }

    for (const champ of champs) {
      const cible = CIBLES[champ.cible];
      let valeur = champ.valeur;
      if (champ.devise !== cible.devise) valeur = champ.devise === 'EUR' ? valeur * fx : valeur / fx;

      let objet: Record<string, unknown>;
      let chemin: string;
      if (cible.zone === 'personne') {
        objet = next[personne];
        chemin = personne;
      } else if (cible.zone === 'deductions') {
        objet = next.deductions;
        chemin = 'deductions';
      } else if (cible.zone === 'bien') {
        objet = next.biensFrance[indexBien];
        chemin = `biensFrance.${indexBien}`;
      } else {
        const i = next.enfants.findIndex((e) => e.age < 14);
        if (i < 0) {
          erreurs.push('Frais de garde ignores : ajoutez d’abord un enfant de moins de 14 ans.');
          continue;
        }
        objet = next.enfants[i];
        chemin = `enfants.${i}`;
      }

      const actuel = cumuler ? parseFloat(String(objet[cible.cle])) || 0 : 0;
      objet[cible.cle] = (actuel + valeur).toFixed(2);
      next.sources[`${chemin}.${cible.cle}`] = fileName;
    }

    if (extraction.codeTarifIS && /^(A[0-5]|B[0-5]|C[0-5]|H[1-5])$/.test(extraction.codeTarifIS)) {
      next[personne].codeTarifIS = extraction.codeTarifIS;
      next.sources[`${personne}.codeTarifIS`] = fileName;
    }

    set(next);
    return erreurs;
  },

  setResult: (result) => set({ result }),

  hydrate: (data) =>
    set((s) => ({
      etatCivil: data.etatCivil ?? s.etatCivil,
      communeTravail: data.communeTravail ?? s.communeTravail,
      tauxChangeEurChf: data.tauxChangeEurChf ?? s.tauxChangeEurChf,
      contribuable: data.contribuable ? { ...personneVide('SUISSE'), ...data.contribuable } : s.contribuable,
      conjoint: data.conjoint ? { ...personneVide('FRANCE'), ...data.conjoint } : s.conjoint,
      enfants: data.enfants ?? s.enfants,
      deductions: data.deductions ? { ...DEDUCTIONS_VIDES, ...data.deductions } : s.deductions,
      biensFrance: data.biensFrance ? data.biensFrance.map((b) => ({ ...bienVide(), ...b })) : s.biensFrance,
      autresRevenusEtrangersEur: data.autresRevenusEtrangersEur ?? s.autresRevenusEtrangersEur,
      sources: data.sources ?? {},
      // A loaded scenario has not been run yet.
      result: null,
    })),
}));

export function selectInputs(s: FrontalierInputs): FrontalierInputs {
  return {
    etatCivil: s.etatCivil,
    communeTravail: s.communeTravail,
    tauxChangeEurChf: s.tauxChangeEurChf,
    contribuable: s.contribuable,
    conjoint: s.conjoint,
    enfants: s.enfants,
    deductions: s.deductions,
    biensFrance: s.biensFrance,
    autresRevenusEtrangersEur: s.autresRevenusEtrangersEur,
    sources: s.sources,
  };
}

export function buildFrontalierRequest(s: FrontalierInputs): FrontalierRequestInput {
  return {
    annee: 2026,
    etatCivil: s.etatCivil,
    communeTravail: s.communeTravail,
    tauxChangeEurChf: s.tauxChangeEurChf,
    contribuable: s.contribuable,
    conjoint: s.etatCivil === 'MARIE' ? s.conjoint : undefined,
    enfants: s.enfants,
    deductions: s.deductions,
    biensFrance: s.biensFrance,
    autresRevenusEtrangersEur: s.autresRevenusEtrangersEur,
  };
}
