# Project: Patrimonia - Wealth & Tax Simulation Engine

**Target Year Compliance:** French Fiscal Laws 2026.
**Primary Use Case:** Holding Company + SCI (Societe Civile Immobiliere) optimization.

## 1. Vision & Core Objective

Patrimonia is a professional-grade financial simulation tool. It provides a "Single Source of Truth" for personal wealth strategy by calculating Net Cash Flow, Net Asset Value (NAV), and Succession costs over a 30-year horizon, taking into account French-specific taxes (IS, IR, PFU, IFI, Succession).

## 2. Technical Stack

The application must follow a decoupled, modern web architecture:

- **Frontend (Client):** React 18+ via Vite.
  - **Styling:** Tailwind CSS + Shadcn/UI.
  - **State Management:** Zustand (global/form state) + TanStack React Query (server state).
  - **Data Viz:** Recharts (for complex financial projections).
  - **Forms:** React-Hook-Form + Zod (strict validation).
- **Backend (API):** Node.js with Fastify (preferred for performance) or Express, using TypeScript.
  - **Math Precision:** **CRITICAL:** Use `decimal.js` for ALL financial calculations. Never use native JS floats.
- **Database:** PostgreSQL.
- **ORM:** Prisma.

## 3. Directory Structure Architecture

```
/patrimonia-app
  /client                 # React SPA
    /src
      /components         # Reusable UI (Shadcn)
      /features           # Domain-specific modules (Simulation, Entities, Loans)
      /hooks              # React Query hooks
      /store              # Zustand stores
  /server                 # Node API
    /src
      /controllers        # Route handlers
      /engine             # PURE FUNCTIONS: The core mathematical/tax logic
      /routes             # API definitions
      /services           # DB interactions
  /shared                 # Shared TS interfaces (Zod schemas, DTOs)
```

## 4. Security & Compliance

- **Auth:** JWT-based authentication (e.g., Lucia Auth or NextAuth) with Argon2id hashing.
- **Validation:** All API endpoints must validate inputs using Zod to prevent malicious financial injections.
