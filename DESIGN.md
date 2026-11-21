# ATHENAX Design System

## 1. Atmosphere & Identity

ATHENAX feels like an Aegean observatory at dusk: a city seen from above, marble lit warm against an indigo field, telemetry moving through it like weather. The product is institutional but not bureaucratic — calm, exact, and quietly cinematic.

The signature is **marble and signal glass**. Warm stone (paper, travertine, Acropolis marble) carries the content surfaces; cold cyan and electric blue carry live data. Panels are not generic frosted cards: they combine a tinted glass fill, a hairline edge, an inner top light, and a deep ambient shadow, so they read as layered physical material rather than a blur applied to a rectangle.

The one moment a visitor should remember: the camera arcs over the Acropolis while the city's data layers wake up one chapter at a time. That moment is the home page's contract, and it must survive on mobile.

## 2. Color

### Palette (home scope, declared on `.pl-home`)

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--home-bg` | `#f4efe6` | `#050a1e` | Page background |
| Surface/deep | `--home-bg-deep` | `#ece5d8` | `#070d24` | Alternate chapter bands |
| Text/primary | `--home-ink` | `#0f1728` | `#eef2ff` | Headlines, body |
| Text/secondary | `--home-muted` | `#4d5a70` | `#9aa8c7` | Captions, hints |
| Border/default | `--home-line` | `rgba(15,23,40,0.14)` | `rgba(255,255,255,0.12)` | Hairlines, dividers |
| Surface/glass | `--home-glass` | `rgba(255,255,255,0.64)` | `rgba(11,18,40,0.55)` | Chips, secondary CTA |
| Surface/glass-strong | `--home-glass-strong` | `rgba(250,247,240,0.9)` | `rgba(8,14,32,0.86)` | Chapter panels |
| Surface/card | `--home-card` | `rgba(255,255,255,0.72)` | `rgba(13,21,45,0.72)` | Module and metric cards |
| Accent/interactive | `--home-accent` | `#0052ff` | `#7db1ff` | Links, labels, focus |
| Accent/solid | `--home-accent-solid` | `#0052ff` | `#1d4ed8` | Primary CTA fill |
| Signal/cyan | `--home-cyan` | `#0e7490` | `#22d3ee` | Live-data indicator |
| Signal/amber | `--home-amber` | `#b45309` | `#f5b942` | Impact / caution markers |
| Scene/fog | `--home-scene-fog` | `#efe9dd` | `#050a1e` | 3D fog and vignette |
| Scene/marble | `--home-scene-marble` | `#fffaf0` | `#e9e2d4` | Acropolis material |

### 3D scene palette

The Three.js scene is a parallel token set inside `city-scene.tsx` (`PALETTES.light` / `PALETTES.dark`). It is the rendering of the same story: land, water, hills, buildings, marble, data, accent, amber, sun, moon, grid. Scene colors may be more saturated than DOM tokens because they are lit and fogged, but every scene hue must map to a DOM role above.

### Rules

- Accent is reserved for interaction and live signal. Decorative fills use `--home-line` or glass surfaces.
- Text never sits on the raw scene without a scrim. Light theme uses a warm left/bottom scrim; dark theme uses an indigo scrim.
- No raw hex in components. Add a token here first.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `clamp(2.05rem, 4.6vw, 3.7rem)` | 600 | 1.04 | -0.035em | Home hero |
| H1 | 2.25rem → 3rem | 600 | 1.1 | -0.025em | Section headings |
| H2 | 1.875rem → 2.25rem | 600 | 1.15 | -0.02em | Chapter cards |
| H3 | 1.25rem → 1.5rem | 600 | 1.25 | -0.015em | Module titles |
| Body/lg | 1rem → 1.125rem | 400 | 1.65 | 0 | Hero lead |
| Body | 0.875rem → 1rem | 400 | 1.6 | 0 | Default copy |
| Body/sm | 0.75rem | 400 | 1.55 | 0 | Card descriptions |
| Caption | 0.625rem | 500 | 1.4 | 0.18em | HUD labels, stop ids |
| Overline | 0.625rem | 500 | 1.4 | 0.24em | Eyebrows, section labels |

