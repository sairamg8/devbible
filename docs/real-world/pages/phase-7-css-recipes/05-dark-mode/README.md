---
title: "Dark mode"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — MDN's colour-scheme, `light-dark()`, `color-mix()`,
> `@property`, storage-event and `theme-color` references, the W3C CSS Color
> Adjustment Level 1 and Properties-and-Values Level 1 specifications, WCAG 2.2
> SC 1.4.3 / 1.4.6 / 1.4.11, and the React `useSyncExternalStore` reference.
> Each chunk names its own sources. Concept home:
> [CSS 8·03 — Dark mode properly](../../../../css/pages/phase-8-color-theming/03-dark-mode-properly.md)
> owns the token argument and the `color-scheme` mechanism; nothing here repeats
> either. No sandbox, no measured timings.

**The token layer, honouring the three viewer states.** The mechanism is
short — semantic tokens, redefined per theme — and the storefront-specific work
is everything around it: a third state the media query cannot express, colours
that carry meaning rather than decoration, product photography that must never
be inverted, and four browser-drawn surfaces `color-scheme` does not reach.

The chapter's spine is one sentence: **`prefers-color-scheme` resolves to light
or dark for everyone, so CSS alone cannot tell a user who chose from a user who
did not.** The attribute that recovers the third state is what every later
decision is built on.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Three viewer states, not two](01-three-states-not-two.md) | Why the media query is not enough, the three-block selector structure, and the six system/stored combinations it has to cover |
| 02 | [The token layer](02-the-token-layer.md) | The roles a storefront has that a generic palette does not — stock, order status, price, rating, danger, chart series — and the per-theme contrast obligations |
| 02b | [Deriving and deduplicating](02b-deriving-and-deduplicating.md) | `light-dark()` versus a generated block; `color-mix()` toward a *themed* target; what must never be derived; `@property` |
| 03 | [The flash and the boot](03-the-flash-and-the-boot.md) | The one render-blocking script this app ships, why `type="module"` cannot do it, the CSP hash, and a toggle label CSS renders so it cannot mismatch |
| 04 | [Images and media](04-images-media-and-controls.md) | 🔴 Never invert product photography; the deliberately un-themed image plate; the `<picture>` logo trap that only breaks for overriding users |
| 04b | [Controls and canvas](04b-controls-the-browser-draws.md) | `accent-color`, `::placeholder` opacity, the autofill remediation, why canvas keeps a stale palette, and `forced-colors` |
| 05 | [Persisting and syncing](05-persisting-and-syncing.md) | The three-state cycle, the `storage` event's no-echo semantics, why `matchMedia` notifies rather than applies, and the `theme-color` override |
| 05b | [React, motion and bfcache](05b-consuming-the-theme-in-react.md) | `useSyncExternalStore` over `useState`; suppressing transitions for one frame instead of adding one; the restored page that missed every event |
| 06 | [The complete theme layer](06-the-complete-stylesheet.md) | The head of `index.html` and the whole token file, with the three palette choices that look like mistakes |
| 06b | [The runtime and the checklist](06b-the-runtime-and-the-checklist.md) | `base.css`, `theme.js`, and the fourteen-item review checklist that catches every failure mode above |

## Four sentences to keep

1. **The absence of the attribute is the system state** — and it is what lets
   CSS follow the OS live with no JavaScript at all. Stamping `data-theme` for a
   system-state visitor is the single most common way this breaks.
2. **Mix toward a themed token, never toward `white` or `black`** — otherwise
   hover lightens in dark mode, where it should darken.
3. **Product photography is never filtered.** Colour fidelity is a commercial
   obligation; frame the image instead.
4. **A handler for an external change must not re-emit that change** — the rule
   behind the two near-identical apply functions.

## Phase gate

You are done with this chapter when you can say why a stored `"system"` string
breaks the third state, place a new colour on the right side of the
role/primitive line, explain what `<picture>` cannot see, name the four surfaces
`color-scheme` leaves behind, and say what the storage handler must not do.

---

← Prev: [Skeleton loaders and spinners](../04-skeletons-and-spinners/README.md) · Index: [Phase 7](../README.md) · Next → [The overlay layer](../06-the-overlay-layer/README.md)
