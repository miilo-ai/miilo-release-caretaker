import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { reviewContextSchema, resultSchema } from "./adapters/mastra/schemas.js";

const binary = process.env.MIILO_CLI_BIN;
const state = process.env.CARETAKER_STATE_DIR;
if (!binary || !state || !process.env.CARETAKER_MODEL_CONFIG) throw new Error("Configure isolated demo paths first");
process.umask(0o077);
const directory = resolve(state);
await mkdir(directory, { recursive: true, mode: 0o700 });
const snapshot = join(directory, "workflow.json");
const config = join(directory, "local.json");
await writeFile(config, JSON.stringify({ version: 2, mode: "local", sessions: [], groups: [],
  snapshotFile: join(directory, "snapshot.json") }), { mode: 0o600, flag: "wx" });
const env = { ...process.env, HOME: directory, MIILO_HOME: join(directory, ".miilo"),
  MIILO_LOCAL_CONFIG: config, XDG_STATE_HOME: join(directory, "state"), XDG_CONFIG_HOME: join(directory, "config") };
const cyan = "\x1b[96m", green = "\x1b[92m", amber = "\x1b[93m", reset = "\x1b[0m";
const pause = () => setTimeout(process.env.CARETAKER_DEMO_FAST === "1" ? 0 : 5000);
function screen(title: string) {
  process.stdout.write("\x1b[2J\x1b[H");
  console.log(`${cyan}MIILO  /  RELEASE CARETAKER${reset}\n`);
  console.log(`${title}\n`);
  console.log("Sample release checks · actual Mastra workflow · live Gemma\n");
}
async function execute(label: string, command: string, args: string[]) {
  console.log(`${cyan}❯ ${label}${reset}\n`);
  return await new Promise<unknown>((resolveResult, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let size = 0;
    const deadline = globalThis.setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.stdout.on("data", data => {
      size += data.length;
      if (size > 2_000_000) child.kill("SIGTERM");
      else output += data;
    });
    child.stderr.resume();
    child.on("error", reject);
    child.on("close", code => {
      globalThis.clearTimeout(deadline);
      if (code !== 0 || size > 2_000_000) return reject(new Error("Demo command failed; inspect isolated rehearsal logs"));
      try { resolveResult(output.trim() ? JSON.parse(output) as unknown : null); } catch { reject(new Error("Invalid command output")); }
    });
  });
}
const node = (label: string, file: string, args: string[] = []) => execute(label, process.execPath, ["--import", "tsx", file, ...args]);
const cli = (label: string, args: string[]) => execute(label, binary, ["local", ...args]);
const feedSchema = z.object({ providers: z.array(z.object({ name: z.string(), health: z.string() })),
  workItems: z.array(z.unknown()), attention: z.array(z.unknown()), evidence: z.array(z.object({ outcome: z.string() })) });

screen("01  /  A release can finish while its checks still need you");
console.log("Start a sample release with a stale package version.");
console.log("Gemma must read evidence before it can cite it.\n");
await pause();
const initial = z.object({ runId: z.string(), status: z.literal("suspended"),
  investigation: reviewContextSchema.shape.investigation,
  report: reviewContextSchema.shape.report,
  measurement: z.object({ requests: z.number(), toolCalls: z.number(), latencyMs: z.number() }) })
  .parse(await node("npm run model:smoke", "src/model-smoke.ts"));
if (initial.investigation.source !== "model") throw new Error("A live model is required for this showcase");
for (const finding of initial.report.findings.filter(f => f.outcome !== "passed")) {
  console.log(`${amber}${finding.summary}: expected ${finding.expected} · actual ${finding.actual}${reset}`);
}
console.log(`\nGemma: ${initial.investigation.summary}`);
console.log(`Evidence read: ${initial.investigation.evidenceIds.join(", ")}`);
console.log(`Next step: ${initial.investigation.nextStep}`);
console.log(`\n${initial.measurement.requests} model requests · ${initial.measurement.toolCalls} evidence tool call · ${(initial.measurement.latencyMs / 1000).toFixed(1)}s`);
console.log(`\n${amber}WAITING FOR HUMAN REVIEW${reset}`);
await pause(); await pause();

screen("02  /  Leave it, then return without losing the findings");
const saved = z.object({ status: z.literal("suspended") }).parse(await node(
  "npm run journey -- status RUN_ID", "src/journey.ts", ["status", initial.runId]));
console.log(`A separate process reopened the saved run: ${saved.status}`);
await node("npm run miilo:export -- RUN_ID workflow.json", "integration/miilo/src/export.ts", [initial.runId, snapshot]);
await cli("miilo local workflows add workflow-caretaker workflow.json", ["workflows", "add", "workflow-caretaker", snapshot]);
await cli("miilo local run --once", ["run", "--once"]);
const before = feedSchema.parse(await cli("miilo local snapshot", ["snapshot"]));
console.log(`${green}Connected to Miilo: ${before.providers[0]?.name}${reset}`);
console.log(`Health: ${before.providers[0]?.health} · Work items: ${before.workItems.length}`);
console.log(`Attention records: ${before.attention.length} · Evidence: ${before.evidence.length}`);
await pause(); await pause();

screen("03  /  Review is tied to the evidence you actually saw");
const status = await node("npm run journey -- status RUN_ID", "src/journey.ts", ["status", initial.runId]);
console.log(JSON.stringify(status, null, 2));
const exported = JSON.parse(await readFile(snapshot, "utf8"));
const review = z.object({ runs: z.array(z.object({ review: z.object({ revision: z.string() }) })) }).parse(exported).runs[0]!.review;
console.log("\nThe next command switches the sample source to corrected facts.");
console.log("It does not edit a real Homebrew formula or publish a release.\n");
await pause();
const completed = z.object({ status: z.literal("success"), detail: resultSchema }).parse(await node(
  "npm run journey -- resume RUN_ID REVISION recheck --sample-repaired", "src/journey.ts",
  ["resume", initial.runId, review.revision, "recheck", "--sample-repaired"]));
console.log(`Original report: ${amber}${completed.detail.report.verdict}${reset}`);
console.log(`Fresh verification: ${green}${completed.detail.verification?.verdict}${reset}`);
await node("npm run miilo:export -- RUN_ID workflow.json", "integration/miilo/src/export.ts", [initial.runId, snapshot]);
await cli("miilo local run --once", ["run", "--once"]);
const after = feedSchema.parse(await cli("miilo local snapshot", ["snapshot"]));
if (after.attention.length !== 0 || !after.evidence.some(e => e.outcome === "failed")) throw new Error("Evidence reconciliation failed");
console.log(`\n${green}Current attention: ${after.attention.length}${reset}`);
console.log(`Historical failed evidence retained: ${after.evidence.filter(e => e.outcome === "failed").length}`);
console.log("\nWork can wait. Evidence should not disappear.");
console.log(`${cyan}miilo.tech${reset}`);
await pause(); await pause();
