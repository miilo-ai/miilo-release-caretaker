import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { ScenarioSource } from "./adapters/scenarios.js";
import { SampleChecks, SampleInvestigator } from "./adapters/sample-checks.js";
import { caretakerRuntime } from "./adapters/mastra/runtime.js";
import { reviewContextSchema, resultSchema } from "./adapters/mastra/schemas.js";
import { scenarioSchema } from "./adapters/mastra/check-steps.js";
import { readModelConfig } from "./adapters/model/config.js";
import { modelInvestigator } from "./adapters/mastra/model-investigator.js";

const [command, id, revision, decision, repairFlag] = process.argv.slice(2);
const identifier = z.string().regex(/^[a-zA-Z0-9-]{1,128}$/);
const resume = z.object({ expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["acknowledge", "recheck"]) });
const snapshotContext = z.object({ steps: z.object({ investigate: z.object({ output: reviewContextSchema }) }) });

async function main() {
  if (command === "start") scenarioSchema.parse({ scenario: id });
  else if (command === "status") identifier.parse(id);
  else if (command === "resume") {
    identifier.parse(id);
    resume.parse({ expectedRevision: revision, decision });
    if (repairFlag !== undefined && repairFlag !== "--sample-repaired") throw new Error("Invalid sample flag");
  } else throw new Error("Invalid command");

  process.umask(0o077);
  const directory = resolve(process.env.CARETAKER_STATE_DIR ?? ".caretaker");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const samples = new SampleChecks(new ScenarioSource());
  const checks = repairFlag === "--sample-repaired"
    ? { inspect: (group: Parameters<typeof samples.inspect>[0]) => samples.inspect(group, "healthy") }
    : samples;
  const investigator = command === "start" && process.env.CARETAKER_MODEL_CONFIG
    ? modelInvestigator(await readModelConfig(process.env.CARETAKER_MODEL_CONFIG)) : new SampleInvestigator();
  const runtime = caretakerRuntime(`file:${resolve(directory, "runs.db")}`, checks, investigator);
  try {
    if (command === "status") {
      const state = await runtime.workflow.getWorkflowRunById(id!);
      if (!state) throw new Error("Run not found");
      console.log(JSON.stringify({ runId: id, status: state.status, source: "sample scenario" }, null, 2));
      return;
    }
    if (command === "resume") {
      const state = await runtime.workflow.getWorkflowRunById(id!);
      if (state?.status !== "suspended") throw new Error("Run is not awaiting review");
    }
    const run = await runtime.workflow.createRun(command === "resume" ? { runId: id! } : {});
    const result = command === "start"
      ? await run.start({ inputData: scenarioSchema.parse({ scenario: id }) })
      : await run.resume({ step: "human-review", resumeData: resume.parse({ expectedRevision: revision, decision }) });
    const detail = result.status === "success" ? resultSchema.parse(result.result)
      : result.status === "suspended" ? snapshotContext.parse(result).steps.investigate.output : null;
    console.log(JSON.stringify({ runId: run.runId, status: result.status, source: "sample scenario", detail }, null, 2));
    if (result.status === "failed") process.exitCode = 2;
  } finally {
    await runtime.storage.close();
  }
}

try { await main(); }
catch {
  console.error("Journey command could not complete. Use start SCENARIO, status RUN_ID, or resume RUN_ID REVISION recheck|acknowledge [--sample-repaired].");
  process.exitCode = 2;
}
