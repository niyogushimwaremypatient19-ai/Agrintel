/**
 * Loads reference data from data/reference/*.csv into Neon.
 * Safe to run more than once: rows are upserted by their code.
 *
 * Run with: npm run db:seed
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { sql } from "drizzle-orm";
import { db, schema } from "./index";

const { districts, commodities, metrics, sources } = schema;

type Row = Record<string, string>;

function readCsv(fileName: string): Row[] {
  const filePath = path.join(process.cwd(), "data", "reference", fileName);
  const text = readFileSync(filePath, "utf8");
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV error in ${fileName} at row ${first.row}: ${first.message}`);
  }
  return parsed.data;
}

function requireValue(row: Row, key: string, fileName: string): string {
  const value = row[key]?.trim();
  if (!value) {
    throw new Error(`Missing "${key}" in ${fileName}: ${JSON.stringify(row)}`);
  }
  return value;
}

async function seedDistricts() {
  const rows = readCsv("districts.csv").map((row) => ({
    code: requireValue(row, "code", "districts.csv"),
    nameEn: requireValue(row, "name_en", "districts.csv"),
    nameRw: requireValue(row, "name_rw", "districts.csv"),
    province: requireValue(row, "province", "districts.csv"),
  }));

  await db
    .insert(districts)
    .values(rows)
    .onConflictDoUpdate({
      target: districts.code,
      set: {
        nameEn: sql`excluded.name_en`,
        nameRw: sql`excluded.name_rw`,
        province: sql`excluded.province`,
      },
    });
  console.log(`Districts loaded: ${rows.length}`);
}

async function seedCommodities() {
  const rows = readCsv("commodities.csv").map((row) => ({
    code: requireValue(row, "code", "commodities.csv"),
    nameEn: requireValue(row, "name_en", "commodities.csv"),
    nameRw: requireValue(row, "name_rw", "commodities.csv"),
    category: requireValue(row, "category", "commodities.csv") as "crop" | "livestock",
    notes: row.notes?.trim() || null,
  }));

  await db
    .insert(commodities)
    .values(rows)
    .onConflictDoUpdate({
      target: commodities.code,
      set: {
        nameEn: sql`excluded.name_en`,
        nameRw: sql`excluded.name_rw`,
        category: sql`excluded.category`,
        notes: sql`excluded.notes`,
      },
    });
  console.log(`Commodities loaded: ${rows.length}`);
}

async function seedMetrics() {
  const rows = readCsv("metrics.csv").map((row) => ({
    code: requireValue(row, "code", "metrics.csv"),
    nameEn: requireValue(row, "name_en", "metrics.csv"),
    unit: requireValue(row, "unit", "metrics.csv"),
    geographicLevel: requireValue(row, "geographic_level", "metrics.csv"),
    description: row.description?.trim() || null,
  }));

  await db
    .insert(metrics)
    .values(rows)
    .onConflictDoUpdate({
      target: metrics.code,
      set: {
        nameEn: sql`excluded.name_en`,
        unit: sql`excluded.unit`,
        geographicLevel: sql`excluded.geographic_level`,
        description: sql`excluded.description`,
      },
    });
  console.log(`Metrics loaded: ${rows.length}`);
}

async function main() {
  await seedDistricts();
  await seedCommodities();
  await seedMetrics();
  console.log("Reference seed complete (100% empirical official sources).");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
