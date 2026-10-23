# Repository rules

Read `.specify/memory/constitution.md` and the relevant specification before edits.
Work on feature branches. Keep main protected and publish only when authorized.
Run `npm run check` and `npm test` before proposing a change.
Do not treat a sample scenario as a live release validation.
Do not start model calls, install tested packages on the host, or provision paid
infrastructure as a side effect of tests. External adapters need explicit bounds.
Keep operational credentials and private deployment details outside this repo.
