"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getDictionary, isLocale } from "@/lib/i18n";
import { monthlyAverages } from "@/lib/trend";
import { PRICE_METRIC } from "@/lib/data/prices";
import { RISK_RULE, RISK_RULE_VERSION, classifyChange, priceChange, severityFor } from "@/lib/risk-rule";

const { sources, observations, rawImports, validationResults, alerts, auditLog, districts, commodities } = schema;

/** The demonstration target: a district with approved WFP potato prices. */
const SIM_DISTRICT = "GISAGARA";
const SIM_COMMODITY = "IRISH_POTATO";
/** The simulated jump applied to the latest month. Labelled as a simulation everywhere it appears. */
const SIM_MULTIPLIER = 1.25;

type Step = { step: string; status: "done" | "skipped" | "failed"; detail: string };

/** "YYYY-MM" -> "YYYY-MM-DD" for the last day of that month. */
function lastDayOf(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(day).padStart(2, "0")}`;
}

function fillTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

/**
 * Runs the simulated chain:
 *   update received -> validated (pending review) -> signal preview -> draft alert -> audit.
 * Nothing here changes public outputs. The update stays "validated", and the public pages
 * only read approved imports, so the public signal does not move until someone approves it.
 */
export async function simulateDataUpdate(formData: FormData) {
  const requestedLocale = String(formData.get("locale") ?? "en");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const t = getDictionary(locale);

  const simulationId = randomUUID().slice(0, 8).toUpperCase();
  const now = new Date();
  const steps: Step[] = [];

  // Reference lookups (strictly using verified empirical sources)
  const [source] = await db.select().from(sources).where(eq(sources.code, "WFP-HDX-RWA-FOOD-PRICES"));
  if (!source) throw new Error("Verified WFP price source not found in database.");

  const [district] = await db.select().from(districts).where(eq(districts.code, SIM_DISTRICT));
  const [commodity] = await db.select().from(commodities).where(eq(commodities.code, SIM_COMMODITY));
  if (!district || !commodity) throw new Error("Simulation district or commodity is missing from reference data.");

  // Approved history only: the baseline is what the public sees today
  const history = await db
    .select({ periodStart: observations.periodStart, value: observations.value })
    .from(observations)
    .innerJoin(rawImports, eq(observations.importId, rawImports.id))
    .where(
      and(
        eq(observations.districtCode, SIM_DISTRICT),
        eq(observations.commodityCode, SIM_COMMODITY),
        eq(observations.metricCode, PRICE_METRIC),
        eq(rawImports.status, "approved"),
      ),
    )
    .orderBy(asc(observations.periodStart));

  const monthly = monthlyAverages(history);
  const latest = monthly.at(-1);
  if (!latest || monthly.length < 6) {
    throw new Error("Not enough approved history to run the simulation.");
  }

  // 1. Update received
  const simulatedValue = Math.round(latest.average * SIM_MULTIPLIER * 10) / 10;
  const payload = {
    simulationId,
    district: SIM_DISTRICT,
    commodity: SIM_COMMODITY,
    period: latest.period,
    previousValue: latest.average,
    simulatedValue,
    simulated: true,
  };
  const [importRow] = await db
    .insert(rawImports)
    .values({
      sourceId: source.id,
      filename: `simulated-update-${simulationId}.json`,
      storagePath: `simulation://${simulationId}`,
      sha256: createHash("sha256").update(JSON.stringify(payload) + now.toISOString()).digest("hex"),
      rowCount: 1,
      periodStart: `${latest.period}-01`,
      periodEnd: lastDayOf(latest.period),
      status: "received",
      notes: "SIMULATED update. Not approved. Not used in public outputs.",
    })
    .returning({ id: rawImports.id });

  steps.push({
    step: t.alerts.simulation.steps.received,
    status: "done",
    detail: `${district.nameEn}, ${commodity.nameEn}, ${latest.period}: ${latest.average} → ${simulatedValue} RWF/kg`,
  });

  // 2. Validation
  const checks = [
    {
      name: "positive_value",
      passed: simulatedValue > 0,
      failedRows: simulatedValue > 0 ? 0 : 1,
    },
    {
      name: "plausible_change_limit",
      passed: simulatedValue <= latest.average * 3,
      failedRows: simulatedValue <= latest.average * 3 ? 0 : 1,
    },
  ];
  await db.insert(validationResults).values(
    checks.map((c) => ({
      importId: importRow.id,
      checkName: c.name,
      severity: "error",
      passed: c.passed,
      failedRows: c.failedRows,
      detail: { simulated: true },
    })),
  );
  const allPassed = checks.every((c) => c.passed);
  await db.update(rawImports).set({ status: allPassed ? "validated" : "rejected" }).where(eq(rawImports.id, importRow.id));

  steps.push({
    step: t.alerts.simulation.steps.validated,
    status: allPassed ? "done" : "failed",
    detail: allPassed
      ? t.alerts.simulation.details.validatedPending
      : t.alerts.simulation.details.validationFailed,
  });

  if (!allPassed) {
    await db.insert(auditLog).values({
      action: "simulated_update_rejected",
      entityType: "simulation",
      entityId: simulationId,
      payload: { steps, importId: importRow.id },
    });
    redirect(`/${locale}/alerts`);
  }

  // 3. Signal preview: what the rule would say with the update applied. Not written to risk_signals.
  const previousChange = priceChange(monthly.map((m) => m.average));
  const updatedValues = [...monthly.slice(0, -1).map((m) => m.average), simulatedValue];
  const newChange = priceChange(updatedValues);
  const beforeCategory = classifyChange(previousChange);
  const afterCategory = classifyChange(newChange);
  const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

  steps.push({
    step: t.alerts.simulation.steps.previewed,
    status: "done",
    detail: t.alerts.simulation.details.previewed
      .replace("{before}", t.national.categories[beforeCategory])
      .replace("{after}", t.national.categories[afterCategory])
      .replace("{beforePct}", pct(previousChange))
      .replace("{afterPct}", pct(newChange)),
  });

  // 4. Draft alert, flagged as simulated and never publishable (enforced by the database check)
  const tRw = getDictionary("rw");
  const valuesEn = {
    district: district.nameEn,
    crop: commodity.nameEn,
    before: t.national.categories[beforeCategory],
    after: t.national.categories[afterCategory],
    id: simulationId,
  };
  const valuesRw = {
    district: district.nameRw,
    crop: commodity.nameRw,
    before: tRw.national.categories[beforeCategory],
    after: tRw.national.categories[afterCategory],
    id: simulationId,
  };

  const validTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [alertRow] = await db
    .insert(alerts)
    .values({
      districtCode: SIM_DISTRICT,
      commodityCode: SIM_COMMODITY,
      audience: "farmer",
      severity: severityFor(afterCategory),
      status: "simulated",
      isSimulated: true,
      validFrom: now,
      validTo,
      messageEn: fillTemplate(t.alerts.simulation.alertTemplate, valuesEn),
      messageRw: fillTemplate(tRw.alerts.simulation.alertTemplate, valuesRw),
      explanation: fillTemplate(t.alerts.simulation.explanationTemplate, valuesEn),
      sourceNote: `${RISK_RULE} v${RISK_RULE_VERSION}. ${t.alerts.simulation.sourceNote}`,
      triggeredByImportId: importRow.id,
    })
    .returning({ id: alerts.id });

  steps.push({
    step: t.alerts.simulation.steps.drafted,
    status: "done",
    detail: t.alerts.simulation.details.drafted.replace("{id}", String(alertRow.id)),
  });

  // 5. Audit: one entry holds the whole simulation so it can be shown and explained later
  await db.insert(auditLog).values({
    action: "simulated_update",
    entityType: "simulation",
    entityId: simulationId,
    payload: {
      steps,
      importId: importRow.id,
      alertId: alertRow.id,
      previewChangePct: newChange,
      previousChangePct: previousChange,
      rule: RISK_RULE,
      ruleVersion: RISK_RULE_VERSION,
      publicOutputsChanged: false,
    },
  });

  redirect(`/${locale}/alerts`);
}
