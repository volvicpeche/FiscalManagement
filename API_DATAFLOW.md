# API Architecture & The Simulation Loop

## 1. Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/simulations/run` | Accepts full JSON tree (User Profile, Entities, Assets, Loans). Returns 30-year projection data (array of 30 objects). |
| `GET` | `/api/simulations/:id` | Retrieve a saved scenario. |
| `POST` | `/api/simulations` | Save a scenario state. |

### Design Note: A/B Scenario Comparison

The comparison feature (IR vs. IS side-by-side) is handled entirely on the **frontend**. The client makes two separate `POST /api/simulations/run` calls with different scenario configurations and displays the results side-by-side. No dedicated `/compare` endpoint is needed.

## 2. The Simulation Loop Logic (Backend)

The `runSimulation` function must execute a 30-year loop. For `year = 1` to `horizon`:

```typescript
// Pseudo-code logic to implement
for (let year = 1; year <= horizon; year++) {
  let yearData = { year, entities: {} };

  for (const entity of entities) {
     // 1. Calculate Gross Revenue (with inflation)
     // 2. Process Loan Payments (deduct interest)
     // 3. Process Depreciation (if IS)
     // 4. Calculate Taxable Profit
     // 5. Apply IS or IR Tax rules
     // 6. Calculate Net Cash Flow (Revenue - Total Loan Pmt - Tax - Charges)

     // 7. Process intra-group dividends (SCI -> Holding)
     // 8. Update Asset Market Value (with propertyGrowth)
  }

  projection.push(yearData);
}
```

## 3. Expected Response Payload (Schema)

The frontend expects this structure to render the charts:

```json
{
  "summary": {
    "totalNetWealth": "1500000.00",
    "totalTaxPaid": "120000.00",
    "irr": "0.065"
  },
  "yearlyData": [
    {
      "year": 1,
      "sci_A_cashflow": "-1500.00",
      "sci_A_tax": "0.00",
      "sci_A_remainingDebt": "195000.00",
      "holding_cash": "0.00",
      "user_net_dividend": "0.00"
    }
    // ... up to year 30
  ]
}
```
