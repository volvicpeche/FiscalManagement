import type { ReactNode } from 'react';
import type { CommuneGe } from '@shared/frontalier.js';

export const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
export const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export function formatChf(value: string | number, digits = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(num);
}

export function formatPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits).replace('.', ',')} %`;
}

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) || num < 0 ? '0.00' : num.toFixed(2);
}

export function Titre({ children, aide }: { children: ReactNode; aide?: ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{children}</h3>
      {aide && <p className="text-xs text-gray-500 mt-0.5">{aide}</p>}
    </div>
  );
}

/** Badge shown on a field filled from a document, until the user edits it. */
export function SourceBadge({ fichier }: { fichier?: string }) {
  if (!fichier) return null;
  return (
    <span
      title={`Lu depuis ${fichier}`}
      className="ml-1 inline-block max-w-[9rem] truncate align-middle rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-normal text-indigo-700"
    >
      📄 {fichier}
    </span>
  );
}

export function Montant({
  label,
  value,
  onChange,
  devise = 'CHF',
  source,
  aide,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  devise?: 'CHF' | 'EUR';
  source?: string;
  aide?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>
        {label} <span className="text-gray-400 font-normal">({devise})</span>
        <SourceBadge fichier={source} />
      </label>
      <input
        type="number"
        min={0}
        step={100}
        className={`${inputClass} ${source ? 'border-indigo-300 bg-indigo-50/40' : ''}`}
        value={parseFloat(value) || 0}
        onChange={(e) => onChange(toDecimalStr(e.target.value))}
      />
      {aide && <p className="text-xs text-gray-400 mt-1">{aide}</p>}
    </div>
  );
}

export const CODES_TARIF = [
  ...['A', 'B', 'C'].flatMap((l) => [0, 1, 2, 3, 4, 5].map((n) => `${l}${n}`)),
  ...[1, 2, 3, 4, 5].map((n) => `H${n}`),
];

export const LIBELLES_COMMUNES: Record<CommuneGe, string> = {
  GENEVE: 'Ville de Geneve',
  AIRE_LA_VILLE: 'Aire-la-Ville',
  ANIERES: 'Anieres',
  AVULLY: 'Avully',
  AVUSY: 'Avusy',
  BARDONNEX: 'Bardonnex',
  BELLEVUE: 'Bellevue',
  BERNEX: 'Bernex',
  CAROUGE: 'Carouge',
  CARTIGNY: 'Cartigny',
  CELIGNY: 'Celigny',
  CHANCY: 'Chancy',
  CHENE_BOUGERIES: 'Chene-Bougeries',
  CHENE_BOURG: 'Chene-Bourg',
  CHOULEX: 'Choulex',
  COLLEX_BOSSY: 'Collex-Bossy',
  COLLONGE_BELLERIVE: 'Collonge-Bellerive',
  COLOGNY: 'Cologny',
  CONFIGNON: 'Confignon',
  CORSIER: 'Corsier',
  DARDAGNY: 'Dardagny',
  GENTHOD: 'Genthod',
  GRAND_SACONNEX: 'Grand-Saconnex',
  GY: 'Gy',
  HERMANCE: 'Hermance',
  JUSSY: 'Jussy',
  LACONNEX: 'Laconnex',
  LANCY: 'Lancy',
  MEINIER: 'Meinier',
  MEYRIN: 'Meyrin',
  ONEX: 'Onex',
  PERLY_CERTOUX: 'Perly-Certoux',
  PLAN_LES_OUATES: 'Plan-les-Ouates',
  PREGNY_CHAMBESY: 'Pregny-Chambesy',
  PRESINGE: 'Presinge',
  PUPLINGE: 'Puplinge',
  RUSSIN: 'Russin',
  SATIGNY: 'Satigny',
  SORAL: 'Soral',
  THONEX: 'Thonex',
  TROINEX: 'Troinex',
  VANDOEUVRES: 'Vandoeuvres',
  VERNIER: 'Vernier',
  VERSOIX: 'Versoix',
  VEYRIER: 'Veyrier',
};
