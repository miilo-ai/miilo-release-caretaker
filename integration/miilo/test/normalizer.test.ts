import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeRun } from "../src/normalize.js";

const at = "2026-10-20T06:00:00Z";
test("unknown framework states are rejected rather than treated as complete", () => {
  assert.throws(() => normalizeRun({ runId: "x", status: "mystery", updatedAt: at, steps: {} }, at));
});
test("running state keeps its last source timestamp instead of manufacturing a heartbeat", () => {
  const observed = normalizeRun({ runId: "x", status: "running", updatedAt: at, steps: {} },
    "2026-10-20T06:05:00Z");
  assert.equal(observed.observedAt, at);
});
test("arbitrary raw outputs and secrets are excluded", () => {
  const observed = normalizeRun({ runId: "x", status: "success", updatedAt: at, steps: {
    release: { status: "success", output: { token: "PRIVATE_SECRET" } },
  }, token: "PRIVATE_SECRET", payload: { prompt: "PRIVATE_PROMPT" } }, at);
  assert.ok(!JSON.stringify(observed).includes("PRIVATE_SECRET"));
  assert.ok(!JSON.stringify(observed).includes("PRIVATE_PROMPT"));
});
