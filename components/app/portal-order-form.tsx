"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPortalOrder } from "@/actions/portal";
import { PortalSiteDialog } from "@/components/app/portal-site-dialog";
import { formFields } from "@/components/app/section-card";
import { useActiveSystems } from "@/components/app/systems-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SiteOption = { id: number; name: string; address: string | null };

/** What a client fills in: the problem, where, and whether it is urgent. Scheduling and pricing stay with the manager. */
export function PortalOrderForm({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const categories = useActiveSystems();
  const [pending, start] = useTransition();
  const [addedSites, setAddedSites] = useState<SiteOption[]>([]);
  const siteOptions = [...sites, ...addedSites.filter((added) => !sites.some((site) => site.id === added.id))];
  const [siteId, setSiteId] = useState(sites.length === 1 ? String(sites[0].id) : "");
  const [address, setAddress] = useState(sites.length === 1 ? (sites[0].address ?? "") : "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createPortalOrder(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(`/portal?sent=${res.data!.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardContent className={cn("grid gap-4 pt-6 sm:grid-cols-2", formFields)}>
          <Field className="sm:col-span-2" label="რა გჭირდებათ? *" htmlFor="p-title">
            <Input id="p-title" name="title" required minLength={2} maxLength={200} placeholder="მაგ. კამერა არ ჩანს, მე-2 სართული" autoFocus />
          </Field>
          <Field label="ობიექტი" htmlFor="p-site">
            <NativeSelect
              id="p-site"
              name="siteId"
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                const site = siteOptions.find((s) => String(s.id) === e.target.value);
                setAddress(site?.address ?? "");
              }}
            >
              <NativeSelectOption value="">— აირჩიეთ —</NativeSelectOption>
              {siteOptions.map((s) => (
                <NativeSelectOption key={s.id} value={String(s.id)}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {siteOptions.length === 0 && <p className="text-[12px] text-muted-foreground">ჯერ ობიექტი არ გაქვთ. დაამატეთ მისამართი.</p>}
            <div className="w-fit [&>div>button]:h-9 [&>div>button]:bg-transparent [&>div>button]:px-0 [&>div>button]:text-[12.5px] [&>div>button]:text-primary [&>div>button]:shadow-none [&>div>button]:underline-offset-4 [&>div>button:hover]:translate-y-0 [&>div>button:hover]:bg-transparent [&>div>button:hover]:shadow-none [&>div>button:hover]:underline">
              <PortalSiteDialog onSaved={(site) => {
                setAddedSites((previous) => [...previous, site]);
                setSiteId(String(site.id));
                setAddress(site.address ?? "");
              }} />
            </div>
          </Field>
          <Field label={t.order.system} htmlFor="p-category">
            <NativeSelect id="p-category" name="systemType" defaultValue="">
              <NativeSelectOption value="">— არ ვიცი —</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.key} value={c.key}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2" label={siteOptions.length > 0 ? "მისამართი" : "მისამართი *"} htmlFor="p-address">
            <Input id="p-address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} required={!siteId} maxLength={300} placeholder="ქუჩა, ნომერი, სართული" />
          </Field>
          <Field className="sm:col-span-2" label="დეტალები" htmlFor="p-desc">
            <Textarea id="p-desc" name="description" rows={4} maxLength={5000} placeholder="რა მოხდა, როდის გაწყობთ ვიზიტი, ვის დავურეკოთ ადგილზე" />
          </Field>
          <label className="flex items-center gap-2.5 rounded-[12px] bg-[#f8faff] px-3 py-2.5 text-[13px] sm:col-span-2">
            <input name="urgent" type="checkbox" className="size-4 accent-[#3457d5]" />
            სასწრაფოა
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" className="h-12 flex-1 sm:h-10 sm:flex-none" disabled={pending}>
              <Send className="size-4" /> {pending ? "იგზავნება…" : "გაგზავნა"}
            </Button>
            <Button type="button" variant="outline" className="h-12 sm:h-10" onClick={() => router.push("/portal")}>
              {t.common.cancel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
