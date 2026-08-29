import { useState } from 'react';
import { PROFILE_META } from '@/lib/profiles';

/**
 * Plain-language guide to what the simulator compares.
 *
 * Written for someone who has never heard of an SCI: every term is defined
 * where it first appears, and the trade-offs are stated as trade-offs rather
 * than as recommendations. Nothing here is advice — the figures depend
 * entirely on the scenario, which is the whole point of the tool.
 */

interface Section {
  id: string;
  titre: string;
  contenu: React.ReactNode;
}

function Terme({ mot, children }: { mot: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-700 leading-relaxed">
      <strong className="text-gray-900">{mot}</strong> — {children}
    </p>
  );
}

function Comparaison({
  colonnes,
  lignes,
}: {
  colonnes: string[];
  lignes: { critere: string; valeurs: string[] }[];
}) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left font-medium text-gray-500 py-2 pr-4">Critere</th>
            {colonnes.map((c) => (
              <th key={c} className="text-left font-semibold text-gray-800 py-2 px-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.critere} className="border-b last:border-0">
              <td className="py-2 pr-4 text-gray-600 align-top">{l.critere}</td>
              {l.valeurs.map((v, i) => (
                <td key={i} className="py-2 px-3 text-gray-700 align-top">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: 'sci',
    titre: 'Qu’est-ce qu’une SCI ?',
    contenu: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          Une <strong>SCI</strong> (Societe Civile Immobiliere) est une societe dont l’objet est de
          detenir de l’immobilier. Au lieu d’acheter un bien en votre nom, vous creez une societe,
          et c’est elle qui achete. Vous ne possedez plus des murs : vous possedez des{' '}
          <strong>parts</strong> de la societe qui possede les murs.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          Ce detour parait inutile pour un achat seul. Il devient interessant des qu’on est
          plusieurs, ou qu’on pense a la transmission : des parts se donnent par petits paquets, un
          mur non. C’est la raison d’etre la plus frequente d’une SCI familiale.
        </p>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2">
          <Terme mot="Associe">
            une personne qui detient des parts. Une SCI en exige au moins deux — c’est une societe,
            pas une entreprise individuelle.
          </Terme>
          <Terme mot="Parts sociales">
            votre quote-part de la societe. Elles determinent votre part des benefices, votre poids
            dans les decisions, et ce qui sera transmis a votre deces.
          </Terme>
          <Terme mot="Gerant">
            celui qui administre au quotidien. Souvent un des associes, souvent non remunere.
          </Terme>
        </div>
      </div>
    ),
  },
  {
    id: 'ir-is',
    titre: 'Le choix central : IR ou IS',
    contenu: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          C’est la decision qui change tout, et elle est difficilement reversible. Une SCI est par
          defaut a l’<strong>IR</strong> ; elle peut opter pour l’<strong>IS</strong>, mais ce choix
          est en principe definitif.
        </p>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm font-semibold text-amber-900 mb-1">SCI a l’IR — la transparence</p>
          <p className="text-sm text-amber-900 leading-relaxed">
            La societe ne paie aucun impot. Son resultat est decoupe entre les associes au prorata
            de leurs parts, et chacun l’ajoute a ses propres revenus. Un associe tres impose paiera
            donc beaucoup sur la meme quote-part qu’un associe peu impose — d’ou les revenus
            personnels demandes pour chaque associe dans le simulateur.
          </p>
        </div>

        <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
          <p className="text-sm font-semibold text-blue-900 mb-1">SCI a l’IS — la societe paie</p>
          <p className="text-sm text-blue-900 leading-relaxed">
            La societe est imposee elle-meme, a 15 % jusqu’a 42 500 EUR de benefice puis 25 %. En
            echange elle peut <strong>amortir</strong> le bien, ce qui efface son resultat imposable
            pendant des annees. Tant que l’argent reste dans la societe, vous n’etes pas impose
            personnellement.
          </p>
        </div>

        <Comparaison
          colonnes={['SCI a l’IR', 'SCI a l’IS']}
          lignes={[
            { critere: 'Qui paie l’impot', valeurs: ['Chaque associe, a son taux', 'La societe, a 15 % puis 25 %'] },
            { critere: 'Amortissement', valeurs: ['Non', 'Oui — efface le resultat des annees durant'] },
            { critere: 'Impot les premieres annees', valeurs: ['Souvent eleve', 'Souvent nul'] },
            { critere: 'Sortir le cash', valeurs: ['Deja impose, libre ensuite', 'Dividende, impose une seconde fois'] },
            { critere: 'Plus-value a la revente', valeurs: ['Abattements, exoneree apres 22/30 ans', 'Calculee sur la valeur comptable : tres lourde'] },
            { critere: 'Comptabilite', valeurs: ['Simple', 'Commerciale, bilan obligatoire'] },
            { critere: 'Reversible', valeurs: ['Option vers l’IS possible', 'En principe non'] },
          ]}
        />

        <p className="text-sm text-gray-700 leading-relaxed">
          Le piege classique : l’IS parait imbattable pendant vingt ans, puis la revente rattrape
          tout. L’amortissement diminue la valeur comptable du bien, et la plus-value se calcule sur
          cette valeur — pas sur le prix d’achat. On peut avoir amorti 200 000 EUR d’impot economise
          et en rendre une bonne part au moment de vendre. L’IS se pense donc pour un patrimoine
          qu’on garde, pas qu’on revend.
        </p>
      </div>
    ),
  },
  {
    id: 'holding',
    titre: 'Pourquoi ajouter une holding ?',
    contenu: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          Une <strong>holding</strong> est une societe dont l’actif principal est… d’autres
          societes. Vous detenez la holding, la holding detient la SCI.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          Son interet fiscal tient au <strong>regime mere-fille</strong> : quand la SCI remonte ses
          benefices a la holding, 95 % de la somme echappe a l’impot. Seuls 5 % sont reintegres. Le
          cash s’accumule donc au niveau de la holding presque sans frottement, pret a financer une
          acquisition suivante.
        </p>
        <div className="rounded-md bg-rose-50 border border-rose-200 p-3">
          <p className="text-sm text-rose-900 leading-relaxed">
            <strong>La contrepartie est immediate et certaine :</strong> c’est une seconde societe.
            Deuxieme comptabilite, deuxieme CFE, deuxieme compte bancaire, deuxieme assemblee
            generale. Dans les simulations, la holding coute couramment{' '}
            <strong>100 000 EUR de frais supplementaires sur trente ans</strong> pour quelques
            milliers d’euros d’impot economise. Lancez la comparaison : sur un seul bien, elle perd
            presque toujours.
          </p>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          La holding se justifie quand il y a plusieurs societes a chapeauter, ou un projet de
          reinvestissement en serie. Pas pour un appartement.
        </p>
      </div>
    ),
  },
  {
    id: 'lmp',
    titre: 'Location saisonniere et LMP',
    contenu: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          Louer en meuble de courte duree n’est pas une activite civile mais{' '}
          <strong>commerciale</strong>. Elle ne releve donc pas des revenus fonciers mais des{' '}
          <strong>BIC</strong> (benefices industriels et commerciaux), avec des regles propres.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          Au <strong>reel</strong>, vous amortissez le bien et le mobilier — comme une SCI a l’IS,
          mais sans societe. Le resultat imposable est souvent nul ou negatif pendant des annees.
          Et un deficit professionnel s’impute sur l’ensemble de vos revenus{' '}
          <strong>sans le plafond de 10 700 EUR</strong> qui s’applique au foncier.
        </p>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2">
          <Terme mot="LMNP vs LMP">
            non professionnel en dessous de 23 000 EUR de recettes annuelles (ou si ces recettes
            restent minoritaires dans vos revenus), professionnel au-dela. Le passage en LMP
            declenche les cotisations sociales TNS.
          </Terme>
          <Terme mot="Cotisations sociales TNS">
            environ 35 % du resultat, la ou le foncier subit 17,2 % de prelevements sociaux. Plus
            cher, mais elles ouvrent des droits a la retraite et a l’assurance maladie — ce que les
            prelevements sociaux ne font pas.
          </Terme>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          Attention : de nombreuses communes encadrent desormais la location de courte duree
          (autorisation de changement d’usage, quotas, nombre de nuitees). Verifiez la
          reglementation locale avant de batir un plan sur trente ans.
        </p>
      </div>
    ),
  },
  {
    id: 'concepts',
    titre: 'Les notions qui reviennent partout',
    contenu: (
      <div className="space-y-3">
        <div className="rounded-md border border-gray-200 p-3 space-y-3">
          <Terme mot="Amortissement">
            une charge comptable qui constate l’usure du bien. Elle diminue le resultat imposable{' '}
            <em>sans qu’un euro ne sorte</em>. C’est pour cela qu’elle figure dans « Base fiscale »
            et non dans « Sorties » du tableau previsionnel. Le terrain n’est jamais amortissable :
            il ne s’use pas.
          </Terme>
          <Terme mot="Cash-flow net">
            ce qui reste reellement sur l’annee. Il est souvent tres negatif, et c’est normal :
            voir juste en dessous.
          </Terme>
          <Terme mot="Effort reel">
            le cash-flow auquel on rajoute le capital rembourse. Rembourser du capital n’est pas une
            perte : c’est de l’epargne forcee qui se transforme en murs. Un cash-flow a −6 300 EUR
            dont 6 328 EUR de capital, c’est une operation a l’equilibre, pas un gouffre. C’est
            l’indicateur a regarder pour savoir ce que l’operation vous coute vraiment.
          </Terme>
          <Terme mot="Situation nette (et pourquoi ce n’est pas de l’argent)">
            ce que valent les parts : tout ce que la societe possede moins tout ce qu’elle doit.
            Une situation nette de 60 000 EUR ne veut pas dire que la SCI a 60 000 EUR en caisse —
            l’essentiel est immobilise dans les murs. Pour en faire quelque chose, il faut vendre le
            bien ou reemprunter dessus. La <em>tresorerie</em>, elle, est l’argent reellement
            disponible ; elle peut meme etre negative, ce qui signale que quelqu’un doit remettre au
            pot.
          </Terme>
          <Terme mot="Compte courant d’associe">
            de l’argent que vous <em>pretez</em> a la societe, au lieu de le lui donner en capital.
            Difference decisive : le remboursement d’un compte courant n’est pas un revenu, donc
            n’est pas impose. C’est la voie la moins chere pour recuperer de la tresorerie.
          </Terme>
          <Terme mot="Deficit foncier">
            quand les charges depassent les loyers. Il s’impute sur votre revenu global jusqu’a
            10 700 EUR par an ; le surplus est reporte dix ans. Un deficit peut donc faire{' '}
            <em>baisser</em> votre impot total — d’ou les montants negatifs dans la colonne IR.
          </Terme>
          <Terme mot="TRI (taux de rendement interne)">
            le rendement annuel de l’operation, tout compris. Il rend l’immobilier comparable a un
            placement financier. Un TRI de 3 % sur trente ans d’efforts merite d’etre compare a ce
            qu’aurait rapporte la meme somme ailleurs.
          </Terme>
          <Terme mot="IFI">
            impot sur la fortune immobiliere, du au-dela de 1,3 million d’euros de patrimoine
            immobilier net de dettes. La dette bancaire se deduit : c’est un des interets de
            l’emprunt.
          </Terme>
        </div>
      </div>
    ),
  },
  {
    id: 'transmission',
    titre: 'Transmettre',
    contenu: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          C’est souvent la vraie raison de creer une SCI. Chaque enfant peut recevoir{' '}
          <strong>100 000 EUR en franchise de droits</strong> par parent, et cet abattement se
          reconstitue tous les quinze ans. Donner des parts progressivement permet d’utiliser cet
          abattement plusieurs fois — impossible avec un appartement, qu’on ne peut pas decouper.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          Le simulateur applique une <strong>decote d’illiquidite</strong> (10 % par defaut) sur la
          valeur des parts : elles ne se vendent pas librement, leur valeur retenue est donc
          minoree.
        </p>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2">
          <Terme mot="Demembrement">
            vous donnez la <em>nue-propriete</em> et gardez l’<em>usufruit</em> — le droit d’occuper
            et d’encaisser les loyers jusqu’a votre deces. Seule la nue-propriete sort de votre
            patrimoine, et sa valeur depend de votre age : plus vous donnez tot, moins elle est
            imposee.
          </Terme>
          <Terme mot="Le compte courant, lui, reste">
            un piege frequent : le compte courant est une creance qui figure dans votre succession a
            sa <em>valeur nominale</em>, sans aucune decote. Donner des parts sans se faire
            rembourser son compte courant ne fait que deplacer le probleme.
          </Terme>
        </div>
      </div>
    ),
  },
  {
    id: 'limites',
    titre: 'Ce que ce simulateur ne fait pas',
    contenu: (
      <div className="space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          Autant le dire clairement : c’est un outil de comparaison, pas un conseil, et encore moins
          une projection fiable a trente ans.
        </p>
        <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
          <li>
            <strong>La revente n’est pas modelisee.</strong> Le TRI utilise la valeur du patrimoine
            au terme comme si elle etait encaissable telle quelle. L’impot sur la plus-value de
            sortie — precisement la ou l’IS coute cher — n’est pas deduit.
          </li>
          <li>
            <strong>Les couts de structure sont indicatifs.</strong> Remplacez-les par vos propres
            devis dans le bloc « Couts de structure ».
          </li>
          <li>
            <strong>Trente ans de fiscalite stable, c’est une fiction.</strong> Les baremes 2026
            sont figes sur tout l’horizon. Aucune reforme n’est anticipee.
          </li>
          <li>
            <strong>Le deficit foncier est simplifie</strong> : le plafond de 10 700 EUR s’applique
            au deficit entier, sans isoler la part d’interets, ce qui avantage legerement l’IR les
            premieres annees.
          </li>
          <li>
            <strong>Aucune vacance locative</strong> n’est simulee hors du taux d’occupation
            saisonnier, ni impaye, ni gros travaux imprevus.
          </li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          Utilisez-le pour comprendre les ordres de grandeur et les arbitrages. Faites valider le
          montage retenu par un notaire ou un expert-comptable avant de signer quoi que ce soit.
        </p>
      </div>
    ),
  },
];

export function AidePage() {
  const [ouvert, setOuvert] = useState<string | null>(SECTIONS[0].id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Comprendre les montages</h2>
        <p className="text-sm text-gray-600 mt-1">
          De quoi lire les resultats du simulateur sans connaissance prealable. Chaque terme est
          defini la ou il apparait.
        </p>
      </div>

      {/* What the three columns of the comparison actually are */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(['SCI_IR', 'SCI_IS_SEULE', 'SCI_IS_HOLDING'] as const).map((p) => {
          const meta = PROFILE_META[p];
          return (
            <div key={p} className={`rounded-md border p-3 ${meta.bg} ${meta.border}`}>
              <p className={`text-sm font-semibold ${meta.text}`}>{meta.label}</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{meta.description}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {SECTIONS.map((s) => {
          const isOpen = ouvert === s.id;
          return (
            <div key={s.id} className="bg-white rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setOuvert(isOpen ? null : s.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900">{s.titre}</span>
                <span className="text-gray-400 text-lg leading-none">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <div className="px-4 pb-4 pt-1 border-t">{s.contenu}</div>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center pb-4">
        Informations generales sur la fiscalite francaise 2026. Ni conseil juridique, ni conseil
        fiscal.
      </p>
    </div>
  );
}
