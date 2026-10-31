/**
 * Loads data/clean/tangabid_farmgate_monthly_district.csv into Neon as observed data.
 *
 * Each row is one crop, one district and one month: the average of that month's farm-gate
 * prices across the district's markets. No market names or agent details are stored.
 *
 * Steps: validate -> register the source -> upsert crops and the farm-gate metric from the
 * reference lists -> register the import and its checks -> insert observations -> audit.
 *
 * Run with:
 *   npm run db:load:tangabid -- --dry-run     (validate only)
 *   npm run db:load:tangabid                  (load into Neon)
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db, schema } from "./index";

const { sources, commodities, metrics, rawImports, validationResults, observations, auditLog } = schema;

const SOURCE_CODE = "TANGABID-ESOKO-FARMGATE";
const CLEAN_PATH = path.join("data", "clean", "tangabid_farmgate_monthly_district.csv");
const REFERENCE_DIR = path.join("data", "reference");
const BATCH_SIZE = 500;
const METRIC = "farmgate_price_rwf_per_kg";

const REQUIRED_COLUMNS = [
  "period_start",
  "period_end",
  "district_code",
  "commodity_code",
  "metric_code",
  "value",
  "unit",
  "n_daily_obs",
] as const;

type Row = Record<(typeof REQUIRED_COLUMNS)[number], string> & { n_locations: string; price_channel: string; source: string };

const DRY_RUN = process.argv.includes("--dry-run");

function readReference(file: string): Record<string, string>[] {
  const text = readFileSync(path.join(process.cwd(), REFERENCE_DIR, file), "utf8");
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;
}

type Check = { name: string; passed: boolean; failedRows: number; detail?: unknown };

function validate(rows: Row[], headers: string[]): Check[] {
  const districtCodes = new Set(readReference("districts.csv").map((r) => r.code));
  const crops = readReference("commodities.csv");
  const cropCodes = new Set(crops.map((r) => r.code));
  const metric = readReference("metrics.csv").find((r) => r.code === METRIC);

  const checks: Check[] = [];
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  checks.push({ name: "required_columns", passed: missing.length === 0, failedRows: 0, detail: missing });

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const badDates = rows.filter((r) => !datePattern.test(r.period_start) || !datePattern.test(r.period_end) || r.period_end < r.period_start);
  checks.push({ name: "date_format_and_order", passed: badDates.length === 0, failedRows: badDates.length });

  const badValues = rows.filter((r) => !Number.isFinite(Number(r.value)) || Number(r.value) <= 0);
  checks.push({ name: "numeric_positive_values", passed: badValues.length === 0, failedRows: badValues.length });

  const badUnits = rows.filter((r) => !metric || r.unit.trim() !== metric.unit);
  checks.push({ name: "unit_matches_metric", passed: badUnits.length === 0, failedRows: badUnits.length, detail: { expected: metric?.unit } });

  const unknownDistricts = rows.filter((r) => !districtCodes.has(r.district_code));
  checks.push({ name: "district_codes_known", passed: unknownDistricts.length === 0, failedRows: unknownDistricts.length });

  const unknownCrops = rows.filter((r) => !cropCodes.has(r.commodity_code));
  checks.push({ name: "commodity_codes_known", passed: unknownCrops.length === 0, failedRows: unknownCrops.length });

  const thin = rows.filter((r) => Number(r.n_daily_obs) < 5);
  checks.push({ name: "minimum_daily_observations", passed: thin.length === 0, failedRows: thin.length });

  const keys = rows.map((r) => `${r.district_code}|${r.commodity_code}|${r.period_start}`);
  const duplicates = keys.length - new Set(keys).size;
  checks.push({ name: "no_duplicate_rows", passed: duplicates === 0, failedRows: duplicates });

  return checks;
}

async function main() {
  const content = readFileSync(path.join(process.cwd(), CLEAN_PATH), "utf8");
  const fileHash = createHash("sha256").update(content, "utf8").digest("hex");

  const parsed = Papa.parse<Row>(content, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error at row ${parsed.errors[0].row}: ${parsed.errors[0].message}`);
  }
  const rows = parsed.data;
  const checks = validate(rows, parsed.meta.fields ?? []);

  const crops = new Set(rows.map((r) => r.commodity_code));
  const districts = new Set(rows.map((r) => r.district_code));
  console.log(`Rows to load: ${rows.length.toLocaleString()} (${crops.size} crops, ${districts.size} districts)`);
  for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"} ${c.name}${c.passed ? "" : ` (${c.failedRows} rows)`}`);

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.error("Validation failed. Nothing was written to the database.");
    process.exit(1);
  }
  if (DRY_RUN) {
    console.log("Dry run: validation passed, nothing was written.");
    return;
  }

  // 1. Source record: farm-gate prices from E-Soko, with permission
  await db
    .insert(sources)
    .values({
      code: SOURCE_CODE,
      name: "E-Soko farm-gate prices (via TangaBid), daily reports aggregated to monthly district averages",
      owner: "E-Soko Rwanda (via TangaBid)",
      sourceType: "api",
      accessStatus: "verified",
      accessMethod: "file_import",
      licenceNote: "Written permission from E-Soko granted for use in this project. Attribution required.",
      allowedUse: "Public use with attribution, under the permission granted",
      geographicCoverage: "Rwanda, 30 districts (district averages; no market names published)",
      commodityCoverage: "Crops: maize, beans, rice, cassava, sweet potato, Irish potato, sorghum, wheat, soya, groundnut, tomato, onion, banana",
      coverageStart: "2025-01-01",
      coverageEnd: "2026-10-26",
      updateFrequency: "Daily reports, aggregated monthly",
      lastVerifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: sources.code });
  const [source] = await db.select().from(sources).where(eq(sources.code, SOURCE_CODE));

  // 2. Make sure the crops and the farm-gate metric exist (idempotent, from the reference lists)
  for (const c of readReference("commodities.csv")) {
    await db
      .insert(commodities)
      .values({ code: c.code, nameEn: c.name_en, nameRw: c.name_rw, category: c.category as "crop" | "livestock", notes: c.notes || null })
      .onConflictDoNothing({ target: commodities.code });
  }
  const m = readReference("metrics.csv").find((r) => r.code === METRIC);
  if (!m) throw new Error(`Metric ${METRIC} is missing from data/reference/metrics.csv`);
  await db
    .insert(metrics)
    .values({ code: m.code, nameEn: m.name_en, unit: m.unit, geographicLevel: m.geographic_level, description: m.description || null })
    .onConflictDoNothing({ target: metrics.code });

  // 3. Stop if this exact file was already loaded
  const [existing] = await db
    .select({ id: rawImports.id })
    .from(rawImports)
    .where(and(eq(rawImports.sha256, fileHash), eq(rawImports.sourceId, source.id)));
  if (existing) {
    console.log(`This file was already loaded (import #${existing.id}). Nothing to do.`);
    return;
  }

  // 4. Register the import and its checks
  const starts = rows.map((r) => r.period_start).sort();
  const ends = rows.map((r) => r.period_end).sort();
  const [importRow] = await db
    .insert(rawImports)
    .values({
      sourceId: source.id,
      filename: path.basename(CLEAN_PATH),
      storagePath: CLEAN_PATH.split(path.sep).join("/"),
      sha256: fileHash,
      rowCount: rows.length,
      periodStart: starts[0],
      periodEnd: ends[ends.length - 1],
      status: "approved",
      approvedAt: new Date(),
      notes: "Cleaned by pipeline/prepare_tangabid_prices.py. Farm-gate prices; monthly district averages; no market names.",
    })
    .returning({ id: rawImports.id });

  await db.insert(validationResults).values(
    checks.map((c) => ({
      importId: importRow.id,
      checkName: c.name,
      severity: "error",
      passed: c.passed,
      failedRows: c.failedRows,
      detail: c.detail ?? null,
    })),
  );

  // 5. Observations: district-month averages, no market (marketId stays null)
  const observationRows = rows.map((r, index) => ({
    importId: importRow.id,
    sourceId: source.id,
    districtCode: r.district_code,
    marketId: null,
    commodityCode: r.commodity_code,
    metricCode: METRIC,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    value: Number(r.value),
    unit: r.unit.trim(),
    dataStatus: "observed" as const,
    sourceRow: index + 2,
  }));

  for (let i = 0; i < observationRows.length; i += BATCH_SIZE) {
    await db.insert(observations).values(observationRows.slice(i, i + BATCH_SIZE)).onConflictDoNothing();
  }

  // 6. Audit
  await db.insert(auditLog).values({
    action: "import_approved",
    entityType: "raw_import",
    entityId: String(importRow.id),
    payload: { file: CLEAN_PATH, rows: rows.length, sha256: fileHash, source: SOURCE_CODE, metric: METRIC, dataStatus: "observed" },
  });

  console.log(`Loaded ${rows.length.toLocaleString()} observed farm-gate district-month rows as import #${importRow.id}.`);
}

main().catch((error) => {
  console.error("TangaBid load failed:", error);
  process.exit(1);
});
