import { createHash } from "node:crypto";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { CheckSource, Investigator } from "../../application/ports.js";
import { summarizeFindings } from "../../domain/release.js";
import { checkStep, scenarioSchema } from "./check-steps.js";
import { findingsSchema, resultSchema, reviewContextSchema } from "./schemas.js";
import { investigationStep, reviewStep, verificationStep } from "./review-steps.js";

export function caretakerWorkflow(checks: CheckSource, investigator: Investigator) {
  const branch = z.object({ scenario: z.string(), findings: findingsSchema });
  const aggregate = createStep({
    id: "aggregate", inputSchema: z.object({ release: branch, package: branch, links: branch }),
    outputSchema: reviewContextSchema.omit({ investigation: true }),
    execute: async ({ inputData }) => {
      const report = summarizeFindings([
        ...inputData.release.findings, ...inputData.package.findings, ...inputData.links.findings,
      ]);
      return { scenario: inputData.release.scenario, report,
        revision: createHash("sha256").update(JSON.stringify(report)).digest("hex") };
    },
  });
  return createWorkflow({
    id: "release-caretaker-reviewed", inputSchema: scenarioSchema, outputSchema: resultSchema,
    retryConfig: { attempts: 0, delay: 20 }, options: { shouldPersistSnapshot: () => true },
  }).parallel([checkStep("release", checks), checkStep("package", checks), checkStep("links", checks)])
    .then(aggregate).then(investigationStep(investigator)).then(reviewStep())
    .then(verificationStep(checks)).commit();
}
