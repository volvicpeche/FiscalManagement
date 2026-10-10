/**
 * What can forbid or reshape a seasonal letting, whatever the figures say.
 * Warnings, not computations: each depends on the commune, the building or
 * the services offered. Kept short, with what to check and where.
 */
const POINTS: { titre: string; texte: string }[] = [
  {
    titre: 'Enregistrement et regles de la commune',
    texte:
      'Depuis la loi Le Meur (2024), tout meuble de tourisme doit etre declare et enregistre aupres de la mairie. La commune peut fixer des quotas, exiger un diagnostic de performance energetique minimal pour les nouvelles autorisations et, pour une residence principale, abaisser le plafond de 120 nuitees par an. A verifier en mairie avant d’acheter.',
  },
  {
    titre: 'Changement d’usage',
    texte:
      'Dans les grandes villes et en Ile-de-France, louer un logement en courte duree peut exiger une autorisation de changement d’usage, parfois avec compensation (transformer une autre surface en logement). Sans elle, le projet est interdit.',
  },
  {
    titre: 'Reglement de copropriete',
    texte:
      'Il peut interdire la location de courte duree, ou une activite commerciale dans l’immeuble. A lire avant toute offre.',
  },
  {
    titre: 'TVA para-hoteliere',
    texte:
      'Avec au moins trois services parmi petit-dejeuner, menage regulier, linge et accueil, la location entre dans le champ de la TVA (taux reduit) : TVA collectee sur les nuitees, mais recuperable sur l’achat et les travaux. Non simulee ici.',
  },
  {
    titre: 'Taxe de sejour',
    texte:
      'Collectee pour la commune, le plus souvent par la plateforme : neutre pour la rentabilite, mais a declarer.',
  },
  {
    titre: 'Cotisations sociales',
    texte:
      'Les options micro-social et regime general (URSSAF) d’un meuble de tourisme ne sont pas encore simulees : le calcul retient un taux SSI forfaitaire.',
  },
];

export function SaisonnierAvertissements() {
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-amber-900">
        Avant d’acheter : ce que le calcul ne verifie pas
      </summary>
      <ul className="mt-3 space-y-2 text-sm text-amber-900">
        {POINTS.map((p) => (
          <li key={p.titre}>
            <strong>{p.titre}.</strong> {p.texte}
          </li>
        ))}
      </ul>
    </details>
  );
}
