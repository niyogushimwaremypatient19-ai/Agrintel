"""
AgrIntel Rwanda Master Analytical Data Exporter & Orchestrator.

Executes the econometric audit engine and spatial arbitrage solver, then
serializes clean, typed TypeScript data modules into `src/lib/data/` for
instantaneous 0ms SSR rendering and high-performance frontend queries.

Also outputs clean CSVs into `data/clean/` for Drizzle ORM database loaders.
"""

from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
CLEAN_DIR = BASE_DIR / "data" / "clean"
SRC_DATA_DIR = BASE_DIR / "src" / "lib" / "data"

from prepare_nisr_sas import main as build_sas
from prepare_climate_anomalies import main as build_climate
from prepare_road_distances import main as build_distances
from prepare_cpi_series import main as build_cpi
from econometric_audit_engine import main as run_audit
from spatial_arbitrage_engine import main as run_arbitrage


def export_typescript_modules():
    SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Export Econometric Audit Results
    audit_csv = CLEAN_DIR / "econometric_subsidy_audit_results.csv"
    audit_df = pd.read_csv(audit_csv)
    audit_records = audit_df.to_dict(orient="records")

    audit_ts = f"""/**
 * MINAGRI Climate-Controlled Input-to-Yield Residual & Subsidy Leakage Audit Data
 * Generated autonomously by pipeline/export_analytical_data.py
 * Source: NISR Seasonal Agricultural Survey (SAS) + CHIRPS Climate Series
 */

export interface DistrictAuditRecord {{
  district_code: string;
  commodity_code: string;
  season: string;
  season_type: string;
  period_start: string;
  period_end: string;
  observed_yield_kg_per_ha: number;
  expected_yield_kg_per_ha: number;
  yield_gap_kg_per_ha: number;
  residual_z_score: number;
  climate_factor: number;
  input_factor: number;
  rainfall_anomaly_ratio: number;
  irrigation_pct: number;
  improved_seed_pct: number;
  inorganic_fert_pct: number;
  planted_area_ha: number;
  harvested_production_mt: number;
  classification: "LEAKAGE_OR_SEED_QUALITY_RISK" | "CLIMATIC_OR_WATER_STRESS" | "HIGH_PERFORMING_INTENSIFICATION" | "NOMINAL_EXPECTED_RANGE";
  leakage_risk_flag: boolean;
  estimated_fiscal_exposure_rwf: number;
  diagnostic_rationale: string;
}}

export const ECONOMETRIC_AUDIT_DATA: DistrictAuditRecord[] = {json.dumps(audit_records, indent=2)};

export function getAuditRecordsForDistrict(districtCode: string): DistrictAuditRecord[] {{
  return ECONOMETRIC_AUDIT_DATA.filter((r) => r.district_code === districtCode);
}}

export function getAuditRecordsForCrop(commodityCode: string): DistrictAuditRecord[] {{
  return ECONOMETRIC_AUDIT_DATA.filter((r) => r.commodity_code === commodityCode);
}}

export function getAuditRecordForDistrictAndCommodity(
  districtCode: string,
  commodityCode: string
): DistrictAuditRecord | null {{
  const records = getAuditRecordsForDistrict(districtCode);
  const matching = records.filter((r) => r.commodity_code === commodityCode);
  if (matching.length === 0) return null;
  matching.sort((a, b) => b.period_start.localeCompare(a.period_start));
  return matching[0];
}}

export function getLatestAuditRecords(): DistrictAuditRecord[] {{
  // Group by district and commodity, taking latest season
  const latestMap = new Map<string, DistrictAuditRecord>();
  for (const record of ECONOMETRIC_AUDIT_DATA) {{
    const key = `${{record.district_code}}_${{record.commodity_code}}`;
    const existing = latestMap.get(key);
    if (!existing || record.period_start > existing.period_start) {{
      latestMap.set(key, record);
    }}
  }}
  return Array.from(latestMap.values());
}}

export function getNationalAuditSummary() {{
  const latest = getLatestAuditRecords();
  const leakageFlags = latest.filter((r) => r.classification === "LEAKAGE_OR_SEED_QUALITY_RISK");
  const climateStress = latest.filter((r) => r.classification === "CLIMATIC_OR_WATER_STRESS");
  const highPerformance = latest.filter((r) => r.classification === "HIGH_PERFORMING_INTENSIFICATION");
  const nominal = latest.filter((r) => r.classification === "NOMINAL_EXPECTED_RANGE");

  const totalFiscalExposureRwf = leakageFlags.reduce((sum, r) => sum + r.estimated_fiscal_exposure_rwf, 0);

  return {{
    totalMonitored: latest.length,
    leakageRiskCount: leakageFlags.length,
    climateStressCount: climateStress.length,
    highPerformanceCount: highPerformance.length,
    nominalCount: nominal.length,
    totalFiscalExposureRwf,
  }};
}}
"""
    (SRC_DATA_DIR / "econometric-audit.ts").write_text(audit_ts, encoding="utf-8")
    print(f"Exported TypeScript module: {SRC_DATA_DIR / 'econometric-audit.ts'}")

    # 2. Export Spatial Arbitrage Results
    arbitrage_csv = CLEAN_DIR / "spatial_arbitrage_corridors.csv"
    arb_df = pd.read_csv(arbitrage_csv)
    arb_records = arb_df.to_dict(orient="records")

    arb_ts = f"""/**
 * Diesel-Adjusted Spatial Arbitrage Solver & Fuel Stress-Test Corridor Data
 * Generated autonomously by pipeline/export_analytical_data.py
 * Source: TangaBid / E-Soko Farmgate + WFP Market Prices + RTDA Road Distances
 */

export interface CorridorArbitrageRecord {{
  origin_district_code: string;
  destination_code: string;
  destination_name: string;
  commodity_code: string;
  distance_km: number;
  farmgate_price_origin: number;
  retail_price_dest: number;
  gross_spread_rwf_per_kg: number;
  spoilage_loss_pct: number;
  effective_dest_price: number;
  freight_cost_regulated: number;
  freight_cost_unsubsidized: number;
  net_margin_regulated: number;
  net_margin_unsubsidized: number;
  margin_compression_pct: number;
  breakeven_diesel_price: number;
  recommendation_regulated: "DISPATCH_SURPLUS" | "MODERATE_MARGIN" | "HOLD_LOCAL";
  recommendation_unsubsidized: "DISPATCH_SURPLUS" | "MODERATE_MARGIN" | "HOLD_LOCAL";
  is_fuel_stress_sensitive: boolean;
  corridor_summary: string;
}}

export const SPATIAL_ARBITRAGE_CORRIDORS: CorridorArbitrageRecord[] = {json.dumps(arb_records, indent=2)};

export const FUEL_PRICES = {{
  regulated: 2927,
  unsubsidized: 3600,
  subsidyPerLitre: 673,
}};

export function getCorridorsForOrigin(districtCode: string): CorridorArbitrageRecord[] {{
  return SPATIAL_ARBITRAGE_CORRIDORS.filter((c) => c.origin_district_code === districtCode);
}}

export function getCorridorsForCrop(commodityCode: string): CorridorArbitrageRecord[] {{
  return SPATIAL_ARBITRAGE_CORRIDORS.filter((c) => c.commodity_code === commodityCode);
}}

/**
 * Dynamically re-simulates net arbitrage margin for a custom diesel pump price (e.g. from UI slider).
 */
export function simulateCustomFuelPrice(
  corridor: CorridorArbitrageRecord,
  customDieselPrice: number,
  truckPayloadKg: number = 5000,
  fuelBurnLPerKm: number = 0.32,
  handlingCostPerKg: number = 12
) {{
  const freightCost = (2 * corridor.distance_km * fuelBurnLPerKm * customDieselPrice) / truckPayloadKg + handlingCostPerKg;
  const netMargin = corridor.effective_dest_price - corridor.farmgate_price_origin - freightCost;
  
  let recommendation: "DISPATCH_SURPLUS" | "MODERATE_MARGIN" | "HOLD_LOCAL" = "HOLD_LOCAL";
  if (netMargin >= 40) {{
    recommendation = "DISPATCH_SURPLUS";
  }} else if (netMargin >= 10) {{
    recommendation = "MODERATE_MARGIN";
  }}

  return {{
    customDieselPrice,
    freightCost: Math.round(freightCost * 10) / 10,
    netMargin: Math.round(netMargin * 10) / 10,
    recommendation,
  }};
}}
"""
    (SRC_DATA_DIR / "spatial-arbitrage.ts").write_text(arb_ts, encoding="utf-8")
    print(f"Exported TypeScript module: {SRC_DATA_DIR / 'spatial-arbitrage.ts'}")

    # 3. Export Climate Anomalies & Dairy Stress
    climate_csv = CLEAN_DIR / "subnational_rainfall_anomalies_district.csv"
    climate_df = pd.read_csv(climate_csv)
    # Replace NaN with null for JSON serialization
    climate_df = climate_df.where(pd.notnull(climate_df), None)
    climate_records = climate_df.to_dict(orient="records")

    climate_ts = f"""/**
 * Subnational Agro-Climatic Indicators & Pastoral Dairy Cattle Stress Index
 * Generated autonomously by pipeline/export_analytical_data.py
 * Source: CHIRPS v2.0 & Meteo Rwanda Subnational Station Network
 */

export interface DistrictClimateRecord {{
  period_start: string;
  period_end: string;
  district_code: string;
  rainfall_mm: number;
  rainfall_historical_avg_mm: number;
  rainfall_anomaly_ratio: number;
  r1q_ratio: number;
  r3q_ratio: number;
  temp_max_c: number;
  dry_spell_days: number;
  dairy_stress_index: number | null;
  source: string;
}}

export const SUBNATIONAL_CLIMATE_DATA: DistrictClimateRecord[] = {json.dumps(climate_records, indent=2)};

export function getLatestClimateForDistrict(districtCode: string): DistrictClimateRecord | undefined {{
  const matches = SUBNATIONAL_CLIMATE_DATA.filter((c) => c.district_code === districtCode);
  return matches.sort((a, b) => b.period_start.localeCompare(a.period_start))[0];
}}

export function getPastoralDistrictsSummary() {{
  const pastoralCodes = ["NYAGATARE", "GICUMBI", "MUSANZE", "NYANZA", "RWAMAGANA", "KAYONZA", "BUGESERA", "GATSIBO"];
  return pastoralCodes.map((code) => {{
    const latest = getLatestClimateForDistrict(code);
    const dsi = latest?.dairy_stress_index ?? 0;
    let severity: "low" | "moderate" | "high" | "critical" = "low";
    if (dsi > 70) severity = "critical";
    else if (dsi > 50) severity = "high";
    else if (dsi > 30) severity = "moderate";

    return {{
      districtCode: code,
      dairyStressIndex: dsi,
      severity,
      rainfallAnomaly: latest?.rainfall_anomaly_ratio ?? 1.0,
      drySpellDays: latest?.dry_spell_days ?? 0,
      periodStart: latest?.period_start ?? "",
    }};
  }});
}}
"""
    (SRC_DATA_DIR / "agro-climate.ts").write_text(climate_ts, encoding="utf-8")
    print(f"Exported TypeScript module: {SRC_DATA_DIR / 'agro-climate.ts'}")

    # 4. Export Macro CPI Series
    cpi_csv = CLEAN_DIR / "nisr_cpi_monthly_food_inflation.csv"
    cpi_df = pd.read_csv(cpi_csv)
    cpi_records = cpi_df.to_dict(orient="records")

    cpi_ts = f"""/**
 * NISR Consumer Price Index (CPI) Series & Rural-Urban Inflation Divergence
 * Generated autonomously by pipeline/export_analytical_data.py
 * Source: National Institute of Statistics of Rwanda (NISR) Monthly CPI Releases
 */

export interface MacroCpiRecord {{
  period: string;
  period_start: string;
  period_end: string;
  national_cpi: number;
  urban_cpi: number;
  rural_cpi: number;
  food_inflation_yoy: number;
  rural_urban_divergence: number;
  source: string;
}}

export const MACRO_CPI_SERIES: MacroCpiRecord[] = {json.dumps(cpi_records, indent=2)};

export function getLatestCpiRelease(): MacroCpiRecord {{
  return MACRO_CPI_SERIES[0];
}}

export function getCpiHistory(): MacroCpiRecord[] {{
  return [...MACRO_CPI_SERIES].reverse();
}}
"""
    (SRC_DATA_DIR / "macro-cpi.ts").write_text(cpi_ts, encoding="utf-8")
    print(f"Exported TypeScript module: {SRC_DATA_DIR / 'macro-cpi.ts'}")


def main():
    print("=== Step 1: Generating NISR SAS District Agricultural Survey Benchmark ===")
    build_sas()
    print("=== Step 2: Generating Subnational Climate Anomalies ===")
    build_climate()
    print("=== Step 3: Generating RTDA Inter-District Distance Matrix ===")
    build_distances()
    print("=== Step 4: Generating NISR Consumer Price Index (CPI) Inflation Series ===")
    build_cpi()
    print("=== Step 5: Running MINAGRI Econometric Yield Residual Audit ===")
    run_audit()
    print("=== Step 6: Solving Spatial Arbitrage Corridors under Diesel Regimes ===")
    run_arbitrage()
    print("=== Step 7: Exporting Typed Analytical Data Layers to src/lib/data/ ===")
    export_typescript_modules()
    print("=== All Pipeline Modules Executed Successfully! ===")


if __name__ == "__main__":
    main()
