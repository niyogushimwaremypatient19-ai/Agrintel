/**
 * Loads data/clean/wfp_prices_irish_potato_tomato_rwa.csv into Neon as observed data.
 *
 * Steps: validate -> register the WFP source -> register the raw import -> store
 * validation results -> upsert markets -> insert observations -> audit.
 *
 * Refugee camp markets are excluded by default. Use --include-camps to load them.
 * Use --dry-run to validate and print counts without touching the database.
 *
 * Run with:
 *   npm run db:load:wfp            (loads into Neon)
 *   npm run db:load:wfp -- --dry-run
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db, schema } from "./index";

const { sources, markets, rawImports, validationResults, observations, auditLog } = schema;

const SOURCE_CODE = "WFP-HDX-RWA-FOOD-PRICES";
const CLEAN_PATH = path.join("data", "clean", "wfp_prices_irish_potato_tomato_rwa.csv");
const REFERENCE_DIR = path.join("data", "reference");
const BATCH_SIZE = 500; // keeps each insert well under Postgres' parameter limit

const REQUIRED_COLUMNS = [
  "period_start",
  "period_end",
  "market_name",
  "district_code",
  "commodity_code",
  "metric_code",
  "value",
  "unit",
  "is_camp",
] as const;

type CleanRow = Record<(typeof REQUIRED_COLUMNS)[number], string> & {
  wfp_market_id: string;
  admin1: string;
  admin2: string;
  latitude: string;
  longitude: string;
};

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const INCLUDE_CAMPS = args.has("--include-camps");

function readReference(file: string, column: string): Set<string> {
  const text = readFileSync(path.join(process.cwd(), REFERENCE_DIR, file), "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return new Set(parsed.data.map((row) => row[column]));
}

function readMetricUnits(): Map<string, string> {
  const text = readFileSync(path.join(process.cwd(), REFERENCE_DIR, "metrics.csv"), "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return new Map(parsed.data.map((row) => [row.code, row.unit]));
}

type Check = { name: string; passed: boolean; failedRows: number; detail?: unknown };

function validate(rows: CleanRow[], headers: string[]): Check[] {
  const districtCodes = readReference("districts.csv", "code");
  const commodityCodes = readReference("commodities.csv", "code");
  const metricUnits = readMetricUnits();
  const checks: Check[] = [];

  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  checks.push({ name: "required_columns", passed: missing.length === 0, failedRows: 0, detail: missing });

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const badDates = rows.filter((r) => !datePattern.test(r.period_start) || !datePattern.test(r.period_end) || r.period_end < r.period_start);
  checks.push({ name: "date_format_and_order", passed: badDates.length === 0, failedRows: badDates.length });

  const badValues = rows.filter((r) => !Number.isFinite(Number(r.value)) || Number(r.value) <= 0);
  checks.push({ name: "numeric_positive_values", passed: badValues.length === 0, failedRows: badValues.length });

  const badUnits = rows.filter((r) => r.unit.trim() !== metricUnits.get(r.metric_code));
  checks.push({ name: "unit_matches_metric", passed: badUnits.length === 0, failedRows: badUnits.length });

  const unknownDistricts = rows.filter((r) => !districtCodes.has(r.district_code));
  checks.push({ name: "district_codes_known", passed: unknownDistricts.length === 0, failedRows: unknownDistricts.length });

  const unknownCommodities = rows.filter((r) => !commodityCodes.has(r.commodity_code));
  checks.push({ name: "commodity_codes_known", passed: unknownCommodities.length === 0, failedRows: unknownCommodities.length });

  const keys = rows.map((r) => `${r.market_name}|${r.district_code}|${r.commodity_code}|${r.period_start}`);
  const duplicates = keys.length - new Set(keys).size;
  checks.push({ name: "no_duplicate_rows", passed: duplicates === 0, failedRows: duplicates });

  return checks;
}

async function main() {
  const absolute = path.join(process.cwd(), CLEAN_PATH);
  const content = readFileSync(absolute, "utf8");
  const fileHash = createHash("sha256").update(content, "utf8").digest("hex");

  const parsed = Papa.parse<CleanRow>(content, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse error at row ${parsed.errors[0].row}: ${parsed.errors[0].message}`);
  }
  const headers = parsed.meta.fields ?? [];
  const allRows = parsed.data;

  const rows = INCLUDE_CAMPS ? allRows : allRows.filter((r) => r.is_camp.trim().toLowerCase() !== "true");
  const excludedCamps = allRows.length - rows.length;
  console.log(`Rows in clean file: ${allRows.length.toLocaleString()}`);
  console.log(`Refugee camp rows ${INCLUDE_CAMPS ? "included" : "excluded"}: ${INCLUDE_CAMPS ? 0 : excludedCamps.toLocaleString()}`);
  console.log(`Rows to load: ${rows.length.toLocaleString()}`);

  const checks = validate(rows, headers);
  const failed = checks.filter((c) => !c.passed);
  for (const c of checks) console.log(`  ${c.passed ? "PASS" : "FAIL"} ${c.name}${c.passed ? "" : ` (${c.failedRows} rows)`}`);
  if (failed.length > 0) {
    console.error("Validation failed. Nothing was written to the database.");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("Dry run: validation passed, nothing was written.");
    return;
  }

  // 1. Register the WFP source (its own record, not the sample source)
  await db
    .insert(sources)
    .values({
      code: SOURCE_CODE,
      name: "Rwanda - Food Prices (WFP, via Humanitarian Data Exchange)",
      owner: "World Food Programme (WFP)",
      sourceType: "file",
      accessStatus: "verified",
      accessMethod: "file_import",
      licenceNote:
        "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO 3.0). Attribution required; changes must be stated.",
      allowedUse: "Public use with attribution, including commercial use under CC BY-IGO",
      geographicCoverage: "Rwanda, 28 districts (Irish potatoes); tomato markets in historical data",
      commodityCoverage: "Irish potatoes (2008 to 2026), tomatoes (2012 to 2015)",
      coverageStart: "2008-01-01",
      coverageEnd: "2026-07-31",
      updateFrequency: "Monthly (per HDX)",
      referenceUrl: "https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508",
      lastVerifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: sources.code });

  const [source] = await db.select().from(sources).where(eq(sources.code, SOURCE_CODE));

  // 2. Stop if this exact cleaned file was already loaded
  const [existing] = await db
    .select({ id: rawImports.id })
    .from(rawImports)
    .where(and(eq(rawImports.sha256, fileHash), eq(rawImports.sourceId, source.id)));
  if (existing) {
    console.log(`This cleaned file was already loaded (import #${existing.id}). Nothing to do.`);
    return;
  }

  // 3. Register the import and its validation results
  const periods = rows.map((r) => r.period_start).sort();
  const ends = rows.map((r) => r.period_end).sort();
  const [importRow] = await db
    .insert(rawImports)
    .values({
      sourceId: source.id,
      filename: path.basename(CLEAN_PATH),
      storagePath: CLEAN_PATH.split(path.sep).join("/"),
      sha256: fileHash,
      rowCount: rows.length,
      periodStart: periods[0],
      periodEnd: ends[ends.length - 1],
      status: "approved",
      approvedAt: new Date(),
      notes: `Cleaned by pipeline/prepare_wfp_prices.py. Refugee camp markets ${INCLUDE_CAMPS ? "included" : "excluded"}.`,
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

  // 4. Markets (named as published by WFP, placed in our district codes)
  const marketKeys = new Map<string, CleanRow>();
  for (const r of rows) marketKeys.set(`${r.market_name}|${r.district_code}`, r);
  for (const r of marketKeys.values()) {
    await db
      .insert(markets)
      .values({ name: r.market_name, districtCode: r.district_code, sourceId: source.id })
      .onConflictDoNothing();
  }
  const marketId = new Map<string, number>();
  for (const key of marketKeys.keys()) {
    const [name, district] = key.split("|");
    const [market] = await db
      .select({ id: markets.id })
      .from(markets)
      .where(and(eq(markets.name, name), eq(markets.districtCode, district)));
    marketId.set(key, market.id);
  }

  // 5. Observations, stored as observed (not sample), in batches
  const observationRows = rows.map((r, index) => ({
    importId: importRow.id,
    sourceId: source.id,
    districtCode: r.district_code,
    marketId: marketId.get(`${r.market_name}|${r.district_code}`) ?? null,
    commodityCode: r.commodity_code,
    metricCode: r.metric_code,
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

  // 6. Audit trail
  await db.insert(auditLog).values({
    action: "import_approved",
    entityType: "raw_import",
    entityId: String(importRow.id),
    payload: {
      file: CLEAN_PATH,
      rows: rows.length,
      sha256: fileHash,
      source: SOURCE_CODE,
      dataStatus: "observed",
      campMarketsIncluded: INCLUDE_CAMPS,
    },
  });

  console.log(`Loaded ${rows.length.toLocaleString()} observed price rows as import #${importRow.id}.`);
}

main().catch((error) => {
  console.error("WFP load failed:", error);
  process.exit(1);
});
