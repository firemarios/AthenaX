"use client";

import Link from "next/link";
import { useI18n } from "@policylab/ui";
import { PageHeader, btnPrimary, btnSecondary, mutedText } from "./_shared/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <PageHeader
        title={t({ el: "Κάτι πήγε στραβά", en: "Something went wrong" })}
        description={t({
          el: "Η σελίδα δεν μπόρεσε να φορτώσει. Δοκιμάστε ξανά ή επιστρέψτε στην αρχική.",
          en: "The page could not load. Try again or return to the home page.",
        })}
      />
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        <p className="font-medium">
          {t({ el: "Λεπτομέρειες σφάλματος", en: "Error details" })}
        </p>
        <p className="mt-1 break-words">
          {error.message ||
            t({ el: "Άγνωστο σφάλμα.", en: "Unknown error." })}
        </p>
        {error.digest ? (
          <p className={`mt-2 ${mutedText}`}>
            {t({ el: "Κωδικός", en: "Digest" })}: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={btnPrimary}>
          {t({ el: "Δοκιμάστε ξανά", en: "Try again" })}
        </button>
        <Link href="/" className={btnSecondary}>
          {t({ el: "Αρχική", en: "Home" })}
        </Link>
        <Link href="/policies" className={btnSecondary}>
          {t({ el: "Πολιτικές", en: "Policies" })}
        </Link>
      </div>
    </div>
  );
}
