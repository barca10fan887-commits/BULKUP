// BULKUP API on Supabase Edge Functions: AI coach (streaming), food photo scanner, status.
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  (required for AI)   ANTHROPIC_MODEL (optional, default claude-opus-5-5)
//   AI_DAILY_COACH_LIMIT / AI_DAILY_SCAN_LIMIT (optional per-user daily limits)
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { CHECKIN_SYSTEM, COACH_SYSTEM, FOOD_SCAN_PROMPT, FOOD_SCAN_SCHEMA } from "./prompts.ts";

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-5-5";
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const COACH_LIMIT = Number(Deno.env.get("AI_DAILY_COACH_LIMIT") || 80);
const SCAN_LIMIT = Number(Deno.env.get("AI_DAILY_SCAN_LIMIT") || 30);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (keys.default) return keys.default;
  } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const admin = createClient(SUPABASE_URL, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

// A declined request is retried on a fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01" as const], fallbacks: "default" as const };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-code",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (status: number, error: string, code: string) => json({ error, code }, status);

async function currentUser(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** Records one use and returns false if the user is over today's limit. */
async function withinLimit(userId: string, kind: "coach" | "scan"): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).gte("created_at", since);
  if ((count ?? 0) >= (kind === "coach" ? COACH_LIMIT : SCAN_LIMIT)) return false;
  await admin.from("ai_usage").insert({ user_id: userId, kind });
  return true;
}

function describe(e: unknown): { status: number; error: string; code: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, error: "The AI is busy right now. Try again in a minute.", code: "ai_rate_limited" };
  if (e instanceof Anthropic.AuthenticationError) return { status: 503, error: "The AI key isn't valid. The app owner needs to update it in Supabase.", code: "ai_auth" };
  if (e instanceof Anthropic.PermissionDeniedError) return { status: 503, error: "The AI account can't be used right now (check billing or credits).", code: "ai_permission" };
  if (e instanceof Anthropic.BadRequestError) {
    const msg = String((e as Error).message || "");
    if (/credit balance/i.test(msg)) return { status: 503, error: "The AI account is out of credit. The app owner needs to top it up.", code: "ai_credit" };
    return { status: 400, error: "The AI couldn't process that request.", code: "ai_bad_request" };
  }
  if (e instanceof Anthropic.APIConnectionError) return { status: 503, error: "Couldn't reach the AI. Try again shortly.", code: "ai_unreachable" };
  if (e instanceof Anthropic.APIError) return { status: 502, error: `The AI returned an error (${e.status ?? "unknown"}).`, code: "ai_error" };
  return { status: 500, error: "Something went wrong with the AI request.", code: "ai_error" };
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function validMessages(v: unknown): v is ChatMessage[] {
  return Array.isArray(v) && v.length > 0 && v.length <= 40 && v.every((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0 && m.content.length <= 8000);
}

async function coach(req: Request, userId: string): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || !validMessages(body.messages) || body.messages[0].role !== "user") return fail(400, "Invalid coach request.", "bad_request");
  const context = body.context ?? {};
  if (JSON.stringify(context).length > 80_000) return fail(413, "Too much data in one request.", "too_large");
  const mode = body.mode === "checkin" ? "checkin" : "chat";
  if (!(await withinLimit(userId, "coach"))) return fail(429, `You've reached today's limit of ${COACH_LIMIT} coach messages. It resets tomorrow.`, "daily_limit");

  const stream = anthropic!.beta.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: mode === "checkin" ? "medium" : "low" },
    system: [
      { type: "text", text: mode === "checkin" ? CHECKIN_SYSTEM : COACH_SYSTEM },
      { type: "text", text: `<user_data>\n${JSON.stringify(context)}\n</user_data>` },
    ],
    messages: body.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\nI can't help with that one, sorry. Ask me something else."));
      } catch (e) {
        console.error("coach", e);
        controller.enqueue(encoder.encode(`\u0000ERROR:${describe(e).error}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(readable, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
}

function validScan(v: unknown): v is { is_food: boolean; items: Record<string, unknown>[]; notes: string } {
  const r = v as { is_food?: unknown; items?: unknown; notes?: unknown };
  return !!r && typeof r.is_food === "boolean" && Array.isArray(r.items) && typeof r.notes === "string" &&
    r.items.every((i: Record<string, unknown>) => typeof i.name === "string" && typeof i.portion === "string" && ["estimated_grams", "calories", "protein_g", "carbs_g", "fat_g"].every((k) => typeof i[k] === "number") && ["low", "medium", "high"].includes(i.confidence as string));
}

async function foodScan(req: Request, userId: string): Promise<Response> {
  const body = await req.json().catch(() => null);
  const types = ["image/jpeg", "image/png", "image/webp"];
  if (!body || typeof body.imageBase64 !== "string" || body.imageBase64.length < 100 || body.imageBase64.length > 7_000_000 || !types.includes(body.mediaType))
    return fail(400, "Upload a JPEG, PNG or WebP photo under 5 MB.", "bad_request");
  const hint = typeof body.hint === "string" ? body.hint.slice(0, 300) : "";
  if (!(await withinLimit(userId, "scan"))) return fail(429, `You've reached today's limit of ${SCAN_LIMIT} photo scans. It resets tomorrow.`, "daily_limit");

  try {
    const response = await anthropic!.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: { type: "json_schema", schema: FOOD_SCAN_SCHEMA as unknown as Record<string, unknown> } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.imageBase64 } },
            { type: "text", text: hint ? `${FOOD_SCAN_PROMPT}\n\nThe user added this note about the meal: <note>${hint}</note>` : FOOD_SCAN_PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return fail(422, "The AI couldn't analyse this photo. Try another photo or add the food manually.", "ai_refusal");
    if (response.stop_reason === "max_tokens") return fail(502, "The AI response was cut short. Try again.", "ai_truncated");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fail(502, "The AI returned an unreadable result. Try again.", "ai_parse");
    }
    if (!validScan(parsed)) return fail(502, "The AI returned an unexpected result. Try again.", "ai_parse");
    return json(parsed);
  } catch (e) {
    console.error("food-scan", e);
    const d = describe(e);
    return fail(d.status, d.error, d.code);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();

  if (route === "status") {
    return json({ ai: !!anthropic, model: anthropic ? MODEL : null, auth: "supabase", accountDeletion: false });
  }
  if (req.method !== "POST" || (route !== "coach" && route !== "food-scan")) return fail(404, "Not found", "not_found");

  const userId = await currentUser(req);
  if (!userId) return fail(401, "Please sign in to use this feature.", "unauthenticated");
  if (!anthropic) return fail(503, "AI features aren't switched on yet.", "ai_disabled");

  try {
    return route === "coach" ? await coach(req, userId) : await foodScan(req, userId);
  } catch (e) {
    console.error(route, e);
    const d = describe(e);
    return fail(d.status, d.error, d.code);
  }
});
