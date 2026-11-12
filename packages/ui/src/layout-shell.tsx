import type { ReactNode } from "react";

export function LayoutShell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[var(--radius-button)] focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Μετάβαση στο περιεχόμενο
      </a>
      {title ? <h1 className="sr-only">{title}</h1> : null}
      {children}
    </div>
  );
}
