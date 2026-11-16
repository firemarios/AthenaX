"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Map as MapLibreMap,
  FilterSpecification,
  LayerSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CityLayer, GeoJSON } from "@policylab/types";
import { useI18n } from "./providers";
import { cn } from "./cn";

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const ATHENS_CENTER: [number, number] = [23.7275, 37.9838];
const DEFAULT_ZOOM = 11;
const SOURCE_ID = "policylab-source";
const FILL_LAYER = "policylab-fill";
const LINE_LAYER = "policylab-line";
const CIRCLE_LAYER = "policylab-circle";
const PALETTE = [
  "#007aff",
  "#34c759",
  "#ff9f0a",
  "#ff3b30",
  "#5ac8fa",
  "#af52de",
  "#30d158",
  "#ff9500",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asFilter(value: unknown): FilterSpecification {
  return value as FilterSpecification;
}

function asLayer(value: unknown): LayerSpecification {
  return value as LayerSpecification;
}

function layerFilter(active: string | null): unknown {
  if (!active) return null;
  return ["any", ["==", ["get", "layer"], active], ["!", ["has", "layer"]]];
}

function geometryFilters(active: string | null): {
  fill: unknown;
  line: unknown;
  circle: unknown;
} {
  const extra = layerFilter(active);
  const combine = (geom: unknown): unknown =>
    extra ? ["all", geom, extra] : geom;
  return {
    fill: combine([
      "in",
      ["geometry-type"],
      ["literal", ["Polygon", "MultiPolygon"]],
    ]),
    line: combine([
      "in",
      ["geometry-type"],
      [
        "literal",
        ["Polygon", "MultiPolygon", "LineString", "MultiLineString"],
      ],
    ]),
    circle: combine([
      "in",
      ["geometry-type"],
      ["literal", ["Point", "MultiPoint"]],
    ]),
  };
}

function colorExpression(layers: CityLayer[] | undefined): unknown {
  if (!layers || layers.length === 0) return "#007aff";
  const pairs: unknown[] = [];
  layers.forEach((layer, index) => {
    pairs.push(layer.id, PALETTE[index % PALETTE.length]);
  });
  return ["match", ["get", "layer"], ...pairs, "#007aff"];
}

function buildCollection(
  features: GeoJSON.Feature<GeoJSON.Geometry | null, GeoJSON.GeoJsonProperties>[] | null | undefined,
) {
  const valid = (features ?? []).filter(
    (feature): feature is GeoJSON.Feature =>
      Boolean(feature) && Boolean(feature.geometry),
  );
  return { type: "FeatureCollection" as const, features: valid };
}

export interface MapPanelProps {
  features?:
    | GeoJSON.Feature<GeoJSON.Geometry | null, GeoJSON.GeoJsonProperties>[]
    | null;
  layers?: CityLayer[];
  activeLayer?: string | null;
  onLayerChange?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  onFeatureClick?: (
    feature: GeoJSON.Feature<GeoJSON.Geometry | null, GeoJSON.GeoJsonProperties>,
  ) => void;
}

export function MapPanel({
  features,
  layers,
  activeLayer,
  onLayerChange,
  center,
  zoom,
  height = "420px",
  onFeatureClick,
}: MapPanelProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<{ remove: () => void } | null>(null);
  const clickCbRef = useRef<MapPanelProps["onFeatureClick"]>(onFeatureClick);
  const initialRef = useRef({ center, zoom });
  const tRef = useRef(t);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [internalLayer, setInternalLayer] = useState<string | null>(null);

  const controlled = activeLayer !== undefined;
  const currentLayer = controlled ? activeLayer : internalLayer;

  useEffect(() => {
    clickCbRef.current = onFeatureClick;
  }, [onFeatureClick]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Initialise the map once (dynamic import keeps maplibre out of the SSR graph).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let styleLoaded = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    const fallbackTimer = setTimeout(() => {
      if (!styleLoaded && !cancelled) setFailed(true);
    }, 15000);

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        const { Map: MapLibre, NavigationControl, GeolocateControl, Marker, Popup } =
          maplibre;
        const { center: initCenter, zoom: initZoom } = initialRef.current;

        const prefersDark =
          typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark");
        map = new MapLibre({
          container: containerRef.current,
          style: prefersDark ? STYLE_DARK : STYLE_LIGHT,
          center: initCenter ?? ATHENS_CENTER,
          zoom: initZoom ?? DEFAULT_ZOOM,
        });
        mapRef.current = map;

        map.on("error", (event) => {
          if (styleLoaded) {
            console.warn("MapLibre:", event.error ?? event);
            return;
          }
          if (!cancelled) setFailed(true);
        });

        map.on("load", () => {
          styleLoaded = true;
          if (cancelled || !map) return;
          setReady(true);
          setFailed(false);
          try {
            map.addControl(new NavigationControl({ showCompass: true }), "top-right");
            map.addControl(
              new GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showAccuracyCircle: true,
              }),
              "top-right",
            );
          } catch {
            /* controls are optional */
          }

          map.on("click", (event) => {
            if (!map) return;
            const m = map;
            const layerIds = [FILL_LAYER, LINE_LAYER, CIRCLE_LAYER].filter(
              (id) => m.getLayer(id),
            );
            if (layerIds.length === 0) return;
            const hits = map.queryRenderedFeatures(event.point, {
              layers: layerIds,
            });
            if (hits.length === 0) return;
            const hit = hits[0];
            try {
              markerRef.current?.remove();
              markerRef.current = new Marker({ color: "#007aff" })
                .setLngLat(event.lngLat)
                .addTo(map);
            } catch {
              markerRef.current = null;
            }
            const properties = (hit.properties ?? {}) as Record<string, unknown>;
            const title = String(
              properties.title ?? properties.name ?? properties.label ?? "",
            );
            const rows = Object.entries(properties)
              .filter(
                ([key, value]) =>
                  key !== "title" &&
                  key !== "name" &&
                  key !== "label" &&
                  (typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean") &&
                  String(value).length > 0,
              )
              .slice(0, 5)
              .map(
                ([key, value]) =>
                  `<div class="policylab-popup-row"><span>${escapeHtml(key)}</span><b>${escapeHtml(String(value))}</b></div>`,
              )
              .join("");
            const html = `<div class="policylab-popup"><strong>${escapeHtml(
              title || tRef.current({ el: "Στοιχείο", en: "Feature" }),
            )}</strong>${rows}</div>`;
            try {
              new Popup({ closeButton: true, maxWidth: "260px" })
                .setLngLat(event.lngLat)
                .setHTML(html)
                .addTo(map);
            } catch {
              /* popup is optional */
            }
            clickCbRef.current?.(hit as unknown as GeoJSON.Feature);
          });

          try {
            map.on("mouseenter", CIRCLE_LAYER, () => {
              if (map) map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", CIRCLE_LAYER, () => {
              if (map) map.getCanvas().style.cursor = "";
            });
          } catch {
            /* layer may not exist yet */
          }
        });

        if ("ResizeObserver" in window) {
          observer = new ResizeObserver(() => {
            try {
              map?.resize();
            } catch {
              /* ignore */
            }
          });
          observer.observe(containerRef.current);
        }
      } catch (error) {
        console.warn("Map initialisation failed:", error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      try {
        observer?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        markerRef.current?.remove();
      } catch {
        /* ignore */
      }
      markerRef.current = null;
      try {
        map?.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
  }, []);

  // Sync source data + layer filters whenever features / active layer change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      const collection = buildCollection(features);
      const source = map.getSource(SOURCE_ID) as
        | { setData?: (data: unknown) => void }
        | undefined;
      if (source && typeof source.setData === "function") {
        source.setData(collection);
      } else {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: collection as never,
        });
        const color = colorExpression(layers);
        map.addLayer(
          asLayer({
            id: FILL_LAYER,
            type: "fill",
            source: SOURCE_ID,
            filter: asFilter(geometryFilters(currentLayer).fill),
            paint: { "fill-color": color, "fill-opacity": 0.22 },
          }),
        );
        map.addLayer(
          asLayer({
            id: LINE_LAYER,
            type: "line",
            source: SOURCE_ID,
            filter: asFilter(geometryFilters(currentLayer).line),
            paint: {
              "line-color": color,
              "line-width": 2,
              "line-opacity": 0.9,
            },
          }),
        );
        map.addLayer(
          asLayer({
            id: CIRCLE_LAYER,
            type: "circle",
            source: SOURCE_ID,
            filter: asFilter(geometryFilters(currentLayer).circle),
            paint: {
              "circle-radius": 6,
              "circle-color": color,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-opacity": 0.95,
            },
          }),
        );
      }

      const filters = geometryFilters(currentLayer);
      if (map.getLayer(FILL_LAYER)) {
        map.setFilter(FILL_LAYER, asFilter(filters.fill));
      }
      if (map.getLayer(LINE_LAYER)) {
        map.setFilter(LINE_LAYER, asFilter(filters.line));
      }
      if (map.getLayer(CIRCLE_LAYER)) {
        map.setFilter(CIRCLE_LAYER, asFilter(filters.circle));
      }
    } catch (error) {
      console.warn("Map layer update failed:", error);
    }
  }, [features, layers, currentLayer, ready]);

  const swatchColor = useMemo(
    () => (id: string) => {
      const index = layers?.findIndex((layer) => layer.id === id) ?? -1;
      return PALETTE[(index < 0 ? 0 : index) % PALETTE.length];
    },
    [layers],
  );

  const showLayers = Boolean(layers && layers.length > 0);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted shadow-sm"
      style={{ height }}
    >
        <div ref={containerRef} className="h-full w-full" />

      {showLayers ? (
        <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1.5">
          {layers?.map((layer) => {
            const active = currentLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (!controlled) setInternalLayer(layer.id);
                  onLayerChange?.(layer.id);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background/90 text-foreground hover:bg-background",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: swatchColor(layer.id) }}
                />
                {layer.title.el}
              </button>
            );
          })}
        </div>
      ) : null}

      {!ready ? (
        <div
          role="status"
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 px-4 text-center"
        >
          {failed ? (
            <p className="max-w-sm text-sm text-muted-foreground">
              {t({
                el: "Ο χάρτης δεν φορτώθηκε. Τα πλακίδια δεν είναι προσωρινά διαθέσιμα — δοκιμάστε ξανά αργότερα.",
                en: "The map failed to load. Tiles are temporarily unavailable — please try again later.",
              })}
            </p>
          ) : (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse bg-muted"
              />
              <span className="relative text-sm text-muted-foreground">
                {t({ el: "Φόρτωση χάρτη…", en: "Loading map…" })}
              </span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
