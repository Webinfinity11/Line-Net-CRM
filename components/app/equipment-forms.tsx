"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { SiteEquipment } from "@/db/schema";
import { SYSTEM_LABELS, SYSTEM_ORDER } from "@/lib/i18n";

export function EquipmentFields({ siteId, initial }: { siteId: number; initial?: Partial<SiteEquipment> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="siteId" value={siteId} />
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="e-name">მოწყობილობა *</Label>
        <Input id="e-name" name="name" required defaultValue={initial?.name ?? ""} placeholder="მაგ. სახანძრო პანელი, IP კამერა" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-system">სისტემა</Label>
        <NativeSelect id="e-system" name="systemType" defaultValue={initial?.systemType ?? ""}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {SYSTEM_ORDER.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {SYSTEM_LABELS[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-qty">რაოდენობა</Label>
        <Input id="e-qty" name="quantity" type="number" min="1" defaultValue={initial?.quantity ?? 1} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-model">მოდელი</Label>
        <Input id="e-model" name="model" defaultValue={initial?.model ?? ""} placeholder="მაგ. Hikvision DS-2CD2043" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-serial">სერიული ნომერი</Label>
        <Input id="e-serial" name="serial" defaultValue={initial?.serial ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-inst">მონტაჟის თარიღი</Label>
        <Input id="e-inst" name="installedAt" type="date" defaultValue={initial?.installedAt ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="e-war">გარანტია (მდე)</Label>
        <Input id="e-war" name="warrantyUntil" type="date" defaultValue={initial?.warrantyUntil ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="e-notes">შენიშვნა</Label>
        <Textarea id="e-notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
      </div>
    </div>
  );
}
