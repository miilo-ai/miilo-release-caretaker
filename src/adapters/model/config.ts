import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";

export const modelConfigSchema = z.object({
  baseUrl: z.string().url().max(2048), model: z.string().min(1).max(200),
  credentialFile: z.string().refine(isAbsolute),
  protocol: z.enum(["native-tools", "json-tools"]),
  allowInsecureHttp: z.boolean().default(false),
  deadlineMs: z.number().int().min(100).max(120_000).default(90_000),
}).strict();
export type ModelConfig = z.infer<typeof modelConfigSchema>;

export async function privateText(path: string, limit: number): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > limit || (metadata.mode & 0o077) !== 0
      || (process.getuid && metadata.uid !== process.getuid())) throw new Error("Unsafe model configuration");
    const bytes = Buffer.alloc(limit + 1);
    const result = await file.read(bytes, 0, limit + 1, 0);
    if (result.bytesRead > limit) throw new Error("Model configuration exceeds limit");
    return bytes.subarray(0, result.bytesRead).toString("utf8");
  } finally { await file.close(); }
}

export function validateModelConfig(value: unknown): ModelConfig {
  const config = modelConfigSchema.parse(value);
  const url = new URL(config.baseUrl);
  if (url.username || url.password || url.search || url.hash
    || (url.protocol !== "https:" && !(url.protocol === "http:" && config.allowInsecureHttp))) {
    throw new Error("Model endpoint requires HTTPS or explicit private HTTP consent");
  }
  return config;
}

export async function readModelConfig(path: string): Promise<ModelConfig> {
  return validateModelConfig(JSON.parse(await privateText(path, 8192)));
}
