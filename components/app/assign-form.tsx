"use client";

import { DateField, TimeField } from "@/components/ui/date-field";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignOrder } from "@/actions/plan";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { SystemType } from "@/db/schema";
import { canHandle, type Competencies } from "@/lib/competency-utils";
import { compareNames } from "@/lib/order-utils";

export type ExecutorOption = { id: string; name: string; image?: string | null; competencies: Competencies; competenceLabel: string; hours?: number };

export type AssignProps = {
  orderId: number;
  systemType?: SystemType | null;
  executors: ExecutorOption[];
  normHours: number;
  assignedIds?: string[];
  defaultAssigneeId?: string | null;
  /** YYYY-MM-DD (Tbilisi) */
  defaultDate: string;
  /** "HH:MM" or null = no time yet */
  defaultTime?: string | null;
  defaultMinutes?: number | null;
  onDone?: () => void;
};

const DURATIONS = [30, 60, 90, 120, 180, 240, 480];

/**
 * The one assignment form: who, when, how long. Executors are ordered by
 * today's planned hours (least loaded first), within their competencies.
 */
export function AssignForm({ orderId, systemType, executors, normHours, assignedIds, defaultAssigneeId, defaultDate, defaultTime, defaultMinutes, onDone }: AssignProps) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const sorted = useMemo(() => {
    return executors.filter(u => u.id === defaultAssigneeId || assignedIds?.includes(u.id) || canHandle(systemType, u.competencies))
      .sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0) || compareNames(a.name, b.name));
  }, [executors, systemType, defaultAssigneeId, assignedIds]);
  const [assignee, setAssignee] = useState(defaultAssigneeId || sorted[0]?.id || "");
  const selectedId = sorted.some(u => u.id === assignee) ? assignee : "";
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "");
  const [minutes, setMinutes] = useState(String(defaultMinutes ?? 120));
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !selectedId) return;
    busy.current = true;
    setError(null);
    const fd = new FormData();
    fd.set("assigneeId", selectedId);
    fd.set("scheduledAt", date && time ? new Date(`${date}T${time}:00+04:00`).toISOString() : "");
    fd.set("plannedMinutes", minutes);
    start(async () => {
      try {
        const res = await assignOrder(orderId, fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const name = executors.find((u) => u.id === selectedId)?.name ?? "";
        toast.success(time ? `დანიშნულია: ${name}, ${date.split("-").reverse().join(".")} ${time}` : `დანიშნულია: ${name}`);
        if (res.data?.warning) toast.warning(res.data.warning);
        router.refresh();
        onDone?.();
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`as-who-${orderId}`} className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
          ვინ
        </Label>
        <NativeSelect id={`as-who-${orderId}`} className="w-full min-w-0 [&>select]:min-h-[44px]" value={selectedId} onChange={(e) => setAssignee(e.target.value)} required>
          <NativeSelectOption value="">აირჩიეთ შემსრულებელი</NativeSelectOption>
          {sorted.map((u) => (
            <NativeSelectOption key={u.id} value={u.id}>
              {u.name} · {u.hours ?? 0}/{normHours} სთ · {u.competenceLabel}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-[11px] text-muted-foreground">დაგეგმილი საათები · კატეგორიის შესაბამისი კომპეტენციები</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 min-w-0 space-y-1.5">
          <Label htmlFor={`as-date-${orderId}`} className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
            როდის
          </Label>
          <DateField id={`as-date-${orderId}`} className="min-h-[44px] w-full max-w-full" value={date} onChange={setDate} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`as-time-${orderId}`} className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
            დრო
          </Label>
          <TimeField id={`as-time-${orderId}`} value={time} onChange={setTime} className="min-h-[44px] w-full max-w-full" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`as-min-${orderId}`} className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
            რამდენ ხანს
          </Label>
          <NativeSelect id={`as-min-${orderId}`} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-full min-w-0 [&>select]:min-h-[44px]">
            {DURATIONS.map((m) => (
              <NativeSelectOption key={m} value={String(m)}>
                {m < 60 ? `${m} წთ` : `${m / 60} სთ`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {error && (
        <p className="text-[12px] text-[#b13f32] dark:text-[var(--ln-alert)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="min-h-[44px] w-full sm:w-auto" disabled={pending || !selectedId}>
          <UserPlus className="size-4" /> {pending ? "ინახება…" : "დანიშვნა"}
        </Button>
        <span className="text-[11px] text-muted-foreground">{time ? "შეინახება შემსრულებელი და დაგეგმილი დრო" : "დროის გარეშე მხოლოდ შემსრულებელი დაინიშნება"}</span>
      </div>
    </form>
  );
}

export function AssignDialog({
  title,
  label = "დანიშვნა",
  variant = "secondary",
  size = "sm",
  className,
  ...form
}: AssignProps & { title: string; label?: string; variant?: "default" | "secondary" | "outline" | "ghost"; size?: "xs" | "sm" | "default"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} className={className} />}>
        <UserPlus className="size-3.5" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-medium">დანიშვნა</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {open && <AssignForm {...form} onDone={() => { setOpen(false); form.onDone?.(); }} />}
      </DialogContent>
    </Dialog>
  );
}