### Font Stack

- Primary: `Geist` (`--font-geist-sans`), system-ui fallback.
- Mono: `Geist Mono` (`--font-geist-mono`) for stop ids, coordinates, telemetry labels.

### Rules

- Maximum two families. Greek and Latin share the same stack; never fall back to a different display face per language.
- Body copy never below 12px; primary reading copy never below 14px.
- Tracking tightens as size grows; captions and overlines always uppercase with wide tracking.

## 4. Spacing & Layout

### Base Unit

All spacing derives from **4px**.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Icon-to-label |
| `--space-2` | 8px | Inline groups |
| `--space-3` | 12px | Chip padding |
| `--space-4` | 16px | Card inner gap |
| `--space-5` | 20px | Compact card padding |
| `--space-6` | 24px | Default card padding |
| `--space-8` | 32px | Panel padding, section gaps |
| `--space-10` | 40px | Section heading to content |
| `--space-12` | 48px | Major breaks |
| `--space-16` | 64px | Page section rhythm |
| `--space-20` | 80px | Hero breathing room |
| `--space-24` | 96px | Maximum separation |

### Grid

- Max content width: `96rem` (`max-w-[96rem]`).
- Page gutters: 16px mobile, 24px from `sm`.
- Hero composition: single column below `lg`; two columns (`1fr` + `360–480px`) from `lg`.
- Module grid: 1 column mobile, 2 from `sm`, 4 from `lg`; the first two and last module span two columns from `sm`.
- Breakpoints follow Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

### Scroll ownership

- The home page owns one scroll document. The pinned journey is a CSS `sticky` stage inside a tall wrapper — never scroll-jacking, never a nested scroll container.
- Mobile keeps the same ownership: the stage is `100svh` sticky, the wrapper is `660svh` tall (`820svh` from `lg`), and vertical page scroll always wins over horizontal orbit drag (`touch-pan-y`).
- The fixed mobile nav overlays the stage; stage chrome and panels reserve `6rem` bottom clearance on mobile.

## 5. Components

### Glass panel

- **Structure**: `div` with `.pl-home-glass` or `.pl-home-glass-strong`.
- **Variants**: standard glass (chips, secondary CTA), strong glass (chapter panel, pillars panel).
- **Spacing**: `--space-4` to `--space-8` padding; radius `1.75rem` for panels, `9999px` for chips.
- **States**: static surface; interactive children own hover/focus.
- **Accessibility**: contrast comes from the scrim + opaque glass fill; text tokens are AA on both themes.
- **Motion**: panel crossfade is `900ms` opacity / `1400ms` transform with `--home-ease-out`; the glass card itself resolves from `blur(7px)` over `1500ms`.
- **Layout**: stack; overlays the scene with `pointer-events-none` on the shell and `pointer-events-auto` on the panel.

### Chapter card

- **Structure**: label row (`id · tag`, large chapter number), title, body, link.
- **Variants**: pinned overlay card, stacked card.
- **Spacing**: `--space-6` mobile, `--space-8` desktop.
- **States**: inactive panels are `inert` and visually hidden; the active card's link is tabbable.
- **Accessibility**: one `h2` per card; panel changes are announced through a polite live region.
- **Motion**: `translate3d(0, 24px, 0)` → `0` over `1100ms`, opacity over `900ms`.
- **Layout**: pinned overlay, right/left alternating from `md`; full-width sheet on mobile.

### Module card

- **Structure**: icon, arrow, title, description, optional badge, "open" affordance.
- **Variants**: large (2-col), standard (1-col).
- **Spacing**: `--space-5` / `--space-6`.
- **States**: hover raises the card, brightens the edge, shifts the arrow; focus ring uses `--home-accent`.
- **Accessibility**: whole card is one link; icon and arrow are `aria-hidden`.
- **Motion**: 300ms hover, 1px lift, arrow 4px translate.
- **Layout**: grid cell; tilt interaction is pointer-only and disabled for touch/reduced motion.

