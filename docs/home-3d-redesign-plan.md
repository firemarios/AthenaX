# ATHENAX Home Page 3D Redesign Plan

Status: proposed  
Scope: `apps/web/app/page.tsx` and home-only shared components  
Goal: turn the home page into a cinematic, scroll-driven 3D experience while preserving all existing functionality, accessibility, i18n and performance.

---

## 1. Design Thesis

**“One city, continuously explored.”**

The home page becomes a single journey through an abstract Athens. The city is the interface: each scroll chapter reveals a layer of the ATHENAX workflow — data, understanding, simulation, decision.

The 3D scene is narrative atmosphere, not the information carrier. All meaning, copy, links, search, metrics and actions stay in accessible DOM overlays.

### Reference synthesis

| Reference | What to borrow |
|---|---|
| Dark Moon | Numbered chapters (`S.01`), technical HUD details, provenance/evidence tone, structured split layouts |
| Still Form | Pinned 3D stage, slow camera movement, sparse typography, “scroll / drag to explore” |
| Giallo Studio | Oversized editorial headlines, direct numbered process, confident negative space |
| Fragment | Minimal navigation, bold type scale, cinematic section transitions |
| The Way | Calm pacing, concise copy, generous vertical rhythm |
| VAST | Dark immersive stage, scroll-to-start cue, large “worlds” framing |

Synthesis: **Dark Moon’s structure + Still Form’s spatial calm + VAST’s cinematic scale**, with ATHENAX’s civic-tech credibility.

---

## 2. Page Architecture

### Global

- Full-width dark “blue hour” stage.
- Sticky 3D canvas with native scrolling — no scroll-jacking.
- Chapter index labels in monospace: `S.00`–`S.05`.
- Thin scroll-progress indicator retained.
- Nav becomes a transparent/glass home variant over the dark stage.

### S.00 — Hero

- Full-viewport city emerging from fog.
- Eyebrow: open GovTech / policy experimentation.
- Large two-line headline with one accent phrase.
- Compact value proposition.
- Search bar + example question chips.
- CTAs: “Create a policy” and “Ask the city”.
- Live HUD pills: “Digital twin · Athens”, model status, “Drag to explore”.
- Scroll cue: “Scroll to enter the city”.

### S.01 — The City Is the Model

- Camera drops closer and begins a slow lateral sweep.
- Three ATHENAX pillars as anchored glass panels over the scene:
  - Open data
  - Evidence first
  - Built for cities
- Brief “who we are” statement.

### S.02 — Four Chapters, One Journey

Use the existing `STEPS` content as four pinned chapters, each with a camera keyframe:

1. **Connect** — data points illuminate across the city; arcs form between sources.
2. **Understand** — camera dives toward a district; source/citation markers appear as HUD tags.
3. **Simulate** — translucent “scenario” massing and a congestion/impact heat layer fade in.
4. **Decide** — camera pulls back; impact rings and comparative metrics resolve.

Each chapter has a side panel with index, heading, short body and one relevant link.

### S.03 — Modules

- After the 3D journey, a dark editorial bento grid of the existing module cards.
- Keep current links and `TiltCard` interaction.
- First two cards larger; remaining cards in a balanced grid.
- Fix the current copy mismatch: the intro says “Ten connected modules” but the array contains nine.

### S.04 — System in Numbers

- Keep live API metrics, loading state, failure state and retry.
- Present as a HUD strip / instrument panel rather than four generic cards.

### S.05 — Finale

- Camera pulls away until city lights recede.
- Final CTA: “Ask the city. Test a policy.”
- Preserve footer.

---

## 3. 3D Technical Plan

### Scene

Replace/extend `apps/web/app/_shared/hero-scene.tsx` with a more capable `city-scene.tsx`:

- Procedural Attic basin terrain, sea edge, hills, city blocks.
- Simplified low-poly Acropolis plateau/Parthenon silhouette for place identity.
- Instanced buildings for performance.
- Emissive data points, connecting arcs, district rings.
- Scenario layer: translucent alternate massing.
- Impact layer: vertical markers/rings for decision metrics.
- Atmospheric fog, moon/blue-hour lighting, subtle particles.
- No external paid assets required.

### Scroll choreography

Create `apps/web/app/_shared/use-city-journey.ts`:

- Tall sticky wrapper around the 3D stage.
- Native scroll progress mapped to camera keyframes.
- Mutable ref updated via `requestAnimationFrame`; no React state update per frame.
- `IntersectionObserver` pauses rendering when the stage is off-screen.
- Chapter activation drives overlay content, not canvas re-renders.

