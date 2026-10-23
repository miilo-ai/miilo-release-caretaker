# Dependency qualification

The local prototype pins `@mastra/core` 1.78.0 and `@mastra/libsql` 1.26.2,
and commits the npm lockfile.
Installation disables package lifecycle scripts during initial qualification.

An earlier `npm audit` reported six moderate entries, including the storage
adapter's inherited dependency warning, through this dependency chain:
Mastra → gray-matter → js-yaml 3 → argparse → sprintf-js.
The underlying advisory is [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c),
unbounded precision specifiers causing denial of service.

The final pre-publication audit returned zero reported vulnerabilities against the
same lockfile. The affected transitive package remains installed; a changed audit
response alone does not establish that the advisory has been remediated. Retain
the parser review gate before exposing untrusted inputs or hosting publicly.

The prototype supplies fixed local sample facts. It exposes no HTTP listener,
Markdown/frontmatter processing, model endpoint or visitor input. This bounds the
current test surface but does not resolve the dependency finding.

Before public hosting:

- Resolve or explicitly review the affected chain with an upstream-compatible fix.
- Verify any override against actual frontmatter/parser behavior; do not force a
  major YAML change or downgrade Mastra automatically to satisfy audit output.
- Re-run audit, workflow and failure tests on the exact deployment lockfile.
- Confirm the public API accepts scenario identifiers only and applies budgets.

Public deployment remains unqualified while this item is unresolved.