### HUD chip / stop rail

- **Structure**: status chip, pause button, bottom progress segments, chapter label.
- **Variants**: status (health), control (pause/play), label (stop id).
- **States**: hover text brightening, `aria-pressed` on pause, focus ring on control.
- **Accessibility**: pause is a real button; the progress rail is `aria-hidden` and the live region carries the state.
- **Motion**: active segment color changes over 500ms; label crossfade over 500ms.
- **Layout**: top chrome, bottom chrome; the rail is decorative only.

### Primary / ghost CTA

- **Structure**: `Link` or `button`.
- **States**: hover lift 1px, solid darken, ghost edge accent; `focus-visible` ring.
- **Motion**: 200ms transform/background.
- **Layout**: inline cluster, wraps at narrow widths.

### Hero search + example chips

- **Source**: `@athenax/ui` `SearchBar` and `ExampleChips`.
- **States**: inherited from the UI package; the home shell only supplies surface context.
- **Layout**: max width `36rem`; chips wrap.

### Scenario wizard

- **Structure**: `form` → two-pane grid; left step rail (`ol` of buttons with completed check, current state, locked future steps), right panel with icon + `h2` heading + instruction, one primary control per step, and a footer with Back / Skip / Cancel / Next.
- **Variants**: text step, choice-card step (category, area, horizon, factor mode), factor editor (suggested summary vs. custom `FactorEditor`), and a review summary with per-item edit jumps.
- **Requirement callout**: directly under the step instruction, a compact status badge (Required / Recommended / Optional) plus a "What's needed" line states the exact data the step expects.
- **Optional steps**: budget, assumptions, KPIs; each shows a visible Skip action beside Cancel. Skip advances without validation and keeps any typed value.
- **States**: current step (`aria-current="step"`, primary ring), completed (check), locked future steps (disabled, 55% opacity); validation errors use `role="alert"` + `aria-invalid`; saving disables Back/Skip/Next and swaps the primary label to the saving copy.
- **Accessibility**: the step heading is `tabIndex={-1}` and receives focus on every step change; a polite `role="status"` announces the step; mobile uses a native `<progress>`; choice cards wrap real radio inputs in labels; Enter advances single-line inputs via `type="submit"`; targets stay ≥40px.
- **Motion**: directional slide + fade — `pl-wizard-forward` / `pl-wizard-backward` animate `translate3d(±28px, 0, 0)` → `0` with opacity over `450ms cubic-bezier(0.22, 1, 0.36, 1)`; the rail's progress line scales with `scaleY` over `500ms`; progress fill transitions width over `450ms`. Reduced motion collapses all of it to `0.01ms`.
- **Layout**: `lg:grid-cols-[15.5rem_1fr]`; the rail is hidden below `lg` and replaced by the progress header; the footer wraps and keeps the primary action last.

### Static poster

- **Structure**: SVG skyline + marble Acropolis + brand mark + status chips.
- **Usage**: reduced-motion fallback and pre-hydration placeholder.
- **Accessibility**: decorative SVG is `aria-hidden`; status text is real DOM.

### Proposal AI evaluation

