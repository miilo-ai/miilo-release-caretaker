import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkpointChecks } from "../src/adapters/evidence-checkpoints.js";

test("checkpoints isolate runs and verification, and do not persist thrown failures", async t => {
  const directory = await mkdtemp(join(tmpdir(), "caretaker-checkpoints-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const checks = checkpointChecks({ inspect: async () => {
    calls++;
    if (calls === 1) throw new Error("Source unavailable");
    return [{ id: "check", outcome: "passed", summary: "Check passed", expected: "one", actual: "one" }];
  } }, directory);
  const context = { runId: "one", stage: "initial" as const };
  await assert.rejects(checks.inspect("release", "healthy", context));
  assert.equal((await readdir(directory)).length, 0);
  await checks.inspect("release", "healthy", context);
  await checks.inspect("release", "healthy", context);
  assert.equal(calls, 2);
  await checks.inspect("release", "healthy", { ...context, stage: "verification" });
  await checks.inspect("release", "healthy", { ...context, runId: "two" });
  assert.equal(calls, 4);
});

test("corrupt evidence cannot silently trigger a fresh result or become passed", async t => {
  const directory = await mkdtemp(join(tmpdir(), "caretaker-corrupt-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const checks = checkpointChecks({ inspect: async () => {
    calls++;
    return [{ id: "check", outcome: "failed", summary: "Mismatch", expected: "one", actual: "two" }];
  } }, directory);
  const context = { runId: "one", stage: "initial" as const };
  await checks.inspect("release", "healthy", context);
  const name = (await readdir(directory))[0]!;
  await writeFile(join(directory, name), "invalid JSON");
  await assert.rejects(checks.inspect("release", "healthy", context));
  assert.equal(calls, 1);
});
