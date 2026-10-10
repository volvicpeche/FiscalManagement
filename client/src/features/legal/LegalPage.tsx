import type { ReactNode } from 'react';
import { Lien } from '@/lib/router';

/**
 * Legal notice and privacy policy. The publisher is a private individual
 * acting non-professionally, who may stay anonymous (LCEN art. 6, III, 2°)
 * as long as the host knows who they are. Contact goes through GitHub.
 *
 * Every statement below must stay true of the code: update this page when
 * what is collected, where it goes or how long it stays changes.
 */

export const GITHUB_PROFIL = 'https://github.com/volvicpeche';
export const GITHUB_DEPOT = 'https://github.com/volvicpeche/FiscalManagement';

// Region of the Supabase project (Project Settings → General): change it here if the project moves.
const REGION_SUPABASE = 'Union europeenne (Francfort, AWS eu-central-1)';

const MISE_A_JOUR = 'octobre 2026';

function Page({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 sm:p-10">
      <h2 className="text-2xl font-bold text-gray-900">{titre}</h2>
      <p className="mt-1 text-xs text-gray-400">Mise a jour : {MISE_A_JOUR}</p>
      <div className="mt-6 space-y-8">{children}</div>
    </article>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-gray-900">{titre}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline hover:text-indigo-900">
      {children}
    </a>
  );
}

export function MentionsLegalesPage() {
  return (
    <Page titre="Mentions legales">
      <Section titre="Editeur">
        <p>
          Ce site est edite a titre non professionnel par un particulier. Conformement a l’article 6, III, 2° de la loi
          n° 2004-575 du 21 juin 2004 pour la confiance dans l’economie numerique, l’editeur a choisi de ne pas rendre
          publique son identite ; ses coordonnees ont ete communiquees a l’hebergeur.
        </p>
        <p>
          Contact : via GitHub, <A href={GITHUB_PROFIL}>github.com/volvicpeche</A>. Le code source du site est public :{' '}
          <A href={GITHUB_DEPOT}>github.com/volvicpeche/FiscalManagement</A>.
        </p>
      </Section>

      <Section titre="Propriete intellectuelle">
        <p>
          Le code source est publie sous licence{' '}
          <A href="https://polyformproject.org/licenses/noncommercial/1.0.0">PolyForm Noncommercial 1.0.0</A> : il peut
          etre lu, utilise, modifie et partage a des fins non commerciales. Toute exploitation commerciale, notamment
          sous forme de produit ou de service payant, est interdite sans accord ecrit de l’editeur.
        </p>
      </Section>

      <Section titre="Hebergement">
        <p>
          <strong>Site et serveur</strong> : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France — ovhcloud.com.
        </p>
        <p>
          <strong>Comptes et base de donnees</strong> : Supabase Inc. — supabase.com. Donnees hebergees en{' '}
          {REGION_SUPABASE}.
        </p>
      </Section>

      <Section titre="Nature des resultats">
        <p>
          Les simulations sont indicatives. Elles reposent sur des baremes et des hypotheses que vous pouvez lire et
          modifier, et ne constituent ni un conseil fiscal, juridique ou financier, ni une offre de credit. Faites
          valider toute decision par un professionnel (notaire, expert-comptable, conseiller bancaire).
        </p>
      </Section>

      <Section titre="Donnees personnelles">
        <p>
          Voir la <Lien vers="confidentialite" className="text-indigo-700 underline hover:text-indigo-900">politique de confidentialite</Lien>.
        </p>
      </Section>
    </Page>
  );
}

