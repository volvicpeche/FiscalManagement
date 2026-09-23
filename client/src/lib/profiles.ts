import type { ScenarioProfile, StructureType } from '@shared/schemas.js';

/** Display order of the structural setups being compared. */
export const PROFILE_ORDER: ScenarioProfile[] = [
  'SCI_IR',
  'SCI_IS_SEULE',
  'SCI_IS_HOLDING',
  'LMNP_REEL',
  'LMNP_MICRO',
];

export interface ProfileMeta {
  label: string;
  short: string;
  description: string;
  /** Chart line colour. */
  stroke: string;
  fill: string;
  text: string;
  bg: string;
  border: string;
}

export const PROFILE_META: Record<ScenarioProfile, ProfileMeta> = {
  SCI_IR: {
    label: 'SCI a l’IR',
    short: 'SCI IR',
    description:
      'Translucidite fiscale : le resultat est reparti entre les associes et impose au bareme progressif de chacun. Pas d’amortissement, mais pas de comptabilite commerciale ni de CFE.',
    stroke: '#f59e0b',
    fill: '#fef3c7',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  SCI_IS_SEULE: {
    label: 'SCI a l’IS',
    short: 'SCI IS',
    description:
      'La SCI paie l’impot elle-meme (15 % puis 25 %) et amortit le bien, ce qui efface le resultat imposable pendant des annees. En contrepartie : comptabilite commerciale, CFE, et une plus-value calculee sur la VNC a la sortie.',
    stroke: '#3b82f6',
    fill: '#bfdbfe',
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  SCI_IS_HOLDING: {
    label: 'Holding + SCI a l’IS',
    short: 'Holding + SCI',
    description:
      'La holding detient la SCI et remonte les dividendes en franchise a 95 % (regime mere-fille). Le cash est capitalise au niveau de la holding, mais la structure coute deux fois plus cher a maintenir.',
    stroke: '#8b5cf6',
    fill: '#ddd6fe',
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  LMNP_REEL: {
    label: 'LMNP au reel',
    short: 'LMNP reel',
    description:
      'Location meublee longue duree, bien detenu en direct (en indivision s’il y a plusieurs associes). L’amortissement efface le loyer sans jamais creer de deficit ; l’excedent est differe. Aucune societe, mais une liasse BIC chaque annee et les amortissements reintegres dans la plus-value a la revente.',
    stroke: '#10b981',
    fill: '#a7f3d0',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  LMNP_MICRO: {
    label: 'LMNP micro-BIC',
    short: 'LMNP micro',
    description:
      'Location meublee longue duree en direct, au forfait : 50 % du loyer brut est impose, sans charges, interets ni amortissements. Aucune comptabilite, plus-value des particuliers sans reprise. Au-dela de 77 700 EUR de loyers, le reel s’applique.',
    stroke: '#0891b2',
    fill: '#a5f3fc',
    text: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
  },
};

export interface EntitySpec {
  name: string;
  type: StructureType;
  /** Cost preset to read when it is not the structure type's own. */
  presetKey?: CostPresetKey;
}

/** Keys of the cost presets served by the engine. */
export type CostPresetKey = StructureType | 'LMNP_MICRO_BIC';

/** Entities produced by `buildScenario`, per profile — name and legal type. */
export const ENTITY_SPECS: Record<ScenarioProfile, EntitySpec[]> = {
  SCI_IR: [{ name: 'SCI (IR)', type: 'SCI_IR' }],
  SCI_IS_SEULE: [{ name: 'SCI (IS)', type: 'SCI_IS' }],
  SCI_IS_HOLDING: [
    { name: 'Holding', type: 'HOLDING' },
    { name: 'SCI (IS)', type: 'SCI_IS' },
  ],
  LMNP_REEL: [{ name: 'LMNP (reel)', type: 'LMNP' }],
  LMNP_MICRO: [{ name: 'LMNP (micro-BIC)', type: 'LMNP', presetKey: 'LMNP_MICRO_BIC' }],
};

export const MODE_LABELS: Record<string, string> = {
  SOI_MEME: 'Je m’en occupe moi-meme',
  EN_LIGNE: 'Plateforme en ligne',
  EXPERT_COMPTABLE: 'Expert-comptable',
  NOTAIRE_AVOCAT: 'Notaire / avocat',
};

export const RELATION_LABELS: Record<string, string> = {
  SELF: 'Moi-meme',
  SPOUSE: 'Conjoint(e)',
  CHILD: 'Enfant',
  GRANDCHILD: 'Petit-enfant',
  SIBLING: 'Frere / soeur',
  NEPHEW_NIECE: 'Neveu / niece',
  OTHER: 'Autre',
};

export function formatEur(value: string | number, digits = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  // Never render missing data as "0 €" — a plausible wrong number is worse
  // than an obvious gap.
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: digits,
  }).format(num);
}
