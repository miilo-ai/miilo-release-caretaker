import type { CheckGroup, CheckSource, Investigator, ReleaseSource } from "../application/ports.js";
import type { ReleaseReport } from "../domain/release.js";
import type { Investigation } from "../domain/investigation.js";
import { inspectRelease } from "../domain/release.js";

export class SampleChecks implements CheckSource {
  constructor(private readonly source: ReleaseSource) {}
  async inspect(group: CheckGroup, scenario: string) {
    const report = inspectRelease(await this.source.read(scenario));
    return report.findings.filter(f => group === "release" ? f.id === "release" || f.id.startsWith("asset:")
      : group === "package" ? f.id === "formula" : f.id.startsWith("link:"));
  }
}

export class SampleInvestigator implements Investigator {
  async investigate(report: ReleaseReport): Promise<Investigation> {
    const findings = report.findings.filter(f => f.outcome !== "passed");
    return {
      summary: findings.length ? "Sample investigation: distribution checks require review."
        : "Sample investigation: all available checks passed.",
      evidenceIds: findings.map(f => f.id),
      nextStep: findings.length ? "Inspect the cited findings, correct their sources, then request a recheck."
        : "No follow-up required.",
      source: "sample",
    };
  }
}
