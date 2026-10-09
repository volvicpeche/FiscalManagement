import { useMemo, useState } from 'react';
import {
  FRAIS_NOTAIRE,
  TAUX_ENDETTEMENT_HCSF,
  capaciteEmprunt,
  comparerDurees,
  simulerCredit,
  type EntreeCredit,
  type TypeBien,
} from '@shared/outils/credit.js';
import { useOutilsStore } from '@/store/outilsStore';
import { Alertes, Bascule, Bloc, CarteResultat, ChampNombre, MiseEnPage, formatEur, formatPct, inputClass } from './ui';

const TYPES: { value: TypeBien; label: string }[] = [
  { value: 'ANCIEN', label: 'Ancien' },
  { value: 'NEUF', label: 'Neuf' },
];

type Onglet = 'mensualite' | 'capacite';

export function CreditPage() {
  const [onglet, setOnglet] = useState<Onglet>('mensualite');
  return (
    <MiseEnPage
      titre="Credit immobilier"
      intro="Mensualite, cout total et capacite d’emprunt, aux normes HCSF (35 % d’endettement assurance comprise, 25 ans au plus). Les taux proposes sont des exemples : saisissez ceux de votre banque."
      saisie={
        <>
          <Bascule
            value={onglet}
            onChange={setOnglet}
            options={[
              { value: 'mensualite', label: 'Ma mensualite' },
              { value: 'capacite', label: 'Combien emprunter ?' },
            ]}
          />
          {onglet === 'mensualite' ? <SaisieMensualite /> : <SaisieCapacite />}
        </>
      }
      resultats={onglet === 'mensualite' ? <ResultatsMensualite /> : <ResultatsCapacite />}
    />
  );
}

// ─── Mensualite ─────────────────────────────────────────────────────────────

function useEntreeCredit(): EntreeCredit {
  const c = useOutilsStore((s) => s.credit);
  return useMemo(
    () => ({
      prix: c.prix,
      typeBien: c.typeBien,
      tauxNotaire: c.tauxNotaire === null ? undefined : c.tauxNotaire / 100,
      travaux: c.travaux,
      fraisDossier: c.fraisDossier,
      apport: c.apport,
      taux: c.taux / 100,
      annees: c.annees,
      tauxAssurance: c.tauxAssurance / 100,
      revenus: c.revenus,
      chargesCredits: c.chargesCredits,
    }),
    [c],
  );
}

function SaisieMensualite() {
  const c = useOutilsStore((s) => s.credit);
  const maj = (p: Partial<typeof c>) => useOutilsStore.getState().maj('credit', p);
  const notaire = c.tauxNotaire ?? FRAIS_NOTAIRE[c.typeBien] * 100;

  return (
    <>
      <Bloc titre="Le projet">
        <ChampNombre label="Prix du bien" unite="€" step={5000} value={c.prix} onChange={(prix) => maj({ prix })} />
        <Bascule label="Type de bien" value={c.typeBien} options={TYPES} onChange={(typeBien) => maj({ typeBien, tauxNotaire: null })} />
        <ChampNombre
          label="Frais de notaire"
          unite="%"
          step={0.1}
          max={15}
          value={notaire}
          onChange={(tauxNotaire) => maj({ tauxNotaire })}
          aide={`${formatEur((c.prix * notaire) / 100)} — environ 7,5 % dans l’ancien, 2,5 % dans le neuf.`}
        />
        <ChampNombre label="Travaux" unite="€" step={1000} value={c.travaux} onChange={(travaux) => maj({ travaux })} />
        <ChampNombre
          label="Frais de dossier et de garantie"
          unite="€"
          step={100}
          value={c.fraisDossier}
          onChange={(fraisDossier) => maj({ fraisDossier })}
          aide="Caution (Credit Logement…) ou hypotheque : souvent 1 a 2 % du montant emprunte."
        />
      </Bloc>
      <Bloc titre="Le financement">
        <ChampNombre label="Apport" unite="€" step={1000} value={c.apport} onChange={(apport) => maj({ apport })} />
        <div className="grid grid-cols-2 gap-3">
          <ChampNombre label="Taux nominal" unite="%" step={0.05} max={20} value={c.taux} onChange={(taux) => maj({ taux })} />
          <ChampNombre label="Duree" unite="ans" min={1} max={35} value={c.annees} onChange={(annees) => maj({ annees: Math.round(annees) })} />
        </div>
        <ChampNombre
          label="Assurance emprunteur"
          unite="%"
          step={0.01}
          max={2}
          value={c.tauxAssurance}
          onChange={(tauxAssurance) => maj({ tauxAssurance })}
          aide="Taux annuel sur le capital emprunte : de 0,10 % a 0,50 % selon l’age."
        />
      </Bloc>
      <Bloc titre="Votre endettement (facultatif)">
        <div className="grid grid-cols-2 gap-3">
          <ChampNombre label="Revenus nets" unite="€/mois" step={100} value={c.revenus} onChange={(revenus) => maj({ revenus })} />
          <ChampNombre
            label="Credits en cours"
            unite="€/mois"
            step={50}
            value={c.chargesCredits}
            onChange={(chargesCredits) => maj({ chargesCredits })}
          />
        </div>
      </Bloc>
    </>
  );
}

