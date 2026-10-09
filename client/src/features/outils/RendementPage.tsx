import { useMemo } from 'react';
import { rendementRapide } from '@shared/outils/rendement.js';
import { Lien } from '@/lib/router';
import { useOutilsStore } from '@/store/outilsStore';
import { Bascule, Bloc, CarteResultat, ChampNombre, MiseEnPage, formatEur, formatPct } from './ui';

export function RendementPage() {
  const r = useOutilsStore((s) => s.rendement);
  const maj = (p: Partial<typeof r>) => useOutilsStore.getState().maj('rendement', p);

  const res = useMemo(
    () =>
      rendementRapide({
        prix: r.prix,
        typeBien: r.typeBien,
        travaux: r.travaux,
        loyerMensuel: r.loyerMensuel,
        vacanceMois: r.vacanceMois,
        chargesAnnuelles: r.chargesAnnuelles,
        taxeFonciere: r.taxeFonciere,
        credit: r.avecCredit
          ? { apport: r.apport, taux: r.taux / 100, annees: r.annees, tauxAssurance: r.tauxAssurance / 100 }
          : undefined,
      }),
    [r],
  );
  const positif = res.cashFlowMensuel.gte(0);

  return (
    <MiseEnPage
      titre="Rendement locatif"
      intro="Un calcul rapide avant impot : ce que le bien rapporte, et ce qu’il reste chaque mois une fois le credit paye."
      saisie={
        <>
          <Bloc titre="Le bien">
            <ChampNombre label="Prix d’achat" unite="€" step={5000} value={r.prix} onChange={(prix) => maj({ prix })} />
            <Bascule
              label="Type de bien"
              value={r.typeBien}
              options={[
                { value: 'ANCIEN', label: 'Ancien' },
                { value: 'NEUF', label: 'Neuf' },
              ]}
              onChange={(typeBien) => maj({ typeBien })}
            />
            <ChampNombre label="Travaux" unite="€" step={1000} value={r.travaux} onChange={(travaux) => maj({ travaux })} />
          </Bloc>
          <Bloc titre="La location">
            <ChampNombre
              label="Loyer hors charges"
              unite="€/mois"
              step={10}
              value={r.loyerMensuel}
              onChange={(loyerMensuel) => maj({ loyerMensuel })}
            />
            <ChampNombre
              label="Vacance locative"
              unite="mois"
              step={0.5}
              max={12}
              value={r.vacanceMois}
              onChange={(vacanceMois) => maj({ vacanceMois })}
              aide="Mois sans locataire par an, en moyenne."
            />
            <ChampNombre
              label="Charges non recuperables"
              unite="€/an"
              step={100}
              value={r.chargesAnnuelles}
              onChange={(chargesAnnuelles) => maj({ chargesAnnuelles })}
              aide="Copropriete, assurance, gestion, entretien."
            />
            <ChampNombre label="Taxe fonciere" unite="€/an" step={100} value={r.taxeFonciere} onChange={(taxeFonciere) => maj({ taxeFonciere })} />
          </Bloc>
          <Bloc titre="Le financement">
            <Bascule
              value={r.avecCredit ? 'oui' : 'non'}
              options={[
                { value: 'oui', label: 'A credit' },
                { value: 'non', label: 'Comptant' },
              ]}
              onChange={(v) => maj({ avecCredit: v === 'oui' })}
            />
            {r.avecCredit && (
              <>
                <ChampNombre label="Apport" unite="€" step={1000} value={r.apport} onChange={(apport) => maj({ apport })} />
                <div className="grid grid-cols-2 gap-3">
                  <ChampNombre label="Taux" unite="%" step={0.05} max={20} value={r.taux} onChange={(taux) => maj({ taux })} />
                  <ChampNombre label="Duree" unite="ans" min={1} max={35} value={r.annees} onChange={(annees) => maj({ annees: Math.round(annees) })} />
                </div>
                <ChampNombre
                  label="Assurance emprunteur"
                  unite="%"
                  step={0.01}
                  max={2}
                  value={r.tauxAssurance}
                  onChange={(tauxAssurance) => maj({ tauxAssurance })}
                />
              </>
            )}
          </Bloc>
        </>
      }
      resultats={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <CarteResultat
              grand
              label="Cash-flow mensuel avant impot"
              valeur={`${positif ? '+' : ''}${formatEur(res.cashFlowMensuel)}`}
              ton={positif ? 'bon' : 'mauvais'}
              detail={
                r.avecCredit
                  ? `${formatEur(res.loyerNetMensuel)} de loyer net − ${formatEur(res.mensualiteCredit)} de credit (assurance comprise)`
                  : 'Achat comptant : le loyer net, sans credit a rembourser.'
              }
            />
            <CarteResultat
              label="Rendement brut"
              valeur={formatPct(res.brute)}
              detail="Loyer annuel sur le prix d’achat : le chiffre des annonces."
            />
            <CarteResultat
              label="Rendement net de charges"
              valeur={formatPct(res.nette)}
              detail={`Loyers encaisses moins charges et taxe fonciere, sur le cout total de ${formatEur(res.coutTotal)} (notaire et travaux compris).`}
            />
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            Ces chiffres sont <strong>avant impot</strong>. L’impot depend du montage : location nue ou meublee, en direct ou
            en SCI a l’IR ou a l’IS. Le simulateur{' '}
            <Lien vers="sci" className="font-medium underline">
              SCI / Holding
            </Lien>{' '}
            les compare sur 30 ans, fiscalite et transmission comprises.
          </div>
        </>
      }
    />
  );
}
