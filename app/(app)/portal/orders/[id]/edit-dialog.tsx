"use client";

import { useId, useState } from "react";
import { updatePortalOrder } from "@/actions/portal";
import { FormDialog } from "@/components/app/form-dialog";
import { formFields } from "@/components/app/section-card";
import { useActiveSystems } from "@/components/app/systems-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Site = { id: number; name: string; address: string | null };
type EditableOrder = { id: number; title: string; description: string | null; address: string | null; systemType: string | null; priority: string; site: { id: number } | null };

export function PortalOrderEditDialog({ order, sites }: { order: EditableOrder; sites: Site[] }) {
  return <FormDialog trigger={<Button type="button" variant="outline" className="mt-3" />}
    triggerLabel="რედაქტირება" title="განაცხადის რედაქტირება" successMessage="განაცხადი განახლდა"
    action={fd => updatePortalOrder(order.id, fd)}>
    <EditFields order={order} sites={sites} />
  </FormDialog>;
}

function EditFields({ order, sites }: { order: EditableOrder; sites: Site[] }) {
  const prefix = useId();
  const categories = useActiveSystems();
  const [siteId, setSiteId] = useState(String(order.site?.id ?? ""));
  const [address, setAddress] = useState(order.address ?? "");
  return <div className={`grid gap-3 ${formFields}`}>
    <div className="space-y-1.5">
      <Label htmlFor={`${prefix}-title`}>რა გჭირდებათ? *</Label>
      <Input id={`${prefix}-title`} name="title" required minLength={2} maxLength={200} defaultValue={order.title} />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor={`${prefix}-site`}>ობიექტი</Label>
      <NativeSelect id={`${prefix}-site`} name="siteId" value={siteId} onChange={event => {
        setSiteId(event.target.value);
        setAddress(sites.find(site => String(site.id) === event.target.value)?.address ?? "");
      }}>
        <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
        {sites.map(site => <NativeSelectOption key={site.id} value={String(site.id)}>{site.name}</NativeSelectOption>)}
      </NativeSelect>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor={`${prefix}-category`}>კატეგორია</Label>
      <NativeSelect id={`${prefix}-category`} name="systemType" defaultValue={order.systemType ?? ""}>
        <NativeSelectOption value="">— არ ვიცი —</NativeSelectOption>
        {order.systemType && !categories.some(category => category.key === order.systemType) && <NativeSelectOption value={order.systemType}>{order.systemType}</NativeSelectOption>}
        {categories.map(category => <NativeSelectOption key={category.key} value={category.key}>{category.name}</NativeSelectOption>)}
      </NativeSelect>
    </div>
    <div className="space-y-1.5">
      <Label htmlFor={`${prefix}-address`}>მისამართი{!siteId && " *"}</Label>
      <Input id={`${prefix}-address`} name="address" required={!siteId} maxLength={300} value={address} onChange={event => setAddress(event.target.value)} />
    </div>
    <div className="space-y-1.5">
      <Label htmlFor={`${prefix}-description`}>დეტალები</Label>
      <Textarea id={`${prefix}-description`} name="description" rows={4} maxLength={5000} defaultValue={order.description ?? ""} />
    </div>
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" name="urgent" defaultChecked={order.priority === "urgent"} className="size-4 accent-primary" /> სასწრაფოა
    </label>
  </div>;
}
