import { z } from "zod";

export const findingSchema = z.object({
  id: z.string().min(1).max(200), outcome: z.enum(["passed", "failed", "unknown"]),
  summary: z.string().max(2000), expected: z.string().max(2000), actual: z.string().max(2000),
});
export const findingsSchema = z.array(findingSchema).min(1).max(64);
export const reportSchema = z.object({
  verdict: z.enum(["passed", "needs_attention", "inconclusive"]), findings: findingsSchema,
});
export const investigationSchema = z.object({
  summary: z.string().max(2000), evidenceIds: z.array(z.string().max(200)).max(32),
  nextStep: z.string().max(1000), source: z.enum(["sample", "model", "unavailable"]),
});
export const reviewContextSchema = z.object({
  scenario: z.string().max(64), revision: z.string().length(64), report: reportSchema,
  investigation: investigationSchema,
});
export const decisionSchema = z.object({
  expectedRevision: z.string().length(64), decision: z.enum(["recheck", "acknowledge"]),
}).strict();
export const reviewedSchema = reviewContextSchema.extend({
  decision: z.enum(["recheck", "acknowledge", "not_required"]),
});
export const resultSchema = reviewedSchema.extend({
  verification: reportSchema.nullable(),
});
