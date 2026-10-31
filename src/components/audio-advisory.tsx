"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type AudioAdvisoryProps = {
  locale: "en" | "rw";
  cropName: string;
  districtName: string;
  speechText: string;
  labels: {
    listen: string;
    playing: string;
    paused: string;
    pause: string;
    resume: string;
    stop: string;
    replay: string;
    tapToPlay: string;
    notSupported: string;
  };
};

export function AudioAdvisoryPlayer({
  locale,
  cropName,
  districtName,
  speechText,
  labels,
}: AudioAdvisoryProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [activeVoice, setActiveVoice] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    // Clean up on unmount or text change
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // When speechText changes, stop any ongoing playback
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setStatus("idle");
    }
  }, [speechText]);

  const handlePlay = useCallback(() => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(speechText);
    utteranceRef.current = utterance;

    // Pick best available voice (try Kinyarwanda or Swahili or standard calm voice)
    const voices = window.speechSynthesis.getVoices();
    const rwVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith("rw") ||
        v.lang.toLowerCase().startsWith("sw") ||
        v.name.toLowerCase().includes("rwanda") ||
        v.name.toLowerCase().includes("swahili"),
    );

    if (rwVoice && locale === "rw") {
      utterance.voice = rwVoice;
      setActiveVoice(rwVoice.name);
    } else {
      utterance.lang = locale === "rw" ? "rw-RW" : "en-US";
    }

    // Pace slightly slower for clear rural comprehension
    utterance.rate = 0.88;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setStatus("playing");
    };

    utterance.onend = () => {
      setStatus("idle");
    };

    utterance.onerror = (e) => {
      // Ignore user interrupt cancellations
      if (e.error !== "canceled" && e.error !== "interrupted") {
        console.warn("Speech synthesis notice:", e.error);
      }
      setStatus("idle");
    };

    utterance.onpause = () => {
      setStatus("paused");
    };

    utterance.onresume = () => {
      setStatus("playing");
    };

    window.speechSynthesis.speak(utterance);
  }, [speechText, locale]);

  const handlePause = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setStatus("paused");
    }
  };

  const handleResume = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setStatus("playing");
    }
  };

  const handleStop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setStatus("idle");
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-2xl border border-line bg-paper/60 p-4 text-xs text-muted">
        ℹ️ {labels.notSupported}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-canopy/30 bg-paper p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Indicator & Description */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-colors ${
              status === "playing"
                ? "bg-leaf text-cream shadow-md"
                : "bg-sprout text-canopy"
            }`}
          >
            {status === "playing" ? "🔊" : "🔈"}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-canopy sm:text-lg">
                {labels.listen}
              </h3>
              {status === "playing" && (
                <span className="flex items-center gap-1 rounded-full bg-leaf/20 px-2 py-0.5 text-xs font-semibold text-leaf">
                  <span className="h-2 w-2 animate-ping rounded-full bg-leaf" />
                  {labels.playing}
                </span>
              )}
              {status === "paused" && (
                <span className="rounded-full bg-harvest/20 px-2 py-0.5 text-xs font-semibold text-soil">
                  {labels.paused}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {status === "idle"
                ? `${labels.tapToPlay} (${cropName} · ${districtName})`
                : `${districtName} · ${cropName}`}
            </p>
          </div>
        </div>

        {/* Right: Audio Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {status === "idle" && (
            <button
              type="button"
              onClick={handlePlay}
              className="inline-flex items-center gap-2 rounded-xl bg-canopy px-5 py-2.5 font-bold text-cream shadow-sm hover:bg-leaf transition-all hover:scale-102 active:scale-98"
              aria-label={labels.listen}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{locale === "rw" ? "Kanda wumve inama" : "Play Advisory"}</span>
            </button>
          )}

          {status === "playing" && (
            <>
              {/* Animated Sound Wave Bars */}
              <div
                className="flex items-center gap-1 px-2 py-1 select-none"
                aria-hidden="true"
              >
                <span className="h-5 w-1 animate-pulse rounded-full bg-leaf" />
                <span className="h-7 w-1 animate-bounce rounded-full bg-canopy" />
                <span className="h-4 w-1 animate-pulse rounded-full bg-leaf" />
                <span className="h-6 w-1 animate-bounce rounded-full bg-canopy" />
              </div>

              <button
                type="button"
                onClick={handlePause}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3.5 py-2 text-sm font-semibold text-ink hover:bg-cream transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.75 0v-12a.75.75 0 01.75-.75zm9 0a.75.75 0 01.75.75v12a.75.75 0 01-1.75 0v-12a.75.75 0 01.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{labels.pause}</span>
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-200 px-3.5 py-2 text-sm font-semibold text-ink hover:bg-stone-300 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{labels.stop}</span>
              </button>
            </>
          )}

          {status === "paused" && (
            <>
              <button
                type="button"
                onClick={handleResume}
                className="inline-flex items-center gap-1.5 rounded-xl bg-canopy px-4 py-2 text-sm font-bold text-cream hover:bg-leaf transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{labels.resume}</span>
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-stone-300 transition"
              >
                <span>{labels.stop}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
