export function StructureForm() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Comparaison de scenarios</h3>

      <div className="space-y-3">
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-900">Scenario A — Holding + SCI a l'IS</p>
          <p className="text-xs text-blue-700 mt-1">
            Holding detient 95% d'une SCI soumise a l'IS. Amortissement deductible, dividendes via regime mere-fille.
          </p>
        </div>

        <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
          <p className="text-sm font-medium text-amber-900">Scenario B — SCI a l'IR (transparence)</p>
          <p className="text-xs text-amber-700 mt-1">
            SCI soumise a l'IR en direct. Pas d'amortissement, imposition au bareme progressif + prelevements sociaux.
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Les deux scenarios partagent le meme bien, le meme pret et le meme profil fiscal.
      </p>
    </div>
  );
}
