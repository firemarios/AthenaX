"use client";

import { ArrowRight, Check, Sparkles, User } from "lucide-react";
import { cn, useI18n } from "@athenax/ui";
import { PRICING, PRICING_SECTION } from "../_shared/home-content";

const STR = {
  greeting: { el: "Γεια σου, AthenaX", en: "Hello, AthenaX" },
  subtitle: {
    el: "Δες το προφίλ σου και διάλεξε το πλάνο που ταιριάζει στη δουλειά σου.",
    en: "See your profile and pick the plan that fits the way you work.",
  },
  profile: { el: "Προφίλ", en: "Profile" },
  name: { el: "AthenaX", en: "AthenaX" },
  email: { el: "hello@athenax.gr", en: "hello@athenax.gr" },
  memberSince: { el: "Μέλος από", en: "Member since" },
  memberDate: { el: "Νοέμβριος 2026", en: "November 2026" },
  currentPlan: { el: "Τρέχον πλάνο", en: "Current plan" },
  plans: { el: "Πλάνα συνδρομής", en: "Subscription plans" },
  plansDesc: {
    el: "Στατικά πλάνα για επίδειξη — καμία πληρωμή ή ενεργοποίηση.",
    en: "Static plans for preview — no payment or activation.",
  },
  upgrade: { el: "Αλλαγή πλάνου", en: "Switch plan" },
  contact: { el: "Επικοινωνία", en: "Talk to us" },
};

export default function ProfilePage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
          {t({ el: "Λογαριασμός", en: "Account" })}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t(STR.greeting)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t(STR.subtitle)}
        </p>
      </header>

      <section
        aria-labelledby="profile-card-heading"
        className="mb-8 rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <h2 id="profile-card-heading" className="sr-only">
          {t(STR.profile)}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-primary/20">
            <User
              aria-hidden="true"
              className="h-8 w-8 text-muted-foreground"
            />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground">
              {t(STR.name)}
            </p>
            <p className="text-sm text-muted-foreground">{t(STR.email)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(STR.memberSince)} · {t(STR.memberDate)}
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            {t(STR.currentPlan)}: Free
          </span>
        </div>
      </section>

      <section aria-labelledby="plans-heading">
        <div className="mb-5">
          <h2
            id="plans-heading"
            className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          >
            {t(STR.plans)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(STR.plansDesc)}
          </p>
        </div>

        <div className="grid auto-rows-fr gap-4 lg:grid-cols-3">
          {PRICING.map((plan) => {
            const current = plan.id === "free";
            return (
              <article
                key={plan.id}
                aria-labelledby={`plan-${plan.id}-name`}
                className={cn(
                  "relative flex h-full flex-col rounded-[var(--radius-card)] border bg-card p-5 shadow-sm transition-colors sm:p-6",
                  plan.featured
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                {current || plan.featured ? (
                  <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
                    {current ? t(STR.currentPlan) : t(PRICING_SECTION.badge)}
                  </span>
                ) : null}

                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {t(plan.name)}
                </p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight text-foreground">
                    {t(plan.price)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(plan.period)}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {t(plan.summary)}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.en}
                      className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground"
                    >
                      <Check
                        aria-hidden="true"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      />
                      <span>{t(feature)}</span>
                    </li>
                  ))}
                </ul>

                {current ? (
                  <span className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground">
                    {t(STR.currentPlan)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "mt-6 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      plan.featured
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-background text-foreground hover:border-primary",
                    )}
                  >
                    {plan.id === "deluxe" ? t(STR.contact) : t(STR.upgrade)}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t(PRICING_SECTION.note)}
        </p>
      </section>
    </div>
  );
}
