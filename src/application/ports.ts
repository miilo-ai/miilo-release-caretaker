import type { Finding, ReleaseFacts, ReleaseReport } from "../domain/release.js";
import type { Investigation } from "../domain/investigation.js";

export interface ReleaseSource {
  read(scenario: string): Promise<ReleaseFacts>;
}

export type CheckGroup = "release" | "package" | "links";
export interface CheckContext { runId: string; stage: "initial" | "verification" }
export interface CheckSource {
  inspect(group: CheckGroup, scenario: string, context?: CheckContext): Promise<Finding[]>;
}
export interface Investigator {
  investigate(report: ReleaseReport): Promise<Investigation>;
}
