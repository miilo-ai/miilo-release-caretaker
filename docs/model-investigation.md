# Configurable model investigation

The investigator implements the application port through a Mastra Agent.
Endpoint URL, model ID and credential-file reference are operator configuration.
No model provider is required by the domain or the SDK observation contract.

Create a private JSON configuration file, readable only by its owner:

```json
{
  "baseUrl": "https://inference.example.com/v1",
  "model": "your-model-id",
  "credentialFile": "/absolute/private/model.key",
  "protocol": "native-tools",
  "deadlineMs": 90000
}
```

Store only the bearer credential in the referenced owner-only file. Both files
must be regular files; symlinks and files accessible to other users are rejected.
Keep them outside tracked content. HTTPS is required by default. An operator may
explicitly set `allowInsecureHttp: true` for an endpoint on a trusted private
transport. URLs containing credentials, query parameters or fragments are rejected;
redirects are never followed. This configuration is not a public request parameter.

```sh
CARETAKER_MODEL_CONFIG=/absolute/private/model.json npm run model:smoke
CARETAKER_MODEL_CONFIG=/absolute/private/model.json npm run journey -- start stale-package
```

The smoke command starts a sample-check workflow with actual model inference and
requires a validated model investigation. It fails if the workflow falls back to
unavailable investigation. It reports run ID, sanitized diagnosis and measurements.
It is explicit opt-in and is never part of `npm test` or automatic CI.

## Tool protocols

- `native-tools`: OpenAI-compatible chat completions with function calls.
- `json-tools`: text-only chat completions where the model emits a strict JSON
  tool request. The protocol adapter translates that request into a model tool
  call. Mastra executes the registered tool and controls the bounded agent loop.

Both modes expose only `list_evidence` and `read_evidence` for the current report.
No shell, filesystem, arbitrary URL, installation or write tool is available.
Evidence is treated as data. A final citation must refer to an item actually read
through the tool in this investigation. Known IDs alone are insufficient.
Structured output and citations are validated before the result becomes model
evidence. Deterministic verdicts remain unchanged by model output or model failure.

## Bounds and measurements

An investigation permits four model requests, three tool invocations and one
concurrent call per investigator instance. Requests disable automatic retries,
set at most 512 output tokens and share a configurable deadline capped at 120
seconds. Serialized requests are limited to 32 KB and decoded responses to 64 KiB.
Invalid JSON, unknown evidence, truncation, HTTP errors and budget exhaustion fail
closed. The workflow retains deterministic evidence and human review on failure.

The adapter buffers each bounded completion before delivering it to Mastra; token
streaming is not implemented by this bridge. Reported measurements include request
and tool counts, latency and token usage only when supplied by every model response.
Missing usage remains unknown. Cost estimates require provider pricing and usage
provenance and are not currently calculated. Sanitized failure-stage metadata is
available without raw prompts, credentials or provider error bodies.

Native tool support is tested against a disposable compatible server. Live local
Gemma qualification uses `json-tools` with sample release checks. This does not
qualify other providers, real release checks or a publicly hosted endpoint.
