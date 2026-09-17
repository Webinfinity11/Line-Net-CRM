"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSystem, deleteSystem, moveSystem, renameSystem, setSystemActive } from "@/actions/systems";
import { ConfirmButton } from "@/components/app/confirm-button";
import { FormDialog } from "@/components/app/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SystemAdminRow = { slug: string; name: string; sort: number; active: boolean; usage: number };

export function NewSystemDialog() {
  return (
    <FormDialog
      trigger={<Button />}
      triggerLabel={
        <>
          <Plus className="size-4" /> ახალი სისტემა
        </>
      }
      title="ახალი სისტემა"
      description="მაგ. მზის პანელები, ვენტილაცია, ჭკვიანი სახლი"
      action={createSystem}
      submitLabel="დამატება"
      successMessage="სისტემა დაემატა"
    >
      <div className="space-y-1.5">
        <Label htmlFor="sys-name">დასახელება</Label>
        <Input id="sys-name" name="name" required minLength={2} maxLength={60} placeholder="მაგ. ვენტილაცია" autoFocus className="h-11 text-[16px] sm:h-9 sm:text-[13px]" />
      </div>
    </FormDialog>
  );
}

/** One row of the catalogue: rename in place, move, hide, delete when unused. */
export function SystemRow({ row, first, last }: { row: SystemAdminRow; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(row.name);
  const busy = useRef(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) toast.error(res.error ?? "შეცდომა");
        else if (okMsg) toast.success(okMsg);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-t border-[#eef1f6] py-2.5 first:border-t-0", !row.active && "opacity-60")}>
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label="ზემოთ"
          disabled={first || pending}
          onClick={() => run(() => moveSystem(row.slug, "up"))}
          className="grid size-5 place-items-center rounded text-[#8b97a8] transition-colors hover:bg-[#f1f4f9] hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="ქვემოთ"
          disabled={last || pending}
          onClick={() => run(() => moveSystem(row.slug, "down"))}
          className="grid size-5 place-items-center rounded text-[#8b97a8] transition-colors hover:bg-[#f1f4f9] hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== row.name && name.trim().length >= 2 && run(() => renameSystem(row.slug, name.trim()), "შენახულია")}
        aria-label={`${row.name} დასახელება`}
        className="h-11 min-w-0 flex-1 text-[16px] sm:h-9 sm:text-[13px]"
      />

      <span className="tabular w-[96px] shrink-0 text-[11.5px] text-muted-foreground">{row.usage > 0 ? `${row.usage} ჩანაწერი` : "არ გამოიყენება"}</span>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-11 sm:h-8" disabled={pending} onClick={() => run(() => setSystemActive(row.slug, !row.active), row.active ? "დაიმალა" : "ჩაირთო")}>
          {row.active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {row.active ? "დამალვა" : "ჩვენება"}
        </Button>
        {row.usage === 0 ? (
          <ConfirmButton
            title="სისტემის წაშლა"
            description={`„${row.name}“ სამუდამოდ წაიშლება. ეს შესაძლებელია, რადგან არსად არ გამოიყენება.`}
            confirmLabel="წაშლა"
            variant="destructive"
            size="sm"
            className="h-11 sm:h-8"
            action={() => deleteSystem(row.slug)}
          >
            <Trash2 className="size-3.5" /> წაშლა
          </ConfirmButton>
        ) : (
          <span className="hidden text-[11px] text-muted-foreground sm:inline" title="გამოყენებული სისტემა არ იშლება, რომ ძველი ჩანაწერები არ დაზიანდეს">
            წაშლა შეუძლებელია
          </span>
        )}
      </div>
    </div>
  );
}
