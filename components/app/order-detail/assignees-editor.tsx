"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAssignees } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ROLE_LABELS, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../user-avatar";

export function AssigneesEditor({
  orderId,
  users,
  selected,
}: {
  orderId: number;
  users: { id: string; name: string; role: string; image?: string | null }[];
  selected: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string[]>(selected);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await setAssignees(orderId, value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("შემსრულებლები განახლდა");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(selected);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="xs" />}>
        <Pencil className="size-3" /> შეცვლა
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.order.assignees}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {users.map((u) => {
            const on = value.includes(u.id);
            return (
              <button
                type="button"
                key={u.id}
                onClick={() => setValue((v) => (on ? v.filter((x) => x !== u.id) : [...v, u.id]))}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm",
                  on ? "border-[#3457d5] bg-[#eef2ff] dark:bg-blue-950/30" : "hover:bg-[#f8faff] dark:hover:bg-neutral-800",
                )}
              >
                <input type="checkbox" readOnly checked={on} className="accent-[#3457d5]" />
                <UserAvatar name={u.name} image={u.image} />
                <span className="flex-1 truncate">{u.name}</span>
                <span className="text-[11px] text-muted-foreground">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button className="h-11" onClick={save} disabled={pending}>
            {pending ? "ინახება…" : t.common.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
