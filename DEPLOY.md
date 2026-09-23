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
construites sur GHCR (le registre d'images de GitHub). Il n'y a pas de base de
données : les scénarios enregistrés sont des fichiers JSON, conservés dans un
volume (voir « Sauvegarder les scénarios »).

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

Trois réglages, à faire **une seule fois** :

```bash
# 1. Autoriser Podman sans root à écouter sur le port 80
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-podman-port80.conf
sudo sysctl --system

# 2. Garder les conteneurs actifs quand vous vous déconnectez de SSH
sudo loginctl enable-linger ubuntu

# 3. Relancer les conteneurs au redémarrage du VPS
systemctl --user enable --now podman-restart.service
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

## Étape 3 — Créer le dossier de l'application (VPS)

Tout se passe dans `~/patrimonia`, qui contiendra trois fichiers :

```
~/patrimonia/
├── docker-compose.yml   ← quels conteneurs lancer
├── server/
│   └── .env             ← vos réglages et clés secrètes
└── web/
    └── htpasswd         ← le mot de passe du site
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
    volumes:
      - ./web/htpasswd:/etc/nginx/auth/htpasswd:ro

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
# Bouton « Analyser une annonce ». Laissez la clé vide si vous ne l'utilisez
# pas : le reste de l'application fonctionne sans.
LLM_PROVIDER="anthropic"
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-opus-5"

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
- `chmod 600` : vous seul pouvez lire ce fichier.
- Ce fichier ne doit **jamais** être commité : il n'existe que sur le VPS.

### 3c. `web/htpasswd` : le mot de passe du site

Tout le site est protégé par un identifiant et un mot de passe, demandés par
le navigateur à la première visite. Sans ce fichier, le conteneur `web`
**refuse de démarrer** : c'est voulu, pour que le site ne se retrouve jamais
ouvert à tous par erreur.

```bash
# Remplacez « florian » par l'identifiant de votre choix ; le mot de passe
# est demandé deux fois, sans s'afficher.
printf 'florian:%s\n' "$(openssl passwd -apr1)" > ~/patrimonia/web/htpasswd
chmod 644 ~/patrimonia/web/htpasswd
```

- Le fichier ne contient qu'une **empreinte** du mot de passe, jamais le mot de
  passe lui-même.
- `chmod 644` et non `600` : le serveur nginx du conteneur tourne sous son
  propre utilisateur et doit pouvoir le lire.
- Choisissez un mot de passe long (4 mots au hasard, par exemple) : il est
  la seule barrière entre Internet et vos scénarios.
- Tant que le site est en HTTP, ce mot de passe circule **en clair** à chaque
  requête. Passez en HTTPS dès que possible, et ne réutilisez pas un mot de
  passe qui sert ailleurs.

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

puis ouvrez `http://<IP_DU_VPS>/` dans le navigateur.

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

Le port 80 reste ouvert, et c'est voulu : Let's Encrypt s'en sert pour
vérifier que le domaine est bien à vous, et Caddy y renvoie vers le HTTPS
quiconque tape l'adresse sans `https://`. Aucune page n'y est servie en clair.

1. **Chez votre registrar** : un enregistrement `A` qui pointe
   `patrimonia.votre-domaine.fr` vers l'IP du VPS. Attendez qu'il réponde :
   `ping patrimonia.votre-domaine.fr` doit afficher l'IP du VPS.

2. **VPS** — ne publier `web` qu'en local, sur le port 8080 :

   ```bash
   cd ~/patrimonia
   sed -i 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml
   docker compose up -d
   ```

3. **VPS** — installer et configurer Caddy :

   ```bash
   sudo apt install -y caddy
   sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
   patrimonia.votre-domaine.fr {
       reverse_proxy 127.0.0.1:8080
   }
   EOF
   sudo systemctl reload caddy
   ```

   Le service Caddy fourni par Ubuntu a le droit d'écouter sur les ports 80
   et 443 sans être root : le réglage `sysctl` de l'étape 2 ne sert plus.

4. **VPS** — ouvrir le 443 et retirer le réglage devenu inutile :

   ```bash
   sudo ufw allow 443/tcp
   sudo rm /etc/sysctl.d/99-podman-port80.conf
   sudo sysctl -w net.ipv4.ip_unprivileged_port_start=1024
   ```

   Ouvrez aussi le **443** dans le pare-feu OVH s'il est actif.

5. **Vérifier** : `https://patrimonia.votre-domaine.fr/` s'ouvre avec le
   cadenas, et `http://…` redirige vers `https://…`. Si le certificat tarde,
   `sudo journalctl -u caddy -f` montre pourquoi (DNS pas encore propagé,
   port fermé…).

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
| Changer le mot de passe du site | refaire la commande de l'étape 3c, puis `docker compose restart web` |

Un `docker compose restart` seul ne relit pas `server/.env` : il faut
recréer le conteneur, d'où le `--force-recreate`. Pour un retour en arrière,
les étiquettes disponibles sont listées sur la page GitHub du repo, rubrique
**Packages**.

## Sauvegarder les scénarios

Les scénarios enregistrés sont des fichiers JSON dans le volume `scenarios`,
monté sur `/app/server/data` dans le conteneur `server`. Chaque déploiement
remplace le conteneur, **pas** le volume : les scénarios survivent.

```bash
cd ~/patrimonia
docker volume ls      # le nom est préfixé par le dossier : patrimonia_scenarios

# Sauvegarde dans ~/patrimonia/scenarios-AAAA-MM-JJ.tar.gz
docker run --rm -v patrimonia_scenarios:/data -v "$PWD":/backup docker.io/library/alpine \
  tar czf /backup/scenarios-$(date +%F).tar.gz -C /data .
```

Rapatriez ensuite l'archive sur votre PC :
`scp ubuntu@<IP_DU_VPS>:patrimonia/scenarios-*.tar.gz .`

> ⚠️ `docker compose down` garde le volume. `docker compose down -v` le
> **supprime**, et tous les scénarios avec. N'utilisez jamais `-v` sur le VPS.

## Dépannage

| Symptôme | Cause probable et solution |
|---|---|
| `docker compose` : commande inconnue | `podman-compose` n'est pas installé : `sudo apt install -y podman-compose` |
| `permission denied` en écoutant sur le port 80 | le réglage `sysctl` de l'étape 2 manque, ou vous êtes passé en HTTPS sans modifier `ports` en `127.0.0.1:8080:80` |
| Les conteneurs disparaissent quand vous quittez SSH | `sudo loginctl enable-linger ubuntu` n'a pas été fait |
| Plus rien après un redémarrage du VPS | `systemctl --user enable --now podman-restart.service` n'a pas été fait |
| `unauthorized` au `pull` en le lançant à la main | vous n'êtes pas connecté à GHCR sur le VPS. Le workflow le fait tout seul ; à la main : `podman login ghcr.io` avec votre nom GitHub et un jeton `read:packages` |
| L'étape **deploy** échoue en `ssh: handshake failed` | secret `VPS_SSH_KEY` incomplet (il faut les lignes BEGIN/END), ou la clé publique n'est pas dans `~/.ssh/authorized_keys` |
| Le VPS rame pendant l'analyse d'une annonce | Chrome consomme de la mémoire : vérifiez que le swap est actif (`swapon --show`), ou mettez `LISTING_BROWSER_FALLBACK=false` |
| Le conteneur `web` s'arrête aussitôt, journaux : `htpasswd absent ou vide` | le fichier de l'étape 3c manque, ou `docker-compose.yml` n'a pas la ligne `volumes` du service `web` |
| Erreur 500 sur toutes les pages, journaux de `web` : `Permission denied` sur `htpasswd` | `chmod 644 ~/patrimonia/web/htpasswd`, puis `docker compose restart web` |
| Erreur 429 (« Too Many Requests ») | une limite de débit a été atteinte (voir « Sécurité ») : attendez une minute |

---

## Sécurité

Ce que l'application met en place, et ce qu'il vous reste à faire.

**Côté application** (dans les images, rien à configurer) :

- **Mot de passe sur tout le site** (étape 3c). Seule la sonde `/api/health`
  reste publique : elle ne répond que `{"status":"ok"}`.
- **Limites de débit par adresse IP**, appliquées avant même la vérification
  du mot de passe, donc aussi aux tentatives pour le deviner :
  20 requêtes/s pour le site, 5 analyses d'annonce par minute (chacune peut
  lancer Chrome et consommer votre clé LLM), 30 enregistrements ou
  suppressions de scénarios par minute.
