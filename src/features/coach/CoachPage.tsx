import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { AiConsent } from "@/components/AiConsent";

const SUGGESTIONS = [
  "What should I eat today?",
  "Give me a high-protein dinner recipe",
  "Am I on track for my goal?",
  "What should my next workout be?",
  "How do I sleep better for recovery?",
  "Is creatine worth it?",
  "I have no motivation today",
];

const BASIC_SUGGESTIONS = [
  "How many calories do I have left?",
  "Give me a dinner recipe",
  "High-protein snack",
  "Am I on track?",
  "What should my next workout be?",
  "Is creatine worth it?",
  "How do I sleep better?",
  "Eating out tips",
];

export default function CoachPage() {
  const { data, add, remove } = useStore();
  const profile = useProfile();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
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

  async function ask(question: string, retry = false) {
    const q = question.trim();
    if (!q || streaming !== null) return;
    setError(null);
    setInput("");
    if (!retry) add("coachMessages", { role: "user", content: q });

    if (mode === "basic") {
      const history = messages.filter((m) => m.role === "user").map((m) => m.content);
      add("coachMessages", { role: "assistant", content: basicCoachReply(q, data, profile, today(), history), source: "basic" });
      return;
    }

    const prior = retry ? messages.slice(0, -1) : messages;
    const history: ChatMessage[] = [...prior.filter((m) => m.source !== "basic").slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })), { role: "user", content: q }];
    // Merge consecutive same-role turns (e.g. after a failed reply) so the conversation alternates.
    for (let i = history.length - 1; i > 0; i--) if (history[i].role === history[i - 1].role) history.splice(i - 1, 2, { role: history[i].role, content: `${history[i - 1].content}\n\n${history[i].content}` });
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
      setError({ message: e instanceof ApiError ? e.message : "The coach couldn't answer right now.", question: q });
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
        subtitle={mode === "ai" ? "Ask me anything" : "Simple answers from your logged data"}
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

      {status?.ai && !profile.privacy.aiDataSharing && (
        <div className="mb-4">
          <AiConsent feature="coach" />
        </div>
      )}
      {status && !status.ai && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-mist-400" />
          <p className="text-mist-300">This is BULKUP's built-in coach. It answers common questions about food, training and progress using your logged data. Try one of the suggestions below.</p>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4">
        {messages.length === 0 && streaming === null && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-volt-500/15 text-volt-400 shadow-glow">
              <Bot className="h-7 w-7" />
            </span>
            <p className="max-w-sm text-sm text-mist-400">Ask about food, training, recovery, motivation, or anything else. I know your goal and what you've logged.</p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} source={m.source} text={m.content} />
        ))}
        {streaming !== null && <Bubble role="assistant" source="ai" text={streaming || "…"} live />}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm">
            <span className="text-mist-300">{error.message}</span>
            <Button size="sm" variant="secondary" onClick={() => ask(error.question, true)}>
              Try again
            </Button>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 -mb-28 mt-4 bg-ink-950 pb-[calc(env(safe-area-inset-bottom,0px)+84px)] pt-3 lg:-mb-12 lg:pb-4">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-ink-950 to-transparent" />
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {(mode === "ai" ? SUGGESTIONS : BASIC_SUGGESTIONS).map((s) => (
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
            <Pill>Built-in coach</Pill>
          </div>
        )}
      </div>
    </div>
  );
}
