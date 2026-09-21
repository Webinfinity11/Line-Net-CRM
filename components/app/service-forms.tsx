"use client";

import { Plus } from "lucide-react";
import { createService, updateService } from "@/actions/services";
import { FormDialog } from "@/components/app/form-dialog";
import { formFields } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useSystems } from "@/components/app/systems-provider";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/i18n";
import type { Service } from "@/db/schema";

const UNITS = ["ცალი", "მეტრი", "წერტილი", "საათი", "კომპლექტი", "მ²"];

function Fields({ initial, defaultSystemType }: { initial?: Service; defaultSystemType?: string }) {
  // hidden categories stay selectable on a service that already uses one, so saving does not silently drop it
  const systemOptions = useSystems().filter((s) => s.active || s.key === initial?.systemType || s.key === defaultSystemType);
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${formFields}`}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="s-name">დასახელება</Label>
        <Input id="s-name" name="name" required minLength={2} maxLength={200} defaultValue={initial?.name} placeholder="მაგ. კამერის მონტაჟი" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-system">კატეგორია</Label>
        <NativeSelect id="s-system" name="systemType" required defaultValue={initial?.systemType ?? defaultSystemType ?? ""} className="w-full">
          <NativeSelectOption value="" disabled>— აირჩიეთ —</NativeSelectOption>
          {systemOptions.map((sys) => (
            <NativeSelectOption key={sys.key} value={sys.key}>
              {sys.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-unit">ერთეული</Label>
        <NativeSelect id="s-unit" name="unit" defaultValue={initial?.unit ?? "ცალი"} className="w-full">
          {initial && !UNITS.includes(initial.unit) && <NativeSelectOption value={initial.unit}>{initial.unit}</NativeSelectOption>}
          {UNITS.map((u) => (
            <NativeSelectOption key={u} value={u}>
              {u}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
        <Textarea id="s-desc" name="description" rows={2} maxLength={1000} defaultValue={initial?.description ?? ""} placeholder="რას მოიცავს ეს სერვისი" />
      </div>
      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={initial ? initial.active : true} className="size-4 accent-[#3457d5]" /> აქტიურია
      </label>
    </div>
  );
}

export function NewServiceDialog({ defaultSystemType, compact = false }: { defaultSystemType?: string; compact?: boolean }) {
  return (
    <FormDialog
      trigger={compact ? <Button variant="ghost" size="sm" className="h-11 shrink-0 sm:h-8" /> : <Button />}
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
      <Fields defaultSystemType={defaultSystemType} />
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

export function EditServiceDialog({ service }: { service: Service }) {
  return (
    <FormDialog
      trigger={<button type="button" className="min-w-0 flex-1 rounded-lg py-3 text-left outline-none hover:text-[#3457d5] focus-visible:ring-2 focus-visible:ring-[#3457d5]" aria-label={`${service.name} — რედაქტირება`} />}
      triggerLabel={<ServiceSummary service={service} />}
      title="სერვისის რედაქტირება"
      action={updateService.bind(null, service.id)}
      submitLabel="შენახვა"
      successMessage="შენახულია"
    >
      <Fields initial={service} />
    </FormDialog>
  );
}
