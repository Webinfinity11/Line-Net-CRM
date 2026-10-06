"use client";

import { DateField, TimeField } from "@/components/ui/date-field";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignMany } from "@/actions/plan";
import type { ExecutorOption } from "@/components/app/assign-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { canHandle } from "@/lib/competency-utils";
import { compareNames } from "@/lib/order-utils";

const DURATIONS = [30, 60, 90, 120, 180, 240, 480];

/** Same who / when / how long fields as AssignForm, applied to every selected order. */
export function BulkAssignDialog({
  open,
  onOpenChange,
  orderIds,
  systemTypes,
  executors,
  normHours,
  defaultDate,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderIds: number[];
  systemTypes: (string | null)[];
  executors: ExecutorOption[];
  normHours: number;
  defaultDate: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const sorted = useMemo(() => executors.filter(u => systemTypes.every(system => canHandle(system, u.competencies))).sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0) || compareNames(a.name, b.name)), [executors, systemTypes]);
  const [assignee, setAssignee] = useState("");
  const selectedId = sorted.some(u => u.id === assignee) ? assignee : "";
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState("120");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !selectedId || orderIds.length === 0) return;
    busy.current = true;
    setError(null);
    const fd = new FormData();
    fd.set("assigneeId", selectedId);
    fd.set("scheduledAt", date && time ? new Date(`${date}T${time}:00+04:00`).toISOString() : "");
    fd.set("plannedMinutes", minutes);
    start(async () => {
      try {
        const res = await assignMany(orderIds, fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const name = executors.find((u) => u.id === selectedId)?.name ?? "";
        toast.success(`დაინიშნა ${res.data?.assigned ?? 0} შეკვეთა: ${name}`);
        if (res.data?.skipped) toast.warning(`${res.data.skipped} შეკვეთა გამოტოვებულია (დახურული ან გაუქმებული)`);
        router.refresh();
        onDone();
        onOpenChange(false);
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-medium">ჯგუფური დანიშვნა</DialogTitle>
          <DialogDescription>არჩეულია {orderIds.length} შეკვეთა</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-who" className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
              ვინ
            </Label>
            <NativeSelect id="bulk-who" className="w-full" value={selectedId} onChange={(e) => setAssignee(e.target.value)} required>
              <NativeSelectOption value="">აირჩიეთ შემსრულებელი</NativeSelectOption>
              {sorted.map((u) => (
                <NativeSelectOption key={u.id} value={u.id}>
                  {u.name} · {u.hours ?? 0}/{normHours} სთ · {u.competenceLabel}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1">
              <Label htmlFor="bulk-date" className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
                როდის
              </Label>
              <DateField id="bulk-date" value={date} onChange={setDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-time" className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
                დრო
              </Label>
              <TimeField id="bulk-time" value={time} onChange={setTime} className="w-[110px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-min" className="text-[12px] text-[#4a5e73] dark:text-[var(--ln-strong)]">
                რამდენ ხანს
              </Label>
              <NativeSelect id="bulk-min" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-[96px]">
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
            <Button type="submit" disabled={pending || !selectedId}>
              <UserPlus className="size-4" /> {pending ? "ინახება…" : "დანიშვნა"}
            </Button>
            <span className="text-[11px] text-muted-foreground">{time ? "ყველა არჩეულ შეკვეთას ერთი დრო დაენიშნება" : "დროის გარეშე მხოლოდ შემსრულებელი დაინიშნება"}</span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
