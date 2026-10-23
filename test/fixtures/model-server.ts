import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type { ModelConfig } from "../../src/adapters/model/config.js";

export async function modelServer(t: TestContext,
  respond: (body: Record<string, unknown>, response: ServerResponse, index: number) => void) {
  const directory = await mkdtemp(join(tmpdir(), "caretaker-model-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const credentialFile = join(directory, "key");
  await writeFile(credentialFile, "test-credential-not-live", { mode: 0o600 });
  const requests: Record<string, unknown>[] = [];
  async function handle(request: IncomingMessage, response: ServerResponse) {
    let body = "";
    for await (const part of request) body += part.toString();
    const data = JSON.parse(body) as Record<string, unknown>;
    requests.push(data);
    respond(data, response, requests.length);
  }
  const server = createServer((request, response) => { void handle(request, response); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  const config: ModelConfig = { baseUrl: `http://127.0.0.1:${address.port}/v1`, model: "test-model",
    credentialFile, protocol: "json-tools", allowInsecureHttp: true, deadlineMs: 5000 };
  return { config, requests };
}

export function answer(content: string, finish = "stop", toolCalls?: unknown[]) {
  return { choices: [{ finish_reason: finish, message: { content,
    ...(toolCalls ? { tool_calls: toolCalls } : {}) } }] };
}
export const diagnosis = { summary: "Package version is stale.", evidenceIds: ["formula"],
  nextStep: "Review the formula version, then request a recheck." };
