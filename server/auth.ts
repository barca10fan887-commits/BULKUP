// Request authorisation for the API server.
// 1. Supabase configured: require a valid Supabase access token (JWT).
// 2. Otherwise, if BULKUP_ACCESS_CODE is set: require the matching X-Access-Code header.
// 3. Otherwise: open only in development, locked in production.
import type { NextFunction, Request, Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ACCESS_CODE = process.env.BULKUP_ACCESS_CODE || "";
const IS_PROD = process.env.NODE_ENV === "production";

const anonClient: SupabaseClient | null = SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } }) : null;
export const adminClient: SupabaseClient | null = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }) : null;

export type AuthMode = "supabase" | "access_code" | "dev_open" | "locked";
export const authMode: AuthMode = anonClient ? "supabase" : ACCESS_CODE ? "access_code" : IS_PROD ? "locked" : "dev_open";

declare module "express-serve-static-core" {
  interface Request {
    userKey?: string;
    userId?: string;
  }
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (authMode === "supabase") {
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Please sign in to use this feature.", code: "unauthenticated" });
    const { data, error } = await anonClient!.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Your session has expired. Please sign in again.", code: "unauthenticated" });
    req.userId = data.user.id;
    req.userKey = `u:${data.user.id}`;
    return next();
  }
  if (authMode === "access_code") {
    const code = req.header("x-access-code") || "";
    if (!safeEqual(code, ACCESS_CODE)) return res.status(401).json({ error: "Enter this server's access code in Settings > Privacy to use AI features.", code: "access_code" });
    req.userKey = `c:${req.ip}`;
    return next();
  }
  if (authMode === "dev_open") {
    req.userKey = `ip:${req.ip}`;
    return next();
  }
  return res.status(503).json({
    error: "AI features are locked on this server. The owner needs to configure Supabase or BULKUP_ACCESS_CODE.",
    code: "locked",
  });
}

/** Small fixed-window rate limiter, per user. Enough for a single-instance deployment. */
export function rateLimit(limit: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.userKey || req.ip || "anon";
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    if (h.n >= limit) {
      res.setHeader("Retry-After", Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ error: "You're sending requests too quickly. Try again in a minute.", code: "rate_limited" });
    }
    h.n++;
    next();
  };
}
