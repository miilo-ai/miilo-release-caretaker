import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

function run(scenario: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/main.ts", scenario], {
    encoding: "utf8", timeout: 15_000,
  });
}

test("CLI healthy scenario reports sample provenance and exits zero", () => {
  const result = run("healthy");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.source, "sample scenario");
  assert.equal(output.report.verdict, "passed");
});

test("CLI failed checks return a report with nonzero status", () => {
  const result = run("stale-package");
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).report.verdict, "needs_attention");
});

test("CLI rejects arbitrary repository or command input", () => {
  const result = run("https://example.com/repository");
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Choose a scenario/);
});
