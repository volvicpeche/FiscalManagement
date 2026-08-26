# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Patrimonia** — a professional-grade French wealth & tax simulation engine. It calculates Net Cash Flow, Net Asset Value (NAV), and Succession costs over a 30-year horizon for Holding Company + SCI (Société Civile Immobilière) structures, compliant with French fiscal laws 2026.

## Tech Stack

- **Frontend:** React 18+ (Vite), Tailwind CSS + Shadcn/UI, Zustand (state), TanStack React Query (server state), Recharts (charts), React-Hook-Form + Zod (forms)
- **Backend:** Node.js + Fastify, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Math:** `decimal.js` for ALL financial calculations — never use native JS floats
- **Testing:** Vitest (TDD approach, especially for the engine)
- **Auth:** JWT with Argon2id hashing

## Build & Development Commands

```bash
# Backend (server/)
cd server && npm install
npx prisma generate        # Generate Prisma client
npx prisma migrate dev     # Run DB migrations
npm run dev                # Start Fastify dev server

# Frontend (client/)
cd client && npm install
npm run dev                # Start Vite dev server

# Testing
cd server && npx vitest              # Run all engine tests
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
- **tax.ts** — French tax calculators:
  - IS (Corporate Tax): 15% up to €42,500, 25% above. Deficit carry-forward (unlimited, capped at €1M + 50% beyond).
  - IR (Full Bareme Progressif): 5 brackets (0%→45%), quotient familial, decote. Engine computes the full schedule — no user-provided TMI.
  - IR Foncier deficit: deductible from global income up to €10,700/yr, excess carried 10 years.
  - PFU (Flat Tax) 2026: 31.4% (12.8% IR + 18.6% PS). Compare with Bareme option and pick cheapest.
  - Mere-Fille regime: 95% dividend exemption between SCI→Holding.
  - IFI: yearly tax on net real estate patrimony (progressive 0.5%→1.5%, entry at €1.3M).
- **costs.ts** — Structure setup and running costs. Presets per `ManagementMode` (SOI_MEME / EN_LIGNE / EXPERT_COMPTABLE / NOTAIRE_AVOCAT) and per structure type; every line overridable by the user. Indicative 2026 amounts — not a quote. Annual costs are indexed on `inflationRate` and deductible under both regimes.
- **associes.ts** — Per-associe taxation of an SCI at IR:
  - `computeAssocieIR` is a DIFFERENTIAL: `IR(autresRevenus + quotePart) − IR(autresRevenus)`. Never tax a quote-part in isolation — it lands in the wrong bracket.
  - Deficit foncier: €10,700/yr against global income, excess carried 10 years with vintage expiry.
  - Comptes courants d'associes: interest deductible for the SCI and taxed as RCM, capital repayment tax-free.
- **succession.ts** — Succession cost estimator:
  - Abatements by relationship (€100K/child, spouse exempt).
  - Progressive rates (5%→45% direct line).
  - SCI share valuation with illiquidity discount (default 10%).
  - Usufruit/nue-propriete split (Art. 669 CGI bareme by age).
  - `computeSuccessionForAssocies`: the `SELF` associe dies at the horizon; only their remaining parts (plus their CCA at face value) are transmitted, to the co-associes or, failing that, to the declared children.
- **simulator.ts** — 30-year projection loop: revenue (with configurable per-field growth rates) → loan payments → depreciation (IS only) → structure costs → tax → net cash flow → CCA repayment → intra-group dividends → asset revaluation → IFI → succession at the horizon.
  - `yearlyData` opens on a **year 0** carrying the incorporation costs — index 0 is not year 1.
  - `summary.totalNetWealth` is FAMILY wealth: companies plus what the associes hold personally, net of the tax they paid out of pocket. Without this the regimes are not comparable — at IR the SCI keeps its cash while the associes are taxed personally.
  - `summary.successionCost` is reported separately from `totalTaxPaid`.

## Key API Endpoints

- `POST /api/simulations/run` — Accepts full scenario JSON, returns 30-year projection array
- `GET /api/costs/presets` — Cost presets for every management mode × structure type, so the client pre-fills its form from the engine instead of duplicating the table
- `GET /api/simulations/:id` — Retrieve saved scenario *(not implemented yet)*
- `POST /api/simulations` — Save scenario state *(not implemented yet)*

The server does **not** use Prisma yet: nothing under `server/src/` imports `PrismaClient`, so no database is needed to run the app. `schema.prisma` is kept as a mirror of the shared Zod schemas for when persistence lands.

## UI Language

The entire UI must be in **French** — all labels, buttons, tooltips, error messages, and chart legends.

## Critical Domain Rules

- **Depreciation (SCI IS only):** Land (15-20% of base) is non-depreciable. Building: 4%/year over 25 years. Renovation: over 15 years.
- **Capital Gains exit:** SCI IS = Sale Price - Net Book Value (VNC), taxed at IS rate. SCI IR = Sale Price - Purchase Price with duration abatements (IR exempt after 22yr, PS after 30yr). Social charges on IS gains apply only when distributed as dividends.
- **Inflation is configurable per field:** separate growth rates for rent, charges, and property tax (all default 2%). Property value growth is separate (default 1.5%).
- **Associes:** an SCI is held by N associes, each with a full tax household (marital status, children, other income, social charge regime) plus their capital and compte courant contributions. Parts must total exactly 100% — validated in `SimulationRequestSchema.superRefine`, not on `StructureSchema` (a `.refine()` there would turn it into a `ZodEffects` and break the `z.lazy()` self-reference for subsidiaries).
- **Three-way comparison:** the frontend derives three scenarios — `SCI_IR`, `SCI_IS_SEULE`, `SCI_IS_HOLDING` — from one set of shared inputs (`buildScenario` in the store) and makes three separate `/run` calls. No dedicated comparison endpoint.
- **Swiss social charge exemption:** User is affiliated to Swiss social security — exempt from CSG/CRDS, only pays prelevement de solidarite (7.5% instead of 17.2%/18.2%). This is a configurable `SocialChargeRegime` flag (`STANDARD` or `SWISS_EXEMPT`) that affects all PS calculations (IR foncier, PFU, dividends, capital gains).
- All monetary fields in Prisma use `Decimal(20,2)`.
- Structures support parent-child hierarchy (Holding → SCI) with ownership shares.
- All API inputs must be validated with Zod schemas.

## Git Workflow

- **Create a new branch for each implementation phase** (e.g., `dev/phase1-setup`, `dev/phase2-engine`, `dev/phase3-api`, `dev/phase4-frontend`).
- Commit and push at the end of each phase before starting the next one.

## Implementation Order

Follow the phased approach: (1) Database & shared types → (2) Core engine with tests (do not proceed until math tests pass) → (3) Backend API → (4) Frontend.