export function ConfidentialitePage() {
  return (
    <Page titre="Politique de confidentialite">
      <Section titre="En bref">
        <ul className="list-disc space-y-1 pl-5">
          <li>Les outils rapides fonctionnent sans compte et n’envoient rien au serveur.</li>
          <li>Avec un compte, nous gardons votre e-mail et les scenarios que vous enregistrez, rien de plus.</li>
          <li>Ni publicite, ni traceur, ni revente de donnees.</li>
          <li>
            Depuis « Mon compte », vous telechargez toutes vos donnees ou supprimez votre compte, immediatement et
            definitivement.
          </li>
        </ul>
      </Section>

      <Section titre="Responsable du traitement">
        <p>
          L’editeur du site, particulier agissant a titre non professionnel (voir les{' '}
          <Lien vers="mentions" className="text-indigo-700 underline hover:text-indigo-900">mentions legales</Lien>). Contact :{' '}
          <A href={GITHUB_PROFIL}>github.com/volvicpeche</A>.
        </p>
      </Section>

      <Section titre="Ce qui est collecte, et pourquoi">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">Donnees</th>
                <th className="py-2 pr-4 font-medium">Pourquoi</th>
                <th className="py-2 font-medium">Combien de temps</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b">
                <td className="py-2 pr-4">Adresse e-mail, mot de passe (stocke sous forme hachee, illisible)</td>
                <td className="py-2 pr-4">Creer et securiser votre compte</td>
                <td className="py-2">Tant que le compte existe</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">
                  Scenarios enregistres : revenus, situation familiale, biens, emprunts que vous y avez saisis
                </td>
                <td className="py-2 pr-4">Vous permettre de les retrouver</td>
                <td className="py-2">Jusqu’a ce que vous les supprimiez, ou avec le compte</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Cle API d’IA que vous renseignez (chiffree ; seuls ses 4 derniers caracteres sont lisibles)</td>
                <td className="py-2 pr-4">Appeler le modele de votre choix pour l’analyse d’annonce et la lecture de justificatifs</td>
                <td className="py-2">Jusqu’a ce que vous la supprimiez, ou avec le compte</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Nombre d’appels a l’IA par jour, pour les comptes utilisant la cle du site</td>
                <td className="py-2 pr-4">Limiter la depense</td>
                <td className="py-2">Avec le compte</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">
                  Saisies des simulateurs avances, le temps d’un calcul (revenus, foyer, biens…)
                </td>
                <td className="py-2 pr-4">Faire le calcul, qui a lieu sur le serveur</td>
                <td className="py-2">Aucune conservation : seul un scenario que vous enregistrez est garde</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Journaux techniques : adresse IP, date, page demandee, navigateur</td>
                <td className="py-2 pr-4">Securite du site et diagnostic des erreurs</td>
                <td className="py-2">Duree limitee, le temps de ces usages</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Base legale : l’execution du service que vous demandez en creant un compte (RGPD, art. 6.1.b) ; votre
          consentement pour la transmission de justificatifs a un fournisseur d’IA (art. 6.1.a) ; l’interet legitime a
          securiser le site pour les journaux (art. 6.1.f).
        </p>
      </Section>

      <Section titre="Les justificatifs que vous deposez">
        <p>
          Dans le simulateur frontalier, les documents deposes (certificat de salaire, attestations…) sont transmis au
          fournisseur d’IA de votre cle — Anthropic, OpenAI, Google ou l’API compatible que vous avez choisie — pour en
          extraire les montants. Ils restent en memoire le temps de la lecture : ils ne sont jamais ecrits sur le disque
          du serveur ni conserves. Seuls les montants que vous validez rejoignent le formulaire.
        </p>
        <p>
          Ces fournisseurs, pour la plupart etablis aux Etats-Unis, traitent les documents selon leur propre politique
          de confidentialite. Aucun document n’est envoye avant que vous l’ayez accepte, une fois par fournisseur :
          changer de fournisseur repose la question, et l’accord se retire a tout moment, sous la zone de depot ou dans
          « Mon compte ». La saisie a la main reste toujours possible.
        </p>
      </Section>

      <Section titre="Qui y a acces">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>OVH</strong> (France) heberge le site et le serveur.
          </li>
          <li>
            <strong>Supabase</strong> gere les comptes et la base de donnees, hebergee en {REGION_SUPABASE}.
          </li>
          <li>
            <strong>Le fournisseur d’IA de votre cle</strong>, uniquement pour ce que vous lui faites analyser.
          </li>
        </ul>
        <p>Aucune donnee n’est vendue, louee ou utilisee a des fins publicitaires.</p>
      </Section>

      <Section titre="Stockage dans votre navigateur">
        <p>
          Le site n’utilise aucun cookie publicitaire ni outil de mesure d’audience. Il garde dans le stockage local de
          votre navigateur : votre session de connexion, les valeurs saisies dans les outils rapides, le dernier
          simulateur ouvert et les fournisseurs d’IA auxquels vous avez accepte d’envoyer des justificatifs. Ces elements servent uniquement au fonctionnement que vous demandez, ne quittent pas votre
          appareil (hors session) et ne necessitent donc pas de consentement. Vider les donnees du site dans votre
          navigateur les efface.
        </p>
      </Section>

      <Section titre="Securite">
        <p>
          Connexion chiffree (HTTPS) ; cles API chiffrees (AES-256-GCM) avec un secret conserve hors de la base ; tables
          fermees a l’API publique de Supabase, seul le serveur du site y accede.
        </p>
      </Section>

      <Section titre="Vos droits">
        <p>
          Vous pouvez acceder a vos donnees, les rectifier, les supprimer, en obtenir une copie ou vous opposer a leur
          traitement. L’essentiel se fait vous-meme, depuis{' '}
          <Lien vers="compte" className="text-indigo-700 underline hover:text-indigo-900">Mon compte</Lien> :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Acces et portabilite</strong> : « Telecharger mes donnees » produit un fichier JSON avec tout ce que
            le serveur conserve pour vous et ce que votre navigateur garde pour le site.
          </li>
          <li>
            <strong>Rectification</strong> : adresse e-mail et mot de passe se changent sur la meme page ; les
            scenarios, dans chaque simulateur.
          </li>
          <li>
            <strong>Effacement</strong> : « Supprimer mon compte » efface immediatement et definitivement le compte, les
            scenarios, la cle d’IA et l’historique des analyses. Aucune copie n’est gardee.
          </li>
        </ul>
        <p>
          Pour toute autre demande, ou pour vous opposer a un traitement, contactez l’editeur via{' '}
          <A href={GITHUB_PROFIL}>GitHub</A> sans indiquer de donnee personnelle dans un message public : un moyen
          d’echange prive vous sera propose.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectes, vous pouvez saisir la CNIL :{' '}
          <A href="https://www.cnil.fr/fr/plaintes">cnil.fr/fr/plaintes</A>.
        </p>
      </Section>
    </Page>
  );
}