- **Structure**: bordered panel inside the expanded proposal: header with `Sparkles` icon + "Evaluate with AI" secondary button, score, verdict badge, summary, five criteria bars, then Strengths / Risks / Suggestions lists.
- **Variants**: AI result (`ai_used: true`) vs. deterministic heuristic result (labelled "Indicative evaluation without AI"); verdicts map to badge tones — strong `success`, promising `info`, needs work `warning`, unclear `neutral`.
- **States**: idle, evaluating (button disabled with progress copy), error (`ErrorPanel` with retry), result (button becomes "Re-evaluate").
- **Accessibility**: scores are real text with `tabular-nums`; bars are decorative and mirrored by the numeric value; lists use real `ul`/`li`; the button is a real `button`.
- **Motion**: score bars transition width over the standard 300–420ms; the result appears inline with no layout animation. Reduced motion collapses transitions.
- **Data**: `POST /v1/proposals/{id}/evaluate` → `ProposalEvaluation`; the server caches by proposal text and falls back to heuristics when the LLM is unavailable.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 160–220ms | `ease-out` | Button press, chip hover |
| Standard | 300–420ms | `ease-in-out` | Card hover, color shifts |
| Emphasis | 700–1000ms | `--home-ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) | Panel entry, hero entry |
| Cinematic | 1100–1600ms | `--home-ease-out` | Chapter cards, hero headline |
| Scroll-driven | tied to scroll | linear | Camera, scene layer activation |
| Camera damping | `1 / (1 + e^(-dt * 1.6))` | exponential | Scene follow |

### Rules

- Animate only `transform`, `opacity`, and `filter`. Never animate layout properties.
- Longer is the house style: default UI motion is not under 160ms, and the home page's narrative motion is deliberately slow (900–1600ms). Slow must still feel responsive because the first 200ms carries visible movement.
- The 3D camera lags the scroll slightly (`damping 1.6`) so the city glides rather than snaps.
- Directional transitions (scenario wizard) move on the X axis only: `±28px` `translate3d` + opacity over `450ms`; direction is derived from step order, never from click position.
- Every interactive element has hover, active, and `focus-visible` states.
- Scroll reveals use `IntersectionObserver`; the pinned progress uses a passive scroll listener plus `requestAnimationFrame`.
- Reduced motion: the pinned journey is replaced by the stacked page, the canvas is not mounted, and all transitions collapse to 0.01ms.

## 7. Depth & Surface

### Strategy

**Mixed: tonal shift + hairlines + ambient shadow.** Surfaces separate by tint and edge first; shadows only imply that a panel floats above the scene. Glass is never a lone blur — every glass surface uses the full recipe:

1. tinted translucent fill (`--home-glass*`),
2. 1px hairline edge (`--home-line`),
3. inset top highlight (`inset 0 1px 0 rgba(255,255,255,0.14)`),
4. deep negative-spread ambient shadow (`0 36px 90px -48px`),
5. backdrop blur + saturation (`blur(22px) saturate(1.1)`).

| Level | Value | Usage |
|-------|-------|-------|
| Hairline | `1px solid var(--home-line)` | Cards, chips, dividers |
| Ambient | `0 22px 55px -40px rgba(2,6,23,0.55)` | Cards at rest |
| Floating | `0 36px 90px -48px rgba(2,6,23,0.65)` | Chapter panels |
| Glow | `0 16px 36px -14px color-mix(accent 72%, transparent)` | Primary CTA |

Mobile reduces blur to `12–14px` and keeps the same edge/highlight recipe so the material survives without the GPU cost.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG 2.2 AA: body contrast ≥ 4.5:1, large text ≥ 3:1, visible focus on every interactive element, full keyboard reachability.
- The 3D canvas is `aria-hidden`; all narrative content and actions exist in the DOM.
- Inactive pinned panels use `inert` so hidden links are not focusable.
- A polite live region announces the active chapter as the user scrolls.
- `prefers-reduced-motion: reduce` renders the stacked page with the static poster; no canvas, no pinned wrapper, no reveal animation.
- Mobile drag is horizontal-only orbit; vertical scroll is never blocked.
- Touch targets are at least 40×40px (chips and controls are padded to meet this).

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| Canvas renders continuously while the stage is in view | `city-scene.tsx` | Simplest correct behavior for scroll-linked camera; demand mode would need explicit invalidation on every scroll frame | Revisit if mobile frame budget drops below 45fps |
| Pinned journey uses `svh` with a fixed tall wrapper | `pinned-journey.tsx` | Avoids iOS `dvh` resize jumps; wrapper height is a deliberate pacing choice | Revisit with `dvh` when Safari stabilizes |
| 3D scene is a parallel token set, not CSS variables | `city-scene.tsx` | Three.js needs numeric colors; sharing CSS vars would require runtime parsing | Extract a shared palette module if a third theme appears |
