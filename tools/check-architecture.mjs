import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    if (!file.endsWith(".ts")) continue;
    const text = await readFile(file, "utf8");
    if (text.split("\n").length > 200) throw new Error(`Module exceeds 200 lines: ${file}`);
    if (/import\s*\(|import\s+\*/.test(text)) throw new Error(`Non-explicit import: ${file}`);
    if (/^src\/(domain|application)\//.test(file)
      && /(?:adapters\/|@mastra\/|node:|\bfetch\(|\bprocess\.|Date\.now\(|new Date\()/.test(text)) {
      throw new Error(`Outer dependency in core: ${file}`);
    }
  }
}
await scan("src");
console.log("Architecture checks passed");
