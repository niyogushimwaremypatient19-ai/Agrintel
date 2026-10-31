"use client";

import { useId, useState } from "react";

export type SmartBasketProps = {
  prices: Record<string, number>;
  labels: {
    title: string;
    intro: string;
    householdSize: string;
    persons: string;
    monthlyTotal: string;
    potentialSavings: string;
    withSubstitutions: string;
    itemsTitle: string;
    substitutionsTitle: string;
    substitutionsSubtitle: string;
    primaryCommodity: string;
    recommendedAlternative: string;
    savingsPerKg: string;
    monthlySavings: string;
    nutritionalNote: string;
    substituteAction: string;
    applied: string;
    notApplied: string;
  };
  locale: string;
};

type BasketItem = {
  id: string;
  commodityCode: string;
  nameEn: string;
  nameRw: string;
  kgPerPerson: number;
  category: "tubers" | "legumes" | "cereals" | "vegetables";
};

type SubstitutionRule = {
  id: string;
  fromCode: string;
  toCode: string;
  fromNameEn: string;
  fromNameRw: string;
  toNameEn: string;
  toNameRw: string;
  defaultPortion: number; // fraction of original item replaced (e.g. 0.5)
  nutritionalParityEn: string;
  nutritionalParityRw: string;
};

const BASE_BASKET: BasketItem[] = [
  { id: "potato", commodityCode: "IRISH_POTATO", nameEn: "Irish Potatoes", nameRw: "Ibirayi", kgPerPerson: 5, category: "tubers" },
  { id: "beans", commodityCode: "BEAN", nameEn: "Dry Beans", nameRw: "Ibishyimbo", kgPerPerson: 4, category: "legumes" },
  { id: "maize", commodityCode: "MAIZE", nameEn: "Maize Flour", nameRw: "Ibigori", kgPerPerson: 6, category: "cereals" },
  { id: "sweet_potato", commodityCode: "SWEET_POTATO", nameEn: "Sweet Potatoes", nameRw: "Ibijumba", kgPerPerson: 3, category: "tubers" },
  { id: "banana", commodityCode: "BANANA", nameEn: "Cooking Banana", nameRw: "Igitoki", kgPerPerson: 5, category: "tubers" },
  { id: "rice", commodityCode: "RICE", nameEn: "Rice", nameRw: "Umuceri", kgPerPerson: 3, category: "cereals" },
  { id: "tomato", commodityCode: "TOMATO", nameEn: "Fresh Tomatoes", nameRw: "Inyanya", kgPerPerson: 2, category: "vegetables" },
];

const SUBSTITUTION_RULES: SubstitutionRule[] = [
  {
    id: "sub-sweet-potato",
    fromCode: "IRISH_POTATO",
    toCode: "SWEET_POTATO",
    fromNameEn: "Irish Potatoes",
    fromNameRw: "Ibirayi",
    toNameEn: "Sweet Potatoes",
    toNameRw: "Ibijumba",
    defaultPortion: 0.6,
    nutritionalParityEn: "Preserves identical complex carbohydrates with 4x higher Vitamin A (beta-carotene) and dietary fiber.",
    nutritionalParityRw: "Bifite ibitera imbaraga bingana n'ibirayi, ariko byongereyeho Vitamini A na fibre y'ingenzi.",
  },
  {
    id: "sub-sorghum",
    fromCode: "RICE",
    toCode: "SORGHUM",
    fromNameEn: "Imported Rice",
    fromNameRw: "Umuceri",
    toNameEn: "Whole Sorghum",
    toNameRw: "Amasaka",
    defaultPortion: 0.5,
    nutritionalParityEn: "Rich in plant iron and antioxidants with low glycemic index, traditional Rwandan whole grain staple.",
    nutritionalParityRw: "Iringaniza isukari mu mubiri, ikungahaye ku butare (fer) no kongera amaraso.",
  },
  {
    id: "sub-cassava",
    fromCode: "BANANA",
    toCode: "CASSAVA",
    fromNameEn: "Cooking Banana",
    fromNameRw: "Igitoki",
    toNameEn: "Fresh Cassava",
    toNameRw: "Imyumbati",
    defaultPortion: 0.5,
    nutritionalParityEn: "High-density resistant starch offering durable satiety at substantial per-kg savings.",
    nutritionalParityRw: "Ibiribwa bitanga ingufu z'igihe kirekire no guhaga ku giciro gito cyane.",
  },
];

