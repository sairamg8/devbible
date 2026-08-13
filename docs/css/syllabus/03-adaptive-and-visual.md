---
title: "Part 3 — Adaptive, visual, motion"
sidebar_label: "3 · Adaptive and visual"
sidebar_position: 3
---

> **Phases 6–9 · 30 topics · 12 Master**
> Container queries, stacking, modern colour, and the animation cost model.

Deliberately narrow. This is not a typography or print course — it is the four
areas where modern CSS changed how the work is done: components that respond to
*their own* size, the stacking rules behind every dropdown bug, colour that a
design system can compute, and knowing which properties are free to animate.

---

## Phase 6 — Container queries and intrinsic responsive

*8 topics.* The modern position: most responsive behaviour should need **no
breakpoint at all**. Breakpoints are what you add when intrinsic sizing runs out.

| Topic | Tier |
|---|---|
| **Container queries** — `container-type: inline-size`, `container-name`, `@container`; why the component's own width is the correct input and the viewport rarely is. Baseline since 2023-02-14 | <span className="db-tier t-master">Master</span> |
| **Layouts that need no query** — `auto-fit` + `minmax()`, `flex-wrap`, `clamp()`; reaching for a breakpoint only when the *design* changes rather than the size | <span className="db-tier t-master">Master</span> |
| **User-preference queries** — `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`; the ones that are requirements rather than polish | <span className="db-tier t-master">Master</span> |
| **Container query units** — `cqw`, `cqi`, `cqb`; sizing type and space against the component | <span className="db-tier t-understand">Understand</span> |
| Media queries, modern syntax — the range form `(400px <= width < 900px)`, and choosing breakpoints from content rather than device names | <span className="db-tier t-understand">Understand</span> |
| The containment cost of `container-type` — what declaring a container actually constrains, and the size-containment trap on block-size | <span className="db-tier t-understand">Understand</span> |
| Capability queries — `hover`, `any-hover`, `pointer`; why hover-only affordances break on touch | <span className="db-tier t-understand">Understand</span> |
| Style queries — `@container style(--variant: compact)`, and where querying a custom property beats a class | <span className="db-tier t-know">Know</span> |

**Gate:** you can drop one card component into a sidebar and a full-width row and
have it change layout correctly — no viewport media query, no props.

---

## Phase 7 — Positioning, stacking and overlay

*7 topics.* Small, and responsible for a disproportionate share of production
bugs: dropdowns clipped by a scroll container, and `z-index: 9999` that changes
nothing.

| Topic | Tier |
|---|---|
| **Stacking contexts** — the full list of what creates one (`z-index` on positioned, `opacity` &lt; 1, `transform`, `filter`, `will-change`, `isolation`, `contain`), and why a child can never escape its parent's | <span className="db-tier t-master">Master</span> |
| **`z-index` in practice** — how it resolves *within* a context, why `9999` fails while `1` works, and `isolation: isolate` as the deliberate fix | <span className="db-tier t-master">Master</span> |
| **`position: sticky`** — the three conditions that make it silently do nothing | <span className="db-tier t-master">Master</span> |
| **The clipped-dropdown problem** — `overflow: hidden` ancestors, and why the top layer is the real fix | <span className="db-tier t-understand">Understand</span> |
| The top layer — `<dialog>`, `[popover]` and `::backdrop` painting above everything regardless of `z-index` | <span className="db-tier t-understand">Understand</span> |
| The containing block — which ancestor each property resolves against, and the `transform`/`filter`/`contain` trap that breaks `position: fixed` | <span className="db-tier t-understand">Understand</span> |
| Anchor positioning — `anchor-name`, `position-area`, `position-try-fallbacks`; **not Baseline**, so `@supports` only | <span className="db-tier t-know">Know</span> |

**Gate:** you can explain why a `z-index: 1` element paints over a `z-index: 100`
one, by naming the stacking context each belongs to.

---

