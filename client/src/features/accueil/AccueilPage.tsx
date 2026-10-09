import { useMemo, useState, type ReactNode } from 'react';
import { mensualite } from '@shared/outils/credit.js';
import { Lien } from '@/lib/router';
import { OUTILS, SIMULATEURS, lireDernierSimulateur } from '@/lib/navigation';
import type { Route } from '@/lib/router';
import { useSession } from '@/features/auth';
import { useOutilsStore } from '@/store/outilsStore';

// ─── Icons: one stroke weight, drawn on a 24 grid ────────────────────────────

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONES: Record<Route, ReactNode> = {
  credit: (
    <Icone>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </Icone>
  ),
  rendement: (
    <Icone>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15l6-6" />
      <circle cx="9.5" cy="9.5" r=".75" fill="currentColor" />
      <circle cx="14.5" cy="14.5" r=".75" fill="currentColor" />
    </Icone>
  ),
  interets: (
    <Icone>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
      <path d="M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
      <path d="M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
    </Icone>
  ),
  sci: (
    <Icone>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-6h6v6" />
      <path d="M8 11h.01M16 11h.01" />
    </Icone>
  ),
  frontalier: (
    <Icone>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </Icone>
  ),
  saisonnier: (
    <Icone>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icone>
  ),
  accueil: null,
  aide: null,
  connexion: null,
  inscription: null,
  mentions: null,
  confidentialite: null,
  confirmation: null,
};

/** What each advanced simulator gives, in three concrete lines. */
const POINTS: Partial<Record<Route, string[]>> = {
  sci: ['Cinq montages compares cote a cote', 'Impot, tresorerie et TRI sur 30 ans', 'Revente et transmission chiffrees'],
  frontalier: ['Test des 90 % du quasi-resident', 'TOU contre impot a la source, pas a pas', 'Justificatifs lus automatiquement'],
  saisonnier: ['Revenus saison par saison', 'LMNP au reel ou micro-BIC', 'Annonce analysee en un clic'],
};

const eur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

// ─── Mini calculator ─────────────────────────────────────────────────────────

/** Something to touch before reading anything: amount and duration in, payment out. */
/** A rate typed in percent, kept as long as it parses. */
function ChampTaux({ label, value, onChange, step, aide }: { label: string; value: number; onChange: (v: number) => void; step: number; aide?: string }) {
  return (
    <label title={aide}>
      <span className="block text-sm text-gray-600">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={15}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && v >= 0) onChange(v);
          }}
          className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900"
        />
        <span className="text-sm text-gray-500">%</span>
      </span>
    </label>
  );
}

