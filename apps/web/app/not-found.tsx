"use client";

import Link from "next/link";
import { useI18n } from "@athenax/ui";
import { PageHeader, btnPrimary, btnSecondary } from "./_shared/ui";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <PageHeader
        title={t({ el: "Η σελίδα δεν βρέθηκε", en: "Page not found" })}
        description={t({
          el: "Ο σύνδεσμος μπορεί να είναι λανθασμένος ή η σελίδα να έχει μετακινηθεί.",
          en: "The link may be incorrect or the page may have moved.",
        })}
      />
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={btnPrimary}>
          {t({ el: "Επιστροφή στην αρχική", en: "Back to home" })}
        </Link>
        <Link href="/data" className={btnSecondary}>
          {t({ el: "Δεδομένα", en: "Data" })}
        </Link>
        <Link href="/policies" className={btnSecondary}>
          {t({ el: "Σενάρια", en: "Scenarios" })}
        </Link>
        <Link href="/simulations" className={btnSecondary}>
          {t({ el: "Προσομοιώσεις", en: "Simulations" })}
        </Link>
      </div>
    </div>
  );
}
