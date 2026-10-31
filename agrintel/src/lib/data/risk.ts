import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { PRICE_METRIC, verifiedObservationsOnly } from "@/lib/data/prices";

const { districts, riskSignals, observations, rawImports, sources } = schema;

export type RiskCategory = "low" | "moderate" | "high" | "unavailable";

/** Parsed form of risk_signals.driver_summary (written by pipeline/risk_signals.py). */
export type RiskDriver = {
  rule: string;
  ruleVersion: string;
  changePct: number;
  recentAverage: number;
  previousAverage: number;
  months: number;
  basedOnSample: boolean;
  importIds: number[];
};

export function parseDriver(raw: string | null): RiskDriver | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RiskDriver;
    if (typeof parsed.changePct !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export const FALLBACK_DISTRICTS = [
  // Kigali City
  { code: "GASABO", nameEn: "Gasabo", nameRw: "Gasabo", province: "Kigali City" },
  { code: "KICUKIRO", nameEn: "Kicukiro", nameRw: "Kicukiro", province: "Kigali City" },
  { code: "NYARUGENGE", nameEn: "Nyarugenge", nameRw: "Nyarugenge", province: "Kigali City" },
  // Eastern Province
  { code: "BUGESERA", nameEn: "Bugesera", nameRw: "Bugesera", province: "Eastern" },
  { code: "GATSIBO", nameEn: "Gatsibo", nameRw: "Gatsibo", province: "Eastern" },
  { code: "KAYONZA", nameEn: "Kayonza", nameRw: "Kayonza", province: "Eastern" },
  { code: "KIREHE", nameEn: "Kirehe", nameRw: "Kirehe", province: "Eastern" },
  { code: "NGOMA", nameEn: "Ngoma", nameRw: "Ngoma", province: "Eastern" },
  { code: "NYAGATARE", nameEn: "Nyagatare", nameRw: "Nyagatare", province: "Eastern" },
  { code: "RWAMAGANA", nameEn: "Rwamagana", nameRw: "Rwamagana", province: "Eastern" },
  // Northern Province
  { code: "BURERA", nameEn: "Burera", nameRw: "Burera", province: "Northern" },
  { code: "GAKENKE", nameEn: "Gakenke", nameRw: "Gakenke", province: "Northern" },
  { code: "GICUMBI", nameEn: "Gicumbi", nameRw: "Gicumbi", province: "Northern" },
  { code: "MUSANZE", nameEn: "Musanze", nameRw: "Musanze", province: "Northern" },
  { code: "RULINDO", nameEn: "Rulindo", nameRw: "Rulindo", province: "Northern" },
  // Southern Province
  { code: "GISAGARA", nameEn: "Gisagara", nameRw: "Gisagara", province: "Southern" },
  { code: "HUYE", nameEn: "Huye", nameRw: "Huye", province: "Southern" },
  { code: "KAMONYI", nameEn: "Kamonyi", nameRw: "Kamonyi", province: "Southern" },
  { code: "MUHANGA", nameEn: "Muhanga", nameRw: "Muhanga", province: "Southern" },
  { code: "NAGAMAGABE", nameEn: "Nyamagabe", nameRw: "Nyamagabe", province: "Southern" },
  { code: "NANZA", nameEn: "Nyanza", nameRw: "Nyanza", province: "Southern" },
  { code: "NYARUGURU", nameEn: "Nyaruguru", nameRw: "Nyaruguru", province: "Southern" },
  { code: "RUHANGO", nameEn: "Ruhango", nameRw: "Ruhango", province: "Southern" },
  // Western Province
  { code: "KARONGI", nameEn: "Karongi", nameRw: "Karongi", province: "Western" },
  { code: "NGORORERO", nameEn: "Ngororero", nameRw: "Ngororero", province: "Western" },
  { code: "NYABIHU", nameEn: "Nyabihu", nameRw: "Nyabihu", province: "Western" },
  { code: "NYAMASHEKE", nameEn: "Nyamasheke", nameRw: "Nyamasheke", province: "Western" },
  { code: "RUBAVU", nameEn: "Rubavu", nameRw: "Rubavu", province: "Western" },
  { code: "RUSIZI", nameEn: "Rusizi", nameRw: "Rusizi", province: "Western" },
  { code: "RUTSIRO", nameEn: "Rutsiro", nameRw: "Rutsiro", province: "Western" },
];

/** All 30 official administrative districts of Rwanda queried directly from database with resilient fallback. */
export async function getAllDistricts() {
  try {
    const rows = await db
      .select({
        code: districts.code,
        nameEn: districts.nameEn,
        nameRw: districts.nameRw,
        province: districts.province,
      })
      .from(districts)
      .orderBy(asc(districts.province), asc(districts.nameEn));
    if (rows && rows.length > 0) return rows;
  } catch (err) {
    console.warn("Neon DB query failed in getAllDistricts, using 30-district reference fallback:", err);
  }
  return FALLBACK_DISTRICTS;
}

export interface RiskSignalRecord {
  id: number;
  districtCode: string;
  category: string;
  periodStart: string;
  periodEnd: string;
  driverSummary: string | null;
  createdAt: Date;
}

/** Current risk signal per district for one crop. Only current rows are returned. */
export async function getCurrentRiskSignals(commodityCode: string): Promise<RiskSignalRecord[]> {
  try {
    const dbSignals = await db
      .select({
        id: riskSignals.id,
        districtCode: riskSignals.districtCode,
        category: riskSignals.category,
        periodStart: riskSignals.periodStart,
        periodEnd: riskSignals.periodEnd,
        driverSummary: riskSignals.driverSummary,
        createdAt: riskSignals.createdAt,
      })
      .from(riskSignals)
      .where(and(eq(riskSignals.commodityCode, commodityCode), eq(riskSignals.isCurrent, true)));

    if (dbSignals.length > 0) {
      return dbSignals;
    }

    // Dynamic derivation from verified empirical price observations
    const obsRows = await db
      .select({
        districtCode: observations.districtCode,
        periodStart: observations.periodStart,
        value: observations.value,
      })
      .from(observations)
      .innerJoin(rawImports, eq(observations.importId, rawImports.id))
      .innerJoin(sources, eq(observations.sourceId, sources.id))
      .where(
        and(
          eq(observations.commodityCode, commodityCode),
          inArray(observations.metricCode, ["price_rwf_per_kg", "farmgate_price_rwf_per_kg"]),
          eq(rawImports.status, "approved"),
          isNotNull(observations.districtCode),
          verifiedObservationsOnly,
        ),
      )
      .orderBy(asc(observations.periodStart));

    if (obsRows.length === 0) return [];

    // Group observations by district
    const byDistrict = new Map<string, { period: string; value: number }[]>();
    for (const r of obsRows) {
      if (!r.districtCode) continue;
      const list = byDistrict.get(r.districtCode) ?? [];
      list.push({ period: r.periodStart.slice(0, 7), value: r.value });
      byDistrict.set(r.districtCode, list);
    }

    const computedSignals: RiskSignalRecord[] = [];
    let fakeId = 1;

    for (const [distCode, rawList] of byDistrict.entries()) {
      const buckets = new Map<string, { sum: number; count: number }>();
      for (const item of rawList) {
        const b = buckets.get(item.period) ?? { sum: 0, count: 0 };
        b.sum += item.value;
        b.count += 1;
        buckets.set(item.period, b);
      }
      const monthlySorted = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([p, b]) => ({ period: p, avg: b.sum / b.count }));

      if (monthlySorted.length < 2) continue;

      const monthlyValues = monthlySorted.map((m) => m.avg);
      let change: number | null = null;
      let recentAvg = monthlyValues[monthlyValues.length - 1];
      let prevAvg = monthlyValues[0];

      if (monthlyValues.length >= 6) {
        const recent = monthlyValues.slice(-3);
        const previous = monthlyValues.slice(-6, -3);
        prevAvg = previous.reduce((s, v) => s + v, 0) / 3;
        recentAvg = recent.reduce((s, v) => s + v, 0) / 3;
        change = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : null;
      } else {
        prevAvg = monthlyValues[0];
        recentAvg = monthlyValues[monthlyValues.length - 1];
        change = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : null;
      }

      let category = "low";
      if (change !== null) {
        if (change >= 0.2) category = "high";
        else if (change >= 0.1) category = "moderate";
        else category = "low";
      }

      const driverDoc: RiskDriver = {
        rule: "market_price_pressure",
        ruleVersion: "1.0.0",
        changePct: change ?? 0,
        recentAverage: Math.round(recentAvg),
        previousAverage: Math.round(prevAvg),
        months: monthlyValues.length,
        basedOnSample: false,
        importIds: [],
      };

      computedSignals.push({
        id: fakeId++,
        districtCode: distCode,
        category,
        periodStart: `${monthlySorted[0].period}-01`,
        periodEnd: `${monthlySorted[monthlySorted.length - 1].period}-28`,
        driverSummary: JSON.stringify(driverDoc),
        createdAt: new Date(),
      });
    }

    return computedSignals;
  } catch {
    return [];
  }
}

