import React from "react";

export interface OntologyStage {
  step: string;
  name: string;
  subtext: string;
}

export interface OntologyProps {
  ontology: {
    eyebrow: string;
    title: string;
    subtitle: string;
    stages: readonly OntologyStage[] | OntologyStage[];
  };
}

export function OntologyPipelineStrip({ ontology }: OntologyProps) {
  return (
    <section
      aria-label={ontology.title}
      className="@container rounded-2xl border border-line bg-paper p-5 sm:p-6 shadow-xs"
    >
      {/* Schematic Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-3.5 mb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canopy/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-canopy font-mono">
            {ontology.eyebrow}
          </span>
          <h2 className="mt-1 text-base font-black tracking-tight text-canopy sm:text-lg">
            {ontology.title}
          </h2>
          <p className="text-xs text-muted">
            {ontology.subtitle}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 self-start sm:self-auto text-[11px] font-mono text-muted bg-cream/80 px-2.5 py-1 rounded-lg border border-line/60">
          <span className="h-2 w-2 rounded-full bg-leaf animate-pulse" />
          <span>Always Up to Date · Field Verified</span>
        </div>
      </div>

      {/* 6-Stage Pipeline Graph */}
      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
        {ontology.stages.map((stage, idx) => {
          const isLast = idx === ontology.stages.length - 1;
          return (
            <li
              key={stage.step}
              className="group relative flex flex-col justify-between rounded-xl border border-line/80 bg-cream/30 p-3 transition-all hover:border-canopy hover:bg-sprout/20 hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="font-mono text-[11px] font-black tabular-nums text-canopy bg-sprout/80 px-2 py-0.5 rounded-md">
                    {stage.step}
                  </span>
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className="hidden lg:block text-xs font-bold text-muted/60 group-hover:text-canopy transition-colors"
                    >
                      →
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-black tracking-tight text-canopy leading-snug">
                  {stage.name}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  {stage.subtext}
                </p>
              </div>

              {/* Status footer pill */}
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[10px] font-mono text-muted">
                <span className="uppercase tracking-wider">Step {idx + 1}</span>
                <span className="text-leaf font-bold">Ready</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
