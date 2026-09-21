"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createOrder } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useActiveSystems } from "@/components/app/systems-provider";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITY_LABELS, TYPE_LABELS, t, SYSTEM_LABELS } from "@/lib/i18n";
import type { ClientOption } from "./types";

/** Compact "ახალი შეკვეთა" form; the full form stays on /orders/new. */
export function QuickCreate({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const systemOptions = useActiveSystems();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity() || busy.current) return;
    busy.current = true;
    setError(null);
    const fd = new FormData(form);
    start(async () => {
      try {
        const res = await createOrder(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const id = res.data?.id;
        toast.success(id ? `LN-${String(id).padStart(5, "0")} დაემატა` : "შეკვეთა დაემატა");
        setOpen(false);
        form.reset();
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> {t.order.new}
      </DialogTrigger>
      <DialogContent className="ln-panel-in sm:max-w-[520px]">
        <DialogHeader>
          <div className="text-[11px] text-muted-foreground">შეკვეთები / შექმნა</div>
          <DialogTitle className="font-heading text-lg font-medium">ახალი შეკვეთა</DialogTitle>
          <DialogDescription className="text-[12px]">მოკლე ფორმა. დანარჩენი ველები (ობიექტი, დრო, თანხა) შეკვეთის გვერდზე ივსება.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="qc-title">სამუშაოს დასახელება</Label>
              <Input id="qc-title" name="title" required minLength={2} maxLength={200} placeholder="მაგ. კამერების დიაგნოსტიკა" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-client">კლიენტი</Label>
              <NativeSelect id="qc-client" name="clientId" className="w-full" defaultValue="">
                <NativeSelectOption value="">— არ არის არჩეული —</NativeSelectOption>
                {clients.map((c) => (
                  <NativeSelectOption key={c.id} value={String(c.id)}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-type">ტიპი</Label>
              <NativeSelect id="qc-type" name="type" className="w-full" defaultValue="service">
                {(Object.entries(TYPE_LABELS) as [string, string][]).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-system">კატეგორია</Label>
              <NativeSelect id="qc-system" name="systemType" className="w-full" defaultValue="">
                <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
                {systemOptions.map((sys) => (
                  <NativeSelectOption key={sys.key} value={sys.key}>
                    {sys.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-priority">პრიორიტეტი</Label>
              <NativeSelect id="qc-priority" name="priority" className="w-full" defaultValue="normal">
                {(Object.entries(PRIORITY_LABELS) as [string, string][]).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="qc-desc">აღწერა</Label>
              <Textarea id="qc-desc" name="description" rows={3} maxLength={2000} placeholder="რა სამუშაოა შესასრულებელი?" />
            </div>
          </div>
          {error && (
            <p className="text-[12px] text-[#b13f32]" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              <Check className="size-4" /> {pending ? "ინახება…" : "შეკვეთის შექმნა"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
