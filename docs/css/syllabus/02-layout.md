---
title: "Part 2 — Values and layout"
sidebar_label: "2 · Values and layout"
sidebar_position: 2
---

> **Phases 3–5 · 36 topics · 17 Master**
> Custom properties as runtime machinery, then **Flexbox and Grid in depth** —
> the two systems the brief names, and the largest part of this syllabus.

Flexbox and Grid get 28 topics between them. Not because the syntax is large, but
because the questions that actually break layouts — why a flex item refuses to
shrink, why a grid track blows out, when `1fr` is not `50%` — are all in the
sizing algorithms, not the property list.

---

## Phase 3 — Custom properties and modern values

*8 topics.* Custom properties are not variables; they are inherited runtime
values that participate in the cascade. That is what makes theming, component
APIs and animatable tokens possible.

| Topic | Tier |
|---|---|
| **Custom properties as a component API** — `var(--x, fallback)`, scoping per subtree, setting one from script or an inline attribute, and why the *rule* stays in CSS while the *value* comes from outside | <span className="db-tier t-master">Master</span> |
| **`clamp()`, `min()`, `max()`** — fluid sizing with no media query; reading `clamp(min, preferred, max)`, and why the preferred term always needs a `rem` component for zoom safety | <span className="db-tier t-master">Master</span> |
| **`@property`** — typed custom properties with `syntax`, `inherits` and `initial-value`; the type is what makes a custom property **animatable** and what makes a bad value fail early | <span className="db-tier t-master">Master</span> |
| **The custom-property patterns worth stealing** — the `--gap: initial` toggle, per-variant tokens, `--shadow-color` composition, and space toggles for conditional styling | <span className="db-tier t-understand">Understand</span> |
| `calc()` and unit arithmetic — mixing units, the mandatory whitespace, nesting inside other functions | <span className="db-tier t-understand">Understand</span> |
| Units that matter for layout — `rem` vs `em` compounding, `ch`, `dvh` and the mobile URL bar, and what each percentage resolves *against* | <span className="db-tier t-understand">Understand</span> |
| The invalid-at-computed-value-time rule — one malformed `var()` makes the property `unset` rather than falling back | <span className="db-tier t-understand">Understand</span> |
| `aspect-ratio` and intrinsic sizing keywords — `min-content`, `max-content`, `fit-content()` | <span className="db-tier t-understand">Understand</span> |

**Gate:** you can build a component whose spacing, colour and variant are all
driven by custom properties a consumer can override — without exposing a single
extra class.

---

## Phase 4 — Flexbox, deeply

*12 topics.* Named in the brief. The bar is not "can you centre a div" — it is
whether you can predict what happens when the content is wider than the
container, which is where every real flexbox bug lives.

| Topic | Tier |
|---|---|
| **The flex sizing algorithm** — how free space is distributed, in order: base sizes, then grow or shrink, then alignment. Almost every "flexbox is weird" moment is this algorithm doing exactly what it says | <span className="db-tier t-master">Master</span> |
| **The automatic minimum size** — a flex item will not shrink below its content's `min-content` size; `min-width: 0` as the fix. **The single most common flexbox bug** | <span className="db-tier t-master">Master</span> |
| **`flex` shorthand, properly** — what `flex: 1` expands to (`1 1 0%`) versus `flex: auto` (`1 1 auto`), and why that is the difference between equal columns and content-proportional ones | <span className="db-tier t-master">Master</span> |
| **`flex-basis` vs `width`** — which wins, what `basis: auto` falls back to, and how `flex-shrink` weights by basis rather than shrinking equally | <span className="db-tier t-master">Master</span> |
| **Main and cross axis** — how `flex-direction` redefines every `justify-*` and `align-*` property, and why alignment looks broken when you forget | <span className="db-tier t-master">Master</span> |
| **Flexbox patterns that carry real applications** — nav bar with a pushed group, media object, sticky footer, truncating middle item, input-with-button, toolbar that wraps | <span className="db-tier t-master">Master</span> |
| `justify-content`, `align-items`, `align-self` — including `stretch` as the default, and what each does with a single item | <span className="db-tier t-understand">Understand</span> |
| `align-content` and wrapping — the property that does nothing until the container wraps, and why it is the most-reported "broken" one | <span className="db-tier t-understand">Understand</span> |
| Auto margins in flex — pushing one item away from the rest, and where it beats `justify-content` | <span className="db-tier t-understand">Understand</span> |
| `gap` in flex — and why it is not affected by `space-between` the way margins were | <span className="db-tier t-understand">Understand</span> |
| Flexbox and text overflow — the `min-width: 0` + `overflow: hidden` + `text-overflow` chain, and why ellipsis inside flex fails without it | <span className="db-tier t-understand">Understand</span> |
| `order`, `row-reverse`, and the accessibility rule that DOM order stays the reading and tab order | <span className="db-tier t-know">Know</span> |

