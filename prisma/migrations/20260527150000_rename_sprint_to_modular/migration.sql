-- Rename StatusReportVariation enum value Sprint -> Modular (preserves existing rows)
ALTER TYPE "StatusReportVariation" RENAME VALUE 'Sprint' TO 'Modular';
