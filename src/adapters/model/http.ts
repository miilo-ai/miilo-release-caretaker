import type { ModelConfig } from "./config.js";

export async function completion(config: ModelConfig, key: string, body: unknown, signal: AbortSignal) {
  const bytes = JSON.stringify(body);
  if (Buffer.byteLength(bytes) > 32_000) throw new Error("Model request exceeds limit");
  try {
    const url = new URL("chat/completions", config.baseUrl.replace(/\/?$/, "/"));
    const response = await fetch(url, { method: "POST", redirect: "error", signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: bytes });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error("Model request unavailable");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65_536) throw new Error("Model response exceeds limit");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch { throw new Error("Model request could not complete"); }
}
