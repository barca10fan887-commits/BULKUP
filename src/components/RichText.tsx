import { Fragment, type ReactNode } from "react";
import { ART, type ArtName } from "@/lib/art";
import { Art } from "./Art";

/**
 * Minimal, safe Markdown subset: paragraphs, bullet/numbered lists, **bold**. No HTML injection.
 * Extras for the coach: a line "{hero:name}" shows a large illustration; "{art:name}" shows a small one inline.
 */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
        {list.items.map((it, i) => (
          <li key={i} className="pl-0.5">{inline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const hero = line.match(/^\{hero:([a-z]+)\}$/);
    if (hero && (ART as readonly string[]).includes(hero[1])) {
      flushPara();
      flushList();
      blocks.push(
        <div key={blocks.length} className="grid place-items-center rounded-2xl bg-gradient-to-b from-ink-800 to-ink-900 py-4">
          <Art name={hero[1] as ArtName} size={96} tile={false} />
        </div>,
      );
      continue;
    }
    if (bullet || num) {
      flushPara();
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(<p key={blocks.length} className="font-semibold text-mist-100">{inline(heading[1])}</p>);
    } else if (!line) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="flex flex-col gap-2 leading-relaxed">{blocks}</div>;
}

function inline(s: string): ReactNode {
  return s.split(/(\{art:[a-z]+\})/g).map((chunk, j) => {
    const art = chunk.match(/^\{art:([a-z]+)\}$/);
    if (art && (ART as readonly string[]).includes(art[1])) return <Art key={`a${j}`} name={art[1] as ArtName} size={22} tile={false} className="mr-1.5 align-[-5px]" />;
    return <Fragment key={`t${j}`}>{bold(chunk)}</Fragment>;
  });
}

function bold(s: string): ReactNode {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-mist-100">{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part.replace(/(^|\s)\*([^*]+)\*/g, "$1$2")}</Fragment>
    ),
  );
}
