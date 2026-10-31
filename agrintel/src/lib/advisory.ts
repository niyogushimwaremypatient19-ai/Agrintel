import type { RiskCategory } from "@/lib/data/risk";

/** One GSM-7 SMS holds 160 characters. Longer messages are split and cost more to send. */
export const SMS_SINGLE_LIMIT = 160;

export type GuidanceKey = "high" | "moderate" | "low" | "unavailable" | "livestock";

/**
 * Chooses which general guidance paragraph to show. Livestock always gets the
 * "not connected" guidance, because no livestock data is wired in yet.
 */
export function guidanceKey(category: RiskCategory, isLivestock: boolean): GuidanceKey {
  if (isLivestock) return "livestock";
  return category;
}

export type SmsValues = {
  district: string;
  crop: string;
  signal: string | null;
  status: string;
  period: string;
  updated: string;
};

/**
 * Fills an SMS template and reports its length. The message must say what it is
 * (a preview), where it applies, what it shows, and how fresh it is.
 */
export function buildSms(template: string, values: SmsValues) {
  const text = template
    .replace("{district}", values.district)
    .replace("{crop}", values.crop)
    .replace("{signal}", values.signal ?? "")
    .replace("{status}", values.status)
    .replace("{period}", values.period)
    .replace("{updated}", values.updated);

  return {
    text,
    length: text.length,
    fitsOneMessage: text.length <= SMS_SINGLE_LIMIT,
  };
}
