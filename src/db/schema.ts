/**
 * Rwanda Agro-Climatic Intelligence & Food Security Early-Warning Platform
 * Database schema (Neon Postgres, managed with Drizzle ORM)
 *
 * Design rules taken from the MVP plan:
 *  - Every stored value traces back to a source, and to the import it came from.
 *  - Raw imports are never edited; corrections create new rows.
 *  - Each observation and forecast carries a status (observed / estimated / sample,
 *    forecast / scenario) so the UI can never present sample data as live.
 *  - Forecasts record their method, version, horizon and input imports.
 *  - Simulated alerts can never be marked as published.
 *  - Every consequential action is written to the audit log.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  serial,
  bigserial,
  integer,
  text,
  varchar,
  timestamp,
  date,
  boolean,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Verification state of a data source (plan section 5 / Data Sources page). */
export const accessStatusEnum = pgEnum("access_status", [
  "verified",
  "awaiting_access",
  "sample",
  "unavailable",
]);

export const commodityCategoryEnum = pgEnum("commodity_category", ["crop", "livestock"]);

/** How a numeric observation was produced. */
export const dataStatusEnum = pgEnum("data_status", ["observed", "estimated", "sample"]);

/** Whether a derived output is a statistical forecast or a scenario. */
export const outputStatusEnum = pgEnum("output_status", ["forecast", "scenario"]);

export const importStatusEnum = pgEnum("import_status", [
  "received",
  "validated",
  "rejected",
  "approved",
]);

export const riskCategoryEnum = pgEnum("risk_category", [
  "low",
  "moderate",
  "high",
  "unavailable",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "watch",
  "warning",
  "critical",
]);

/** Alert lifecycle from the plan: draft, reviewed, simulated, published. */
export const alertStatusEnum = pgEnum("alert_status", [
  "draft",
  "reviewed",
  "simulated",
  "published",
]);

/** Demo roles from the access table: steward, analyst, extension worker, public. */
export const userRoleEnum = pgEnum("user_role", ["steward", "analyst", "extension", "public"]);

// ---------------------------------------------------------------------------
// Users (demo roles only; full auth is optional per the plan)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default("public"),
  /** Hash only (bcrypt/argon2). Never store plain passwords. Null for non-login users. */
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Source register
// ---------------------------------------------------------------------------

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  /** Short stable identifier, e.g. "NISR-RAHS-2024", "METEO-RW-DAILY". */
  code: varchar("code", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  /** Institution that owns the data: NISR, MINAGRI, Meteo Rwanda, E-Soko, soil provider, ... */
  owner: text("owner").notNull(),
  /** survey | administrative | api | file | sample */
  sourceType: text("source_type").notNull(),
  accessStatus: accessStatusEnum("access_status").notNull().default("awaiting_access"),
  /** api | file_import | manual_upload | sample */
  accessMethod: text("access_method"),
  licenceNote: text("licence_note"),
  allowedUse: text("allowed_use"),
  geographicCoverage: text("geographic_coverage"),
  commodityCoverage: text("commodity_coverage"),
  coverageStart: date("coverage_start"),
  coverageEnd: date("coverage_end"),
  updateFrequency: text("update_frequency"),
  referenceUrl: text("reference_url"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** The 30 districts of Rwanda. Codes are internal slugs; replace with official admin codes if provided. */
export const districts = pgTable("districts", {
  code: varchar("code", { length: 32 }).primaryKey(),
  nameEn: text("name_en").notNull(),
  nameRw: text("name_rw").notNull(),
  province: text("province").notNull(),
});

/** Individual markets, only where a dataset names them (plan: do not invent market names). */
export const markets = pgTable(
  "markets",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    districtCode: varchar("district_code", { length: 32 })
      .notNull()
      .references(() => districts.code),
    sourceId: integer("source_id").references(() => sources.id),
  },
  (t) => [uniqueIndex("markets_name_district_uq").on(t.name, t.districtCode)],
);

export const commodities = pgTable("commodities", {
  code: varchar("code", { length: 32 }).primaryKey(),
  nameEn: text("name_en").notNull(),
  nameRw: text("name_rw").notNull(),
  category: commodityCategoryEnum("category").notNull(),
  notes: text("notes"),
});

/**
 * Metric dictionary. Every observation and forecast must use a registered metric,
 * which fixes its unit and prevents mixing kg with tonnes, or RWF with USD.
 */
export const metrics = pgTable("metrics", {
  code: varchar("code", { length: 48 }).primaryKey(),
  nameEn: text("name_en").notNull(),
  unit: text("unit").notNull(),
  /** district | market */
  geographicLevel: text("geographic_level").notNull(),
  description: text("description"),
});

// ---------------------------------------------------------------------------
// Ingestion: raw imports, validation, lineage
// ---------------------------------------------------------------------------

/** One row per file or API pull. The raw file stays in storage, unchanged. */
export const rawImports = pgTable(
  "raw_imports",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    filename: text("filename").notNull(),
    /** Path or URL where the untouched raw file is kept (repo data folder, Vercel Blob, etc.). */
    storagePath: text("storage_path").notNull(),
    /** SHA-256 of the raw file, used to detect duplicate or changed uploads. */
    sha256: varchar("sha256", { length: 64 }).notNull(),
    rowCount: integer("row_count").notNull().default(0),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    status: importStatusEnum("status").notNull().default("received"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).defaultNow().notNull(),
    uploadedBy: integer("uploaded_by").references(() => users.id),
    approvedBy: integer("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    index("raw_imports_sha_idx").on(t.sha256),
    index("raw_imports_source_idx").on(t.sourceId),
  ],
);

/** Result of each validation check run on an import (schema, dates, units, IDs, duplicates, ranges...). */
export const validationResults = pgTable(
  "validation_results",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => rawImports.id, { onDelete: "cascade" }),
    checkName: text("check_name").notNull(),
    /** error | warning */
    severity: text("severity").notNull(),
    passed: boolean("passed").notNull(),
    failedRows: integer("failed_rows").notNull().default(0),
    detail: jsonb("detail"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("validation_import_idx").on(t.importId)],
);

