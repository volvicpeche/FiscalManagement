import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CommuneGe, EtatCivilGe, PrevoyanceResult } from '@shared/frontalier.js';
import { Lien } from '@/lib/router';
import { usePrevoyanceSimulation } from '@/hooks/useFrontalier';
import { buildFrontalierRequest, useFrontalierStore } from '@/store/frontalierStore';
import {
  TAUX_COTISATIONS_ESTIME,
  buildPrevoyanceRequest,
  foyerSimple,
  usePrevoyanceStore,
  type ActiviteConjoint,
} from '@/store/prevoyanceStore';
import { LIBELLES_COMMUNES, Montant, Titre, formatChf, formatPct, inputClass, labelClass } from '@/features/frontalier/ui';

/** The one series of the curve: the app's indigo, checked against the white chart surface. */
const COULEUR_SERIE = '#4f46e5';

const carte = 'rounded-lg border bg-white p-4 space-y-4';

// ─── Saisie ──────────────────────────────────────────────────────────────────

function ReprendreTou() {
  const frontalier = useFrontalierStore();
  const { foyerTou, reprendreTou, oublierTou } = usePrevoyanceStore();
  // Its inputs start on an example: only a household actually computed there is worth taking over.
  const saisieTou = frontalier.result !== null;

  if (foyerTou) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 space-y-2">
        <p className="font-medium">Foyer repris du simulateur TOU</p>
        <p>
          Salaire brut {formatChf(foyerTou.contribuable.salaireBrut ?? 0)}, {foyerTou.etatCivil === 'MARIE' ? 'couple marie' : 'celibataire'}
          , avec toutes les deductions, biens en France et frais saisis la-bas. Seuls le 3a et le rachat ci-dessous changent.
        </p>
        <button type="button" onClick={oublierTou} className="text-indigo-700 underline hover:text-indigo-900">
          Revenir a la saisie simplifiee
        </button>
      </div>
    );
  }
  if (!saisieTou) {
    return (
      <p className="text-xs text-gray-500">
        Saisie simplifiee. Pour tenir compte de vos biens en France, frais et autres deductions, calculez d’abord votre TOU dans le{' '}
        <Lien vers="frontalier" className="text-indigo-700 underline">simulateur TOU</Lien> : votre foyer pourra etre repris ici.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
      <span>Votre foyer est saisi dans le simulateur TOU : le reprendre est plus precis.</span>
      <button
        type="button"
        onClick={() => reprendreTou(buildFrontalierRequest(frontalier))}
        className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
      >
        Reprendre mon foyer
      </button>
    </div>
  );
}

