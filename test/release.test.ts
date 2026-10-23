import { test } from "node:test";
import { strict as assert } from "node:assert";
import { inspectRelease } from "../src/domain/release.js";
import { ScenarioSource } from "../src/adapters/scenarios.js";
import { releaseWorkflow } from "../src/adapters/mastra/workflow.js";

test("stale formula fails even when release and assets exist", async () => {
  const report = inspectRelease(await new ScenarioSource().read("stale-package"));
  assert.equal(report.verdict, "needs_attention");
  assert.deepEqual(report.findings.filter(f => f.outcome === "failed").map(f => f.id), ["formula"]);
});

test("missing assets and broken links both retain evidence", async () => {
  const report = inspectRelease(await new ScenarioSource().read("broken-release"));
  assert.equal(report.findings.filter(f => f.outcome === "failed").length, 2);
  assert.ok(report.findings.some(f => f.actual === "HTTP 404"));
});

test("unavailable requests are inconclusive, never healthy", async () => {
  const facts = await new ScenarioSource().read("healthy");
  facts.formulaVersion = null;
  assert.equal(inspectRelease(facts).verdict, "inconclusive");
});

test("draft and prerelease are not a stable publication", async () => {
  for (const flag of ["draft", "prerelease"] as const) {
    const facts = await new ScenarioSource().read("healthy");
    facts[flag] = true;
    assert.equal(inspectRelease(facts).verdict, "needs_attention");
  }
});

test("actual Mastra workflow completes all three scenarios", async () => {
  for (const [scenario, expected] of [["healthy", "passed"], ["stale-package", "needs_attention"],
    ["broken-release", "needs_attention"]]) {
    const run = await releaseWorkflow(new ScenarioSource()).createRun();
    const result = await run.start({ inputData: { scenario: scenario! } });
    assert.equal(result.status, "success");
    if (result.status === "success") assert.equal(result.result.verdict, expected);
  }
});

test("collection failure cannot become a passed report", async () => {
  const run = await releaseWorkflow({ read: async () => { throw new Error("Source unavailable"); } }).createRun();
  const result = await run.start({ inputData: { scenario: "healthy" } });
  assert.equal(result.status, "failed");
});