/**
 * Normalized observations: the cleaned values the app and models read.
 * Every row points to the import it came from and to its source row number.
 */
export const observations = pgTable(
  "observations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => rawImports.id),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    districtCode: varchar("district_code", { length: 32 }).references(() => districts.code),
    marketId: integer("market_id").references(() => markets.id),
    commodityCode: varchar("commodity_code", { length: 32 }).references(() => commodities.code),
    metricCode: varchar("metric_code", { length: 48 })
      .notNull()
      .references(() => metrics.code),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    value: numeric("value", { precision: 18, scale: 4, mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    dataStatus: dataStatusEnum("data_status").notNull(),
    /** Line number in the raw file, so any value can be traced back to its origin. */
    sourceRow: integer("source_row"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("obs_lookup_idx").on(t.districtCode, t.commodityCode, t.metricCode, t.periodStart),
    index("obs_import_idx").on(t.importId),
    // Natural key prevents the same value being loaded twice from one source.
    // COALESCE lets NULL district/market/commodity still count as a duplicate.
    uniqueIndex("obs_natural_key_uq").on(
      t.sourceId,
      t.metricCode,
      sql`coalesce(${t.districtCode}, '')`,
      sql`coalesce(${t.marketId}, 0)`,
      sql`coalesce(${t.commodityCode}, '')`,
      t.periodStart,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Outputs: forecasts, evaluations, lineage, risk signals
// ---------------------------------------------------------------------------

export const forecasts = pgTable(
  "forecasts",
  {
    id: serial("id").primaryKey(),
    districtCode: varchar("district_code", { length: 32 }).references(() => districts.code),
    marketId: integer("market_id").references(() => markets.id),
    commodityCode: varchar("commodity_code", { length: 32 })
      .notNull()
      .references(() => commodities.code),
    metricCode: varchar("metric_code", { length: 48 })
      .notNull()
      .references(() => metrics.code),
    /** Method name, e.g. "seasonal_naive", "holt_winters", "documented_rule". */
    method: text("method").notNull(),
    methodVersion: text("method_version").notNull(),
    outputStatus: outputStatusEnum("output_status").notNull(),
    horizonStart: date("horizon_start").notNull(),
    horizonEnd: date("horizon_end").notNull(),
    pointValue: numeric("point_value", { precision: 18, scale: 4, mode: "number" }),
    lowerBound: numeric("lower_bound", { precision: 18, scale: 4, mode: "number" }),
    upperBound: numeric("upper_bound", { precision: 18, scale: 4, mode: "number" }),
    unit: text("unit").notNull(),
    /** True if any input was sample data. The UI must then show the sample label. */
    basedOnSample: boolean("based_on_sample").notNull().default(false),
    confidenceNote: text("confidence_note"),
    isCurrent: boolean("is_current").notNull().default(true),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (t) => [
    index("forecasts_lookup_idx").on(t.districtCode, t.commodityCode, t.metricCode, t.isCurrent),
    check(
      "forecasts_horizon_valid",
      sql`${t.horizonEnd} >= ${t.horizonStart}`,
    ),
  ],
);

/**
 * Backtest results. Only rows produced by a real held-out evaluation belong here.
 * The plan forbids inventing accuracy scores.
 */
export const forecastEvaluations = pgTable("forecast_evaluations", {
  id: serial("id").primaryKey(),
  method: text("method").notNull(),
  methodVersion: text("method_version").notNull(),
  metricCode: varchar("metric_code", { length: 48 })
    .notNull()
    .references(() => metrics.code),
  districtCode: varchar("district_code", { length: 32 }).references(() => districts.code),
  commodityCode: varchar("commodity_code", { length: 32 }).references(() => commodities.code),
  holdoutStart: date("holdout_start").notNull(),
  holdoutEnd: date("holdout_end").notNull(),
  mae: numeric("mae", { precision: 18, scale: 4, mode: "number" }),
  mape: numeric("mape", { precision: 9, scale: 4, mode: "number" }),
  rmse: numeric("rmse", { precision: 18, scale: 4, mode: "number" }),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Which imports fed which forecast (the "data lineage" the methodology page shows). */
export const forecastInputs = pgTable(
  "forecast_inputs",
  {
    id: serial("id").primaryKey(),
    forecastId: integer("forecast_id")
      .notNull()
      .references(() => forecasts.id, { onDelete: "cascade" }),
    importId: integer("import_id")
      .notNull()
      .references(() => rawImports.id),
    observationCount: integer("observation_count").notNull().default(0),
    role: text("role"),
  },
  (t) => [index("forecast_inputs_forecast_idx").on(t.forecastId)],
);

/** Risk category per district and commodity, shown on the national dashboard. */
export const riskSignals = pgTable(
  "risk_signals",
  {
    id: serial("id").primaryKey(),
    districtCode: varchar("district_code", { length: 32 })
      .notNull()
      .references(() => districts.code),
    commodityCode: varchar("commodity_code", { length: 32 })
      .notNull()
      .references(() => commodities.code),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    category: riskCategoryEnum("category").notNull(),
    /** Plain-language driver explanation, e.g. "Below-average rainfall in the last 60 days". */
    driverSummary: text("driver_summary"),
    forecastId: integer("forecast_id").references(() => forecasts.id),
    isCurrent: boolean("is_current").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("risk_lookup_idx").on(t.districtCode, t.commodityCode, t.isCurrent)],
);

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    districtCode: varchar("district_code", { length: 32 }).references(() => districts.code),
    commodityCode: varchar("commodity_code", { length: 32 }).references(() => commodities.code),
    /** Intended audience, e.g. "farmer", "extension", "analyst". Never a phone number. */
    audience: text("audience").notNull(),
    severity: alertSeverityEnum("severity").notNull().default("info"),
    status: alertStatusEnum("status").notNull().default("draft"),
    /** True for alerts produced by the Simulate Data Update action. */
    isSimulated: boolean("is_simulated").notNull().default(false),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }).notNull(),
    messageEn: text("message_en").notNull(),
    messageRw: text("message_rw"),
    explanation: text("explanation"),
    sourceNote: text("source_note"),
    triggeredByImportId: integer("triggered_by_import_id").references(() => rawImports.id),
    riskSignalId: integer("risk_signal_id").references(() => riskSignals.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("alerts_lookup_idx").on(t.districtCode, t.commodityCode, t.status),
    // A simulated alert can never be published, so it can never be mistaken for a sent message.
    check("alerts_no_simulated_publish", sql`NOT (${t.isSimulated} AND ${t.status} = 'published')`),
    check("alerts_validity_valid", sql`${t.validTo} > ${t.validFrom}`),
  ],
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/** Append-only record of imports, approvals, forecast refreshes, alert changes and simulations. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: integer("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId)],
);

// ---------------------------------------------------------------------------
// Type exports for use in the app and the pipeline
// ---------------------------------------------------------------------------

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type District = typeof districts.$inferSelect;
export type Commodity = typeof commodities.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type RawImport = typeof rawImports.$inferSelect;
export type Observation = typeof observations.$inferSelect;
export type NewObservation = typeof observations.$inferInsert;
export type Forecast = typeof forecasts.$inferSelect;
export type RiskSignal = typeof riskSignals.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
