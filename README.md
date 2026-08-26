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
| `DATABASE_URL` | Non | Reservee pour la persistance (Prisma) — pas encore utilisee par le serveur. |

L'analyse d'annonce est **agnostique au fournisseur** : `LLM_PROVIDER` choisit lequel utiliser, chacun avec sa propre cle/modele dans `server/.env.example`.

| `LLM_PROVIDER` | Fournisseur | Ou creer la cle | Variables a renseigner |
| --- | --- | --- | --- |
| `anthropic` (defaut) | Claude | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| `openai` | ChatGPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `gemini` | Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `openai_compatible` | Qwen (DashScope), DeepSeek, Groq, Mistral, un serveur Ollama/vLLM local, ou tout autre endpoint compatible OpenAI | selon le fournisseur | `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL` |

Toutes ces API sont payantes et distinctes d'un abonnement grand public (Claude.ai, ChatGPT Plus, Gemini...) — chacune necessite sa propre facturation activee sur la console du fournisseur. Une fois `server/.env` renseigne, **redemarrez** `npm run dev` : le fichier n'est relu qu'au demarrage du process.

## Lancer l'application

```bash
npm run dev:server   # API Fastify sur http://localhost:3000
npm run dev:client   # SPA Vite sur http://localhost:5173
```

## Tests

```bash
npm test             # suite du moteur (server/)
```
