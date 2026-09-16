import "server-only";

/**
 * Best-effort geocoding with OpenStreetMap Nominatim (free, 1 req/s policy).
 * Returns null on any failure so callers never block on it.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const params = new URLSearchParams({ q: /თბილისი|tbilisi/i.test(q) ? q : `${q}, თბილისი`, format: "json", limit: "1", countrycodes: "ge" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "LineNetCRM/1.0 (info@line-net.ge)", "Accept-Language": "ka,en" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    if (!json[0]) return null;
    const lat = Number(json[0].lat);
    const lng = Number(json[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
