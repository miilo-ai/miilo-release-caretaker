import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { CheckGroup, CheckSource } from "../../application/ports.js";
import { findingsSchema } from "./schemas.js";

export const scenarioSchema = z.object({ scenario: z.enum(["healthy", "stale-package", "broken-release"]) });

export function checkStep<T extends CheckGroup>(group: T, source: CheckSource) {
  return createStep({
    id: group, inputSchema: scenarioSchema,
    outputSchema: z.object({ scenario: z.string(), findings: findingsSchema }), retries: 2,
    execute: async ({ inputData, runId }) => ({
      scenario: inputData.scenario, findings: await source.inspect(group, inputData.scenario, { runId, stage: "initial" }),
    }),
  });
}
