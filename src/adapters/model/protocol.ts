import { randomUUID } from "node:crypto";
import type { LanguageModelV3CallOptions, LanguageModelV3Content } from "@ai-sdk/provider";
import { z } from "zod";

export function jsonObject(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
}

export function messages(options: LanguageModelV3CallOptions, jsonTools: boolean) {
  return options.prompt.map(message => {
    if (message.role === "system") return { role: "system", content: message.content };
    if (jsonTools) return { role: message.role === "tool" ? "user" : message.role,
      content: message.content.map(part => part.type === "text" ? part.text
        : part.type === "tool-call" ? JSON.stringify({ tool: part.toolName, arguments: part.input })
          : part.type === "tool-result" ? `Evidence result for ${part.toolName}: ${JSON.stringify(part.output)}`
            : "Unsupported content").join("\n") };
    if (message.role === "tool") return message.content.map(part => {
      if (part.type !== "tool-result") throw new Error("Unsupported tool message");
      return { role: "tool", tool_call_id: part.toolCallId, content: JSON.stringify(part.output) };
    });
    const content = message.content.flatMap(part => part.type === "text" ? [part.text] : []).join("\n");
    const calls = message.content.flatMap(part => part.type === "tool-call" ? [{
      id: part.toolCallId, type: "function", function: { name: part.toolName, arguments: JSON.stringify(part.input) },
    }] : []);
    return { role: message.role, content, ...(calls.length ? { tool_calls: calls } : {}) };
  }).flat();
}

export const responseSchema = z.object({
  choices: z.array(z.object({ finish_reason: z.enum(["stop", "tool_calls"]), message: z.object({
    content: z.string().max(8000).nullable().optional(),
    tool_calls: z.array(z.object({ id: z.string().max(200), type: z.literal("function"),
      function: z.object({ name: z.string().max(100), arguments: z.string().max(2000) }) })).max(4).optional(),
  }) })).length(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative() }).optional(),
});

export function responseContent(raw: unknown, jsonTools: boolean): LanguageModelV3Content[] {
  const choice = responseSchema.parse(raw).choices[0]!;
  if (jsonTools) {
    const text = choice.message.content ?? "";
    const value = jsonObject(text);
    const tool = z.object({ tool: z.enum(["list_evidence", "read_evidence"]),
      arguments: z.record(z.string(), z.unknown()) }).strict().safeParse(value);
    if (tool.success) return [{ type: "tool-call", toolCallId: randomUUID(),
      toolName: tool.data.tool, input: JSON.stringify(tool.data.arguments) }];
    return [{ type: "text", text }];
  }
  if (choice.finish_reason === "tool_calls") {
    if (!choice.message.tool_calls?.length) throw new Error("Missing tool calls");
    return choice.message.tool_calls.map(call => ({ type: "tool-call", toolCallId: call.id,
      toolName: call.function.name, input: call.function.arguments }));
  }
  if (choice.message.tool_calls?.length) throw new Error("Inconsistent completion state");
  return [{ type: "text", text: choice.message.content ?? "" }];
}
