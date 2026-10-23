import type { LanguageModelV3, LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider";
import type { ModelConfig } from "./config.js";
import { completion } from "./http.js";
import { messages, responseContent, responseSchema } from "./protocol.js";

export interface ModelMeasurement {
  requests: number; toolCalls: number; latencyMs: number;
  inputTokens: number | null; outputTokens: number | null;
  failureStage?: "credential" | "generation" | "answer" | "citations";
}

export function compatibleModel(config: ModelConfig, key: string, signal: AbortSignal,
  measurement: ModelMeasurement): LanguageModelV3 {
  const jsonTools = config.protocol === "json-tools";
  async function generate(options: LanguageModelV3CallOptions) {
    if (++measurement.requests > 4) throw new Error("Model request budget exhausted");
    const tools = options.tools?.map(tool => {
      if (tool.type !== "function") throw new Error("Unsupported provider tool");
      return { type: "function", function: { name: tool.name, description: tool.description,
        parameters: tool.inputSchema } };
    });
    const raw = await completion(config, key, {
      model: config.model, messages: messages(options, jsonTools), stream: false, temperature: 0,
      max_tokens: 512, ...(!jsonTools && tools?.length ? { tools, tool_choice: "auto" } : {}),
    }, options.abortSignal ? AbortSignal.any([signal, options.abortSignal]) : signal);
    const parsed = responseSchema.parse(raw);
    const content = responseContent(raw, jsonTools);
    if (parsed.usage) {
      measurement.inputTokens = measurement.requests === 1 ? parsed.usage.prompt_tokens
        : measurement.inputTokens === null ? null : measurement.inputTokens + parsed.usage.prompt_tokens;
      measurement.outputTokens = measurement.requests === 1 ? parsed.usage.completion_tokens
        : measurement.outputTokens === null ? null : measurement.outputTokens + parsed.usage.completion_tokens;
    } else { measurement.inputTokens = null; measurement.outputTokens = null; }
    return { content, warnings: [],
      finishReason: { unified: content.some(c => c.type === "tool-call") ? "tool-calls" as const : "stop" as const,
        raw: parsed.choices[0]!.finish_reason },
      usage: { inputTokens: { total: parsed.usage?.prompt_tokens, noCache: undefined,
        cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: parsed.usage?.completion_tokens, text: undefined, reasoning: undefined } },
    };
  }
  return { specificationVersion: "v3", provider: "caretaker-compatible", modelId: config.model,
    supportedUrls: {}, doGenerate: generate,
    doStream: async options => {
      const result = await generate(options);
      const stream = new ReadableStream<LanguageModelV3StreamPart>({ start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        for (const part of result.content) {
          if (part.type === "text") {
            controller.enqueue({ type: "text-start", id: "answer" });
            controller.enqueue({ type: "text-delta", id: "answer", delta: part.text });
            controller.enqueue({ type: "text-end", id: "answer" });
          } else if (part.type === "tool-call") controller.enqueue(part);
        }
        controller.enqueue({ type: "finish", finishReason: result.finishReason, usage: result.usage });
        controller.close();
      } });
      return { stream };
    },
  };
}
