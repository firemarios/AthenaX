export interface Point {
  type: "Point";
  coordinates: number[];
}

export interface MultiPoint {
  type: "MultiPoint";
  coordinates: number[][];
}

export interface LineString {
  type: "LineString";
  coordinates: number[][];
}

export interface MultiLineString {
  type: "MultiLineString";
  coordinates: number[][][];
}

export interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface MultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export interface GeometryCollection {
  type: "GeometryCollection";
  geometries: Geometry[];
}

export type Geometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon
  | GeometryCollection;

export interface Feature {
  type: "Feature";
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
  id?: string | number;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

export interface CityArea {
  id: string;
  name?: string | { el: string; en: string } | null;
  name_el?: string | null;
  name_en?: string | null;
  lat?: number | null;
  lon?: number | null;
  radius_m?: number | null;
}

export function areaName(
  area: CityArea,
  lang: "el" | "en"
): string {
  const direct = lang === "el" ? area.name_el : area.name_en;
  if (typeof direct === "string" && direct.trim()) return direct;
  const fallback = lang === "el" ? area.name_en : area.name_el;
  if (typeof fallback === "string" && fallback.trim()) return fallback;
  if (typeof area.name === "string" && area.name.trim()) return area.name;
  if (area.name && typeof area.name === "object") {
    const v = lang === "el" ? area.name.el : area.name.en;
    if (v && v.trim()) return v;
    const other = lang === "el" ? area.name.en : area.name.el;
    if (other && other.trim()) return other;
  }
  return area.id;
}

export function geomToFeature(
  geometry: Geometry | null | undefined,
  properties: Record<string, unknown>
): Feature | null {
  if (!geometry || typeof geometry !== "object") return null;
  return { type: "Feature", geometry, properties };
}

export function areaToFeature(area: CityArea, lang: "el" | "en"): Feature | null {
  if (typeof area.lat !== "number" || typeof area.lon !== "number") return null;
  if (!Number.isFinite(area.lat) || !Number.isFinite(area.lon)) return null;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [area.lon, area.lat] },
    properties: {
      _kind: "area",
      name: areaName(area, lang),
      radius_m: area.radius_m ?? null,
    },
  };
}

export function featureCollection(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}
