"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

interface NavigationHeaderProps {
  locale: Locale;
  siteName: string;
  siteSubtitle: string;
  languageLabels: {
    label: string;
    en: string;
    rw: string;
  };
  navLabels: {
    overview: string;
    market: string;
    national: string;
    farmer: string;
    retailer: string;
    alerts: string;
    methodology: string;
  };
}

export function NavigationHeader({
  locale,
  siteName,
  siteSubtitle,
  languageLabels,
  navLabels,
}: NavigationHeaderProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const navItems: NavItem[] = [
    { href: `/${locale}`, label: navLabels.overview, icon: "🏛️" },
    { href: `/${locale}/national`, label: navLabels.national, icon: "🗺️", badge: "30 Districts" },
    { href: `/${locale}/farmer`, label: navLabels.farmer, icon: "🌾", badge: "Audio & SMS" },
    { href: `/${locale}/market`, label: navLabels.market, icon: "📈" },
    { href: `/${locale}/retailer`, label: navLabels.retailer, icon: "🚛", badge: "Fuel Stress" },
    { href: `/${locale}/alerts`, label: navLabels.alerts, icon: "⚠️" },
    { href: `/${locale}/methodology`, label: navLabels.methodology, icon: "🔬" },
  ];

  // Modern Web Guidance: Manage main inert state and Escape listener for drawer
  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (drawerOpen) {
      if (mainEl) mainEl.inert = true;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setDrawerOpen(false);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        if (mainEl) mainEl.inert = false;
        document.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      if (mainEl) mainEl.inert = false;
    }
  }, [drawerOpen]);

  // Close drawer upon route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === `/${locale}`) {
      return pathname === `/${locale}` || pathname === `/${locale}/`;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Primary Brand Top Bar */}
      <header className="border-b border-line/60 bg-canopy text-cream shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-3.5">
          {/* Logo & Platform Identity */}
          <Link
            href={`/${locale}`}
            className="group flex flex-col transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-harvest rounded-md p-0.5"
          >
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold tracking-tight text-cream group-hover:text-harvest transition-colors">
                {siteName}
              </span>
              <span className="hidden sm:inline-block rounded bg-leaf/40 px-1.5 py-0.5 text-[10px] font-bold text-sprout uppercase tracking-wider">
                {locale === "rw" ? "Imibare y'Igihugu" : "National AgData"}
              </span>
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-sprout uppercase opacity-90">
              {siteSubtitle}
            </span>
          </Link>

          {/* Desktop Right Controls: Language Selector + Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <nav aria-label={languageLabels.label} className="flex items-center gap-1.5 text-xs">
              <span className="sr-only">{languageLabels.label}</span>
              {(["en", "rw"] as const).map((opt) => {
                const active = opt === locale;
                const label = opt === "en" ? languageLabels.en : languageLabels.rw;
                // Switch language preserving subpath
                const targetPath = pathname.replace(`/${locale}`, `/${opt}`);
                return (
                  <Link
                    key={opt}
                    href={targetPath}
                    aria-current={active ? "true" : undefined}
                    className={`rounded-full px-3 py-1 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-harvest ${
                      active
                        ? "bg-harvest text-canopy shadow-2xs"
                        : "border border-cream/30 text-cream/90 hover:bg-leaf hover:text-cream"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Drawer Trigger (Hidden on Desktop) */}
            <button
              ref={triggerRef}
              type="button"
              aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation-drawer"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-cream/30 bg-canopy text-cream hover:bg-leaf focus-visible:ring-2 focus-visible:ring-harvest transition-colors cursor-pointer"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                {drawerOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Secondary Sticky Navigation Bar */}
      <nav
        aria-label="Primary Navigation"
        className="hidden md:block sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md shadow-2xs"
      >
        <ul className="mx-auto flex max-w-6xl items-center gap-1 px-4 text-sm font-semibold text-canopy">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-3 border-b-2 transition-all ${
                    active
                      ? "border-canopy text-canopy bg-cream/60 font-bold"
                      : "border-transparent text-muted hover:text-canopy hover:border-leaf/40 hover:bg-cream/30"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-1 rounded-full bg-sprout/60 px-1.5 py-0.2 text-[10px] font-bold text-canopy uppercase">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile Navigation Drawer (Modern Web Guidance Top-Layer Overlay) */}
      {drawerOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="md:hidden fixed inset-0 z-50 flex animate-in fade-in duration-200"
        >
          {/* Backdrop Blur Dismissal Area */}
          <div
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
          />

          {/* Slide-in Drawer Panel */}
          <div
            ref={drawerRef}
            className="relative ml-auto flex h-full w-5/6 max-w-sm flex-col justify-between border-l border-line bg-paper p-6 shadow-2xl animate-in slide-in-from-right duration-250"
          >
            <div>
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex flex-col">
                  <span className="font-display font-bold text-canopy text-lg">{siteName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-leaf">Navigation Menu</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-2 text-muted hover:bg-cream hover:text-ink cursor-pointer focus-visible:ring-2 focus-visible:ring-canopy"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <ul className="mt-4 flex flex-col gap-1.5" role="list">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-canopy text-cream font-bold shadow-xs"
                            : "text-ink hover:bg-cream hover:text-canopy"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              active ? "bg-harvest text-canopy" : "bg-sprout text-canopy"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Drawer Footer Information */}
            <div className="border-t border-line pt-4 text-xs text-muted">
              <p className="font-medium text-ink">{siteName}</p>
              <p className="mt-1 text-[11px] text-muted leading-tight">
                {siteSubtitle}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
