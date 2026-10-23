import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { WorkflowObservation } from "@miilo-ai/adapter-sdk";

export async function writeObservation(path: string, observation: WorkflowObservation) {
  const bytes = JSON.stringify(observation);
  if (Buffer.byteLength(bytes) > 2_000_000) throw new Error("Workflow snapshot exceeds size limit");
  const existing = await lstat(path).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink() || existing.size > 2_000_000
      || (existing.mode & 0o077) !== 0 || (process.getuid && existing.uid !== process.getuid())) {
      throw new Error("Refusing to replace an unsafe workflow destination");
    }
    const previous = JSON.parse(await readFile(path, "utf8"));
    if (previous.schemaVersion !== 1 || previous.provider?.id !== observation.provider.id) {
      throw new Error("Refusing to overwrite a different destination");
    }
  }
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(bytes); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}
