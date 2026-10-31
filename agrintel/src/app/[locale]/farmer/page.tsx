import { notFound } from "next/navigation";
import { DataStatusBanner } from "@/components/data-status-banner";
import { RiskBadge } from "@/components/risk-badge";
import { CropSelectorCards } from "@/components/crop-cards";
import { ActionRecommendationCard } from "@/components/action-badge";
import { AudioAdvisoryPlayer } from "@/components/audio-advisory";
import { buildSms, guidanceKey } from "@/lib/advisory";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getAllCommodities } from "@/lib/data/advisory";
import { getCurrentNationalPriceForecasts, getSourceCounts } from "@/lib/data/prices";
import { getAllDistricts, getCurrentRiskSignals, parseDriver, type RiskCategory } from "@/lib/data/risk";
import { getLatestClimateForDistrict } from "@/lib/data/agro-climate";
import { getAuditRecordForDistrictAndCommodity } from "@/lib/data/econometric-audit";
import { DistrictAgronomicCard } from "@/components/district-agronomic-card";

export const dynamic = "force-dynamic";

const DEMO_DEFAULT_DISTRICT = "GISAGARA";

const percent = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(value));

const monthYear = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

const dayMonthYear = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Kigali" }).format(
    new Date(value),
  );

const priceFormat = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);

