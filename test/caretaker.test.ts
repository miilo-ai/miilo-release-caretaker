import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { CheckGroup, CheckSource, Investigator } from "../src/application/ports.js";
import { caretakerWorkflow } from "../src/adapters/mastra/caretaker.js";
import { SampleChecks, SampleInvestigator } from "../src/adapters/sample-checks.js";
import { ScenarioSource } from "../src/adapters/scenarios.js";
import { caretakerRuntime } from "../src/adapters/mastra/runtime.js";
import { reviewContextSchema } from "../src/adapters/mastra/schemas.js";
import { z } from "zod";

const samples = new SampleChecks(new ScenarioSource());
const investigator = new SampleInvestigator();
function context(value: unknown) {
  return z.object({ steps: z.object({ investigate: z.object({ output: reviewContextSchema }) }) })
    .parse(value).steps.investigate.output;
}

test("checks really fan out before any branch finishes", async () => {
  const started = new Set<CheckGroup>();
  let unblock = () => {};
  const barrier = new Promise<void>(resolve => { unblock = resolve; });
  const checks: CheckSource = { inspect: async (group, scenario) => {
    started.add(group);
    if (started.size === 3) unblock();
    await barrier;
    return samples.inspect(group, scenario);
  } };
  const run = await caretakerWorkflow(checks, investigator).createRun();
  const result = await run.start({ inputData: { scenario: "healthy" } });
  assert.equal(result.status, "success");
  assert.equal(started.size, 3);
  if (result.status === "success") assert.equal(result.result.decision, "not_required");
});

test("review suspends, rejects a stale revision, and acknowledgement keeps failed findings", async t => {
  const runtime = caretakerRuntime(":memory:", samples, investigator);
  t.after(() => runtime.storage.close());
  const run = await runtime.workflow.createRun();
  const initial = await run.start({ inputData: { scenario: "stale-package" } });
  assert.equal(initial.status, "suspended");
  const stale = await run.resume({ step: "human-review",
    resumeData: { expectedRevision: "0".repeat(64), decision: "recheck" } });
  assert.equal(stale.status, "suspended");
  const revision = context(initial).revision;
  assert.equal(typeof revision, "string");
  const accepted = await run.resume({ step: "human-review",
    resumeData: { expectedRevision: revision, decision: "acknowledge" } });
  assert.equal(accepted.status, "success");
  if (accepted.status === "success") {
    assert.equal(accepted.result.report.verdict, "needs_attention");
    assert.equal(accepted.result.verification, null);
  }
});

test("explicit recheck observes corrected source and preserves original evidence", async t => {
  let repaired = false;
  const checks: CheckSource = { inspect: (group, scenario) => samples.inspect(group, repaired ? "healthy" : scenario) };
  const runtime = caretakerRuntime(":memory:", checks, investigator);
  t.after(() => runtime.storage.close());
  const run = await runtime.workflow.createRun();
  const initial = await run.start({ inputData: { scenario: "stale-package" } });
  assert.equal(initial.status, "suspended");
  repaired = true;
  const result = await run.resume({ step: "human-review", resumeData: {
    expectedRevision: context(initial).revision, decision: "recheck",
  } });
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.result.report.verdict, "needs_attention");
    assert.equal(result.result.verification?.verdict, "passed");
  }
});

test("transient check failure retries only its branch within a bound", async () => {
  const counts = { release: 0, package: 0, links: 0 };
  const checks: CheckSource = { inspect: async (group, scenario) => {
    counts[group]++;
    if (group === "package" && counts.package < 3) throw new Error("Temporary source failure");
    return samples.inspect(group, scenario);
  } };
  const run = await caretakerWorkflow(checks, investigator).createRun();
  const result = await run.start({ inputData: { scenario: "healthy" } });
  assert.equal(result.status, "success");
  assert.deepEqual(counts, { release: 1, package: 3, links: 1 });
});

test("invented model evidence cannot replace deterministic findings", async () => {
  const invalid: Investigator = { investigate: async () => ({
    summary: "Everything passed", evidenceIds: ["invented"], nextStep: "Publish", source: "model",
  }) };
  const run = await caretakerWorkflow(samples, invalid).createRun();
  const result = await run.start({ inputData: { scenario: "broken-release" } });
  assert.equal(result.status, "suspended");
  assert.equal(context(result).investigation.source, "unavailable");
  assert.equal(context(result).report.verdict, "needs_attention");
});

test("permanent branch failure stops after bounded retries", async () => {
  let attempts = 0;
  const checks: CheckSource = { inspect: async (group, scenario) => {
    if (group === "package") { attempts++; throw new Error("Unavailable"); }
    return samples.inspect(group, scenario);
  } };
  const run = await caretakerWorkflow(checks, investigator).createRun();
  const result = await run.start({ inputData: { scenario: "healthy" } });
  assert.equal(result.status, "failed");
  assert.equal(attempts, 3);
});
