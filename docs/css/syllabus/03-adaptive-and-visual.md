---
title: "Part 3 — Adaptive and visual"
sidebar_label: "3 · Adaptive and visual"
sidebar_position: 3
---

> **Phases 8–11 · 63 topics · 14 Master**
> Making one layout work at every size, and then making it look like something
> a designer signed off.

Deliberately the lightest part for Master. `oklch()`, OpenType feature settings
and scroll-driven animation are things competent engineers look up — marking
them Master would make the badge mean "appears in CSS" rather than "you use this
without documentation open". What *is* Master here is the small set you reach
for daily: media and container queries, a fluid scale, the animation cost model,
and dark mode.

---

## Phase 8 — Responsive and adaptive design

*16 topics.* One document, every viewport, every input device, every user
preference. The modern position is that most of this should need no breakpoint
at all — breakpoints are what you add when intrinsic sizing runs out.

| Topic | Tier |
|---|---|
| **Media queries** — syntax, the features worth knowing, the range syntax (`@media (400px <= width < 900px)`, Baseline 2023-03-27), and combining with `and` / `or` / `not` | <span className="db-tier t-master">Master</span> |
| **Container queries** — `container-type: inline-size`, `container-name`, `@container`; why the component's own width is the correct input and the viewport rarely is. Baseline since 2023-02-14, so this is not a future feature | <span className="db-tier t-master">Master</span> |
| **Layouts that need no query** — `auto-fit` + `minmax()`, `flex-wrap`, `clamp()` and intrinsic sizing; reaching for a breakpoint only when the *design* changes rather than the size | <span className="db-tier t-master">Master</span> |
| **User-preference queries** — `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `prefers-reduced-transparency`, `forced-colors`; the ones that are accessibility requirements rather than polish | <span className="db-tier t-master">Master</span> |
| **Responsive design, defined** — one document that responds, and why "the mobile site" is a maintenance decision you are choosing against | <span className="db-tier t-understand">Understand</span> |
| **The viewport meta tag** — what `width=device-width, initial-scale=1` actually does, and why `user-scalable=no` is an accessibility failure | <span className="db-tier t-understand">Understand</span> |
| **Choosing breakpoints** — from content and from where the layout breaks, never from a list of device names; and why three is usually enough | <span className="db-tier t-understand">Understand</span> |
| **Mobile-first vs desktop-first** — what `min-width` ordering buys in cascade terms, and the cost of mixing the two directions in one file | <span className="db-tier t-understand">Understand</span> |
| **Fluid typography and spacing** — a `clamp()`-based scale, why the middle term needs both a `vw` and a `rem` component, and the zoom failure of a pure-`vw` scale | <span className="db-tier t-understand">Understand</span> |
| **`aspect-ratio` and layout shift** — reserving space for images, video and embeds before they load, and the `width`/`height` attribute pair that does the same job in HTML | <span className="db-tier t-understand">Understand</span> |
| **Container query units** — `cqw`, `cqi`, `cqb`, `cqmin`, `cqmax`; sizing type and space against the component rather than the viewport | <span className="db-tier t-understand">Understand</span> |
| **Capability queries** — `hover`, `any-hover`, `pointer`, `any-pointer`; why hover-only affordances break on touch, and how to write the fallback | <span className="db-tier t-understand">Understand</span> |
| **Images and media in a responsive layout** — `object-fit`, `object-position`, background sizing, and the boundary where `srcset` / `<picture>` are the right layer instead of CSS | <span className="db-tier t-understand">Understand</span> |
| **Mobile viewport units in practice** — `dvh` for the URL bar that resizes under you, and why `100vh` on mobile has been wrong for a decade | <span className="db-tier t-understand">Understand</span> |
| **Testing a responsive layout** — device emulation, what emulation cannot tell you (real scrollbars, real fonts, real touch targets), and a check procedure | <span className="db-tier t-understand">Understand</span> |
| Style queries — `@container style(--variant: compact)`, querying a custom property instead of a size, and where that beats a class | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take a card component and make it change
layout based on the space *it* has — dropped into a sidebar and into a full-width
row, with no viewport media query and no props.

---

## Phase 9 — Typography and text

*15 topics.* Most of a page is text, and most of the perceived quality of a page
is typography. This phase is also where the largest single performance decision
on many sites lives: web fonts.

| Topic | Tier |
|---|---|
| **`font-size` and a type scale** — a ratio-based scale in `rem`, why the root size should stay at the user's default, and what hard-coded `px` type costs a zoomed reader | <span className="db-tier t-master">Master</span> |
| **`line-height`** — unitless vs unit values, and why unitless is nearly always correct: a unit value inherits the computed length, so a large heading inherits a small line box | <span className="db-tier t-master">Master</span> |
| **Wrapping, breaking and truncating** — `overflow-wrap: anywhere` vs `word-break`, `hyphens`, `text-wrap: balance` for headings, single-line ellipsis, and line clamping. The layer where long user-supplied strings destroy layouts | <span className="db-tier t-master">Master</span> |
| **Font stacks and fallbacks** — generic families, a system font stack, and the metric-mismatch shift you get when the fallback is a different width | <span className="db-tier t-understand">Understand</span> |
| **`@font-face` and self-hosting** — `src` with `format()`, `unicode-range` subsetting, and why self-hosting beats a third-party font CDN in 2026 | <span className="db-tier t-understand">Understand</span> |
| **`font-display`** — `swap`, `optional`, `block`, `fallback`; the FOUT/FOIT trade-off stated as a decision rather than a default | <span className="db-tier t-understand">Understand</span> |
| **Web font performance** — `preload`, subsetting, `size-adjust` and the fallback-metric properties, and the layout shift a font swap causes | <span className="db-tier t-understand">Understand</span> |
| **Variable fonts** — one file instead of nine, `font-weight` as a range, `font-variation-settings` vs the high-level properties, and when the single file is actually bigger | <span className="db-tier t-understand">Understand</span> |
| **Readability constraints** — measure in `ch`, line length, contrast, and the defaults that make body text readable before any design is applied | <span className="db-tier t-understand">Understand</span> |
| **`text-decoration` in full** — `text-decoration-thickness`, `-offset`, `text-decoration-skip-ink`, and underlines that do not cut through descenders | <span className="db-tier t-understand">Understand</span> |
| **Writing modes and direction** — `writing-mode`, `direction`, `text-orientation`; how an RTL layout mirrors and what logical properties already did for you | <span className="db-tier t-understand">Understand</span> |
| Spacing text — `letter-spacing` (and why it is wrong for lowercase body text), `word-spacing`, `text-indent`, `text-align` including `justify`'s river problem | <span className="db-tier t-know">Know</span> |
| `text-transform`, `font-variant-caps` and small caps — and why `text-transform: uppercase` changes what a screen reader may announce | <span className="db-tier t-know">Know</span> |
| OpenType features — `font-feature-settings`, `font-variant-numeric`; tabular figures for tables and totals, ligatures, and the two that are worth switching on by default | <span className="db-tier t-know">Know</span> |
| Optical alignment — `text-box-trim` / `text-box-edge` for removing the half-leading above a heading, and where the design system pays for it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can add a self-hosted web font to a page without
introducing a layout shift, and say what each of `font-display`,
`preload` and `size-adjust` contributed.

---

## Phase 10 — Color, backgrounds, borders and effects

*16 topics.* Everything painted inside the box. The 2026 story here is real:
color left sRGB, and `oklch()` plus `color-mix()` changed how design systems are
built — one brand token can now generate a whole state palette.

| Topic | Tier |
|---|---|
| **Color notations and spaces** — hex, `rgb()`, `hsl()` and the space-separated modern syntax; then `oklch()`, `lab()` and `color()`, why HSL's lightness lies and OkLCh's does not, and why that matters for a token scale. Oklab/OkLCh Baseline since 2023-05-09 | <span className="db-tier t-master">Master</span> |
| **`color-mix()`** — deriving hover, active, disabled and border tones from a single brand token instead of hand-picking nine hex values. Baseline since 2023-05-09 | <span className="db-tier t-master">Master</span> |
| **Backgrounds** — `background-image`, `-size`, `-position`, `-repeat`, `-clip`, `-origin`, `-attachment`, multiple comma-separated layers, and the shorthand's reset behaviour | <span className="db-tier t-master">Master</span> |
| **Dark mode done properly** — semantic tokens rather than inverted colors, `color-scheme` so form controls and scrollbars follow, `light-dark()` (Baseline 2024-05-13), and an explicit override that beats the system preference | <span className="db-tier t-master">Master</span> |
| **`currentColor`, `transparent` and alpha** — inheriting one color into borders, SVG fills and shadows; and why `transparent` is `rgb(0 0 0 / 0)` in a gradient | <span className="db-tier t-understand">Understand</span> |
| **Gradients** — linear, radial and conic; hard stops for stripes, double-position stops, and setting the interpolation space to fix the grey dead zone in the middle of a two-color gradient | <span className="db-tier t-understand">Understand</span> |
| **Borders and `border-radius`** — the two-axis slash syntax for ellipses, how radii shrink when they overlap, and matching an inner radius to an outer one | <span className="db-tier t-understand">Understand</span> |
| **`outline` vs `border` vs `box-shadow`** — outline does not affect layout and follows `border-radius`, which is exactly why focus rings use it | <span className="db-tier t-understand">Understand</span> |
| **`box-shadow` and `text-shadow`** — spread, inset, layering several shadows for a believable elevation, and why one big blur looks cheap | <span className="db-tier t-understand">Understand</span> |
| **`opacity`** — that it creates a stacking context and applies to the element as a rendered whole, which is what makes it different from an alpha color value | <span className="db-tier t-understand">Understand</span> |
| **Relative color syntax** — `oklch(from var(--brand) l c h / 40%)`; deriving a color from another in place. `web-features` reports it Baseline **Newly available** (2024-09-16), so pair it with a fallback | <span className="db-tier t-understand">Understand</span> |
| **`filter` and `backdrop-filter`** — the frosted-glass panel, and the side effects: a new containing block for fixed children, a stacking context, and real paint cost | <span className="db-tier t-understand">Understand</span> |
| **Clipping and masking** — `clip-path` for non-rectangular shapes, `mask-image` for fading an edge, and `shape-outside` for text that wraps a shape | <span className="db-tier t-understand">Understand</span> |
| **Images in CSS** — `image-set()` for density switching, background vs `<img>` and the accessibility line between them, and inline SVG vs an SVG background | <span className="db-tier t-understand">Understand</span> |
| **`accent-color`** — recolouring native checkboxes, radios and progress bars in one line. Note `web-features` still reports it **not Baseline**, so it degrades rather than being relied on | <span className="db-tier t-know">Know</span> |
| Blend modes — `mix-blend-mode` and `background-blend-mode`, the handful that are actually useful (`multiply`, `screen`, `overlay`), and their compositing cost | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can build a themable palette from three OkLCh
brand tokens, generate every state color with `color-mix()`, and switch the
whole thing to dark mode without writing a second set of color values.

---

## Phase 11 — Transforms, transitions and animation

*16 topics.* Motion, and the cost model behind it. The organising idea is that
only two properties are cheap to animate, and everything in this phase is
downstream of that.

| Topic | Tier |
|---|---|
| **What is cheap to animate** — `transform` and `opacity` are compositor-only; `width`, `height`, `top`, `left`, `margin` and `padding` force layout on every frame. The list is short and it decides how you build every animation | <span className="db-tier t-master">Master</span> |
| **`transition`** — the four sub-properties, which properties are animatable at all, transitioning a specific list rather than `all`, and reading the shorthand's ambiguous two-time form | <span className="db-tier t-master">Master</span> |
| **`prefers-reduced-motion`** — implemented properly: reduce or replace the motion, do not delete the state change; the global kill-switch pattern and why it is not always enough | <span className="db-tier t-master">Master</span> |
| **`transform`** — `translate`, `scale`, `rotate`, `skew`, the fact that order changes the result, and the individual `translate`/`rotate`/`scale` properties that let you animate them independently | <span className="db-tier t-understand">Understand</span> |
| **Transition traps** — you cannot transition to or from `auto`, an element must exist and have a starting value, and `display: none` cancels everything. The three reasons a transition "doesn't fire" | <span className="db-tier t-understand">Understand</span> |
| **Entry and exit animation** — `@starting-style` and `transition-behavior: allow-discrete` (both Baseline 2024-08-06), and `interpolate-size` / `calc-size()` for height-to-auto, which `web-features` reports as **not Baseline** | <span className="db-tier t-understand">Understand</span> |
| **`@keyframes` and the `animation` shorthand** — the nine sub-properties, percentage keyframes, and when a keyframe animation is the wrong choice over a transition | <span className="db-tier t-understand">Understand</span> |
| **`animation-fill-mode` and friends** — `forwards`/`backwards`/`both`, `iteration-count`, `direction`, `play-state`, and the negative `animation-delay` trick for starting mid-cycle | <span className="db-tier t-understand">Understand</span> |
| **Easing** — `cubic-bezier()` read as a curve, `steps()` for sprite and typewriter effects, and `linear()` for spring-like motion without a library | <span className="db-tier t-understand">Understand</span> |
| **Animating custom properties** — why an untyped custom property jumps instead of animating, and how `@property` with a `syntax` fixes it | <span className="db-tier t-understand">Understand</span> |
| **`transform-origin`, `perspective` and 3D** — `transform-style: preserve-3d`, `backface-visibility`, and the card-flip built correctly | <span className="db-tier t-understand">Understand</span> |
| **`will-change`** — the narrow window where it helps, and the memory cost of leaving it on a hundred elements | <span className="db-tier t-understand">Understand</span> |
| **Debugging animation performance** — the DevTools animation and performance panels, spotting a layout-triggering property, and reading dropped frames | <span className="db-tier t-understand">Understand</span> |
| Scroll-driven animations — `animation-timeline: scroll()` and `view()`, `scroll-timeline`, and animation ranges. `web-features` reports **not Baseline** as of 2026-08, so it ships as enhancement only | <span className="db-tier t-know">Know</span> |
| View transitions — `view-transition-name`, the `::view-transition-*` pseudo-element tree, and cross-document transitions. Baseline **Newly available** (2025-10-14) | <span className="db-tier t-know">Know</span> |
| Where CSS animation stops — the boundary with the Web Animations API and JS animation libraries, and the three cases that genuinely need script | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can animate a dialog in *and* out, with a
`prefers-reduced-motion` variant, using only compositor-friendly properties —
and explain why the exit animation needed `allow-discrete`.

---

## Where this connects

- **Phase 8 → Phase 13** — container queries are what make a component
  genuinely self-contained, which is the premise of the whole architecture
  phase.
- **Phase 10 → Phase 13** — OkLCh plus `color-mix()` is the mechanism; a token
  system is the structure built on it.
- **Phase 11 → Phase 14** — the compositor-only property list *is* the
  rendering-performance chapter, applied to motion.
- **Phase 11 → JavaScript Phase 12** — `requestAnimationFrame` and the Web
  Animations API belong to the JavaScript syllabus; the boundary is that CSS
  owns declarative motion and JS owns motion that depends on computation.
- **Deliberately not here:** how styles reach a component, and how tokens are
  organised in a real repository. Those are Phase 13.

---

← [Part 2 — Layout](./02-layout.md) · Next: [Part 4 — CSS in a real application](./04-at-scale.md) →