function MiniCredit() {
  const defauts = useOutilsStore((s) => s.credit);
  const [montant, setMontant] = useState(200000);
  const [annees, setAnnees] = useState(20);
  const [taux, setTaux] = useState(defauts.taux);
  // Insurance included, as banks and comparators quote it: a payment without
  // it looked hundreds of euros cheaper than everywhere else.
  const [tauxAssurance, setTauxAssurance] = useState(defauts.tauxAssurance);

  const mois = annees * 12;
  const credit = useMemo(() => mensualite(montant, taux / 100, mois).toNumber(), [montant, taux, mois]);
  const assurance = (montant * tauxAssurance) / 100 / 12;
  const coutTotal = Math.max(0, credit * mois - montant) + assurance * mois;

  return (
    <div className="rounded-2xl border border-white/60 bg-white/95 p-5 text-gray-900 shadow-xl shadow-indigo-900/20 sm:p-6">
      <p className="text-sm font-medium text-gray-900">Votre mensualite, tout de suite</p>

      <label className="mt-4 block">
        <span className="flex items-baseline justify-between text-sm text-gray-600">
          Montant emprunte <span className="font-semibold tabular-nums text-gray-900">{eur(montant)}</span>
        </span>
        <input
          type="range"
          min={50000}
          max={800000}
          step={5000}
          value={montant}
          onChange={(e) => setMontant(Number(e.target.value))}
          className="mt-2 w-full accent-indigo-600"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <span className="block text-sm text-gray-600">Duree</span>
          <div className="mt-1 inline-flex rounded-md border border-gray-200 p-0.5">
            {[15, 20, 25].map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={a === annees}
                onClick={() => setAnnees(a)}
                className={`rounded px-3 py-1 text-sm ${a === annees ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {a} ans
              </button>
            ))}
          </div>
        </div>
        <ChampTaux label="Taux" value={taux} onChange={setTaux} step={0.05} />
        <ChampTaux
          label="Assurance"
          value={tauxAssurance}
          onChange={setTauxAssurance}
          step={0.01}
          aide="Taux annuel sur le capital emprunte : de 0,10 % a 0,50 % selon l’age."
        />
      </div>

      <div className="mt-5 border-t pt-4">
        <p className="text-xs text-gray-500">Mensualite, assurance comprise</p>
        <p className="text-4xl font-bold tabular-nums tracking-tight text-gray-900">{eur(credit + assurance)}</p>
        <p className="mt-1 text-xs text-gray-500">
          {eur(credit)} de credit + {eur(assurance)} d’assurance · cout total {eur(coutTotal)}
        </p>
      </div>

      <Lien vers="credit" className="mt-4 inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900">
        Frais de notaire, comparatif, capacite d’emprunt →
      </Lien>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PROMESSES = [
  { titre: 'Calcul exact', texte: 'Au centime pres, sans arrondi de virgule flottante.' },
  { titre: 'Hypotheses visibles', texte: 'Chaque taux, chaque frais se lit et se modifie.' },
  { titre: 'Donnees privees', texte: 'Outils rapides sans envoi au serveur ; cles API chiffrees.' },
];

/**
 * Landing page: something useful first (the mini calculator), then what the
 * site offers, free tools before what an account unlocks.
 */
export function AccueilPage() {
  const { user, chargement } = useSession();
  const visiteur = !user && !chargement;

  return (
    <div className="mx-auto max-w-6xl space-y-16 pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 px-6 py-10 text-white sm:px-10 sm:py-14">
        {/* A faint roof line, echo of the logo — texture, not decoration to read. */}
        <svg
          viewBox="0 0 400 200"
          className="pointer-events-none absolute -right-16 -top-10 h-[130%] opacity-[0.07]"
          fill="none"
          stroke="white"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20,150 200,20 380,150" />
        </svg>

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Immobilier, fiscalite, epargne
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Les bons chiffres, <br className="hidden sm:block" />
              avant de signer.
            </h2>
            <p className="mt-4 max-w-xl text-base text-indigo-100 sm:text-lg">
              Credit, rendement d’un bien, epargne : des calculs clairs, sans compte. Et quand le projet se precise,
              des simulateurs qui comparent les montages et leur fiscalite sur trente ans.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Lien
                vers="credit"
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
              >
                Simuler mon credit
              </Lien>
              {/* Nothing until the session is known: neither wording should flash for the wrong person. */}
              {!chargement && (
                <Lien
                  vers={user ? (lireDernierSimulateur() ?? 'sci') : 'inscription'}
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/40 hover:bg-white/10"
                >
                  {user ? 'Mes simulateurs' : 'Creer un compte gratuit'}
                </Lien>
              )}
            </div>
          </div>
          <MiniCredit />
        </div>
      </section>

      {/* Quick tools */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold text-gray-900">Outils rapides</h3>
          <p className="text-sm text-gray-500">Gratuits, sans compte, calcules dans votre navigateur.</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {OUTILS.map((o) => (
            <Lien
              key={o.route}
              vers={o.route}
              className="group flex flex-col rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                {ICONES[o.route]}
              </span>
              <span className="mt-4 font-semibold text-gray-900">{o.titre}</span>
              <span className="mt-1 flex-1 text-sm text-gray-500">{o.resume}</span>
              <span className="mt-4 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">Ouvrir →</span>
            </Lien>
          ))}
        </div>
      </section>

      {/* Advanced simulators */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold text-gray-900">Simulateurs avances</h3>
          <p className="text-sm text-gray-500">
            {visiteur ? 'Avec un compte gratuit : vos scenarios sont enregistres.' : user ? 'Vos scenarios sont enregistres.' : ''}
          </p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {SIMULATEURS.map((s) => (
            <Lien
              key={s.route}
              vers={s.route}
              className="group flex flex-col rounded-2xl border bg-white p-6 transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
                  {ICONES[s.route]}
                </span>
                {visiteur && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">Avec un compte</span>
                )}
              </div>
              <span className="mt-4 text-lg font-semibold text-gray-900">{s.titre}</span>
              <ul className="mt-3 flex-1 space-y-2">
                {POINTS[s.route]?.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
              <span className="mt-5 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
                {visiteur ? 'Decouvrir →' : 'Ouvrir →'}
              </span>
            </Lien>
          ))}
        </div>
      </section>

      {/* Promises */}
      <section className="grid gap-6 border-y py-8 sm:grid-cols-3">
        {PROMESSES.map((p) => (
          <div key={p.titre}>
            <p className="font-semibold text-gray-900">{p.titre}</p>
            <p className="mt-1 text-sm text-gray-500">{p.texte}</p>
          </div>
        ))}
      </section>

      {visiteur && (
        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gray-900 px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
          <div>
            <p className="text-lg font-semibold">SCI, holding, frontalier : allez plus loin.</p>
            <p className="mt-1 text-sm text-gray-300">Un compte gratuit, et vos simulations vous attendent sur tous vos appareils.</p>
          </div>
          <Lien
            vers="inscription"
            className="shrink-0 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
          >
            Creer un compte
          </Lien>
        </section>
      )}
    </div>
  );
}
