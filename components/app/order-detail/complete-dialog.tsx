"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeOrder } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * "სამუშაო შესრულებულია": asks for a short summary; the server enforces required
 * checklist items and photo requirements and returns a readable error otherwise.
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
  const blocked = requiredLeft > 0 || needsPhoto;

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
        {blocked && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900" role="alert">
            {requiredLeft > 0 && <div>შეუსრულებელია {requiredLeft} სავალდებულო პუნქტი ჩეკ-ლისტში.</div>}
            {needsPhoto && <div>ამ სამუშაოს ჩასაბარებლად ფოტო სავალდებულოა (ატვირთეთ დანართებში).</div>}
            <div className="mt-1 opacity-80">სერვერი ჩაბარებას ამ პირობების გარეშე არ მიიღებს.</div>
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
            <Button type="submit" variant="success" disabled={pending || note.trim().length < 5}>
              {pending ? "ინახება..." : "ჩაბარება"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
