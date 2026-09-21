"use client";

import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Keep dialogs outside the menu so dismissing a menu item cannot unmount the form. */
export function ClientActionsMenu({ name, editTitle, editAction, children, secondary }: {
  name: string;
  editTitle: string;
  editAction: (fd: FormData) => Promise<ActionResult<unknown>>;
  children: ReactNode;
  secondary?: {
    label: string;
    title: string;
    description?: string;
    action: () => Promise<ActionResult<unknown>>;
    destructive?: boolean;
    redirectTo?: string;
  };
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<"edit" | "confirm" | null>(null);
  const [pending, start] = useTransition();
  function run(fd?: FormData) {
    start(async () => {
      const result = fd ? await editAction(fd) : await secondary!.action();
      if (!result.ok) { toast.error(result.error); return; }
      setDialog(null);
      if (fd) toast.success("შენახულია");
      if (!fd && secondary?.redirectTo) router.push(secondary.redirectTo);
      router.refresh();
    });
  }
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button ref={trigger} variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${name} — მოქმედებები`} />}>
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem className="min-h-11" onClick={() => setDialog("edit")}><Pencil className="size-4" /> რედაქტირება</DropdownMenuItem>
        {secondary && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11" onClick={() => setDialog("confirm")}>
            {secondary.destructive ? <Trash2 className="size-4" /> : <Power className="size-4" />} {secondary.label}
          </DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !pending) setDialog(null); }}>
      <DialogContent finalFocus={trigger} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialog === "edit" ? editTitle : secondary?.title}</DialogTitle>
          {dialog === "confirm" && secondary?.description && <DialogDescription>{secondary.description}</DialogDescription>}
        </DialogHeader>
        {dialog === "edit" ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); run(new FormData(event.currentTarget)); }}>
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => setDialog(null)}>გაუქმება</Button>
            <Button type="submit" className="h-11" disabled={pending}>{pending ? "ინახება…" : "შენახვა"}</Button>
          </div>
        </form> : <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-11" disabled={pending} onClick={() => setDialog(null)}>გაუქმება</Button>
          <Button variant={secondary?.destructive ? "destructive" : "default"} className="h-11" disabled={pending} onClick={() => run()}>{pending ? "..." : secondary?.label}</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
