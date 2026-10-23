import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("a fresh process resumes SQLite snapshot without replaying completed checks", { timeout: 30_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "caretaker-restart-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const command = (...args: string[]) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/journey.ts", ...args], {
      env: { ...process.env, CARETAKER_STATE_DIR: directory }, encoding: "utf8", timeout: 15_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const initial = command("start", "stale-package");
  assert.equal(initial.status, "suspended");
  assert.equal(initial.detail.report.verdict, "needs_attention");
  assert.equal(command("status", initial.runId).status, "suspended");
  const resumed = command("resume", initial.runId, initial.detail.revision, "recheck", "--sample-repaired");
  assert.equal(resumed.status, "success");
  assert.equal(resumed.detail.report.verdict, "needs_attention");
  assert.equal(resumed.detail.verification.verdict, "passed");
  assert.equal(command("status", initial.runId).status, "success");
  if (process.platform !== "win32") assert.equal((await stat(join(directory, "runs.db"))).mode & 0o077, 0);
  const duplicate = spawnSync(process.execPath, ["--import", "tsx", "src/journey.ts", "resume",
    initial.runId, initial.detail.revision, "recheck"], {
    env: { ...process.env, CARETAKER_STATE_DIR: directory }, encoding: "utf8", timeout: 15_000,
  });
  assert.equal(duplicate.status, 2);
  assert.equal(command("status", initial.runId).status, "success");
});
