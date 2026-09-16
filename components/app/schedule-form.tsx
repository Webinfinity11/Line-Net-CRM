"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceSchedule } from "@/db/schema";
import { FREQUENCY_LABELS, SYSTEM_LABELS, SYSTEM_ORDER } from "@/lib/i18n";
import { UserAvatar } from "./user-avatar";

export function ScheduleFields({
  clients,
  users,
  templates,
  initial,
}: {
  clients: { id: number; name: string; sites: { id: number; name: string }[] }[];
  users: { id: string; name: string; image?: string | null; specializations?: string[] }[];
  templates: { id: number; name: string; systemType: string }[];
  initial?: Partial<ServiceSchedule>;
}) {
  const [clientId, setClientId] = useState(initial?.clientId ? String(initial.clientId) : "");
  const [system, setSystem] = useState(initial?.systemType ?? "fire");
  const sites = useMemo(() => clients.find((c) => String(c.id) === clientId)?.sites ?? [], [clients, clientId]);
  const tpls = templates.filter((x) => x.systemType === system);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="s-client">კლიენტი *</Label>
        <NativeSelect id="s-client" name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
          {clients.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-site">ობიექტი</Label>
        <NativeSelect id="s-site" name="siteId" defaultValue={initial?.siteId ? String(initial.siteId) : ""} disabled={!clientId}>
          <NativeSelectOption value="">— ყველა / არ არის —</NativeSelectOption>
          {sites.map((s) => (
            <NativeSelectOption key={s.id} value={String(s.id)}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-system">სისტემა *</Label>
        <NativeSelect id="s-system" name="systemType" value={system} onChange={(e) => setSystem(e.target.value as typeof system)}>
          {SYSTEM_ORDER.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {SYSTEM_LABELS[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-freq">სიხშირე *</Label>
        <NativeSelect id="s-freq" name="frequency" defaultValue={initial?.frequency ?? "monthly"}>
          {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>
              {v}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="s-title">შეკვეთის სათაური *</Label>
        <Input id="s-title" name="title" required defaultValue={initial?.title ?? ""} placeholder="მაგ. სახანძრო სისტემის ყოველთვიური შემოწმება" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="s-desc">აღწერა</Label>
        <Textarea id="s-desc" name="description" rows={2} defaultValue={initial?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-next">შემდეგი თარიღი *</Label>
        <Input id="s-next" name="nextDate" type="date" required defaultValue={initial?.nextDate ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-lead">შეკვეთა შეიქმნას (დღით ადრე)</Label>
        <Input id="s-lead" name="leadDays" type="number" min="0" max="60" defaultValue={initial?.leadDays ?? 7} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-amount">თანხა (₾)</Label>
        <Input id="s-amount" name="amount" type="number" step="0.01" min="0" defaultValue={initial?.amount ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-tpl">ჩეკ-ლისტი</Label>
        <NativeSelect id="s-tpl" name="checklistTemplateId" defaultValue={initial?.checklistTemplateId ? String(initial.checklistTemplateId) : ""}>
          <NativeSelectOption value="">ნაგულისხმევი სისტემისთვის</NativeSelectOption>
          {tpls.map((x) => (
            <NativeSelectOption key={x.id} value={String(x.id)}>
              {x.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>ნაგულისხმევი შემსრულებლები</Label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
          {users.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="assigneeIds" value={u.id} defaultChecked={initial?.assigneeIds?.includes(u.id)} className="accent-blue-600" />
              <UserAvatar name={u.name} image={u.image} />
              {u.name}
              {u.specializations?.includes(system) && <span className="text-[11px] text-emerald-600">სპეც.</span>}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
