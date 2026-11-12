"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState, MapPanel, useI18n } from "@policylab/ui";
import type { CityLayer } from "@policylab/types";
import { doGet, useApi } from "@/_shared/hooks";
import {
  areaName,
  areaToFeature,
  type CityArea,
  type Feature,
  type FeatureCollection,
} from "@/_shared/geo";
import {
  ErrorPanel,
  KeyValueTable,
  LoadingBlock,
  PageHeader,
  SectionCard,
  Tag,
  btnSecondary,
  headingCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Ψηφιακό Δίδυμο της Πόλης", en: "City Digital Twin" },
  desc: {
    el: "Δισδιάστατη προβολή με επίπεδα δεδομένων, χαρακτηριστικά στοιχεία και ονομασμένες περιοχές παρέμβασης.",
    en: "A 2D view with data layers, feature attributes and named intervention areas.",
  },
  layers: { el: "Επίπεδα δεδομένων", en: "Data layers" },
  areas: { el: "Περιοχές παρέμβασης", en: "Intervention areas" },
  features: { el: "Στοιχεία στον χάρτη", en: "Features on the map" },
  selected: { el: "Επιλεγμένο στοιχείο", en: "Selected feature" },
  noSelection: {
    el: "Κάντε κλικ σε ένα στοιχείο του χάρτη για να δείτε τα χαρακτηριστικά του.",
    en: "Click a feature on the map to see its attributes.",
  },
  emptyLayer: {
    el: "Το layer δεν έχει δεδομένα ακόμη — η εισαγωγή OSM γίνεται μέσω",
    en: "This layer has no data yet — OSM import happens via",
  },
  emptyMap: {
    el: "Ενεργοποιήστε ένα επίπεδο για να δείτε δεδομένα στον χάρτη.",
    en: "Enable a layer to see data on the map.",
  },
  layerError: { el: "Αποτυχία φόρτωσης layer", en: "Failed to load layer" },
  loadingLayer: { el: "Φόρτωση…", en: "Loading…" },
  view3d: { el: "Τρισδιάστατη προβολή (3D)", en: "3D view" },
  none: { el: "—", en: "—" },
  legend: {
    el: "Σημεία = περιοχές παρέμβασης · πολύγωνα/γραμμές = επίπεδα δεδομένων (κτίρια, δίκτυα κ.λπ.).",
    en: "Points = intervention areas · polygons/lines = data layers (buildings, networks etc.).",
  },
  sources: { el: "Πηγές επιπέδων:", en: "Layer sources:" },
};

