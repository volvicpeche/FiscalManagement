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
 *
 * Works are kept as their own list of lines rather than inside each
 * property: most years have none, so they sit behind a switch that leaves
 * them out of the calculation without losing them. The request only sees
 * per-property totals, built in `buildFrontalierRequest`.
 */

export type QuiPersonne = 'contribuable' | 'conjoint';

export type CategorieTravaux = 'ENTRETIEN' | 'ENERGIE' | 'PLUS_VALUE';

export interface LigneTravaux {
  id: string;
  description: string;
  /** Index of the property in `biensFrance`. */
  bien: number;
  categorie: CategorieTravaux;
  montantEur: string;
  /** Document the line was read from, if any. */
  source?: string;
}

const CHAMP_TRAVAUX: Record<CategorieTravaux, 'travauxEntretienEur' | 'travauxEnergieEur' | 'travauxPlusValueEur'> = {
  ENTRETIEN: 'travauxEntretienEur',
  ENERGIE: 'travauxEnergieEur',
  PLUS_VALUE: 'travauxPlusValueEur',
};

const nouvelId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()));

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
  ageBatiment: 20,
  chargesCoproEur: '0.00',
  taxeFonciereEur: '0.00',
  travauxEntretienEur: '0.00',
  travauxEnergieEur: '0.00',
  travauxPlusValueEur: '0.00',
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

/**
 * Older saves hold works inside each property — a single `travauxEur`, then
 * three split fields. Both become lines; the property fields are cleared so
 * the lines stay the only place works live.
 */
function migrerBiens(biens: (Partial<BienFrance> & { travauxEur?: string })[]): { biens: BienFrance[]; lignes: LigneTravaux[] } {
  const lignes: LigneTravaux[] = [];
  const out = biens.map((b, i) => {
    const { travauxEur, ...reste } = b;
    const anciens: [CategorieTravaux | 'ANCIEN', string][] = [];
    if (travauxEur) anciens.push(['ANCIEN', travauxEur]);
    for (const [cat, champ] of Object.entries(CHAMP_TRAVAUX) as [CategorieTravaux, keyof BienFrance][]) {
      const v = reste[champ];
      if (typeof v === 'string') anciens.push([cat, v]);
    }
    for (const [cat, v] of anciens) {
      if (parseFloat(v) > 0) {
        lignes.push({
          id: nouvelId(),
          description: 'Travaux',
          bien: i,
          categorie: cat === 'ANCIEN' ? 'ENTRETIEN' : cat,
          montantEur: v,
        });
      }
    }
    return { ...bienVide(), ...reste, travauxEntretienEur: '0.00', travauxEnergieEur: '0.00', travauxPlusValueEur: '0.00' };
  });
  return { biens: out, lignes };
}

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
  travauxActifs: boolean;
  travaux: LigneTravaux[];
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
  travauxActifs: false,
  travaux: [],
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
  setTravauxActifs: (actif: boolean) => void;
  /** Adds a works line; creates the principal residence first when there is no property yet. */
  addTravaux: () => void;
  updateTravaux: (id: string, p: Partial<Omit<LigneTravaux, 'id'>>) => void;
  removeTravaux: (id: string) => void;
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
// Works go to their own list: `cle` is then the category.
const CIBLES: Record<ChampCible, { zone: 'personne' | 'deductions' | 'bien' | 'garde' | 'travaux'; cle: string; devise: 'CHF' | 'EUR' }> = {
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
  BIEN_TRAVAUX_ENTRETIEN: { zone: 'travaux', cle: 'ENTRETIEN', devise: 'EUR' },
  BIEN_TRAVAUX_ENERGIE: { zone: 'travaux', cle: 'ENERGIE', devise: 'EUR' },
  BIEN_TRAVAUX_PLUS_VALUE: { zone: 'travaux', cle: 'PLUS_VALUE', devise: 'EUR' },
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
  BIEN_TRAVAUX_ENTRETIEN: 'Bien : travaux d’entretien',
  BIEN_TRAVAUX_ENERGIE: 'Bien : economies d’energie',
  BIEN_TRAVAUX_PLUS_VALUE: 'Bien : travaux plus-value (non deductibles)',
  BIEN_ASSURANCE: 'Bien : assurance',
  BIEN_LOYERS: 'Bien : loyers',
};

