"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";

export type MapMarker = { id: string | number; lat: number; lng: number; label?: string; color?: string; href?: string };

async function loadLeaflet() {
  const mod = (await import("leaflet")) as unknown as { default?: typeof import("leaflet") } & typeof import("leaflet");
  return mod.default ?? mod;
}

const TBILISI: [number, number] = [41.7151, 44.8271];

export function MapView({
  markers,
  center,
  zoom = 12,
  height = 260,
  onPick,
  className,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  /** When set, clicking the map calls back with coordinates (picker mode) */
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !ref.current || mapRef.current) return;
      const first = markers[0];
      const map = L.map(ref.current, { scrollWheelZoom: false }).setView(center ?? (first ? [first.lat, first.lng] : TBILISI), zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;
      const L = await loadLeaflet();
      layer.clearLayers();
      for (const m of markers) {
        const marker = L.circleMarker([m.lat, m.lng], {
          radius: 9,
          color: "#fff",
          weight: 2,
          fillColor: m.color ?? "#0284c7",
          fillOpacity: 0.95,
        }).addTo(layer);
        if (m.label) {
          const html = m.href ? `<a href="${m.href}" style="font-size:12px">${m.label}</a>` : `<span style="font-size:12px">${m.label}</span>`;
          marker.bindPopup(html);
        }
      }
      if (markers.length > 1) {
        map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [24, 24], maxZoom: 15 });
      } else if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], Math.max(map.getZoom(), 14));
      }
    })();
  }, [markers]);

  return <div ref={ref} style={{ height }} className={className ?? "w-full rounded-lg border"} />;
}
