# Patrimonia

Simulateur patrimonial et fiscal — structures locatives (SCI/Holding) et location saisonniere (LMP), conforme au droit fiscal francais 2026. Voir `CLAUDE.md` pour l'architecture detaillee.

## Installation

```bash
npm install --workspaces
```

## Configuration

Le serveur charge automatiquement `server/.env` au demarrage (via `dotenv/config`).

```bash
cp server/.env.example server/.env
```

| Variable | Requise | Usage |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Non | Alimente le bouton « Analyser » de l'onglet *Location saisonniere* (extraction d'une annonce + estimation saisonniere via l'API Claude). Sans elle, ce bouton renvoie une erreur mais le reste de l'app (comparateur SCI/Holding, saisie manuelle des saisons) fonctionne normalement. |
| `DATABASE_URL` | Non | Reservee pour la persistance (Prisma) — pas encore utilisee par le serveur. |

Pour obtenir une cle `ANTHROPIC_API_KEY` : creez-en une sur [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (compte Anthropic Console avec facturation active — API payante, distincte d'un abonnement Claude.ai). Collez-la dans `server/.env`, puis **redemarrez** `npm run dev` : le fichier n'est relu qu'au demarrage du process.

## Lancer l'application

```bash
npm run dev:server   # API Fastify sur http://localhost:3000
npm run dev:client   # SPA Vite sur http://localhost:5173
```

## Tests

```bash
npm test             # suite du moteur (server/)
```
