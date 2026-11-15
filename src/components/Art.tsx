import { artUrl, type ArtName } from "@/lib/art";
import { cn } from "./ui/cn";

/** A 3D illustration on a soft tile. */
export function Art({ name, size = 40, className, tile = true }: { name: ArtName; size?: number; className?: string; tile?: boolean }) {
  const img = <img src={artUrl(name)} alt="" width={tile ? Math.round(size * 0.72) : size} height={tile ? Math.round(size * 0.72) : size} loading="lazy" draggable={false} className="select-none" />;
  if (!tile) return <span className={cn("inline-grid shrink-0 place-items-center", className)}>{img}</span>;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-ink-800", className)} style={{ width: size, height: size }} aria-hidden>
      {img}
    </span>
  );
}
