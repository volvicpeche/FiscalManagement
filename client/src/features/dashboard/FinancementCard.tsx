import { PROFILE_META, PROFILE_ORDER, formatEur } from '@/lib/profiles';
import type { ResultsProps } from './KpiCards';

/**
 * What the acquisition really needs, against what the associes declared.
 *
 * A gap is not a rounding detail: it is money the operation consumes that
 * nobody said they were bringing. The simulation charges the required amount
 * regardless — it has to come from somewhere — so an undeclared gap means the
 * apports need completing, not that the figures are wrong.
 */
export function FinancementCard({ results }: ResultsProps) {
  const available = PROFILE_ORDER.filter((p) => results[p]);
  const reference = results[available[0]];
  if (!reference) return null;

  const f = reference.summary.financement;
  const ecart = parseFloat(f.ecart);
  const manque = ecart > 0.5;
  const surplus = ecart < -0.5;

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-semibold text-gray-900">Financement de l’operation</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">
        Ce qu’il faut sortir de votre poche le jour de l’achat.
      </p>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">Cout d’acquisition</dt>
          <dd className="font-mono text-gray-800">{formatEur(f.coutAcquisition)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">− Emprunt bancaire</dt>
          <dd className="font-mono text-gray-800">−{formatEur(f.emprunt)}</dd>
        </div>
        <div className="flex justify-between pt-1.5 border-t">
          <dt className="font-medium text-gray-800">= Apport necessaire</dt>
          <dd className="font-mono font-bold text-gray-900">{formatEur(f.apportRequis)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">Apport declare (capital + comptes courants)</dt>
          <dd className="font-mono text-gray-800">{formatEur(f.apportDeclare)}</dd>
        </div>
      </dl>

      {manque && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-sm font-medium text-amber-900">
            {formatEur(ecart)} d’apport non declare
          </p>
          <p className="text-xs text-amber-800 mt-1">
            La simulation debite quand meme la somme complete : l’argent doit bien venir de quelque
            part. Completez les apports en capital ou en compte courant de vos associes pour que la
            repartition entre eux soit juste — notamment pour la succession, ou un compte courant se
            transmet a sa valeur nominale.
          </p>
        </div>
      )}

      {surplus && (
        <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-sm font-medium text-blue-900">
            {formatEur(Math.abs(ecart))} declares en trop
          </p>
          <p className="text-xs text-blue-800 mt-1">
            Les associes apportent plus que l’operation ne consomme. Ce surplus reste en tresorerie
            dans la societe.
          </p>
        </div>
      )}

      {!manque && !surplus && (
        <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Les apports declares couvrent exactement le besoin.
        </p>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Identique pour les trois montages : seuls les frais de constitution different, a la marge.
      </p>
    </div>
  );
}