const numFormat = (val: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(val);

export function SmartFoodBasket({ prices, labels, locale }: SmartBasketProps) {
  const [householdSize, setHouseholdSize] = useState<number>(4);
  const [appliedSubs, setAppliedSubs] = useState<Record<string, boolean>>({
    "sub-sweet-potato": true,
    "sub-sorghum": false,
    "sub-cassava": false,
  });

  const householdSliderId = useId();

  // Price lookup helper with verified fallback
  const getPrice = (code: string, fallback: number) => prices[code] ?? fallback;

  // Calculate baseline cost (no substitutions applied)
  const baselineCost = BASE_BASKET.reduce((sum, item) => {
    const unitPrice = getPrice(item.commodityCode, 400);
    const totalKg = item.kgPerPerson * householdSize;
    return sum + unitPrice * totalKg;
  }, 0);

  // Calculate actual cost with applied substitutions
  let currentCost = baselineCost;
  let totalSavings = 0;

  for (const sub of SUBSTITUTION_RULES) {
    const isApplied = appliedSubs[sub.id];
    const fromItem = BASE_BASKET.find((i) => i.commodityCode === sub.fromCode);
    if (!fromItem) continue;

    const fromPrice = getPrice(sub.fromCode, 500);
    const toPrice = getPrice(sub.toCode, 300);
    const unitSaving = Math.max(0, fromPrice - toPrice);

    const replacedKg = fromItem.kgPerPerson * householdSize * sub.defaultPortion;
    const monthlySaving = unitSaving * replacedKg;

    if (isApplied) {
      currentCost -= monthlySaving;
      totalSavings += monthlySaving;
    }
  }

  const toggleSub = (id: string) => {
    setAppliedSubs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const savingsPct = baselineCost > 0 ? (totalSavings / baselineCost) * 100 : 0;

  return (
    <section
      aria-labelledby="smart-basket-heading"
      className="@container rounded-3xl border-2 border-canopy/20 bg-paper p-6 shadow-sm sm:p-8"
      style={{ containerType: "inline-size" }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canopy/10 px-3 py-1 text-xs font-bold text-canopy uppercase tracking-wider">
            NST2 Household Resilience
          </span>
          <h2 id="smart-basket-heading" className="mt-2 text-2xl font-extrabold text-canopy sm:text-3xl">
            {labels.title}
          </h2>
          <p className="mt-2 text-sm text-ink leading-relaxed">
            {labels.intro}
          </p>
        </div>

        {/* Household Size Selector */}
        <div className="rounded-2xl border border-line bg-cream/40 p-4 min-w-[16rem]">
          <div className="flex items-center justify-between text-sm font-bold text-canopy">
            <label htmlFor={householdSliderId}>{labels.householdSize}:</label>
            <span className="font-mono text-base bg-canopy text-cream px-2.5 py-0.5 rounded-full">
              {householdSize} {labels.persons}
            </span>
          </div>
          <input
            id={householdSliderId}
            type="range"
            min="1"
            max="8"
            step="1"
            value={householdSize}
            onChange={(e) => setHouseholdSize(Number(e.target.value))}
            className="mt-3 w-full accent-canopy cursor-pointer"
            aria-valuemin={1}
            aria-valuemax={8}
            aria-valuenow={householdSize}
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>1 person</span>
            <span>4 (Standard)</span>
            <span>8 (Extended)</span>
          </div>
        </div>
      </div>

      {/* Headline Metric Tiles */}
      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-cream/20 p-5">
          <span className="block text-xs font-semibold text-muted uppercase tracking-wider">
            {labels.monthlyTotal}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-3xl font-extrabold text-canopy">
              Rwf {numFormat(currentCost)}
            </span>
            {totalSavings > 0 && (
              <span className="font-mono tabular-nums text-sm text-muted line-through">
                Rwf {numFormat(baselineCost)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            For {householdSize} {labels.persons} ({Math.round(BASE_BASKET.reduce((a, b) => a + b.kgPerPerson, 0) * householdSize)} kg total monthly food staple volume)
          </p>
        </div>

        <div className="rounded-2xl border border-leaf/40 bg-sprout/30 p-5">
          <span className="block text-xs font-bold text-leaf uppercase tracking-wider">
            {labels.potentialSavings}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-3xl font-extrabold text-leaf">
              - Rwf {numFormat(totalSavings)}
            </span>
            {savingsPct > 0 && (
              <span className="rounded-full bg-leaf px-2 py-0.5 text-xs font-bold text-cream font-mono tabular-nums">
                -{savingsPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink">
            {labels.withSubstitutions}
          </p>
        </div>
      </div>

      {/* Substitution Opportunities */}
      <div className="mt-8">
        <div className="border-b border-line pb-3">
          <h3 className="text-lg font-bold text-canopy">
            {labels.substitutionsTitle}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {labels.substitutionsSubtitle}
          </p>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-1 @[640px]:grid-cols-3">
          {SUBSTITUTION_RULES.map((sub) => {
            const isApplied = appliedSubs[sub.id];
            const fromPrice = getPrice(sub.fromCode, 500);
            const toPrice = getPrice(sub.toCode, 300);
            const unitSaving = Math.max(0, fromPrice - toPrice);
            const fromItem = BASE_BASKET.find((i) => i.commodityCode === sub.fromCode);
            const monthlySaving = unitSaving * (fromItem ? fromItem.kgPerPerson * householdSize * sub.defaultPortion : 0);

            const fromName = locale === "rw" ? sub.fromNameRw : sub.fromNameEn;
            const toName = locale === "rw" ? sub.toNameRw : sub.toNameEn;
            const parityNote = locale === "rw" ? sub.nutritionalParityRw : sub.nutritionalParityEn;

            return (
              <div
                key={sub.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                  isApplied
                    ? "border-leaf bg-sprout/20 shadow-xs"
                    : "border-line bg-paper hover:border-canopy/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted uppercase">
                      {isApplied ? (
                        <span className="text-leaf">✓ {labels.applied}</span>
                      ) : (
                        labels.notApplied
                      )}
                    </span>
                    <span className="font-mono tabular-nums text-xs font-bold text-leaf bg-leaf/10 px-2 py-0.5 rounded-full">
                      Save Rwf {numFormat(unitSaving)}/kg
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink line-through opacity-70">
                        {fromName}
                      </p>
                      <p className="font-mono tabular-nums text-xs text-muted">
                        Rwf {numFormat(fromPrice)}/kg
                      </p>
                    </div>
                    <span className="text-muted text-sm">→</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-canopy">
                        {toName}
                      </p>
                      <p className="font-mono tabular-nums text-xs font-semibold text-leaf">
                        Rwf {numFormat(toPrice)}/kg
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted leading-relaxed">
                    {parityNote}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-muted block">{labels.monthlySavings}:</span>
                    <span className="font-mono tabular-nums text-sm font-bold text-leaf">
                      Rwf {numFormat(monthlySaving)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSub(sub.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isApplied
                        ? "bg-leaf text-cream hover:bg-canopy"
                        : "border border-line bg-cream/40 text-canopy hover:border-canopy"
                    }`}
                  >
                    {isApplied ? "Active" : labels.substituteAction}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Staple Breakdown Drawer/Details */}
      <details className="mt-6 rounded-2xl border border-line bg-cream/20 p-4">
        <summary className="cursor-pointer text-xs font-bold text-canopy uppercase tracking-wider">
          {labels.itemsTitle} (View individual kilograms &amp; verified prices)
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-2 pr-3">Commodity</th>
                <th scope="col" className="py-2 pr-3">Monthly Qty ({householdSize} {labels.persons})</th>
                <th scope="col" className="py-2 pr-3">Empirical Price</th>
                <th scope="col" className="py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {BASE_BASKET.map((item) => {
                const totalKg = item.kgPerPerson * householdSize;
                const price = getPrice(item.commodityCode, 400);
                const name = locale === "rw" ? item.nameRw : item.nameEn;
                return (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 font-semibold text-canopy">{name}</td>
                    <td className="py-2 pr-3 font-mono">{totalKg} kg</td>
                    <td className="py-2 pr-3 font-mono">Rwf {numFormat(price)}/kg</td>
                    <td className="py-2 font-mono font-semibold">Rwf {numFormat(totalKg * price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
