"use client";

import { formFields } from "@/components/app/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client, Site } from "@/db/schema";
import { LocationPicker } from "./location-picker";
import { cn } from "@/lib/utils";

export function ClientFields({ initial }: { initial?: Partial<Client> }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", formFields)}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">კომპანია *</Label>
        <Input id="name" name="name" required defaultValue={initial?.name ?? ""} placeholder="შპს ..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idCode">საიდენტიფიკაციო კოდი</Label>
        <Input id="idCode" name="idCode" defaultValue={initial?.idCode ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contactName">საკონტაქტო პირი</Label>
        <Input id="contactName" name="contactName" defaultValue={initial?.contactName ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">ტელეფონი</Label>
        <Input id="phone" name="phone" defaultValue={initial?.phone ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">ელფოსტა</Label>
        <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes">შენიშვნა</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
      </div>
    </div>
  );
}

export function SiteFields({ clientId, initial }: { clientId: number; initial?: Partial<Site> }) {
  return (
    <div className={cn("grid gap-3", formFields)}>
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-1.5">
        <Label htmlFor="site-name">ობიექტის სახელი *</Label>
        <Input id="site-name" name="name" required defaultValue={initial?.name ?? ""} placeholder="მაგ. ფილიალი ვაკე" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="site-address">მისამართი</Label>
        <Input id="site-address" name="address" defaultValue={initial?.address ?? ""} placeholder="ქუჩა, ნომერი" />
      </div>
      <LocationPicker lat={initial?.lat} lng={initial?.lng} />
      <div className="space-y-1.5">
        <Label htmlFor="site-notes">შენიშვნა</Label>
        <Textarea id="site-notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} placeholder="სართული, შესასვლელი, საკონტაქტო პირი ობიექტზე..." />
      </div>
    </div>
  );
}
