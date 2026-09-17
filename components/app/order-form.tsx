"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Order, SystemType } from "@/db/schema";
import { PRIORITY_LABELS, ROLE_LABELS, SYSTEM_LABELS, SYSTEM_ORDER, TYPE_LABELS, t } from "@/lib/i18n";
import { toLocalInput } from "@/lib/order-utils";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

export type ClientOption = { id: number; name: string; sites: { id: number; name: string; address: string | null }[] };
export type UserOption = { id: string; name: string; role: string; image?: string | null; specializations?: string[] };

type Initial = Partial<
  Pick<
    Order,
    "title" | "description" | "type" | "priority" | "clientId" | "siteId" | "address" | "dueDate" | "amount" | "systemType" | "scheduledAt" | "warrantyMonths" | "plannedMinutes" | "requiresPhoto"
  >
> & {
  assigneeIds?: string[];
};

export function OrderForm({
  clients,
  users,
  initial,
  action,
  submitLabel,
  cancelHref,
}: {
  clients: ClientOption[];
  users: UserOption[];
  initial?: Initial;
  action: (fd: FormData) => Promise<ActionResult<{ id: number }> | ActionResult | undefined | void>;
  submitLabel: string;
  cancelHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(initial?.clientId ? String(initial.clientId) : "");
  const [siteId, setSiteId] = useState(initial?.siteId ? String(initial.siteId) : "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [system, setSystem] = useState<string>(initial?.systemType ?? "");
  const [assignees, setAssignees] = useState<string[]>(initial?.assigneeIds ?? []);
  const sites = useMemo(() => clients.find((c) => String(c.id) === clientId)?.sites ?? [], [clients, clientId]);

  const matches = (u: UserOption) => Boolean(system && u.specializations?.includes(system));
  const sortedUsers = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => Number(matches(b)) - Number(matches(a)) || a.name.localeCompare(b.name, "ka"));
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, system]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("assignees");
    for (const id of assignees) fd.append("assignees", id);
    const sched = String(fd.get("scheduledAt") ?? "");
    if (sched) fd.set("scheduledAt", new Date(sched).toISOString());
    start(async () => {
      const res = await action(fd);
      if (res && !res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("შენახულია");
      router.push(cancelHref);
      router.refresh();
    });
  }

  const toggle = (id: string) => setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <form onSubmit={onSubmit} className="grid gap-4 pb-2 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">{t.order.title} *</Label>
            <Input id="title" name="title" required minLength={2} defaultValue={initial?.title ?? ""} placeholder="მაგ. CCTV კამერის შეკეთება, მე-3 სართული" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="systemType">{t.order.system}</Label>
            <NativeSelect id="systemType" name="systemType" value={system} onChange={(e) => setSystem(e.target.value)}>
              <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
              {SYSTEM_ORDER.map((k: SystemType) => (
                <NativeSelectOption key={k} value={k}>
                  {SYSTEM_LABELS[k]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">{t.order.type}</Label>
            <NativeSelect id="type" name="type" defaultValue={initial?.type ?? "service"}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientId">{t.order.client}</Label>
            <NativeSelect
              id="clientId"
              name="clientId"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setSiteId("");
              }}
            >
              <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
              {clients.map((c) => (
                <NativeSelectOption key={c.id} value={String(c.id)}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteId">{t.order.site}</Label>
            <NativeSelect
              id="siteId"
              name="siteId"
              value={siteId}
              disabled={!clientId}
              onChange={(e) => {
                setSiteId(e.target.value);
                const s = sites.find((x) => String(x.id) === e.target.value);
                if (s?.address) setAddress(s.address);
              }}
            >
              <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
              {sites.map((s) => (
                <NativeSelectOption key={s.id} value={String(s.id)}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">{t.order.address}</Label>
            <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ქუჩა, ნომერი, სართული" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">{t.order.description}</Label>
            <Textarea id="description" name="description" rows={5} defaultValue={initial?.description ?? ""} placeholder="რა უნდა გაკეთდეს, დეტალები, კონტაქტი ობიექტზე..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">{t.order.priority}</Label>
            <NativeSelect id="priority" name="priority" defaultValue={initial?.priority ?? "normal"}>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduledAt">{t.order.scheduledAt}</Label>
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" defaultValue={toLocalInput(initial?.scheduledAt)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plannedMinutes">დაგეგმილი ხანგრძლივობა (წუთი)</Label>
            <NativeSelect id="plannedMinutes" name="plannedMinutes" defaultValue={initial?.plannedMinutes ? String(initial.plannedMinutes) : ""}>
              <NativeSelectOption value="">— (ნაგულისხმევი 2 სთ)</NativeSelectOption>
              {[30, 60, 90, 120, 180, 240, 300, 360, 480].map((m) => (
                <NativeSelectOption key={m} value={String(m)}>
                  {m < 60 ? `${m} წთ` : `${m / 60} სთ`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">{t.order.dueDate}</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={initial?.dueDate ?? ""} />
            <p className="text-[11px] text-muted-foreground">ცარიელი დატოვებისას დაგეგმილი დღე გამოიყენება</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">{t.order.amount} (₾)</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={initial?.amount ?? ""} placeholder="0.00" />
            <p className="text-[11px] text-muted-foreground">გადახდები შეკვეთის ბარათზე იწერება; სტატუსი ავტომატურად ითვლება</p>
          </div>
          <div className="flex items-center gap-2 self-end pb-2">
            <input id="requiresPhoto" name="requiresPhoto" type="checkbox" defaultChecked={Boolean(initial?.requiresPhoto)} className="size-4 accent-blue-600" />
            <Label htmlFor="requiresPhoto">ჩაბარებისას ფოტო სავალდებულოა</Label>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <Label className="mb-2 block">{t.order.assignees}</Label>
            <p className="mb-3 text-xs text-muted-foreground">
              აირჩიეთ ერთი ან რამდენიმე. {system ? "შესაბამისი სპეციალიზაციის ხალხი ზემოთაა." : "სისტემის არჩევისას შესაბამისი ხალხი ზემოთ დადგება."}
            </p>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {sortedUsers.map((u) => {
                const on = assignees.includes(u.id);
                const fit = matches(u);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                      on ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-neutral-50 dark:hover:bg-neutral-800",
                    )}
                  >
                    <input type="checkbox" readOnly checked={on} className="accent-blue-600" />
                    <UserAvatar name={u.name} image={u.image} />
                    <span className="flex-1 truncate">{u.name}</span>
                    {fit && (
                      <span title="შესაბამისი სპეციალიზაცია" className="text-[#25815a]">
                        <BadgeCheck className="size-4" />
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <div className="ln-card sticky bottom-[76px] z-20 flex gap-2 p-3 shadow-[0_-8px_28px_rgba(16,24,40,0.12)] lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
          <Button type="submit" className="h-12 flex-1 lg:h-9" disabled={pending}>
            {pending ? "ინახება..." : submitLabel}
          </Button>
          <Button type="button" variant="outline" className="h-12 lg:h-9" onClick={() => router.push(cancelHref)}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </form>
  );
}
