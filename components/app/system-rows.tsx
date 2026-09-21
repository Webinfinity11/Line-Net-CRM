"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSystem, deleteSystem, moveSystem, renameSystem, setSystemActive } from "@/actions/systems";
import { CatalogueActions } from "@/components/app/service-toggle";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
          <Plus className="size-4" /> ახალი კატეგორია
        </>
      }
      title="ახალი კატეგორია"
      description="მაგ. მზის პანელები, ვენტილაცია, ჭკვიანი სახლი"
      action={createSystem}
      submitLabel="დამატება"
      successMessage="კატეგორია დაემატა"
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
    <div className={cn("flex items-center gap-2 border-t border-[#eef1f6] py-3 first:border-t-0 sm:py-[6px]", !row.active && "opacity-60")}>
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <Input
          value={name}
          maxLength={60}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== row.name && name.trim().length >= 2 && run(() => renameSystem(row.slug, name.trim()), "შენახულია")}
          aria-label={`${row.name} დასახელება`}
          className="h-11 w-full min-w-0 border-transparent bg-transparent px-2 text-[16px] shadow-none hover:border-[#dbe1ec] hover:bg-[#f8faff] focus:border-[#dbe1ec] focus:bg-[#f8faff] focus-visible:border-[#dbe1ec] focus-visible:ring-2 focus-visible:ring-[#3457d5]/30 sm:flex-1 sm:text-[14px]"
        />
        <div className="flex flex-wrap gap-x-2 px-2 text-[11.5px] text-muted-foreground sm:w-[210px] sm:shrink-0 sm:flex-nowrap sm:px-0">
          <span>{row.usage > 0 ? `${row.usage} ჩანაწერი` : "არ გამოიყენება"}</span>
          {!row.active && <span>გამორთული</span>}
        </div>
      </div>
      <CatalogueActions
        name={row.name} active={row.active} disabled={pending}
        toggle={() => setSystemActive(row.slug, !row.active)}
        remove={row.usage === 0 ? () => deleteSystem(row.slug) : undefined}
        deleteDisabledReason={row.usage > 0 ? "გამოყენებული კატეგორია არ იშლება" : undefined}
        deleteTitle="კატეგორიის წაშლა"
        deleteDescription={`„${row.name}“ სამუდამოდ წაიშლება. ეს შესაძლებელია, რადგან არსად არ გამოიყენება.`}
      >
        <DropdownMenuItem disabled={first || pending} onClick={() => run(() => moveSystem(row.slug, "up"))}>
          <ChevronUp className="size-4" /> ზემოთ
        </DropdownMenuItem>
        <DropdownMenuItem disabled={last || pending} onClick={() => run(() => moveSystem(row.slug, "down"))}>
          <ChevronDown className="size-4" /> ქვემოთ
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </CatalogueActions>
    </div>
  );
}
