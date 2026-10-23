# Local Miilo SDK and CLI integration

This optional integration uses the unreleased local SDK contracts and native CLI.
It is not part of the base caretaker installation or its public release yet.

## Prepare the SDK artifact

In the local SDK `typescript` directory, install dependencies and build:

```sh
npm ci --ignore-scripts
npm run build
npm pack --ignore-scripts --pack-destination /tmp
```

In this caretaker repository, copy that exact tarball to
`.local/adapter-sdk.tgz`, then install only the optional integration package:

```sh
mkdir -p .local
cp /tmp/miilo-ai-adapter-sdk-0.2.0.tgz .local/adapter-sdk.tgz
npm install --prefix integration/miilo --ignore-scripts --package-lock=false
npm run check:miilo
```

The tarball contains local unreleased changes despite retaining the current SDK
version. Do not publish it. `.local` and node_modules are excluded from Git.
Build the matching native CLI using a temporary local SDK Cargo patch as described
in its `docs/workflow-observation.md`. No global Miilo installation is replaced.

## Test and export

```sh
MIILO_CLI_BIN=/absolute/path/to/local/miilo npm run test:miilo
npm run journey -- start stale-package
npm run miilo:export -- RUN_ID /absolute/path/to/workflow.json --watch
```

In a separate terminal, use the locally built CLI to enroll the file with
`miilo local workflows add workflow-caretaker FILE`, then run the collector.
Use isolated `MIILO_LOCAL_CONFIG` and `XDG_STATE_HOME` locations for rehearsals.
The integration test does this automatically in a disposable directory.

The exporter reads saved Mastra state. It never starts/resumes a workflow or
calls a model. It emits only selected workflow states and check evidence, using
owner-only atomic file replacement. Refreshes happen every five seconds.
If it fails or stops, the last snapshot becomes stale. Active runs retain the
last persisted source timestamp, so export polling cannot fake worker liveness.

## Qualification boundaries

The local test executes a real Mastra sample workflow and consumes it through
the native CLI linked to the local Rust SDK. It covers suspended review, repaired
verification, stable identities, source isolation and removal. The normalizer
also excludes arbitrary raw outputs and rejects unsupported execution states.
Review evidence remains attached after verification without retaining a resolved
attention alert. An exporter termination test checks atomic snapshot replacement
under concurrent reads and subsequent restart.

With a locally built widget helper, run the isolated consumer test:

```sh
MIILO_CLI_BIN=/absolute/path/to/local/miilo \
MIILO_HELPER_BIN=/absolute/path/to/local/miilo-owl npm run test:helper
```

Native Qt and Android fixture renders show the same task and review evidence.
These sample renders do not establish live cross-device transport or installed
desktop plugin acceptance. See the validation record for the tested boundaries.

Mastra exports here include persisted logical step results and explicit follow-up
verification attempts. Per-request transient retry history, detailed model/tool
traces and multiple-run selection remain unqualified. The SDK can represent multiple
attempts; that does not imply the adapter has recovered every internal retry.

The optional package's local tarball dependency is temporary. Release the SDK and
switch to its verified version before adding this integration to published CI.
