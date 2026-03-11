-- Add dailyHours for per-day operating times
ALTER TABLE "OperatingData" ADD COLUMN "dailyHours" JSONB;
