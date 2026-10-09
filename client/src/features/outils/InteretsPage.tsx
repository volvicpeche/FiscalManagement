import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { projeterEpargne } from '@shared/outils/interetsComposes.js';
import { useOutilsStore } from '@/store/outilsStore';
import { Bascule, Bloc, CarteResultat, ChampNombre, MiseEnPage, formatEur } from './ui';

// Validated pair (dataviz validator, light surface): blue = paid in, orange = earned.
const COULEUR_VERSE = '#2a78d6';
const COULEUR_INTERETS = '#eb6834';

const compact = (v: number) =>
  new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v) + ' €';

export function InteretsPage() {
  const e = useOutilsStore((s) => s.epargne);
  const maj = (p: Partial<typeof e>) => useOutilsStore.getState().maj('epargne', p);

  const r = useMemo(
    () =>
      projeterEpargne({
        capitalInitial: e.capitalInitial,
        versementMensuel: e.versementMensuel,
        tauxAnnuel: e.tauxAnnuel / 100,
        annees: e.annees,
        capitalisation: e.capitalisation,
        inflation: e.inflation / 100,
      }),
    [e],
  );
  const donnees = useMemo(
    () => r.lignes.map((l) => ({ annee: l.annee, Verse: l.verse.toNumber(), Interets: l.interets.toNumber() })),
    [r],
  );
  const partInterets = r.capitalFinal.gt(0) ? r.interets.div(r.capitalFinal).mul(100).toFixed(0) : '0';

  return (
    <MiseEnPage
      titre="Interets composes"
      intro="Ce que devient un capital place, avec ou sans versements reguliers : les interets produisent a leur tour des interets."
      saisie={
        <>
          <Bloc titre="L’epargne">
            <ChampNombre
              label="Capital de depart"
              unite="€"
              step={1000}
              value={e.capitalInitial}
              onChange={(capitalInitial) => maj({ capitalInitial })}
            />
            <ChampNombre
              label="Versement mensuel"
              unite="€/mois"
              step={50}
              value={e.versementMensuel}
              onChange={(versementMensuel) => maj({ versementMensuel })}
              aide="Verse en fin de mois."
            />
          </Bloc>
          <Bloc titre="Le placement">
            <div className="grid grid-cols-2 gap-3">
              <ChampNombre label="Rendement annuel" unite="%" step={0.25} max={30} value={e.tauxAnnuel} onChange={(tauxAnnuel) => maj({ tauxAnnuel })} />
              <ChampNombre label="Duree" unite="ans" min={1} max={60} value={e.annees} onChange={(annees) => maj({ annees: Math.round(annees) })} />
            </div>
            <Bascule
              label="Capitalisation"
              value={e.capitalisation}
              options={[
                { value: 'MENSUELLE', label: 'Mensuelle' },
                { value: 'ANNUELLE', label: 'Annuelle' },
              ]}
              onChange={(capitalisation) => maj({ capitalisation })}
            />
            <ChampNombre
              label="Inflation"
              unite="%"
              step={0.25}
              max={20}
              value={e.inflation}
              onChange={(inflation) => maj({ inflation })}
              aide="Pour exprimer le resultat en euros d’aujourd’hui. 0 pour l’ignorer."
            />
          </Bloc>
          <p className="text-xs text-gray-400">Avant impot et frais. Le rendement d’un placement n’est jamais garanti.</p>
        </>
      }
      resultats={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <CarteResultat
              grand
              label={`Capital au bout de ${e.annees} ans`}
              valeur={formatEur(r.capitalFinal)}
              detail={
                e.inflation > 0
                  ? `Soit ${formatEur(r.capitalFinalReel)} en euros d’aujourd’hui, avec ${e.inflation} % d’inflation par an.`
                  : undefined
              }
            />
            <CarteResultat label="Total verse" valeur={formatEur(r.totalVerse)} detail="Capital de depart et versements." />
            <CarteResultat
              label="Interets gagnes"
              valeur={formatEur(r.interets)}
              ton="bon"
              detail={`${partInterets} % du capital final${
                r.anneesDoublement ? ` · une somme double en ${r.anneesDoublement.toFixed(1).replace('.', ',')} ans a ce taux` : ''
              }`}
            />
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h3 className="text-base font-semibold text-gray-900">Evolution du capital</h3>
            <p className="text-xs text-gray-500">Ce que vous avez verse, et ce que les interets y ont ajoute, annee par annee.</p>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={donnees} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="annee" tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tickFormatter={compact} width={64} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    formatter={(v, nom) => [formatEur(Number(v)), nom === 'Verse' ? 'Verse' : 'Interets']}
                    labelFormatter={(a) => `Annee ${a}`}
                  />
                  <Legend formatter={(v) => (v === 'Verse' ? 'Verse' : 'Interets cumules')} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Verse" stackId="1" stroke={COULEUR_VERSE} strokeWidth={2} fill={COULEUR_VERSE} fillOpacity={0.25} />
                  <Area
                    type="monotone"
                    dataKey="Interets"
                    stackId="1"
                    stroke={COULEUR_INTERETS}
                    strokeWidth={2}
                    fill={COULEUR_INTERETS}
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <details className="rounded-lg border bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Tableau annee par annee</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="py-2 pr-3 font-medium">Annee</th>
                    <th className="py-2 pr-3 text-right font-medium">Verse</th>
                    <th className="py-2 pr-3 text-right font-medium">Interets</th>
                    <th className="py-2 pr-3 text-right font-medium">Capital</th>
                    {e.inflation > 0 && <th className="py-2 text-right font-medium">En euros d’aujourd’hui</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.lignes.map((l) => (
                    <tr key={l.annee} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">{l.annee}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{formatEur(l.verse)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{formatEur(l.interets)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{formatEur(l.capital)}</td>
                      {e.inflation > 0 && <td className="py-1.5 text-right font-mono">{formatEur(l.capitalReel)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      }
    />
  );
}