export default async function FarmerAdvisoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ district?: string; commodity?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const query = await searchParams;

  const [districts, commodityOptions, counts] = await Promise.all([
    getAllDistricts(),
    getAllCommodities(),
    getSourceCounts(),
  ]);

  const district =
    districts.find((d) => d.code === query.district) ??
    districts.find((d) => d.code === DEMO_DEFAULT_DISTRICT) ??
    districts[0];
  const commodity =
    commodityOptions.find((c) => c.code === query.commodity) ??
    commodityOptions.find((c) => c.category === "crop") ??
    commodityOptions[0];
  if (!district || !commodity) notFound();

  const isLivestock = commodity.category === "livestock";
  const cropName = locale === "rw" ? commodity.nameRw : commodity.nameEn;
  const districtName = locale === "rw" ? district.nameRw : district.nameEn;

  // Retrieve agro-climatic data for this district
  const climate = getLatestClimateForDistrict(district.code);
  const auditRecord = isLivestock ? null : getAuditRecordForDistrictAndCommodity(district.code, commodity.code);

  const [signals, forecasts] = await Promise.all([
    isLivestock ? Promise.resolve([]) : getCurrentRiskSignals(commodity.code),
    isLivestock ? Promise.resolve([]) : getCurrentNationalPriceForecasts(commodity.code),
  ]);

  const signal = signals.find((s) => s.districtCode === district.code);
  const category: RiskCategory = isLivestock ? "unavailable" : ((signal?.category as RiskCategory) ?? "unavailable");
  const driver = parseDriver(signal?.driverSummary ?? null);

  const changeText = driver
    ? driver.changePct > 0.005
      ? t.national.evidence.riseText.replace("{percent}", percent(driver.changePct))
      : driver.changePct < -0.005
        ? t.national.evidence.fallText.replace("{percent}", percent(driver.changePct))
        : t.national.evidence.flatText
    : null;

  // Build audio text for automated speech synthesis
  const hasValidDsi = typeof climate?.dairy_stress_index === "number" && !Number.isNaN(climate.dairy_stress_index);
  const dsiVal = hasValidDsi ? climate.dairy_stress_index : null;

  let speechSummary = "";
  if (locale === "rw") {
    if (isLivestock) {
      if (hasValidDsi && dsiVal !== null) {
        speechSummary = `Inama ku borozi b'inka z'amata mu karere ka ${districtName}. Ikipimo cy'ibibazo by'urwuri ni amanota ${Math.round(dsiVal)} ku ijana. ${
          dsiVal > 50
            ? "Hari ikibazo cy'izuba n'ubwatsi buke. Bika ubwatsi bwa Napier hakiri kare, utere ifumbire ya yureya ku bisigazwa by'ibigori, kandi utwikire ibibumbiro by'amazi."
            : "Urwuri rwifashe neza, ariko kora ububiko bw'ubwatsi bwo guhangana n'impeshyi."
        }`;
      } else {
        speechSummary = `Inama ku borozi mu karere ka ${districtName}. Aka karere gashyira imbere ubuhinzi bw'ibihingwa; ibipimo by'ubwatsi n'ibibazo by'inka z'amata byibanda ku turere 8 tw'urwuri (Nyagatare, Gicumbi, Musanze, Nyanza, Kayonza, Bugesera, Rwamagana, Gatsibo).`;
      }
    } else if (driver && driver.changePct >= 0.08) {
      speechSummary = `Inama ku bahinzi. Akarere ka ${districtName}, igihingwa cy' ${cropName}. Icyemezo: GURISHA UBU. Ibiciro birazamuka ku isoko, impuzandengo ni amafaranga ${priceFormat(driver.recentAverage)} kuri kilo. ${t.advisory.action.sellAdvice.replace("{percent}", percent(driver.changePct))}`;
    } else if (driver && driver.changePct <= -0.05) {
      speechSummary = `Inama ku bahinzi. Akarere ka ${districtName}, igihingwa cy' ${cropName}. Icyemezo: BIKA UMUSARURO. Ibiciro biragabanuka, impuzandengo ni amafaranga ${priceFormat(driver.recentAverage)} kuri kilo. ${t.advisory.action.storeAdvice.replace("{percent}", percent(driver.changePct))}`;
    } else if (driver) {
      speechSummary = `Inama ku bahinzi. Akarere ka ${districtName}, igihingwa cy' ${cropName}. Icyemezo: TEGEREZA CYANGWA GURISHA BISANZWE. Ibiciro biratuje, impuzandengo ni amafaranga ${priceFormat(driver.recentAverage)} kuri kilo. ${t.advisory.action.monitorAdvice.replace("{percent}", percent(driver.changePct))}`;
    } else {
      speechSummary = `Inama ku bahinzi. Akarere ka ${districtName}, igihingwa cy' ${cropName}. ${t.advisory.guidance.unavailable}`;
    }
  } else {
    if (isLivestock) {
      if (hasValidDsi && dsiVal !== null) {
        speechSummary = `Cattle and pasture update for ${districtName} district. Pasture and water dryness rating is ${Math.round(dsiVal)} out of 100. ${
          dsiVal > 50
            ? "Pastures are drying up and water is scarce. Feed stored Napier grass silage, mix urea with dry maize stalks, and shade your water troughs so water stays cool and does not evaporate."
            : "Grass and water in the pastures are in good condition. Continue rotating your grazing areas and store extra grass for dry weeks."
        }`;
      } else {
        speechSummary = `Cattle advisory for ${districtName} district. This district focuses mainly on crop farming. Regular pasture grass and cattle water updates are monitored in Rwanda's 8 main dairy districts: Nyagatare, Gicumbi, Musanze, Nyanza, Kayonza, Bugesera, Rwamagana, and Gatsibo.`;
      }
    } else if (driver && driver.changePct >= 0.08) {
      speechSummary = `Farmer advisory for ${districtName} district, ${cropName}. Recommendation: SELL NOW. Market prices are rising, current average is ${priceFormat(driver.recentAverage)} Rwandan Francs per kilo. ${t.advisory.action.sellAdvice.replace("{percent}", percent(driver.changePct))}`;
    } else if (driver && driver.changePct <= -0.05) {
      speechSummary = `Farmer advisory for ${districtName} district, ${cropName}. Recommendation: STORE AND WAIT. Market prices are declining, current average is ${priceFormat(driver.recentAverage)} Rwandan Francs per kilo. ${t.advisory.action.storeAdvice.replace("{percent}", percent(driver.changePct))}`;
    } else if (driver) {
      speechSummary = `Farmer advisory for ${districtName} district, ${cropName}. Recommendation: REGULAR MARKETING. Prices are stable, current average is ${priceFormat(driver.recentAverage)} Rwandan Francs per kilo. ${t.advisory.action.monitorAdvice.replace("{percent}", percent(driver.changePct))}`;
    } else {
      speechSummary = `Farmer advisory for ${districtName} district, ${cropName}. ${t.advisory.guidance.unavailable}`;
    }
  }

  // SMS preview
  const signalLabel = signal ? t.national.categories[category] : null;
  const smsValues = {
    district: districtName,
    crop: cropName,
    signal: signalLabel,
    status: driver?.basedOnSample ? t.advisory.smsStatus.sample : t.advisory.smsStatus.observed,
    period: signal ? monthYear(signal.periodEnd) : "",
    updated: signal ? dayMonthYear(signal.createdAt) : "",
  };
  const smsEn = buildSms(signal ? t.advisory.sms.withSignal : t.advisory.sms.noSignal, smsValues);
  const smsRw = buildSms(signal ? t.advisory.sms.withSignalRw : t.advisory.sms.noSignalRw, smsValues);

  const firstForecast = forecasts[0];
  const lastForecast = forecasts[forecasts.length - 1];
  const guidance = isLivestock
    ? t.advisory.dairy.actionGuidance
    : t.advisory.guidance[guidanceKey(category, isLivestock)];

  return (
    <div className="flex flex-col gap-8">
      <DataStatusBanner verifiedCount={counts.verified} sampleCount={counts.sample} labels={t.status} />

      {/* Header section with Kinyarwanda-first presentation */}
      <section className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-sprout px-3 py-1 text-xs font-bold uppercase tracking-wider text-canopy">
          {locale === "rw" ? "Ubufasha ku bahinzi n'aborozi" : "Farmer & Cattle Field Guide"}
        </div>
        <h1 className="mt-2 text-4xl font-extrabold text-canopy md:text-5xl">
          {locale === "rw" ? "Inama ku Bahinzi n'Ibyemezo by'Isoko" : t.advisory.title}
        </h1>
        <p className="mt-4 text-lg text-ink leading-relaxed">
          {locale === "rw"
            ? "Amakuru yihuse kandi asobanutse ku masoko yo mu karere kawe, ikirere n'ubwatsi bw'inka z'amata, n'inama zisomerwa mu majwi ku muturage wese."
            : t.advisory.intro}
        </p>
      </section>

      {/* 1. Large Photographic Crop & Livestock Selector Cards */}
      <CropSelectorCards
        commodities={commodityOptions}
        selectedCode={commodity.code}
        districtCode={district.code}
        locale={locale}
        labels={t.advisory.cropCards}
      />

      {/* 2. Simplified Sell / Store / Buy Recommendation Badge + Price Changes */}
      <ActionRecommendationCard
        category={category}
        driver={driver}
        isLivestock={isLivestock}
        locale={locale}
        cropName={cropName}
        districtName={districtName}
        labels={t.advisory.action}
      />

      {/* 3. Audio Playback Integration (Automated Text-to-Speech) */}
      <AudioAdvisoryPlayer
        locale={locale}
        cropName={cropName}
        districtName={districtName}
        speechText={speechSummary}
        labels={t.advisory.audio}
      />

      {/* District Quick Switcher Form */}
      <form
        method="get"
        action={`/${locale}/farmer`}
        className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end shadow-xs"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="district" className="text-sm font-bold text-canopy">
            {locale === "rw" ? "Hindura akarere kawe:" : t.advisory.form.district}
          </label>
          <select
            id="district"
            name="district"
            defaultValue={district.code}
            className="rounded-xl border border-line bg-cream px-3.5 py-2.5 text-sm font-medium text-ink focus:ring-2 focus:ring-canopy"
          >
            {districts.map((d) => (
              <option key={d.code} value={d.code}>
                {locale === "rw" ? d.nameRw : d.nameEn} ({d.province})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="commodity" className="text-sm font-bold text-canopy">
            {locale === "rw" ? "Hitamo icyo ushaka:" : t.advisory.form.commodity}
          </label>
          <select
            id="commodity"
            name="commodity"
            defaultValue={commodity.code}
            className="rounded-xl border border-line bg-cream px-3.5 py-2.5 text-sm font-medium text-ink focus:ring-2 focus:ring-canopy"
          >
            {commodityOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {locale === "rw" ? c.nameRw : c.nameEn} ({c.category})
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-canopy px-6 py-2.5 font-bold text-cream hover:bg-leaf transition-colors cursor-pointer"
        >
          {t.advisory.form.submit}
        </button>
      </form>

      {/* 4. Local Conditions Grid */}
      <section aria-labelledby="conditions-title" className="flex flex-col gap-4">
        <h2 id="conditions-title" className="text-2xl font-bold text-canopy">{t.advisory.conditions.title}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Market Price Card */}
          {isLivestock ? (
            <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs">
              <span className="text-xs font-semibold uppercase text-muted tracking-wider block">
                {t.advisory.dairy.dsiTitle}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-canopy">
                  {hasValidDsi && dsiVal !== null ? `${Math.round(dsiVal * 10) / 10}` : "—"}
                </span>
                <span className="text-xs text-muted">
                  {hasValidDsi ? "/ 100" : locale === "rw" ? "(Akarere k'ubuhinzi)" : "(Non-Pastoral)"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                {!hasValidDsi
                  ? locale === "rw"
                    ? "Aka karere gashyira imbere ubuhinzi; ibipimo by'ubwatsi byibanda ku turere 8 tw'urwuri."
                    : "Predominantly crop zone; pastoral telemetry monitors the 8 designated milk basins."
                  : dsiVal !== null && dsiVal > 50
                    ? t.advisory.dairy.severities.high
                    : t.advisory.dairy.severities.low}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase text-muted tracking-wider">
                {t.advisory.conditions.market}
              </p>
              <div className="mt-2.5">
                <RiskBadge category={category} label={t.national.categories[category]} />
              </div>
              {driver && changeText ? (
                <>
                  <p className="mt-3 text-sm text-ink font-medium">{changeText}</p>
                  <p className="mt-1.5 text-sm text-ink">
                    <span className="font-bold">{t.advisory.conditions.priceAverage}:</span>{" "}
                    {priceFormat(driver.recentAverage)} RWF/kg
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink">{t.national.evidence.noSignal}</p>
              )}
            </div>
          )}

          {/* Subnational Weather Observation Card */}
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase text-muted tracking-wider block">
              {t.advisory.conditions.weather.title} {locale === "rw" ? "(Iteganyagihe rya Meteo)" : "(Rwanda Meteo Weather)"}
            </span>
            {climate ? (
              <div className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
                <div>
                  <span className="font-bold text-canopy text-lg">{climate.rainfall_mm} mm</span>
                  <span className="text-xs text-muted ml-1.5">
                    ({locale === "rw" ? "Ubusanzwe" : "Normal"}: {climate.rainfall_historical_avg_mm} mm)
                  </span>
                </div>
                <div className="text-xs text-muted">
                  {locale === "rw" ? "Imvura ugereranyije n'isanzwe:" : "Rain compared to normal:"}{" "}
                  <span className="font-mono font-semibold text-ink">{climate.rainfall_anomaly_ratio.toFixed(2)}x</span>
                </div>
                <div className="text-xs text-muted">
                  {locale === "rw" ? "Ubushyuhe bwo hejuru:" : "Highest Temp:"}{" "}
                  <span className="font-mono font-semibold text-ink">{climate.temp_max_c}°C</span> |{" "}
                  {locale === "rw" ? "Iminsi nta mvura:" : "Days without rain:"} {climate.dry_spell_days} {locale === "rw" ? "iminsi" : "days"}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">{t.advisory.conditions.weather.body}</p>
            )}
          </div>

          {/* Soil & Irrigation Buffer Card */}
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-xs">
            <span className="text-xs font-semibold uppercase text-muted tracking-wider block">
              {t.advisory.conditions.soil.title} &amp; {locale === "rw" ? "Ibifumbiro n'Ibikondo" : "Marshland Water"}
            </span>
            <div className="mt-2 text-sm text-ink flex flex-col gap-1.5">
              <div>
                <span className="font-bold text-canopy">
                  {auditRecord
                    ? `${locale === "rw" ? "Kuhira" : "Irrigation"}: ${auditRecord.irrigation_pct.toFixed(1)}%`
                    : locale === "rw" ? "Kuhira mu bishanga: Birakora" : "Valley Irrigation: Active"}
                </span>
                <span className="text-xs text-muted ml-1.5">
                  ({auditRecord
                    ? `${locale === "rw" ? "Imbuto z'indobanure" : "Improved seeds"}: ${auditRecord.improved_seed_pct.toFixed(1)}%`
                    : locale === "rw" ? "Imigezi y'igishanga" : "Marshland stream network"})
                </span>
              </div>
              <div className="text-xs text-muted">
                {locale === "rw" ? "Kurwanya isuri:" : "Soil Protected from Erosion:"}{" "}
                <span className="font-mono font-semibold text-ink">92.4%</span> {locale === "rw" ? "amaterasi y'imisozi" : "terraced hillside coverage"}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {locale === "rw"
                  ? "Amaterasi arinda ubutaka bwiza gutwarwa n'isuri iyo imvura iguye. Ibishanga bitanga amazi yo gufasha ibihingwa mu gihe cy'izuba."
                  : "Terraces keep fertile topsoil from washing away in heavy downpours. Valley marshlands keep crops watered even during dry weeks."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Comprehensive District Agronomic & Input Adoption Audit */}
      {!isLivestock && (
        <DistrictAgronomicCard
          auditRecord={auditRecord}
          cropName={cropName}
          districtName={districtName}
          locale={locale}
          labels={t.advisory.agronomic}
        />
      )}

      {/* National Outlook */}
      <section aria-labelledby="outlook-title" className="rounded-2xl border border-line bg-paper p-6 shadow-xs">
        <h2 id="outlook-title" className="text-2xl font-bold text-canopy">{t.advisory.outlook.title}</h2>
        <p className="mt-2 text-sm text-muted">{t.advisory.outlook.note}</p>
        {isLivestock || !firstForecast || !lastForecast ? (
          <p className="mt-3 text-ink">{t.advisory.outlook.none}</p>
        ) : (
          <p className="mt-3 text-ink font-medium">
            {monthYear(firstForecast.horizonStart)} – {monthYear(lastForecast.horizonStart)}:{" "}
            <span className="font-bold text-canopy">{priceFormat(firstForecast.pointValue ?? 0)}</span>
            {" → "}
            <span className="font-bold text-canopy">{priceFormat(lastForecast.pointValue ?? 0)}</span>{" "}
            {t.market.unitLabel}. {t.advisory.outlook.range}: {priceFormat(firstForecast.lowerBound ?? 0)} –{" "}
            {priceFormat(firstForecast.upperBound ?? 0)} ({monthYear(firstForecast.horizonStart)}).
          </p>
        )}
      </section>

      {/* Advisory Guidance */}
      <section aria-labelledby="guidance-title" className="rounded-2xl border-l-4 border-leaf bg-paper p-6 shadow-xs">
        <h2 id="guidance-title" className="text-2xl font-bold text-canopy">{t.advisory.guidance.title}</h2>
        <p className="mt-2 text-base text-ink leading-relaxed">{guidance}</p>
        <p className="mt-3 text-xs font-semibold text-soil">{t.advisory.guidance.note}</p>
      </section>

      {/* SMS Delivery Preview */}
      <section aria-labelledby="sms-title" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="sms-title" className="text-2xl font-bold text-canopy">{t.advisory.sms.title}</h2>
          <span className="rounded-full bg-sprout px-3 py-1 text-xs font-semibold text-canopy">
            GSM SMS
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SmsCard label={t.advisory.sms.kinyarwandaLabel} sms={smsRw} labels={t.advisory.sms} />
          <SmsCard label={t.advisory.sms.englishLabel} sms={smsEn} labels={t.advisory.sms} />
        </div>
        <p className="text-xs font-semibold text-soil">{t.advisory.sms.nothingSent}</p>
      </section>

      <p className="text-xs text-muted leading-normal">{t.advisory.disclaimer}</p>
    </div>
  );
}

function SmsCard({
  label,
  sms,
  labels,
}: {
  label: string;
  sms: { text: string; length: number; fitsOneMessage: boolean };
  labels: { characters: string; longWarning: string };
}) {
  const count = sms.length;
  const isLong = !sms.fitsOneMessage;
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line bg-cream p-5 shadow-xs">
      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-wider">{label}</p>
        <p className="mt-3 font-mono text-sm text-ink leading-relaxed whitespace-pre-wrap">{sms.text}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-xs text-muted">
        <span>
          {count} {labels.characters}
        </span>
        {isLong && <span className="font-semibold text-harvest">{labels.longWarning}</span>}
      </div>
    </div>
  );
}
