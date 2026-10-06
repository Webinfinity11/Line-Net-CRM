"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { createSubgroup, deleteSubgroup, moveSubgroup, renameSubgroup, setSubgroupActive } from "@/actions/subgroups";
import { FormDialog } from "@/components/app/form-dialog";
import { CatalogueActions } from "@/components/app/service-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export type SubgroupOption = { id: number; systemSlug: string; name: string; sort: number; active: boolean };

export function NewSubgroupMenu({ systemSlug }: { systemSlug: string }) {
  return <FormDialog
      trigger={<Button variant="outline" className="h-11 shrink-0" />}
      triggerLabel={<><Plus className="size-4" /> ქვეჯგუფი</>}
      title="ახალი ქვეჯგუფი"
      action={fd => createSubgroup(systemSlug, String(fd.get("name") ?? ""))} submitLabel="დამატება" successMessage="ქვეჯგუფი დაემატა">
      <div className="space-y-1.5">
        <Label htmlFor={`sub-new-${systemSlug}`}>დასახელება</Label>
        <Input id={`sub-new-${systemSlug}`} name="name" required minLength={2} maxLength={200} className="h-11 text-[16px]" />
      </div>
    </FormDialog>;
}

function SubgroupName({ row }: { row: SubgroupOption }) {
  return <span className="break-words">{row.name}{!row.active && <span className="ml-2 text-muted-foreground">გამორთული</span>}</span>;
}

export function SubgroupRow({ row, admin, used, first, last }: { row: SubgroupOption; admin: boolean; used: boolean; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function move(direction: "up" | "down") {
    start(async () => {
      const result = await moveSubgroup(row.id, direction);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }
  return <>
    {admin ? <FormDialog
      trigger={<button type="button" className="min-h-11 min-w-0 flex-1 cursor-pointer text-left text-[13px] font-semibold text-[#3457d5] hover:underline" />}
      triggerLabel={<SubgroupName row={row} />} title="ქვეჯგუფის სახელი"
      action={fd => renameSubgroup(row.id, String(fd.get("name") ?? ""))}>
      <div className="space-y-1.5">
        <Label htmlFor={`sub-${row.id}`}>დასახელება</Label>
        <Input id={`sub-${row.id}`} name="name" required minLength={2} maxLength={200} defaultValue={row.name} className="h-11 text-[16px]" />
      </div>
    </FormDialog> : <h3 className="min-w-0 flex-1 text-[13px] font-semibold"><SubgroupName row={row} /></h3>}
    {admin && <CatalogueActions name={row.name} active={row.active} disabled={pending}
      toggle={() => setSubgroupActive(row.id, !row.active)} remove={used ? undefined : () => deleteSubgroup(row.id)}
      deleteDisabledReason={used ? "ჯერ სერვისები გადაიტანეთ" : undefined}
      deleteTitle="ქვეჯგუფის წაშლა" deleteDescription={`„${row.name}“ წაიშლება.`}>
      <DropdownMenuItem disabled={first || pending} onClick={() => move("up")}><ChevronUp className="size-4" /> ზემოთ</DropdownMenuItem>
      <DropdownMenuItem disabled={last || pending} onClick={() => move("down")}><ChevronDown className="size-4" /> ქვემოთ</DropdownMenuItem>
    </CatalogueActions>}
  </>;
}
