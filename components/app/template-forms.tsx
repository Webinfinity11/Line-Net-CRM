"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistTemplate, ChecklistTemplateItem } from "@/db/schema";
import { SYSTEM_LABELS, SYSTEM_ORDER } from "@/lib/i18n";

export function TemplateFields({ initial }: { initial?: Partial<ChecklistTemplate> & { items?: ChecklistTemplateItem[] } }) {
  const text = (initial?.items ?? []).map((i) => (i.required ? `* ${i.label}` : i.label)).join("\n");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tpl-name">სახელი *</Label>
        <Input id="tpl-name" name="name" required defaultValue={initial?.name ?? ""} placeholder="მაგ. სახანძრო სისტემის ყოველთვიური შემოწმება" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tpl-system">სისტემა *</Label>
        <NativeSelect id="tpl-system" name="systemType" defaultValue={initial?.systemType ?? "fire"}>
          {SYSTEM_ORDER.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {SYSTEM_LABELS[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2 pt-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault ?? false} className="accent-blue-600" /> ნაგულისხმევი ამ სისტემისთვის
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiresPhoto" defaultChecked={initial?.requiresPhoto ?? false} className="accent-blue-600" /> ჩაბარებისას ფოტო სავალდებულოა
        </label>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tpl-items">პუნქტები (თითო სტრიქონზე; სავალდებულო პუნქტს დაუწერეთ * წინ) *</Label>
        <Textarea id="tpl-items" name="itemsText" rows={10} required defaultValue={text} placeholder={"* პანელის მდგომარეობა\nბატარეების ძაბვა\n* დეტექტორების ტესტი"} />
      </div>
    </div>
  );
}
