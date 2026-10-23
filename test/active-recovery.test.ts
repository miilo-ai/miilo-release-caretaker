import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { caretakerRuntime } from "../src/adapters/mastra/runtime.js";
import { SampleChecks, SampleInvestigator } from "../src/adapters/sample-checks.js";
import { ScenarioSource } from "../src/adapters/scenarios.js";
import { z } from "zod";

test("SIGKILL during a parallel check restarts only unfinished work", { timeout: 30_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "caretaker-active-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const child = spawn(process.execPath, ["--import", "tsx", "test/fixtures/active-run.ts", "start", directory],
    { stdio: "ignore" });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); });
  const runtime = caretakerRuntime(`file:${join(directory, "runs.db")}`,
    new SampleChecks(new ScenarioSource()), new SampleInvestigator());
  t.after(() => runtime.storage.close());
  const shape = z.object({ status: z.string(), steps: z.record(z.string(), z.object({ status: z.string() })) });
  const deadline = Date.now() + 10_000;
  let checkpoint = false;
  while (Date.now() < deadline) {
    const parsed = shape.safeParse(await runtime.workflow.getWorkflowRunById("active-recovery"));
    const saved = await readdir(join(directory, "evidence-checkpoints")).catch(() => []);
    if (parsed.success && parsed.data.steps.package?.status === "running"
      && saved.filter(name => name.endsWith(".json")).length === 2) {
      checkpoint = true; break;
    }
    await setTimeout(50);
  }
  assert.ok(checkpoint, "Expected two committed read results and one active check");
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  assert.equal(shape.parse(await runtime.workflow.getWorkflowRunById("active-recovery")).status, "running");
  const restarted = spawnSync(process.execPath,
    ["--import", "tsx", "test/fixtures/active-run.ts", "restart", directory], { encoding: "utf8", timeout: 15_000 });
  assert.equal(restarted.error, undefined);
  assert.equal(restarted.status, 0, restarted.stderr);
  assert.equal(JSON.parse(restarted.stdout).status, "success");
  const calls = (await readFile(join(directory, "calls.jsonl"), "utf8")).trim().split("\n")
    .map(line => JSON.parse(line) as { group: string; event: string });
  for (const group of ["release", "links"]) {
    assert.equal(calls.filter(c => c.group === group && c.event === "started").length, 1);
  }
  assert.equal(calls.filter(c => c.group === "package" && c.event === "started").length, 2);
  for (const group of ["release", "links", "package"]) {
    assert.equal(calls.filter(c => c.group === group && c.event === "completed").length, 1);
  }
});
