"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createSystem, deleteSystem, moveSystem, renameSystem, setSystemActive } from "@/actions/systems";
import { CatalogueActions } from "@/components/app/service-toggle";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { FormDialog } from "@/components/app/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SystemAdminRow = { slug: string; name: string; sort: number; active: boolean; services: number; orders: number };

export function NewSystemDialog() {
  const router = useRouter();
  const created = useRef<string | null>(null);
  return (
    <FormDialog
      trigger={<Button />}
      triggerLabel={
        <>
          <Plus className="size-4" /> ახალი ჯგუფი
        </>
      }
      title="ახალი ჯგუფი"
      description="მაგ. მზის პანელები, ვენტილაცია, ჭკვიანი სახლი"
      action={async (fd) => {
        const res = await createSystem(fd);
        created.current = res.ok ? (res.data?.slug ?? null) : null;
        return res;
      }}
      // straight to the new, still empty category, where its first service is added
      onSuccess={() => created.current && router.push(`/settings/services?cat=${encodeURIComponent(created.current)}`)}
      submitLabel="დამატება"
      successMessage="ჯგუფი დაემატა. დაამატეთ მისი პირველი სერვისი."
    >
      <div className="space-y-1.5">
        <Label htmlFor="sys-name">დასახელება</Label>
        <Input id="sys-name" name="name" required minLength={2} maxLength={60} placeholder="მაგ. ვენტილაცია" autoFocus className="h-11 text-[16px] sm:h-9 sm:text-[13px]" />
      </div>
    </FormDialog>
  );
}

/** The name as plain text inside the row's trigger, so FormDialog does not set it in Mtavruli. */
function CategoryName({ name }: { name: string }) {
  return <span className="block truncate">{name}</span>;
}

/**
 * One row of the catalogue: the name opens a rename dialog, the menu moves, hides and deletes.
 * The name used to be an always-editable field that saved on blur; people typed a new category
 * into it and silently renamed an existing one.
 */
export function SystemRow({ row, first, last }: { row: SystemAdminRow; first: boolean; last: boolean }) {
  const usage = row.services + row.orders;
  const router = useRouter();
  const [pending, start] = useTransition();
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
    <div className={cn("flex items-center gap-2 border-t border-[#eef1f6] dark:border-border py-3 first:border-t-0 sm:py-[6px]", !row.active && "opacity-60")}>
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <FormDialog
          trigger={
            <button
              type="button"
              disabled={pending}
              aria-label={`${row.name} — სახელის შეცვლა`}
              className="flex h-11 w-full min-w-0 items-center rounded-lg px-2 text-left text-[16px] outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary sm:flex-1 sm:text-[14px]"
            />
          }
          triggerLabel={<CategoryName name={row.name} />}
          title="ჯგუფის სახელი"
          action={(fd) => renameSystem(row.slug, String(fd.get("name") ?? "").trim())}
          submitLabel="შენახვა"
          successMessage="შენახულია"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`sys-${row.slug}`}>დასახელება</Label>
            <Input id={`sys-${row.slug}`} name="name" required minLength={2} maxLength={60} defaultValue={row.name} className="h-11 text-[16px] sm:h-9 sm:text-[13px]" />
          </div>
        </FormDialog>
        <div className="flex flex-wrap items-center gap-x-2 px-2 text-[11.5px] text-muted-foreground sm:w-[260px] sm:shrink-0 sm:flex-nowrap sm:px-0">
          {usage > 0 ? (
            <span className="flex items-center gap-x-1 whitespace-nowrap">
              <Link href={`/settings/services?cat=${encodeURIComponent(row.slug)}`} className="inline-flex min-h-11 items-center text-primary hover:underline sm:min-h-0">
                {row.services} სერვისი
              </Link>
              <span>· {row.orders} შეკვეთა</span>
            </span>
          ) : <span>არ გამოიყენება</span>}
          {!row.active && <span className="whitespace-nowrap">· გამორთული</span>}
        </div>
      </div>
      <CatalogueActions
        name={row.name} active={row.active} disabled={pending}
        toggle={() => setSystemActive(row.slug, !row.active)}
        remove={usage === 0 ? () => deleteSystem(row.slug) : undefined}
        deleteDisabledReason={usage > 0 ? "გამოყენებული ჯგუფი არ იშლება" : undefined}
        deleteTitle="ჯგუფის წაშლა"
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
