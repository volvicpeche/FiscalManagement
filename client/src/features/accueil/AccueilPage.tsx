import { Lien } from '@/lib/router';
import { OUTILS, SIMULATEURS, type EntreeNav } from '@/lib/navigation';
import { useSession } from '@/features/auth';

function Carte({ e, verrou }: { e: EntreeNav; verrou?: boolean }) {
  return (
    <Lien
      vers={e.route}
      className="group block rounded-lg border bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
    >
      <p className="font-medium text-gray-900 group-hover:text-indigo-700">
        {e.titre}
        {verrou && (
          <span aria-label="compte requis" className="ml-1.5 text-xs">
            🔒
          </span>
        )}
      </p>
      <p className="mt-1 text-sm text-gray-500">{e.resume}</p>
    </Lien>
  );
}

/**
 * Landing page. The quick tools open for anyone; the advanced simulators are
 * shown as what an account unlocks.
 */
export function AccueilPage() {
  const { user, chargement } = useSession();
  const visiteur = !user && !chargement;

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-4">
      <section>
        <h2 className="text-3xl font-bold text-gray-900">Simulez avant de signer</h2>
        <p className="mt-2 max-w-2xl text-gray-600">
          Credit, rendement, epargne : des calculs rapides, sans compte. Et pour aller plus loin, des simulateurs complets
          qui comparent les montages et leur fiscalite sur 30 ans.
        </p>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">Outils rapides — gratuits, sans compte</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {OUTILS.map((e) => (
            <Carte key={e.route} e={e} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Simulateurs avances{visiteur ? ' — avec un compte gratuit' : ''}
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {SIMULATEURS.map((e) => (
            <Carte key={e.route} e={e} verrou={visiteur} />
          ))}
        </div>
        {visiteur && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Lien
              vers="inscription"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Creer un compte gratuit
            </Lien>
            <span className="text-sm text-gray-500">
              Vos scenarios sont enregistres et vous les retrouvez sur tous vos appareils.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