function SaisieFoyer() {
  const { saisie: s, majSaisie } = usePrevoyanceStore();
  const marie = s.etatCivil === 'MARIE';

  return (
    <>
      <div className={carte}>
        <Titre aide="Le taux depend de tout le foyer : le test des 90 % aussi.">Foyer</Titre>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Situation</label>
            <select className={inputClass} value={s.etatCivil} onChange={(e) => majSaisie({ etatCivil: e.target.value as EtatCivilGe })}>
              <option value="CELIBATAIRE">Celibataire</option>
              <option value="MARIE">Marie</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Enfants a charge</label>
            <input
              type="number"
              min={0}
              max={10}
              className={inputClass}
              value={s.enfants}
              onChange={(e) => majSaisie({ enfants: Math.min(10, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Commune de travail (Geneve)</label>
          <select className={inputClass} value={s.communeTravail} onChange={(e) => majSaisie({ communeTravail: e.target.value as CommuneGe })}>
            {Object.entries(LIBELLES_COMMUNES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {marie && (
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Activite du conjoint</label>
              <select
                className={inputClass}
                value={s.conjointActivite}
                onChange={(e) => majSaisie({ conjointActivite: e.target.value as ActiviteConjoint })}
              >
                <option value="AUCUNE">Sans activite</option>
                <option value="FRANCE">Salarie en France</option>
                <option value="SUISSE">Salarie en Suisse</option>
              </select>
            </div>
            {s.conjointActivite === 'SUISSE' && (
              <Montant label="Salaire brut du conjoint" value={s.conjointRevenuBrut} onChange={(v) => majSaisie({ conjointRevenuBrut: v })} />
            )}
            {s.conjointActivite === 'FRANCE' && (
              <div className="grid grid-cols-2 gap-3">
                <Montant label="Revenu brut" devise="EUR" value={s.conjointRevenuBrut} onChange={(v) => majSaisie({ conjointRevenuBrut: v })} />
                <Montant label="Net imposable" devise="EUR" value={s.conjointRevenuNetEur} onChange={(v) => majSaisie({ conjointRevenuNetEur: v })} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={carte}>
        <Titre aide="Les cases du certificat de salaire.">Salaire suisse</Titre>
        <Montant label="Salaire brut (case 8)" value={s.salaireBrut} onChange={(v) => majSaisie({ salaireBrut: v })} />
        <div>
          <Montant
            label="Cotisations AVS/AC/AANP (case 9)"
            value={s.cotisationsSociales}
            onChange={(v) => majSaisie({ cotisationsSociales: v })}
          />
          <button
            type="button"
            className="mt-1 text-xs text-indigo-700 hover:underline"
            onClick={() => majSaisie({ cotisationsSociales: ((parseFloat(s.salaireBrut) || 0) * TAUX_COTISATIONS_ESTIME).toFixed(2) })}
          >
            Estimer a {formatPct(TAUX_COTISATIONS_ESTIME)} du brut
          </button>
        </div>
        <Montant label="LPP ordinaire (case 10.1)" value={s.lppOrdinaire} onChange={(v) => majSaisie({ lppOrdinaire: v })} />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={s.affilieLpp} onChange={(e) => majSaisie({ affilieLpp: e.target.checked })} />
          Affilie a une caisse de pension (fixe le plafond 3a)
        </label>
        <Montant
          label="Primes d’assurance maladie"
          value={s.primesAssuranceMaladie}
          onChange={(v) => majSaisie({ primesAssuranceMaladie: v })}
          aide="Du foyer, sur l’annee."
        />
        <Montant
          label="Impot a la source retenu"
          value={s.impotSourceRetenu}
          onChange={(v) => majSaisie({ impotSourceRetenu: v })}
          aide="Facultatif : sans lui, le bareme sert de reference."
        />
      </div>
    </>
  );
}

function SaisieVersements() {
  const { versements: v, majVersements } = usePrevoyanceStore();
  return (
    <div className={carte}>
      <Titre aide="Les montants a tester, pour l’annee.">Versements</Titre>
      <Montant
        label="Versement 3e pilier (3a)"
        value={v.pilier3a}
        onChange={(x) => majVersements({ pilier3a: x })}
        aide="Plafond 2026 : 7 258 CHF avec caisse de pension, 20 % du revenu (max. 36 288) sans."
      />
      <Montant label="Rachat LPP" value={v.rachatLpp} onChange={(x) => majVersements({ rachatLpp: x })} />
      <div>
        <label className={labelClass}>
          Potentiel de rachat <span className="text-gray-400 font-normal">(CHF, facultatif)</span>
        </label>
        <input
          type="number"
          min={0}
          step={1000}
          className={inputClass}
          value={v.potentielRachat}
          placeholder="Sur le certificat de la caisse"
          onChange={(e) => majVersements({ potentielRachat: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">Au-dela, un rachat n’est pas deductible. La courbe va jusqu’a ce montant.</p>
      </div>
    </div>
  );
}

// ─── Resultat ────────────────────────────────────────────────────────────────

function Kpi({ label, valeur, detail }: { label: string; valeur: string; detail?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-gray-900">{valeur}</p>
      {detail && <p className="mt-0.5 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

function LigneComparaison({ label, tou, source }: { label: string; tou: string; source: string }) {
  const gain = parseFloat(source) - parseFloat(tou);
  return (
    <tr className="border-t">
      <td className="py-2 pr-3 text-gray-700">{label}</td>
      <td className="py-2 pr-3 text-right font-mono">{formatChf(tou)}</td>
      <td className="py-2 pr-3 text-right font-mono">{formatChf(source)}</td>
      <td className={`py-2 text-right font-medium ${gain > 0 ? 'text-green-700' : 'text-gray-700'}`}>
        {gain > 0 ? `TOU, −${formatChf(gain)}` : `Source, −${formatChf(-gain)}`}
      </td>
    </tr>
  );
}

function Courbe({ r }: { r: PrevoyanceResult }) {
  const donnees = r.courbe.map((p) => ({ rachat: parseFloat(p.rachat), economie: parseFloat(p.economie), taux: p.tauxMarginal }));
  const rachat = parseFloat(r.rachatDeductible);
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-lg font-semibold text-gray-900">Economie selon le montant du rachat</h3>
      <p className="mb-3 text-xs text-gray-500">
        Impot TOU economise par un rachat de chaque montant, le 3a deja verse. La pente baisse : chaque franc rachete fait
        descendre le taux, le suivant rapporte un peu moins.
      </p>
      <div className="h-64" role="img" aria-label="Courbe de l’economie d’impot selon le montant du rachat LPP">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={donnees} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="rachat"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={(x: number) => `${Math.round(x / 1000)}k`}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              stroke="#d1d5db"
            />
            <YAxis tickFormatter={(x: number) => formatChf(x)} tick={{ fontSize: 12, fill: '#6b7280' }} stroke="#d1d5db" width={84} />
            <Tooltip
              cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof donnees)[number];
                return (
                  <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                    <p className="font-medium text-gray-900">Rachat de {formatChf(p.rachat)}</p>
                    <p className="text-gray-700">Economie : {formatChf(p.economie)}</p>
                    {p.rachat > 0 && <p className="text-gray-500">Taux sur la derniere tranche : {formatPct(p.taux)}</p>}
                  </div>
                );
              }}
            />
            {rachat > 0 && (
              <ReferenceLine x={rachat} stroke="#6b7280" strokeDasharray="4 4" label={{ value: 'Votre rachat', position: 'insideTopRight', fontSize: 11, fill: '#374151' }} />
            )}
            <Area type="monotone" dataKey="economie" stroke={COULEUR_SERIE} strokeWidth={2} fill={COULEUR_SERIE} fillOpacity={0.12} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-gray-500">Voir les valeurs</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1 text-left font-medium">Rachat</th>
              <th className="py-1 text-right font-medium">Economie</th>
              <th className="py-1 text-right font-medium">Taux de la tranche</th>
            </tr>
          </thead>
          <tbody>
            {donnees.map((p) => (
              <tr key={p.rachat} className="border-t">
                <td className="py-1 font-mono">{formatChf(p.rachat)}</td>
                <td className="py-1 text-right font-mono">{formatChf(p.economie)}</td>
                <td className="py-1 text-right font-mono">{p.rachat > 0 ? formatPct(p.taux) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Resultats({ r }: { r: PrevoyanceResult }) {
  return (
    <div className="space-y-4">
      {!r.eligibleTou && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">TOU fermee : moins de 90 % des revenus du foyer sont imposables en Suisse.</p>
          <p className="mt-1">A l’impot a la source, ni le 3a ni le rachat ne reduisent l’impot. Les chiffres ci-dessous sont indicatifs.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="Economie du 3a"
          valeur={formatChf(r.economie3a)}
          detail={parseFloat(r.pilier3aDeductible) > 0 ? `${formatPct(r.taux3a)} des ${formatChf(r.pilier3aDeductible)} verses` : undefined}
        />
        <Kpi
          label="Economie du rachat LPP"
          valeur={formatChf(r.economieRachat)}
          detail={parseFloat(r.rachatDeductible) > 0 ? `${formatPct(r.tauxRachat)} des ${formatChf(r.rachatDeductible)} rachetes` : undefined}
        />
        <Kpi label="Economie totale" valeur={formatChf(r.economieTotale)} detail={`Impot ${r.annee}, par la TOU`} />
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold text-gray-900">TOU ou impot a la source ?</h3>
        <p className="text-xs text-gray-500">Les versements ne comptent qu’avec la TOU : l’impot a la source les ignore.</p>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="py-1 text-left font-medium" />
                <th className="py-1 pr-3 text-right font-medium">TOU</th>
                <th className="py-1 pr-3 text-right font-medium">A la source</th>
                <th className="py-1 text-right font-medium">Le moins cher</th>
              </tr>
            </thead>
            <tbody>
              <LigneComparaison label="Sans versement" tou={r.touSans} source={r.impotSource} />
              <LigneComparaison label="Avec 3a et rachat" tou={r.touAvecTout} source={r.impotSource} />
            </tbody>
          </table>
        </div>
      </div>

      <Courbe r={r} />

      <ul className="space-y-1.5 rounded-lg border bg-white p-4 text-sm text-gray-700">
        {r.avertissements.map((a) => (
          <li key={a} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            {a}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PrevoyancePage() {
  const { saisie, foyerTou, versements, result, setResult } = usePrevoyanceStore();
  const simulation = usePrevoyanceSimulation();
  const salaire = parseFloat(foyerTou?.contribuable.salaireBrut ?? saisie.salaireBrut) || 0;

  const calculer = () =>
    simulation.mutate(buildPrevoyanceRequest(foyerTou ?? foyerSimple(saisie), versements), { onSuccess: setResult });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">3e pilier et rachat LPP</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ce que rapportent un versement 3a et un rachat LPP a un frontalier de Geneve, et s’ils font basculer la TOU.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <ReprendreTou />
          {!foyerTou && <SaisieFoyer />}
          <SaisieVersements />
          <button
            type="button"
            onClick={calculer}
            disabled={salaire <= 0 || simulation.isPending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simulation.isPending ? 'Calcul…' : 'Calculer'}
          </button>
          {salaire <= 0 && <p className="text-xs text-gray-500">Saisissez au moins le salaire brut.</p>}
        </div>

        <div>
          {simulation.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{simulation.error.message}</div>
          )}
          {result ? (
            <Resultats r={result} />
          ) : (
            <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
              Le resultat s’affiche ici : economie du 3a, du rachat, et la courbe du rachat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
