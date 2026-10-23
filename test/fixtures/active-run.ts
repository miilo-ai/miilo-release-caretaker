import { appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { caretakerRuntime } from "../../src/adapters/mastra/runtime.js";
import { SampleChecks, SampleInvestigator } from "../../src/adapters/sample-checks.js";
import { ScenarioSource } from "../../src/adapters/scenarios.js";

const [mode, directory] = process.argv.slice(2);
if (!directory || !["start", "restart"].includes(mode ?? "")) throw new Error("Invalid test fixture command");
const checks = new SampleChecks(new ScenarioSource());
const runtime = caretakerRuntime(`file:${join(directory, "runs.db")}`, {
  inspect: async (group, scenario) => {
    await appendFile(join(directory, "calls.jsonl"), JSON.stringify({ group, event: "started" }) + "\n");
    if (mode === "start" && group === "package") {
      await writeFile(join(directory, "blocked"), "package");
      while (true) await setTimeout(1000);
    }
    const result = await checks.inspect(group, scenario);
    await appendFile(join(directory, "calls.jsonl"), JSON.stringify({ group, event: "completed" }) + "\n");
    return result;
  },
}, new SampleInvestigator());
try {
  const run = await runtime.workflow.createRun({ runId: "active-recovery" });
  const result = mode === "start" ? await run.start({ inputData: { scenario: "healthy" } }) : await run.restart();
  console.log(JSON.stringify({ runId: run.runId, status: result.status }));
} finally { await runtime.storage.close(); }