export default function CityPage() {
  const { t, lang } = useI18n();

  const layers = useApi<CityLayer[]>("/v1/city/layers");
  const areas = useApi<CityArea[]>("/v1/city/areas");

  const [enabled, setEnabled] = useState<string[]>([]);
  const [cache, setCache] = useState<Record<string, Feature[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [layerErrors, setLayerErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Feature | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleToggle = (id: string) => {
    const turningOn = !enabled.includes(id);
    setEnabled((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (!turningOn) return;
    if (id in cache || loadingRef.current[id]) return;
    loadingRef.current[id] = true;
    setLoadingMap((prev) => ({ ...prev, [id]: true }));
    setLayerErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (!abortRef.current) abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    void doGet<FeatureCollection>(
      `/v1/city/features?layer=${encodeURIComponent(id)}&limit=500`,
      signal
    ).then((res) => {
      delete loadingRef.current[id];
      const features = res.data?.features ?? [];
      setCache((prev) => ({ ...prev, [id]: features }));
      setLoadingMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (!res.data && res.error) {
        setLayerErrors((prev) => ({ ...prev, [id]: res.error as string }));
      }
    });
  };

  const mapFeatures = useMemo(() => {
    const out: Feature[] = [];
    for (const id of enabled) {
      for (const f of cache[id] ?? []) out.push(f);
    }
    for (const area of areas.data ?? []) {
      const f = areaToFeature(area, lang);
      if (f) out.push(f);
    }
    return out;
  }, [enabled, cache, areas.data, lang]);

  const enabledCount = enabled.reduce((sum, id) => sum + (cache[id]?.length ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageHeader
        title={t(STR.title)}
        description={t(STR.desc)}
        actions={
          <Link href="/city/3d" className={btnSecondary}>
            {t(STR.view3d)} →
          </Link>
        }
      />

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-15rem)] lg:min-h-[560px] lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 lg:h-full lg:w-80">
          <section>
            <h2 className={`mb-2 ${headingCls}`}>{t(STR.layers)}</h2>
            {layers.loading ? (
              <LoadingBlock rows={4} />
            ) : layers.error ? (
              <ErrorPanel message={layers.error} onRetry={layers.reload} />
            ) : (layers.data ?? []).length === 0 ? (
              <p className={mutedText}>{t(STR.none)}</p>
            ) : (
              <ul className="space-y-1">
                {(layers.data ?? []).map((layer) => {
                  const on = enabled.includes(layer.id);
                  const items = cache[layer.id];
                  return (
                    <li
                      key={layer.id}
                      className="rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id={`layer-${layer.id}`}
                          checked={on}
                          onChange={() => handleToggle(layer.id)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 accent-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
                        />
                        <label
                          htmlFor={`layer-${layer.id}`}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {t(layer.title)}
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {layer.feature_count} {t(STR.features)} · {layer.geometry_type}
                          </span>
                        </label>
                      </div>
                      {loadingMap[layer.id] ? (
                        <p className={`mt-1 pl-6 text-xs ${mutedText}`}>
                          {t(STR.loadingLayer)}
                        </p>
                      ) : null}
                      {layerErrors[layer.id] ? (
                        <p className="mt-1 pl-6 text-xs text-red-700 dark:text-red-400">
                          {t(STR.layerError)}: {layerErrors[layer.id]}
                        </p>
                      ) : null}
                      {on && items && items.length === 0 ? (
                        <p className="mt-1 pl-6 text-xs text-amber-800 dark:text-amber-300">
                          {t(STR.emptyLayer)}{" "}
                          <Link
                            href="/admin"
                            className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            /admin
                          </Link>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className={`mb-2 ${headingCls}`}>{t(STR.areas)}</h2>
            {areas.loading ? (
              <p className={mutedText}>{t(STR.loadingLayer)}</p>
            ) : (areas.data ?? []).length === 0 ? (
              <p className={mutedText}>{t(STR.none)}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {(areas.data ?? []).map((area) => (
                  <li key={area.id}>
                    <Tag>{areaName(area, lang)}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className={`mb-2 ${headingCls}`}>{t(STR.selected)}</h2>
            {selected ? (
              <div className="space-y-2">
                <KeyValueTable
                  rows={Object.entries(selected.properties ?? {}).map(([k, v]) => ({
                    k,
                    v:
                      v === null || v === undefined
                        ? t(STR.none)
                        : typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v),
                  }))}
                />
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setSelected(null)}
                >
                  {t({ el: "Καθαρισμός", en: "Clear" })}
                </button>
              </div>
            ) : (
              <p className={mutedText}>{t(STR.noSelection)}</p>
            )}
          </section>

          <section className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <p className={mutedText}>
              {t(STR.features)}: <strong className="font-semibold">{enabledCount}</strong>
            </p>
          </section>
        </aside>

        <div className="h-[420px] min-w-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 lg:h-[calc(100vh-260px)] lg:min-h-[520px]">
          {mapFeatures.length === 0 && !layers.loading ? (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <MapPanel
                  features={null}
                  center={[23.7275, 37.9838]}
                  zoom={12}
                  height="100%"
                  onFeatureClick={(f) => setSelected(f as unknown as Feature)}
                />
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <p className={`text-center text-sm ${mutedText}`}>{t(STR.emptyMap)}</p>
              </div>
            </div>
          ) : (
            <MapPanel
              features={mapFeatures as never}
              center={[23.7275, 37.9838]}
              zoom={12}
              height="100%"
              onFeatureClick={(f) => setSelected(f as unknown as Feature)}
            />
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <SectionCard>
          <p className={mutedText}>{t(STR.legend)}</p>
        </SectionCard>
        <p className={`text-xs ${mutedText}`}>
          {t(STR.sources)}{" "}
          {(layers.data ?? []).map((l) => l.source).filter(Boolean).join(" · ") ||
            t(STR.none)}
        </p>
      </div>

      {(layers.data ?? []).length === 0 && !layers.loading && !layers.error ? (
        <div className="mt-4">
          <EmptyState title={t(STR.emptyMap)} />
        </div>
      ) : null}
    </div>
  );
}