/** Approved district-level price observations for one district and crop, for the evidence panel. */
export async function getDistrictPriceEvidence(districtCode: string, commodityCode: string) {
  try {
    // 1. Try retail price observations
    const retail = await db
      .select({
        periodStart: observations.periodStart,
        value: observations.value,
        dataStatus: observations.dataStatus,
        sourceName: sources.name,
        approvedAt: rawImports.approvedAt,
      })
      .from(observations)
      .innerJoin(rawImports, eq(observations.importId, rawImports.id))
      .innerJoin(sources, eq(observations.sourceId, sources.id))
      .where(
        and(
          eq(observations.districtCode, districtCode),
          eq(observations.commodityCode, commodityCode),
          eq(observations.metricCode, PRICE_METRIC),
          eq(rawImports.status, "approved"),
          isNotNull(observations.districtCode),
          verifiedObservationsOnly,
        ),
      )
      .orderBy(asc(observations.periodStart));

    if (retail.length > 0) return retail;

    // 2. Fall back to farmgate price observations
    return await db
      .select({
        periodStart: observations.periodStart,
        value: observations.value,
        dataStatus: observations.dataStatus,
        sourceName: sources.name,
        approvedAt: rawImports.approvedAt,
      })
      .from(observations)
      .innerJoin(rawImports, eq(observations.importId, rawImports.id))
      .innerJoin(sources, eq(observations.sourceId, sources.id))
      .where(
        and(
          eq(observations.districtCode, districtCode),
          eq(observations.commodityCode, commodityCode),
          eq(observations.metricCode, "farmgate_price_rwf_per_kg"),
          eq(rawImports.status, "approved"),
          isNotNull(observations.districtCode),
          verifiedObservationsOnly,
        ),
      )
      .orderBy(asc(observations.periodStart));
  } catch {
    return [];
  }
}

