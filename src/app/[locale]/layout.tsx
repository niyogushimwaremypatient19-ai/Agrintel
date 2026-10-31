import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { getDictionary, isLocale, locales, type Locale } from "@/lib/i18n";
import { NavigationHeader } from "@/components/navigation-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.siteName} | ${t.siteSubtitle}`,
    description: t.tagline,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typedLocale: Locale = locale;
  const t = getDictionary(typedLocale);

  return (
    <html
      lang={typedLocale}
      className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-paper focus:px-4 focus:py-2 focus:text-canopy"
        >
          {t.skipToContent}
        </a>

        {/* Dynamic, accessible Navigation Header with mobile drawer & active indicators */}
        <NavigationHeader
          locale={typedLocale}
          siteName={t.siteName}
          siteSubtitle={t.siteSubtitle}
          languageLabels={t.language}
          navLabels={t.nav}
        />

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          <Breadcrumbs locale={typedLocale} labels={t.nav} />
          {children}
        </main>

        <footer className="border-t border-line bg-paper">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-line pb-6">
              <div>
                <p className="font-display font-bold text-canopy text-base">{t.siteName}</p>
                <p className="text-xs text-muted mt-0.5">{t.tagline}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-soil">
                <Link href={`/${typedLocale}/farmer`} className="hover:text-canopy hover:underline">
                  {t.nav.farmer}
                </Link>
                <span aria-hidden="true">·</span>
                <Link href={`/${typedLocale}/market`} className="hover:text-canopy hover:underline">
                  {t.nav.market}
                </Link>
                <span aria-hidden="true">·</span>
                <Link href={`/${typedLocale}/retailer`} className="hover:text-canopy hover:underline">
                  {t.nav.retailer}
                </Link>
                <span aria-hidden="true">·</span>
                <Link href={`/${typedLocale}/national`} className="hover:text-canopy hover:underline">
                  {t.nav.national}
                </Link>
                <span aria-hidden="true">·</span>
                <Link href={`/${typedLocale}/methodology`} className="hover:text-canopy hover:underline">
                  {t.nav.methodology}
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-muted/80">
              <p>© 2026 {t.siteName} · {typedLocale === "rw" ? "Amakuru y'ubuhinzi n'ibiribwa yemejwe" : "Official agriculture & food security statistics"}</p>
              <p className="text-[11px] font-medium text-muted">NISR · MINAGRI · Rwanda Meteo · WFP</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
