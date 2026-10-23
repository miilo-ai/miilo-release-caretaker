import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { CheckSource } from "../application/ports.js";
import { findingsSchema } from "./mastra/schemas.js";

export function checkpointChecks(source: CheckSource, directory: string): CheckSource {
  return { inspect: async (group, scenario, context) => {
    if (!context) throw new Error("Evidence checkpoints require an explicit run and stage");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const parent = await lstat(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0
      || (process.getuid && parent.uid !== process.getuid())) throw new Error("Unsafe evidence directory");
    const key = createHash("sha256").update(JSON.stringify({ version: 1, group, scenario, ...context })).digest("hex");
    const file = join(directory, `${key}.json`);
    const metadata = await lstat(file).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (metadata) {
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 512_000
        || (metadata.mode & 0o077) !== 0 || (process.getuid && metadata.uid !== process.getuid())) {
        throw new Error("Unsafe evidence checkpoint");
      }
      return findingsSchema.parse(JSON.parse(await readFile(file, "utf8")));
    }
    const result = findingsSchema.parse(await source.inspect(group, scenario, context));
    const bytes = JSON.stringify(result);
    if (Buffer.byteLength(bytes) > 512_000) throw new Error("Evidence checkpoint exceeds limit");
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temporary, file);
    } finally { await rm(temporary, { force: true }); }
    return result;
  } };
}
