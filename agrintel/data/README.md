# AgrIntel Datasets & Data Dictionary (`data/`)

This directory houses all verified subnational empirical datasets, clean analytical tables, and standardized reference lists utilized across AgrIntel Rwanda.

---

## 1. Clean Analytical Data (`data/clean/`)

| Dataset File | Rows | Frequency | Source / Authority | Access / Download Link |
|---|---|---|---|---|
| `nisr_sas_district_production_inputs.csv` | 270 | Seasonal (3x/yr) | NISR Seasonal Agricultural Survey (SAS) | [NISR Microdata Portal](https://microdata.statistics.gov.rw/index.php/catalog) |
| `nisr_cpi_monthly_food_inflation.csv` | 130 | Monthly | NISR Consumer Price Index (CPI) | [NISR CPI Statistical Releases](https://www.statistics.gov.rw/publication/cpi) |
| `wfp_prices_irish_potato_tomato_rwa.csv` | 18,248 | Monthly | WFP / Humanitarian Data Exchange (HDX) | [HDX Rwanda Food Prices](https://data.humdata.org/dataset/wfp-food-prices-for-rwanda) |
| `tangabid_farmgate_monthly_district.csv` | 1,800 | Monthly | TangaBid / Rwanda Agriculture Board (RAB) | Observed Farmgate Transaction Records |
| `subnational_rainfall_anomalies_district.csv` | 180 | 10-day Dekadal | CHIRPS / Rwanda Meteorological Agency | [Meteo Rwanda Climate Portal](https://www.meteorwanda.gov.rw/) |
| `district_market_distances.csv` | 1,570 | Static Baseline | OpenStreetMap (OSM) Road Network | Rwanda Road Distance Matrix |
| `spatial_arbitrage_corridors.csv` | 1,570 | Continuous | AgrIntel Spatial Corridor Engine | Generated Net Arbitrage Corridors |
| `econometric_subsidy_audit_results.csv` | 270 | Seasonal | Cobb-Douglas Econometric Audit Engine | Climate-Controlled Production Frontier |
| `Tables_2026 Season A.xlsx` | — | Seasonal | Official NISR SAS 2026 Season A Report | [NISR Agriculture Publications](https://www.statistics.gov.rw/) |

---

## 2. Standardized Reference Schemas (`data/reference/`)

- `districts.csv`: 30 official Rwanda administrative districts mapped to provinces with centroid GIS coordinates.
- `commodities.csv`: Target crops with English and Kinyarwanda nomenclature (`TOMATO`, `IRISH_POTATO`, `MAIZE`, `BEAN`, `BANANA`, `CASSAVA`, `RICE`).
- `metrics.csv`: Standardized units (`RWF/kg`, `metric_tons`, `kg_per_ha`, `mm`).

---

## 3. Data Governance & Licensing

- **License**: Open Data for Public Evidence-Based Decision Making.
- **Integrity**: Every raw and clean dataset is audited with cryptographic SHA-256 checksums before loading.
- **No Private Microdata**: All records are aggregated at market, district, or national levels to protect farmer identity.
