import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FrontalierResult } from '@shared/frontalier.js';
import { formatChf, formatPct } from './ui';

function Kpi({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: 'neutral' | 'cost' | 'good' }) {
  const toneClass = tone === 'cost' ? 'text-red-600' : tone === 'good' ? 'text-green-700' : 'text-gray-900';
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-mono font-semibold mt-1 ${toneClass}`}>{value}</p>
      {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
    </div>
  );
}

function Ligne({ label, valeur, fort, sous }: { label: string; valeur: string; fort?: boolean; sous?: boolean }) {
  return (
    <tr className={fort ? 'border-t font-semibold text-gray-900' : 'text-gray-700'}>
      <td className={`py-1.5 pr-4 ${sous ? 'pl-4 text-gray-500' : ''}`}>{label}</td>
      <td className="py-1.5 text-right font-mono whitespace-nowrap">{valeur}</td>
    </tr>
  );
}

export function FrontalierResultats({ result: r }: { result: FrontalierResult }) {
  const gain = parseFloat(r.gainTou);
  const isRetenu = parseFloat(r.totalIsRetenu);
  const reference = isRetenu > 0 ? 'retenu' : 'selon le bareme';
  const dateLimite = new Date(r.dateLimite).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border p-4 ${
          r.test90.eligible ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        <p className="font-medium">
          {r.test90.eligible ? 'Statut de quasi-resident : conditions remplies' : 'Statut de quasi-resident : seuil non atteint'}
        </p>
        <p className="text-sm mt-1">
          {formatPct(r.test90.ratio)} des revenus bruts mondiaux du foyer sont imposables en Suisse (
          {formatChf(r.test90.revenusSuisses)} sur {formatChf(r.test90.revenusMondiaux)}) — il en faut au moins 90 %.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Impot TOU (ICC + IFD)" value={formatChf(r.totalTou)} detail={`Annee ${r.annee}`} />
        <Kpi label="Impot a la source retenu" value={isRetenu > 0 ? formatChf(r.totalIsRetenu) : '—'} />
        <Kpi label="Impot a la source selon bareme" value={formatChf(r.totalIsTheorique)} />
        <Kpi
          label={gain >= 0 ? 'Economie avec la TOU' : 'Surcout de la TOU'}
          value={formatChf(Math.abs(gain))}
          detail={`par rapport a l’impot ${reference}`}
          tone={gain >= 0 ? 'good' : 'cost'}
        />
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className={`text-sm font-medium ${gain >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {gain >= 0
            ? `La TOU serait plus favorable de ${formatChf(gain)}. Demande a deposer avant le ${dateLimite}.`
            : `L’impot a la source reste plus favorable de ${formatChf(-gain)} : une demande de TOU augmenterait l’impot.`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-lg font-semibold text-gray-900">Detail de la TOU</h3>
          <p className="text-xs text-gray-500 mb-3">
            Le taux est fixe sur le revenu mondial ({formatChf(r.icc.revenuDeterminantTaux)} a l’ICC), puis applique au
            seul revenu imposable en Suisse.
          </p>
          <table className="w-full text-sm">
            <tbody>
              <Ligne label="Revenu imposable ICC" valeur={formatChf(r.icc.revenuImposable)} />
              <Ligne label="Impot cantonal de base" valeur={formatChf(r.icc.impotBase, 2)} sous />
              <Ligne label="Centimes cantonaux (48,5 %)" valeur={formatChf(r.icc.centimesCantonaux, 2)} sous />
              <Ligne label="Reduction LDIRPP (12 %)" valeur={`− ${formatChf(r.icc.reductionLdirpp, 2)}`} sous />
              <Ligne
                label={`Impot communal (${formatPct(r.icc.centimesCommunaux, 2)})`}
                valeur={formatChf(r.icc.impotCommunal, 2)}
                sous
              />
              <Ligne label="ICC" valeur={formatChf(r.icc.total, 2)} fort />
              <Ligne label="Revenu imposable IFD" valeur={formatChf(r.ifd.revenuImposable)} />
              <Ligne label="IFD" valeur={formatChf(r.ifd.total, 2)} fort />
              <Ligne label="Total TOU" valeur={formatChf(r.totalTou, 2)} fort />
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-lg font-semibold text-gray-900">Impot a la source</h3>
          <p className="text-xs text-gray-500 mb-3">
            Bareme AFC 2026 applique au salaire mensuel moyen, compare a l’impot effectivement retenu.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 font-medium">Personne</th>
                <th className="py-1 font-medium">Bareme</th>
                <th className="py-1 text-right font-medium">Selon bareme</th>
                <th className="py-1 text-right font-medium">Retenu</th>
              </tr>
            </thead>
            <tbody>
              {r.impotSource.map((p, i) => (
                <tr key={i} className="border-t text-gray-700">
                  <td className="py-1.5">{p.prenom || (i === 0 ? 'Contribuable' : 'Conjoint')}</td>
                  <td className="py-1.5">
                    {p.codeTarif} <span className="text-gray-400">({formatPct(p.tauxBareme, 2)})</span>
                  </td>
                  <td className="py-1.5 text-right font-mono">{formatChf(p.impotTheorique)}</td>
                  <td className="py-1.5 text-right font-mono">
                    {parseFloat(p.impotRetenu) > 0 ? formatChf(p.impotRetenu) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-lg font-semibold text-gray-900">Deductions retenues</h3>
          <p className="text-xs text-gray-500 mb-3">Apres plafonds, separement pour l’ICC et l’IFD.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 font-medium">Deduction</th>
                <th className="py-1 text-right font-medium">ICC</th>
                <th className="py-1 text-right font-medium">IFD</th>
              </tr>
            </thead>
            <tbody>
              {r.deductions.map((dd) => (
                <tr key={dd.code} className="border-t text-gray-700">
                  <td className="py-1.5 pr-2">{dd.libelle}</td>
                  <td className="py-1.5 text-right font-mono">{formatChf(dd.icc)}</td>
                  <td className="py-1.5 text-right font-mono">{formatChf(dd.ifd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-lg font-semibold text-gray-900">Ce que rapporte chaque deduction</h3>
          <p className="text-xs text-gray-500 mb-3">Impot TOU economise si l’on retire cette deduction seule.</p>
          {r.impacts.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune deduction n’abaisse l’impot.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, r.impacts.length * 34)}>
              <BarChart data={r.impacts.map((i) => ({ nom: i.libelle, economie: parseFloat(i.economie) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => formatChf(v)} />
                <YAxis type="category" dataKey="nom" width={170} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatChf(Number(v))} />
                <Bar dataKey="economie" name="Economie" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {r.avertissements.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">A savoir</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900 list-disc pl-5">
            {r.avertissements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Simulation indicative sur les baremes officiels 2026 (RCEPF, AFC, tar26GE). Elle ne remplace pas la taxation de
        l’AFC-GE ; plusieurs regles d’application restent a confirmer, notamment l’imposition communale d’un
        non-resident et la prise en compte des biens a l’etranger.
      </p>
    </div>
  );
}