## Phase 8 — Colour and theming

*7 topics.* Colour left sRGB, and `oklch()` plus `color-mix()` changed how design
systems are built — one brand token can now generate an entire state palette.

| Topic | Tier |
|---|---|
| **`oklch()` and perceptual colour** — why HSL's lightness lies and OkLCh's does not, and what that means for a token scale that must stay legible at every step | <span className="db-tier t-master">Master</span> |
| **`color-mix()`** — deriving hover, active, disabled and border tones from one brand token instead of hand-picking nine hex values | <span className="db-tier t-master">Master</span> |
| **Dark mode properly** — semantic tokens rather than inverted colours, `color-scheme` so native controls follow, `light-dark()`, and an explicit override that beats the system preference | <span className="db-tier t-master">Master</span> |
| **Relative colour syntax** — `oklch(from var(--brand) l c h / 40%)`; deriving in place | <span className="db-tier t-understand">Understand</span> |
| Gradients that do not go grey in the middle — interpolation space, hard stops, double-position stops | <span className="db-tier t-understand">Understand</span> |
| `currentColor` and composition — one inherited colour driving borders, SVG fills and shadows | <span className="db-tier t-understand">Understand</span> |
| Contrast as a system property — encoding contrast **pairs** in tokens rather than hoping, and why a generated palette still needs checking | <span className="db-tier t-understand">Understand</span> |

**Gate:** you can build a themable palette from three OkLCh brand tokens,
generate every state colour with `color-mix()`, and switch to dark mode without
writing a second set of colour values.

---

## Phase 9 — Motion and the cost model

*8 topics.* The organising idea: only two properties are cheap to animate, and
everything here is downstream of that.

| Topic | Tier |
|---|---|
| **What is cheap to animate** — `transform` and `opacity` are composite-only; `width`, `height`, `top`, `margin` force layout every frame. The list is short and it decides how you build every animation | <span className="db-tier t-master">Master</span> |
| **Transition traps** — you cannot transition to or from `auto`, `display: none` cancels everything, and an element must exist with a starting value | <span className="db-tier t-master">Master</span> |
| **`prefers-reduced-motion`** — implemented properly: reduce or replace the motion, never delete the state change | <span className="db-tier t-master">Master</span> |
| **Entry and exit animation** — `@starting-style`, `transition-behavior: allow-discrete`, and the height-to-`auto` problem | <span className="db-tier t-understand">Understand</span> |
| Animating custom properties — why an untyped one jumps, and how `@property` fixes it | <span className="db-tier t-understand">Understand</span> |
| Easing that does not look cheap — `cubic-bezier()` read as a curve, `steps()`, and `linear()` for spring motion without a library | <span className="db-tier t-understand">Understand</span> |
| `will-change` and layer promotion — the narrow window where it helps and the memory cost of leaving it on | <span className="db-tier t-understand">Understand</span> |
| Scroll-driven animations and View Transitions — where each stands in 2026, and what to ship today | <span className="db-tier t-know">Know</span> |

**Gate:** you can animate a dialog in *and* out, with a reduced-motion variant,
using only compositor-friendly properties — and say why the exit needed
`allow-discrete`.

---

## Where this connects

- **Phase 6 → Phase 11** — container queries are what make a component genuinely
  self-contained, which is the premise of the architecture phase.
- **Phase 7 → Phase 9** — stacking contexts are created by `transform`,
  `opacity` and `will-change`; the two phases describe one mechanism from
  opposite ends.
- **Phase 8 → Phase 10** — colour functions are native now, which is a direct
  subtraction from what Sass colour helpers were for.
- **Phase 9 → JavaScript Phase 12** — `requestAnimationFrame` and the Web
  Animations API are the JavaScript syllabus; CSS owns declarative motion.

---

← [Part 2 — Values and layout](./02-layout.md) · Next: [Part 4 — SCSS and architecture](./04-at-scale.md) →
