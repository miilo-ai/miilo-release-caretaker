import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { caretakerRuntime } from "../../../src/adapters/mastra/runtime.js";
import { SampleChecks, SampleInvestigator } from "../../../src/adapters/sample-checks.js";
import { ScenarioSource } from "../../../src/adapters/scenarios.js";
import { normalizeRun } from "../src/normalize.js";
import { writeObservation } from "../src/write.js";

const binary = process.env.MIILO_CLI_BIN;
if (!binary) throw new Error("Set MIILO_CLI_BIN to the locally built Miilo executable");

test("actual caretaker, local SDK and native CLI reconcile review, repair, source failure and removal", async t => {
  const directory = await mkdtemp(join(tmpdir(), "miilo-local-stack-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let repaired = false;
  const samples = new SampleChecks(new ScenarioSource());
  const runtime = caretakerRuntime(`file:${join(directory, "runs.db")}`, {
    inspect: (group, scenario) => samples.inspect(group, repaired ? "healthy" : scenario),
  }, new SampleInvestigator());
  t.after(() => runtime.storage.close());
  const run = await runtime.workflow.createRun();
  const initial = await run.start({ inputData: { scenario: "stale-package" } });
  assert.equal(initial.status, "suspended");
  const first = normalizeRun(await runtime.workflow.getWorkflowRunById(run.runId), new Date().toISOString());
  const output = join(directory, "workflow.json");
  await writeObservation(output, first);
  const config = join(directory, "local.json");
  await writeFile(config, JSON.stringify({ version: 2, mode: "local", sessions: [], groups: [],
    snapshotFile: join(directory, "snapshot.json"), customSetting: "preserved" }), { mode: 0o600 });
  const cli = (...args: string[]) => {
    const result = spawnSync(binary!, ["local", ...args], { encoding: "utf8", timeout: 15_000,
      env: { ...process.env, HOME: directory, MIILO_HOME: join(directory, ".miilo"), MIILO_LOCAL_CONFIG: config,
        XDG_STATE_HOME: join(directory, "state"), XDG_CONFIG_HOME: join(directory, "config") } });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout ? JSON.parse(result.stdout) : undefined;
  };
  cli("workflows", "add", first.provider.id, output);
  assert.equal(JSON.parse(await readFile(config, "utf8")).customSetting, "preserved");
  cli("run", "--once");
  const before = cli("snapshot");
  assert.equal(before.providers.length, 1);
  assert.ok(before.attention.some((a: { reason: string }) => a.reason === "workflow_review"));
  assert.ok(before.evidence.some((e: { outcome: string }) => e.outcome === "failed"));
  assert.ok(before.workItems.every((w: { actions: unknown[] }) => w.actions.length === 0));
  repaired = true;
  const resumed = await run.resume({ step: "human-review", resumeData: {
    expectedRevision: first.runs[0]!.review!.revision, decision: "recheck",
  } });
  assert.equal(resumed.status, "success");
  const after = normalizeRun(await runtime.workflow.getWorkflowRunById(run.runId), new Date().toISOString());
  await writeObservation(output, after);
  cli("run", "--once");
  const current = cli("snapshot");
  assert.equal(current.attention.length, 0);
  assert.ok(current.evidence.length > before.evidence.length);
  const currentIds = new Set(current.workItems.map((w: { id: string }) => w.id));
  assert.equal(currentIds.size, current.workItems.length);
  assert.ok(before.workItems.every((w: { id: string }) => currentIds.has(w.id)));
  const second = { ...after, provider: { id: "workflow-second", name: "Second selected workflow" } };
  const other = join(directory, "second.json");
  await writeObservation(other, second);
  cli("workflows", "add", second.provider.id, other);
  await writeFile(output, "invalid JSON");
  cli("run", "--once");
  const broken = cli("snapshot");
  assert.equal(broken.providers.find((p: { id: string }) => p.id === first.provider.id).health, "unreachable");
  assert.equal(broken.providers.find((p: { id: string }) => p.id === second.provider.id).health, "healthy");
  cli("workflows", "remove", first.provider.id);
  assert.equal(cli("workflows", "list").length, 1);
  cli("run", "--once");
  assert.equal(cli("snapshot").providers[0].id, second.provider.id);
});
