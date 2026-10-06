"use client";

import { Plus, Pencil } from "lucide-react";
import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { createPortalSite, updatePortalSite } from "@/actions/portal";
import { FormDialog } from "@/components/app/form-dialog";
import { formFields } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalSite } from "@/lib/portal";

const SiteMap = dynamic(() => import("@/components/app/map-view").then(m => m.LeafletMapView), { ssr: false });
type LocatedSite = PortalSite & { lat?: string | null; lng?: string | null };

export function PortalSiteDialog({ site, onSaved }: { site?: LocatedSite; onSaved?: (site: PortalSite) => void }) {
  const prefix = useId();
  return (
    // The dialog portal still bubbles React submit events to the order form.
    <div onSubmit={(event) => event.stopPropagation()}>
      <FormDialog
        trigger={<Button type="button" variant={site ? "outline" : "default"} className="h-11 sm:h-9" aria-label={site ? `${site.name} — რედაქტირება` : "ახალი მისამართი"} />}
        triggerLabel={site ? <><Pencil className="size-4" /> რედაქტირება</> : <><Plus className="size-4" /> ახალი მისამართი</>}
        title={site ? "მისამართის რედაქტირება" : "ახალი მისამართი"}
        description="მიუთითეთ ობიექტი და ადგილზე საკონტაქტო პირი."
        successMessage={site ? "მისამართი განახლდა" : "მისამართი დაემატა"}
        action={async (fd) => {
          const result = site ? await updatePortalSite(site.id, fd) : await createPortalSite(fd);
          if (result.ok && result.data) onSaved?.(result.data);
          return result;
        }}
      >
        <div className={`grid gap-3 ${formFields}`}>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-name`}>ობიექტის სახელი *</Label>
            <Input id={`${prefix}-name`} name="name" required maxLength={200} defaultValue={site?.name ?? ""} placeholder="მაგ. ფილიალი ვაკე" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-address`}>მისამართი</Label>
            <Input id={`${prefix}-address`} name="address" maxLength={300} defaultValue={site?.address ?? ""} placeholder="ქუჩა, ნომერი" />
          </div>
          <SiteLocation key={`${site?.id}-${site?.lat}-${site?.lng}`} site={site} />
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-contact`}>საკონტაქტო პირი ადგილზე</Label>
            <Input id={`${prefix}-contact`} name="contactName" maxLength={120} defaultValue={site?.contactName ?? ""} placeholder="სახელი და გვარი" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-phone`}>ტელეფონი</Label>
            <Input id={`${prefix}-phone`} name="contactPhone" type="tel" maxLength={60} defaultValue={site?.contactPhone ?? ""} placeholder="5xx xx xx xx" />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

function SiteLocation({ site }: { site?: LocatedSite }) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    site?.lat != null && site?.lng != null ? { lat: Number(site.lat), lng: Number(site.lng) } : null,
  );
  return <div className="space-y-2">
    <p className="text-[12px] text-muted-foreground">დააწკაპუნეთ რუკაზე ზუსტი ადგილის მოსანიშნავად</p>
    <SiteMap markers={[]} pick={{ value: point, onChange: setPoint }} zoom={point ? 15 : 12} height={240} />
    <input type="hidden" name="lat" value={point?.lat ?? ""} />
    <input type="hidden" name="lng" value={point?.lng ?? ""} />
    {point && <button type="button" className="ln-link text-[12px]" onClick={() => setPoint(null)}>მონიშვნის მოხსნა</button>}
  </div>;
}
