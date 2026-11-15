// Google Gemini (REST) for the coach and photo scanner.
// Docs: https://ai.google.dev/gemini-api/docs  (generateContent / streamGenerateContent)

export class GeminiError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

type Part = { text?: string; thought?: boolean; inline_data?: { mime_type: string; data: string } };
type Content = { role: "user" | "model"; parts: Part[] };

function endpoint(cfg: GeminiConfig, method: "generateContent" | "streamGenerateContent", sse = false) {
  return `${cfg.baseUrl.replace(/\/$/, "")}/v1beta/models/${encodeURIComponent(cfg.model)}:${method}${sse ? "?alt=sse" : ""}`;
}

async function toError(res: Response): Promise<GeminiError> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.status || body?.error?.message || "";
  } catch { /* not JSON */ }
  console.error("gemini", res.status, detail);
  if (res.status === 429) return new GeminiError("The free AI limit has been reached for now. Try again in a minute (or tomorrow if it keeps happening).", 429, "ai_rate_limited");
  if (res.status === 400 && /API_KEY|api key/i.test(detail)) return new GeminiError("The Gemini key isn't valid. The app owner needs to update it in Supabase.", 503, "ai_auth");
  if (res.status === 401 || res.status === 403) return new GeminiError("The Gemini key can't be used. The app owner needs to check it in Supabase.", 503, "ai_auth");
  if (res.status === 404) return new GeminiError("The AI model setting is wrong. The app owner needs to check GEMINI_MODEL in Supabase.", 503, "ai_model");
  if (res.status >= 500) return new GeminiError("The AI is having trouble right now. Try again shortly.", 503, "ai_unavailable");
  return new GeminiError("The AI couldn't process that request.", 400, "ai_bad_request");
}

const textOf = (parts: Part[] | undefined) => (parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");

export function toContents(messages: { role: "user" | "assistant"; content: string }[]): Content[] {
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

/** Streams reply text. Yields chunks as they arrive. */
export async function* geminiStream(cfg: GeminiConfig, system: string, contents: Content[], signal?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch(endpoint(cfg, "streamGenerateContent", true), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 4096 } }),
    signal,
  });
  if (!res.ok || !res.body) throw await toError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let blocked = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        if (chunk?.promptFeedback?.blockReason) blocked = true;
        const cand = chunk?.candidates?.[0];
        if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") blocked = true;
        const t = textOf(cand?.content?.parts);
        if (t) yield t;
      } catch { /* partial line; ignore */ }
    }
  }
  if (blocked) yield "\n\nI can't help with that one, sorry. Ask me something else.";
}

/** One-shot JSON generation against a response schema (OpenAPI-style subset). */
export async function geminiJson(cfg: GeminiConfig, parts: Part[], schema: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(endpoint(cfg, "generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw await toError(res);
  const body = await res.json();
  if (body?.promptFeedback?.blockReason) throw new GeminiError("The AI couldn't analyse this photo. Try another photo or add the food manually.", 422, "ai_refusal");
  const text = textOf(body?.candidates?.[0]?.content?.parts);
  if (!text) throw new GeminiError("The AI returned an empty result. Try again.", 502, "ai_parse");
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError("The AI returned an unreadable result. Try again.", 502, "ai_parse");
  }
}

/** Gemini's responseSchema uses an OpenAPI subset: drop JSON-Schema-only keys. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
      if (k === "additionalProperties") continue;
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}
