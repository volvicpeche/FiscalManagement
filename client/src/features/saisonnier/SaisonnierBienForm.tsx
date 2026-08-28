import { useState } from 'react';
import type { ListingExtraction } from '@shared/listing.js';
import { useSaisonnierStore } from '@/store/saisonnierStore';
import { useAnalyzeListing } from '@/hooks/useAnalyzeListing';
import { formatEur } from '@/lib/profiles';

function toDecimalStr(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const ATOUT_LABELS: Record<Exclude<keyof ListingExtraction['atouts'], 'autres'>, string> = {
  piscine: 'Piscine',
  vue: 'Vue',
  spa: 'Spa / jacuzzi',
  terrainPetanque: 'Terrain de petanque',
  climatisation: 'Climatisation',
  parking: 'Parking',
};

/** Portals that answer 403 to any server-side request, whatever the headers. */
const PORTAILS_BLOQUANTS = ['seloger', 'leboncoin', 'pap.fr', 'logic-immo', 'bellesdemeures'];

function isPortailBloquant(url: string): boolean {
  return PORTAILS_BLOQUANTS.some((p) => url.toLowerCase().includes(p));
}

function ListingUrlAnalyzer() {
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [showTexte, setShowTexte] = useState(false);
  const [extraction, setExtraction] = useState<ListingExtraction | null>(null);
  const { updateAsset, updateSaison } = useSaisonnierStore();
  const analyze = useAnalyzeListing();

  const apply = (data: ListingExtraction) => {
    setExtraction(data);
    if (data.label) updateAsset({ label: data.label });
    if (data.prixVente != null) updateAsset({ purchasePrice: data.prixVente.toFixed(2) });
  };

  const handleAnalyze = () => {
    if (!url.trim()) return;
    // These portals cannot be fetched at all — open the paste box straight away
    // rather than spending a round-trip to be told so.
    if (isPortailBloquant(url)) setShowTexte(true);
    analyze.mutate({ url: url.trim() }, { onSuccess: apply });
  };

  const handleAnalyzeTexte = () => {
    if (!texte.trim()) return;
    analyze.mutate({ text: texte.trim() }, { onSuccess: apply });
  };

  const applyEstimate = () => {
    if (!extraction) return;
    const { hauteSaison, moyenneSaison, basseSaison } = extraction.estimationSaisonniere;
    updateSaison('hauteSaison', { tauxOccupation: hauteSaison.tauxOccupation, caPeriode: hauteSaison.caPeriode.toFixed(2) });
    updateSaison('moyenneSaison', { tauxOccupation: moyenneSaison.tauxOccupation, caPeriode: moyenneSaison.caPeriode.toFixed(2) });
    updateSaison('basseSaison', { tauxOccupation: basseSaison.tauxOccupation, caPeriode: basseSaison.caPeriode.toFixed(2) });
  };

  const activeAtouts = extraction
    ? (Object.keys(ATOUT_LABELS) as (keyof typeof ATOUT_LABELS)[]).filter((k) => extraction.atouts[k])
    : [];

  return (
    <div className="space-y-2">
      <label className={labelClass}>URL de l’annonce</label>
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://www.seloger.com/..."
          className={inputClass}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyze.isPending || !url.trim()}
          className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyze.isPending ? 'Analyse...' : 'Analyser'}
        </button>
      </div>

      {analyze.error && (
        <p className="text-xs text-red-600">{analyze.error.message}</p>
      )}

      {!showTexte && (
        <button
          type="button"
          onClick={() => setShowTexte(true)}
          className="text-xs text-orange-700 hover:text-orange-900 underline underline-offset-2"
        >
          Le portail bloque la lecture ? Coller le texte de l’annonce
        </button>
      )}

      {showTexte && (
        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <label className="block text-sm font-medium text-gray-700">
            Coller le texte de l’annonce
          </label>
          <p className="text-xs text-gray-500">
            SeLoger, LeBonCoin et PAP refusent toute lecture automatique : leurs pages ne sont
            lisibles que depuis votre navigateur. Selectionnez la description de l’annonce,
            copiez-la, et collez-la ici.
          </p>
          <textarea
            rows={6}
            className={`${inputClass} font-normal`}
            placeholder="Mas provencal de 220 m2, 6 chambres, piscine chauffee, vue sur les Alpilles..."
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {texte.trim().length} caracteres
              {texte.trim().length > 0 && texte.trim().length < 200 && ' — minimum 200'}
            </span>
            <button
              type="button"
              onClick={handleAnalyzeTexte}
              disabled={analyze.isPending || texte.trim().length < 200}
              className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyze.isPending ? 'Analyse...' : 'Analyser le texte'}
            </button>
          </div>
        </div>
      )}

      {extraction && (
        <div className="rounded-md border border-orange-200 bg-orange-50/60 p-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700">
            {extraction.ville && <span>Localite : <strong>{extraction.ville}</strong></span>}
            {extraction.surfaceM2 != null && <span>Surface : <strong>{extraction.surfaceM2} m²</strong></span>}
            {extraction.nbPieces != null && <span>Pieces : <strong>{extraction.nbPieces}</strong></span>}
            {extraction.nbChambres != null && <span>Chambres : <strong>{extraction.nbChambres}</strong></span>}
            {extraction.capaciteCouchage != null && (
              <span>Couchages : <strong>{extraction.capaciteCouchage}</strong></span>
            )}
          </div>

          {activeAtouts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeAtouts.map((k) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs">
                  {ATOUT_LABELS[k]}
                </span>
              ))}
              {extraction.atouts.autres.map((a) => (
                <span key={a} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                  {a}
                </span>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-orange-200">
            <p className="text-xs font-medium text-orange-900 mb-1">
              Estimation IA du potentiel saisonnier (a verifier) :
            </p>
            <p className="text-xs text-gray-600 grid grid-cols-3 gap-1">
              <span>Haute : {formatEur(extraction.estimationSaisonniere.hauteSaison.caPeriode)}</span>
              <span>Moyenne : {formatEur(extraction.estimationSaisonniere.moyenneSaison.caPeriode)}</span>
              <span>Basse : {formatEur(extraction.estimationSaisonniere.basseSaison.caPeriode)}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1 italic">{extraction.estimationSaisonniere.rationale}</p>
            <button
              type="button"
              onClick={applyEstimate}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-orange-800 bg-white border border-orange-300 rounded-md hover:bg-orange-100 transition-colors"
            >
              Appliquer cette estimation aux saisons
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SaisonnierBienForm() {
  const { asset, updateAsset, updateLoan } = useSaisonnierStore();
  const loan = asset.loan;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Le bien</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Collez l’URL d’une annonce pour pre-remplir ces champs, ou renseignez-les a la main.
        </p>
      </div>

      <ListingUrlAnalyzer />

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelClass}>Designation</label>
          <input
            type="text"
            className={inputClass}
            value={asset.label}
            onChange={(e) => updateAsset({ label: e.target.value })}
          />
        </div>

        <div>
          <label className={labelClass}>Prix d'achat (EUR)</label>
          <input
            type="number"
            step={1000}
            className={inputClass}
            value={parseFloat(asset.purchasePrice)}
            onChange={(e) => updateAsset({ purchasePrice: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Frais de notaire (EUR)</label>
          <input
            type="number"
            step={500}
            className={inputClass}
            value={parseFloat(asset.notaryFees)}
            onChange={(e) => updateAsset({ notaryFees: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Travaux de renovation (EUR)</label>
          <input
            type="number"
            step={1000}
            className={inputClass}
            value={parseFloat(asset.renovationCosts)}
            onChange={(e) => updateAsset({ renovationCosts: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Charges de copropriete (EUR/an)</label>
          <input
            type="number"
            step={100}
            className={inputClass}
            value={parseFloat(asset.chargesYearly)}
            onChange={(e) => updateAsset({ chargesYearly: toDecimalStr(e.target.value) })}
          />
        </div>

        <div>
          <label className={labelClass}>Taxe fonciere (EUR/an)</label>
          <input
            type="number"
            step={100}
            className={inputClass}
            value={parseFloat(asset.propertyTax)}
            onChange={(e) => updateAsset({ propertyTax: toDecimalStr(e.target.value) })}
          />
        </div>
      </div>

      {loan && (
        <div className="pt-3 border-t border-gray-200 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Financement</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Montant emprunte (EUR)</label>
              <input
                type="number"
                step={5000}
                className={inputClass}
                value={parseFloat(loan.principal)}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num)) updateLoan({ principal: num.toFixed(2) });
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Taux nominal (%)</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={15}
                className={inputClass}
                value={((loan.interestRate ?? 0) * 100).toFixed(2)}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value);
                  if (!isNaN(pct)) updateLoan({ interestRate: pct / 100 });
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Duree (annees)</label>
              <input
                type="number"
                step={1}
                min={1}
                max={30}
                className={inputClass}
                value={Math.round((loan.durationMonths ?? 240) / 12)}
                onChange={(e) => {
                  const years = parseInt(e.target.value);
                  if (!isNaN(years)) updateLoan({ durationMonths: years * 12 });
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Type de pret</label>
              <select
                className={inputClass}
                value={loan.type}
                onChange={(e) => updateLoan({ type: e.target.value as 'AMORTISSABLE' | 'INFINE' })}
              >
                <option value="AMORTISSABLE">Amortissable</option>
                <option value="INFINE">In fine</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
