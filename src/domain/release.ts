export interface ReleaseFacts {
  version: string;
  tagVersion: string | null;
  draft: boolean;
  prerelease: boolean;
  requiredAssets: string[];
  publishedAssets: string[];
  formulaVersion: string | null;
  links: { label: string; status: number | null }[];
}

export interface Finding {
  id: string;
  outcome: "passed" | "failed" | "unknown";
  summary: string;
  expected: string;
  actual: string;
}

export interface ReleaseReport {
  verdict: "passed" | "needs_attention" | "inconclusive";
  findings: Finding[];
}

export function inspectRelease(facts: ReleaseFacts): ReleaseReport {
  const findings: Finding[] = [];
  findings.push({
    id: "release", outcome: facts.tagVersion === null ? "unknown"
      : facts.tagVersion === facts.version && !facts.draft && !facts.prerelease ? "passed" : "failed",
    summary: "Stable release is published", expected: facts.version,
    actual: facts.tagVersion === null ? "Release lookup unavailable"
      : `${facts.tagVersion}; draft=${facts.draft}; prerelease=${facts.prerelease}`,
  });
  for (const asset of facts.requiredAssets) {
    const found = facts.publishedAssets.includes(asset);
    findings.push({ id: `asset:${asset}`, outcome: found ? "passed" : "failed",
      summary: "Required asset is published", expected: asset, actual: found ? asset : "Missing" });
  }
  findings.push({ id: "formula", outcome: facts.formulaVersion === null ? "unknown"
    : facts.formulaVersion === facts.version ? "passed" : "failed",
    summary: "Package formula matches release", expected: facts.version,
    actual: facts.formulaVersion ?? "Formula lookup unavailable" });
  for (const link of facts.links) {
    findings.push({ id: `link:${link.label}`, outcome: link.status === null ? "unknown"
      : link.status >= 200 && link.status < 300 ? "passed" : "failed",
      summary: `${link.label} responds successfully`, expected: "HTTP 2xx",
      actual: link.status === null ? "Request unavailable" : `HTTP ${link.status}` });
  }
  return summarizeFindings(findings);
}

export function summarizeFindings(findings: Finding[]): ReleaseReport {
  if (findings.length === 0 || new Set(findings.map(f => f.id)).size !== findings.length) {
    throw new Error("Checks must provide nonempty evidence with unique identities");
  }
  return { findings, verdict: findings.some(f => f.outcome === "failed") ? "needs_attention"
    : findings.some(f => f.outcome === "unknown") ? "inconclusive" : "passed" };
}
