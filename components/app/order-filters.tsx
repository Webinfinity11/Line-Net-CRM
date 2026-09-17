"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, SYSTEM_LABELS, SYSTEM_ORDER, TYPE_LABELS, t } from "@/lib/i18n";

type Values = { q: string; status: string; type: string; priority: string; system: string; assignee: string; client: string; overdue: string; view: string; sort?: string };

export function OrderFilters({
  users,
  clients,
  values,
}: {
  users: { id: string; name: string }[];
  clients: { id: number; name: string }[];
  values: Values;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const hasFilters = Boolean(values.q || values.type || values.priority || values.system || values.assignee || values.client || values.overdue || (values.status && values.status !== "active"));

  return (
    <form ref={formRef} method="get" action="/orders" className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e6ebf2] bg-white p-3 dark:bg-neutral-900">
      {values.view === "kanban" && <input type="hidden" name="view" value="kanban" />}
      {values.sort && <input type="hidden" name="sort" value={values.sort} />}
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={values.q}
          placeholder={t.common.search}
          className="h-9 w-full rounded-lg border border-[#e6ebf2] bg-[#f8faff] pl-8 pr-3 text-[13px] outline-none focus:border-[#7f97e6] dark:bg-neutral-800"
        />
      </div>
      {values.view !== "kanban" && (
        <NativeSelect name="status" defaultValue={values.status} onChange={submit} className="h-9 w-auto text-sm">
          <NativeSelectOption value="active">აქტიური</NativeSelectOption>
          <NativeSelectOption value="all">{t.common.all}</NativeSelectOption>
          {STATUS_ORDER.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {STATUS_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <NativeSelect name="type" defaultValue={values.type} onChange={submit} className="h-9 w-auto text-sm">
        <NativeSelectOption value="">{t.order.type}: {t.common.all}</NativeSelectOption>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <NativeSelectOption key={k} value={k}>
            {v}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="system" defaultValue={values.system} onChange={submit} className="h-9 w-auto max-w-[220px] text-sm">
        <NativeSelectOption value="">{t.order.system}: {t.common.all}</NativeSelectOption>
        {SYSTEM_ORDER.map((k) => (
          <NativeSelectOption key={k} value={k}>
            {SYSTEM_LABELS[k]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="priority" defaultValue={values.priority} onChange={submit} className="h-9 w-auto text-sm">
        <NativeSelectOption value="">{t.order.priority}: {t.common.all}</NativeSelectOption>
        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
          <NativeSelectOption key={k} value={k}>
            {v}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="assignee" defaultValue={values.assignee} onChange={submit} className="h-9 w-auto max-w-[200px] text-sm">
        <NativeSelectOption value="">{t.order.assignees}: {t.common.all}</NativeSelectOption>
        {users.map((u) => (
          <NativeSelectOption key={u.id} value={u.id}>
            {u.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="client" defaultValue={values.client} onChange={submit} className="h-9 w-auto max-w-[220px] text-sm">
        <NativeSelectOption value="">{t.order.client}: {t.common.all}</NativeSelectOption>
        {clients.map((c) => (
          <NativeSelectOption key={c.id} value={String(c.id)}>
            {c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm">
        <input type="checkbox" name="overdue" value="1" defaultChecked={values.overdue === "1"} onChange={submit} className="accent-rose-600" />
        {t.order.overdue}
      </label>
      <Button type="submit" size="sm" variant="secondary">
        {t.common.search}
      </Button>
      {hasFilters && (
        <Button type="button" size="sm" variant="ghost" onClick={() => router.push(values.view === "kanban" ? "/orders?view=kanban" : "/orders")}>
          <X className="size-3.5" /> გასუფთავება
        </Button>
      )}
    </form>
  );
}