function ResultatsMensualite() {
  const entree = useEntreeCredit();
  const durees = useOutilsStore((s) => s.credit.durees);
  const r = useMemo(() => simulerCredit(entree), [entree]);
  const comparatif = useMemo(
    () => comparerDurees(entree, durees.map((d) => ({ annees: d.annees, taux: d.taux / 100 }))),
    [entree, durees],
  );
  const majDuree = (i: number, taux: number) =>
    useOutilsStore.getState().maj('credit', { durees: durees.map((d, j) => (j === i ? { ...d, taux } : d)) });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <CarteResultat
          grand
          label="Mensualite, assurance comprise"
          valeur={formatEur(r.mensualiteTotale)}
          detail={`${formatEur(r.mensualiteHorsAssurance)} de credit + ${formatEur(r.assuranceMensuelle)} d’assurance, pendant ${entree.annees} ans`}
        />
        <CarteResultat
          label="Montant emprunte"
          valeur={formatEur(r.capital)}
          detail={`Projet de ${formatEur(r.coutProjet)} dont ${formatEur(r.fraisNotaire)} de frais de notaire`}
        />
        <CarteResultat
          label="Cout total du credit"
          valeur={formatEur(r.coutTotal)}
          detail={`${formatEur(r.coutInterets)} d’interets, ${formatEur(r.coutAssurance)} d’assurance, ${formatEur(r.coutTotal.minus(r.coutInterets).minus(r.coutAssurance))} de frais`}
        />
        {r.tauxEndettement && (
          <CarteResultat
            label="Taux d’endettement"
            valeur={formatPct(r.tauxEndettement, 1)}
            ton={r.tauxEndettement.gt(TAUX_ENDETTEMENT_HCSF) ? 'mauvais' : 'bon'}
            detail="Toutes mensualites de credit sur revenus nets. Plafond HCSF : 35 %."
          />
        )}
      </div>
      <Alertes messages={r.alertes} />

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-base font-semibold text-gray-900">Comparer les durees</h3>
        <p className="text-xs text-gray-500">
          Plus long, c’est une mensualite plus faible mais un credit plus cher. Ajustez le taux de chaque duree : les
          banques pretent moins cher sur 15 ans que sur 25.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-medium">Duree</th>
                <th className="py-2 pr-3 font-medium">Taux</th>
                <th className="py-2 pr-3 text-right font-medium">Mensualite</th>
                <th className="py-2 pr-3 text-right font-medium">Cout total</th>
                {r.tauxEndettement && <th className="py-2 text-right font-medium">Endettement</th>}
              </tr>
            </thead>
            <tbody>
              {comparatif.map((l, i) => (
                <tr key={l.annees} className={`border-b last:border-0 ${l.annees === entree.annees ? 'bg-indigo-50' : ''}`}>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.annees} ans</td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      aria-label={`Taux sur ${l.annees} ans`}
                      className={`${inputClass} w-20 py-1`}
                      value={durees[i].taux}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v) && v >= 0) majDuree(i, v);
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">{formatEur(l.mensualiteTotale)}</td>
                  <td className="py-2 pr-3 text-right font-mono whitespace-nowrap">{formatEur(l.coutTotal)}</td>
                  {r.tauxEndettement && (
                    <td
                      className={`py-2 text-right font-mono ${l.tauxEndettement?.gt(TAUX_ENDETTEMENT_HCSF) ? 'text-red-600' : ''}`}
                    >
                      {l.tauxEndettement ? formatPct(l.tauxEndettement, 1) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Capacite d'emprunt ─────────────────────────────────────────────────────

function SaisieCapacite() {
  const c = useOutilsStore((s) => s.capacite);
  const maj = (p: Partial<typeof c>) => useOutilsStore.getState().maj('capacite', p);
  return (
    <>
      <Bloc titre="Vos revenus">
        <ChampNombre
          label="Revenus nets du foyer"
          unite="€/mois"
          step={100}
          value={c.revenus}
          onChange={(revenus) => maj({ revenus })}
          aide="Avant impot a la source, primes et revenus locatifs (a 70 %) compris."
        />
        <ChampNombre
          label="Credits en cours"
          unite="€/mois"
          step={50}
          value={c.chargesCredits}
          onChange={(chargesCredits) => maj({ chargesCredits })}
        />
        <ChampNombre
          label="Taux d’endettement maximal"
          unite="%"
          max={50}
          value={c.tauxEndettementMax}
          onChange={(tauxEndettementMax) => maj({ tauxEndettementMax })}
          aide="35 % pour la norme HCSF ; une banque peut deroger pour les hauts revenus."
        />
      </Bloc>
      <Bloc titre="Le credit">
        <div className="grid grid-cols-2 gap-3">
          <ChampNombre label="Taux nominal" unite="%" step={0.05} max={20} value={c.taux} onChange={(taux) => maj({ taux })} />
          <ChampNombre label="Duree" unite="ans" min={1} max={35} value={c.annees} onChange={(annees) => maj({ annees: Math.round(annees) })} />
        </div>
        <ChampNombre
          label="Assurance emprunteur"
          unite="%"
          step={0.01}
          max={2}
          value={c.tauxAssurance}
          onChange={(tauxAssurance) => maj({ tauxAssurance })}
        />
      </Bloc>
      <Bloc titre="Le projet">
        <ChampNombre label="Apport" unite="€" step={1000} value={c.apport} onChange={(apport) => maj({ apport })} />
        <Bascule label="Type de bien" value={c.typeBien} options={TYPES} onChange={(typeBien) => maj({ typeBien })} />
        <ChampNombre label="Travaux prevus" unite="€" step={1000} value={c.travaux} onChange={(travaux) => maj({ travaux })} />
      </Bloc>
    </>
  );
}

function ResultatsCapacite() {
  const c = useOutilsStore((s) => s.capacite);
  const r = useMemo(
    () =>
      capaciteEmprunt({
        revenus: c.revenus,
        chargesCredits: c.chargesCredits,
        tauxEndettementMax: c.tauxEndettementMax / 100,
        taux: c.taux / 100,
        tauxAssurance: c.tauxAssurance / 100,
        annees: c.annees,
        apport: c.apport,
        typeBien: c.typeBien,
        travaux: c.travaux,
      }),
    [c],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <CarteResultat
          grand
          label="Prix de bien accessible"
          valeur={formatEur(r.prixMax)}
          detail={`Frais de notaire (${formatEur(r.fraisNotaire)}) et travaux deduits d’un budget de ${formatEur(r.budget)}`}
        />
        <CarteResultat
          label="Montant empruntable"
          valeur={formatEur(r.capitalMax)}
          detail={`Sur ${c.annees} ans, plus ${formatEur(c.apport)} d’apport`}
        />
        <CarteResultat
          label="Mensualite maximale"
          valeur={formatEur(r.mensualiteMax)}
          detail={`${c.tauxEndettementMax} % des revenus, credits en cours deduits, assurance comprise`}
        />
        <CarteResultat
          label="Reste a vivre"
          valeur={formatEur(r.resteAVivre)}
          detail="Ce qui reste chaque mois une fois tous les credits payes : les banques le regardent aussi."
        />
      </div>
      <Alertes messages={r.alertes} />
      <p className="text-xs text-gray-400">
        Estimation indicative : la banque etudie aussi la stabilite des revenus, l’epargne restante et le saut de
        charge. Les frais de dossier et de garantie ne sont pas comptes ici.
      </p>
    </>
  );
}
