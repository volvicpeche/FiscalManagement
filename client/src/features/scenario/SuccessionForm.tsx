import { useScenarioStore } from '@/store/scenarioStore';
import { RELATION_LABELS } from '@/lib/profiles';

export function SuccessionForm() {
  const { params, updateParams, associes } = useScenarioStore();

  const defunt = associes.find((a) => a.relation === 'SELF');
  const heritiers = associes.filter((a) => a.relation !== 'SELF' && a !== defunt);

  const objectif = params.objectif ?? 'TRANSMISSION';
  const transmission = objectif === 'TRANSMISSION';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Objectif de l’operation</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Ce que vous comptez faire du bien decide de ce qui est calcule au terme.
        </p>
      </div>

      <div className="space-y-2">
        {([
          {
            valeur: 'TRANSMISSION' as const,
            titre: 'Transmission',
            texte: 'Vous gardez les parts et les transmettez. Les droits de succession et le cout de revente sont estimes.',
          },
          {
            valeur: 'RENDEMENT' as const,
            titre: 'Rendement pur',
            texte: 'Seul compte ce que l’operation rapporte pendant qu’elle tourne. Ni succession, ni revente, ni plus-value.',
          },
        ]).map((o) => (
          <label
            key={o.valeur}
            className={`flex gap-2.5 items-start rounded-md border p-3 cursor-pointer transition-colors ${
              objectif === o.valeur
                ? 'bg-blue-50 border-blue-300'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="objectif"
              className="mt-0.5 accent-blue-600"
              checked={objectif === o.valeur}
              onChange={() => updateParams({ objectif: o.valeur })}
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">{o.titre}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{o.texte}</span>
            </span>
          </label>
        ))}
      </div>

      {!transmission && (
        <p className="text-xs text-gray-500 border-t pt-3">
          Les reglages de transmission ci-dessous ne s’appliquent pas a un objectif de rendement
          pur. Le remboursement du compte courant, lui, reste actif.
        </p>
      )}

      {transmission && !defunt && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Aucun associe n’a le lien « Moi-meme » : la succession ne peut pas etre estimee.
        </p>
      )}

      {transmission && defunt && (
        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 space-y-1">
          <p>
            <span className="font-medium text-gray-800">{defunt.nom}</span> transmet{' '}
            {(defunt.partsPercent * 100).toFixed(0)} % des parts
            {parseFloat(defunt.apportCompteCourant) > 0 && ' et son compte courant'}.
          </p>
          <p className="text-gray-500">
            Heritiers :{' '}
            {heritiers.length > 0
              ? heritiers.map((h) => `${h.nom} (${RELATION_LABELS[h.relation]})`).join(', ')
              : 'les enfants declares dans le profil fiscal'}
          </p>
        </div>
      )}

      {transmission && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Decote d’illiquidite : {Math.round((params.illiquidityDiscount ?? 0) * 100)} %
        </label>
        <input
          type="range"
          min={0}
          max={30}
          step={5}
          className="w-full accent-blue-600"
          value={Math.round((params.illiquidityDiscount ?? 0) * 100)}
          onChange={(e) => updateParams({ illiquidityDiscount: parseInt(e.target.value) / 100 })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Des parts de SCI ne se vendent pas librement : leur valeur retenue est minoree.
        </p>
      </div>
      )}

      {transmission && (
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-blue-600"
          checked={params.demembrement ?? false}
          onChange={(e) => updateParams({ demembrement: e.target.checked })}
        />
        <span className="text-sm text-gray-700">
          Donation en nue-propriete
          <span className="block text-xs text-gray-400">
            Seule la nue-propriete sort du patrimoine (bareme Art. 669 CGI selon l’age).
          </span>
        </span>
      </label>
      )}

      <div className="pt-2 border-t">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Remboursement du compte courant :{' '}
          {Math.round((params.ccaRepaymentRate ?? 0) * 100)} % du cash disponible
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          className="w-full accent-blue-600"
          value={Math.round((params.ccaRepaymentRate ?? 0) * 100)}
          onChange={(e) => updateParams({ ccaRepaymentRate: parseInt(e.target.value) / 100 })}
        />
        <p className="text-xs text-gray-400 mt-1">
          Recuperer son compte courant sort du cash de la societe sans aucune imposition.
        </p>
      </div>
    </div>
  );
}
