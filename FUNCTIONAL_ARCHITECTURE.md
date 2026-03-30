# Functional Specifications & UI/UX

> **LANGUAGE:** The entire UI must be in **French**. All labels, buttons, tooltips, error messages, and chart legends must use French terminology (e.g., "Flux de tresorerie net", "Impot sur les societes", "Simuler", "Ajouter un bien").

## 1. Scenario Builder (Input Module)

The user interface must allow the visual construction of a corporate structure tree.

- **Global Context:** User inputs TMI, family situation, and age.
- **Entity Creation:** User adds "Cards" representing entities (Holding, SCI A).
- **Asset Assignment:** User clicks an entity and adds Real Estate (Price, Rent, Charges).
- **Financing:** User attaches a Mortgage to the Asset (Rate, Duration).
- **Growth Rates (Configurable):** User sets separate annual growth rates for:
  - **Rent indexation rate** (default: 2% — inflation)
  - **Charges growth rate** (default: 2%)
  - **Property tax growth rate** (default: 2%)
  - **General inflation rate** (default: 2% — used for other calculations)
  - **Property value growth rate** (default: 1.5%)

## 2. Comparison Engine (Core Feature)

The application must allow A/B testing of scenarios:

- **Scenario A:** SCI subjected to IR (Income Tax).
- **Scenario B:** SCI subjected to IS (Corporate Tax) held by a Holding.

The UI must display side-by-side KPI cards:

- Total Net Cash Flow (Year 20).
- Total Tax Paid (Accumulated).
- Net Asset Value (After potential exit tax/capital gains).

## 3. Dashboard & Data Visualization

- **Cash Flow Waterfall Chart:** Showing Gross Rent -> Charges -> Loan -> Tax -> Net Cash.
- **Equity Curve (Area Chart):** Showing Market Value vs. Remaining Loan Balance over 30 years.
- **Break-Even Point Indicator:** Highlighting the year where the cash flow becomes organically positive (no more effort d'epargne needed).

## 4. Dividend Strategy Module

- An interactive slider where the user decides what percentage of the Holding's cash to distribute to themselves each year.
- Real-time recalculation of the PFU (Flat Tax) vs. Bareme Progressif impact.
