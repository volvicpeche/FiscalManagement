import { useState } from 'react';
import type { ScenarioProfile } from '@shared/schemas.js';
import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';
import { toRows, type Row } from './projectionColumns';

/**
 * Where the money actually is, and where the year's cash flow went.
 *
 * The projection table shows flows: money moving. It never showed stocks —
 * what the company holds and owes once everything has moved — so "the cash
 * flow was +7 400" left no trace anyone could point at. This card closes that
 * loop, and states the identity the succession later values the shares on.
 */

function Ligne({
  label,
  montant,
  fort,
  aide,
}: {
  label: string;
  montant: number;
  fort?: boolean;
  aide?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3" title={aide}>
      <span className={`text-sm ${fort ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums whitespace-nowrap ${
          fort ? 'text-sm font-bold text-gray-900' : 'text-sm text-gray-700'
        }`}
      >
        {formatEur(montant)}
      </span>
    </div>
  );
}

/** One branch of the year's cash flow, with its share of the total. */
function Destination({
  label,
  montant,
  total,
  couleur,
  aide,
}: {
  label: string;
  montant: number;
  total: number;
  couleur: string;
  aide: string;
}) {
  const part = total > 0 ? Math.min(100, (montant / total) * 100) : 0;
  return (
    <div title={aide}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-mono tabular-nums text-gray-800">{formatEur(montant)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${couleur}`} style={{ width: `${part}%` }} />
      </div>
    </div>
  );
}

