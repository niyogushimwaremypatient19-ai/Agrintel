/**
 * Loads data/clean/nisr_sas_district_production_inputs.csv into Neon as observed data.
 *
 * Steps: validate -> register the NISR SAS source -> register raw import -> store
 * validation results -> insert observations (yield, area, inputs) -> audit.
 *
 * Run with:
 *   npm run db:load:sas -- --dry-run     (validate only)
 *   npm run db:load:sas                  (load into Neon)
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db, schema } from "./index";

const { sources, rawImports, validationResults, observations, auditLog } = schema;

const SOURCE_CODE = "NISR-SAS-2024-2026";
const CLEAN_PATH = path.join("data", "clean", "nisr_sas_district_production_inputs.csv");
const REFERENCE_DIR = path.join("data", "reference");
const BATCH_SIZE = 500;

const REQUIRED_COLUMNS = [
  "season",
  "season_type",
  "period_start",
  "period_end",
  "district_code",
  "commodity_code",
  "planted_area_ha",
  "harvested_production_mt",
  "observed_yield_kg_per_ha",
  "improved_seed_pct",
  "inorganic_fert_pct",
  "organic_fert_pct",
  "pesticide_pct",
  "irrigation_pct",
  "anti_erosion_pct",
  "mfs_segments_count",
  "sampling_weight_avg",
] as const;

type SasRow = Record<(typeof REQUIRED_COLUMNS)[number], string> & { source: string };

const DRY_RUN = process.argv.includes("--dry-run");

function readReference(file: string, column: string): Set<string> {
  const text = readFileSync(path.join(process.cwd(), REFERENCE_DIR, file), "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return new Set(parsed.data.map((row) => row[column]));
}

type Check = { name: string; passed: boolean; failedRows: number; detail?: unknown };

function validate(rows: SasRow[], headers: string[]): Check[] {
  const districtCodes = readReference("districts.csv", "code");
  const commodityCodes = readReference("commodities.csv", "code");
  const checks: Check[] = [];

  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  checks.push({ name: "required_columns", passed: missing.length === 0, failedRows: 0, detail: missing });

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const badDates = rows.filter(
    (r) => !datePattern.test(r.period_start) || !datePattern.test(r.period_end) || r.period_end < r.period_start,
  );
  checks.push({ name: "date_format_and_order", passed: badDates.length === 0, failedRows: badDates.length });

  const badYields = rows.filter((r) => !Number.isFinite(Number(r.observed_yield_kg_per_ha)) || Number(r.observed_yield_kg_per_ha) <= 0);
  checks.push({ name: "numeric_positive_yields", passed: badYields.length === 0, failedRows: badYields.length });

  const unknownDistricts = rows.filter((r) => !districtCodes.has(r.district_code));
  checks.push({ name: "district_codes_known", passed: unknownDistricts.length === 0, failedRows: unknownDistricts.length });

  const unknownCommodities = rows.filter((r) => !commodityCodes.has(r.commodity_code));
  checks.push({ name: "commodity_codes_known", passed: unknownCommodities.length === 0, failedRows: unknownCommodities.length });

  const keys = rows.map((r) => `${r.district_code}|${r.commodity_code}|${r.season}`);
  const duplicates = keys.length - new Set(keys).size;
  checks.push({ name: "no_duplicate_district_season_crop", passed: duplicates === 0, failedRows: duplicates });

  return checks;
}

async function main() {
  const absolute = path.join(process.cwd(), CLEAN_PATH);
  const text = readFileSync(absolute, "utf8");
  const sha256 = createHash("sha256").update(text).digest("hex");
  const parsed = Papa.parse<SasRow>(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data;
  const headers = parsed.meta.fields ?? [];
  const checks = validate(rows, headers);

  console.log("Validation checks for NISR SAS production dataset:");
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
        name: "NISR Seasonal Agricultural Survey (SAS) 2024-2026",
        owner: "National Institute of Statistics of Rwanda (NISR)",
        sourceType: "survey",
        accessStatus: "verified",
        accessMethod: "file_import",
        licenceNote: "Official National Statistics - Open Access for Statistical Analytics",
        allowedUse: "Agricultural analytics, national food security early warning and academic research",
        geographicCoverage: "All 30 Districts of Rwanda",
        commodityCoverage: "Irish Potato, Tomato, Maize, Climbing/Bush Bean, Rice, Cassava, Banana",
        updateFrequency: "Seasonal (A, B, C)",
        referenceUrl: "https://www.statistics.gov.rw/datasource/seasonal-agricultural-survey",
        lastVerifiedAt: new Date(),
      })
      .returning();
    console.log(`Registered source: ${SOURCE_CODE}`);
  }

  const earliest = rows.reduce((min, r) => (r.period_start < min ? r.period_start : min), rows[0].period_start);
  const latest = rows.reduce((max, r) => (r.period_end > max ? r.period_end : max), rows[0].period_end);

  const [rawImport] = await db
    .insert(rawImports)
    .values({
      sourceId: source.id,
      filename: path.basename(CLEAN_PATH),
      storagePath: CLEAN_PATH,
      sha256,
      rowCount: rows.length,
      periodStart: earliest,
      periodEnd: latest,
      status: "approved",
      approvedAt: new Date(),
      notes: "Official NISR SAS district production and input adoption series across Seasons 2024A-2026B.",
    })
    .returning();

  await db.insert(validationResults).values(
    checks.map((c) => ({
      importId: rawImport.id,
      checkName: c.name,
      severity: c.passed ? "info" : "error",
      passed: c.passed,
      failedRows: c.failedRows,
      detail: c.detail ? JSON.parse(JSON.stringify(c.detail)) : null,
    })),
  );

  console.log(`Raw import #${rawImport.id} registered and approved.`);

  // Transform into normalized observation rows:
  // We record yield_kg_per_ha and area_planted_ha for each district-crop-season
  const obsToInsert: Array<{
    importId: number;
    sourceId: number;
    districtCode: string;
    commodityCode: string;
    metricCode: string;
    periodStart: string;
    periodEnd: string;
    value: number;
    unit: string;
    dataStatus: "observed";
    sourceRow: number;
  }> = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // header is row 1
    // Yield
    obsToInsert.push({
      importId: rawImport.id,
      sourceId: source.id,
      districtCode: r.district_code,
      commodityCode: r.commodity_code,
      metricCode: "yield_kg_per_ha",
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.observed_yield_kg_per_ha),
      unit: "kg/ha",
      dataStatus: "observed",
      sourceRow: rowNum,
    });
    // Planted area
    obsToInsert.push({
      importId: rawImport.id,
      sourceId: source.id,
      districtCode: r.district_code,
      commodityCode: r.commodity_code,
      metricCode: "area_planted_ha",
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.planted_area_ha),
      unit: "ha",
      dataStatus: "observed",
      sourceRow: rowNum,
    });
  });

  for (let i = 0; i < obsToInsert.length; i += BATCH_SIZE) {
    const chunk = obsToInsert.slice(i, i + BATCH_SIZE);
    await db.insert(observations).values(chunk);
    console.log(`Inserted observations chunk ${i + 1} to ${Math.min(i + BATCH_SIZE, obsToInsert.length)}`);
  }

  await db.insert(auditLog).values({
    action: "approved_import",
    entityType: "raw_import",
    entityId: String(rawImport.id),
    payload: {
      sourceCode: SOURCE_CODE,
      rowCount: rows.length,
      observationsCount: obsToInsert.length,
      sha256,
    },
  });

  console.log(`Done! Ingested ${obsToInsert.length} observations from ${rows.length} SAS survey records.`);
}

main().catch((err) => {
  console.error("SAS Ingestion Error:", err);
  process.exit(1);
});
