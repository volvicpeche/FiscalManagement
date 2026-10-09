# Déployer Patrimonia sur un VPS OVH

Ce guide part d'un VPS neuf et va jusqu'à l'application en ligne, mise à jour
automatiquement à chaque push sur `main`. Chaque commande indique **où** elle
se lance : sur le **VPS** (connecté en SSH), sur **votre PC**, ou sur **GitHub**.

## Comment ça marche

```
push sur main
   └─► GitHub Actions : tests ─► construction des 2 images ─► envoi sur GHCR
                                                                  │
VPS OVH ◄──── connexion SSH : docker compose pull && up -d ◄──────┘
```

Deux conteneurs tournent sur le VPS :

- **server** : l'API Fastify, sur le port 3000, joignable uniquement par `web`.
- **web** : l'application React servie par nginx, qui relaie `/api/*` vers
  `server`. C'est le seul conteneur publié, sur le port 80.

Le VPS ne contient **pas** le code source : il télécharge des images déjà
construites sur GHCR (le registre d'images de GitHub). Les comptes
utilisateurs et les scénarios enregistrés vivent chez **Supabase** (un
Postgres hébergé, avec son service d'authentification) : le VPS ne garde
aucune donnée.

```
navigateur ──► web (nginx) ──/api/*──────────► server ──► Postgres Supabase
                    └──────/supabase/auth/v1──► Supabase Auth
```

Le navigateur ne contacte pas `supabase.co` pour se connecter : nginx relaie
la connexion. Un proxy d'entreprise qui bloquerait Supabase ne bloque donc pas
l'application. Seul le lien des e-mails (confirmation d'inscription, mot de
passe oublié) passe par `supabase.co` avant de revenir sur l'application.

Le projet Supabase peut être **partagé avec d'autres applications** : toutes
les tables de Patrimonia vivent dans leur propre schéma Postgres, `tax`, et
rien n'est écrit dans `public`.

**Prérequis** : un VPS OVH sous **Ubuntu 26.04**, l'utilisateur `ubuntu` créé
par OVH, et l'adresse IP du VPS. Dans la suite, remplacez `<IP_DU_VPS>` par
cette adresse.

---

## Étape 1 — Préparer le système (VPS)

Connectez-vous : `ssh ubuntu@<IP_DU_VPS>`, puis :

```bash
# Mettre le système à jour
sudo apt update && sudo apt upgrade -y

# Pare-feu : SSH et HTTP uniquement
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable

# 2 Go de swap : filet de sécurité sur un VPS à 4 Go de RAM, utile quand
# Chrome analyse une annonce (voir étape 3)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Si vous avez activé le pare-feu dans l'espace client OVH (VPS → Firewall),
ouvrez-y aussi les ports **22** et **80**.

## Étape 2 — Installer Podman (VPS)

Podman fait tourner les conteneurs sans droits root. Les paquets
`podman-docker` et `podman-compose` font répondre les commandes `docker` et
`docker compose` : c'est ce qu'utilise le workflow de déploiement.

```bash
sudo apt install -y podman podman-docker podman-compose

# Vérification : doit afficher une version, sans erreur
docker compose version
```

Quatre réglages, à faire **une seule fois** :

```bash
# 1. Autoriser Podman sans root à écouter sur le port 80
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-podman-port80.conf
sudo sysctl --system

# 2. Garder les conteneurs actifs quand vous vous déconnectez de SSH
sudo loginctl enable-linger ubuntu

# 3. Relancer les conteneurs au redémarrage du VPS
systemctl --user enable --now podman-restart.service

# 4. Ouvrir le socket Podman, par lequel passe `docker compose`
systemctl --user enable --now podman.socket
curl -s --unix-socket /run/user/1000/podman/podman.sock http://d/_ping; echo   # → OK
```

Pourquoi chacun :

1. Sous Linux, seul root peut écouter sur un port inférieur à 1024. Ce
   réglage abaisse la limite à 80 pour les programmes non-root. Il **n'ouvre
   rien sur Internet** : c'est le pare-feu de l'étape 1 qui décide de ce qui
   est joignable. Il devient inutile une fois passé en HTTPS (voir plus bas).
2. Sans cela, Podman sans root arrête tous vos conteneurs à la fermeture de
   votre session SSH.
3. `restart: unless-stopped` ne suffit pas avec Podman sans root : c'est ce
   service qui relance les conteneurs au démarrage.
4. `docker compose` délègue au programme `docker-compose`, qui ne parle pas
   directement à Podman : il passe par ce socket, inactif par défaut. Sans
   lui, le déploiement échoue sur « Cannot connect to the Docker daemon ».

## Étape 2 bis — Relever 3 valeurs dans Supabase (navigateur)

Patrimonia se branche sur **votre projet Supabase existant**. Il y range ses
tables à part (schéma `tax`) et ne touche ni à vos autres tables ni à vos
autres applications. Il ne vous faut que **3 valeurs à copier** et **1
réglage à ajouter**. Tout le reste est vérifié automatiquement au démarrage
(point C).

Ouvrez votre projet sur [supabase.com/dashboard](https://supabase.com/dashboard),
et gardez un bloc-notes ouvert pour y coller les 3 valeurs.

### A. Les 3 valeurs à copier

**A1 — L'adresse du projet** → `SUPABASE_URL`

- Où : menu de gauche **Project Settings** (roue dentée, en bas) →
  **Data API** → champ **Project URL** → bouton *Copy*.
- Ça ressemble à : `https://abcdefghijklmnop.supabase.co`
- À coller : dans `server/.env` (étape 3b) **et** dans `web/.env` (étape 3c).

**A2 — La clé publique** → `SUPABASE_ANON_KEY`

- Où : **Project Settings** → **API Keys** → onglet *Publishable and secret
  API keys* → la clé **publishable**. Si la liste est vide, créez-la avec
  *Create new API keys*.
- Ça ressemble à : `sb_publishable_…`
- À coller : dans `server/.env` (étape 3b).
- Elle est publique : le navigateur la reçoit de toute façon.
- À défaut, l'ancienne clé **anon** (onglet *Legacy API keys*, commence par
  `eyJ…`) fonctionne aussi, mais Supabase retire progressivement ces clés :
  préférez la publishable.

