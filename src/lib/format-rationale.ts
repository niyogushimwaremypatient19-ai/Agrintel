/**
 * Formats econometric diagnostic strings into natural, human language
 * for farmers, local leaders, and non-technical stakeholders in English and Kinyarwanda.
 */
export function formatAssessmentReasoning(rationale: string | null | undefined, locale: string): string {
  if (!rationale) return "";
  const isRw = locale === "rw";

  if (
    rationale.includes("substandard seed quality") ||
    rationale.includes("input diversion") ||
    rationale.includes("yield collapse")
  ) {
    return isRw
      ? "Imvura yaguye neza kandi ifumbire yarabonetse, ariko umusaruro wari munsi y'uwari witezwe. Birasaba ko abashinzwe ubuhinzi basuzuma imbuto z'amiganano cyangwa niba ifumbire yaratinze kugera ku baturage."
      : "Good rainfall and high fertilizer use were recorded, but harvest fell below normal expectations. Extension workers should verify seed bag certifications, check for counterfeit seeds, or investigate distribution delays.";
  }

  if (
    rationale.includes("precipitation deficit") ||
    rationale.includes("insufficient irrigation") ||
    rationale.includes("Yield reduction") ||
    rationale.includes("drought")
  ) {
    return isRw
      ? "Umusaruro wagabanutse bitewe n'amapfa n'imvura nke itaraguye ku gihe. Ibihingwa birasaba kuhirwa mu bishanga no gukoresha uburyo bwo kubika amazi."
      : "Harvest was reduced by low rainfall and dry weather spells. Expanding marshland canal irrigation and soil mulching are recommended to protect crops.";
  }

  if (
    rationale.includes("Superior production") ||
    rationale.includes("Effective synergy") ||
    rationale.includes("Intensification")
  ) {
    return isRw
      ? "Umusaruro uri hejuru cyane ugereranyije n'ibiteganywa. Abahinzi bo muri aka karere bageze ku musaruro mwiza binyuze mu gukoresha imbuto z'indobanure, ifumbire ku gihe, n'amaterasi arwanya isuri."
      : "Excellent harvest above regional targets. Farmers successfully combined certified seeds, timely fertilizer application, and good hillside soil terracing.";
  }

  if (rationale.includes("aligns with") || rationale.includes("expectations")) {
    return isRw
      ? "Umusaruro uhuye neza n'ibiteganywa muri aka karere ukurikije imvura yaguye n'ingano y'ifumbire yakoreshejwe."
      : "Harvest is on target with typical regional weather and seed expectations.";
  }

  return rationale;
}
