# French Tax & Calculation Engine (2026 Rules)

> **CRITICAL INSTRUCTION:** This module must be implemented as pure TypeScript functions, fully tested, and isolated from the database.

## 1. Mortgage Amortization (Credit Immobilier)

Create a function `generateAmortizationSchedule(principal, rate, insuranceRate, months, type)`.

- **Amortissable:** Standard constant payment formula.

$$Payment = Principal \times \frac{r/12}{1 - (1 + r/12)^{-n}}$$

- **In Fine:** Monthly payment is Interest + Insurance only. Principal is repaid at month `n`.
- **Cash flow impact:** `Total Payment = Principal Repayment + Interest + Insurance`.

## 2. Real Estate Depreciation (Amortissement SCI IS)

- **Base:** Purchase Price + Notary Fees + Renovation.
- **Land Value:** 15% to 20% of Base (**NON-depreciable**).
- **Building Value:** 80% to 85% of Base, depreciated linearly over 25 years (4% per year).
- **Renovation:** Depreciated over 15 years.

## 3. Corporate Tax (Impot sur les Societes - IS)

Applies to SCI IS and Holdings.

- **Taxable Profit** = Net Rents - Interest - Insurance - Depreciation.
- If `Profit <= 0`, tax is 0. Deficit is carried forward to year N+1.

**2026 Rates:**

| Tranche | Rate | Threshold |
|---------|------|-----------|
| 1 | 15% | Up to 42,500 EUR |
| 2 | 25% | Above 42,500 EUR |

## 4. Income Tax (SCI IR Transparency)

- **Taxable Profit** = Net Rents - Interest - Insurance. (**No depreciation!**)
- **Taxation at User Level:** Tax is computed using the full IR Bareme Progressif (see Section 7) + 17.2% Social charges (Prelevements Sociaux).
- The engine must compute the effective tax rate from the bareme, not rely on a user-provided TMI.

## 5. Dividend Distribution (Holding -> User)

### Level 1: SCI -> Holding (Regime Mere-Fille)

- 95% of dividend is **tax-exempt**.
- 5% (Quote-part) is added to Holding's taxable profit and taxed at IS (15% or 25%).

### Level 2: Holding -> User

- **PFU (Flat Tax) 2026:** 31.4% total (12.8% IR + 18.6% PS — note the CSG hike).
- **Bareme Option:** Engine must calculate `(Gross * 0.6) * TMI + (Gross * 0.186)` and pick the cheapest for the user.

## 6. Exit Tax & Capital Gains (Plus-Values)

Calculate the net proceeds if the asset is sold at Year N.

- **SCI IS:** Taxable Gain = Sale Price - Net Book Value (VNC). Taxed at IS rate (25%). VNC decreases every year due to depreciation.
- **SCI IR:** Taxable Gain = Sale Price - Purchase Price. Apply duration abatements:
  - Exoneration of IR after **22 years**.
  - Exoneration of PS after **30 years**.

## 7. Full IR Bareme Progressif (2026 Brackets)

The engine must compute the full Income Tax schedule rather than relying on a user-provided TMI.

### 7.1 Tax Brackets (per part of quotient familial)

| Tranche | Taxable Income (per part) | Rate |
|---------|--------------------------|------|
| 1 | Up to 11,294 EUR | 0% |
| 2 | 11,295 EUR to 28,797 EUR | 11% |
| 3 | 28,798 EUR to 82,341 EUR | 30% |
| 4 | 82,342 EUR to 177,106 EUR | 41% |
| 5 | Above 177,106 EUR | 45% |

### 7.2 Quotient Familial (Number of Parts)

| Situation | Parts |
|-----------|-------|
| Single / Divorced / Widowed | 1 |
| Married / PACSed | 2 |
| Per dependent child (1st and 2nd) | +0.5 |
| Per dependent child (3rd and beyond) | +1 |
| Single parent (isolated) | +0.5 bonus for 1st child |

### 7.3 Calculation Method