export function cibleEstBien(c: ChampCible): boolean {
  return CIBLES[c].zone === 'bien' || CIBLES[c].zone === 'travaux';
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
      // Works of the removed property go with it; the others follow their property.
      travaux: s.travaux.filter((t) => t.bien !== i).map((t) => (t.bien > i ? { ...t, bien: t.bien - 1 } : t)),
      // Indices shift: drop every property source rather than mislabel one.
      sources: Object.fromEntries(Object.entries(s.sources).filter(([k]) => !k.startsWith('biensFrance.'))),
    })),

  setTravauxActifs: (travauxActifs) => set({ travauxActifs }),

  addTravaux: () =>
    set((s) => {
      const biensFrance =
        s.biensFrance.length > 0
          ? s.biensFrance
          : [{ ...bienVide(), label: 'Residence principale', usage: 'RESIDENCE_PRINCIPALE' as const }];
      const bien = biensFrance.findIndex((b) => b.usage === 'RESIDENCE_PRINCIPALE');
      return {
        biensFrance,
        travauxActifs: true,
        travaux: [
          ...s.travaux,
          { id: nouvelId(), description: '', bien: Math.max(bien, 0), categorie: 'ENTRETIEN', montantEur: '0.00' },
        ],
      };
    }),

  updateTravaux: (id, p) =>
    set((s) => ({
      // An edited amount is the user's own figure, no longer the document's.
      travaux: s.travaux.map((t) => (t.id === id ? { ...t, ...p, ...('montantEur' in p ? { source: undefined } : {}) } : t)),
    })),

  removeTravaux: (id) => set((s) => ({ travaux: s.travaux.filter((t) => t.id !== id) })),

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
      travaux: [...s.travaux],
      travauxActifs: s.travauxActifs,
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

      if (cible.zone === 'travaux') {
        next.travaux.push({
          id: nouvelId(),
          description: champ.source || fileName,
          bien: indexBien,
          categorie: cible.cle as CategorieTravaux,
          montantEur: valeur.toFixed(2),
          source: fileName,
        });
        next.travauxActifs = true;
        continue;
      }

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
    set((s) => {
      const migres = data.biensFrance ? migrerBiens(data.biensFrance) : null;
      const travaux = migres ? [...(data.travaux ?? []), ...migres.lignes] : (data.travaux ?? s.travaux);
      return {
      etatCivil: data.etatCivil ?? s.etatCivil,
      communeTravail: data.communeTravail ?? s.communeTravail,
      tauxChangeEurChf: data.tauxChangeEurChf ?? s.tauxChangeEurChf,
      contribuable: data.contribuable ? { ...personneVide('SUISSE'), ...data.contribuable } : s.contribuable,
      conjoint: data.conjoint ? { ...personneVide('FRANCE'), ...data.conjoint } : s.conjoint,
      enfants: data.enfants ?? s.enfants,
      deductions: data.deductions ? { ...DEDUCTIONS_VIDES, ...data.deductions } : s.deductions,
      biensFrance: migres ? migres.biens : s.biensFrance,
      travaux,
      travauxActifs: data.travauxActifs ?? travaux.length > 0,
      autresRevenusEtrangersEur: data.autresRevenusEtrangersEur ?? s.autresRevenusEtrangersEur,
      sources: data.sources ?? {},
      // A loaded scenario has not been run yet.
      result: null,
      };
    }),
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
    travauxActifs: s.travauxActifs,
    travaux: s.travaux,
    sources: s.sources,
  };
}

/** Per-property works totals, or nothing at all when the switch is off. */
function biensAvecTravaux(s: FrontalierInputs): BienFrance[] {
  return s.biensFrance.map((b, i) => {
    const totaux = { travauxEntretienEur: 0, travauxEnergieEur: 0, travauxPlusValueEur: 0 };
    if (s.travauxActifs) {
      for (const t of s.travaux) {
        if (t.bien === i) totaux[CHAMP_TRAVAUX[t.categorie]] += parseFloat(t.montantEur) || 0;
      }
    }
    return {
      ...b,
      travauxEntretienEur: totaux.travauxEntretienEur.toFixed(2),
      travauxEnergieEur: totaux.travauxEnergieEur.toFixed(2),
      travauxPlusValueEur: totaux.travauxPlusValueEur.toFixed(2),
    };
  });
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
    biensFrance: biensAvecTravaux(s),
    autresRevenusEtrangersEur: s.autresRevenusEtrangersEur,
  };
}
