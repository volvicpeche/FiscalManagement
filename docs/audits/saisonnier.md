# Audit du module « Location saisonnière »

*Octobre 2026 — état du code sur `main` après la PR 50. Aucun code modifié :
ce rapport sert à décider de la réécriture (branche `feat/saisonnier-montages`).*

Les points marqués **(à vérifier)** reposent sur ma connaissance des textes,
pas sur une lecture faite pour cet audit : chacun sera relu dans le texte
officiel avant d'être codé, comme les barèmes (`@aVerifier`).

## Suite donnée (branche `feat/saisonnier-montages`)

- Fait : plusieurs associés ; trois montages comparés (direct, SARL de
  famille, société à l'IS), la SCI signalée comme non adaptée ; statut
  LMNP/LMP déduit par le moteur ; art. 151 septies et IFI du LMP ;
  commission de plateforme et conciergerie séparées ; CA en nuits ×
  occupation × prix ; avertissements légaux ; anciens scénarios repris en
  direct.
- Décidé de reporter : rémunération du gérant de la société à l'IS
  (dividendes seulement), micro-social et régime général (avertissement en
  attendant).
- Non modifié faute de source lue : la sortie du micro-BIC (point 8). Le
  BOFiP annonce une révision des seuils au 19/08/2026, à relire.

## En bref

Le module calcule correctement **un seul propriétaire, en direct, en LMNP**,
et c'est là qu'il est solide. Il ne sait rien faire d'autre : ni plusieurs
associés, ni société, ni contrôle du statut LMP, et la sortie d'un LMP est
défavorisée à tort. Le classer « en société » demande donc une vraie
réécriture, pas un déplacement.

| Gravité | Point | Effet sur les chiffres |
|---|---|---|
| Bloquant | Un seul propriétaire, aucune société | Le module ne peut pas simuler un montage en société |
| Fort | Statut LMP choisi à la main, jamais contrôlé | Un LMP « impossible » ou un LMNP qui aurait dû être LMP |
| Fort | Exonération de la plus-value LMP (art. 151 septies) absente | Impôt de sortie LMP surestimé, souvent de tout son montant |
| Fort | Exonération IFI des biens LMP absente | IFI surestimé pour un LMP |
| Moyen | Conciergerie : plus de commission de plateforme | Charges sous-estimées de 3 à 15 % du CA |
| Moyen | Cotisations SSI à un taux forfaitaire de 35 % | Approximatif ; options micro-social et régime général ignorées |
| Moyen | Revenus saisis en euros par saison, occupation sans effet | Pas de lien nuits × prix, pas de vacance simulée |
| Moyen | Sortie du micro-BIC jugée sur la seule année précédente | Bascule au réel un an trop tôt (à vérifier) |
| Faible | TVA para-hôtelière, contraintes légales non signalées | Aucun avertissement là où le projet peut être interdit |

## Ce qui est juste et à garder

- **LMNP au réel** (`lmnp.ts`) : l'amortissement ne crée jamais de déficit
  (art. 39 C), l'excédent est différé sans limite ; ordre d'imputation
  amortissement de l'année → déficits (10 ans, plus anciens d'abord) →
  différés. Testé.
- **Micro-BIC 2025** : 30 % jusqu'à 15 000 € pour un meublé de tourisme non
  classé, 50 % jusqu'à 77 700 € sinon, abattement minimal de 305 €.
- **Prélèvements sociaux LMNP à 18,6 %** (LFSS 2026), 7,5 % pour un affilié
  suisse.
- **Bascule SSI au-delà de 23 000 €** de recettes d'un meublé de tourisme,
  jugée sur la part de chaque associé, cotisations déductibles au réel seulement.
- **Revente LMNP** : réintégration des amortissements réellement déduits
  (LF 2025), différés exclus, mobilier hors plus-value immobilière.
- **Différentiel d'IR** sur le foyer, taux effectif d'un frontalier compris.

## Les écarts

### 1. Un seul propriétaire, aucune société — *bloquant pour le classement « en société »*

`saisonnierStore.ts` construit une seule structure `LMNP` ou `LMP` avec un
seul associé (« v1 supports a single owner »). Le moteur sait gérer
plusieurs associés, mais rien ne les expose. Aucune forme de société :

- **SCI** : à exclure. Une SCI qui loue en meublé de façon habituelle exerce
  une activité commerciale et devient passible de l'IS (art. 206-2 CGI),
  avec perte de la transparence (à vérifier : seuil de tolérance de 10 % des
  recettes). À signaler, pas à simuler.
- **SARL de famille à l'IR** (art. 239 bis AA) : associés en ligne directe,
  frères et sœurs, conjoints, partenaires de PACS. Chacun est imposé comme
  un loueur en meublé sur sa quote-part, LMNP ou LMP selon sa propre
  situation. Proche du moteur actuel, réparti entre associés.
