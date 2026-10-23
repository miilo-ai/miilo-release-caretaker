import { ScenarioSource, scenarioNames } from "./adapters/scenarios.js";
import { releaseWorkflow } from "./adapters/mastra/workflow.js";

const scenario = process.argv[2] ?? "stale-package";
if (!scenarioNames.some(name => name === scenario)) {
  console.error(`Choose a scenario: ${scenarioNames.join(", ")}`);
  process.exitCode = 2;
} else {
  try {
    const run = await releaseWorkflow(new ScenarioSource()).createRun();
    const result = await run.start({ inputData: { scenario } });
    if (result.status !== "success") throw new Error(`Workflow ended with ${result.status}`);
    console.log(JSON.stringify({ source: "sample scenario", scenario, report: result.result }, null, 2));
    process.exitCode = result.result.verdict === "passed" ? 0 : 1;
  } catch {
    console.error("Caretaker workflow could not complete; no successful verdict is available.");
    process.exitCode = 2;
  }
}
