"use client";

import { formFields } from "@/components/app/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client, Site } from "@/db/schema";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "./location-picker";
import { cn } from "@/lib/utils";

export function ClientFields({ initial, withSites = false }: { initial?: Partial<Client>; withSites?: boolean }) {
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
      {withSites && (
        <div className="sm:col-span-2">
          <SiteRows />
        </div>
      )}
    </div>
  );
}

/**
 * Most Line Net clients are networks: a bank has branches, a clinic has locations.
 * Adding them here means the client is usable the moment it is saved.
 */
function SiteRows() {
  const [rows, setRows] = useState([0]);
  const [seq, setSeq] = useState(1);
  return (
    <div className="rounded-[14px] border border-[#eef1f6] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-heading text-[13px] font-semibold text-[#4a5e73]">ობიექტები</span>
        <span className="text-[11px] text-muted-foreground">ობიექტის პირი და ნომერი შეკვეთაზე ჩანს; კოორდინატები მისამართიდან მოიძებნება</span>
      </div>
      <div className="space-y-2">
        {rows.map((key, i) => (
          <div key={key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
            <Input name="siteName" placeholder={i === 0 ? "მაგ. ფილიალი ვაკე" : "ობიექტის სახელი"} aria-label="ობიექტის სახელი" />
            <Input name="siteAddress" placeholder="მისამართი" aria-label="მისამართი" />
            <Input name="siteContact" placeholder="საკონტაქტო პირი" aria-label="ობიექტის საკონტაქტო პირი" />
            <Input name="sitePhone" placeholder="ტელეფონი" aria-label="ობიექტის ტელეფონი" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="ობიექტის მოშორება"
              className="justify-self-end"
              disabled={rows.length === 1}
              onClick={() => setRows((r) => r.filter((x) => x !== key))}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => {
          setRows((r) => [...r, seq]);
          setSeq((n) => n + 1);
        }}
      >
        <Plus className="size-3.5" /> კიდევ ერთი ობიექტი
      </Button>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="site-contact">საკონტაქტო პირი ობიექტზე</Label>
          <Input id="site-contact" name="contactName" defaultValue={initial?.contactName ?? ""} placeholder="მაგ. ფილიალის მენეჯერი" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="site-phone">ტელეფონი</Label>
          <Input id="site-phone" name="contactPhone" defaultValue={initial?.contactPhone ?? ""} placeholder="5xx xx xx xx" />
        </div>
      </div>
      <LocationPicker lat={initial?.lat} lng={initial?.lng} />
      <div className="space-y-1.5">
        <Label htmlFor="site-notes">შენიშვნა</Label>
        <Textarea id="site-notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} placeholder="სართული, შესასვლელი, საკონტაქტო პირი ობიექტზე..." />
      </div>
    </div>
  );
}
