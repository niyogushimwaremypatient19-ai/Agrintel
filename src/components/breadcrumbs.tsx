"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";

interface BreadcrumbsProps {
  locale: Locale;
  labels: {
    overview: string;
    national: string;
    farmer: string;
    market: string;
    retailer: string;
    alerts: string;
    methodology: string;
  };
}

export function Breadcrumbs({ locale, labels }: BreadcrumbsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // If we are on the home overview page, no breadcrumb is needed
  if (pathname === `/${locale}` || pathname === `/${locale}/`) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const currentSection = segments[1]; // e.g. "national", "farmer", "market"

  const sectionName = labels[currentSection as keyof typeof labels] || currentSection;

  const districtParam = searchParams.get("district");
  const commodityParam = searchParams.get("commodity") || searchParams.get("crop");
  const intentParam = searchParams.get("intent");

  return (
    <nav
      aria-label="Breadcrumb Navigation"
      className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted font-medium"
    >
      <Link
        href={`/${locale}`}
        className="hover:text-canopy hover:underline transition-colors focus-visible:ring-1 focus-visible:ring-harvest rounded px-1"
      >
        {labels.overview}
      </Link>
      <span aria-hidden="true" className="text-line">/</span>

      <Link
        href={`/${locale}/${currentSection}`}
        className={`hover:text-canopy transition-colors px-1 ${
          !districtParam && !commodityParam ? "font-bold text-canopy" : "hover:underline"
        }`}
      >
        {sectionName}
      </Link>

      {districtParam && (
        <>
          <span aria-hidden="true" className="text-line">/</span>
          <span className="font-semibold text-soil px-1 bg-harvest/15 rounded">
            {districtParam}
          </span>
        </>
      )}

      {commodityParam && (
        <>
          <span aria-hidden="true" className="text-line">/</span>
          <span className="font-semibold text-canopy px-1 bg-sprout/60 rounded">
            {commodityParam}
          </span>
        </>
      )}

      {intentParam && (
        <>
          <span aria-hidden="true" className="text-line">/</span>
          <span className="font-bold text-clay uppercase px-1 bg-clay/10 rounded text-[10px]">
            {intentParam}
          </span>
        </>
      )}
    </nav>
  );
}
