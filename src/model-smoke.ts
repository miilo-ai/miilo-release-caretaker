import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { readModelConfig } from "./adapters/model/config.js";
import { modelInvestigator } from "./adapters/mastra/model-investigator.js";
import { caretakerRuntime } from "./adapters/mastra/runtime.js";
import { SampleChecks } from "./adapters/sample-checks.js";
import { ScenarioSource } from "./adapters/scenarios.js";
import { reviewContextSchema } from "./adapters/mastra/schemas.js";
import type { ModelMeasurement } from "./adapters/model/compatible.js";
import { z } from "zod";

async function main() {
  const path = process.env.CARETAKER_MODEL_CONFIG;
  if (!path) throw new Error("Set CARETAKER_MODEL_CONFIG to a private configuration file");
  process.umask(0o077);
  const directory = resolve(process.env.CARETAKER_STATE_DIR ?? ".caretaker");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let measurement: ModelMeasurement | undefined;
  const investigator = modelInvestigator(await readModelConfig(path), value => { measurement = value; });
  const runtime = caretakerRuntime(`file:${resolve(directory, "runs.db")}`,
    new SampleChecks(new ScenarioSource()), investigator);
  try {
    const run = await runtime.workflow.createRun();
    const result = await run.start({ inputData: { scenario: "stale-package" } });
    const saved = await runtime.workflow.getWorkflowRunById(run.runId);
    const detail = z.object({ steps: z.object({ investigate: z.object({ output: reviewContextSchema }) }) })
      .parse(saved).steps.investigate.output;
    if (result.status !== "suspended" || detail.investigation.source !== "model") {
      console.error(JSON.stringify({ status: "unavailable", measurement }));
      throw new Error("Live model investigation did not complete");
    }
    console.log(JSON.stringify({ runId: run.runId, status: result.status, checks: "sample",
      report: detail.report, investigation: detail.investigation, measurement }, null, 2));
  } finally { await runtime.storage.close(); }
}

try { await main(); }
catch { console.error("Live model smoke test failed. Check the private model configuration and endpoint health.");
  process.exitCode = 1; }
