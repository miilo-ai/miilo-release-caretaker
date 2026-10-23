# Local baseline validation

## Scope

Sample release scenarios executed using the actual Mastra workflow engine.
Deterministic tests use disposable model servers; a separate explicit smoke test
uses actual local model inference. No GitHub API, package installation or deployment
has been qualified. Native rendering uses sanitized sample snapshots.

## Commands

- `npm run check`: strict TypeScript and source boundary checks.
- `npm test`: domain, Mastra workflow and executable behavior.
- `npm run demo -- stale-package`: report retains expected 1.2.0 versus actual
  1.1.0 with needs_attention and exit code 1.

## Environment

macOS arm64, Node.js 23.10.0, Mastra core 1.78.0. The local Node installation
satisfies the minimum engine requirement. Node 22 Linux CI is configured but has
not been executed remotely.

## Expanded workflow checks

All 28 local tests pass, plus strict TypeScript and architecture checks.

- Three parallel branches reach a test barrier before any returns.
- Only the transiently failing branch retries, bounded at three total attempts.
- Permanent dependency failure terminates the workflow.
- Stale review revision remains suspended; acknowledgement leaves findings failed.
- Explicit recheck observes repaired sample facts and retains the original report.
- Fabricated evidence references disable investigation without hiding check failures.
- Separate OS processes start, inspect and resume the same SQLite-backed run.
  Completed check outputs remain intact across that restart.
- Completed runs reject repeated resume commands; the stored terminal status remains.
- Newly created SQLite files are owner-only on the tested macOS environment.

An additional process test kills a worker during an active parallel check. A new
process restarts the same Mastra run and reuses two committed read results while
repeating the unfinished read. Private, validated result checkpoints are scoped
by run, scenario, check group and initial/verification stage. Corrupt checkpoints
fail closed. Reads interrupted before commit may repeat; this establishes no
exactly-once guarantee for external writes or power-loss durability.

## Local SDK/CLI integration

The optional `integration/miilo` package compiles against an ignored tarball of
the local TypeScript SDK. The native CLI uses a temporary external Cargo override
to the matching Rust SDK. No global executable or real user configuration is changed.

Tests execute a real Mastra sample run through file export, CLI enrollment,
collector snapshot, revision-bound review and repaired verification. Historical
evidence remains, current attention clears, and a second source stays healthy
when the first becomes invalid. Safety tests reject public files, symlinks,
identity changes, oversized input and duplicate enrollment without replacing
configuration. Final-source removal yields an empty snapshot without deleting data.

The optional integration suite contains seven tests, including concurrent snapshot
reads while an exporter is killed. The last committed file remains valid and a
replacement exporter can continue. The stress test does not control the exact
instruction where termination occurs or simulate power failure.

## Native consumer validation

A separate helper integration test enrolls a workflow-only source, preserves
existing connections and projects the native CLI snapshot into widget data.
Completed checks with unresolved findings remain visible. Review tasks carry the
evidence they reference. Successful verification clears current attention while
retaining the original failed evidence.

The actual Qt renderer passes a three-result fixture test covering load, task
selection and expected/actual evidence. A separate native plain-text test requests
its positive-control image while untrusted labels trigger zero image requests.
The Android emulator renders the same sanitized helper output and task/review
evidence through its installed launcher. Original widget source and preferences
are restored and compared byte-for-byte. Android uses a replayed snapshot, not a
qualified live cross-device connection. No installed desktop plugin is replaced.

## Remaining qualification

See `dependencies.md` for the unresolved transitive audit finding and deployment
gate. Published SDK/CLI qualification, real release checks, live transport recovery
and tracing/evaluations remain separate milestones. Checkpoint
retention, concurrent-worker policy and workflow-version migration also need
qualification before deployment. Sample investigation remains available; configured
model investigation is explicit opt-in. The expanded workflow uses @mastra/libsql 1.26.2.

## Configurable model investigation

The Mastra Agent supports native OpenAI-compatible tool calls and an explicit JSON
tool protocol for text-only endpoints. Tests cover actual tool execution in both
modes, unread citations, unknown evidence, response bounds, truncation, HTTP errors,
deadline cancellation and credential-file policy. A failing real adapter leaves
the sample workflow suspended with the unchanged deterministic report.

An explicit local Gemma 3 12B run read the formula evidence, diagnosed expected
1.2.0 versus actual 1.1.0 and returned a cited manual next step. The measured run
made two model requests and one evidence-tool call in 11,192 ms. These are sample
checks with actual model inference, not a real release inspection. The endpoint
does not supply token usage; token counts and monetary cost remain unknown.
This single case does not establish diagnosis accuracy across scenarios or providers.
No service configuration, weights, installed client or live user preferences changed.
