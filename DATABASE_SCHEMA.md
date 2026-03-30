# Database Schema (Prisma)

This schema represents the complete data model required for the application, handling Users, Corporate Structures, Assets, Loans, and Simulations.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id                String         @id @default(uuid())
  email             String         @unique
  passwordHash      String
  createdAt         DateTime       @default(now())

  // Tax Profile
  marginalTaxRate   Float          @default(0.30) // TMI: 0, 0.11, 0.30, 0.41, 0.45
  maritalStatus     MaritalStatus  @default(SINGLE)
  childrenCount     Int            @default(0)
  birthDate         DateTime?
  socialChargeRegime SocialChargeRegime @default(STANDARD) // STANDARD or SWISS_EXEMPT

  structures        Structure[]
  simulations       Simulation[]
}

model Structure {
  id                String         @id @default(uuid())
  userId            String
  user              User           @relation(fields: [userId], references: [id])

  name              String
  type              StructureType  // HOLDING, SCI_IS, SCI_IR, INDIVIDUAL
  taxRegime         TaxRegime      @default(IS)

  // Hierarchy for Holding -> SCI ownership
  parentId          String?
  parent            Structure?     @relation("Hierarchy", fields: [parentId], references: [id])
  subsidiaries      Structure[]    @relation("Hierarchy")
  ownershipShare    Float          @default(1.0) // E.g., 0.95 for 95% ownership

  assets            Asset[]
}

model Asset {
  id                String         @id @default(uuid())
  structureId       String
  structure         Structure      @relation(fields: [structureId], references: [id])

  type              AssetType      @default(REAL_ESTATE)
  label             String
  purchasePrice     Decimal        @db.Decimal(20, 2)
  notaryFees        Decimal        @db.Decimal(20, 2)
  renovationCosts   Decimal        @db.Decimal(20, 2)
  acquisitionDate   DateTime

  // Real Estate Specifics
  annualRent        Decimal        @db.Decimal(20, 2)
  chargesYearly     Decimal        @db.Decimal(20, 2)
  propertyTax       Decimal        @db.Decimal(20, 2) // Taxe Fonciere

  loan              Loan?
}

model Loan {
  id                String         @id @default(uuid())
  assetId           String         @unique
  asset             Asset          @relation(fields: [assetId], references: [id])

  principal         Decimal        @db.Decimal(20, 2)
  interestRate      Float          // Nominal rate (e.g., 0.035)
  insuranceRate     Float          // Insurance rate (e.g., 0.0035)
  durationMonths    Int            // e.g., 240 for 20 years
  startDate         DateTime
  type              LoanType       @default(AMORTISSABLE)
}

model Simulation {
  id                String         @id @default(uuid())
  userId            String
  user              User           @relation(fields: [userId], references: [id])
  name              String
  createdAt         DateTime       @default(now())

  // Simulation parameters
  horizonYears      Int            @default(30)
  inflationRate     Float          @default(0.02)
  propertyGrowth    Float          @default(0.015)
  rentGrowthRate    Float          @default(0.02)
  chargesGrowthRate Float          @default(0.02)
  propertyTaxGrowthRate Float      @default(0.02)

  // The cached result of the 30-year engine run (for fast retrieval)
  results           Json?
}

enum StructureType { HOLDING, SCI_IS, SCI_IR, INDIVIDUAL }
enum TaxRegime { IS, IR }
enum AssetType { REAL_ESTATE, FINANCIAL, CASH }
enum LoanType { AMORTISSABLE, INFINE }
enum MaritalStatus { SINGLE, MARRIED, PACSED }
enum SocialChargeRegime { STANDARD, SWISS_EXEMPT }
```