- **Un seul Chrome à la fois**, avec au plus une annonce en attente : au-delà,
  la demande est refusée tout de suite au lieu de saturer la mémoire.
- **Pas d'accès au réseau interne via l'analyse d'annonce** : le serveur vérifie
  les adresses IP réellement obtenues (pas seulement le nom saisi), à chaque
  redirection et pour chaque ressource que charge Chrome.
- **200 scénarios au plus** (variable `MAX_SCENARIOS` dans `server/.env`) et
  requêtes limitées à 1 Mo : impossible de remplir le disque.
- **En-têtes de sécurité** : politique de contenu stricte (CSP), affichage dans
  une iframe interdit, version de nginx masquée.

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
En contrepartie, un changement d'IP (box, 4G) vous coupe l'accès.

**Reste le HTTP** : tant que le site n'est pas en HTTPS, le mot de passe et vos
données circulent en clair. C'est le prochain chantier (section « Passer en
HTTPS »).

---

## À propos des workflows proposés par GitHub

Les trois workflows suggérés sur la page du repo (**Webpack**, **Deno**,
**SLSA generic generator**) ne correspondent pas au projet : il utilise Vite
(pas Webpack) et Node.js (pas Deno), et SLSA sert à attester la provenance
d'artefacts publiés, sans rapport avec le déploiement. `ci.yml` et
`deploy.yml` les remplacent.
