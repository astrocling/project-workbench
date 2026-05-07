-- CreateTable
CREATE TABLE "ActualsNudgeLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "nudgeDay" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "slackChannelId" TEXT,
    "recipientSlackUserId" TEXT,
    "missingPersonNames" JSONB NOT NULL,
    "slackOk" BOOLEAN NOT NULL,
    "slackError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActualsNudgeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActualsNudgeLog_projectId_weekStart_idx" ON "ActualsNudgeLog"("projectId", "weekStart");

-- CreateIndex
CREATE INDEX "ActualsNudgeLog_nudgeDay_createdAt_idx" ON "ActualsNudgeLog"("nudgeDay", "createdAt");

-- AddForeignKey
ALTER TABLE "ActualsNudgeLog" ADD CONSTRAINT "ActualsNudgeLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
