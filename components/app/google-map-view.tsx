"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import type { MapMarker, MapViewProps } from "./map-types";
import { TBILISI } from "./map-types";

/** Muted styling so the pins carry the colour, matching the rest of the dashboard. */
const STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f4f6fa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#66768a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#dfe4ec" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f6fafb" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#eef1f6" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbe6f2" }] },
];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function pinElement(m: MapMarker, index: number) {
  const el = document.createElement("div");
  el.className = "ln-pin";
  el.style.background = m.color ?? "#397b83";
  const span = document.createElement("span");
  span.textContent = m.code ?? String(index + 1);
  el.append(span);
  const wrap = document.createElement("div");
  wrap.style.transform = "translateY(-13px)";
  wrap.append(el);
  return wrap;
}

/**
 * Google Maps engine. Used only when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set;
 * otherwise the app falls back to the keyless OpenStreetMap view.
 */
export function GoogleMapView({ markers, center, zoom = 12, height = 300, showLabels = true, onPick, className }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawn = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !ref.current) return;
    setOptions({ key, v: "weekly" });
    (async () => {
      try {
        const { Map, InfoWindow } = await importLibrary("maps");
        if (cancelled || !ref.current || mapRef.current) return;
        const first = markers[0];
        const map = new Map(ref.current, {
          center: center ? { lat: center[0], lng: center[1] } : first ? { lat: first.lat, lng: first.lng } : { lat: TBILISI[0], lng: TBILISI[1] },
          zoom,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined,
          styles: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ? undefined : STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          scrollwheel: false,
        });
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) onPickRef.current?.(e.latLng.lat(), e.latLng.lng());
        });
        mapRef.current = map;
        infoRef.current = new InfoWindow();
        setReady((r) => r + 1);
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const { AdvancedMarkerElement } = await importLibrary("marker");
      for (const m of drawn.current) m.map = null;
      drawn.current = [];
      markers.forEach((m, i) => {
        const marker = new AdvancedMarkerElement({ map, position: { lat: m.lat, lng: m.lng }, content: pinElement(m, i), title: m.label ?? "" });
        if (m.label || m.detail) {
          marker.addListener("click", () => {
            const title = m.href ? `<a href="${m.href}" style="font-weight:600;color:#397b83">${escapeHtml(m.label ?? "")}</a>` : `<strong>${escapeHtml(m.label ?? "")}</strong>`;
            infoRef.current?.setContent(`<div style="font:13px/1.4 system-ui">${title}${m.detail ? `<div style="color:#64748b;margin-top:2px">${escapeHtml(m.detail)}</div>` : ""}</div>`);
            infoRef.current?.open({ map, anchor: marker });
          });
        }
        drawn.current.push(marker);
      });
      if (markers.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        for (const m of markers) bounds.extend({ lat: m.lat, lng: m.lng });
        map.fitBounds(bounds, 56);
      } else if (markers.length === 1) {
        map.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        map.setZoom(Math.max(map.getZoom() ?? zoom, 15));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, ready, showLabels]);

  if (failed) {
    return (
      <div style={{ height }} className={className ?? "grid w-full place-items-center rounded-xl border border-dashed border-border text-[12.5px] text-muted-foreground"}>
        რუკა ვერ ჩაიტვირთა. შეამოწმეთ Google Maps-ის გასაღები.
      </div>
    );
  }
  return <div ref={ref} style={{ height }} className={className ?? "w-full overflow-hidden rounded-xl border"} role="region" aria-label="რუკა" />;
}
