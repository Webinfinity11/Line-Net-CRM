"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";

import type { MapMarker } from "./map-types";

async function loadLeaflet() {
  const mod = (await import("leaflet")) as unknown as { default?: typeof import("leaflet") } & typeof import("leaflet");
  return mod.default ?? mod;
}

const TBILISI: [number, number] = [41.7151, 44.8271];
/** OpenStreetMap: free and keyless. CARTO now watermarks its tiles without an API key. */
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function LeafletMapView({
  markers,
  center,
  zoom = 12,
  height = 300,
  showLabels = true,
  onPick,
  className,
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  showLabels?: boolean;
  /** When set, clicking the map calls back with coordinates (picker mode) */
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !ref.current || mapRef.current) return;
      const first = markers[0];
      const map = L.map(ref.current, { scrollWheelZoom: false, fadeAnimation: false, zoomControl: true }).setView(center ?? (first ? [first.lat, first.lng] : TBILISI), zoom);
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR, crossOrigin: true }).addTo(map);
      map.on("click", (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      // keep the map correct when its card resizes (font load, sidebar, responsive columns)
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(ref.current);
      setReady((r) => r + 1);
      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
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
      markers.forEach((m, i) => {
        const color = m.color ?? "#2563eb";
        const code = escapeHtml(m.code ?? String(i + 1));
        const labelHtml = showLabels && m.label ? `<span class="ln-pin-label">${escapeHtml(m.label)}</span>` : "";
        const icon = L.divIcon({
          className: "ln-pin-wrap",
          html: `<div class="ln-pin" style="background:${color}"><span>${code}</span></div>${labelHtml}`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -26],
        });
        const marker = L.marker([m.lat, m.lng], { icon, title: m.label }).addTo(layer);
        if (m.label || m.detail) {
          const title = m.href ? `<a href="${m.href}" style="font-weight:600;color:#1d4ed8">${escapeHtml(m.label ?? "")}</a>` : `<strong>${escapeHtml(m.label ?? "")}</strong>`;
          marker.bindPopup(`${title}${m.detail ? `<div style="color:#64748b;margin-top:2px">${escapeHtml(m.detail)}</div>` : ""}`);
        }
      });
      if (markers.length > 1) {
        map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [56, 56], maxZoom: 14 });
      } else if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], Math.max(map.getZoom(), 15));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, ready, showLabels]);

  return <div ref={ref} style={{ height }} className={className ?? "w-full overflow-hidden rounded-xl border"} role="region" aria-label="რუკა" />;
}
