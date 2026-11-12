"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton, useI18n } from "@policylab/ui";
import { PageHeader, btnSecondary, mutedText } from "@/_shared/ui";

function GlobeLoading() {
  const { t } = useI18n();
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="h-full w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
    >
      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t({ el: "3D Φόρτωση…", en: "3D loading…" })}
      </p>
      <Skeleton rows={8} />
    </div>
  );
}

const CesiumGlobe = dynamic(() => import("./CesiumGlobe"), {
  ssr: false,
  loading: () => <GlobeLoading />,
});

export default function City3DPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <PageHeader
        title={t({
          el: "Ψηφιακό Δίδυμο — 3D προβολή",
          en: "Digital Twin — 3D view",
        })}
        description={t({
          el: "Τρισδιάστατη προβολή της Αθήνας με ογκοποιημένα αποτυπώματα κτιρίων από το επίπεδο buildings.",
          en: "A 3D view of Athens with extruded building footprints from the buildings layer.",
        })}
        actions={
          <Link href="/city" className={btnSecondary}>
            ← {t({ el: "Δισδιάστατη προβολή (2D)", en: "2D view" })}
          </Link>
        }
      />

      <div className="h-[70vh] min-h-[480px] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
        <CesiumGlobe />
      </div>

      <p className={`mt-3 text-xs ${mutedText}`}>
        {t({
          el: "Οι όγκοι κτιρίων βασίζονται στο ύψος (properties.height) του layer buildings· σε απουσία ύψους χρησιμοποιείται προεπιλεγμένο ύψος 12 m. Τα πλακίδια προέρχονται από OpenStreetMap.",
          en: "Building volumes use the height property of the buildings layer; a 12 m default applies when missing. Tiles come from OpenStreetMap.",
        })}
      </p>
    </div>
  );
}
