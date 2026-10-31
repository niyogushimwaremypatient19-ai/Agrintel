/**
 * Loads data/clean/subnational_rainfall_anomalies_district.csv into Neon PostgreSQL as observed data.
 *
 * Source: CHIRPS v2.0 (Climate Hazards Center) & Meteo Rwanda Subnational Station Network
 *
 * Steps: validate -> register the CHIRPS source -> register raw import -> store
 * validation results -> insert climate observations (rainfall, anomaly ratio, temp, DSI) -> audit.
 *
 * Run with:
 *   npm run db:load:climate -- --dry-run     (validate only)
 *   npm run db:load:climate                  (load into Neon)
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db, schema } from "./index";

const { sources, rawImports, validationResults, observations, auditLog } = schema;

const SOURCE_CODE = "CHIRPS-METEO-RWANDA";
const CLEAN_PATH = path.join("data", "clean", "subnational_rainfall_anomalies_district.csv");
const REFERENCE_DIR = path.join("data", "reference");
const BATCH_SIZE = 500;

const REQUIRED_COLUMNS = [
  "period_start",
  "period_end",
  "district_code",
  "rainfall_mm",
  "rainfall_historical_avg_mm",
  "rainfall_anomaly_ratio",
  "r1q_ratio",
  "r3q_ratio",
  "temp_max_c",
  "dry_spell_days",
] as const;

type ClimateRow = Record<(typeof REQUIRED_COLUMNS)[number], string> & {
  dairy_stress_index?: string;
  source: string;
};

const DRY_RUN = process.argv.includes("--dry-run");

function readReference(file: string, column: string): Set<string> {
  const text = readFileSync(path.join(process.cwd(), REFERENCE_DIR, file), "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return new Set(parsed.data.map((row) => row[column]));
}

type Check = { name: string; passed: boolean; failedRows: number; detail?: unknown };

function validate(rows: ClimateRow[], headers: string[]): Check[] {
  const districtCodes = readReference("districts.csv", "code");
  const checks: Check[] = [];

  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  checks.push({ name: "required_columns", passed: missing.length === 0, failedRows: 0, detail: missing });

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const badDates = rows.filter(
    (r) => !datePattern.test(r.period_start) || !datePattern.test(r.period_end) || r.period_end < r.period_start,
  );
  checks.push({ name: "date_format_and_order", passed: badDates.length === 0, failedRows: badDates.length });

  const badRainfall = rows.filter((r) => !Number.isFinite(Number(r.rainfall_mm)) || Number(r.rainfall_mm) < 0);
  checks.push({ name: "numeric_non_negative_rainfall", passed: badRainfall.length === 0, failedRows: badRainfall.length });

  const unknownDistricts = rows.filter((r) => !districtCodes.has(r.district_code));
  checks.push({ name: "district_codes_known", passed: unknownDistricts.length === 0, failedRows: unknownDistricts.length });

  const keys = rows.map((r) => `${r.district_code}|${r.period_start}`);
  const duplicates = keys.length - new Set(keys).size;
  checks.push({ name: "no_duplicate_district_month", passed: duplicates === 0, failedRows: duplicates });

  return checks;
}

async function main() {
  const absolute = path.join(process.cwd(), CLEAN_PATH);
  const text = readFileSync(absolute, "utf8");
  const sha256 = createHash("sha256").update(text).digest("hex");
  const parsed = Papa.parse<ClimateRow>(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data;
  const headers = parsed.meta.fields ?? [];
  const checks = validate(rows, headers);

  console.log("Validation checks for CHIRPS Subnational Climate dataset:");
  for (const c of checks) {
    console.log(`  [${c.passed ? "PASS" : "FAIL"}] ${c.name} (${c.failedRows} bad rows)`);
  }

  const critical = checks.filter((c) => !c.passed);
  if (critical.length > 0) {
    console.error("Critical validation failure. Ingestion aborted.");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`\n--dry-run: validated ${rows.length} rows successfully.`);
    return;
  }

  // Register or get source
  let [source] = await db.select().from(sources).where(eq(sources.code, SOURCE_CODE));
  if (!source) {
    [source] = await db
      .insert(sources)
      .values({
        code: SOURCE_CODE,
        name: "CHIRPS v2.0 Satellite Precipitation & Meteo Rwanda Subnational Indicators",
        owner: "Climate Hazards Center (UCSB) / Meteo Rwanda (MINEMA)",
        sourceType: "api",
        accessStatus: "verified",
        accessMethod: "file_import",
        licenceNote: "Open Access Satellite Gridded Product (0.05° resolution) via HDX Rwanda",
        allowedUse: "Agro-climatic monitoring, drought early warning, and crop yield modeling",
        geographicCoverage: "All 30 Districts of Rwanda (Subnational Administrative 2)",
        commodityCoverage: "Rainfed Agro-Ecological Zones, Marshland Catchments, and Pastoral Corridors",
        updateFrequency: "10-Day Dekadal & Monthly",
        referenceUrl: "https://data.humdata.org/dataset/rwanda-subnational-rainfall-and-food-prices",
        lastVerifiedAt: new Date(),
      })
      .returning();
    console.log(`Registered source: ${SOURCE_CODE}`);
  }

  // Register raw import
  const minPeriod = rows.reduce((min, r) => (r.period_start < min ? r.period_start : min), rows[0].period_start);
  const maxPeriod = rows.reduce((max, r) => (r.period_end > max ? r.period_end : max), rows[0].period_end);

  const [importRow] = await db
    .insert(rawImports)
    .values({
      sourceId: source.id,
      filename: path.basename(CLEAN_PATH),
      storagePath: CLEAN_PATH,
      sha256,
      rowCount: rows.length,
      periodStart: minPeriod,
      periodEnd: maxPeriod,
      status: "approved",
      notes: "Subnational CHIRPS rainfall anomaly and pastoral Dairy Stress Index series.",
      approvedAt: new Date(),
    })
    .returning();
  console.log(`Registered import #${importRow.id} for ${rows.length} records`);

  // Record validation results
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

  // Map to observation rows
  const observationValues: Array<{
    importId: number;
    sourceId: number;
    districtCode: string;
    marketId: number | null;
    commodityCode: string | null;
    metricCode: string;
    periodStart: string;
    periodEnd: string;
    value: number;
    unit: string;
    dataStatus: "observed";
    sourceRow: number;
  }> = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 2;

    // 1. Observed Rainfall
    observationValues.push({
      importId: importRow.id,
      sourceId: source.id,
      districtCode: r.district_code,
      marketId: null,
      commodityCode: null,
      metricCode: "rainfall_mm",
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.rainfall_mm),
      unit: "mm",
      dataStatus: "observed",
      sourceRow: rowNum,
    });

    // 2. Rainfall Anomaly Ratio
    observationValues.push({
      importId: importRow.id,
      sourceId: source.id,
      districtCode: r.district_code,
      marketId: null,
      commodityCode: null,
      metricCode: "rainfall_anomaly_ratio",
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.rainfall_anomaly_ratio),
      unit: "ratio",
      dataStatus: "observed",
      sourceRow: rowNum,
    });

    // 3. Max Temperature
    if (r.temp_max_c && Number.isFinite(Number(r.temp_max_c))) {
      observationValues.push({
        importId: importRow.id,
        sourceId: source.id,
        districtCode: r.district_code,
        marketId: null,
        commodityCode: null,
        metricCode: "temp_max_c",
        periodStart: r.period_start,
        periodEnd: r.period_end,
        value: Number(r.temp_max_c),
        unit: "°C",
        dataStatus: "observed",
        sourceRow: rowNum,
      });
    }

    // 4. Dairy Stress Index (pastoral districts)
    if (r.dairy_stress_index && Number.isFinite(Number(r.dairy_stress_index))) {
      observationValues.push({
        importId: importRow.id,
        sourceId: source.id,
        districtCode: r.district_code,
        marketId: null,
        commodityCode: null,
        metricCode: "dairy_stress_index",
        periodStart: r.period_start,
        periodEnd: r.period_end,
        value: Number(r.dairy_stress_index),
        unit: "index 0-100",
        dataStatus: "observed",
        sourceRow: rowNum,
      });
    }
  });

  // Batch insert observations
  console.log(`Inserting ${observationValues.length} climate observations...`);
  for (let i = 0; i < observationValues.length; i += BATCH_SIZE) {
    const batch = observationValues.slice(i, i + BATCH_SIZE);
    await db.insert(observations).values(batch);
    console.log(`  Inserted batch: ${Math.min(i + BATCH_SIZE, observationValues.length)} / ${observationValues.length}`);
  }

  // Audit
  await db.insert(auditLog).values({
    action: "import_approved",
    entityType: "import",
    entityId: String(importRow.id),
    payload: {
      source: SOURCE_CODE,
      rowCount: rows.length,
      observationsCount: observationValues.length,
      file: CLEAN_PATH,
      sha256,
    },
  });

  console.log(`\nSuccessfully loaded ${observationValues.length} CHIRPS climate observations into Neon.`);
}

main().catch((err) => {
  console.error("Climate loader failed:", err);
  process.exit(1);
});
