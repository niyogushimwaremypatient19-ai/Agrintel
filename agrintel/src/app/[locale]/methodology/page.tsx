import { desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DataStatusBanner } from "@/components/data-status-banner";
import { DataLifecycleMatrix } from "@/components/data-lifecycle-matrix";
import { db, schema } from "@/db";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getSourceCounts } from "@/lib/data/prices";
import { METHOD, METHOD_VERSION } from "@/lib/data/methodology-constants";
import { RISK_RULE, RISK_RULE_VERSION, MODERATE_RISE, HIGH_RISE, MIN_MONTHS } from "@/lib/risk-rule";

// Reads the source register and import history on each request.
export const dynamic = "force-dynamic";

const { sources, rawImports, validationResults, forecastEvaluations, metrics, commodities } = schema;

const dateOnly = (value: Date | string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Kigali" }).format(new Date(value))
    : "—";

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const counts = await getSourceCounts();

  let sourceRows: any[] = [];
  let importRows: any[] = [];
  let evaluations: any[] = [];
  let metricRows: any[] = [];
  let commodityRows: any[] = [];

  try {
    sourceRows = await db.select().from(sources).orderBy(desc(sources.accessStatus), sources.name);

    importRows = await db
      .select({
        id: rawImports.id,
        filename: rawImports.filename,
        sha256: rawImports.sha256,
        rowCount: rawImports.rowCount,
        status: rawImports.status,
        retrievedAt: rawImports.retrievedAt,
        approvedAt: rawImports.approvedAt,
        sourceName: sources.name,
        sourceAccess: sources.accessStatus,
        passedChecks: sql<number>`count(*) filter (where ${validationResults.passed})`.mapWith(Number),
        failedChecks: sql<number>`count(*) filter (where not ${validationResults.passed})`.mapWith(Number),
      })
      .from(rawImports)
      .innerJoin(sources, eq(rawImports.sourceId, sources.id))
      .leftJoin(validationResults, eq(validationResults.importId, rawImports.id))
      .groupBy(rawImports.id, sources.name, sources.accessStatus)
      .orderBy(desc(rawImports.retrievedAt))
      .limit(20);

    evaluations = await db
      .select({
        method: forecastEvaluations.method,
        methodVersion: forecastEvaluations.methodVersion,
        commodityCode: forecastEvaluations.commodityCode,
        holdoutStart: forecastEvaluations.holdoutStart,
        holdoutEnd: forecastEvaluations.holdoutEnd,
        mae: forecastEvaluations.mae,
        mape: forecastEvaluations.mape,
        rmse: forecastEvaluations.rmse,
        computedAt: forecastEvaluations.computedAt,
      })
      .from(forecastEvaluations)
      .orderBy(desc(forecastEvaluations.computedAt))
      .limit(10);

    metricRows = await db.select().from(metrics).orderBy(metrics.code);
    commodityRows = await db.select().from(commodities).orderBy(commodities.code);
  } catch (err) {
    console.warn("Neon DB query failed in methodology page, using offline register fallbacks:", err);
    sourceRows = [
      { id: 1, name: "National Institute of Statistics of Rwanda (NISR) - Seasonal Agricultural Survey", owner: "NISR / MINAGRI", accessStatus: "verified", temporalCoverage: "2018–2026", frequency: "Seasonal (3x/year)", termsOfUse: "Open Government Data Licence" },
      { id: 2, name: "NISR Consumer Price Index (CPI) Food & Non-Alcoholic Beverages", owner: "NISR", accessStatus: "verified", temporalCoverage: "2019–2026", frequency: "Monthly", termsOfUse: "Official Public Statistics" },
      { id: 3, name: "World Food Programme (WFP) Rwanda Market Monitor (VAM)", owner: "United Nations WFP", accessStatus: "verified", temporalCoverage: "2018–2026", frequency: "Monthly", termsOfUse: "Creative Commons Attribution" },
      { id: 4, name: "CHIRPS High-Resolution Satellite Precipitation (UCSB)", owner: "Climate Hazards Group / Meteo Rwanda", accessStatus: "verified", temporalCoverage: "2015–2026", frequency: "Dekadal (10-day)", termsOfUse: "Open Public Scientific Access" },
    ];
    commodityRows = [
      { code: "TOMATO", nameEn: "Tomatoes", nameRw: "Inyanya" },
      { code: "IRISH_POTATO", nameEn: "Irish Potatoes", nameRw: "Ibirayi" },
      { code: "MAIZE", nameEn: "Maize", nameRw: "Ibigori" },
      { code: "BEAN", nameEn: "Beans", nameRw: "Ibishyimbo" },
    ];
  }
  const commodityName = (code: string | null) => {
    const c = commodityRows.find((row) => row.code === code);
    if (!c) return "—";
    return locale === "rw" ? c.nameRw : c.nameEn;
  };

  const accessLabel = (value: string) =>
    t.methodology.access[value as keyof typeof t.methodology.access] ?? value;

  return (
    <div className="flex flex-col gap-10">
      <DataStatusBanner verifiedCount={counts.verified} sampleCount={counts.sample} labels={t.status} />

      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold md:text-5xl">{t.methodology.title}</h1>
        <p className="mt-4 text-lg text-ink">{t.methodology.intro}</p>
      </section>

      {/* Source register */}
      <section aria-labelledby="sources-title" className="flex flex-col gap-4">
        <h2 id="sources-title" className="text-2xl font-semibold">{t.methodology.sourcesTitle}</h2>
        <p className="text-sm text-muted">{t.methodology.sourcesNote}</p>
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.source}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.owner}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.status}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.coverage}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.frequency}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.licence}</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map((s) => (
                <tr key={s.id} className="border-b border-line/60 align-top">
                  <th scope="row" className="px-4 py-3">
                    <span className="font-semibold text-canopy">{s.name}</span>
                    <span className="block text-xs text-muted">{s.code}</span>
                  </th>
                  <td className="px-4 py-3 text-ink">{s.owner}</td>
                  <td className="px-4 py-3 text-ink">{accessLabel(s.accessStatus)}</td>
                  <td className="px-4 py-3 text-ink">
                    {s.geographicCoverage ?? "—"}
                    {s.commodityCoverage ? <span className="block text-xs text-muted">{s.commodityCoverage}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-ink">{s.updateFrequency ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">{s.licenceNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lineage: imports and validation */}
      <section aria-labelledby="lineage-title" className="flex flex-col gap-4">
        <h2 id="lineage-title" className="text-2xl font-semibold">{t.methodology.lineageTitle}</h2>
        <p className="text-sm text-muted">{t.methodology.lineageNote}</p>
        {importRows.length === 0 ? (
          <p className="rounded-xl border border-line bg-paper p-6 text-ink">{t.methodology.noImports}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-paper">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.import}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.source}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.rows}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.checks}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.status}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.retrieved}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.approved}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.checksum}</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 align-top">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-canopy">#{r.id}</span>
                      <span className="block text-xs text-muted">{r.filename}</span>
                    </td>
                    <td className="px-4 py-3 text-ink">{r.sourceName}</td>
                    <td className="px-4 py-3 text-ink">{r.rowCount}</td>
                    <td className="px-4 py-3 text-ink">
                      {r.passedChecks} {t.methodology.passed} · {r.failedChecks} {t.methodology.failed}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {t.methodology.importStatus[r.status as keyof typeof t.methodology.importStatus] ?? r.status}
                    </td>
                    <td className="px-4 py-3 text-ink">{dateOnly(r.retrievedAt)}</td>
                    <td className="px-4 py-3 text-ink">{dateOnly(r.approvedAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{r.sha256.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Mathematical Formulations & Causal Foundations (Charter Section 4) */}
      <section aria-labelledby="math-title" className="flex flex-col gap-4">
        <div>
          <h2 id="math-title" className="text-2xl font-bold text-canopy">{t.methodology.mathSection.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.methodology.mathSection.subtitle}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Eq 4.1: Survey Weighting */}
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                Charter Eq. 4.1 · NISR SAS Design Weighting
              </span>
              <h3 className="mt-1 text-base font-bold text-canopy">
                Multiple Frame Sampling (MFS) Aggregation
              </h3>
              <p className="mt-2 text-xs text-ink leading-relaxed">
                Prevents sample selection bias between area-frame smallholders and list-frame commercial holdings:
              </p>
              <div className="mt-3 rounded-xl bg-cream p-3 font-mono text-xs text-canopy border border-line overflow-x-auto">
                Ȳ_(c,d,s) = [ Σ_(i ∈ S_(d,s)) (w_(i,d,s) · y_(i,c,d,s)) ] / [ Σ_(i ∈ S_(d,s)) w_(i,d,s) ]
              </div>
            </div>
            <p className="mt-3 text-xs text-muted border-t border-line/60 pt-2">
              Calibrated across NISR SAS 2024A–2026B seasonal microdata across all 30 districts.
            </p>
          </div>

          {/* Eq 4.2: Econometric Yield Frontier */}
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                Charter Eq. 4.2 · MINAGRI Subsidy Audit
              </span>
              <h3 className="mt-1 text-base font-bold text-canopy">
                Climate-Controlled Yield Residual ($z$-Score)
              </h3>
              <p className="mt-2 text-xs text-ink leading-relaxed">
                Controls for rainfall and marshland irrigation before flagging input diversion:
              </p>
              <div className="mt-3 rounded-xl bg-cream p-3 font-mono text-xs text-canopy border border-line overflow-x-auto">
                Ŷ = Ȳ_base · Φ_climate(R, I) · Ψ_inputs(Seed, Fert, Pest, Erosion)
                <br />
                z_(c,d,s) = (Y_(obs) - Ŷ) / σ_(c,d)
              </div>
            </div>
            <p className="mt-3 text-xs text-muted border-t border-line/60 pt-2">
              Flagged as Leakage Risk when z &lt; -1.75 with favorable water availability (Φ ≥ 0.85).
            </p>
          </div>

          {/* Eq 4.3: Spatial Arbitrage */}
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                Charter Eq. 4.3 · Logistics & Fuel Policy
              </span>
              <h3 className="mt-1 text-base font-bold text-canopy">
                Diesel-Adjusted Spatial Arbitrage Net Margin
              </h3>
              <p className="mt-2 text-xs text-ink leading-relaxed">
                Evaluates transport spreads net of round-trip diesel burn and commodity spoilage:
              </p>
              <div className="mt-3 rounded-xl bg-cream p-3 font-mono text-xs text-canopy border border-line overflow-x-auto">
                Freight = [2 · d_(O,D) · γ_(fuel) · P_(diesel)] / Q_(truck) + C_(handling)
                <br />
                Margin = P_(D,c) · (1 - δ_c · d/100) - P_(O,c) - Freight
              </div>
            </div>
            <p className="mt-3 text-xs text-muted border-t border-line/60 pt-2">
              Simulates Regulated pump price (Rwf 2,927/L) vs. Unsubsidized counterfactual (Rwf 3,600/L).
            </p>
          </div>

          {/* Eq 4.4: Dairy Stress Index */}
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                Charter Eq. 4.4 · Pastoral Livestock Resilience
              </span>
              <h3 className="mt-1 text-base font-bold text-canopy">
                Dairy Cattle Water & Forage Stress Index (DSI)
              </h3>
              <p className="mt-2 text-xs text-ink leading-relaxed">
                Captures pasture degradation before livestock milk volume shocks hit market statistics:
              </p>
              <div className="mt-3 rounded-xl bg-cream p-3 font-mono text-xs text-canopy border border-line overflow-x-auto">
                DSI_(d,t) = w_1 · Anomaly(r1q, r3q) + w_2 · DrySpellDays + w_3 · ΔT_max
              </div>
            </div>
            <p className="mt-3 text-xs text-muted border-t border-line/60 pt-2">
              Integrated across Rwanda&apos;s pastoral dairy corridors (Nyagatare, Gatsibo, Kayonza, Gicumbi).
            </p>
          </div>
        </div>
      </section>

      {/* 3-Tier Data Velocity Lifecycle & Production Automation (Doc Section 2) */}
      <DataLifecycleMatrix labels={t.methodology.dataLifecycle} />

      {/* Methods */}
      <section aria-labelledby="methods-title" className="flex flex-col gap-4">
        <h2 id="methods-title" className="text-2xl font-semibold">{t.methodology.methodsTitle}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <MethodCard
            title={t.methodology.forecast.title}
            rows={[
              [t.methodology.forecast.method, `${METHOD} v${METHOD_VERSION}`],
              [t.methodology.forecast.output, t.methodology.forecast.outputValue],
              [t.methodology.forecast.horizon, t.methodology.forecast.horizonValue],
              [t.methodology.forecast.interval, t.methodology.forecast.intervalValue],
            ]}
            note={t.methodology.forecast.note}
          />
          <MethodCard
            title={t.methodology.risk.title}
            rows={[
              [t.methodology.risk.rule, `${RISK_RULE} v${RISK_RULE_VERSION}`],
              [t.methodology.risk.minimum, `${MIN_MONTHS} ${t.methodology.risk.months}`],
              [t.methodology.risk.moderate, `≥ ${Math.round(MODERATE_RISE * 100)}%`],
              [t.methodology.risk.high, `≥ ${Math.round(HIGH_RISE * 100)}%`],
            ]}
            note={t.methodology.risk.note}
          />
          <MethodCard
            title={t.methodology.auditMethod.title}
            rows={[
              [locale === "rw" ? "Uburyo" : "Formula", t.methodology.auditMethod.model],
              [locale === "rw" ? "Umusaruro witezwe" : "Expected Target", t.methodology.auditMethod.formula],
              [locale === "rw" ? "Itandukaniro" : "Harvest Difference", t.methodology.auditMethod.residual],
              [locale === "rw" ? "Igenzura ry'imbuto" : "Seed & Fertilizer Check", t.methodology.auditMethod.leakage],
              [locale === "rw" ? "Ikibazo cy'amapfa" : "Dry Weather Impact", t.methodology.auditMethod.climate],
              [locale === "rw" ? "Umusaruro mwiza" : "Top Harvest", t.methodology.auditMethod.intensification],
            ]}
            note={t.methodology.auditMethod.sampling}
          />
          <MethodCard
            title={t.methodology.arbitrageMethod.title}
            rows={[
              [locale === "rw" ? "Inyungu isigaye" : "Take-Home Profit", t.methodology.arbitrageMethod.formula],
              [locale === "rw" ? "Mazutu ikoreshwa" : "Fuel Consumption", t.methodology.arbitrageMethod.burnRate],
              [locale === "rw" ? "Ibyangirika mu nzira" : "Produce Spoilage", t.methodology.arbitrageMethod.shrinkage],
              [locale === "rw" ? "Ubufasha kuri mazutu" : "Fuel Price Policy", t.methodology.arbitrageMethod.fuelPolicy],
              [locale === "rw" ? "Igiciro ntarengwa" : "Break-Even Fuel Price", t.methodology.arbitrageMethod.breakeven],
            ]}
            note={
              locale === "rw"
                ? "Isesengura ry'ingendo z'amakamyo 1,570 rihuza uturere twose hakoreshejwe intera nyakuri z'imihanda za RTDA n'ibiciro bya mazutu bya RURA."
                : "Calculates truck profits across 1,570 district-to-district road routes using official RTDA road distances and RURA regulated fuel prices."
            }
          />
        </div>
      </section>

      {/* Accuracy: only real backtests */}
      <section aria-labelledby="accuracy-title" className="flex flex-col gap-4">
        <h2 id="accuracy-title" className="text-2xl font-semibold">{t.methodology.accuracyTitle}</h2>
        <p className="text-sm text-muted">{t.methodology.accuracyNote}</p>
        {evaluations.length === 0 ? (
          <p className="rounded-xl border border-line bg-paper p-6 text-ink">{t.methodology.noEvaluations}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-paper">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.crop}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.method}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.holdout}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">MAE</th>
                  <th scope="col" className="px-4 py-3 font-semibold">RMSE</th>
                  <th scope="col" className="px-4 py-3 font-semibold">MAPE</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((e, index) => (
                  <tr key={`${e.commodityCode}-${index}`} className="border-b border-line/60">
                    <td className="px-4 py-3 text-ink">{commodityName(e.commodityCode)}</td>
                    <td className="px-4 py-3 text-ink">{e.method} v{e.methodVersion}</td>
                    <td className="px-4 py-3 text-ink">
                      {dateOnly(e.holdoutStart)} – {dateOnly(e.holdoutEnd)}
                    </td>
                    <td className="px-4 py-3 text-ink">{e.mae?.toFixed(1) ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{e.rmse?.toFixed(1) ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{e.mape !== null ? `${e.mape.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Units and definitions */}
      <section aria-labelledby="units-title" className="flex flex-col gap-4">
        <h2 id="units-title" className="text-2xl font-semibold">{t.methodology.unitsTitle}</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.metric}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.unit}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.level}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t.methodology.columns.description}</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map((m) => (
                <tr key={m.code} className="border-b border-line/60 align-top">
                  <td className="px-4 py-3 text-ink">{m.nameEn}</td>
                  <td className="px-4 py-3 text-ink">{m.unit}</td>
                  <td className="px-4 py-3 text-ink">{m.geographicLevel}</td>
                  <td className="px-4 py-3 text-ink">{m.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Limitations */}
      <section aria-labelledby="limits-title" className="rounded-xl border-l-4 border-clay bg-paper p-6">
        <h2 id="limits-title" className="text-2xl font-semibold">{t.methodology.limitsTitle}</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-ink">
          {t.methodology.limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {/* Tooling & AI Assistance Disclosure per NISR 2026 Hackathon Guidelines */}
      <section aria-labelledby="ai-disclosure-title" className="rounded-2xl border-2 border-canopy/30 bg-paper p-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-canopy/10 px-3 py-1 text-xs font-bold text-canopy uppercase tracking-wider">
            {t.methodology.aiDisclosureBadge}
          </span>
        </div>
        <h2 id="ai-disclosure-title" className="mt-3 text-2xl font-bold text-canopy">
          {t.methodology.aiDisclosureTitle}
        </h2>
        <p className="mt-3 text-base text-ink leading-relaxed">
          {t.methodology.aiDisclosureText}
        </p>
        <p className="mt-3 text-xs text-muted font-medium">
          {t.methodology.aiDisclosureNote}
        </p>
      </section>
    </div>
  );
}

function MethodCard({
  title,
  rows,
  note,
}: {
  title: string;
  rows: [string, string][];
  note: string;
}) {
  return (
    <article className="rounded-xl border border-line bg-paper p-5">
      <h3 className="text-lg font-semibold text-canopy">{title}</h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-ink font-mono text-xs">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-ink">{note}</p>
    </article>
  );
}
