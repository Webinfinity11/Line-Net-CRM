"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, TYPE_LABELS, t } from "@/lib/i18n";
import { useSystems } from "@/components/app/systems-provider";

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
  const systemOptions = useSystems();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const hasFilters = Boolean(values.type || values.priority || values.system || values.assignee || values.client || values.overdue || (values.status && values.status !== "active"));

  return (
    <form ref={formRef} method="get" action="/orders" onSubmit={event => {
      event.preventDefault();
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(event.currentTarget)) {
        if (typeof value === "string" && value) params.set(key, value);
      }
      router.push(`/orders${params.size ? `?${params}` : ""}`, { scroll: false });
    }} className="max-md:[&>div]:w-full max-md:[&>div]:max-w-none max-md:[&_select]:h-11 max-md:[&_input]:min-h-[44px] max-md:[&_button]:min-h-[44px] max-md:[&>label]:min-h-[44px] flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 dark:bg-neutral-900">
      {values.view === "kanban" && <input type="hidden" name="view" value="kanban" />}
      {values.view === "kanban" && <input type="hidden" name="status" value={values.status} />}
      {values.sort && <input type="hidden" name="sort" value={values.sort} />}
      <input type="hidden" name="q" value={values.q} />
      {["manager", "payment", "month"].map(key => searchParams.get(key) ? <input key={key} type="hidden" name={key} value={searchParams.get(key)!} /> : null)}
      {values.view !== "kanban" && (
        <NativeSelect name="status" defaultValue={values.status} onChange={submit} className="h-11 w-auto text-sm">
          <NativeSelectOption value="active">აქტიური</NativeSelectOption>
          <NativeSelectOption value="all">{t.common.all}</NativeSelectOption>
          {STATUS_ORDER.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {STATUS_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <NativeSelect name="type" defaultValue={values.type} onChange={submit} className="h-11 w-auto text-sm">
        <NativeSelectOption value="">{t.order.type}: {t.common.all}</NativeSelectOption>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <NativeSelectOption key={k} value={k}>
            {v}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="system" defaultValue={values.system} onChange={submit} className="h-11 w-auto max-w-[220px] text-sm">
        <NativeSelectOption value="">{t.order.system}: {t.common.all}</NativeSelectOption>
        {systemOptions.map((sys) => (
          <NativeSelectOption key={sys.key} value={sys.key}>
            {sys.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="priority" defaultValue={values.priority} onChange={submit} className="h-11 w-auto text-sm">
        <NativeSelectOption value="">{t.order.priority}: {t.common.all}</NativeSelectOption>
        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
          <NativeSelectOption key={k} value={k}>
            {v}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="assignee" defaultValue={values.assignee} onChange={submit} className="h-11 w-auto max-w-[200px] text-sm">
        <NativeSelectOption value="">{t.order.assignees}: {t.common.all}</NativeSelectOption>
        {users.map((u) => (
          <NativeSelectOption key={u.id} value={u.id}>
            {u.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="client" defaultValue={values.client} onChange={submit} className="h-11 w-auto max-w-[220px] text-sm">
        <NativeSelectOption value="">{t.order.client}: {t.common.all}</NativeSelectOption>
        {clients.map((c) => (
          <NativeSelectOption key={c.id} value={String(c.id)}>
            {c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <label className="flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm">
        <input type="checkbox" name="overdue" value="1" defaultChecked={values.overdue === "1"} onChange={submit} className="accent-[#b13f32]" />
        {t.order.overdue}
      </label>
      {hasFilters && (
        <Button type="button" size="sm" variant="ghost" className="h-11" onClick={() => {
          const params = new URLSearchParams();
          for (const key of ["q", "sort", "view", "manager", "payment"]) {
            const value = searchParams.get(key);
            if (value) params.set(key, value);
          }
          router.push(`/orders${params.size ? `?${params}` : ""}`);
        }}>
          <X className="size-3.5" /> გასუფთავება
        </Button>
      )}
    </form>
  );
}
