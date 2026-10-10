# Cas réels

Chaque fichier JSON de ce dossier est **un foyer réel, anonymisé**, avec ce que
le canton lui a **réellement facturé** en taxation ordinaire ultérieure (TOU).
`casReels.test.ts` recalcule chaque foyer avec le moteur et compare, ligne par
ligne, au décompte. C'est la meilleure validation possible du calcul : un
barème mal lu, une déduction oubliée, un arrondi faux se voient ici.

## Ajouter un cas

1. **Accord de la personne**, explicite, pour que ses montants (sans nom)
   rejoignent le dépôt du projet. Le dépôt est public : rien qui identifie.
2. Elle saisit sa situation dans le simulateur TOU, l'**enregistre**, puis
   télécharge l'export depuis **Mon compte → Télécharger mes données**.
3. Depuis `server/` :

   ```bash
   npx tsx scripts/nouveau-cas-reel.ts --export patrimonia-export.json \
     --id 2026-ge-couple-b1 --description "Couple marie, un revenu suisse, un enfant, studio loue en France"
   ```

   `--scenario "<nom>"` si l'export contient plusieurs scénarios frontalier.
   Le script retire prénoms et noms des biens, écrit le fichier avec un
   `attendu` vide et affiche ce que calcule le moteur.
4. Reporter dans `attendu` les lignes **lues sur les bordereaux**, et seulement
   celles-là (les autres restent absentes) :

   | Champ                | Sur le document                                   |
   |----------------------|---------------------------------------------------|
   | `revenuImposableIcc` | Bordereau ICC : revenu imposable                  |
   | `impotBaseIcc`       | Bordereau ICC : impôt de base (impôt cantonal)    |
   | `centimesCantonaux`  | Bordereau ICC : centimes additionnels cantonaux   |
   | `reductionLdirpp`    | Bordereau ICC : réduction (LDIRPP), en positif    |
   | `impotCommunal`      | Bordereau ICC : impôt communal (part privilégiée + commune de travail) |
   | `icc`                | Bordereau ICC : total cantonal et communal        |
   | `revenuImposableIfd` | Bordereau IFD : revenu imposable                  |
   | `ifd`                | Bordereau IFD : impôt fédéral direct              |
   | `totalTou`           | Somme des deux, si seul le total est connu        |

5. Compléter `description` (le profil en une phrase, **jamais un nom**) et
   `source.documents` (« bordereau ICC 2026 », « bordereau IFD 2026 »).
6. `npx vitest run src/__tests__/casReels.test.ts`

## Lire le résultat

- **Vert** : le moteur retrouve le décompte, à `tolerance` près (5 CHF par
  défaut : les bordereaux arrondissent au franc).
- **Rouge** : le tableau donne, ligne par ligne, calculé / réel / écart.
  Chercher la cause (déduction, barème, centimes de la commune...). Si elle
  est comprise mais pas encore corrigée, décrire la cause dans `ecartConnu` :
  le test attend alors l'écart, et échouera le jour où il disparaît, pour
  qu'on retire la mention.
- **Ignoré** (`skipped`), la raison entre crochets :
  - *barème XXXX non chargé* : le moteur calcule une seule année (2026).
    Un décompte d'une autre année attend ici que ses barèmes soient ajoutés ;
  - *canton pas encore calculé* : Zurich, tant que `zurich.ts` est vide ;
  - *montants du décompte à compléter* : `attendu` est vide.

## Les exemples

Les fichiers marqués `"exemple": true` ne sont **pas** des décomptes : leurs
montants sont ceux du moteur, ils montrent le format et verrouillent le
calcul actuel. Ils ne valident rien. Les remplacer par de vrais cas dès qu'il
y en a.
