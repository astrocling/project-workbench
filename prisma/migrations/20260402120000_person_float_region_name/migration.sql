-- Display label for Float region (from `/v3/people` and/or holiday rows); nullable when unknown.
ALTER TABLE "Person" ADD COLUMN "floatRegionName" TEXT;
