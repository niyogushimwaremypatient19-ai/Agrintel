"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const isRw = locale === "rw";

  useEffect(() => {
    // Log unexpected errors for monitoring
    console.error("AgrIntel Application Error Boundary Caught:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto my-12 flex max-w-2xl flex-col items-center rounded-2xl border border-clay/30 bg-paper p-8 text-center shadow-md animate-in fade-in"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-clay/10 text-clay">
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="mt-4 font-display text-2xl font-bold text-canopy sm:text-3xl">
        {isRw
          ? "Habaye ikibazo mu gushaka amakuru"
          : "Unable to Complete Agricultural Data Request"}
      </h1>

      <p className="mt-3 text-sm text-muted leading-relaxed max-w-lg">
        {isRw
          ? "Ntibyakunze guhuza na seriveri ya data y'ubuhinzi cyangwa imibare y'amasoko. Kanda buto yo hasi wongere ugerageze, cyangwa usubire ku rubuga nyamukuru."
          : "We encountered a temporary disruption while querying agro-climatic signals or price observations. The service remains resilient with cached fallbacks."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-xl bg-canopy px-5 py-2.5 text-sm font-bold text-cream hover:bg-leaf transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harvest cursor-pointer"
        >
          {isRw ? "Ongera ugerageze" : "Try Again / Reconnect"}
        </button>

        <Link
          href={`/${locale}`}
          className="rounded-xl border border-line bg-cream px-5 py-2.5 text-sm font-bold text-ink hover:bg-sprout/40 transition-colors"
        >
          {isRw ? "Subira ku ntangiriro" : "Return to Overview"}
        </Link>
      </div>

      {/* Transparent Technical Diagnostics */}
      <details className="mt-8 w-full text-left rounded-xl border border-line bg-cream/50 p-4 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-soil hover:text-canopy">
          {isRw ? "Amakuru y'ubushakashatsi (Technical Details)" : "Technical Diagnostic Details"}
        </summary>
        <div className="mt-3 overflow-x-auto font-mono text-[11px] text-ink/80 space-y-1">
          <p>
            <span className="font-semibold text-soil">Error:</span> {error.message || "Unknown error"}
          </p>
          {error.digest && (
            <p>
              <span className="font-semibold text-soil">Digest ID:</span> {error.digest}
            </p>
          )}
          <p className="text-[10px] text-muted">
            Locale: {locale} · Timestamp: {new Date().toISOString()}
          </p>
        </div>
      </details>
    </div>
  );
}
