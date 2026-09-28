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
| `LLM_PROVIDER` | Non (defaut `anthropic`) | Alimente le bouton « Analyser » de l'onglet *Location saisonniere* (extraction d'une annonce + estimation saisonniere). Sans cle valide pour le fournisseur choisi, ce bouton renvoie une erreur mais le reste de l'app (comparateur SCI/Holding, saisie manuelle des saisons) fonctionne normalement — rien d'autre dans l'app n'appelle un LLM. |
| `SUPABASE_URL` | **Oui** | Projet Supabase : comptes utilisateurs. Sans elle, le serveur refuse de demarrer. |
| `SUPABASE_ANON_KEY` | **Oui** | Cle publique du projet, transmise au navigateur pour la page de connexion. |
| `SUPABASE_JWT_SECRET` | Selon le projet | Ancien secret JWT, seulement si le projet signe encore ses jetons en HS256 (voir `DEPLOY.md`, etape 2 bis). |
| `DATABASE_URL` | **Oui** | Postgres du projet Supabase (session pooler) : scenarios enregistres, dans le schema dedie `tax`. En local, un Postgres simple convient (voir ci-dessous). |
| `LLM_KEYS_SECRET` | Pour les cles LLM | Chiffre les cles API que chaque utilisateur saisit dans l'application (bouton « Cle LLM »). `openssl rand -base64 32`. A sauvegarder. |
| `LLM_SERVER_KEY_EMAILS` | Non | Comptes autorises a utiliser la cle LLM du serveur (ci-dessous) quand ils n'ont pas la leur. Vide : personne. |
| `LLM_QUOTA_JOUR`, `MAX_SCENARIOS` | Non | Analyses par jour sur la cle du serveur, et nombre de scenarios, par utilisateur. |

**Chaque utilisateur utilise sa propre cle LLM**, saisie dans l'application (bouton « Cle LLM ») : Anthropic, OpenAI, Gemini ou une API compatible OpenAI. La lecture des justificatifs (onglet Frontalier) demande une cle Anthropic.

La cle du serveur, ci-dessous, ne sert qu'aux comptes de `LLM_SERVER_KEY_EMAILS`. `LLM_PROVIDER` choisit le fournisseur, chacun avec sa propre cle/modele dans `server/.env.example`.

| `LLM_PROVIDER` | Fournisseur | Ou creer la cle | Variables a renseigner |
| --- | --- | --- | --- |
| `anthropic` (defaut) | Claude | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| `openai` | ChatGPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `gemini` | Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `openai_compatible` | Qwen (DashScope), DeepSeek, Groq, Mistral, un serveur Ollama/vLLM local, ou tout autre endpoint compatible OpenAI | selon le fournisseur | `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL` |

Toutes ces API sont payantes et distinctes d'un abonnement grand public (Claude.ai, ChatGPT Plus, Gemini...) — chacune necessite sa propre facturation activee sur la console du fournisseur. Une fois `server/.env` renseigne, **redemarrez** `npm run dev` : le fichier n'est relu qu'au demarrage du process.

### Base de donnees en local

Le plus simple est d'utiliser un projet Supabase de developpement : `DATABASE_URL` pointe vers sa base et les migrations s'appliquent avec `npm run db:deploy --workspace=server`. Pour les tests, un Postgres local suffit :

```bash
psql "$DATABASE_URL" -f server/prisma/test/supabase-auth-stub.sql   # ce que Supabase fournit (auth.users)
npm run db:deploy --workspace=server
```

## Lancer l'application

```bash
npm run dev:server   # API Fastify sur http://localhost:3000
npm run dev:client   # SPA Vite sur http://localhost:5173
```

## Tests

```bash
npm test             # suite du serveur ; les tests de base de donnees sont ignores sans DATABASE_URL
```
