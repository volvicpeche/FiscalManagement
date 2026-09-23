#!/bin/sh
# Refuse de démarrer sans fichier de mots de passe.
#
# nginx.conf protège tout le site par auth_basic. Si le fichier manque, nginx
# démarrerait quand même et répondrait 500 à chaque page — ou, pire, un
# fichier vide laisserait penser que le site est protégé. Mieux vaut un
# conteneur arrêté, avec un message clair dans les journaux.
#
# Docker crée un DOSSIER vide quand le fichier à monter n'existe pas sur
# l'hôte : d'où le test -f, et pas seulement -e.
set -e

FICHIER=/etc/nginx/auth/htpasswd

if [ ! -f "$FICHIER" ] || ! grep -q ':' "$FICHIER"; then
  echo "ERREUR : $FICHIER absent ou vide." >&2
  echo "Creez ~/patrimonia/web/htpasswd sur le VPS (voir DEPLOY.md, etape 3c), puis relancez." >&2
  exit 1
fi
