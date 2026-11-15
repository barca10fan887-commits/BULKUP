import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CoachRequestSchema, FoodScanRequestSchema, type StatusResponse } from "../shared/api.js";
import { MODEL, aiEnabled, describeError, scanFoodImage, streamCoachReply } from "./ai.js";
import { adminClient, authMode, rateLimit, requireAuth } from "./auth.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "8mb" }));

// Basic security headers.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=()");
  next();
});

app.get("/api/status", (_req, res) => {
  const body: StatusResponse = { ai: aiEnabled && authMode !== "locked", model: aiEnabled ? MODEL : null, auth: authMode, accountDeletion: !!adminClient };
  res.json(body);
});

app.post("/api/food-scan", requireAuth, rateLimit(20, 60 * 60 * 1000), async (req, res) => {
  const parsed = FoodScanRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Upload a JPEG, PNG or WebP photo under 5 MB.", code: "bad_request" });
  if (!aiEnabled) return res.status(503).json({ error: "The AI food scanner isn't configured on this server.", code: "ai_disabled" });
  try {
    const result = await scanFoodImage(parsed.data.imageBase64, parsed.data.mediaType, parsed.data.hint);
    res.json(result);
  } catch (e) {
    const err = describeError(e);
    console.error("[food-scan]", err.code, e);
    res.status(err.status).json({ error: err.message, code: err.code });
  }
});

app.post("/api/coach", requireAuth, rateLimit(60, 60 * 60 * 1000), async (req, res) => {
  const parsed = CoachRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid coach request.", code: "bad_request" });
  if (JSON.stringify(parsed.data.context).length > 80_000) return res.status(413).json({ error: "Too much data in one request.", code: "too_large" });
  if (!aiEnabled) return res.status(503).json({ error: "The AI coach isn't configured on this server.", code: "ai_disabled" });

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  let started = false;
  try {
    await streamCoachReply(parsed.data.messages, parsed.data.context, parsed.data.mode, (text) => {
      if (!started) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
        started = true;
      }
      res.write(text);
    }, controller.signal);
    if (!started) res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end();
  } catch (e) {
    if (controller.signal.aborted) return;
    const err = describeError(e);
    console.error("[coach]", err.code, e);
    if (started) res.end(`\u0000ERROR:${err.message}`);
    else res.status(err.status).json({ error: err.message, code: err.code });
  }
});

app.post("/api/account/delete", requireAuth, async (req, res) => {
  if (authMode !== "supabase" || !req.userId) return res.status(400).json({ error: "Account deletion only applies to cloud accounts.", code: "bad_request" });
  if (!adminClient) return res.status(503).json({ error: "Account deletion isn't configured on this server (missing service role key).", code: "not_configured" });
  try {
    const bucket = adminClient.storage.from("progress-photos");
    const { data: files } = await bucket.list(req.userId, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((f) => `${req.userId}/${f.name}`));
    // Tables reference auth.users with ON DELETE CASCADE, so this removes all rows.
    const { error } = await adminClient.auth.admin.deleteUser(req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error("[account-delete]", e);
    res.status(500).json({ error: "Couldn't delete the account. Try again or contact support.", code: "delete_failed" });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found", code: "not_found" }));

// In production, serve the built PWA.
const dist = path.resolve(here, "../dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h", setHeaders: (res, file) => {
    if (file.endsWith("sw.js") || file.endsWith("index.html") || file.endsWith(".webmanifest")) res.setHeader("Cache-Control", "no-cache");
    else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } }));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`BULKUP API listening on :${port} (AI: ${aiEnabled ? MODEL : "off"}, auth: ${authMode})`);
});
