# Implementation sequence

1. Qualify local parallel Mastra checks, per-branch retries and persisted human
   review with fixture, failure and cross-process resume tests.
2. Implement generic SDK observation input and pure projection; add Mastra-specific
   snapshot conversion in this repository. Do not ship duplicated protocol types.
3. Implement explicit CLI enrollment and bounded observation collection using the
   SDK contract. Verify snapshot invalidation/reconnect and existing-source regressions.
4. Verify the same local run in Miilo desktop and mobile before adding inference.
5. Add read-only GitHub/formula/link adapters and disposable installation probes;
   implement classified transient retry, cancellation, bounds and selective rechecks.
6. Add a Gemma-backed Mastra Agent with scoped evidence tools, suspension proposals,
   trace correlation and model failure/budget tests. Evaluate diagnoses and citations
   against deterministic-only checks on versioned scenarios.
7. Measure resources, then prepare DigitalOcean hosting and a bounded public UI.
8. Capture the broken-to-healthy journey, document measured results and prepare PRs.

## Review gates

SDK contracts precede CLI dependency updates. Runtime feature version changes and
release tags are coordinated only after integration tests pass. Specifications alone
do not imply released support. Deployment and public-demo readiness are separate gates.
Saved-checkpoint recovery and active-process crash recovery are distinct gates.
Neither test establishes exactly-once external writes; the current workflow is read-only.