export function BilanCard({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const [profile, setProfile] = useState<ScenarioProfile>(available[0] ?? 'SCI_IS_SEULE');

  const result = results[profile] ?? results[available[0]];
  const rows: Row[] = result ? toRows(result) : [];
  const derniere = rows.length ? rows[rows.length - 1].year : 0;
  const [annee, setAnnee] = useState<number | null>(null);

  if (!result || rows.length === 0) return null;

  const anneeChoisie = annee === null ? derniere : Math.min(annee, derniere);
  const row = rows.find((r) => r.year === anneeChoisie) ?? rows[rows.length - 1];
  const precedent = rows.find((r) => r.year === row.year - 1);

  const actif = row.valeurBien + row.tresorerie;
  const passif = row.detteRestante + row.ccaSolde;

  // A company cannot really hold negative cash: it means the operation consumes
  // more than it produces and somebody covers the gap. The model lets the
  // balance go below zero without recording who paid, so the least it can do is
  // say how much and when.
  const anneesADecouvert = rows.filter((r) => r.tresorerie < -0.005);
  const pire = anneesADecouvert.reduce<Row | null>(
    (min, r) => (min === null || r.tresorerie < min.tresorerie ? r : min),
    null,
  );

  // How the year's cash flow was disposed of, from the COMPANY's point of view.
  // `row.cashFlow` is the family's and nets off the associes' personal tax, so
  // using it here would leave the treasury short by that amount.
  const garde = precedent ? row.tresorerie - precedent.tresorerie : row.tresorerie;
  const sorties = row.ccaRembourse + row.dividendeVerse;
  const totalDestinations = Math.max(Math.abs(garde) + sorties, 1);

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Bilan de la SCI</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Ce que la societe possede et ce qu’elle doit, une fois tous les mouvements passes.
        </p>
      </div>

      <div className="flex gap-1">
        {available.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProfile(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              profile === p
                ? `${PROFILE_META[p].bg} ${PROFILE_META[p].border} ${PROFILE_META[p].text}`
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {PROFILE_META[p].label}
          </button>
        ))}
      </div>

      {/* Year picker */}
      <div>
        <label className="flex items-baseline justify-between text-sm font-medium text-gray-700 mb-1">
          <span>{row.year === 0 ? 'A la creation' : `Annee ${row.year}`}</span>
          <button
            type="button"
            onClick={() => setAnnee(null)}
            className="text-xs font-normal text-blue-600 hover:text-blue-800"
          >
            revenir au terme
          </button>
        </label>
        <input
          type="range"
          min={0}
          max={derniere}
          step={1}
          className="w-full accent-blue-600"
          value={row.year}
          onChange={(e) => setAnnee(parseInt(e.target.value))}
        />
      </div>

      {/* The balance sheet itself */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
            Ce qu’elle possede
          </p>
          <Ligne label="Valeur du bien" montant={row.valeurBien} />
          <Ligne
            label="Tresorerie"
            montant={row.tresorerie}
            aide="Le cash-flow net accumule, moins ce qui est sorti en dividendes et en remboursements de compte courant."
          />
          <div className="pt-1.5 border-t border-emerald-200">
            <Ligne label="Total actif" montant={actif} fort />
          </div>
        </div>

        <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-1">
            Ce qu’elle doit
          </p>
          <Ligne label="Dette bancaire" montant={row.detteRestante} />
          <Ligne
            label="Compte courant"
            montant={row.ccaSolde}
            aide="Une dette envers vous, pas envers un tiers. Elle se rembourse sans aucune imposition, mais tant qu'elle existe elle entre dans votre succession a sa valeur nominale."
          />
          <div className="pt-1.5 border-t border-rose-200">
            <Ligne label="Total dettes" montant={passif} fort />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-blue-900">Situation nette</span>
          <span className="font-mono tabular-nums text-lg font-bold text-blue-900">
            {formatEur(actif - passif)}
          </span>
        </div>
        <p className="text-xs text-blue-800 mt-0.5">
          Ce que valent les parts. C’est la base que la succession valorise, avant decote.
        </p>

        {/* The distinction that decides whether anything can be bought with it */}
        <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-blue-800">dont immobilise dans les murs</span>
            <span className="text-xs font-mono tabular-nums text-blue-900">
              {formatEur(row.valeurBien)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-blue-800">dont disponible en caisse</span>
            <span
              className={`text-xs font-mono tabular-nums font-semibold ${
                row.tresorerie < 0 ? 'text-rose-700' : 'text-blue-900'
              }`}
            >
              {formatEur(row.tresorerie)}
            </span>
          </div>
          <p className="text-xs text-blue-700 pt-0.5">
            La situation nette n’est pas de l’argent disponible : l’essentiel est immobilise dans
            le bien. Pour acheter autre chose il faut vendre, ou reemprunter.
          </p>
        </div>
      </div>

      {pire && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-medium text-amber-900">
            Tresorerie negative sur {anneesADecouvert.length} annee
            {anneesADecouvert.length > 1 ? 's' : ''}, jusqu’a {formatEur(pire.tresorerie)} en annee{' '}
            {pire.year}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Une societe ne peut pas avoir une caisse negative : l’operation consomme plus qu’elle ne
            genere, et quelqu’un doit combler. La simulation laisse le solde passer sous zero sans
            enregistrer qui remet au pot — en pratique ce sont les associes, par un apport en compte
            courant, ou la banque par un decouvert. Reduisez la distribution de dividendes ou le
            remboursement de compte courant pour rester a flot.
          </p>
        </div>
      )}

      {/* Where this year's cash flow went */}
      {row.year > 0 && (
        <div className="border-t pt-3 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold text-gray-800">
              Ou est alle le cash-flow de la societe
            </h4>
            <span
              className={`font-mono tabular-nums text-sm font-bold ${
                row.cashFlowSociete < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatEur(row.cashFlowSociete)}
            </span>
          </div>

          {row.cashFlowSociete < 0 && sorties === 0 ? (
            <p className="text-xs text-gray-500">
              Negatif cette annee-la : rien n’en sort, la tresorerie diminue d’autant. Rappel :{' '}
              {formatEur(row.capital)} de ce montant part en remboursement de capital, qui est de
              l’epargne et non une perte.
            </p>
          ) : (
            <div className="space-y-2">
              <Destination
                label="Garde en tresorerie"
                montant={garde}
                total={totalDestinations}
                couleur="bg-blue-500"
                aide="Reste dans la societe et s'ajoute au solde de l'annee precedente."
              />
              <Destination
                label="Compte courant rembourse"
                montant={row.ccaRembourse}
                total={totalDestinations}
                couleur="bg-emerald-500"
                aide="Rendu aux associes sans aucune imposition : c'est le remboursement d'une dette, pas un revenu."
              />
              <Destination
                label="Dividende verse"
                montant={row.dividendeVerse}
                total={totalDestinations}
                couleur="bg-violet-500"
                aide="Sorti vers les associes apres impot. La societe s'appauvrit d'autant."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