> ⚠️ Ne prenez **jamais** la clé **secret** (`sb_secret_…`), ni l'ancienne
> **service_role** : elles donnent tous les droits sur votre base, et
> Patrimonia n'en a pas besoin. Si vous en collez une par erreur, le serveur
> refuse de l'envoyer au navigateur et le signale au démarrage.

**A3 — La connexion à la base** → `DATABASE_URL`

- Où : bouton **Connect**, en haut de la page du projet → onglet
  *Connection String* → section **Session pooler** → copiez l'adresse.
- Ça ressemble à :
  `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`
- **Remplacez `[YOUR-PASSWORD]`** (crochets compris) par le mot de passe de
  la base, choisi à la création du projet. Oublié ? **Project Settings →
  Database → Reset database password**, mais si une autre de vos
  applications se connecte à la base avec ce mot de passe, mettez-la à jour
  aussi.
- Si le mot de passe contient `@`, `:`, `/`, `#`, `?` ou `%`, il casse
  l'adresse : le plus simple est d'en générer un sans ces caractères.
- À coller : dans `server/.env` (étape 3b).
- Bien le *Session pooler*, pas *Direct connection* ni *Transaction pooler* :
  les deux autres ne fonctionnent pas depuis ce VPS.

### B. Le réglage à ajouter

Sans lui, le lien de confirmation reçu par e-mail à l'inscription ramène vers
une autre de vos applications au lieu de Patrimonia.

- Où : menu de gauche **Authentication** → **URL Configuration** → section
  **Redirect URLs** → **Add URL**.
