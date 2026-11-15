// Claude integration. The API key is read from the server environment only.
import Anthropic from "@anthropic-ai/sdk";
import { FoodScanJsonSchema, FoodScanResultSchema, type ChatMessage, type FoodScanResult } from "../shared/api.js";
import { CHECKIN_SYSTEM, COACH_SYSTEM, FOOD_SCAN_PROMPT } from "./prompts.js";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const client = aiEnabled ? new Anthropic() : null;

// Server-side fallback: if the model declines a request, the API retries on a
// fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01" as const], fallbacks: "default" as const };

export class AiError extends Error {
  constructor(message: string, public status = 502, public code = "ai_error") {
    super(message);
  }
}

export function describeError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.RateLimitError) return new AiError("The AI service is busy right now. Try again in a minute.", 429, "ai_rate_limited");
  if (e instanceof Anthropic.AuthenticationError) return new AiError("The server's AI key is invalid. The app owner needs to update ANTHROPIC_API_KEY.", 503, "ai_auth");
  if (e instanceof Anthropic.BadRequestError) return new AiError("The AI service couldn't process that request.", 400, "ai_bad_request");
  if (e instanceof Anthropic.APIConnectionError) return new AiError("Couldn't reach the AI service. Try again shortly.", 503, "ai_unreachable");
  if (e instanceof Anthropic.APIError) return new AiError(`The AI service returned an error (${e.status ?? "unknown"}).`, 502, "ai_error");
  return new AiError("Something went wrong with the AI request.", 500, "ai_error");
}

function requireClient(): Anthropic {
  if (!client) throw new AiError("AI features aren't configured on this server.", 503, "ai_disabled");
  return client;
}

export async function scanFoodImage(imageBase64: string, mediaType: "image/jpeg" | "image/png" | "image/webp", hint?: string): Promise<FoodScanResult> {
  const c = requireClient();
  const response = await c.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: { type: "json_schema", schema: FoodScanJsonSchema as unknown as Record<string, unknown> } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: hint ? `${FOOD_SCAN_PROMPT}\n\nThe user added this note about the meal: <note>${hint}</note>` : FOOD_SCAN_PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new AiError("The AI couldn't analyse this photo. Try another photo or add the food manually.", 422, "ai_refusal");
  if (response.stop_reason === "max_tokens") throw new AiError("The AI response was cut short. Try again.", 502, "ai_truncated");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("The AI returned an unreadable result. Try again.", 502, "ai_parse");
  }
  const result = FoodScanResultSchema.safeParse(parsed);
  if (!result.success) throw new AiError("The AI returned an unexpected result. Try again.", 502, "ai_parse");
  return result.data;
}

/** Streams coach text to `write`. */
export async function streamCoachReply(messages: ChatMessage[], context: unknown, mode: "chat" | "checkin", write: (text: string) => void, signal: AbortSignal) {
  const c = requireClient();
  const dataBlock = `<user_data>\n${JSON.stringify(context)}\n</user_data>`;
  const stream = c.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: mode === "checkin" ? "medium" : "low" },
      system: [
        { type: "text", text: mode === "checkin" ? CHECKIN_SYSTEM : COACH_SYSTEM },
        { type: "text", text: dataBlock },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") write(event.delta.text);
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") write("\n\nI can't help with that one. Try asking about your food, training or progress.");
}