- **SAS ou SARL à l'IS** : IS 15 % / 25 % sur le résultat après amortissement
  (moteur SCI à l'IS réutilisable), puis dividendes au PFU ou au barème.
  Rémunération éventuelle d'un gérant à traiter à part (cotisations).

### 2. Statut LMP choisi à la main — *fort*

`LMP_SEUIL_RECETTES` (23 000 €) existe dans `baremes.ts` mais **n'est utilisé
nulle part**. L'utilisateur coche LMNP ou LMP librement. Or le statut LMP
découle de deux conditions cumulées (art. 155 IV CGI) : recettes > 23 000 €
**et** recettes > autres revenus d'activité du foyer. Il faut le **déduire**,
année par année, et l'afficher, au lieu de le demander.

### 3. Plus-value LMP : exonération de l'art. 151 septies absente — *fort*

`exit.ts` l'écrit lui-même : « the article 151 septies exemption (…) is NOT
applied ». Après cinq ans d'activité, la plus-value professionnelle est
exonérée en totalité si les recettes sont inférieures à 90 000 €, en partie
jusqu'à 126 000 € (à vérifier : seuils et conditions de durée). Pour un gîte,
c'est le cas le plus fréquent : l'impôt de sortie LMP affiché est aujourd'hui
souvent faux en entier.

### 4. IFI d'un LMP — *fort*

Le simulateur soumet tous les biens à l'IFI. Les biens d'un LMP sont des
biens professionnels exonérés (art. 975 CGI, à vérifier : conditions de
recettes et de part des revenus professionnels). L'IFI d'un LMP est donc
surestimé.

### 5. Conciergerie et commission de plateforme — *moyen*

`saisonnier.ts` : en conciergerie, **aucune** commission de plateforme n'est
comptée (« no platform commission is charged on top »). En pratique la
plateforme prélève ses frais côté hôte, que la location passe ou non par une
conciergerie, et la conciergerie facture son pourcentage en plus. Les
charges sont sous-estimées. Proposition : deux taux indépendants
(plateforme, conciergerie), conciergerie calculée sur le CA net de la
plateforme, valeurs par défaut à vérifier.

### 6. Cotisations sociales — *moyen*

Un affilié SSI paie un taux forfaitaire de 35 % (minimum 1 200 €). C'est un
ordre de grandeur. Non modélisé (à vérifier) :

- au micro-BIC, l'option **micro-social** (cotisations proportionnelles au
  chiffre d'affaires, taux différents pour un meublé classé ou non) ;
- l'option d'affiliation au **régime général** (URSSAF) pour un meublé de
  tourisme, sous plafond de recettes.

### 7. Revenus — *moyen*

Le CA est saisi directement en euros par saison ; `tauxOccupation` est
« informational » et n'a aucun effet. On ne peut donc ni tester une baisse
d'occupation, ni simuler une hausse de prix. Proposition : nuits disponibles
× occupation × prix moyen par nuit, par saison, le CA en découlant ; la saisie
directe reste possible.

### 8. Sortie du micro-BIC — *moyen, à vérifier*

Le moteur passe au réel dès que les recettes de l'année précédente dépassent
le seuil. La règle des régimes micro (art. 50-0) ne fait sortir qu'après
**deux années consécutives** de dépassement. À relire, puis corriger.

### 9. Ce qui n'est signalé nulle part — *faible en calcul, fort en pratique*

Avertissements à ajouter, pas de calcul :

- **Loi Le Meur (2024)** (à vérifier) : enregistrement de tout meublé de
  tourisme, DPE minimal pour les nouvelles locations dans les communes qui
  l'exigent, quotas et plafond de nuitées que la commune peut fixer.
- **Changement d'usage** dans les grandes villes et l'Île-de-France, parfois
  avec compensation : le projet peut être tout simplement interdit.
- **Règlement de copropriété** : peut interdire la location courte durée.
- **TVA para-hôtelière** si trois des quatre services (petit-déjeuner, ménage
  régulier, linge, accueil) sont fournis : TVA collectée, mais aussi
  récupérable sur l'achat et les travaux.
- **Taxe de séjour** : collectée pour la commune, neutre pour la rentabilité ;
  à mentionner, pas à calculer.

## Proposition pour la réécriture

1. **Plusieurs associés** dans le formulaire (le moteur suit déjà).
2. **Trois montages sur une même saisie** : en direct (LMNP/LMP déduit),
   SARL de famille à l'IR, société à l'IS. La SCI apparaît comme
   « non adaptée » avec la raison.
3. **Statut LMP déduit** chaque année, art. 151 septies et exonération IFI
   pour le LMP.
4. **Revenus** : nuits × occupation × prix, par saison ; plateforme et
   conciergerie séparées.
5. **Avertissements légaux** (point 9), chacun avec sa source.
6. **Tests** sur chaque règle, et des cas réels plus tard comme pour la TOU.

Ordre suggéré : 2 et 3 d'abord (ce sont eux qui faussent les chiffres et
justifient le classement « en société »), puis 4, puis 5.

## Décisions à prendre

- **Rémunération du gérant** dans la société à l'IS : simulée (cotisations,
  IR) ou ignorée dans un premier temps (dividendes seulement) ? Je propose de
  l'ignorer d'abord.
- **Micro-social et régime général** (point 6) : dans cette réécriture, ou
  plus tard ? Je propose plus tard, avec un avertissement en attendant.
- **Scénarios enregistrés** : les anciens (un propriétaire, LMNP/LMP) sont
  repris comme « en direct » avec un seul associé, sans perte.