1. Compute `Revenu Net Imposable` (total taxable income including foncier profits).
2. Divide by number of parts: `R = Revenu / N_parts`.
3. Apply the bracket rates to `R` to get `Tax_per_part`.
4. Multiply back: `Gross_Tax = Tax_per_part * N_parts`.
5. Apply **plafonnement du quotient familial**: the tax reduction from the quotient familial is capped at **1,759 EUR per half-part** above the base (single=1, couple=2). If the reduction exceeds the cap, the tax is recalculated with the cap applied.

### 7.4 Decote (Low Income Rebate)

- Single: if `Gross_Tax < 1,929 EUR`, apply `Decote = 1,929 - (Gross_Tax * 0.4525)`.
- Couple: if `Gross_Tax < 3,191 EUR`, apply `Decote = 3,191 - (Gross_Tax * 0.4525)`.
- Final tax = max(0, Gross_Tax - Decote).

## 8. IFI (Impot sur la Fortune Immobiliere)

Applies yearly to the user's total net real estate patrimony.

### 8.1 Taxable Base

- **Included:** Market value of all real estate assets (direct or via SCI shares, prorated by ownership %).
- **Deductible debts:** Remaining mortgage principal on included properties.
- **Net Taxable Base** = Total Market Value - Deductible Debts.
- **Primary residence:** 30% abatement on market value (not applicable in this engine since assets are investment properties via SCIs).

### 8.2 Entry Threshold

- IFI applies only if Net Taxable Base **>= 1,300,000 EUR**.
- If below, IFI = 0.

### 8.3 Progressive Rate Table

| Tranche | Net Taxable Base | Rate |
|---------|-----------------|------|
| 1 | Up to 800,000 EUR | 0% |
| 2 | 800,001 EUR to 1,300,000 EUR | 0.50% |
| 3 | 1,300,001 EUR to 2,570,000 EUR | 0.70% |
| 4 | 2,570,001 EUR to 5,000,000 EUR | 1.00% |
| 5 | 5,000,001 EUR to 10,000,000 EUR | 1.25% |
| 6 | Above 10,000,000 EUR | 1.50% |

### 8.4 Smoothing Mechanism (Decote)

- If Net Taxable Base is between 1,300,000 and 1,400,000 EUR:
  - `IFI = Computed_IFI - (17,500 - 1.25% * Net_Taxable_Base)`
  - This avoids a brutal cliff effect at the 1.3M threshold.

### 8.5 Engine Integration

- IFI is computed **yearly** in the simulation loop, after asset revaluation (step 8 of the loop).
- IFI is paid by the **user** (individual level), not by the SCI/Holding entities.
- It reduces the user's personal net cash flow.

## 9. Succession (Droits de Succession)

Computed on-demand (e.g., at end of horizon or user-selected year) to estimate the cost of transmitting the patrimony.

### 9.1 Abatements (Abattements)

| Beneficiary Relationship | Abatement |
|--------------------------|-----------|
| Spouse / PACS partner | **Full exemption** (no succession tax) |
| Per child (direct line) | 100,000 EUR |
| Per grandchild | 31,865 EUR |
| Per sibling | 15,932 EUR |
| Per nephew/niece | 7,967 EUR |
| Other | 1,594 EUR |

> Abatements are renewed every **15 years** (relevant for donation strategies).

### 9.2 Progressive Rate Table (Direct Line: Parent -> Child)

| Tranche (after abatement) | Rate |
|---------------------------|------|
| Up to 8,072 EUR | 5% |
| 8,073 EUR to 12,109 EUR | 10% |
| 12,110 EUR to 15,932 EUR | 15% |
| 15,933 EUR to 552,324 EUR | 20% |
| 552,325 EUR to 902,838 EUR | 30% |
| 902,839 EUR to 1,805,677 EUR | 40% |
| Above 1,805,677 EUR | 45% |

### 9.3 SCI Share Valuation for Succession

- **Taxable value** = SCI Net Asset Value (NAV) x ownership share %.
- **Illiquidity discount:** 10% to 15% discount on SCI shares (non-traded, minority holding). The engine should use a configurable discount rate (default: 10%).
- If the SCI has outstanding debt, it reduces the NAV and thus the taxable succession base.

### 9.4 Assurance-Vie (Life Insurance) — Informational