- Ajoutez, **avec les deux étoiles à la fin** :
  - `https://<DOMAINE>/auth/confirmer**`
    (ou `http://<IP_DU_VPS>/auth/confirmer**` tant que vous n'êtes pas en HTTPS) ;
  - et, si vous développez sur votre PC : `http://localhost:5173/auth/confirmer**`.
- **Ajoutez seulement.** Ne supprimez rien, et ne changez pas la *Site URL*
  au-dessus : elles servent à vos autres applications.

### C. Laisser le serveur vérifier le reste

Une fois l'application démarrée (étape 6), lisez son bilan :

```bash
cd ~/patrimonia
docker compose logs server | grep Supabase
```

Si tout va bien :

```
[Supabase] Configuration verifiee :
[Supabase]   ✓ Adresse du projet et cle publique acceptees.
[Supabase]   ✓ Signature des jetons : cles publiques du projet (rien a configurer).
[Supabase]   i A verifier a la main : … Redirect URLs doit contenir « https://<votre domaine>/auth/confirmer** » …
```

Chaque ligne **✗** (à corriger) ou **⚠** (à vérifier) dit ce qui ne va pas et
où cliquer dans Supabase. Le cas le plus courant sur un projet ancien :

```
[Supabase]   ✗ Votre projet signe ses jetons avec l'ancien secret JWT, et SUPABASE_JWT_SECRET est vide : …
```

Copiez alors le secret depuis **Project Settings → JWT Keys → Legacy JWT
Secret** dans `SUPABASE_JWT_SECRET` (`server/.env`), puis
`docker compose up -d --force-recreate server`. Ne cliquez sur aucun bouton de
migration des clés sur cette page : cela changerait la connexion de toutes
vos applications.

<details>
<summary>Bon à savoir sur le partage du projet</summary>

- **Une seule liste d'utilisateurs** pour toutes vos applications : un compte
  créé ailleurs peut se connecter à Patrimonia, et inversement. Dans
  Patrimonia, chacun ne voit que ses propres scénarios.
- Supprimer un utilisateur dans Supabase (**Authentication → Users**) supprime
  aussi ses scénarios Patrimonia.
- Les tables de Patrimonia : **Table Editor**, sélecteur de schéma en haut à
  gauche → `tax`.
- Les e-mails d'inscription partent avec les réglages communs du projet. Si
  aucun n'arrive, voir « Dépannage » (SMTP).
- Offre gratuite : le projet se met en pause après une semaine sans aucune
  activité, toutes applications confondues.
- Ne copiez **jamais** la clé *service_role* (ou *secret*) : Patrimonia n'en a
  pas besoin, et elle ouvre toute la base.

</details>

## Étape 3 — Créer le dossier de l'application (VPS)

Tout se passe dans `~/patrimonia`, qui contiendra trois fichiers :

```
~/patrimonia/
├── docker-compose.yml   ← quels conteneurs lancer
├── server/
│   └── .env             ← vos réglages et clés secrètes
└── web/
    └── .env             ← l'adresse du projet Supabase
```

```bash
mkdir -p ~/patrimonia/server ~/patrimonia/web
cd ~/patrimonia
```

### 3a. `docker-compose.yml`

Collez ce bloc en entier dans le terminal : il crée le fichier.

```bash
cat > ~/patrimonia/docker-compose.yml <<'EOF'
services:
  server:
    image: ghcr.io/volvicpeche/fiscalmanagement-server:${IMAGE_TAG:-latest}
    restart: unless-stopped
    env_file:
      - server/.env
    expose:
      - "3000"
    volumes:
      - scenarios:/app/server/data

  web:
    image: ghcr.io/volvicpeche/fiscalmanagement-web:${IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      - server
    ports:
      - "80:80"
    env_file:
      - web/.env

volumes:
  scenarios:
EOF
```

C'est le `docker-compose.yml` à la racine du repo, **sans** ses blocs
`build:` : ils ne servent qu'à construire les images sur un poste de dev, et
le VPS se contente de les télécharger.

> ⚠️ Le workflow met à jour les **images**, jamais ce fichier. Si
> `docker-compose.yml` change dans le repo (nouveau service, nouveau volume…),
> reportez le changement ici à la main.

### 3b. `server/.env`

```bash
cat > ~/patrimonia/server/.env <<'EOF'
# Les 3 valeurs relevées à l'étape 2 bis :
SUPABASE_URL="<valeur A1>"
SUPABASE_ANON_KEY="<valeur A2>"
DATABASE_URL="<valeur A3, [YOUR-PASSWORD] remplacé par le mot de passe>"
# Laissez vide, sauf si le bilan de démarrage le demande (étape 2 bis, point C).
SUPABASE_JWT_SECRET=""

# Scénarios enregistrés, par utilisateur.
MAX_SCENARIOS=200

# Clés LLM des utilisateurs (bouton « Clé LLM » dans l'application) : chaque
# utilisateur saisit la sienne, chiffrée en base avec cette clé-ci.
# Générez-la une fois avec :  openssl rand -base64 32
# et SAUVEGARDEZ-LA : perdue ou changée, toutes les clés enregistrées
# deviennent illisibles et chacun doit ressaisir la sienne.
LLM_KEYS_SECRET="<résultat de openssl rand -base64 32>"

# Votre propre clé, pour les comptes listés ici seulement (e-mails séparés
# par des virgules), quand ils n'ont pas saisi de clé à eux. Vide : personne.
LLM_SERVER_KEY_EMAILS="vous@exemple.fr"
LLM_PROVIDER="anthropic"
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-opus-5"
# Analyses par jour sur VOTRE clé, par compte autorisé. Aucun quota pour qui
# utilise sa propre clé.
LLM_QUOTA_JOUR=20

# SeLoger, LeBonCoin et PAP bloquent les requêtes simples : le serveur ouvre
# alors un vrai Chrome dans le conteneur (sur un écran virtuel, Xvfb). Environ
# 10 s et quelques centaines de Mo de RAM par annonce. Mettez false pour vous
# en tenir au collage du texte de l'annonce.
LISTING_BROWSER_FALLBACK=true
EOF
chmod 600 ~/patrimonia/server/.env
```

- Pour un autre fournisseur que `anthropic` (OpenAI, Gemini, compatible
  OpenAI), les variables sont décrites dans `server/.env.example`.
- `chmod 600` : vous seul pouvez lire ce fichier. Il contient le mot de passe
  de la base de données et la clé qui chiffre les clés LLM des utilisateurs.
- Gardez une copie de `LLM_KEYS_SECRET` hors du VPS (gestionnaire de mots de
  passe) : la base Supabase ne contient que des clés chiffrées, inutilisables
  sans elle.
- Au démarrage, le conteneur `server` applique les migrations de la base,
  dans le schéma `tax` (créé au premier lancement, avec ses tables). Si `DATABASE_URL` est fausse,
  il s'arrête avec l'erreur dans `docker compose logs server`.
- Ce fichier ne doit **jamais** être commité : il n'existe que sur le VPS.

### 3c. `web/.env` : l'adresse du projet Supabase

nginx relaie la page de connexion vers Supabase. Sans ce fichier, le
conteneur `web` **refuse de démarrer**.

```bash
# La valeur A1 de l'étape 2 bis, la même que dans server/.env
echo 'SUPABASE_URL=<valeur A1>' > ~/patrimonia/web/.env
```

Il n'y a plus de mot de passe commun au site : chacun se connecte avec son
propre compte (étape 6). Si un ancien fichier `web/htpasswd` traîne, il ne
sert plus et peut être supprimé.

## Étape 4 — Créer une clé SSH de déploiement (votre PC)

GitHub Actions a besoin de sa propre clé pour se connecter au VPS. Ne
réutilisez pas votre clé personnelle : celle-ci pourra être révoquée seule.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/patrimonia_deploy -N "" -C "github-deploy"
ssh-copy-id -i ~/.ssh/patrimonia_deploy.pub ubuntu@<IP_DU_VPS>

# Vérifier qu'elle fonctionne
ssh -i ~/.ssh/patrimonia_deploy ubuntu@<IP_DU_VPS> 'echo ok'

# Afficher la clé PRIVÉE, à copier à l'étape 5
cat ~/.ssh/patrimonia_deploy
```

## Étape 5 — Renseigner les secrets (GitHub)

Dans le repo : **Settings → Secrets and variables → Actions → New repository
secret**, un secret par ligne :

| Secret | Valeur |
|---|---|
| `VPS_HOST` | l'IP du VPS |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | tout ce qu'affiche `cat ~/.ssh/patrimonia_deploy`, lignes `-----BEGIN…` et `-----END…` comprises |
| `VPS_APP_DIR` | `/home/ubuntu/patrimonia` |
| `VPS_PORT` | seulement si SSH n'écoute pas sur le port 22 |

Rien à créer pour `GITHUB_TOKEN` : GitHub le fournit à chaque exécution, et
le workflow s'en sert pour publier les images puis pour les télécharger
depuis le VPS.

## Étape 6 — Premier déploiement (GitHub)

Poussez sur `main`, ou lancez le workflow à la main : onglet **Actions →
Deploy → Run workflow**. Il enchaîne trois étapes, visibles dans l'onglet
Actions :

1. **ci** : construction et tests du moteur. Un échec arrête tout.
2. **build-and-push** : construit les images `server` et `web`, les envoie
   sur `ghcr.io/volvicpeche/fiscalmanagement-{server,web}`, étiquetées avec
   les 12 premiers caractères du commit et `latest`.
3. **deploy** : se connecte au VPS, puis `docker compose pull` et
   `docker compose up -d`.

Vérifiez depuis votre PC :

```bash
curl http://<IP_DU_VPS>/api/health     # → {"status":"ok"}
```

puis ouvrez `http://<IP_DU_VPS>/` dans le navigateur : la page d'accueil
s'affiche, et les outils rapides fonctionnent déjà sans compte. Créez votre
compte (bouton **Créer un compte**, en haut à droite), cliquez sur le lien reçu
par e-mail, connectez-vous : les simulateurs avancés se débloquent.

Si vous aviez des scénarios enregistrés avant le passage à Supabase, importez-les
maintenant (« Importer les anciens scénarios », plus bas).

> Au tout premier passage, GHCR crée les deux images en **privé**. Ça
> fonctionne tel quel : le workflow se connecte à GHCR avant de télécharger.

À ce stade l'application est en **HTTP**, sans chiffrement : vos données
circulent en clair. Passez en HTTPS dès que possible (section suivante).

---

## Passer en HTTPS

Il faut un **nom de domaine** : Let's Encrypt ne délivre pas de certificat
pour une adresse IP nue. Le principe : **Caddy**, installé directement sur le
VPS, reçoit tout le trafic sur les ports 80 et 443, obtient et renouvelle le
certificat seul, redirige le HTTP vers le HTTPS, et transmet au conteneur
`web`, qui n'est plus joignable que depuis le VPS lui-même.

```
Internet ──443──► Caddy (certificat) ──► 127.0.0.1:8080 ──► web (nginx) ──► server
         ──80───► Caddy : redirection vers https://
```

Le port 80 reste ouvert, et c'est voulu : Let's Encrypt s'en sert pour
vérifier que le domaine est bien à vous, et Caddy y renvoie vers le HTTPS
quiconque tape l'adresse sans `https://`. Aucune page n'y est servie en clair.

Dans la suite, remplacez `<DOMAINE>` par votre domaine (ex. `monpatrimonia.fr`).
L'application peut vivre sur le domaine nu (`monpatrimonia.fr`) ou sur un
sous-domaine (`app.monpatrimonia.fr`) : les commandes sont les mêmes.

### H1. DNS (chez votre registrar)

Dans la zone DNS du domaine :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `@` (domaine nu) | `<IP_DU_VPS>` |
| `CNAME` | `www` | `<DOMAINE>.` (point final compris) |

- **Supprimez tout autre enregistrement `A` ou `AAAA`** sur `@` et `www` : les
  registrars créent souvent une page de parking par défaut. Un `AAAA` qui
  pointe ailleurs fait échouer Let's Encrypt, qui essaie l'IPv6 en premier.
- Ne créez **pas** d'`AAAA` vers le VPS pour l'instant : sa configuration IPv6
  n'est pas couverte par ce guide.
- Pour un sous-domaine, un seul `A` : nom `app`, valeur `<IP_DU_VPS>`.

Vérifiez depuis votre PC, jusqu'à obtenir l'IP du VPS (quelques minutes à
quelques heures selon le registrar) :

```bash
dig +short A <DOMAINE>        # → <IP_DU_VPS>
dig +short AAAA <DOMAINE>     # → rien
dig +short www.<DOMAINE>      # → <DOMAINE>. puis <IP_DU_VPS>
```

**N'allez pas plus loin tant que le DNS ne répond pas** : Caddy tenterait
d'obtenir le certificat, échouerait, et Let's Encrypt limite le nombre
d'échecs par heure.

### H2. Ne publier `web` qu'en local (VPS)

```bash
cd ~/patrimonia
sed -i 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml
grep 8080 docker-compose.yml          # → - "127.0.0.1:8080:80"
docker compose up -d

# Le site répond en local, plus depuis Internet
curl -s http://127.0.0.1:8080/api/health     # → {"status":"ok"}
```

À partir d'ici, le site est **coupé** depuis Internet jusqu'à l'étape H4.

### H3. Installer Caddy (VPS)

Depuis le dépôt officiel de Caddy, pour avoir la dernière version (celle
d'Ubuntu est souvent en retard) :

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

caddy version        # → v2.x
```

Caddy tourne comme service système (`caddy.service`) : il redémarre avec le
VPS et a le droit d'écouter sur les ports 80 et 443 sans être root.

### H4. Configurer Caddy (VPS)

Écrivez la configuration, en remplaçant `monpatrimonia.fr` sur la **première
ligne** par votre domaine :

```bash
DOMAINE=monpatrimonia.fr

sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
$DOMAINE {
	# Le conteneur web (nginx) : application, limites de débit, API.
	reverse_proxy 127.0.0.1:8080

	encode zstd gzip

	# Le navigateur n'essaiera plus le HTTP pour ce domaine pendant un an.
	# N'ajoutez includeSubDomains que si TOUS vos sous-domaines sont en HTTPS.
	header Strict-Transport-Security "max-age=31536000"

	log {
		output file /var/log/caddy/patrimonia.log {
			roll_size 10MiB
			roll_keep 5
		}
	}
}

www.$DOMAINE {
	redir https://$DOMAINE{uri} permanent
}
CADDY

sudo cat /etc/caddy/Caddyfile                 # relire : votre domaine doit y figurer 3 fois
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile   # → Valid configuration
sudo systemctl reload caddy
```

- Pas de ligne `tls` ni d'adresse e-mail : Caddy obtient le certificat tout
  seul dès qu'un nom de domaine figure en tête de bloc, et le renouvelle
  environ 30 jours avant son expiration.
- Pour un sous-domaine sans `www`, supprimez le bloc `www.…` du fichier.
- Aucune limite de taille ni délai d'attente côté Caddy : ce sont ceux de
  nginx (conteneur `web`) qui s'appliquent.

### H5. Pare-feu (VPS et OVH)

```bash
sudo ufw allow 443/tcp
sudo ufw allow 443/udp      # HTTP/3, facultatif mais gratuit
sudo ufw status             # → 22, 80, 443 autorisés

# Le réglage de l'étape 2 n'est plus nécessaire : c'est Caddy qui écoute sur 80
sudo rm /etc/sysctl.d/99-podman-port80.conf
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=1024
```

Si le pare-feu de l'espace client OVH est actif, ouvrez-y aussi le **443**
(TCP, et UDP pour HTTP/3).

### H6. Vérifier

Depuis votre PC :

```bash
curl -sI http://<DOMAINE>/ | head -3       # → 308, Location: https://<DOMAINE>/
curl -s https://<DOMAINE>/api/health       # → {"status":"ok"}
curl -sI https://<DOMAINE>/ | grep -i -E '^HTTP|strict-transport'
                                           # → 200 et HSTS
curl -s https://<DOMAINE>/api/simulations  # → {"error":"Connexion requise."}
curl -sI https://www.<DOMAINE>/ | head -3  # → 301 vers https://<DOMAINE>/
```

Puis ouvrez `https://<DOMAINE>/` : cadenas dans la barre d'adresse, puis
page d'accueil de l'application.

Dans Supabase (**Authentication → URL Configuration → Redirect URLs**),
ajoutez `https://<DOMAINE>/auth/confirmer**` si vous aviez commencé en HTTP.

Si le certificat n'arrive pas, les journaux de Caddy disent pourquoi :
`sudo journalctl -u caddy -f`.

| Message dans les journaux | Cause et solution |
|---|---|
| `no such host`, `NXDOMAIN` | le DNS ne répond pas encore : attendre, revérifier avec `dig` |
| `connection refused`, `timeout during connect` | port 80 ou 443 fermé : `ufw` ou pare-feu OVH |
| `Invalid response from http://…/.well-known/acme-challenge` | le domaine pointe ailleurs, souvent un `AAAA` de parking resté chez le registrar |
| `too many failed authorizations`, `rateLimited` | trop d'essais ratés : corriger la cause, attendre une heure, puis `sudo systemctl restart caddy` |
| `bind: address already in use` sur le port 80 | le conteneur `web` publie encore le port 80 : l'étape H2 n'a pas été appliquée |
| `502 Bad Gateway` dans le navigateur | le conteneur `web` est arrêté : `docker compose ps`, puis `docker compose up -d` |

### H7. Et ensuite

- **Rien à faire pour les renouvellements** : Caddy s'en charge et garde ses
  certificats dans `/var/lib/caddy`, hors des conteneurs. Les déploiements
  (`docker compose up -d`) n'y touchent pas.
- **Les limites de débit de nginx deviennent globales** : toutes les requêtes
  arrivent désormais de Caddy, donc de la même adresse. Pour un usage
  personnel, c'est sans conséquence.
- **La connexion reste indispensable** : le HTTPS protège le trajet, les
  comptes Supabase protègent l'accès.

---

## Au quotidien

Toutes ces commandes se lancent **sur le VPS**, dans `~/patrimonia`.

| Besoin | Commande |
|---|---|
| Déployer une nouvelle version | rien : pousser sur `main` suffit |
| Voir l'état des conteneurs | `docker compose ps` |
| Lire les journaux | `docker compose logs -f server` (ou `web`) |
| Prendre en compte un `.env` modifié | `docker compose up -d --force-recreate server` |
| Redémarrer | `docker compose restart` |
| Revenir à une version précédente | `IMAGE_TAG=<12 caractères du commit> docker compose pull`, puis `IMAGE_TAG=<même valeur> docker compose up -d` |
| Voir, bloquer ou supprimer un compte | Supabase → **Authentication → Users**. Supprimer un compte supprime ses scénarios |
| Modifier un quota (`LLM_QUOTA_JOUR`, `MAX_SCENARIOS`) | éditer `server/.env`, puis `docker compose up -d --force-recreate server` |

Un `docker compose restart` seul ne relit pas `server/.env` : il faut
recréer le conteneur, d'où le `--force-recreate`. Pour un retour en arrière,
les étiquettes disponibles sont listées sur la page GitHub du repo, rubrique
**Packages**.

## Sauvegarder les scénarios

Les scénarios sont dans la base Supabase, table `tax.scenarios`, une ligne par
scénario et par utilisateur. Supabase en fait une sauvegarde quotidienne,
gardée 7 jours sur les offres payantes. L'offre gratuite n'en garde pas : faites
les vôtres, depuis votre PC ou le VPS :

```bash
# Chaîne du « Session pooler », comme DATABASE_URL
pg_dump "<DATABASE_URL>" --schema=tax -Fc \
  -f scenarios-$(date +%F).dump
```

Sur l'offre gratuite, Supabase **met en pause** un projet resté une semaine sans
aucune requête. Il suffit de le relancer depuis le tableau de bord, sans perte
de données.

## Migrer une installation existante (ancienne version avec mot de passe)

Le déploiement automatique met à jour les images, **pas** les fichiers du VPS.
Avant de pousser cette version sur `main`, sur un VPS déjà installé :

1. Préparez le projet Supabase (étape 2 bis).
2. Ajoutez les variables Supabase à `~/patrimonia/server/.env` (étape 3b) et
   créez `~/patrimonia/web/.env` (étape 3c).
3. Dans `~/patrimonia/docker-compose.yml`, service `web`, remplacez

   ```yaml
       volumes:
         - ./web/htpasswd:/etc/nginx/auth/htpasswd:ro
   ```

   par

   ```yaml
       env_file:
         - web/.env
   ```

   Gardez le volume `scenarios` du service `server` : il contient les anciens
   scénarios, à importer ensuite.
4. Poussez sur `main` (ou relancez le workflow **Deploy**), créez votre
   compte, puis importez vos scénarios (section suivante).

Si le déploiement passe avant ces étapes, les conteneurs refusent de démarrer
avec un message explicite dans `docker compose logs`, et l'application
n'est pas ouverte à tous. Faites les étapes, puis `docker compose up -d`.

## Importer les anciens scénarios

Avant Supabase, les scénarios étaient des fichiers JSON dans le volume
`scenarios` du VPS. Pour les rattacher à votre compte, une seule fois :

1. Créez votre compte dans l'application et connectez-vous une fois.
2. Relevez son identifiant dans Supabase → **Authentication → Users**,
   colonne *UID* (de la forme `3f2504e0-4f89-41d3-…`).
3. Sur le VPS :

```bash
cd ~/patrimonia
docker compose exec server node dist/server/src/scripts/import-scenarios.js --user <UID>
```

Le script liste les scénarios importés, ceux déjà présents et les fichiers
illisibles. Vous pouvez le relancer sans créer de doublons. Vérifiez dans
l'application que tout y est, puis, si vous voulez, retirez le volume :
supprimez les deux lignes `volumes:` du service `server` et le bloc `volumes:`
final de `docker-compose.yml`, `docker compose up -d`, puis
`docker volume rm patrimonia_scenarios`.

## Dépannage

| Symptôme | Cause probable et solution |
|---|---|
| `Cannot connect to the Docker daemon at unix:///run/user/1000/podman/podman.sock` | le socket Podman n'est pas actif : `systemctl --user enable --now podman.socket`, puis relancer le job **deploy** |
| `docker compose` : commande inconnue | `podman-compose` n'est pas installé : `sudo apt install -y podman-compose` |
| `permission denied` en écoutant sur le port 80 | le réglage `sysctl` de l'étape 2 manque, ou vous êtes passé en HTTPS sans modifier `ports` en `127.0.0.1:8080:80` |
| Les conteneurs disparaissent quand vous quittez SSH | `sudo loginctl enable-linger ubuntu` n'a pas été fait |
| Plus rien après un redémarrage du VPS | `systemctl --user enable --now podman-restart.service` n'a pas été fait |
| `unauthorized` au `pull` en le lançant à la main | vous n'êtes pas connecté à GHCR sur le VPS. Le workflow le fait tout seul ; à la main : `podman login ghcr.io` avec votre nom GitHub et un jeton `read:packages` |
| L'étape **deploy** échoue en `ssh: handshake failed` | secret `VPS_SSH_KEY` incomplet (il faut les lignes BEGIN/END), ou la clé publique n'est pas dans `~/.ssh/authorized_keys` |
| Le VPS rame pendant l'analyse d'une annonce | Chrome consomme de la mémoire : vérifiez que le swap est actif (`swapon --show`), ou mettez `LISTING_BROWSER_FALLBACK=false` |
| Le conteneur `web` s'arrête aussitôt, journaux : `SUPABASE_URL absente` ou `invalide` | `~/patrimonia/web/.env` manque (étape 3c), ou `docker-compose.yml` n'a pas l'`env_file` du service `web`. L'URL s'écrit sans barre finale |
| Le conteneur `server` s'arrête aussitôt, journaux : `SUPABASE_URL absente` ou `DATABASE_URL absente` | variables manquantes dans `server/.env` (étape 3b), puis `docker compose up -d --force-recreate server` |
| Journaux de `server` : `P1001: Can't reach database server` | `DATABASE_URL` n'est pas celle du **Session pooler**, le mot de passe est faux, ou le projet Supabase est en pause (tableau de bord → *Restore*) |
| Un problème avec Supabase, quel qu'il soit | commencez par `docker compose logs server \| grep Supabase` : le bilan de démarrage dit ce qui manque et où le trouver (étape 2 bis, point C) |
| « Application indisponible » au chargement de la page | `server` est arrêté ou `SUPABASE_ANON_KEY` est vide : `docker compose logs server` |
| « E-mail ou mot de passe incorrect » alors qu'ils sont bons | le compte n'est pas encore confirmé (lien de l'e-mail), ou il a été supprimé dans Supabase |
| L'e-mail de confirmation n'arrive jamais | regardez les indésirables. Sinon, le projet utilise sans doute l'envoi intégré de Supabase, limité à quelques e-mails par heure et aux membres de votre organisation Supabase : branchez un vrai service d'envoi (Brevo, Resend, Postmark… offres gratuites) dans **Authentication → Emails → SMTP Settings**. Ce réglage sert aussi à vos autres applications |
| Le lien de l'e-mail mène à la *Site URL* d'une autre application | `https://<DOMAINE>/auth/confirmer**` manque dans les *Redirect URLs*, ou sans ses `**` (étape 2 bis, point B) : Supabase retombe alors sur la *Site URL* |
| Le lien de l'e-mail ne s'ouvre pas depuis le poste de l'entreprise | il passe par `supabase.co`, que le proxy bloque : ouvrez-le depuis un autre appareil (téléphone). L'adresse est confirmée, il ne reste qu'à se connecter depuis le poste |
| « Ouvrez ce lien dans le navigateur où vous avez fait la demande » | lien de mot de passe oublié ouvert dans un autre navigateur : refaites la demande depuis celui où vous voulez vous connecter |
| Connexion réussie, puis « Session expirée » à chaque action | le projet signe ses jetons avec l'ancien secret : renseignez `SUPABASE_JWT_SECRET` (étape 2 bis, point C), puis `docker compose up -d --force-recreate server` |
| Erreur 502 sur la connexion, journaux de `web` : `could not be resolved` | le conteneur `web` n'arrive pas à résoudre le nom de Supabase : vérifiez le DNS du VPS (`resolvectl status`) |
| « Quota de … analyses par jour atteint » | quota sur votre clé serveur (`LLM_QUOTA_JOUR`), par compte autorisé, remis à zéro à minuit UTC. L'utilisateur peut aussi saisir sa propre clé |
| « Renseignez votre clé API dans « Clé LLM » » | l'utilisateur n'a pas de clé à lui et son e-mail n'est pas dans `LLM_SERVER_KEY_EMAILS` : il la saisit via le bouton « Clé LLM » |
| « L'enregistrement des clés API n'est pas configuré » | `LLM_KEYS_SECRET` absente ou invalide dans `server/.env` (32 octets en base64 : `openssl rand -base64 32`) |
| « Votre clé API enregistrée ne peut plus être lue » | `LLM_KEYS_SECRET` a changé : restaurez l'ancienne valeur, ou chacun ressaisit sa clé |
| Erreur 429 (« Too Many Requests ») | une limite de débit a été atteinte (voir « Sécurité ») : attendez une minute |

---

## Sécurité

Ce que l'application met en place, et ce qu'il vous reste à faire.

**Côté application** (dans les images, rien à configurer) :

- **Un compte par personne**, géré par Supabase : mots de passe hachés chez
  Supabase, jamais vus par le serveur ; adresse e-mail confirmée avant la
  première connexion. Chaque appel à l'API porte un jeton signé par Supabase,
  vérifié par le serveur ; sans jeton valide, seules `/api/health` et
  `/api/config` répondent.
- **Chacun ne voit que ses scénarios** : le serveur filtre chaque requête sur
  l'utilisateur connecté, et répond « introuvable » pour le scénario d'un autre.
- **Tables fermées à l'API publique de Supabase** : elles sont dans le schéma
  `tax`, que l'API publique n'expose pas, et la clé *anon*, publique, n'y a
  de toute façon aucun droit (RLS activée, aucun privilège, même sur le
  schéma). Seul le serveur, avec le mot de passe de la base, y accède.
- **Chacun paie son LLM** : l'analyse d'annonce et la lecture de
  justificatifs utilisent la clé API que l'utilisateur a saisie (bouton « Clé
  LLM »). Elle est chiffrée en base (AES-256-GCM, avec `LLM_KEYS_SECRET`) et
  ne revient jamais au navigateur : seuls ses 4 derniers caractères
  s'affichent. Votre clé ne sert qu'aux comptes de `LLM_SERVER_KEY_EMAILS`,
  avec un quota de 20 analyses par jour (`LLM_QUOTA_JOUR`).
- **API « compatible OpenAI »** : l'adresse saisie par l'utilisateur doit être
  en https, et le serveur refuse toute adresse interne (réseau privé,
  métadonnées du VPS), à l'enregistrement et à chaque appel, sans suivre de
  redirection.
- **200 scénarios par compte** (`MAX_SCENARIOS`) : l'inscription est ouverte,
  personne ne peut remplir la base.
- **Limites de débit par adresse IP** : 20 requêtes/s pour le site,
  30 tentatives de connexion par minute, 5 analyses d'annonce par minute
  (chacune peut lancer Chrome et consommer votre clé LLM), 30 enregistrements
  ou suppressions de scénarios par minute. Supabase applique en plus ses
  propres limites.
- **Un seul Chrome à la fois**, avec au plus une annonce en attente : au-delà,
  la demande est refusée tout de suite au lieu de saturer la mémoire.
- **Pas d'accès au réseau interne via l'analyse d'annonce** : le serveur vérifie
  les adresses IP réellement obtenues (pas seulement le nom saisi), à chaque
  redirection et pour chaque ressource que charge Chrome.
- **Requêtes limitées à 1 Mo**, 100 Mo pour les justificatifs.
- **En-têtes de sécurité** : politique de contenu stricte (CSP), affichage dans
  une iframe interdit, version de nginx masquée.

Toutes les tentatives de connexion passent par le VPS : pour Supabase, elles
viennent toutes de la même adresse. Ses limites par IP (quelques dizaines de
connexions toutes les 5 minutes) s'appliquent donc à l'ensemble des
utilisateurs. C'est sans conséquence pour quelques personnes. Au-delà, relevez
ces limites dans **Authentication → Rate Limits**.

**Côté VPS** (à faire une fois) :

```bash
# SSH par clé uniquement. Vérifiez D'ABORD, depuis un second terminal, que
# vous vous connectez sans mot de passe ; sinon vous vous enfermeriez dehors.
echo -e 'PasswordAuthentication no\nKbdInteractiveAuthentication no' | sudo tee /etc/ssh/sshd_config.d/99-hardening.conf
sudo systemctl reload ssh

# Bannir les adresses qui insistent sur SSH
sudo apt install -y fail2ban

# Mises à jour de sécurité automatiques d'Ubuntu (souvent déjà actif)
sudo apt install -y unattended-upgrades
```

Pour aller plus loin, vous pouvez n'ouvrir le port 80 qu'à votre propre IP :
`sudo ufw delete allow 80/tcp`, puis
`sudo ufw allow from <VOTRE_IP> to any port 80 proto tcp`. `ufw` filtre bien
ce port, car Podman sans root l'ouvre comme un programme ordinaire du VPS.
En contrepartie, un changement d'IP (box, 4G) vous coupe l'accès. Une fois en
HTTPS, ne le faites pas : Let's Encrypt doit joindre le port 80 pour
renouveler le certificat.

**Tant que le site n'est pas en HTTPS**, les mots de passe et vos données
circulent en clair : voir la section « Passer en HTTPS ».

---

## À propos des workflows proposés par GitHub

Les trois workflows suggérés sur la page du repo (**Webpack**, **Deno**,
**SLSA generic generator**) ne correspondent pas au projet : il utilise Vite
(pas Webpack) et Node.js (pas Deno), et SLSA sert à attester la provenance
d'artefacts publiés, sans rapport avec le déploiement. `ci.yml` et
`deploy.yml` les remplacent.
