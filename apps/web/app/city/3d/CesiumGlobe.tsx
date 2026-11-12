"use client";

import { useEffect, useRef } from "react";
import { API_BASE } from "@policylab/api-client";

const CESIUM_VERSION = "1.146.0";
const CESIUM_BASE = `https://unpkg.com/cesium@${CESIUM_VERSION}/Build/Cesium/`;
const BUILDINGS_BBOX = "23.62,37.93,23.88,38.04";

export default function CesiumGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let viewer: { destroy(): void } | null = null;

    (async () => {
      const w = window as unknown as { CESIUM_BASE_URL?: string };
      w.CESIUM_BASE_URL = CESIUM_BASE;
      const Cesium = await import("cesium");
      const container = containerRef.current;
      if (disposed || !container) return;

      const v = new Cesium.Viewer(container, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            credit: "© OpenStreetMap contributors",
            maximumLevel: 19,
          }),
        ),
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });
      viewer = v;

      v.scene.globe.baseColor = Cesium.Color.fromCssColorString("#e4e4e7");
      v.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(23.7275, 37.9838, 9000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-55),
          roll: 0,
        },
      });

      try {
        const res = await fetch(
          `${API_BASE}/v1/city/features?layer=buildings&bbox=${BUILDINGS_BBOX}&limit=500`,
        );
        if (!res.ok || disposed) return;
        const body = (await res.json()) as {
          data?: { features?: unknown[] };
        };
        const features = body.data?.features;
        if (disposed || !Array.isArray(features) || features.length === 0) return;

        const ds = await Cesium.GeoJsonDataSource.load(
          { type: "FeatureCollection", features } as never,
          { clampToGround: false },
        );
        if (disposed) return;
        v.dataSources.add(ds);

        for (const entity of ds.entities.values) {
          if (!entity.polygon) continue;
          const raw = entity.properties?.height?.getValue(v.clock.currentTime);
          const height =
            typeof raw === "number" && Number.isFinite(raw) && raw > 0
              ? raw
              : Number(raw) > 0
                ? Number(raw)
                : 12;
          entity.polygon.height = new Cesium.ConstantProperty(0);
          entity.polygon.extrudedHeight = new Cesium.ConstantProperty(height);
          entity.polygon.material = new Cesium.ColorMaterialProperty(
            Cesium.Color.fromCssColorString("#6366f1").withAlpha(0.7),
          );
          entity.polygon.outline = new Cesium.ConstantProperty(true);
          entity.polygon.outlineColor = new Cesium.ConstantProperty(
            Cesium.Color.fromCssColorString("#e4e4e7"),
          );
        }
      } catch {
        /* buildings layer is best-effort — the globe still renders */
      }
    })().catch(() => {
      /* viewer init failure is contained — page shows the loading fallback */
    });

    return () => {
      disposed = true;
      try {
        viewer?.destroy();
      } catch {
        /* ignore double-destroy */
      }
      viewer = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" aria-label="3D globe" />;
}
