"use client";

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
import type { Order } from "@/db/schema";
import { PAYMENT_LABELS, PRIORITY_LABELS, ROLE_LABELS, TYPE_LABELS, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

export type ClientOption = { id: number; name: string; sites: { id: number; name: string; address: string | null }[] };
export type UserOption = { id: string; name: string; role: string; image?: string | null };

type Initial = Partial<Pick<Order, "title" | "description" | "type" | "priority" | "clientId" | "siteId" | "address" | "dueDate" | "amount" | "paymentStatus">> & {
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
  const [assignees, setAssignees] = useState<string[]>(initial?.assigneeIds ?? []);
  const sites = useMemo(() => clients.find((c) => String(c.id) === clientId)?.sites ?? [], [clients, clientId]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("assignees");
    for (const id of assignees) fd.append("assignees", id);
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
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">{t.order.title} *</Label>
            <Input id="title" name="title" required minLength={2} defaultValue={initial?.title ?? ""} placeholder="მაგ. CCTV კამერის შეკეთება, მე-3 სართული" />
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
            <Textarea id="description" name="description" rows={6} defaultValue={initial?.description ?? ""} placeholder="რა უნდა გაკეთდეს, დეტალები, კონტაქტი ობიექტზე..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">{t.order.dueDate}</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={initial?.dueDate ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">{t.order.amount} (₾)</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={initial?.amount ?? ""} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paymentStatus">{t.order.paymentStatus}</Label>
            <NativeSelect id="paymentStatus" name="paymentStatus" defaultValue={initial?.paymentStatus ?? "unpaid"}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <Label className="mb-2 block">{t.order.assignees}</Label>
            <p className="mb-3 text-xs text-muted-foreground">აირჩიეთ ერთი ან რამდენიმე. დანიშვნისას სტატუსი ავტომატურად ხდება „დანიშნული“.</p>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {users.map((u) => {
                const on = assignees.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                      on ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30" : "hover:bg-neutral-50 dark:hover:bg-neutral-800",
                    )}
                  >
                    <input type="checkbox" readOnly checked={on} className="accent-sky-600" />
                    <UserAvatar name={u.name} image={u.image} />
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="text-[11px] text-muted-foreground">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 bg-sky-600 hover:bg-sky-700" disabled={pending}>
            {pending ? "ინახება..." : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </form>
  );
}
