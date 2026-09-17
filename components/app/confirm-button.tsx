"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "დადასტურება",
  action,
  redirectTo,
  variant = "destructive",
  size = "sm",
  className,
  ariaLabel,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  action: () => Promise<ActionResult<unknown>>;
  redirectTo?: string;
  variant?: "destructive" | "outline" | "ghost" | "secondary" | "default";
  size?: "xs" | "sm" | "default";
  className?: string;
  /** For icon-only triggers, which have no readable label of their own. */
  ariaLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} className={className} aria-label={ariaLabel} />}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={run} disabled={pending}>
            {pending ? "..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
