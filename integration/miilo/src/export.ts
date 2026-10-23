import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { caretakerRuntime } from "../../../src/adapters/mastra/runtime.js";
import { SampleChecks, SampleInvestigator } from "../../../src/adapters/sample-checks.js";
import { ScenarioSource } from "../../../src/adapters/scenarios.js";
import { normalizeRun } from "./normalize.js";
import { writeObservation } from "./write.js";

const [id, output, watch] = process.argv.slice(2);
if (!id || !/^[a-zA-Z0-9-]{1,128}$/.test(id) || !output || (watch && watch !== "--watch")) {
  console.error("Use miilo:export RUN_ID OUTPUT_FILE [--watch]");
  process.exitCode = 2;
} else {
  const runtime = caretakerRuntime(`file:${resolve(process.env.CARETAKER_STATE_DIR ?? ".caretaker", "runs.db")}`,
    new SampleChecks(new ScenarioSource()), new SampleInvestigator());
  const stop = new AbortController();
  const halt = () => stop.abort();
  process.once("SIGINT", halt); process.once("SIGTERM", halt);
  try {
    do {
      const state = await runtime.workflow.getWorkflowRunById(id);
      if (!state) throw new Error("No saved workflow run");
      await writeObservation(resolve(output), normalizeRun(state, new Date().toISOString()));
      if (watch) await setTimeout(5000, undefined, { signal: stop.signal });
    } while (watch && !stop.signal.aborted);
  } catch {
    if (!stop.signal.aborted) {
      console.error("Cannot export authoritative workflow state; previous snapshot will become stale.");
      process.exitCode = 2;
    }
  } finally {
    process.removeListener("SIGINT", halt); process.removeListener("SIGTERM", halt);
    await runtime.storage.close();
  }
}
