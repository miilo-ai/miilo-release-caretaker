import { createHash } from "node:crypto";
import { z } from "zod";
import type { Lifecycle, WorkflowObservation, WorkflowStep } from "@miilo-ai/adapter-sdk";
import { findingsSchema, reviewContextSchema, resultSchema } from "../../../src/adapters/mastra/schemas.js";

const states = z.enum(["running", "success", "failed", "tripwire", "suspended", "waiting", "pending",
  "canceled", "bailed", "paused", "skipped"]);
const stepSchema = z.object({ status: states, startedAt: z.number().finite().optional(),
  endedAt: z.number().finite().optional(), output: z.unknown().optional() });
const runSchema = z.object({ runId: z.string().min(1).max(100), status: states,
  updatedAt: z.union([z.string().datetime(), z.date().transform(value => value.toISOString())]),
  steps: z.record(z.string(), stepSchema) });
const lifecycle: Record<z.infer<typeof states>, Lifecycle> = {
  running: "active", success: "complete", failed: "failed", tripwire: "failed",
  suspended: "waiting", waiting: "waiting", pending: "queued", canceled: "cancelled",
  bailed: "cancelled", paused: "waiting", skipped: "cancelled",
};

export function normalizeRun(raw: unknown, now: string): WorkflowObservation {
  const run = runSchema.parse(raw);
  const context = reviewContextSchema.safeParse(run.steps.investigate?.output);
  const verified = resultSchema.safeParse(run.steps["verify-again"]?.output);
  const steps: WorkflowStep[] = [];
  const titles: Record<string, string> = { release: "Release assets", package: "Package version",
    links: "Documentation links", aggregate: "Release summary", investigate: "Investigate findings",
    "human-review": "Review findings", "verify-again": "Verify correction" };
  for (const id of ["release", "package", "links", "aggregate", "investigate", "human-review", "verify-again"]) {
    const step = run.steps[id];
    if (!step) continue;
    const start = new Date(step.startedAt ?? Date.parse(run.updatedAt)).toISOString();
    const end = step.endedAt === undefined ? undefined : new Date(step.endedAt).toISOString();
    const facts = z.object({ findings: findingsSchema }).safeParse(step.output);
    const evidence = facts.success ? facts.data.findings.map(f => ({ id: f.id, outcome: f.outcome,
      summary: `${f.summary}. Expected: ${f.expected}. Actual: ${f.actual}`, recordedAt: end ?? start })) : [];
    if (id === "human-review" && context.success) {
      evidence.push(...context.data.report.findings.filter(f => f.outcome !== "passed").map(f => ({
        id: `review:${f.id}`, outcome: f.outcome,
        summary: `Review evidence: ${f.summary}. Expected: ${f.expected}. Actual: ${f.actual}`,
        recordedAt: start,
      })));
    }
    const attempts: WorkflowStep["attempts"][number][] = [{ sequence: 1,
      lifecycle: lifecycle[step.status], startedAt: start, ...(end ? { completedAt: end } : {}), evidence }];
    if (verified.success && verified.data.verification && ["release", "package", "links"].includes(id)) {
      const verification = verified.data.verification.findings.filter(f => id === "release"
        ? f.id === "release" || f.id.startsWith("asset:") : id === "package"
          ? f.id === "formula" : f.id.startsWith("link:"));
      const at = new Date(run.steps["verify-again"]?.endedAt ?? Date.parse(run.updatedAt)).toISOString();
      attempts.push({ sequence: 2, lifecycle: "complete", startedAt: at, completedAt: at,
        evidence: verification.map(f => ({ id: f.id, outcome: f.outcome,
          summary: `${f.summary}. Expected: ${f.expected}. Actual: ${f.actual}`, recordedAt: at })) });
    }
    steps.push({ id, title: titles[id]!, phase: id === "human-review" ? "reviewing" : "verifying",
      lifecycle: attempts.at(-1)!.lifecycle, attempts,
      ...(id === "human-review" && verified.success && verified.data.verification?.verdict === "passed"
        ? { attention: "none" as const } : {}),
    });
  }
  const current = verified.success ? verified.data.verification ?? verified.data.report
    : context.success ? context.data.report : undefined;
  const work = { id: run.runId, title: "Release Caretaker", summary: current
    ? `Sample release: ${current.verdict}` : "Sample workflow in progress", lifecycle: lifecycle[run.status],
    sourceState: run.status, steps,
    ...(run.status === "suspended" && context.success ? { review: {
      revision: context.data.revision, message: "Review sample release findings before requesting a recheck",
    } } : {}),
  };
  const revision = createHash("sha256").update(JSON.stringify(work)).digest("hex");
  return { schemaVersion: 1, provider: { id: "workflow-caretaker", name: "Release Caretaker (sample)" },
    revision, observedAt: run.status === "running" ? run.updatedAt : z.string().datetime().parse(now), runs: [work] };
}
