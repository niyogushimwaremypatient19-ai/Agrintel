import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DataStatusBanner } from "@/components/data-status-banner";
import { OperationalDirectiveCard } from "@/components/operational-directive-card";
import { db, schema } from "@/db";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getSourceCounts } from "@/lib/data/prices";
import { simulateDataUpdate } from "./actions";

// Reads the latest alerts and audit entries on each request.
export const dynamic = "force-dynamic";

const { alerts, districts, commodities, auditLog } = schema;

const dateTime = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Kigali",
  }).format(new Date(value));

type SimStep = { step: string; status: "done" | "skipped" | "failed"; detail: string };

export default async function AlertsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    district?: string;
    crop?: string;
    commodity?: string;
    intent?: string;
    origin?: string;
    dest?: string;
    margin?: string;
    z?: string;
    exposure?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const query = await searchParams;
  const t = getDictionary(locale);
  const counts = await getSourceCounts();

  let alertRows: any[] = [];
  let latestSimulation: any = null;

  try {
    alertRows = await db
      .select({
        id: alerts.id,
        severity: alerts.severity,
        status: alerts.status,
        isSimulated: alerts.isSimulated,
        validFrom: alerts.validFrom,
        validTo: alerts.validTo,
        messageEn: alerts.messageEn,
        messageRw: alerts.messageRw,
        explanation: alerts.explanation,
        sourceNote: alerts.sourceNote,
        createdAt: alerts.createdAt,
        districtEn: districts.nameEn,
        districtRw: districts.nameRw,
        cropEn: commodities.nameEn,
        cropRw: commodities.nameRw,
      })
      .from(alerts)
      .leftJoin(districts, eq(alerts.districtCode, districts.code))
      .leftJoin(commodities, eq(alerts.commodityCode, commodities.code))
      .orderBy(desc(alerts.createdAt))
      .limit(20);

    const [latest] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "simulated_update"))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    latestSimulation = latest ?? null;
  } catch {
    alertRows = [];
    latestSimulation = null;
  }

  const simSteps = (latestSimulation?.payload as { steps?: SimStep[] } | null)?.steps ?? [];

  const severityLabel = (value: string) =>
    t.alerts.severity[value as keyof typeof t.alerts.severity] ?? value;
  const statusLabel = (value: string) => t.alerts.status[value as keyof typeof t.alerts.status] ?? value;
  const stepStatusLabel = (value: string) => t.alerts.stepStatus[value as keyof typeof t.alerts.stepStatus] ?? value;

  const commodityParam = query.crop ?? query.commodity;
  const inferredIntent =
    (query.intent as "audit" | "ship" | "hold" | undefined) ??
    (query.origin || query.dest
      ? query.margin && Number(query.margin) < 10
        ? "hold"
        : "ship"
      : query.district
      ? "audit"
      : undefined);

  const hasDirective = Boolean(inferredIntent && (query.district || query.origin || query.dest));

  return (
    <div className="flex flex-col gap-8">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold md:text-5xl">{t.alerts.title}</h1>
        <p className="mt-4 text-lg text-ink">{t.alerts.intro}</p>
      </section>

      {/* Dispatched Operational Directive Banner if routed from National or Retailer */}
      {hasDirective && inferredIntent && (
        <OperationalDirectiveCard
          intent={inferredIntent}
          district={query.district}
          crop={commodityParam}
          origin={query.origin}
          dest={query.dest}
          margin={query.margin}
          z={query.z}
          exposure={query.exposure}
          locale={locale}
          labels={t.alerts.directive}
        />
      )}

      {/* Simulator */}
      <section aria-labelledby="simulator-title" className="rounded-xl border-2 border-dashed border-harvest bg-paper p-6">
        <h2 id="simulator-title" className="text-2xl font-semibold">{t.alerts.simulation.title}</h2>
        <p className="mt-2 text-ink">{t.alerts.simulation.description}</p>
        <p className="mt-2 text-sm font-semibold text-soil">{t.alerts.simulation.guarantee}</p>

        <form action={simulateDataUpdate} className="mt-4">
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="rounded-full bg-harvest px-5 py-2 font-semibold text-ink hover:bg-canopy hover:text-cream"
          >
            {t.alerts.simulation.button}
          </button>
        </form>

        {latestSimulation ? (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-canopy">
              {t.alerts.simulation.latestTitle}: {latestSimulation.entityId}
              <span className="ml-2 text-sm font-normal text-muted">{dateTime(latestSimulation.createdAt)}</span>
            </h3>
            <ol className="mt-3 flex flex-col gap-3">
              {simSteps.map((step, index) => (
                <li key={`${step.step}-${index}`} className="rounded-lg border border-line bg-cream p-4">
                  <p className="font-semibold text-ink">
                    {index + 1}. {step.step}{" "}
                    <span className="ml-2 rounded-full bg-sprout px-2 py-0.5 text-xs font-semibold text-canopy">
                      {stepStatusLabel(step.status)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-ink">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">{t.alerts.simulation.none}</p>
        )}
      </section>

      {/* Alert list */}
      <section aria-labelledby="alerts-title" className="flex flex-col gap-4">
        <h2 id="alerts-title" className="text-2xl font-semibold">{t.alerts.listTitle}</h2>

        {alertRows.length === 0 ? (
          <p className="rounded-xl border border-line bg-paper p-6 text-ink">{t.alerts.empty}</p>
        ) : (
          alertRows.map((a) => {
            const district = locale === "rw" ? a.districtRw : a.districtEn;
            const crop = locale === "rw" ? a.cropRw : a.cropEn;
            const message = locale === "rw" && a.messageRw ? a.messageRw : a.messageEn;
            return (
              <article
                key={a.id}
                className={`rounded-xl border bg-paper p-5 ${
                  a.isSimulated ? "border-harvest" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {a.isSimulated ? (
                    <span className="rounded-full bg-harvest px-3 py-1 text-xs font-bold uppercase text-ink">
                      {t.alerts.simulatedBadge}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-sprout px-3 py-1 text-xs font-semibold text-canopy">
                    {severityLabel(a.severity)}
                  </span>
                  <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                    {statusLabel(a.status)}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-semibold text-canopy">
                  {district ?? "—"} · {crop ?? "—"}
                </h3>
                <p className="mt-2 text-ink">{message}</p>
                <p className="mt-2 text-sm text-ink">{a.explanation}</p>

                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">{t.alerts.validity}</dt>
                  <dd>
                    {dateTime(a.validFrom)} – {dateTime(a.validTo)}
                  </dd>
                  <dt className="text-muted">{t.alerts.sourceLabel}</dt>
                  <dd>{a.sourceNote}</dd>
                  <dt className="text-muted">{t.alerts.created}</dt>
                  <dd>{dateTime(a.createdAt)}</dd>
                </dl>

                {a.isSimulated ? (
                  <p className="mt-3 text-sm font-semibold text-soil">{t.alerts.simulation.notSent}</p>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      {/* Data provenance status footer */}
      <DataStatusBanner verifiedCount={counts.verified} sampleCount={counts.sample} labels={t.status} />
    </div>
  );
}
