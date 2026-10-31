import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto my-16 flex max-w-xl flex-col items-center rounded-2xl border border-line bg-paper p-8 text-center shadow-xs">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sprout/60 text-canopy text-2xl">
        🌾
      </div>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-canopy">
        Resource Not Found
      </h1>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        The requested district, commodity forecast, or intelligence page could not be located in the current AgrIntel registry.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link
          href="/en"
          className="rounded-xl bg-canopy px-5 py-2.5 text-xs font-bold text-cream hover:bg-leaf transition-colors text-center"
        >
          Overview (English)
        </Link>
        <Link
          href="/rw"
          className="rounded-xl border border-canopy px-5 py-2.5 text-xs font-bold text-canopy hover:bg-sprout/30 transition-colors text-center"
        >
          Intangiriro (Kinyarwanda)
        </Link>
        <Link
          href="/en/national"
          className="rounded-xl border border-line bg-cream px-5 py-2.5 text-xs font-bold text-ink hover:bg-paper transition-colors text-center"
        >
          National 30-District Radar
        </Link>
      </div>
    </div>
  );
}
