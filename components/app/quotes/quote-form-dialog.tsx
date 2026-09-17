"use client";

import { FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { createQuoteAndOpen, updateQuote } from "@/actions/quotes";
import { FormDialog } from "@/components/app/form-dialog";
import { formFields } from "@/components/app/section-card";
import { useActiveSystems } from "@/components/app/systems-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type ClientOption = { id: number; name: string; sites: { id: number; name: string }[] };

type Initial = {
  title: string;
  clientId: number | null;
  siteId: number | null;
  systemType: string | null;
  note: string | null;
  terms: string | null;
  validUntil: string | null;
  vatPercent: string;
};

function Fields({ clients, initial }: { clients: ClientOption[]; initial?: Initial }) {
  const systems = useActiveSystems();
  const [clientId, setClientId] = useState(initial?.clientId ? String(initial.clientId) : "");
  const [siteId, setSiteId] = useState(initial?.siteId ? String(initial.siteId) : "");
  const sites = clients.find((c) => String(c.id) === clientId)?.sites ?? [];

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${formFields}`}>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="q-title">სათაური</Label>
        <Input id="q-title" name="title" required minLength={2} maxLength={200} defaultValue={initial?.title} placeholder="მაგ. CCTV სისტემა, ფილიალი ვაკე" autoFocus={!initial} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-client">კლიენტი</Label>
        <NativeSelect
          id="q-client"
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
        <Label htmlFor="q-site">ობიექტი</Label>
        <NativeSelect id="q-site" name="siteId" value={siteId} disabled={!clientId} onChange={(e) => setSiteId(e.target.value)}>
          <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
          {sites.map((s) => (
            <NativeSelectOption key={s.id} value={String(s.id)}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-system">სისტემა</Label>
        <NativeSelect id="q-system" name="systemType" defaultValue={initial?.systemType ?? ""}>
          <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
          {systems.map((s) => (
            <NativeSelectOption key={s.key} value={s.key}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-valid">ძალაშია თარიღამდე</Label>
        <Input id="q-valid" name="validUntil" type="date" defaultValue={initial?.validUntil ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-vat">დღგ (%)</Label>
        <Input id="q-vat" name="vatPercent" type="number" step="0.01" min="0" max="100" defaultValue={initial ? Number(initial.vatPercent) : 0} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="q-note">შენიშვნა</Label>
        <Textarea id="q-note" name="note" rows={3} maxLength={4000} defaultValue={initial?.note ?? ""} placeholder="რას მოიცავს შეთავაზება" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="q-terms">პირობები</Label>
        <Textarea id="q-terms" name="terms" rows={2} maxLength={2000} defaultValue={initial?.terms ?? ""} placeholder="გადახდის პირობა, შესრულების ვადა, გარანტია" />
      </div>
    </div>
  );
}

export function NewQuoteDialog({ clients }: { clients: ClientOption[] }) {
  return (
    <FormDialog
      trigger={<Button />}
      triggerLabel={
        <>
          <FileText className="size-4" /> ახალი შეთავაზება
        </>
      }
      title="ახალი შეთავაზება"
      description="შექმნის შემდეგ დაამატეთ პოზიციები კატალოგიდან."
      action={createQuoteAndOpen}
      submitLabel="შექმნა"
      successMessage="შეთავაზება შეიქმნა"
    >
      <Fields clients={clients} />
    </FormDialog>
  );
}

export function EditQuoteDialog({ id, clients, initial }: { id: number; clients: ClientOption[]; initial: Initial }) {
  return (
    <FormDialog
      trigger={<Button variant="outline" size="sm" />}
      triggerLabel={
        <>
          <Pencil className="size-3.5" /> რედაქტირება
        </>
      }
      title="შეთავაზების რედაქტირება"
      action={updateQuote.bind(null, id)}
      submitLabel="შენახვა"
      successMessage="შენახულია"
    >
      <Fields clients={clients} initial={initial} />
    </FormDialog>
  );
}
