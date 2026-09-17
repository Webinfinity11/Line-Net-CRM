"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkHoursForm({ hours, action }: { hours: number; action: (fd: FormData) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(fd);
          if (!res.ok) toast.error(res.error);
          else toast.success("ნორმა შენახულია");
          router.refresh();
        });
      }}
      className="flex flex-wrap items-end gap-3 [&_input]:h-11 sm:[&_input]:h-8"
    >
      <div className="w-full space-y-1.5 sm:w-auto">
        <Label htmlFor="hours">საათი დღეში ერთ შემსრულებელზე</Label>
        <Input id="hours" name="hours" type="number" min="1" max="24" step="0.5" defaultValue={hours} className="w-full sm:w-32" />
      </div>
      <Button type="submit" variant="outline" className="h-11 w-full sm:h-9 sm:w-auto" disabled={pending}>
        შენახვა
      </Button>
      <p className="basis-full text-xs text-muted-foreground">განრიგში დატვირთვა ითვლება როგორც დაგეგმილი საათები / ეს ნორმა.</p>
    </form>
  );
}
