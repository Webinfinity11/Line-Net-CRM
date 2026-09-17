"use client";

import { Pencil, Plus } from "lucide-react";
import { createService, updateService } from "@/actions/services";
import { FormDialog } from "@/components/app/form-dialog";
import { formFields } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useActiveSystems } from "@/components/app/systems-provider";
import { Textarea } from "@/components/ui/textarea";
import type { Service } from "@/db/schema";
import { SYSTEM_LABELS } from "@/lib/i18n";

const UNITS = ["ცალი", "მეტრი", "წერტილი", "საათი", "კომპლექტი", "მ²"];

function Fields({ initial }: { initial?: Service }) {
  const systemOptions = useActiveSystems();
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${formFields}`}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="s-name">დასახელება</Label>
        <Input id="s-name" name="name" required minLength={2} maxLength={200} defaultValue={initial?.name} placeholder="მაგ. კამერის მონტაჟი" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-system">სისტემა</Label>
        <NativeSelect id="s-system" name="systemType" defaultValue={initial?.systemType ?? ""} className="w-full">
          <NativeSelectOption value="">— ყველა —</NativeSelectOption>
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

export function NewServiceDialog() {
  return (
    <FormDialog
      trigger={<Button />}
      triggerLabel={
        <>
          <Plus className="size-4" /> ახალი სერვისი
        </>
      }
      title="ახალი სერვისი"
      action={createService}
      submitLabel="შენახვა"
      successMessage="სერვისი დაემატა"
    >
      <Fields />
    </FormDialog>
  );
}

export function EditServiceDialog({ service }: { service: Service }) {
  return (
    <FormDialog
      trigger={<Button variant="outline" size="sm" />}
      triggerLabel={
        <>
          <Pencil className="size-3.5" /> რედაქტირება
        </>
      }
      title="სერვისის რედაქტირება"
      action={updateService.bind(null, service.id)}
      submitLabel="შენახვა"
      successMessage="შენახულია"
    >
      <Fields initial={service} />
    </FormDialog>
  );
}
