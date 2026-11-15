import { useEffect, useRef, useState } from "react";
import { Camera, Columns2, Eye, ImagePlus, Lock, Trash2, X } from "lucide-react";
import type { ProgressPhoto } from "@/lib/types";
import { useProfile, useStore } from "@/data/store";
import { formatDay, today, daysBetween } from "@/lib/dates";
import { resizeImage } from "@/lib/image";
import { uid } from "@/lib/id";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

function usePhotoUrl(path: string | undefined) {
  const { repo } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (path) repo.photoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path, repo]);
  return url;
}

export function PhotosTab() {
  const { data, repo, add, remove } = useStore();
  const profile = useProfile();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const [meta, setMeta] = useState({ date: today(), pose: "front" as ProgressPhoto["pose"], note: "" });
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const photos = [...data.progressPhotos].sort((a, b) => b.date.localeCompare(a.date));
  const byMonth = photos.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    const k = p.date.slice(0, 7);
    (acc[k] ||= []).push(p);
    return acc;
  }, {});

  async function upload() {
    if (!pending) return;
    setUploading(true);
    try {
      const img = await resizeImage(pending.file, 1600, 0.85);
      const id = uid();
      const path = await repo.savePhoto(id, img.blob);
      add("progressPhotos", { id, date: meta.date, pose: meta.pose, note: meta.note.trim() || undefined, path });
      toast.show({ message: "Photo saved privately" });
      URL.revokeObjectURL(pending.preview);
      setPending(null);
      setMeta({ date: today(), pose: "front", note: "" });
    } catch (e) {
      toast.show({ tone: "error", message: `Couldn't save the photo: ${(e as Error).message}` });
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(p: ProgressPhoto) {
    remove("progressPhotos", p.id);
    try {
      await repo.deletePhoto(p.path);
    } catch {
      /* record already removed; orphan file cleanup is best effort */
    }
    setViewing(null);
  }

  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPending({ file: f, preview: URL.createObjectURL(f) });
          e.target.value = "";
        }}
      />
      <Card>
        <CardHeader
          icon={<Camera className="h-4 w-4" />}
          title="Progress photos"
          subtitle={<span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> {repo.kind === "cloud" ? "Private to your account" : "Stored only on this device"}</span>}
          action={
            <div className="flex gap-2">
              {photos.length >= 2 && (
                <Button size="sm" variant={selecting ? "primary" : "secondary"} onClick={() => { setSelecting(!selecting); setCompare([]); }}>
                  <Columns2 className="h-4 w-4" /> {selecting ? "Cancel" : "Compare"}
                </Button>
              )}
              <Button size="sm" onClick={() => input.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Add
              </Button>
            </div>
          }
        />
        {selecting && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-volt-500/30 bg-volt-500/[.07] px-3 py-2 text-sm">
            <span>Select two photos to compare ({compare.length}/2)</span>
            <Button size="sm" disabled={compare.length !== 2} onClick={() => setComparing(true)}>
              Compare
            </Button>
          </div>
        )}
        {photos.length === 0 ? (
          <EmptyState icon={<Camera className="h-5 w-5" />} title="Start your photo journal" body="Take photos in the same spot, lighting and pose every 2-4 weeks. Side-by-side comparisons show changes the scale can't." action={<Button onClick={() => input.current?.click()}>Add first photo</Button>} />
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(byMonth).map(([month, list]) => (
              <section key={month}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-mist-500">{new Date(month + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {list.map((p) => (
                    <Thumb key={p.id} photo={p} blur={profile.privacy.blurPhotos} selected={compare.includes(p.id)} onClick={() => (selecting ? toggleCompare(p.id) : setViewing(p))} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="New progress photo" footer={<Button block loading={uploading} onClick={upload}>Save photo</Button>}>
        {pending && (
          <div className="flex flex-col gap-3">
            <img src={pending.preview} alt="Selected progress photo" className="max-h-80 w-full rounded-2xl object-contain" />
            <div className="grid grid-cols-2 gap-3">
              <Input id="ph-date" label="Date" type="date" max={today()} value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} />
              <Select id="ph-pose" label="Pose" value={meta.pose} onChange={(e) => setMeta({ ...meta, pose: e.target.value as ProgressPhoto["pose"] })}>
                <option value="front">Front</option>
                <option value="side">Side</option>
                <option value="back">Back</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <Input id="ph-note" label="Note (optional)" value={meta.note} onChange={(e) => setMeta({ ...meta, note: e.target.value })} />
          </div>
        )}
      </Sheet>

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} onDelete={deletePhoto} />
      {comparing && compare.length === 2 && (
        <CompareView
          a={photos.find((p) => p.id === compare[0])!}
          b={photos.find((p) => p.id === compare[1])!}
          onClose={() => {
            setComparing(false);
            setSelecting(false);
            setCompare([]);
          }}
        />
      )}
    </div>
  );
}

