"use client";

import { GoogleMapView } from "./google-map-view";
import { LeafletMapView } from "./map-view";
import type { MapViewProps } from "./map-types";

const hasGoogle = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

/**
 * One map component for the whole app. Google Maps when a key is configured,
 * otherwise the keyless OpenStreetMap view, so the app never depends on a key to work.
 */
export function MapView(props: MapViewProps) {
  return hasGoogle ? <GoogleMapView {...props} /> : <LeafletMapView {...props} />;
}
