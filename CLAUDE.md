# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Patrimonia** — a professional-grade French wealth & tax simulation engine. It calculates Net Cash Flow, Net Asset Value (NAV), and Succession costs over a 30-year horizon for Holding Company + SCI (Société Civile Immobilière) structures, compliant with French fiscal laws 2026.

## Tech Stack

- **Frontend:** React 18+ (Vite), Tailwind CSS + Shadcn/UI, Zustand (state), TanStack React Query (server state), Recharts (charts), React-Hook-Form + Zod (forms)
- **Backend:** Node.js + Fastify, TypeScript
- **Database:** PostgreSQL (the Supabase project's) with Prisma 7 ORM (`@prisma/adapter-pg`)
- **Math:** `decimal.js` for ALL financial calculations — never use native JS floats
- **Testing:** Vitest (TDD approach, especially for the engine)
- **Auth:** Supabase Auth (e-mail + password). The server never sees a password: it verifies the Supabase JWT against the project's JWKS (`server/src/plugins/auth.ts`)

## Build & Development Commands

```bash
# Backend (server/)
cd server && npm install
npx prisma generate        # Generate Prisma client (also run by build/dev/test)
npx prisma migrate dev     # Create a migration after editing schema.prisma
npm run db:deploy          # Apply migrations (a plain Postgres needs prisma/test/supabase-auth-stub.sql first)
npm run dev                # Start Fastify dev server

# Frontend (client/)
cd client && npm install
npm run dev                # Start Vite dev server

# Testing
cd server && npx vitest              # Run all tests (DB tests skipped without DATABASE_URL)
cd server && npx vitest run <file>   # Run a single test file
cd server && npx vitest --watch      # Watch mode
```

## Architecture

```
/patrimonia-app
  /client           # React SPA
    /src
      /components   # Reusable Shadcn UI components
      /features     # Domain modules (Simulation, Entities, Loans)
      /hooks        # React Query hooks
      /store        # Zustand stores
  /server           # Fastify API
    /src
      /controllers  # Route handlers
      /engine       # PURE FUNCTIONS — core math/tax logic (no DB access)
      /routes       # API route definitions
      /services     # DB interaction layer
  /shared           # Shared TS interfaces, Zod schemas, DTOs
```

## Core Engine Modules (server/src/engine/)

The engine is the heart of the app — pure TypeScript functions, fully tested, isolated from the database.

- **mortgage.ts** — Amortization schedules: Amortissable (constant payment) and In Fine (interest-only, balloon repayment). Uses `decimal.js`.
- **baremes.ts** — every dated figure in one module: IR brackets, decote, quotient ceilings, IS, PS, IFI, succession abatements, depreciation terms. `ANNEE_BAREME` says which vintage the engine is running. It is currently **2024 (revenus 2023)**, not 2026: the values are internally consistent but stale, and the ones to refresh from the BOFiP carry an `@aVerifier` tag. Updating the engine's fiscal year means touching this file and nothing else.
- **tax.ts** — French tax calculators:
  - IS (Corporate Tax): 15% up to €42,500, 25% above. Deficit carry-forward (unlimited, capped at €1M + 50% beyond, and never more than the year's profit — the excess stays reportable).
  - IR (Full Bareme Progressif): 5 brackets (0%→45%), quotient familial, plafonnement, decote. Engine computes the full schedule — no user-provided TMI. A single parent gets the case T half-part, capped on its own higher ceiling.
  - IR Foncier deficit: deductible from global income up to €10,700/yr, excess carried 10 years.
  - PFU (Flat Tax) 2026: 31.4% (12.8% IR + 18.6% PS). Compare with Bareme option and pick cheapest.
  - Mere-Fille regime: 95% dividend exemption between SCI→Holding.
  - IFI: yearly tax on net real estate patrimony (progressive 0.5%→1.5%, entry at €1.3M), assessed on the share held by the declarant's own foyer fiscal, spouse included.
  - Plus-value IR: surtaxe of art. 1609 nonies G above €50K of taxable gain, and the 15% forfait travaux past 5 years when it beats the real invoices.
- **costs.ts** — Structure setup and running costs. Presets per `ManagementMode` (SOI_MEME / EN_LIGNE / EXPERT_COMPTABLE / NOTAIRE_AVOCAT) and per structure type; every line overridable by the user. Indicative 2026 amounts — not a quote. Annual costs are indexed on `inflationRate` and deductible under both regimes.
- **associes.ts** — Per-associe taxation of an SCI at IR:
  - `computeAssocieIR` is a DIFFERENTIAL: `IR(autresRevenus + quotePart) − IR(autresRevenus)`. Never tax a quote-part in isolation — it lands in the wrong bracket.
  - Deficit foncier: €10,700/yr against global income, excess carried 10 years with vintage expiry.
  - Comptes courants d'associes: interest deductible for the SCI and taxed as RCM, capital repayment tax-free.
- **lmnp.ts** — Loueur en Meuble Non Professionnel (`StructureType` `LMNP`), translucent like an LMP but taxed differently:
  - Reel: depreciation capped by art. 39 C — it never creates a deficit, the excess is deferred with no time limit. Order: the year's depreciation, then carried deficits (10 years, oldest first), then the deferred stock.
  - A real-charge deficit offsets LMNP profits only — never the global income, unlike an LMP.
  - PS on capital income (`getSocialChargeRate`), no TNS contribution.
  - SSI: a meuble de tourisme (seasonal asset) above €23,000 of receipts, judged on each associe's share, pays SSI contributions instead of the PS (`tauxCotisationsSocialesLMP`, floor `cotisationsMinimalesLMP`), deductible from the IR base at the reel only. A `SWISS_EXEMPT` associe stays out. Flagged per year in `lmnp.affiliationSSI`.
  - Micro-BIC (`regimeLMNP: 'MICRO_BIC'`): 50 % up to €77,700, 30 % up to €15,000 for an unclassified tourist letting (`meubleTourismeClasse`). Judged on the previous year's receipts; above the threshold the reel applies.
- **succession.ts** — Succession cost estimator:
  - Abatements by relationship (€100K/child, spouse exempt).
  - Progressive rates (5%→45% direct line).
  - SCI share valuation with illiquidity discount (default 10%).
  - Usufruit/nue-propriete split (Art. 669 CGI bareme by age).
  - Rate tables are per relationship: ligne directe for children and grandchildren, 35%/45% for siblings, a flat 55% for nephews and nieces, a flat 60% for anyone else.
  - `computeSuccessionForAssocies`: the `SELF` associe dies at the horizon; only their remaining parts (plus their CCA at face value) are transmitted, to the co-associes or, failing that, to the declared children.
- **exit.ts** — what selling at the horizon costs, reported separately from the yearly figures. At IS it has **two floors**: the corporate tax on the gain measured against the depreciated book value, then the flat tax the associes pay on the boni de liquidation to get the money out. Reporting only the first made the IS look cheaper to leave than the IR, which settles once and for all. LMP applies the art. 151 septies B abatement, so the long-term share is exempt at 15 years. LMNP is a private gain (the IR rules) with the depreciation actually deducted added back, per the LF 2025 — deferred depreciation was never deducted, so it is not.
- **frontalierGe.ts** — Geneva frontalier: taxation ordinaire ulterieure (TOU) as a quasi-resident, compared with the impot a la source (IS). One fiscal year (2026), no projection.
  - Quasi-resident test: at least 90 % of the household's GROSS worldwide income, the spouse's included, taxable in Switzerland. French rents count gross.
  - ICC (bareme art. 41 LIPP, splitting for couples and single parents, 48.5 cantonal centimes, 12 % LDIRPP reduction, communal centimes of the commune of WORK) + IFD (published AFC table, bareme parental). Both rates are set on worldwide income and applied to the Swiss taxable income only (reserve de progression) — French property charges lower the rate.
  - The IS is recomputed from the official AFC tariff file (`tarifSource.ts`, monthly salary lookup) and compared with the amount actually withheld; `impacts` measures each deduction by removing it alone.
- **baremesGeneve.ts** — every Swiss figure for that module, vintage `ANNEE_BAREME_GE = 2026`, kept apart from `baremes.ts` on purpose (other jurisdiction, other vintage). Figures not read in an official text carry `@aVerifier`.
- **tarifSource.ts** — reads `tarifs/tarifSourceGe2026.ts`, GENERATED from the AFC file `tarifs/tar26ge.txt` by `server/scripts/generate-tarif-source.mjs`. Never edit the generated file; regenerate it for a new year. (The folder is not called `data/`: `server/.gitignore` ignores that name for saved scenarios.)
- **simulator.ts** — 30-year projection loop: revenue (with configurable per-field growth rates) → loan payments → depreciation (IS and LMP only) → structure costs → tax → net cash flow → CCA repayment → intra-group dividends → asset revaluation → IFI → succession at the horizon.
  - `yearlyData` opens on a **year 0** carrying the incorporation costs — index 0 is not year 1.
  - `summary.totalNetWealth` is FAMILY wealth: companies plus what the associes hold personally, net of the tax they paid out of pocket. Without this the regimes are not comparable — at IR the SCI keeps its cash while the associes are taxed personally. It is a wealth-CREATED figure: the apport is debited from it, so it reads relative to the family's savings before the operation.
  - Two cash-flow series, and they are not interchangeable. `totalNetCashFlow` is the COMPANY view, used by the projection table. `fluxFamille` is what actually crossed into the associes' pockets, and it is the only valid basis for the **IRR** — building the rate on the company series counted cash retained in the company twice, once at its date and once inside the terminal value.
  - Dividends are capped by the **distributable profit**, tracked per entity, not by the treasury. At IS the two diverge for years because depreciation consumes no cash.
  - A dividend is taxed **per associe**, pro-rata to their parts, on their own household and their own other income, arbitrating PFU against bareme for each of them separately.
  - `summary.successionCost` is reported separately from `totalTaxPaid`. Every other euro of `totalTaxPaid` is traceable to a yearly row: entity `tax`, associe `irTax`/`psTax`/`ccaInterestTax`, `ifiTax` and `dividendTax`.

## Key API Endpoints

- `POST /api/simulations/run` — Accepts full scenario JSON, returns 30-year projection array
- `GET /api/costs/presets` — Cost presets for every management mode × structure type, so the client pre-fills its form from the engine instead of duplicating the table
- `POST /api/frontalier/run` — Geneva TOU vs impot a la source for one year (`FrontalierRequestSchema` in `shared/frontalier.ts`)
- `POST /api/frontalier/documents` — multipart upload (PDF/JPEG/PNG/WebP, 10 × 10 MB); Claude reads each file into amounts tagged with their form field (`services/llm/documentExtractor.ts`, Anthropic only). Files stay in memory, never on disk; the client applies nothing until the user validates each field.
- `GET /api/simulations`, `GET|PUT|DELETE /api/simulations/:id`, `POST /api/simulations` — saved scenarios of the logged-in user
- `GET /api/config` — public: the Supabase anon key, read by the client at start-up

## Authentication & persistence

- Every `/api/*` route needs `Authorization: Bearer <Supabase access token>`, except `/api/health` and `/api/config`. The hook sets `request.user = { id, email }`; the server refuses to start without `SUPABASE_URL`.
- Scenarios live in the `scenarios` table (`server/src/services/scenarioStore.ts`), `data` an opaque JSON (`shared/scenario.ts`). Every query filters on `userId`: that filter IS the access control, since the server connects as `postgres` and bypasses RLS. Someone else's scenario is a 404, never a 403. `MAX_SCENARIOS` is per user.
- The migration enables RLS and revokes everything from `anon`/`authenticated`, on the tables and on the `tax` schema: the Supabase Data API cannot reach them, only our server. Keep that for any new table.
- **Each user brings their own LLM key** (`/api/me/llm`, `services/llmSettings.ts`, table `tax.llm_settings`). The key is encrypted with `LLM_KEYS_SECRET` (AES-256-GCM, AAD = user id, `services/secretBox.ts`) and is WRITE-ONLY: no response carries it, only `cleFin` (last 4 characters).
- Paid LLM calls (`/api/listings/analyze`, `/api/frontalier/documents`) go through `preparerLlm` (`routes/llmAcces.ts`): the user's key, else the server's `.env` key for `LLM_SERVER_KEY_EMAILS` only (then with the daily quota `LLM_QUOTA_JOUR`), else 403 `code: 'LLM_NON_CONFIGURE'`. Documents need Anthropic.
- Providers never read `process.env`: they get an `LlmConfig` (`services/llm/config.ts`). A user-typed `openai_compatible` base URL is called through `fetchApiPublique` (https only, netGuard on every request, no redirect).
- The Supabase project is SHARED with other applications (same `auth.users`, same e-mail templates, other tables in `public`). Every Patrimonia table lives in the `tax` schema: `prisma.config.ts` puts `schema=tax` on the migration URL (so `_prisma_migrations` is there too), `db.ts` passes `DB_SCHEMA` to the adapter. Raw SQL must qualify `tax.` itself. Never create anything in `public`, never touch the e-mail templates or the Site URL.
- Tokens: asymmetric keys through the project JWKS, or HS256 with the legacy JWT secret when `SUPABASE_JWT_SECRET` is set (older projects). HS256 is refused without it.
- At start-up, `services/diagnosticSupabase.ts` checks the Supabase settings (anon key, e-mail sign-in, confirmation, empty JWKS without secret) and logs a French verdict prefixed `[Supabase]`, each line naming where to click. Never fatal; `SUPABASE_DIAGNOSTIC=false` turns it off. `DEPLOY.md` step 2 bis relies on it: keep the manual steps to what it cannot read (the Redirect URLs).
- Login traffic goes through `<origin>/supabase`: `supabase-js` points there, relayed to the project by nginx (`client/nginx.conf.template`) and by Vite in dev. Only `/auth/v1` is relayed. The e-mail links (default templates) go through supabase.co, then land on `/auth/confirmer?type=…&code=…`: PKCE flow (`flowType: 'pkce'`), exchanged by `features/auth/ConfirmPage.tsx`, which also accepts `token_hash` links and `error_code` redirects.
- Client calls to `/api` go through `apiFetch` (`client/src/lib/api.ts`), which attaches the token.
- DB tests (`describe.skipIf(!hasDb)`) create their own users in `auth.users` and delete only those: test files run in parallel on one database.

## UI Language

The entire UI must be in **French** — all labels, buttons, tooltips, error messages, and chart legends.

## Critical Domain Rules

- **Depreciation (SCI IS, LMP and LMNP at the reel):** Land is non-depreciable; its share is the per-asset `landRatio` input, defaulting to 15%. Building: 4%/year over 25 years. Renovation: over 15 years. Furniture (`mobilier`, optional per asset): over 7 years, paid out of the apport, kept out of the real estate book value and of the LMNP add-back at the sale.
- **Capital Gains exit:** SCI IS = Sale Price - Net Book Value (VNC), taxed at IS rate. SCI IR = Sale Price - Purchase Price with duration abatements (IR exempt after 22yr, PS after 30yr). Social charges on IS gains apply only when distributed as dividends.
- **Inflation is configurable per field:** separate growth rates for rent, charges, and property tax (all default 2%). Property value growth is separate (default 1.5%).
- **Associes:** an SCI is held by N associes, each with a full tax household (marital status, children, other income, social charge regime) plus their capital and compte courant contributions. Parts must total exactly 100% — validated in `SimulationRequestSchema.superRefine`, not on `StructureSchema` (a `.refine()` there would turn it into a `ZodEffects` and break the `z.lazy()` self-reference for subsidiaries).
- **Comparison of setups:** the frontend derives five scenarios — `SCI_IR`, `SCI_IS_SEULE`, `SCI_IS_HOLDING`, and a long-term furnished letting owned directly, `LMNP_REEL` and `LMNP_MICRO` — from one set of shared inputs (`buildScenario` in the store) and makes one `/run` call each. No dedicated comparison endpoint. The LMNP columns hold the walls directly (in indivision between the same associes), so they distribute nothing and carry no illiquidity discount at succession. `GET /api/costs/presets` serves an extra `LMNP_MICRO_BIC` key per mode for the micro-BIC preset.
- **Swiss social charge exemption:** User is affiliated to Swiss social security — exempt from CSG/CRDS, only pays prelevement de solidarite (7.5% instead of 17.2%/18.2%). This is a configurable `SocialChargeRegime` flag (`STANDARD` or `SWISS_EXEMPT`) that affects all PS calculations (IR foncier, PFU, dividends, capital gains).
- **Indexation is deliberately asymmetric:** rents, charges and running costs are indexed on `(1 + rate)^(year - 1)`, so year 1 is quoted at the figures the user typed. The property value compounds from year 1 and is therefore an end-of-year valuation. The two sit a year apart on purpose.
- **Currencies:** the whole app is in EUR except the frontalier module, which is in CHF; its French inputs carry an `Eur` suffix and are converted by the ENGINE with `tauxChangeEurChf`, never by the client.
- Structures support parent-child hierarchy (Holding → SCI) with ownership shares.
- All API inputs must be validated with Zod schemas.

## Git Workflow

- **Create a new branch for each implementation phase** (e.g., `dev/phase1-setup`, `dev/phase2-engine`, `dev/phase3-api`, `dev/phase4-frontend`).
- Commit and push at the end of each phase before starting the next one.

## Implementation Order

Follow the phased approach: (1) Database & shared types → (2) Core engine with tests (do not proceed until math tests pass) → (3) Backend API → (4) Frontend.
