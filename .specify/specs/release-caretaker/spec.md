# Release Caretaker

## Purpose

Inspect a release and explain whether its distribution paths are usable. Mastra
coordinates checks; Miilo displays workflow progress, evidence and attention.
Gemma explains findings with evidence references. No component merges code,
publishes releases, approves actions or changes repository security settings.

## Repository boundaries

- This repository owns release facts, checks, Mastra orchestration, explanations,
  sample scenarios, isolated installation probes and deployment composition.
- Miilo SDK owns normalized workflow observation contracts and pure projection.
- Miilo CLI owns explicit source enrollment, configuration, collection and sharing.
- Widgets and desktop plugins consume the existing observation protocol.
- Website changes supply the demo entry point and recordings after validation.

## Milestones and acceptance

### 1. Local deterministic workflow

- [x] Actual Mastra run evaluates healthy, stale-package and broken-release samples.
- [x] Findings retain expected and actual values.
- [x] Unknown evidence cannot produce a passed verdict.
- [x] Source failure is a failed workflow, not a healthy release.
- [x] Samples are labeled and perform no external calls or package installation.
- [x] Record reviewed test evidence for the baseline.

### 2. Shared observation and Miilo integration

- [x] Local SDK typed run/step facts distinguish execution lifecycle from check outcomes.
- [x] Framework-specific conversion remains outside SDK domain contracts.
- [x] Caretaker emits SDK workflow observations with stable run/step/attempt/evidence
  identities; the local Rust SDK projects these into protocol snapshots.
- [x] CLI explicitly enrolls the source, preserving existing configuration selections.
- [ ] Running, completed, failed, canceled, suspended and stale states render truthfully.
- [x] Failed checks attach evidence and attention to the correct task/attempt.
- [ ] Stream disconnect, duplicate events and restart recover by fresh snapshot.
- [x] Desktop and mobile fixture consumers show the same sample workflow and evidence.

Local bridge qualification and setup are documented in `integration/miilo/README.md`.
The optional integration uses an ignored local SDK tarball and an external Cargo
override. These artifacts are not published release dependencies.

### 2a. Substantive Mastra workflow behavior

- [x] Three actual parallel branches join before investigation.
- [x] Failed source calls retry their branch at most twice; passed branches are not
  rerun by a sibling's retry. Failed checks are data, not exceptions to retry.
- [x] SQLite persists a human-review checkpoint; another process resumes it without
  replaying completed checks. Original and verification evidence remain separate.
- [x] Review is bound to the exact report revision. Stale decisions suspend again.
- [x] Acknowledgement preserves the failed verdict; recheck explicitly reads sources
  again. Neither action changes a repository, formula or deployment.
- [x] Investigation is an injected port with bounded text and evidence references.
  Invalid citations or investigation errors retain deterministic findings.
- [ ] Retry only classified transient errors with bounded backoff and cancellation;
  enforce time/output limits inside concrete external adapters.
- [x] Recover a sample run killed during an active parallel read, reusing committed
  read results and repeating the unfinished read. Pre-commit reads may repeat.
- [ ] Qualify checkpoint retention, concurrent-worker policy and version migration.
  Prove no duplicate external effects before enabling any write operation.
- [ ] Targeted rechecks preserve evidence age/provenance for reused successful checks.
- [x] Model-backed Mastra Agent investigates using scoped read-only evidence tools,
  with maximum tool steps, request/token budget and deadline.
- [ ] Capture workflow/step/tool/model traces, avoiding raw credentials and transcripts.
- [ ] Evaluate explanations, evidence citations and diagnoses on versioned cases;
  compare deterministic-only and agent-assisted results, cost and latency.

### 3. Real release inspection

- [ ] Read-only GitHub adapter checks exact tag, draft/prerelease, workflow commit
  and required assets; an unrelated successful PR check is not release success.
- [ ] Formula adapter compares exact released version without evaluating Ruby.
- [ ] Link adapter checks an explicit allowlist with DNS/IP/redirect restrictions,
  request timeouts and response limits; local/private addresses are rejected.
- [ ] Disposable installation adapter verifies exit code and installed version.
  Missing runner yields unknown, not passed; no host installation is performed.
- [ ] Known-good and intentionally broken samples agree with live adapter results.

### 4. Evidence-grounded explanation

- [x] Configurable OpenAI-compatible model endpoint and model ID, secret reference
  only; local/private and hosted Gemma are supported deployment choices.
- [x] Prompt contains bounded sanitized check facts, never credentials/raw logs.
- [x] Explanation references evidence read by scoped tools; invented references rejected.
- [x] Model failure leaves deterministic results available.
- [ ] Record latency, token usage and estimated cost with pricing provenance.

### 5. Optional hosted demo (deferred)

- [ ] Bounded scenario selection, per-client/global limits and capped concurrency.
- [ ] Durable run state and restart test; no inferred successful state after crash.
- [ ] Inference credentials are server-only; API responses redact provider errors.
- [ ] Deployment template, health/readiness probes, resource measurement, rollback
  and teardown instructions; no resources provisioned until reviewed.
- [ ] Explicit inference/request budgets and kill switch tested under exhaustion.
- [ ] Accessible demo UI on miilo.tech with sample labeling and recordings.
- [ ] License/dependency notices, CI, secret scan and public-content review pass.

## Recorded demonstration scope

The recorded demonstration covers labeled sample checks, actual Mastra execution,
scoped live model tools, durable review, failure recovery and the local Miilo bridge.
It does not claim real release inspection, a hosted service or published SDK/CLI
integration. The reproducible journey is documented in `docs/recorded-demo.md`.

Production release qualification additionally requires real read-only adapters,
dependency qualification, transport recovery and measured evaluation evidence.
Hosting and installation probes remain separate, deferred milestones.

## Measurements

Track detected versus expected findings across scenarios, false success count,
wall-clock duration per check, model latency/tokens/cost, reconnect recovery time
and peak runtime memory. Establish baseline before claiming time or cost savings.

## Deferred scope

General Mastra execution/control in Miilo (distinct from this caretaker's local
read-only review decisions), arbitrary repository submissions,
automated fixes/PR publication, autonomous approvals and organization management.
