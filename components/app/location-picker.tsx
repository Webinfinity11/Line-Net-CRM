"use client";

import { MapPin, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapView } from "./map-view";

export function LocationPicker({ lat, lng }: { lat?: string | number | null; lng?: string | number | null }) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null && lat !== "" && lng !== "" ? { lat: Number(lat), lng: Number(lng) } : null,
  );
  const [open, setOpen] = useState(Boolean(pos));

  return (
    <div className="space-y-2">
      <input type="hidden" name="lat" value={pos ? pos.lat.toFixed(7) : ""} />
      <input type="hidden" name="lng" value={pos ? pos.lng.toFixed(7) : ""} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="size-3.5" />
        {pos ? (
          <span>
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </span>
        ) : (
          <span>კოორდინატები არ არის. მისამართიდან ავტომატურად მოიძებნება, ან მონიშნეთ რუკაზე.</span>
        )}
        <Button type="button" size="xs" variant="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "რუკის დამალვა" : "რუკაზე მონიშვნა"}
        </Button>
        {pos && (
          <Button type="button" size="xs" variant="ghost" onClick={() => setPos(null)} aria-label="წაშლა">
            <X className="size-3" />
          </Button>
        )}
      </div>
      {open && (
        <MapView
          markers={pos ? [{ id: "pick", lat: pos.lat, lng: pos.lng }] : []}
          center={pos ? [pos.lat, pos.lng] : undefined}
          zoom={pos ? 15 : 12}
          height={220}
          onPick={(la, ln) => setPos({ lat: la, lng: ln })}
        />
      )}
    </div>
  );
}