### Camera and interaction

- Keyframed camera positions + look-at targets with damped interpolation.
- Subtle pointer parallax on desktop.
- Optional limited drag-to-orbit, resetting after inactivity.
- Visible “Pause 3D” control.
- No `drei`, `postprocessing`, or `lenis` dependency unless a concrete need appears; use existing `@react-three/fiber` + `three`.

### Theme

- Dark theme: navy/ink city, cyan data, warm marble highlights.
- Light theme: ivory/marble daylight, Aegean blue water, darker typography.
- Scene palette switches from the existing `useTheme`.

---

## 4. Visual System

- **Palette:** ink `#050a1e`, deep navy `#0b1228`, marble `#e9e2d4`, electric blue `#0052ff`, cyan `#22d3ee`, amber signal `#f5b942`.
- **Type:** keep Geist for reliability and Greek support; use tighter display tracking, oversized headlines and Geist Mono for technical labels. Avoid adding a serif unless it supports Greek.
- **Layout:** 12-column grid, max width ~1440px, generous 96–128px section rhythm.
- **Panels:** dark glass, thin luminous borders, minimal blur, no generic floating-blob gradients.
- **Motion:** slow, damped, 600–900ms easing; scroll-linked camera motion; no bounce except the scroll cue.
- **Texture:** subtle grain/vignette to prevent a flat “WebGL demo” look.

---

## 5. Responsive, Performance and Accessibility

### Desktop

- Full pinned journey at `>= 1024px`.
- Target 60fps with instancing, capped DPR, no shadows, limited draw calls.

### Tablet

- Shorter pinned stage; reduced particle/arc density.

### Mobile

- No long pinned journey.
- Lightweight hero scene or static poster, followed by normal stacked chapters.
- Preserve all content and links.

### Accessibility

- Canvas is `aria-hidden`; all content exists in semantic HTML.
- No scroll trapping or scroll hijacking.
- `prefers-reduced-motion`: static camera, no parallax, no auto motion, chapters render normally.
- Pause control for the 3D scene.
- Keyboard-accessible search, chips, cards and CTAs.
- AA contrast over the scene via controlled overlays.
- Greek/English layouts verified at 360px and 1440px.
- LCP remains text-first; scene is lazily loaded after the hero copy.

---

## 6. File Map

- `apps/web/app/page.tsx` — new page composition.
- `apps/web/app/_shared/city-scene.tsx` — new R3F scene.
- `apps/web/app/_shared/use-city-journey.ts` — scroll/camera controller.
- `apps/web/app/_shared/home-content.ts` — bilingual copy and chapter data.
- `apps/web/app/_shared/home/` — hero, chapters, module grid, metrics HUD, finale.
- `apps/web/app/globals.css` — home tokens, stage utilities, chapter styling, grain/vignette.
- `packages/ui/src/nav.tsx` — optional home-only transparent nav treatment.
- `apps/web/public/brand/` — static poster/fallback if needed.
- Retire `hero-scene.tsx` after the new scene reaches parity.

---

## 7. Phases

1. **Baseline + Next docs** — read the bundled Next 16 guides relevant to dynamic imports, client components and metadata; capture current lint/typecheck/build and homepage performance.
2. **Scene foundation** — terrain, city, camera keyframes, scroll controller, fallback, pause behavior.
3. **Hero + four chapters** — overlay layout, copy, search, CTAs, chapter transitions.
4. **Modules + metrics + finale** — bento grid, live HUD, retry state, CTA.
5. **Polish** — mobile fallback, reduced motion, theme palettes, Greek/English, nav treatment.
6. **Verification** — lint, typecheck, production build, pytest unchanged, responsive/keyboard/reduced-motion checks, Lighthouse pass.

---

## 8. Acceptance Criteria

- All existing home functionality still works: search, example questions, module links, policy CTA, live metrics, retry.
- Greek and English both fit without overflow.
- Reduced-motion users get a static, fully usable page.
- No horizontal scroll or trapped scrolling.
- Desktop scene stays smooth; mobile does not ship the heavy pinned journey.
- Lighthouse accessibility >= 95; no major LCP/CLS regression.
- `npm.cmd run lint`, `npx tsc --noEmit`, `npm.cmd run build` pass.

---

## 9. Decisions

1. **Scope:** full home rewrite with the pinned 3D journey (recommended), or only upgrade the hero and keep the rest mostly as-is?
2. **Theme:** theme-aware light/dark scene (recommended), or a fixed cinematic dark home?
3. **Visual character:** diagrammatic/civic 3D (recommended for credibility), or more photoreal/architectural like Still Form?
