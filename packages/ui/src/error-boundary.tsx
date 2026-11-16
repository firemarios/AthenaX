"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AthenaX UI error:", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-6 w-6"
            >
              <path d="M12 8v5" />
              <path d="M12 17h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Κάτι πήγε στραβά</h1>
          <p className="text-sm text-muted-foreground">
            Η σελίδα αντιμετώπισε σφάλμα κατά τη φόρτωση. Δοκιμάστε ξανά ή
            επιστρέψτε στην αρχική σελίδα.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-[var(--radius-button)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Δοκιμάστε ξανά
            </button>
            <a
              href="/"
              className="rounded-[var(--radius-button)] border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Αρχική σελίδα
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
