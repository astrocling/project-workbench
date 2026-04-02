-- PTOHolidayImpact: move from weekly grain (personId + weekStartDate PK) to day-level rows with denormalized weekStartDate.

-- Step 1: Add new columns (date starts nullable for backfill)
ALTER TABLE "PTOHolidayImpact" ADD COLUMN "date" DATE;
ALTER TABLE "PTOHolidayImpact" ADD COLUMN "hours" DOUBLE PRECISION;
ALTER TABLE "PTOHolidayImpact" ADD COLUMN "label" TEXT;
ALTER TABLE "PTOHolidayImpact" ADD COLUMN "floatRegionId" INTEGER;
ALTER TABLE "PTOHolidayImpact" ADD COLUMN "floatSourceId" TEXT;
ALTER TABLE "PTOHolidayImpact" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Backfill `date` from legacy week key (safe when table is empty or legacy rows only stored week-level keys)
UPDATE "PTOHolidayImpact" SET "date" = "weekStartDate" WHERE "date" IS NULL;

-- Step 3: Normalize `weekStartDate` to the Monday of the ISO week containing `date`
UPDATE "PTOHolidayImpact" SET "weekStartDate" = (
  "date"::timestamp + (1 - EXTRACT(ISODOW FROM "date"::timestamp)::integer) * INTERVAL '1 day'
)::date;

-- Step 4: Enforce NOT NULL on `date`
ALTER TABLE "PTOHolidayImpact" ALTER COLUMN "date" SET NOT NULL;

-- Step 5: Replace primary key (personId, weekStartDate) -> (personId, date, type)
ALTER TABLE "PTOHolidayImpact" DROP CONSTRAINT "PTOHolidayImpact_pkey";

ALTER TABLE "PTOHolidayImpact" ADD CONSTRAINT "PTOHolidayImpact_pkey" PRIMARY KEY ("personId", "date", "type");

-- Step 6: Secondary indexes for grid and sync lookups
CREATE INDEX "PTOHolidayImpact_personId_weekStartDate_idx" ON "PTOHolidayImpact"("personId", "weekStartDate");

CREATE INDEX "PTOHolidayImpact_weekStartDate_idx" ON "PTOHolidayImpact"("weekStartDate");

CREATE INDEX "PTOHolidayImpact_floatSourceId_idx" ON "PTOHolidayImpact"("floatSourceId");
