import { useState, type ReactNode } from 'react';
import type Decimal from 'decimal.js';

export const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
export const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const num = (v: Decimal | number) => (typeof v === 'number' ? v : v.toNumber());

export function formatEur(v: Decimal | number, chiffres = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: chiffres,
    minimumFractionDigits: chiffres,
  }).format(num(v));
}

/** A fraction of 1 shown as a percentage. */
export function formatPct(v: Decimal | number, chiffres = 2): string {
  return `${(num(v) * 100).toFixed(chiffres).replace('.', ',')} %`;
}

/**
 * A number field that lets the user clear it while typing: the text is kept
 * locally and only a parsable value reaches the store.
 */
export function ChampNombre({
  label,
  value,
  onChange,
  unite,
  step = 1,
  min = 0,
  max,
  aide,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unite: '€' | '€/mois' | '€/an' | '%' | 'ans' | 'mois';
  step?: number;
  min?: number;
  max?: number;
  aide?: ReactNode;
}) {
  const [texte, setTexte] = useState<string | null>(null);
  return (
    <div>
      <label className={labelClass}>
        {label} <span className="font-normal text-gray-400">({unite})</span>
      </label>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        className={inputClass}
        value={texte ?? String(value)}
        onChange={(e) => {
          setTexte(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, max !== undefined ? Math.min(max, v) : v));
        }}
        onBlur={() => setTexte(null)}
      />
      {aide && <p className="mt-1 text-xs text-gray-400">{aide}</p>}
    </div>
  );
}

export function Bascule<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      {label && <span className={labelClass}>{label}</span>}
      <div className="inline-flex rounded-md border border-gray-300 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded px-3 py-1.5 text-sm ${
              o.value === value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">{titre}</legend>
      {children}
    </fieldset>
  );
}

export function CarteResultat({
  label,
  valeur,
  detail,
  ton = 'neutre',
  grand,
}: {
  label: string;
  valeur: string;
  detail?: ReactNode;
  ton?: 'neutre' | 'bon' | 'mauvais';
  grand?: boolean;
}) {
  const couleur = ton === 'bon' ? 'text-green-700' : ton === 'mauvais' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className={`rounded-lg border bg-white p-4 ${grand ? 'sm:col-span-2' : ''}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 font-mono font-semibold ${couleur} ${grand ? 'text-3xl' : 'text-lg'}`}>{valeur}</p>
      {detail && <div className="mt-1 text-xs text-gray-500">{detail}</div>}
    </div>
  );
}

export function Alertes({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      {messages.map((m) => (
        <li key={m}>⚠ {m}</li>
      ))}
    </ul>
  );
}

/** Inputs on the left, results on the right; stacked on a phone. */
export function MiseEnPage({
  titre,
  intro,
  saisie,
  resultats,
}: {
  titre: string;
  intro: ReactNode;
  saisie: ReactNode;
  resultats: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{titre}</h2>
        <p className="mt-1 text-sm text-gray-500">{intro}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-6 rounded-lg border bg-white p-4">{saisie}</div>
        <div className="min-w-0 space-y-4">{resultats}</div>
      </div>
    </div>
  );
}
