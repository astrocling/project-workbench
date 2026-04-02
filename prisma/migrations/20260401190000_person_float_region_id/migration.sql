-- Float `/v3/people` region (public/team holiday matching); nullable when unknown.
ALTER TABLE "Person" ADD COLUMN "floatRegionId" INTEGER;