> Note: Assurance-Vie is outside the scope of the SCI/Holding simulation but is mentioned for completeness.

- Premiums paid before age 70: each beneficiary benefits from a **152,500 EUR** exemption, then 20% up to 700,000 EUR, then 31.25% beyond.
- Premiums paid after age 70: **30,500 EUR** global exemption (shared among beneficiaries), then standard succession rates apply.

### 9.5 Usufruit / Nue-Propriete Split (Bareme Fiscal — Art. 669 CGI)

Used when the user transfers nue-propriete while retaining usufruit:

| Age of Usufructuary | Usufruit Value | Nue-Propriete Value |
|---------------------|---------------|---------------------|
| Under 21 | 90% | 10% |
| 21 to 30 | 80% | 20% |
| 31 to 40 | 70% | 30% |
| 41 to 50 | 60% | 40% |
| 51 to 60 | 50% | 50% |
| 61 to 70 | 40% | 60% |
| 71 to 80 | 30% | 70% |
| 81 to 90 | 20% | 80% |
| 91 and above | 10% | 90% |

- The taxable base for succession is the **nue-propriete value** only.
- This dramatically reduces the succession tax when the user donates nue-propriete early.

## 10. Deficit Carry-Forward Rules

### 10.1 IS Deficit (Corporate)

- Deficit can be carried forward **indefinitely**.
- **Cap on imputation:** Each year, the deficit offsets up to **1,000,000 EUR + 50% of profit beyond 1,000,000 EUR**.
- Example: if Year N profit = 3,000,000 EUR and carried deficit = 5,000,000 EUR:
  - Offset = 1,000,000 + 50% * (3,000,000 - 1,000,000) = 2,000,000 EUR.
  - Remaining deficit carried to N+1 = 3,000,000 EUR.

### 10.2 IR Deficit (Revenus Fonciers)

- Deficit from rental income (revenus fonciers) is deductible from **global income** up to **10,700 EUR per year**.
- The portion of deficit attributable to **loan interest** is NOT deductible from global income — it is only offset against future revenus fonciers.
- Excess deficit (above 10,700 EUR) is carried forward for **10 years** and offset against future revenus fonciers only.

## 11. Social Charges Clarifications

### 11.1 On IS Entity Operations

- IS entities (SCI IS, Holding) **do not pay social charges** at the entity level.
- Social charges are triggered only when profits are **distributed as dividends** to the individual (see Section 5, Level 2).

### 11.2 On IS Capital Gains

- When an IS entity sells an asset, only **IS** is applied to the gain (no PS at entity level).
- If the net gain is later distributed as a dividend, the dividend is subject to PFU (including 18.6% PS) or Bareme + PS at the individual level.

### 11.3 Prelevements Sociaux Rates (2026)

| Component | Rate (standard) | Rate (Swiss-affiliated) |
|-----------|----------------|------------------------|
| CSG | 10.2% | **Exempt** |
| CRDS | 0.5% | **Exempt** |
| Prelevement de solidarite | 7.5% | 7.5% |
| **Total PS** | **18.2%** | **7.5%** |

### 11.4 Swiss Social Security Exemption

The user is affiliated to the Swiss social security system. Under EU/EFTA bilateral agreements (Regulation EC 883/2004), a person who pays social contributions in Switzerland is **exempt from CSG and CRDS** in France on their investment and property income. Only the **prelevement de solidarite (7.5%)** applies.

This affects all PS calculations across the engine:

| Context | Standard PS | Swiss-exempt PS |
|---------|------------|-----------------|
| SCI IR (revenus fonciers) | 17.2% | 7.5% |
| PFU (dividends, flat tax option) | 18.6% → PFU total 31.4% | 7.5% → PFU total 20.3% |
| Bareme option (dividends) | 18.6% on gross | 7.5% on gross |
| Capital gains (SCI IR exit) | 17.2% (with abatements) | 7.5% (with abatements) |

> **Implementation:** The user's social charge regime (`STANDARD` or `SWISS_EXEMPT`) must be a configurable parameter in the user profile. The engine must use this flag to select the correct PS rate in all calculations.
