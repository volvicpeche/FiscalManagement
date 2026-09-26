import type { LieuActivite, PersonneFrontalier, RepasHorsDomicile } from '@shared/frontalier.js';
import { useFrontalierStore, type QuiPersonne } from '@/store/frontalierStore';
import { CODES_TARIF, Montant, SourceBadge, Titre, inputClass, labelClass } from './ui';

/**
 * One earner. The Swiss block follows the certificat de salaire box by box,
 * so a figure read from it can be checked against the paper at a glance.
 */
export function PersonneForm({ qui }: { qui: QuiPersonne }) {
  const store = useFrontalierStore();
  const p = store[qui];
  const src = (cle: keyof PersonneFrontalier) => store.sources[`${qui}.${cle}`];
  const maj = (patch: Partial<PersonneFrontalier>) => store.updatePersonne(qui, patch);
  const champ = (cle: keyof PersonneFrontalier, label: string, aide?: string) => (
    <Montant label={label} value={String(p[cle] ?? '0')} onChange={(v) => maj({ [cle]: v })} source={src(cle)} aide={aide} />
  );

  return (
    <div className="space-y-4">
      <Titre
        aide={
          qui === 'contribuable'
            ? 'Celui ou celle qui demande la TOU, impose a la source a Geneve.'
            : 'Son revenu entre dans le test des 90 % et dans le taux, ou qu’il soit gagne.'
        }
      >
        {qui === 'contribuable' ? 'Contribuable' : 'Conjoint'}
      </Titre>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Prenom</label>
          <input className={inputClass} value={p.prenom} onChange={(e) => maj({ prenom: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Activite</label>
          <select
            className={inputClass}
            value={p.activite}
            disabled={qui === 'contribuable'}
            onChange={(e) => maj({ activite: e.target.value as LieuActivite })}
          >
            <option value="SUISSE">En Suisse</option>
            <option value="FRANCE">En France</option>
            <option value="AUCUNE">Sans activite</option>
          </select>
        </div>
      </div>

      {p.activite === 'SUISSE' && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Certificat de salaire</p>
          <div className="grid grid-cols-2 gap-4">
            {champ('salaireBrut', 'Salaire brut (case 8)')}
            {champ('cotisationsSociales', 'AVS/AI/APG/AC/AANP (case 9)')}
            {champ('lppOrdinaire', 'LPP ordinaire (10.1)')}
            {champ('lppRachats', 'Rachats LPP (10.2)')}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={p.affilieLpp} onChange={(e) => maj({ affilieLpp: e.target.checked })} />
            Affilie(e) a une caisse de pension (plafond 3a de 7 258 CHF)
          </label>
          {champ('pilier3a', 'Versements 3e pilier A')}

          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Frais professionnels</p>
          <div className="grid grid-cols-2 gap-4">
            {champ('fraisDeplacement', 'Deplacements domicile-travail', 'Reels. ICC : 536 max ; IFD : 3 300 max.')}
            <div>
              <label className={labelClass}>Repas hors domicile</label>
              <select
                className={inputClass}
                value={p.repas}
                onChange={(e) => maj({ repas: e.target.value as RepasHorsDomicile })}
              >
                <option value="AUCUN">Non</option>
                <option value="CANTINE">Cantine / subventionne</option>
                <option value="COMPLET">Oui, a mes frais</option>
              </select>
            </div>
            {champ('autresFraisProfessionnels', 'Autres frais reels', 'Retenus s’ils depassent le forfait de 3 %.')}
            {champ('fraisFormation', 'Formation continue')}
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Impot a la source</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Bareme <SourceBadge fichier={src('codeTarifIS')} />
              </label>
              <select
                className={inputClass}
                value={p.codeTarifIS ?? ''}
                onChange={(e) => maj({ codeTarifIS: e.target.value || undefined })}
              >
                <option value="">Deduit du foyer</option>
                {CODES_TARIF.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {champ('impotSourceRetenu', 'Impot retenu sur l’annee', 'Attestation-quittance ou cumul des fiches de paie.')}
          </div>
        </>
      )}

      {p.activite === 'FRANCE' && (
        <div className="grid grid-cols-2 gap-4">
          <Montant
            label="Revenu brut"
            devise="EUR"
            value={p.revenuFranceBrutEur}
            onChange={(v) => maj({ revenuFranceBrutEur: v })}
            aide="Pour le test des 90 %."
          />
          <Montant
            label="Revenu net imposable"
            devise="EUR"
            value={p.revenuFranceNetEur}
            onChange={(v) => maj({ revenuFranceNetEur: v })}
            aide="Pour le taux."
          />
        </div>
      )}
    </div>
  );
}
