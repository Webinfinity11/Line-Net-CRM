"use client";

import { DateTimeField } from "@/components/ui/date-field";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { formFields } from "@/components/app/section-card";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useSystems } from "@/components/app/systems-provider";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/db/schema";
import { PRIORITY_LABELS, TYPE_LABELS, t } from "@/lib/i18n";
import { toMtavruli } from "@/lib/mtavruli";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { canHandle, type Competencies } from "@/lib/competency-utils";
import { compareNames, toLocalInput } from "@/lib/order-utils";

export type ClientOption = { id: number; name: string; sites: { id: number; name: string; address: string | null }[] };
export type UserOption = { id: string; name: string; role: string; image?: string | null; competencies: Competencies; competenceLabel: string };

type Initial = Partial<
  Pick<
    Order,
    "title" | "description" | "type" | "priority" | "clientId" | "siteId" | "address" | "dueDate" | "amount" | "vatPercent" | "systemType" | "scheduledAt" | "warrantyMonths" | "plannedMinutes"
  >
> & {
  assigneeIds?: string[];
};

export function OrderForm({
  clients,
  users,
  amountFromItems = false,
  initial,
  action,
  submitLabel,
  cancelHref,
  compact = false,
}: {
  clients: ClientOption[];
  users: UserOption[];
  amountFromItems?: boolean;
  initial?: Initial;
  action: (fd: FormData) => Promise<ActionResult<{ id: number }> | ActionResult | undefined | void>;
  submitLabel: string;
  cancelHref: string;
  /** Triage mode: rare fields move behind a disclosure so an email becomes an order in a few decisions. */
  compact?: boolean;
}) {
  const router = useRouter();
  // a disabled category stays selectable on an order that already uses one, so saving does not silently drop it
  const systemOptions = useSystems().filter((s) => s.active || s.key === initial?.systemType);
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(initial?.clientId ? String(initial.clientId) : "");
  const [siteId, setSiteId] = useState(initial?.siteId ? String(initial.siteId) : "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [system, setSystem] = useState<string>(initial?.systemType ?? "");
  const [assignees, setAssignees] = useState<string[]>(initial?.assigneeIds ?? []);
  const sites = useMemo(() => clients.find((c) => String(c.id) === clientId)?.sites ?? [], [clients, clientId]);

  const sortedUsers = useMemo(() => users.filter(u =>
    initial?.assigneeIds?.includes(u.id) || (u.role === "executor" && canHandle(system, u.competencies))
  ).sort((a, b) => compareNames(a.name, b.name)), [users, system, initial?.assigneeIds]);

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
    <form onSubmit={onSubmit} className="grid items-start gap-4 pb-2 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card className="min-w-0">
        <CardContent className={`space-y-6 pt-6 ${formFields}`}>
          <Section title="სამუშაო">
            <Field className="sm:col-span-2" label={`${t.order.title} *`} htmlFor="title">
              <Input id="title" name="title" required minLength={2} defaultValue={initial?.title ?? ""} placeholder="მაგ. CCTV კამერის შეკეთება, მე-3 სართული" />
            </Field>
            <Field label={t.order.system} htmlFor="systemType">
              <NativeSelect id="systemType" name="systemType" value={system} onChange={(e) => {
                const next = e.target.value;
                setSystem(next);
                setAssignees(ids => ids.filter(id => initial?.assigneeIds?.includes(id) || users.some(u => u.id === id && u.role === "executor" && canHandle(next, u.competencies))));
              }}>
                <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
                {systemOptions.map((sys) => (
                  <NativeSelectOption key={sys.key} value={sys.key}>
                    {sys.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t.order.type} htmlFor="type">
              <NativeSelect id="type" name="type" defaultValue={initial?.type ?? "service"}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="sm:col-span-2" label={t.order.description} htmlFor="description">
              <Textarea id="description" name="description" rows={4} defaultValue={initial?.description ?? ""} placeholder="რა უნდა გაკეთდეს, დეტალები, კონტაქტი ობიექტზე…" />
            </Field>
          </Section>

          <Section title="ობიექტი">
            <Field label={t.order.client} htmlFor="clientId">
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
            </Field>
            <Field label={t.order.site} htmlFor="siteId" hint={clientId ? undefined : "ჯერ აირჩიეთ კლიენტი"}>
              <NativeSelect
                id="siteId"
                name="siteId"
                value={siteId}
                disabled={!clientId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  const site = sites.find((x) => String(x.id) === e.target.value);
                  if (site?.address) setAddress(site.address);
                }}
              >
                <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
                {sites.map((site) => (
                  <NativeSelectOption key={site.id} value={String(site.id)}>
                    {site.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="sm:col-span-2" label={t.order.address} htmlFor="address">
              <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ქუჩა, ნომერი, სართული" />
            </Field>
          </Section>

          <Section title="დრო და პრიორიტეტი" collapsible={compact} summary="დრო, პრიორიტეტი">
            <Field label={t.order.priority} htmlFor="priority">
              <NativeSelect id="priority" name="priority" defaultValue={initial?.priority ?? "normal"}>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t.order.scheduledAt} htmlFor="scheduledAt">
              <DateTimeField id="scheduledAt" name="scheduledAt" defaultValue={toLocalInput(initial?.scheduledAt)} />
            </Field>
          </Section>

          <Section title="ფინანსები" collapsible={compact} summary="თანხა">
            <Field label={`${t.order.amount} (₾)`} htmlFor="amount" hint={amountFromItems ? "ჯამი პოზიციებიდან ითვლება — ფასები შეცვალეთ შეკვეთის სერვისებში" : "სერვისების დამატებისას ჯამი ავტომატურად ითვლება"}>
              <Input readOnly={amountFromItems} id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={initial?.amount ?? ""} placeholder="0.00" />
            </Field>
          </Section>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-[84px]">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-heading text-[15px]">{toMtavruli(t.order.assignees)}</h3>
            <p className="mb-3 mt-1 text-[11.5px] text-muted-foreground">
              შემსრულებლის გარეშე დავალება გამოჩნდება შესაბამისი კომპეტენციის შემსრულებლების „ყველა დავალებაში“.
            </p>
            <div className="max-h-[320px] space-y-1 overflow-y-auto">
              {sortedUsers.map((u) => {
                const on = assignees.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[12px] border px-2.5 py-2 text-left text-[13px] transition-colors",
                      on ? "border-[#a5cdd1] dark:border-primary bg-accent" : "border-transparent hover:bg-[#f6fafb] dark:hover:bg-muted",
                    )}
                  >
                    <input type="checkbox" readOnly checked={on} className="size-4 accent-[#397b83]" />
                    <UserAvatar name={u.name} image={u.image} />
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    <span className="text-[11px] text-muted-foreground">{u.competenceLabel}</span>
                  </button>
                );
              })}
            </div>
            {assignees.length > 0 && <p className="mt-3 border-t border-[#eef1f6] dark:border-border pt-3 text-[11.5px] text-muted-foreground">არჩეულია {assignees.length}</p>}
          </CardContent>
        </Card>

        <div className="ln-card sticky bottom-[76px] z-20 flex gap-2 p-3 shadow-[0_-8px_28px_rgba(16,24,40,0.12)] lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
          <Button type="submit" className="h-12 flex-1 lg:h-10" disabled={pending}>
            {pending ? "ინახება…" : submitLabel}
          </Button>
          <Button type="button" variant="outline" className="h-12 lg:h-10" onClick={() => router.push(cancelHref)}>
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** A labelled group of fields. In triage mode the rare groups start folded. */
function Section({ title, summary, collapsible, children }: { title: string; summary?: string; collapsible?: boolean; children: React.ReactNode }) {
  const grid = <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
  if (collapsible) {
    return (
      <details className="rounded-[14px] border border-[#eef1f6] dark:border-border">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-[12.5px] font-medium text-primary">
          {title}
          {summary ? <span className="ml-1 font-normal text-muted-foreground">· {summary}</span> : null}
        </summary>
        <div className="px-3 pb-3">{grid}</div>
      </details>
    );
  }
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-heading text-[13px] font-semibold text-[#4a5e73] dark:text-[var(--ln-strong)]">{toMtavruli(title)}</legend>
      {grid}
    </fieldset>
  );
}

/** One field: label, control, optional hint. Controls always fill their cell so columns line up. */
function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
