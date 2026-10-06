"use client";

import { formFields } from "@/components/app/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistTemplate, ChecklistTemplateItem } from "@/db/schema";
import type { SystemOption } from "@/lib/systems";
import { cn } from "@/lib/utils";

export function TemplateFields({ initial, systems }: { systems: SystemOption[]; initial?: Partial<ChecklistTemplate> & { items?: ChecklistTemplateItem[] } }) {
  const text = (initial?.items ?? []).map((i) => (i.required ? `* ${i.label}` : i.label)).join("\n");
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", formFields)}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tpl-name">სახელი *</Label>
        <Input id="tpl-name" name="name" required defaultValue={initial?.name ?? ""} placeholder="მაგ. სახანძრო სისტემის ყოველთვიური შემოწმება" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tpl-system">კატეგორია *</Label>
        <NativeSelect id="tpl-system" name="systemType" defaultValue={initial?.systemType ?? systems.find(s => s.active)?.key ?? ""}>
          {systems.map((s) => (
            <NativeSelectOption key={s.key} value={s.key}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2 pt-6 text-sm">
        <label className="flex min-h-[44px] items-center gap-2">
          <input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault ?? false} className="accent-[#3457d5]" /> ნაგულისხმევი ამ კატეგორიისთვის
        </label>

      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tpl-items">პუნქტები (თითო სტრიქონზე; სავალდებულო პუნქტს დაუწერეთ * წინ) *</Label>
        <Textarea id="tpl-items" name="itemsText" rows={10} required defaultValue={text} placeholder={"* პანელის მდგომარეობა\nბატარეების ძაბვა\n* დეტექტორების ტესტი"} />
      </div>
    </div>
  );
}

/** Row label for a template; lives in a client file so the dialog trigger's Mtavruli conversion leaves the name in Mkhedruli. */
export function TemplateSummary({ name, count, required, isDefault }: { name: string; count: number; required: number; isDefault: boolean }) {
  return (
    <>
      <span className="block break-words text-[14px] font-bold">{name}</span>
      <span className="block text-[12px] text-[#617084]">{count} პუნქტი · {required} სავალდებულო{isDefault ? " · ნაგულისხმევი" : ""}</span>
    </>
  );
}
