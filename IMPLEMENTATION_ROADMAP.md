# AI Implementation Roadmap (Step-by-Step)

> **AI Agent, please execute the development in the following strict order:**

## Phase 1: Database & Shared Types

1. Initialize the Node/Fastify backend.
2. Setup Prisma with the `DATABASE_SCHEMA.md`.
3. Create `shared/types.ts` generating Zod schemas from the Prisma models.

## Phase 2: Core Financial Engine (TDD Approach)

1. Install `decimal.js` and `vitest`.
2. Create `engine/mortgage.ts` — Write the amortization function and its unit tests.
3. Create `engine/tax.ts` — Write the IS, IR, and PFU calculators.
4. Create `engine/simulator.ts` — Implement the 30-year loop defined in `API_DATAFLOW.md`.

> **Do not proceed to API or UI until the core math tests pass.**

## Phase 3: Backend API

1. Implement the Fastify routes.
2. Connect the `POST /api/simulations/run` endpoint to the Simulator engine.
3. Implement basic error handling and Zod validation middleware.

## Phase 4: Frontend Application

1. Initialize React + Vite + Tailwind + Shadcn.
2. Build the `ScenarioBuilder` component (forms to add SCIs, Loans, etc.).
3. Build the `Dashboard` component using Recharts to visualize the JSON response from the engine.
4. Implement the Zustand store to manage the current draft simulation.
