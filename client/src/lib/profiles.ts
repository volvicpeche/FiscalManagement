import type { ScenarioProfile, StructureType } from '@shared/schemas.js';

/** Display order of the three structural setups being compared. */
export const PROFILE_ORDER: ScenarioProfile[] = ['SCI_IR', 'SCI_IS_SEULE', 'SCI_IS_HOLDING'];

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
};

/** Entities produced by `buildScenario`, per profile — name and legal type. */
export const ENTITY_SPECS: Record<ScenarioProfile, { name: string; type: StructureType }[]> = {
  SCI_IR: [{ name: 'SCI (IR)', type: 'SCI_IR' }],
  SCI_IS_SEULE: [{ name: 'SCI (IS)', type: 'SCI_IS' }],
  SCI_IS_HOLDING: [
    { name: 'Holding', type: 'HOLDING' },
    { name: 'SCI (IS)', type: 'SCI_IS' },
  ],
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
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: digits,
  }).format(Number.isFinite(num) ? num : 0);
}
