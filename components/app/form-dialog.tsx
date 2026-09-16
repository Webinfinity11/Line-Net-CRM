"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

export function FormDialog({
  trigger,
  triggerLabel,
  title,
  description,
  children,
  action,
  submitLabel = t.common.save,
  successMessage = "შენახულია",
  onSuccess,
}: {
  trigger: ReactElement;
  triggerLabel?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  submitLabel?: string;
  successMessage?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await action(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "ინახება..." : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