**Gate:** you can build a nav bar whose middle item truncates with an ellipsis
while the right-hand group stays fixed — and explain exactly why it needed
`min-width: 0`.

---

## Phase 5 — Grid, deeply

*16 topics.* Named in the brief, and the largest phase. Grid has genuinely more
surface than flexbox, and `auto-fit` + `minmax()` is the highest-leverage single
idiom in modern CSS layout.

| Topic | Tier |
|---|---|
| **`repeat()`, `minmax()`, `auto-fit` vs `auto-fill`** — the responsive card grid with **no media query at all**, and the exact difference between the two keywords | <span className="db-tier t-master">Master</span> |
| **`fr` and the track sizing algorithm** — how free space is distributed, why `1fr` is not `50%` once there is a gap, and why `1fr` means `minmax(auto, 1fr)` | <span className="db-tier t-master">Master</span> |
| **The `minmax(0, 1fr)` fix** — the track that refuses to shrink because its content has a `min-content` floor. The grid equivalent of `min-width: 0` | <span className="db-tier t-master">Master</span> |
| **Named areas** — `grid-template-areas` as ASCII art, and redrawing an entire page shell in one media query | <span className="db-tier t-master">Master</span> |
| **Line-based placement** — `grid-column: 1 / 3`, `span`, negative line numbers, and `grid-area`'s four-value order | <span className="db-tier t-master">Master</span> |
| **Subgrid** — Baseline since 2023; aligning a nested card's internals to the parent's tracks, which was impossible before | <span className="db-tier t-master">Master</span> |
| **Grid patterns that carry real applications** — the page shell, the 12-column layout, the full-bleed content grid with named line pairs, the overlapping hero, the auto-fit card grid | <span className="db-tier t-master">Master</span> |
| **Alignment in grid** — `justify-items`/`align-items` for items in cells vs `justify-content`/`align-content` for tracks in the container; six properties constantly confused | <span className="db-tier t-master">Master</span> |
| Explicit vs implicit grid — `grid-auto-rows`/`columns`, `grid-auto-flow`, and where surprise tracks come from | <span className="db-tier t-understand">Understand</span> |
| Named grid lines — the `[full-start] … [full-end]` convention, and `span` with names | <span className="db-tier t-understand">Understand</span> |
| Track sizing against content — `auto`, `min-content`, `max-content` tracks, and when each is right | <span className="db-tier t-understand">Understand</span> |
| Grid and long content — why one unbreakable string blows out a track, and the `overflow-wrap` + `min-width: 0` interaction | <span className="db-tier t-understand">Understand</span> |
| The auto-placement algorithm — fill order, `dense` packing, and the reading-order cost `dense` imposes | <span className="db-tier t-understand">Understand</span> |
| Grid vs flexbox vs flow — a decision procedure, not a preference | <span className="db-tier t-understand">Understand</span> |
| `display: contents` — dissolving a wrapper into the parent grid, and the accessibility caveat | <span className="db-tier t-know">Know</span> |
| Masonry / `item-flow` — where it stands in 2026, and what to ship instead today | <span className="db-tier t-know">Know</span> |

**Gate:** you can write a card grid that goes four columns to one with **no
media queries**, and a page shell in named areas that rearranges in exactly one
— explaining `auto-fit` vs `auto-fill` from the rendered result.

---

## Where this connects

- **Phase 3 → Phase 8** — `color-mix()` on custom properties is how a whole
  state palette comes from one token.
- **Phase 3 → Phase 11** — typed custom properties are what make a design-token
  system animatable rather than merely organised.
- **Phase 4 → Phase 5** — `min-width: 0` and `minmax(0, 1fr)` are the same
  problem in two layout systems.
- **Phase 5 → Phase 6** — `auto-fit` + `minmax()` and container queries are the
  two halves of layout that adapts without breakpoints.

---

← [Part 1 — How CSS resolves](./01-how-css-works.md) · Next: [Part 3 — Adaptive, visual, motion](./03-adaptive-and-visual.md) →
