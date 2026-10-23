# Engineering constitution

- Domain and application depend inward on typed contracts and ports. Mastra,
  HTTP, process execution, storage, clocks and model clients belong in adapters.
- New authored modules stay below 200 lines. Use explicit static imports.
- Deterministic checks own verdicts. Model output is explanation, never authority.
- Missing evidence is unknown. Workflow completion is distinct from check success.
- Miilo SDK owns observation contracts. Do not copy its schema or implement a
  second workflow engine. Mastra owns execution state.
- Subscribe before snapshot; reconcile gaps and reconnects from authoritative state.
- No secrets, personal paths, internal infrastructure, private transcripts, or
  diary-style development commentary in tracked content.
- Public demos accept curated scenario IDs only. No arbitrary URLs, shell commands,
  repository installation or visitor-supplied model configuration.
- Enforce network, output, time, concurrency and cost bounds in concrete adapters.
- Package installation tests use disposable environments with no host secrets.
- Feature branches and review precede main. Owner authorizes public deployment.
- Distinguish sample, adapter, live, native and deployed verification evidence.
