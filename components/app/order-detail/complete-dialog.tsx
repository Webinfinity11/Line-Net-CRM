"use client";

import { Camera, CheckCircle2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeOrder, uploadAttachment } from "@/actions/orders";
import { getCompletionDetails } from "@/actions/checklists";
import { completionProblems } from "@/lib/completion-gates";
import { compressImage, UPLOAD_LIMIT_BYTES } from "@/lib/compress-image";
import { ChecklistItems, type ChecklistRow } from "./checklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function CompleteDialog({
  orderId,
  size = "default",
  className,
}: {
  orderId: number;
  requiredLeft: number;
  size?: "default" | "lg" | "sm";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<{ checklist: ChecklistRow[]; photos: { id: number; fileName: string; mimeType: string | null }[]; staff: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const problems = details ? completionProblems({ note, attachments: details.photos, checklist: details.checklist, staff: details.staff }) : [loading ? "მონაცემები იტვირთება" : "მონაცემები მიუწვდომელია. გახსენით თავიდან"];
  const blocked = loading || busy || !details || problems.length > 0;
  async function reload() {
    const result = await getCompletionDetails(orderId);
    if (result.ok) { setDetails(result.data); }
    else { setDetails(null); setError(result.error); }
  }
  function changeOpen(value: boolean) {
    if (busy || pending) return;
    setOpen(value);
    if (value) {
      setDetails(null); setError(null); setLoading(true);
      start(async () => {
        try { await reload(); } catch { setError("მონაცემები ვერ ჩაიტვირთა. გახსენით თავიდან"); }
        finally { setLoading(false); }
      });
    }
  }
  function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    setBusy(true); setError(null);
    start(async () => {
      try {
        for (const file of selected) {
          const fd = new FormData();
          if (!file.type.startsWith("image/")) throw new Error("აირჩიეთ ფოტო");
          const photo = await compressImage(file);
          if (photo.size > UPLOAD_LIMIT_BYTES) throw new Error("ფოტო დიდია. აირჩიეთ პატარა ფოტო");
          fd.set("file", photo);
          const res = await uploadAttachment(orderId, fd);
          if (!res.ok) throw new Error(res.error);
        }
      } catch (e) { setError(e instanceof Error ? e.message : "ფოტო ვერ აიტვირთა"); }
      finally {
        try { await reload(); } catch { setDetails(null); setError("მონაცემები ვერ ჩაიტვირთა. გახსენით თავიდან"); }
        if (input.current) input.current.value = "";
        setBusy(false); router.refresh();
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || blocked) return;
    setError(null);
    start(async () => {
      const res = await completeOrder(orderId, note);
      if (!res.ok) {
        setError(res.error); // keep the typed text, show the reason inline
        toast.error(res.error);
        return;
      }
      toast.success("სამუშაო ჩაბარებულია");
      setOpen(false);
      setNote("");
      if (pathname === "/my") router.push("/my?tab=done");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button size={size} variant="success" className={className} />}>
        <CheckCircle2 className="size-4" /> სამუშაო შესრულებულია
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>სამუშაოს ჩაბარება</DialogTitle>
          <DialogDescription>აღწერეთ სამუშაო, დაამატეთ ფოტო და მონიშნეთ სავალდებულო პუნქტები.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            required
            minLength={5}
            placeholder="მაგ. შევცვალეთ 2 დეტექტორი, სისტემა გატესტილია, კლიენტს ჩავაბარეთ."
            aria-label="შესრულებული სამუშაოს აღწერა"
            autoFocus
          />
          <div className="space-y-3">
            <Button type="button" variant="outline" className="h-[44px]" disabled={busy || pending} onClick={() => input.current?.click()}><Camera className="size-4" />{busy ? "იტვირთება…" : "ფოტოს გადაღება"}</Button>
            <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => upload(e.target.files)} />
            {details && details.photos.length > 0 && <div className="flex flex-wrap gap-2">{details.photos.map(photo => <a key={photo.id} href={`/api/files/${photo.id}`} target="_blank" rel="noreferrer" aria-label={photo.fileName}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${photo.id}`} alt={photo.fileName} className="size-[64px] rounded-[8px] object-cover" />
            </a>)}</div>}
            {details && details.checklist.length > 0 && <ChecklistItems orderId={orderId} items={details.checklist} disabled={busy || pending} onChanged={reload} onBusy={setBusy} />}
          </div>
          {error && (
            <p className="text-sm text-[#b13f32]" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="h-[44px]" disabled={pending || busy} onClick={() => changeOpen(false)}>
              გაუქმება
            </Button>
            <Button type="submit" className="h-[44px]" variant="success" disabled={pending || blocked || note.trim().length < 5}>
              {pending ? "ინახება…" : "ჩაბარება"}
            </Button>
          </div>
          {problems.length > 0 && <ul className="space-y-1 text-[12px] text-[#617084]" aria-live="polite">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
