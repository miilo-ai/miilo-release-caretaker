import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { CheckSource, Investigator } from "../../application/ports.js";
import { summarizeFindings } from "../../domain/release.js";
import { validateInvestigation } from "../../domain/investigation.js";
import { decisionSchema, reviewContextSchema, reviewedSchema, resultSchema } from "./schemas.js";

export function investigationStep(investigator: Investigator) {
  return createStep({
    id: "investigate", inputSchema: reviewContextSchema.omit({ investigation: true }),
    outputSchema: reviewContextSchema,
    execute: async ({ inputData }) => {
      try {
        const investigation = validateInvestigation(await investigator.investigate(inputData.report), inputData.report);
        return { ...inputData, investigation };
      } catch {
        return { ...inputData, investigation: { summary: "Investigation unavailable; check evidence remains available.",
          evidenceIds: [], nextStep: "Review the deterministic findings.", source: "unavailable" as const } };
      }
    },
  });
}

export function reviewStep() {
  return createStep({
    id: "human-review", inputSchema: reviewContextSchema, outputSchema: reviewedSchema,
    resumeSchema: decisionSchema,
    suspendSchema: z.object({ revision: z.string(), reason: z.string(), evidenceIds: z.array(z.string()) }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (inputData.report.verdict === "passed") return { ...inputData, decision: "not_required" as const };
      if (!resumeData || resumeData.expectedRevision !== inputData.revision) {
        return suspend({ revision: inputData.revision, reason: resumeData ? "Review revision changed" : "Review findings",
          evidenceIds: inputData.report.findings.filter(f => f.outcome !== "passed").map(f => f.id) });
      }
      return { ...inputData, decision: resumeData.decision };
    },
  });
}

export function verificationStep(checks: CheckSource) {
  return createStep({
    id: "verify-again", inputSchema: reviewedSchema, outputSchema: resultSchema, retries: 2,
    execute: async ({ inputData, runId }) => {
      if (inputData.decision !== "recheck") return { ...inputData, verification: null };
      const context = { runId, stage: "verification" as const };
      const groups = await Promise.all([
        checks.inspect("release", inputData.scenario, context), checks.inspect("package", inputData.scenario, context),
        checks.inspect("links", inputData.scenario, context),
      ]);
      return { ...inputData, verification: summarizeFindings(groups.flat()) };
    },
  });
}
