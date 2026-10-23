import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { caretakerRuntime } from "../../../src/adapters/mastra/runtime.js";
import { SampleChecks, SampleInvestigator } from "../../../src/adapters/sample-checks.js";
import { ScenarioSource } from "../../../src/adapters/scenarios.js";
import { normalizeRun } from "../src/normalize.js";
import { writeObservation } from "../src/write.js";

const cli = process.env.MIILO_CLI_BIN;
const helper = process.env.MIILO_HELPER_BIN;
if (!cli || !helper) throw new Error("Set local MIILO_CLI_BIN and MIILO_HELPER_BIN");

test("workflow-only source reaches the real widget helper with evidence and attention", async t => {
  const directory = await mkdtemp(join(tmpdir(), "caretaker-widget-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runtime = caretakerRuntime(`file:${join(directory, "runs.db")}`,
    new SampleChecks(new ScenarioSource()), new SampleInvestigator());
  t.after(() => runtime.storage.close());
  const run = await runtime.workflow.createRun();
  await run.start({ inputData: { scenario: "stale-package" } });
  const observation = normalizeRun(await runtime.workflow.getWorkflowRunById(run.runId), new Date().toISOString());
  const file = join(directory, "workflow.json");
  await writeObservation(file, observation);
  const config = join(directory, "local.json");
  await writeFile(config, JSON.stringify({ version: 2, mode: "local", sessions: [], groups: [],
    snapshotFile: join(directory, "snapshot.json") }), { mode: 0o600 });
  const env = { ...process.env, HOME: directory, MIILO_HOME: join(directory, "home"),
    MIILO_LOCAL_CONFIG: config, XDG_STATE_HOME: join(directory, "state"),
    MIILO_OWL_CONFIG_DIR: join(directory, "helper") };
  const execute = (binary: string, args: string[]) => {
    const result = spawnSync(binary, args, { env, encoding: "utf8", timeout: 15_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
  execute(cli!, ["local", "workflows", "add", observation.provider.id, file]);
  execute(cli!, ["local", "run", "--once"]);
  const receipt = execute(helper!, ["connect-local", config]);
  assert.equal(receipt.workflows, 1);
  const data = execute(helper!, ["snapshot"]);
  assert.equal(data.status, "ready");
  assert.equal(data.errors.length, 0);
  assert.ok(data.snapshot.evidence.some((e: { summary: string }) => e.summary.includes("Actual: 1.1.0")));
  assert.ok(data.snapshot.attention.length > 0);
  if (process.env.MIILO_RENDER_FIXTURE_DIR) {
    await mkdir(process.env.MIILO_RENDER_FIXTURE_DIR, { recursive: true, mode: 0o700 });
    await writeFile(join(process.env.MIILO_RENDER_FIXTURE_DIR, "feed.json"), JSON.stringify(data), { mode: 0o600 });
  }
});
