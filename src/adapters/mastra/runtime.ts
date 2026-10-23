import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import type { CheckSource, Investigator } from "../../application/ports.js";
import { caretakerWorkflow } from "./caretaker.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkpointChecks } from "../evidence-checkpoints.js";

export function caretakerRuntime(url: string, checks: CheckSource, investigator: Investigator) {
  const storage = new LibSQLStore({ id: "caretaker-storage", url });
  const selected = url.startsWith("file:")
    ? checkpointChecks(checks, join(dirname(fileURLToPath(url)), "evidence-checkpoints")) : checks;
  const mastra = new Mastra({
    storage, workflows: { caretaker: caretakerWorkflow(selected, investigator) },
  });
  return { workflow: mastra.getWorkflow("caretaker"), storage };
}
