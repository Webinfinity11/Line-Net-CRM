"use client";

import { MoreHorizontal, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { deleteService, setServiceActive } from "@/actions/services";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Shared catalogue menu; the confirmation lives outside the dismissing menu. */
export function CatalogueActions({ name, active, toggle, remove, deleteTitle, deleteDescription, children, disabled = false, deleteDisabledReason }: {
  name: string;
  active: boolean;
  toggle: () => Promise<ActionResult<unknown>>;
  remove?: () => Promise<ActionResult<unknown>>;
  deleteTitle: string;
  deleteDescription: string;
  children?: ReactNode;
  disabled?: boolean;
  deleteDisabledReason?: string;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  function run(action: () => Promise<ActionResult<unknown>>, message: string) {
    start(async () => {
      const res = await action();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(message);
      setConfirm(false);
      router.refresh();
    });
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button ref={trigger} variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${name} — მოქმედებები`} disabled={disabled || pending} />}>
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          {children}
          <DropdownMenuItem onClick={() => run(toggle, active ? "გამოირთო" : "ჩაირთო")}>
            <Power className="size-4" /> {active ? "გამორთვა" : "ჩართვა"}
          </DropdownMenuItem>
          {(remove || deleteDisabledReason) && <DropdownMenuSeparator />}
          {remove && <DropdownMenuItem onClick={() => setConfirm(true)}><Trash2 className="size-4" /> წაშლა</DropdownMenuItem>}
          {deleteDisabledReason && <DropdownMenuItem disabled>{deleteDisabledReason}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirm} onOpenChange={(open) => { if (!pending) setConfirm(open); }}>
        <DialogContent className="sm:max-w-md" finalFocus={trigger}>
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setConfirm(false)}>გაუქმება</Button>
            <Button variant="destructive" disabled={pending} onClick={() => remove && run(remove, "წაიშალა")}>
              {pending ? "იშლება…" : "წაშლა"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ServiceActions({ id, name, active, canDelete }: { id: number; name: string; active: boolean; canDelete: boolean }) {
  return <CatalogueActions name={name} active={active} toggle={() => setServiceActive(id, !active)}
    remove={canDelete ? () => deleteService(id) : undefined} deleteTitle="სერვისის წაშლა"
    deleteDescription={`„${name}“ წაიშლება. არსებულ შეკვეთებში პოზიციები და მათი ფასები დარჩება.`} />;
}
