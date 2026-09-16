"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignOrder } from "@/actions/plan";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { SystemType } from "@/db/schema";
import { SYSTEM_LABELS } from "@/lib/i18n";

export type ExecutorOption = { id: string; name: string; image?: string | null; specializations?: string[]; hours?: number };

export type AssignProps = {
  orderId: number;
  systemType?: SystemType | null;
  executors: ExecutorOption[];
  normHours: number;
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
 * specialization match, then by today's planned hours (least loaded first).
 */
export function AssignForm({ orderId, systemType, executors, normHours, defaultAssigneeId, defaultDate, defaultTime, defaultMinutes, onDone }: AssignProps) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, start] = useTransition();
  const sorted = useMemo(() => {
    const match = (u: ExecutorOption) => Boolean(systemType && u.specializations?.includes(systemType));
    return [...executors].sort((a, b) => Number(match(b)) - Number(match(a)) || (a.hours ?? 0) - (b.hours ?? 0) || a.name.localeCompare(b.name, "ka"));
  }, [executors, systemType]);
  const [assignee, setAssignee] = useState(defaultAssigneeId || sorted[0]?.id || "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "");
  const [minutes, setMinutes] = useState(String(defaultMinutes ?? 120));
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !assignee) return;
    busy.current = true;
    setError(null);
    const fd = new FormData();
    fd.set("assigneeId", assignee);
    fd.set("scheduledAt", date && time ? new Date(`${date}T${time}:00+04:00`).toISOString() : "");
    fd.set("plannedMinutes", minutes);
    start(async () => {
      try {
        const res = await assignOrder(orderId, fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const name = executors.find((u) => u.id === assignee)?.name ?? "";
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
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`as-who-${orderId}`} className="text-[12px] text-[#4a5e73]">
          ვინ
        </Label>
        <NativeSelect id={`as-who-${orderId}`} className="w-full" value={assignee} onChange={(e) => setAssignee(e.target.value)} required>
          <NativeSelectOption value="">აირჩიე შემსრულებელი</NativeSelectOption>
          {sorted.map((u) => (
            <NativeSelectOption key={u.id} value={u.id}>
              {u.name} · {u.hours ?? 0}/{normHours} სთ{systemType && u.specializations?.includes(systemType) ? ` · ${SYSTEM_LABELS[systemType]}` : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-[11px] text-muted-foreground">დღეს დაგეგმილი საათები · სპეციალობის შესაბამისობა პირველ ადგილზეა</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`as-date-${orderId}`} className="text-[12px] text-[#4a5e73]">
            როდის
          </Label>
          <Input id={`as-date-${orderId}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`as-time-${orderId}`} className="text-[12px] text-[#4a5e73]">
            დრო
          </Label>
          <Input id={`as-time-${orderId}`} type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[110px]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`as-min-${orderId}`} className="text-[12px] text-[#4a5e73]">
            რამდენ ხანს
          </Label>
          <NativeSelect id={`as-min-${orderId}`} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-[96px]">
            {DURATIONS.map((m) => (
              <NativeSelectOption key={m} value={String(m)}>
                {m < 60 ? `${m} წთ` : `${m / 60} სთ`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {error && (
        <p className="text-[12px] text-[#b13f32]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !assignee}>
          <UserPlus className="size-4" /> {pending ? "ინახება..." : "დანიშვნა"}
        </Button>
        <span className="text-[11px] text-muted-foreground">{time ? "სტატუსი, განრიგი და შეტყობინება ერთდროულად" : "დროის გარეშე მხოლოდ შემსრულებელი დაინიშნება"}</span>
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
