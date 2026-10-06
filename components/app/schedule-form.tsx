"use client";

import { DateField } from "@/components/ui/date-field";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceSchedule } from "@/db/schema";
import { FREQUENCY_LABELS } from "@/lib/i18n";
import { useSystems } from "@/components/app/systems-provider";
import { canHandle, type Competencies } from "@/lib/competency-utils";
import { UserAvatar } from "./user-avatar";

export function ScheduleFields({
  clients,
  users,
  initial,
}: {
  clients: { id: number; name: string; sites: { id: number; name: string }[] }[];
  users: { id: string; name: string; image?: string | null; role: string; competencies: Competencies; competenceLabel: string }[];
  initial?: Partial<ServiceSchedule>;
}) {
  const [clientId, setClientId] = useState(initial?.clientId ? String(initial.clientId) : "");
  const systemOptions = useSystems().filter((s) => s.active || s.key === initial?.systemType);
  const [system, setSystem] = useState<string>(initial?.systemType ?? systemOptions[0]?.key ?? "");
  const [assigneeIds, setAssigneeIds] = useState(initial?.assigneeIds ?? []);
  const candidates = users.filter(u => initial?.assigneeIds?.includes(u.id) || (u.role === "executor" && canHandle(system, u.competencies)));
  const sites = useMemo(() => clients.find((c) => String(c.id) === clientId)?.sites ?? [], [clients, clientId]);

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
          <NativeSelectOption value="">— ობიექტის გარეშე —</NativeSelectOption>
          {sites.map((s) => (
            <NativeSelectOption key={s.id} value={String(s.id)}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-system">კატეგორია *</Label>
        <NativeSelect id="s-system" name="systemType" value={system} onChange={(e) => {
          const next = e.target.value;
          setSystem(next);
          setAssigneeIds(ids => ids.filter(id => initial?.assigneeIds?.includes(id) || users.some(u => u.id === id && u.role === "executor" && canHandle(next, u.competencies))));
        }}>
          {systemOptions.map((sys) => (
            <NativeSelectOption key={sys.key} value={sys.key}>
              {sys.name}
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
        <DateField id="s-next" name="nextDate" required defaultValue={initial?.nextDate ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-lead">შეკვეთა შეიქმნას (დღით ადრე)</Label>
        <Input id="s-lead" name="leadDays" type="number" min="0" max="60" defaultValue={initial?.leadDays ?? 7} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-amount">თანხა (₾)</Label>
        <Input id="s-amount" name="amount" type="number" step="0.01" min="0" defaultValue={initial?.amount ?? ""} />
      </div>
      
      <div className="space-y-1.5 sm:col-span-2">
        <Label>ნაგულისხმევი შემსრულებლები</Label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
          {candidates.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="assigneeIds" value={u.id} checked={assigneeIds.includes(u.id)} onChange={e => setAssigneeIds(ids => e.target.checked ? [...ids, u.id] : ids.filter(id => id !== u.id))} className="accent-primary" />
              <UserAvatar name={u.name} image={u.image} />
              {u.name}
              <span className="text-[11px] text-muted-foreground">{u.competenceLabel}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