function Thumb({ photo, blur, selected, onClick }: { photo: ProgressPhoto; blur: boolean; selected: boolean; onClick(): void }) {
  const url = usePhotoUrl(photo.path);
  return (
    <button onClick={onClick} className={cn("group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-ink-900", selected ? "border-volt-500 ring-2 ring-volt-500" : "border-ink-700")} aria-label={`Photo from ${formatDay(photo.date)}, ${photo.pose}`}>
      {url && <img src={url} alt="" className={cn("h-full w-full object-cover transition", blur && "blur-lg group-hover:blur-0 group-focus-visible:blur-0")} loading="lazy" />}
      {blur && <Eye className="absolute right-2 top-2 h-4 w-4 text-white/70" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-semibold text-white">{formatDay(photo.date, { day: "numeric", month: "short" })} · {photo.pose}</span>
    </button>
  );
}

function PhotoViewer({ photo, onClose, onDelete }: { photo: ProgressPhoto | null; onClose(): void; onDelete(p: ProgressPhoto): void }) {
  const url = usePhotoUrl(photo?.path);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [photo]);
  if (!photo) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={formatDay(photo.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
      footer={
        confirm ? (
          <div className="flex gap-2">
            <Button variant="ghost" block onClick={() => setConfirm(false)}>Keep</Button>
            <Button variant="danger" block onClick={() => onDelete(photo)}>Delete permanently</Button>
          </div>
        ) : (
          <Button variant="ghost" block onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Delete photo</Button>
        )
      }
    >
      {url ? <img src={url} alt={`Progress photo, ${photo.pose}`} className="mx-auto max-h-[60dvh] rounded-2xl object-contain" /> : <div className="h-64 animate-pulse rounded-2xl bg-ink-800" />}
      <p className="mt-3 text-sm capitalize text-mist-400">{photo.pose}{photo.note ? ` · ${photo.note}` : ""}</p>
    </Sheet>
  );
}

function CompareView({ a, b, onClose }: { a: ProgressPhoto; b: ProgressPhoto; onClose(): void }) {
  const [older, newer] = a.date <= b.date ? [a, b] : [b, a];
  const urlA = usePhotoUrl(older.path);
  const urlB = usePhotoUrl(newer.path);
  const [split, setSplit] = useState(50);
  const [mode, setMode] = useState<"side" | "slider">("side");
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div>
          <p className="font-display font-semibold">Compare</p>
          <p className="text-xs text-mist-400">{daysBetween(older.date, newer.date)} days apart</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMode(mode === "side" ? "slider" : "side")}>{mode === "side" ? "Slider" : "Side by side"}</Button>
          <Button size="icon" variant="ghost" aria-label="Close comparison" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
      </div>
      {mode === "side" ? (
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-hidden px-2 pb-4">
          {[{ p: older, u: urlA }, { p: newer, u: urlB }].map(({ p, u }) => (
            <figure key={p.id} className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-ink-900">{u && <img src={u} alt="" className="h-full w-full object-contain" />}</div>
              <figcaption className="mt-2 text-center text-sm font-semibold">{formatDay(p.date, { day: "numeric", month: "short", year: "numeric" })}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-3 overflow-hidden px-4 pb-4">
          <div className="relative min-h-0 w-full max-w-md flex-1 overflow-hidden rounded-2xl bg-ink-900">
            {urlB && <img src={urlB} alt="" className="absolute inset-0 h-full w-full object-contain" />}
            {urlA && <img src={urlA} alt="" className="absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />}
            <div className="absolute inset-y-0 w-0.5 bg-volt-400 shadow-[0_0_10px_#4d95ff]" style={{ left: `${split}%` }} />
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs">{formatDay(older.date, { day: "numeric", month: "short" })}</span>
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs">{formatDay(newer.date, { day: "numeric", month: "short" })}</span>
          </div>
          <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full max-w-md accent-volt-500" aria-label="Comparison slider" />
        </div>
      )}
    </div>
  );
}
