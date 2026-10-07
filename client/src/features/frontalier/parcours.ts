import type { DocumentType } from '@shared/frontalier.js';
import type { FrontalierInputs, QuiPersonne } from '@/store/frontalierStore';

/**
 * The TOU wizard, described as data: which steps a household goes through,
 * which papers each one asks for, and what looks incomplete. No React here,
 * so the checklist, the step bar and the recap all read the same rules.
 *
 * A step that does not concern the household is not shown; it is never a
 * gate either — the user can move on with empty fields, the alerts only
 * say what is missing.
 */

export type EtapeId =
  | 'profil'
  | 'documents'
  | 'foyer'
  | 'contribuable'
  | 'conjoint'
  | 'deductions'
  | 'france'
  | 'travaux'
  | 'resultat';

export interface Etape {
  id: EtapeId;
  /** Same words as the form's own heading, so the bar and the page agree. */
  titre: string;
  /** Short label for the step bar. */
  court: string;
  aide: string;
  visible: (s: FrontalierInputs) => boolean;
}

const toujours = () => true;
const conjointSuisse = (s: FrontalierInputs) => s.etatCivil === 'MARIE' && s.conjoint.activite === 'SUISSE';

export const ETAPES: Etape[] = [
  {
    id: 'profil',
    titre: 'Votre situation',
    court: 'Situation',
    aide: 'Quelques questions pour n’afficher que ce qui vous concerne.',
    visible: toujours,
  },
  {
    id: 'documents',
    titre: 'Documents a reunir',
    court: 'Documents',
    aide: 'Rassemblez ces pieces avant de commencer : chaque etape vous demandera les siennes.',
    visible: toujours,
  },
  {
    id: 'foyer',
    titre: 'Lieu de travail et foyer',
    court: 'Foyer',
    aide: 'Commune de travail, enfants a charge et cours de change.',
    visible: toujours,
  },
  {
    id: 'contribuable',
    titre: 'Contribuable',
    court: 'Contribuable',
    aide: 'Recopiez votre certificat de salaire case par case, ou deposez-le pour qu’il soit lu.',
    visible: toujours,
  },
  {
    id: 'conjoint',
    titre: 'Conjoint',
    court: 'Conjoint',
    aide: 'Ou qu’ils soient gagnes, ils entrent dans le test des 90 % et dans le taux.',
    visible: (s) => s.etatCivil === 'MARIE',
  },
  {
    id: 'deductions',
    titre: 'Deductions du foyer',
    court: 'Deductions',
    aide: 'Assurances, interets, frais medicaux, dons : ce qu’un resident du canton deduirait.',
    visible: toujours,
  },
  {
    id: 'france',
    titre: 'Revenus en France',
    court: 'France',
    aide: 'Exoneres en Suisse mais pris en compte pour le taux : chaque charge saisie le fait baisser.',
    visible: (s) => s.profil.revenusFrance,
  },
  {
    id: 'travaux',
    titre: 'Travaux',
    court: 'Travaux',
    aide: 'Une ligne par facture, rattachee a son bien.',
    visible: (s) => s.profil.revenusFrance && s.travauxActifs,
  },
  {
    id: 'resultat',
    titre: 'Recapitulatif et resultat',
    court: 'Resultat',
    aide: 'Verifiez les montants, puis lancez la comparaison.',
    visible: toujours,
  },
];

export function etapesVisibles(s: FrontalierInputs): Etape[] {
  return ETAPES.filter((e) => e.visible(s));
}

// ─── Pieces justificatives ──────────────────────────────────────────────────

export const LIBELLES_DOCUMENTS: Record<DocumentType, string> = {
  CERTIFICAT_SALAIRE: 'Certificat de salaire',
  ATTESTATION_3A: 'Attestation 3e pilier A',
  ATTESTATION_LPP_RACHAT: 'Rachat LPP',
  ASSURANCE_MALADIE: 'Assurance maladie',
  ASSURANCE_VIE: 'Assurance-vie',
  INTERETS_DETTE: 'Interets de dette',
  CHARGES_COPRO: 'Charges de copropriete',
  TAXE_FONCIERE: 'Taxe fonciere',
  FACTURE_TRAVAUX: 'Facture de travaux',
  ATTESTATION_QUITTANCE_IS: 'Attestation impot a la source',
  FRAIS_GARDE: 'Frais de garde',
  AUTRE: 'Document non reconnu',
};

