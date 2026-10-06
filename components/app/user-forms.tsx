"use client";

import { useState } from "react";
import { formFields } from "@/components/app/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { User } from "@/db/schema";
import { ROLE_LABELS } from "@/lib/i18n";
import { useSystems } from "@/components/app/systems-provider";
import type { Competencies } from "@/lib/competency-utils";
import { cn } from "@/lib/utils";

export function UserFields({ initial, clients }: { initial?: Partial<User> & { competencies?: Competencies }; clients: { id: number; name: string }[] }) {
  const editing = Boolean(initial?.id);
  const [role, setRole] = useState<string>(initial?.role ?? "executor");
  const [competencyMode, setCompetencyMode] = useState(initial?.competencies && initial.competencies !== "all" ? "selected" : "all");
  const selectedCompetencies = initial?.competencies === "all" ? [] : initial?.competencies ?? [];
  const systemOptions = useSystems().filter((s) => s.active || selectedCompetencies.includes(s.key) || initial?.specializations?.includes(s.key));
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", formFields)}>
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
        <NativeSelect id="u-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
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
      {role === "client" ? (
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="u-client">კომპანია *</Label>
        <NativeSelect id="u-client" name="clientId" required defaultValue={initial?.clientId ? String(initial.clientId) : ""}>
          <NativeSelectOption value="">— აირჩიეთ კლიენტი —</NativeSelectOption>
          {clients.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-[11px] text-muted-foreground">შევა კლიენტის კაბინეტში: ნახავს მხოლოდ ამ კომპანიის შეკვეთებს და გამოგზავნის ახალ მოთხოვნას.</p>
      </div>
      ) : role === "executor" ? (
      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="text-sm font-medium">კომპეტენციები</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="competencyMode" value="all" checked={competencyMode === "all"} onChange={() => setCompetencyMode("all")} className="accent-primary" />
            ყველა კატეგორია
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="competencyMode" value="selected" checked={competencyMode === "selected"} onChange={() => setCompetencyMode("selected")} className="accent-primary" />
            მხოლოდ არჩეული
          </label>
        </div>
        <div hidden={competencyMode === "all"}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {systemOptions.map(sys => (
              <label key={sys.key} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" name="competencies" value={sys.key} defaultChecked={selectedCompetencies.includes(sys.key)} disabled={competencyMode === "all"} className="size-4 accent-primary" />
                {sys.name}
              </label>
            ))}
          </div>
        </div>
        {/* Keep the legacy profile field; competency filtering uses the new table only. */}
        {initial?.specializations?.map(slug => <input key={slug} type="hidden" name="specializations" value={slug} />)}
      </fieldset>
      ) : (
      <div className="space-y-1.5 sm:col-span-2">
        <Label>სპეციალიზაცია (რომელ კატეგორიებზე მუშაობს)</Label>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border p-2 text-sm">
          {systemOptions.map((sys) => (
            <label key={sys.key} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" name="specializations" value={sys.key} defaultChecked={initial?.specializations?.includes(sys.key)} className="size-4 accent-primary" />
              {sys.name}
            </label>
          ))}
        </div>
      </div>
      )}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="u-password">{editing ? "ახალი პაროლი (თუ იცვლება)" : "პაროლი *"}</Label>
        <Input id="u-password" name="password" type="password" required={!editing} minLength={6} autoComplete="new-password" />
      </div>
    </div>
  );
}
