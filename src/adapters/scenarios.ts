import type { ReleaseSource } from "../application/ports.js";
import type { ReleaseFacts } from "../domain/release.js";

export const scenarioNames = ["healthy", "stale-package", "broken-release"] as const;

export class ScenarioSource implements ReleaseSource {
  async read(scenario: string): Promise<ReleaseFacts> {
    if (!scenarioNames.some(name => name === scenario)) throw new Error("Unknown demo scenario");
    return {
      version: "1.2.0", tagVersion: "1.2.0", draft: false, prerelease: false,
      requiredAssets: ["example-cli-linux.tar.gz", "example-cli-macos.tar.gz"],
      publishedAssets: scenario === "broken-release" ? ["example-cli-linux.tar.gz"]
        : ["example-cli-linux.tar.gz", "example-cli-macos.tar.gz"],
      formulaVersion: scenario === "stale-package" ? "1.1.0" : "1.2.0",
      links: [{ label: "Documentation", status: scenario === "broken-release" ? 404 : 200 }],
    };
  }
}
