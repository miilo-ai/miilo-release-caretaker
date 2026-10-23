import type { ReleaseReport } from "./release.js";

export interface Investigation {
  summary: string;
  evidenceIds: string[];
  nextStep: string;
  source: "sample" | "model" | "unavailable";
}

export function validateInvestigation(value: Investigation, report: ReleaseReport): Investigation {
  const known = new Set(report.findings.map(finding => finding.id));
  if (value.summary.length > 2000 || value.nextStep.length > 1000
    || value.evidenceIds.length > 32 || new Set(value.evidenceIds).size !== value.evidenceIds.length
    || value.evidenceIds.some(id => !known.has(id))) {
    throw new Error("Investigation contains invalid or unbounded evidence references");
  }
  if (value.source !== "unavailable" && report.verdict !== "passed" && value.evidenceIds.length === 0) {
    throw new Error("Investigation must cite check evidence");
  }
  return value;
}
