import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile, readFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeObservation } from "../src/write.js";

test("snapshot export refuses unrelated files and symlinks", async t => {
  const directory = await mkdtemp(join(tmpdir(), "miilo-export-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, "unrelated.json");
  const link = join(directory, "link.json");
  await writeFile(target, JSON.stringify({ setting: "preserve" }), { mode: 0o600 });
  const data = { schemaVersion: 1 as const, provider: { id: "workflow-test", name: "Test" },
    revision: "one", observedAt: new Date().toISOString(), runs: [] };
  await assert.rejects(writeObservation(target, data));
  await symlink(target, link);
  await assert.rejects(writeObservation(link, data));
  assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { setting: "preserve" });
});
