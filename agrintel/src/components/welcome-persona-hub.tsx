import React from "react";
import Link from "next/link";

export interface PersonaData {
  role: string;
  action: string;
  cta: string;
}

export interface WelcomeHubData {
  badge: string;
  title: string;
  intro: string;
  whatWeDo: {
    title: string;
    desc: string;
  };
  whatValueWeBring: {
    title: string;
    desc: string;
  };
  whatToDo: {
    title: string;
    subtitle: string;
  };
  personas: {
    farmer: PersonaData;
    retailer: PersonaData;
    leader: PersonaData;
    citizen: PersonaData;
  };
}

export interface WelcomePersonaHubProps {
  hub: WelcomeHubData;
  locale: string;
  latestUpdate?: string;
  latestUpdateLabel?: string;
  disclaimer?: string;
}

const personaConfigs = [
  {
    key: "farmer" as const,
    icon: "🌾",
    path: "farmer",
    themeBg: "bg-sprout/20",
    themeBorder: "hover:border-canopy",
    badgeTheme: "bg-canopy/10 text-canopy",
    buttonTheme: "bg-canopy hover:bg-leaf text-cream",
  },
  {
    key: "retailer" as const,
    icon: "🚛",
    path: "retailer",
    themeBg: "bg-harvest/15",
    themeBorder: "hover:border-soil",
    badgeTheme: "bg-harvest/25 text-soil",
    buttonTheme: "bg-soil hover:bg-harvest hover:text-canopy text-cream",
  },
  {
    key: "leader" as const,
    icon: "🏛️",
    path: "national",
    themeBg: "bg-leaf/15",
    themeBorder: "hover:border-forest",
    badgeTheme: "bg-leaf/20 text-forest",
    buttonTheme: "bg-leaf hover:bg-canopy text-cream",
  },
  {
    key: "citizen" as const,
    icon: "🛒",
    path: "market",
    themeBg: "bg-clay/15",
    themeBorder: "hover:border-clay",
    badgeTheme: "bg-clay/20 text-clay",
    buttonTheme: "bg-clay hover:bg-clay/90 text-cream",
  },
];

export function WelcomePersonaHub({
  hub,
  locale,
  latestUpdate,
  latestUpdateLabel,
  disclaimer,
}: WelcomePersonaHubProps) {
  return (
    <section
      aria-label={hub.title}
      className="@container rounded-3xl border-2 border-canopy/30 bg-gradient-to-br from-paper via-cream/40 to-sprout/20 p-6 sm:p-8 shadow-xs"
    >
      {/* 1. Welcoming Hero Banner */}
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-canopy px-3.5 py-1 text-xs font-bold text-cream uppercase tracking-wider">
          {hub.badge}
        </span>
        <h2 className="mt-3 text-2xl font-black text-canopy sm:text-3xl lg:text-4xl">
          {hub.title}
        </h2>
        <p className="mt-3 text-base text-ink leading-relaxed">
          {hub.intro}
        </p>
        {disclaimer && (
          <p className="mt-2 text-xs text-muted">
            {disclaimer}
          </p>
        )}
        {latestUpdate && latestUpdateLabel && (
          <p className="mt-3 text-xs text-ink/80 flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-leaf animate-pulse" />
            <span className="font-bold text-canopy">{latestUpdateLabel}:</span> {latestUpdate}
          </p>
        )}
      </div>

      {/* 2. What We Do & What Value We Bring (Two Value Pillars) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Pillar 1: What We Do */}
        <div className="rounded-2xl border border-line bg-paper/95 p-5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sprout/70 text-lg">
              📋
            </span>
            <h3 className="text-base font-extrabold text-canopy">
              {hub.whatWeDo.title}
            </h3>
          </div>
          <p className="mt-2.5 text-xs sm:text-sm text-ink/90 leading-relaxed">
            {hub.whatWeDo.desc}
          </p>
        </div>

        {/* Pillar 2: What Value We Bring */}
        <div className="rounded-2xl border border-line bg-paper/95 p-5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-harvest/30 text-lg">
              💡
            </span>
            <h3 className="text-base font-extrabold text-soil">
              {hub.whatValueWeBring.title}
            </h3>
          </div>
          <p className="mt-2.5 text-xs sm:text-sm text-ink/90 leading-relaxed">
            {hub.whatValueWeBring.desc}
          </p>
        </div>
      </div>

      {/* 3. What To Do (Interactive 4-Persona Entry Hub) */}
      <div className="mt-8">
        <div className="border-t border-line/60 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
            <h3 className="text-lg font-black text-canopy sm:text-xl">
              {hub.whatToDo.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted">
              {hub.whatToDo.subtitle}
            </p>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {personaConfigs.map((cfg) => {
              const persona = hub.personas[cfg.key];
              return (
                <div
                  key={cfg.key}
                  className={`group relative flex flex-col justify-between rounded-2xl border border-line bg-paper p-5 transition-all ${cfg.themeBorder} hover:shadow-md`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-2xl select-none">{cfg.icon}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${cfg.badgeTheme}`}
                      >
                        {persona.role}
                      </span>
                    </div>

                    <p className="text-xs text-ink/80 leading-relaxed">
                      {persona.action}
                    </p>
                  </div>

                  <Link
                    href={`/${locale}/${cfg.path}`}
                    className={`mt-4 inline-flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${cfg.buttonTheme} cursor-pointer`}
                  >
                    <span>{persona.cta}</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
