import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile, chmod, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeObservation } from "../src/write.js";

const binary = process.env.MIILO_CLI_BIN;
if (!binary) throw new Error("Set MIILO_CLI_BIN to the locally built Miilo executable");

test("enrollment rejects unsafe files without replacing configuration and removal clears the final source", async t => {
  const directory = await mkdtemp(join(tmpdir(), "miilo-workflow-safety-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = join(directory, "local.json");
  const file = join(directory, "source.json");
  const run = (...args: string[]) => spawnSync(binary!, ["local", ...args], {
    encoding: "utf8", timeout: 15_000, env: { ...process.env, HOME: directory,
      MIILO_HOME: join(directory, "home"), MIILO_LOCAL_CONFIG: config, XDG_STATE_HOME: directory },
  });
  const observation = { schemaVersion: 1 as const, provider: { id: "workflow-test", name: "Test workflow" },
    observedAt: new Date().toISOString(), revision: "test-1", runs: [] };
  await writeObservation(file, observation);
  await chmod(file, 0o644);
  assert.notEqual(run("workflows", "add", "workflow-test", file).status, 0);
  await assert.rejects(readFile(config));
  await chmod(file, 0o600);
  const link = join(directory, "link.json");
  await symlink(file, link);
  assert.notEqual(run("workflows", "add", "workflow-test", link).status, 0);
  assert.notEqual(run("workflows", "add", "workflow-other", file).status, 0);
  assert.equal(run("workflows", "add", "workflow-test", file).status, 0);
  const previous = await readFile(config, "utf8");
  assert.notEqual(run("workflows", "add", "workflow-test", file).status, 0);
  assert.equal(await readFile(config, "utf8"), previous);
  await writeFile(file, " ".repeat(2_000_001));
  assert.notEqual(run("workflows", "add", "workflow-other", file).status, 0);
  assert.equal(await readFile(config, "utf8"), previous);
  assert.equal(run("workflows", "remove", "workflow-test").status, 0);
  assert.equal(run("run", "--once").status, 0);
  const snapshot = run("snapshot");
  assert.equal(snapshot.status, 0);
  assert.deepEqual(JSON.parse(snapshot.stdout).providers, []);
  assert.equal((await readFile(file)).length, 2_000_001);
});
