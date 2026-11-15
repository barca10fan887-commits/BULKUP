import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bot, Info, Send, Square, Trash2, User } from "lucide-react";
import type { ChatMessage, StatusResponse } from "@shared/api";
import { useProfile, useStore } from "@/data/store";
import { today } from "@/lib/dates";
import { buildCoachContext } from "@/lib/coachContext";
import { basicCoachReply } from "@/lib/coachFallback";
import { ApiError, getStatus, streamCoach } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/ui/misc";
import { RichText } from "@/components/RichText";
import { cn } from "@/components/ui/cn";

const SUGGESTIONS = [
  "What should I eat today?",
  "How many calories do I have left?",
  "What should I eat to reach my protein target?",
  "Am I gaining weight fast enough?",
  "What should my next workout be?",
  "How can I improve my routine?",
  "Why has my weight stopped increasing?",
  "What should I change this week?",
];

export default function CoachPage() {
  const { data, add, remove } = useStore();
  const profile = useProfile();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const partial = useRef("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStatus(true).then(setStatus);
    return () => abort.current?.abort();
  }, []);

  const messages = [...data.coachMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const aiReady = !!status?.ai && profile.privacy.aiDataSharing;
  const mode: "ai" | "basic" = aiReady ? "ai" : "basic";

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || streaming !== null) return;
    setError(null);
    setInput("");
    add("coachMessages", { role: "user", content: q });

    if (mode === "basic") {
      add("coachMessages", { role: "assistant", content: basicCoachReply(q, data, profile, today()), source: "basic" });
      return;
    }

    const history: ChatMessage[] = [...messages.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })), { role: "user", content: q }];
    // The API requires the conversation to start with a user turn.
    while (history.length && history[0].role !== "user") history.shift();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStreaming("");
    partial.current = "";
    try {
      const full = await streamCoach(
        history,
        buildCoachContext(data, profile, today()),
        "chat",
        (chunk) => {
          partial.current += chunk;
          setStreaming(partial.current);
        },
        ctrl.signal,
      );
      add("coachMessages", { role: "assistant", content: full.trim() || "I couldn't come up with an answer. Try rephrasing.", source: "ai" });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        if (partial.current.trim()) add("coachMessages", { role: "assistant", content: `${partial.current.trim()}\n\n(stopped)`, source: "ai" });
        return;
      }
      setError(e instanceof ApiError ? e.message : "The coach couldn't answer right now.");
      add("coachMessages", { role: "assistant", content: basicCoachReply(q, data, profile, today()), source: "basic" });
    } finally {
      setStreaming(null);
      abort.current = null;
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <PageHeader
        title="AI Coach"
        subtitle={mode === "ai" ? "Personal advice from your logged data" : "Basic coach: answers from your logged data"}
        action={
          messages.length > 0 &&
          (confirmClear ? (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  messages.forEach((m) => remove("coachMessages", m.id));
                  setConfirmClear(false);
                }}
              >
                Clear chat
              </Button>
            </div>
          ) : (
            <Button size="icon" variant="ghost" aria-label="Clear conversation" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ))
        }
      />

      {status && mode === "basic" && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/[.08] px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div className="text-mist-300">
            {!status.ai ? (
              <>AI features are unavailable on this server, so you're using the basic coach. It answers common questions with simple rules from your logged data.</>
            ) : (
              <>
                AI coaching is off because AI data sharing is disabled. The basic coach still answers common questions.{" "}
                <Link to="/settings#privacy" className="font-semibold text-volt-400">Turn on AI features</Link>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4">
        {messages.length === 0 && streaming === null && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-volt-500/15 text-volt-400 shadow-glow">
              <Bot className="h-7 w-7" />
            </span>
            <p className="max-w-sm text-sm text-mist-400">Ask about your food, training or progress. Answers use what you've logged in BULKUP, never made-up numbers.</p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} source={m.source} text={m.content} />
        ))}
        {streaming !== null && <Bubble role="assistant" source="ai" text={streaming || "…"} live />}
        {error && <p className="text-center text-xs text-warn">{error} Showing a basic answer instead.</p>}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 -mb-28 mt-4 bg-ink-950 pb-[calc(env(safe-area-inset-bottom,0px)+84px)] pt-3 lg:-mb-12 lg:pb-4">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-ink-950 to-transparent" />
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} disabled={streaming !== null} onClick={() => ask(s)} className="shrink-0 rounded-full border border-ink-600 bg-ink-900 px-3.5 py-1.5 text-xs font-medium text-mist-300 transition hover:border-volt-500/50 hover:text-mist-100 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="coach-input" className="sr-only">Ask the coach</label>
          <textarea
            id="coach-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            maxLength={2000}
            placeholder="Ask your coach…"
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-ink-600 bg-ink-900 px-4 py-3 text-[16px] placeholder:text-mist-500 focus:border-volt-500 focus:outline-none focus:ring-2 focus:ring-volt-500/30"
          />
          {streaming !== null ? (
            <Button size="icon" variant="secondary" className="h-12 w-12" aria-label="Stop" onClick={() => abort.current?.abort()}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="h-12 w-12" aria-label="Send" disabled={!input.trim()}>
              <Send className="h-5 w-5" />
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-mist-500">Coaching is general fitness guidance, not medical advice. Numbers are estimates.</p>
      </div>
    </div>
  );
}

function Bubble({ role, text, source, live }: { role: "user" | "assistant"; text: string; source?: "ai" | "basic"; live?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex animate-rise gap-2.5", isUser && "flex-row-reverse")}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", isUser ? "bg-ink-700 text-mist-300" : "bg-volt-500/15 text-volt-400")}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[15px]", isUser ? "rounded-tr-md bg-volt-500 text-white" : "rounded-tl-md border border-ink-700 bg-ink-850 text-mist-300")} aria-live={live ? "polite" : undefined}>
        {isUser ? <p className="whitespace-pre-wrap">{text}</p> : <RichText text={text} />}
        {!isUser && source === "basic" && (
          <div className="mt-2">
            <Pill>Basic coach</Pill>
          </div>
        )}
      </div>
    </div>
  );
}
