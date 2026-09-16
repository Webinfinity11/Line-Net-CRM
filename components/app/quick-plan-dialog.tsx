"use client";

import { CalendarPlus } from "lucide-react";
import { quickSchedule } from "@/actions/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormDialog } from "./form-dialog";

export function QuickPlanDialog({
  orderId,
  title,
  defaultDate,
  users,
  currentAssigneeId,
}: {
  orderId: number;
  title: string;
  defaultDate: string;
  users: { id: string; name: string }[];
  currentAssigneeId?: string | null;
}) {
  return (
    <FormDialog
      trigger={<Button size="sm" variant="outline" />}
      triggerLabel={
        <>
          <CalendarPlus className="size-3.5" /> დაგეგმვა
        </>
      }
      title="სწრაფი დაგეგმვა"
      description={title}
      action={quickSchedule.bind(null, orderId)}
      submitLabel="დაგეგმვა"
      successMessage="დაიგეგმა"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`qp-at-${orderId}`}>თარიღი და დრო</Label>
          <Input id={`qp-at-${orderId}`} name="scheduledAtLocal" type="datetime-local" required defaultValue={`${defaultDate}T10:00`} onChange={(e) => {
            const hidden = e.currentTarget.form?.elements.namedItem("scheduledAt") as HTMLInputElement | null;
            if (hidden) hidden.value = e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : "";
          }} />
          <input type="hidden" name="scheduledAt" defaultValue={new Date(`${defaultDate}T10:00`).toISOString()} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`qp-min-${orderId}`}>ხანგრძლივობა</Label>
          <NativeSelect id={`qp-min-${orderId}`} name="plannedMinutes" defaultValue="120">
            {[30, 60, 90, 120, 180, 240, 300, 360, 480].map((m) => (
              <NativeSelectOption key={m} value={String(m)}>
                {m < 60 ? `${m} წთ` : `${m / 60} სთ`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`qp-user-${orderId}`}>შემსრულებელი</Label>
          <NativeSelect id={`qp-user-${orderId}`} name="assigneeId" defaultValue={currentAssigneeId ?? ""}>
            <NativeSelectOption value="">— უცვლელი —</NativeSelectOption>
            {users.map((u) => (
              <NativeSelectOption key={u.id} value={u.id}>
                {u.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    </FormDialog>
  );
}
