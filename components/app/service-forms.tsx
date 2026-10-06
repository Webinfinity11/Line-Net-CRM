"use client";
import { UnitInput } from "@/components/app/unit-input";

import { useState } from "react";
import type { SubgroupOption } from "@/components/app/subgroup-rows";
import { Plus } from "lucide-react";
import { createService, updateService } from "@/actions/services";
import { FormDialog } from "@/components/app/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useSystems } from "@/components/app/systems-provider";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/i18n";
import type { Service } from "@/db/schema";


function Fields({ initial, defaultSystemType, defaultSubgroupId, subgroups }: { initial?: Service; defaultSystemType?: string; defaultSubgroupId?: number; subgroups: SubgroupOption[] }) {
  const [system, setSystem] = useState(initial?.systemType ?? defaultSystemType ?? "");
  const [subgroup, setSubgroup] = useState(String(initial?.subgroupId ?? defaultSubgroupId ?? ""));
  // hidden categories stay selectable on a service that already uses one, so saving does not silently drop it
  const systemOptions = useSystems().filter((s) => s.active || s.key === initial?.systemType || s.key === defaultSystemType);
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 [&_input:not([type=checkbox])]:h-11 [&_[data-slot=native-select-wrapper]]:h-11 [&_[data-slot=native-select-wrapper]]:w-full">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="s-name">დასახელება</Label>
        <Input id="s-name" name="name" required minLength={2} maxLength={200} defaultValue={initial?.name} placeholder="მაგ. კამერის მონტაჟი" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-system">ჯგუფი</Label>
        <NativeSelect id="s-system" name="systemType" required value={system} onChange={e => { setSystem(e.target.value); setSubgroup(""); }} className="w-full">
          <NativeSelectOption value="" disabled>— აირჩიეთ —</NativeSelectOption>
          {systemOptions.map((sys) => (
            <NativeSelectOption key={sys.key} value={sys.key}>
              {sys.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-subgroup">ქვეჯგუფი</Label>
        <NativeSelect id="s-subgroup" name="subgroupId" value={subgroup} onChange={e => setSubgroup(e.target.value)} className="w-full">
          <NativeSelectOption value="">ქვეჯგუფის გარეშე</NativeSelectOption>
          {subgroups.filter(s => s.systemSlug === system && (s.active || String(s.id) === subgroup)).map(s =>
            <NativeSelectOption key={s.id} value={String(s.id)}>{s.name}{!s.active ? " · გამორთული" : ""}</NativeSelectOption>
          )}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-unit">ერთეული</Label>
        <UnitInput id="s-unit" name="unit" defaultValue={initial?.unit ?? "ცალი"} className="w-full" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-price">ფასი ერთეულზე (₾)</Label>
        <Input id="s-price" name="price" type="number" step="0.01" min="0" required defaultValue={initial ? Number(initial.price) : ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-sort">რიგითობა</Label>
        <Input id="s-sort" name="sort" type="number" min="0" max="9999" defaultValue={initial?.sort ?? 0} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="s-desc">აღწერა</Label>
        <Textarea className="min-h-24 resize-y" id="s-desc" name="description" rows={2} maxLength={1000} defaultValue={initial?.description ?? ""} placeholder="რას მოიცავს ეს სერვისი" />
      </div>
      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={initial ? initial.active : true} className="size-4 accent-[#3457d5]" /> აქტიურია
      </label>
    </div>
  );
}

export function NewServiceDialog({ defaultSystemType, defaultSubgroupId, subgroups = [], compact = false }: { defaultSystemType?: string; defaultSubgroupId?: number; subgroups?: SubgroupOption[]; compact?: boolean }) {
  return (
    <FormDialog
      trigger={compact ? <Button variant="ghost" size="sm" className="h-11 shrink-0" /> : <Button />}
      triggerLabel={
        <>
          <Plus className="size-4" /> {compact ? "სერვისი" : "ახალი სერვისი"}
        </>
      }
      title="ახალი სერვისი"
      action={createService}
      submitLabel="შენახვა"
      successMessage="სერვისი დაემატა"
    >
      <Fields defaultSystemType={defaultSystemType} defaultSubgroupId={defaultSubgroupId} subgroups={subgroups} />
    </FormDialog>
  );
}

// A component keeps catalogue names in Mkhedruli inside the shared dialog trigger.
function ServiceSummary({ service }: { service: Service }) {
  return (
    <span className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_100px_120px] sm:items-center sm:gap-4">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-[21px]">{service.name}</span>
        {service.description && <span className="mt-0.5 hidden text-[12px] text-muted-foreground sm:block">{service.description}</span>}
        {!service.active && <span className="block text-[11.5px] text-muted-foreground">გამორთული</span>}
      </span>
      <span className="text-[12px] text-muted-foreground">
        {service.unit}<span className="sm:hidden"> · <span className="tabular font-medium text-foreground">{formatMoney(service.price)}</span></span>
      </span>
      <span className="tabular hidden text-right text-[13px] font-semibold sm:block">{formatMoney(service.price)}</span>
    </span>
  );
}

export function EditServiceDialog({ service, subgroups = [] }: { service: Service; subgroups?: SubgroupOption[] }) {
  return (
    <FormDialog
      trigger={<button type="button" className="min-w-0 flex-1 rounded-lg py-3 text-left outline-none hover:text-[#3457d5] focus-visible:ring-2 focus-visible:ring-[#3457d5]" aria-label={`${service.name} — რედაქტირება`} />}
      triggerLabel={<ServiceSummary service={service} />}
      title="სერვისის რედაქტირება"
      action={updateService.bind(null, service.id)}
      submitLabel="შენახვა"
      successMessage="შენახულია"
    >
      <Fields initial={service} subgroups={subgroups} />
    </FormDialog>
  );
}
