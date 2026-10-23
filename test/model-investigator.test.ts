import { test } from "node:test";
import { strict as assert } from "node:assert";
import { chmod, symlink } from "node:fs/promises";
import { modelInvestigator } from "../src/adapters/mastra/model-investigator.js";
import { validateModelConfig, privateText } from "../src/adapters/model/config.js";
import { ScenarioSource } from "../src/adapters/scenarios.js";
import { inspectRelease } from "../src/domain/release.js";
import { modelServer, answer, diagnosis } from "./fixtures/model-server.js";
import type { ModelMeasurement } from "../src/adapters/model/compatible.js";
import { caretakerWorkflow } from "../src/adapters/mastra/caretaker.js";
import { SampleChecks } from "../src/adapters/sample-checks.js";
import { reviewContextSchema } from "../src/adapters/mastra/schemas.js";
import { z } from "zod";

async function report() { return inspectRelease(await new ScenarioSource().read("stale-package")); }

for (const protocol of ["json-tools", "native-tools"] as const) {
  test(`Mastra executes scoped evidence tools through ${protocol}`, async t => {
    const server = await modelServer(t, (_body, response, index) => {
      const tool = { id: "call-1", type: "function", function: { name: "read_evidence", arguments: '{"id":"formula"}' } };
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(index === 1 ? protocol === "json-tools"
        ? answer('{"tool":"read_evidence","arguments":{"id":"formula"}}')
        : answer("", "tool_calls", [tool]) : answer(JSON.stringify(diagnosis))));
    });
    let measurement: ModelMeasurement | undefined;
    const result = await modelInvestigator({ ...server.config, protocol }, m => { measurement = m; })
      .investigate(await report());
    assert.equal(result.source, "model");
    assert.deepEqual(result.evidenceIds, ["formula"]);
    assert.equal(measurement?.requests, 2);
    assert.equal(measurement?.toolCalls, 1);
    assert.equal(measurement?.inputTokens, null);
    assert.match(JSON.stringify(server.requests[1]), /1\.1\.0/);
    assert.doesNotMatch(JSON.stringify(server.requests), /test-credential-not-live/);
  });
}

test("unread citations, truncation and oversized output cannot become model evidence", async t => {
  for (const payload of [answer(JSON.stringify(diagnosis)), answer("{}", "length"),
    answer("x".repeat(70_000))]) {
    const server = await modelServer(t, (_body, response) => response.end(JSON.stringify(payload)));
    await assert.rejects(modelInvestigator(server.config).investigate(await report()), /unavailable/);
  }
});

test("unknown evidence and repeated tools are bounded without changing the report", async t => {
  const server = await modelServer(t, (_body, response) => response.end(JSON.stringify(
    answer('{"tool":"read_evidence","arguments":{"id":"not-in-this-run"}}'))));
  const original = await report();
  const before = JSON.stringify(original);
  await assert.rejects(modelInvestigator(server.config).investigate(original), /unavailable/);
  assert.ok(server.requests.length <= 4);
  assert.equal(JSON.stringify(original), before);
});

test("deadline, HTTP errors and response payloads fail with sanitized messages", async t => {
  const stalled = await modelServer(t, () => {});
  const started = Date.now();
  await assert.rejects(modelInvestigator({ ...stalled.config, deadlineMs: 100 }).investigate(await report()), /unavailable/);
  assert.ok(Date.now() - started < 3000);
  const failed = await modelServer(t, (_body, response) => {
    response.writeHead(401); response.end("test-credential-not-live provider private details");
  });
  await assert.rejects(modelInvestigator(failed.config).investigate(await report()), error =>
    error instanceof Error && !/credential|private details/.test(error.message));
  assert.equal(failed.requests.length, 1);
});

test("configuration requires explicit HTTP consent and private non-symlink credentials", async t => {
  const server = await modelServer(t, (_body, response) => response.end("{}"));
  assert.throws(() => validateModelConfig({ ...server.config, allowInsecureHttp: false }));
  assert.throws(() => validateModelConfig({ ...server.config, baseUrl: "https://user:secret@example.com/v1" }));
  const link = server.config.credentialFile + ".link";
  await symlink(server.config.credentialFile, link);
  await assert.rejects(privateText(link, 4096));
  await chmod(server.config.credentialFile, 0o644);
  await assert.rejects(modelInvestigator(server.config).investigate(await report()), /unavailable/);
  assert.equal(server.requests.length, 0);
});

test("real adapter failure leaves the workflow suspended with unchanged deterministic evidence", async t => {
  const server = await modelServer(t, (_body, response) => { response.writeHead(503); response.end("unavailable"); });
  const run = await caretakerWorkflow(new SampleChecks(new ScenarioSource()), modelInvestigator(server.config)).createRun();
  const result = await run.start({ inputData: { scenario: "stale-package" } });
  assert.equal(result.status, "suspended");
  const detail = z.object({ steps: z.object({ investigate: z.object({ output: reviewContextSchema }) }) })
    .parse(result).steps.investigate.output;
  assert.equal(detail.investigation.source, "unavailable");
  assert.deepEqual(detail.report, await report());
  assert.equal(server.requests.length, 1);
});

test("tool-budget exhaustion cannot be converted into a successful diagnosis", async t => {
  const server = await modelServer(t, (_body, response, index) => {
    const tools = Array.from({ length: 4 }, (_, i) => ({ id: `call-${i}`, type: "function",
      function: { name: "read_evidence", arguments: '{"id":"formula"}' } }));
    response.end(JSON.stringify(index === 1 ? answer("", "tool_calls", tools) : answer(JSON.stringify(diagnosis))));
  });
  let measurement: ModelMeasurement | undefined;
  await assert.rejects(modelInvestigator({ ...server.config, protocol: "native-tools" }, m => { measurement = m; })
    .investigate(await report()), /unavailable/);
  assert.equal(measurement?.toolCalls, 4);
  assert.ok(server.requests.length <= 4);
});

test("one investigator rejects overlapping requests instead of multiplying inference", async t => {
  const server = await modelServer(t, () => {});
  const investigator = modelInvestigator({ ...server.config, deadlineMs: 100 });
  const input = await report();
  const first = investigator.investigate(input);
  await assert.rejects(investigator.investigate(input), /busy/);
  await assert.rejects(first, /unavailable/);
  assert.ok(server.requests.length <= 1);
});