/** The step whose fields a document of this type fills; none for an unrecognised one. */
export const ETAPE_DU_DOCUMENT: Record<DocumentType, EtapeId | null> = {
  AUTRE: null,
  CERTIFICAT_SALAIRE: 'contribuable',
  ATTESTATION_QUITTANCE_IS: 'contribuable',
  ATTESTATION_3A: 'contribuable',
  ATTESTATION_LPP_RACHAT: 'contribuable',
  FRAIS_GARDE: 'foyer',
  ASSURANCE_MALADIE: 'deductions',
  ASSURANCE_VIE: 'deductions',
  INTERETS_DETTE: 'deductions',
  TAXE_FONCIERE: 'france',
  CHARGES_COPRO: 'france',
  FACTURE_TRAVAUX: 'travaux',
};

export interface Piece {
  libelle: string;
  ouLeTrouver: string;
  /** false: only if the household has such an expense. */
  indispensable: boolean;
  /** Set when the document can be read automatically. */
  type?: DocumentType;
}

function piecesSalarie(qui: QuiPersonne): Piece[] {
  const de = qui === 'conjoint' ? ' du conjoint' : '';
  return [
    {
      libelle: `Certificat de salaire 2026${de}`,
      ouLeTrouver: 'Remis par l’employeur en janvier-fevrier (formulaire 11).',
      indispensable: true,
      type: 'CERTIFICAT_SALAIRE',
    },
    {
      libelle: `Attestation-quittance de l’impot a la source${de}`,
      ouLeTrouver: 'Envoyee par l’employeur ou l’administration fiscale ; a defaut, la fiche de paie de decembre (cumul annuel).',
      indispensable: true,
      type: 'ATTESTATION_QUITTANCE_IS',
    },
    {
      libelle: `Attestation de versements 3e pilier A${de}`,
      ouLeTrouver: 'Banque ou assurance, en debut d’annee.',
      indispensable: false,
      type: 'ATTESTATION_3A',
    },
    {
      libelle: `Attestation de rachat LPP${de}`,
      ouLeTrouver: 'Caisse de pension, apres chaque rachat.',
      indispensable: false,
      type: 'ATTESTATION_LPP_RACHAT',
    },
    {
      libelle: `Justificatifs de frais professionnels${de}`,
      ouLeTrouver: 'Abonnement de transport, factures de formation continue.',
      indispensable: false,
    },
  ];
}

/** Papers asked by one step, given the household. */
export function piecesEtape(id: EtapeId, s: FrontalierInputs): Piece[] {
  switch (id) {
    case 'foyer':
      return s.profil.enfants
        ? [
            {
              libelle: 'Factures de frais de garde',
              ouLeTrouver: 'Creche, assistante maternelle, accueil parascolaire — enfants de moins de 14 ans.',
              indispensable: false,
              type: 'FRAIS_GARDE',
            },
          ]
        : [];
    case 'contribuable':
      return piecesSalarie('contribuable');
    case 'conjoint':
      if (conjointSuisse(s)) return piecesSalarie('conjoint');
      if (s.conjoint.activite === 'FRANCE') {
        return [
          {
            libelle: 'Bulletin de salaire de decembre ou avis d’imposition du conjoint',
            ouLeTrouver: 'Pour le revenu brut (test des 90 %) et le net imposable (taux).',
            indispensable: true,
          },
        ];
      }
      return [];
    case 'deductions':
      return [
        {
          libelle: 'Attestation annuelle d’assurance maladie',
          ouLeTrouver: 'Caisse LAMal ou CPAM / mutuelle, complementaires comprises, pour tout le foyer.',
          indispensable: true,
          type: 'ASSURANCE_MALADIE',
        },
        {
          libelle: 'Attestation d’assurance-vie (3e pilier B)',
          ouLeTrouver: 'Assureur, en debut d’annee.',
          indispensable: false,
          type: 'ASSURANCE_VIE',
        },
        {
          libelle: 'Releve des interets de dettes privees',
          ouLeTrouver: 'Banque : credit a la consommation, leasing… (pas les prets des biens en France).',
          indispensable: false,
          type: 'INTERETS_DETTE',
        },
        {
          libelle: 'Factures de frais medicaux non rembourses',
          ouLeTrouver: 'Decomptes de l’assurance, part restee a votre charge.',
          indispensable: false,
        },
        {
          libelle: 'Recus de dons et preuve de pension alimentaire versee',
          ouLeTrouver: 'Institutions suisses reconnues d’utilite publique ; jugement et virements.',
          indispensable: false,
        },
      ];
    case 'france':
      return [
        {
          libelle: 'Avis de taxe fonciere',
          ouLeTrouver: 'Espace particulier impots.gouv.fr, un par bien.',
          indispensable: true,
          type: 'TAXE_FONCIERE',
        },
        {
          libelle: 'Releve des loyers encaisses',
          ouLeTrouver: 'Bail, quittances ou releve de l’agence — biens loues seulement.',
          indispensable: false,
        },
        {
          libelle: 'Decompte annuel des charges de copropriete',
          ouLeTrouver: 'Envoye par le syndic avec l’approbation des comptes.',
          indispensable: false,
          type: 'CHARGES_COPRO',
        },
        {
          libelle: 'Attestation d’interets du pret immobilier',
          ouLeTrouver: 'Banque, en debut d’annee, ou tableau d’amortissement.',
          indispensable: false,
          type: 'INTERETS_DETTE',
        },
        {
          libelle: 'Avis d’echeance de l’assurance du bien',
          ouLeTrouver: 'Assurance habitation ou proprietaire non occupant.',
          indispensable: false,
        },
        {
          libelle: 'Releves des autres revenus hors de Suisse',
          ouLeTrouver: 'IFU de la banque ou du courtier : dividendes, interets, revenus d’une SCI.',
          indispensable: false,
        },
      ];
    case 'travaux':
      return [
        {
          libelle: 'Factures de travaux de l’annee',
          ouLeTrouver: 'Une par artisan ; la nature des travaux decide de leur deductibilite.',
          indispensable: true,
          type: 'FACTURE_TRAVAUX',
        },
      ];
    default:
      return [];
  }
}

