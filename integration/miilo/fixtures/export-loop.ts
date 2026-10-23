import { writeObservation } from "../src/write.js";

const destination = process.argv[2];
if (!destination) throw new Error("Snapshot destination is required");
for (let revision = 1; ; revision++) {
  await writeObservation(destination, {
    schemaVersion: 1, provider: { id: "workflow-test", name: "Export test" },
    revision: String(revision), observedAt: new Date().toISOString(), runs: [],
  });
  process.stdout.write(`${revision}\n`);
}
