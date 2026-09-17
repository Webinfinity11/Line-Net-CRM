export type MapMarker = {
  id: string | number;
  lat: number;
  lng: number;
  /** short text inside the pin, e.g. "1" or "LN-00012" */
  code?: string;
  /** label shown next to the pin */
  label?: string;
  /** popup body (plain text) */
  detail?: string;
  color?: string;
  href?: string;
};

export type MapViewProps = {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  showLabels?: boolean;
  /** When set, clicking the map calls back with coordinates (picker mode) */
  onPick?: (lat: number, lng: number) => void;
  className?: string;
};

export const TBILISI: [number, number] = [41.7151, 44.8271];
