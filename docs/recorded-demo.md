# Reproduce the terminal showcase

The showcase executes the actual workflow and native CLI, then formats their JSON
results for recording. It uses sample release facts and actual configured model
inference. Command labels use `RUN_ID` and `REVISION` for readability; execution
uses the real returned values. It does not modify a real release or formula.

Prepare the local SDK/CLI bridge using `integration/miilo/README.md` and a private
model configuration using `docs/model-investigation.md`. Select the locally built
CLI explicitly. Use a new, empty state directory for each showcase:

```sh
export MIILO_CLI_BIN=/absolute/path/to/test/miilo
export CARETAKER_MODEL_CONFIG=/absolute/private/model.json
export CARETAKER_STATE_DIR=/absolute/path/to/new-demo-state
npm run showcase
```

The command refuses to overwrite its isolated local configuration. It does not
replace an installed Miilo executable, enroll real agent sessions, start a
collector service or change live user preferences. Each collector run is explicit
and finishes after one snapshot. The evidence file, collector state and SQLite
workflow database remain inside the selected demo directory.

The journey runs live investigation, reopens saved state in a separate process,
exports SDK observations, enrolls the workflow in the native CLI and projects a
snapshot. A revision-bound recheck switches only the sample source to healthy
facts. It asserts that current attention clears and historical failed evidence
remains. `CARETAKER_DEMO_FAST=1` removes presentation pauses for rehearsal; it does
not replace inference or simulate results.

The Linux recording was validated on Omarchy with Node.js 26.12.0. Source checks,
28 caretaker tests, seven SDK/CLI bridge tests and 50 CLI regression tests passed.
These results do not qualify the unexecuted Node 22 GitHub CI workflow or published
SDK/CLI dependencies. The optional integration still requires the local SDK build.
