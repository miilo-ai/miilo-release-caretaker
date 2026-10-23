import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { writeObservation } from "../src/write.js";

test("killing an exporter preserves a complete snapshot during concurrent reads", { timeout: 15_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "miilo-export-recovery-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = join(directory, "workflow.json");
  const initial = { schemaVersion: 1 as const, provider: { id: "workflow-test", name: "Export test" },
    revision: "0", observedAt: new Date().toISOString(), runs: [] };
  await writeObservation(destination, initial);
  const child = spawn(process.execPath,
    ["--import", "tsx", "integration/miilo/fixtures/export-loop.ts", destination],
    { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); });
  let committed = 0;
  let errors = "";
  child.stdout.on("data", chunk => { committed += (String(chunk).match(/\n/g) ?? []).length; });
  child.stderr.on("data", chunk => { errors += String(chunk); });
  let reads = 0;
  const deadline = Date.now() + 8_000;
  while (committed < 30 && Date.now() < deadline && child.exitCode === null) {
    const snapshot = JSON.parse(await readFile(destination, "utf8"));
    assert.equal(snapshot.provider.id, initial.provider.id);
    assert.match(snapshot.revision, /^\d+$/);
    assert.deepEqual(snapshot.runs, []);
    reads++;
    await setTimeout(1);
  }
  assert.ok(committed >= 30, `Exporter did not reach the write barrier: ${errors}`);
  assert.ok(reads > 1);
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  const recovered = JSON.parse(await readFile(destination, "utf8"));
  assert.ok(Number(recovered.revision) >= 30);
  assert.equal(recovered.provider.id, initial.provider.id);
  assert.equal((await stat(destination)).mode & 0o077, 0);
  await writeObservation(destination, { ...initial, revision: "recovered" });
  assert.equal(JSON.parse(await readFile(destination, "utf8")).revision, "recovered");
});
