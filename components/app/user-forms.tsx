"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { User } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/i18n";

export function UserFields({ initial }: { initial?: Partial<User> }) {
  const editing = Boolean(initial?.id);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="u-name">სახელი, გვარი *</Label>
        <Input id="u-name" name="name" required defaultValue={initial?.name ?? ""} />
      </div>
      {!editing && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="u-email">ელფოსტა *</Label>
          <Input id="u-email" name="email" type="email" required placeholder="name@line-net.ge" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="u-role">როლი</Label>
        <NativeSelect id="u-role" name="role" defaultValue={initial?.role ?? "executor"}>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <NativeSelectOption key={k} value={k}>
              {v}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="u-phone">ტელეფონი</Label>
        <Input id="u-phone" name="phone" defaultValue={initial?.phone ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="u-password">{editing ? "ახალი პაროლი (თუ იცვლება)" : "პაროლი *"}</Label>
        <Input id="u-password" name="password" type="password" required={!editing} minLength={6} autoComplete="new-password" />
      </div>
    </div>
  );
}