/** Document types a step's drop zone expects. */
export function typesAttendus(id: EtapeId, s: FrontalierInputs): DocumentType[] {
  return [...new Set(piecesEtape(id, s).flatMap((p) => (p.type ? [p.type] : [])))];
}

// ─── Alertes non bloquantes ─────────────────────────────────────────────────

const zero = (v: string | undefined) => !(parseFloat(v ?? '0') > 0);

export function alertes(id: EtapeId, s: FrontalierInputs): string[] {
  const out: string[] = [];
  switch (id) {
    case 'foyer':
      if (s.profil.enfants && s.enfants.length === 0) out.push('Vous avez indique des enfants a charge, mais aucun n’est saisi.');
      break;
    case 'contribuable':
    case 'conjoint': {
      const qui: QuiPersonne = id;
      const p = s[qui];
      if (p.activite === 'SUISSE') {
        if (zero(p.salaireBrut)) out.push('Salaire brut a zero : il se lit en case 8 du certificat de salaire.');
        if (zero(p.impotSourceRetenu)) {
          out.push('Impot a la source retenu non saisi : la comparaison se fera avec l’impot calcule selon le bareme.');
        }
        if (!zero(p.lppRachats) && !p.affilieLpp) out.push('Rachat LPP saisi sans affiliation a une caisse de pension.');
        if (p.affilieLpp && parseFloat(p.pilier3a) > 7258) out.push('Versements 3a au-dela du plafond de 7 258 CHF : l’excedent n’est pas deductible.');
      } else if (p.activite === 'FRANCE' && zero(p.revenuFranceBrutEur)) {
        out.push('Revenu brut francais a zero : il compte dans le test des 90 %.');
      }
      break;
    }
    case 'deductions':
      if (zero(s.deductions.primesAssuranceMaladie)) {
        out.push('Aucune prime d’assurance maladie : c’est en general la deduction la plus importante.');
      }
      break;
    case 'france':
      if (s.biensFrance.length === 0 && zero(s.autresRevenusEtrangersEur)) {
        out.push('Aucun bien ni revenu saisi alors que vous en avez indique.');
      }
      s.biensFrance.forEach((b, i) => {
        const nom = b.label || `Bien ${i + 1}`;
        if (b.usage === 'LOCATIF' && zero(b.loyersBrutsEur)) out.push(`${nom} : bien loue sans loyers saisis.`);
        if (b.usage !== 'LOCATIF' && zero(b.valeurLocativeEur)) out.push(`${nom} : valeur locative non saisie.`);
      });
      break;
    case 'travaux':
      if (s.travaux.length === 0) out.push('Aucune facture de travaux saisie.');
      break;
  }
  return out;
}
