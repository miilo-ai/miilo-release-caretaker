import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { ReleaseSource } from "../../application/ports.js";
import { inspectRelease } from "../../domain/release.js";

const input = z.object({ scenario: z.string().min(1).max(64) });
const facts = z.object({
  version: z.string(), tagVersion: z.string().nullable(), draft: z.boolean(), prerelease: z.boolean(),
  requiredAssets: z.array(z.string()), publishedAssets: z.array(z.string()),
  formulaVersion: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), status: z.number().nullable() })),
});
const report = z.object({
  verdict: z.enum(["passed", "needs_attention", "inconclusive"]),
  findings: z.array(z.object({ id: z.string(), outcome: z.enum(["passed", "failed", "unknown"]),
    summary: z.string(), expected: z.string(), actual: z.string() })),
});

export function releaseWorkflow(source: ReleaseSource) {
  const collect = createStep({
    id: "collect-release-facts", inputSchema: input, outputSchema: facts,
    execute: async ({ inputData }) => source.read(inputData.scenario),
  });
  const inspect = createStep({
    id: "inspect-release", inputSchema: facts, outputSchema: report,
    execute: async ({ inputData }) => inspectRelease(inputData),
  });
  return createWorkflow({ id: "release-caretaker", inputSchema: input, outputSchema: report })
    .then(collect).then(inspect).commit();
}
