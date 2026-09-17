"use client";

import { Camera, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeOrder, uploadAttachment } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * "სამუშაო შესრულებულია": asks for a short summary; the server enforces required
 * the photo requirement and returns a readable error otherwise.
 */
export function CompleteDialog({
  orderId,
  requiredLeft,
  needsPhoto,
  size = "default",
  className,
}: {
  orderId: number;
  requiredLeft: number;
  needsPhoto: boolean;
  size?: "default" | "lg" | "sm";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoMissing = needsPhoto && !photoName;
  const blocked = requiredLeft > 0 || photoMissing;

  // the technician is standing on site: the photo is taken here, not on another screen
  function addPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadAttachment(orderId, fd);
      setUploading(false);
      if (photoInput.current) photoInput.current.value = "";
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setPhotoName(file.name);
      toast.success("ფოტო აიტვირთა");
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
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
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size={size} variant="success" className={className} />}>
        <CheckCircle2 className="size-4" /> სამუშაო შესრულებულია
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>სამუშაოს ჩაბარება</DialogTitle>
          <DialogDescription>მოკლედ აღწერეთ, რა გაკეთდა. ეს ტექსტი კლიენტის ანგარიშში და ისტორიაში ჩაიწერება.</DialogDescription>
        </DialogHeader>
        {/* `needsPhoto` turns false as soon as the upload lands, so the confirmation is kept by local state */}
        {(needsPhoto || photoName) && (
          <div
            className={cn(
              "rounded-lg border p-2.5 text-xs",
              photoName ? "border-[#bfe0cd] bg-[#f1f8f4] text-[#1f6b4b]" : "border-amber-300 bg-amber-50 text-amber-900",
            )}
            role="alert"
          >
            {photoName ? (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" /> ფოტო დამატებულია: {photoName}
              </div>
            ) : (
              <>
                <div>ამ სამუშაოს ჩასაბარებლად ფოტო სავალდებულოა.</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-10 w-full sm:h-8 sm:w-auto"
                  disabled={uploading || pending}
                  onClick={() => photoInput.current?.click()}
                >
                  <Camera className="size-4" /> {uploading ? "იტვირთება..." : "ფოტოს დამატება"}
                </Button>
              </>
            )}
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => addPhoto(e.target.files)}
            />
          </div>
        )}
        {requiredLeft > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900" role="alert">
            შესასრულებელი პუნქტები დარჩა: {requiredLeft}
          </div>
        )}
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
          {error && (
            <p className="text-sm text-[#b13f32]" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              გაუქმება
            </Button>
            <Button type="submit" variant="success" disabled={pending || blocked || note.trim().length < 5}>
              {pending ? "ინახება..." : "ჩაბარება"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
