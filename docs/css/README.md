---
title: "CSS — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **Firefox 153.0.3** (`firefox --version`) on this
> machine, with feature-availability data from **`web-features` 3.34.3**
> (1 186 features). Every version fact and Baseline date in this file came from
> a command run here, not from memory.

The complete topic inventory for CSS, tiered for **mastery in fullstack
application development**. **15 phases, 230 topics**, split into 4 parts to stay
under the 300-line file cap.

The bar is **no knowledge gaps**: every CSS construct you would meet building a
full commerce front end — a page shell, a card grid that reflows, a design-token
system, a themable dark mode, an animated dialog, a form that shows its own
validation state, and a stylesheet that survives a year of other people editing
it — has a row here.

Architectural role: **the layer that decides what the browser paints.** CSS is
declarative and it is *resolved*, not executed — you write constraints, and the
engine computes the result. That one fact is what most of this syllabus is
downstream of: it explains why a typo is silently discarded, why specificity
exists at all, why `height: 100%` often does nothing, and why "it works in my
browser" is a claim about one engine rather than about CSS.

## Scope — what this syllabus owns

**Everything that decides how a document looks, and the architecture that keeps
those decisions maintainable.** The rule is: *if deleting the stylesheet would
delete the topic, it is CSS's.*

| Concern | Home |
|---|---|
| Selectors, cascade, box model, layout, typography, color, motion | **CSS** |
| `classList`, inline `style`, reading/writing custom properties from script | **JavaScript** (Phase 9 — DOM) |
| The `requestAnimationFrame` loop, layout thrashing measured from script | **JavaScript** (Phases 9 and 12) |
| Which CSS properties are cheap to animate, and why | **CSS** (Phase 11) |
| HTML semantics and which element to reach for | Assumed, not taught here |
| Component structure, props, re-render behaviour | **React** |
| *Getting styles onto* a React component — CSS Modules, Tailwind, the `className` decision | **CSS** (Phase 13) |
| Serving, compressing and caching CSS over HTTP | **Nginx** / **Express** |
| Which bytes to send and when to send them | **CSS** (Phase 14) |

The JavaScript syllabus already points here: its Phase 12 row set names
`prefers-reduced-motion` and container queries as the place where animation work
meets CSS. Neither syllabus re-explains the other.

## Version facts

All measured on this machine, 2026-08-13:

| | |
|---|---|
| Engine available locally | **Firefox 153.0.3** (Gecko). `navigator.userAgent` reports `rv:153.0` |
| Chromium / WebKit | **Not installed.** No Blink or WebKit build exists on this machine |
| Scripted verification | **`puppeteer-core` 25.6.0** driving `/usr/bin/firefox` over WebDriver BiDi. Confirmed working: computed styles, bounding boxes and `CSS.supports()` all read back from a real render |
| Feature-availability data | **`web-features` 3.34.3** — the package behind Baseline. Also present on the registry: `caniuse-db` 1.0.30001809 |
| Baseline spot-check | `:has()` **Widely available** (2023-12-19) · Container queries **Widely available** (2023-02-14) · Subgrid **Widely available** (2023-09-15) · Nesting **Widely available** (2023-12-11) |
| Not yet Baseline | Anchor positioning · Scroll-driven animations · Masonry · `calc-size()` · `interpolate-size` · `line-clamp` · `text-wrap: pretty` — all report `baseline: false` |
| Newly available | View transitions (2025-10-14) · `@scope` (2025-12-12) · `content-visibility` (2025-09-15) · **`field-sizing` (2026-06-16)** |

The last row is the reason this syllabus does not take feature availability from
memory: `field-sizing` reached Baseline in **June 2026**, and no amount of
recalling "I think Safari lagged on that" would have produced the date.

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[How CSS works](syllabus/01-how-css-works.md)** | The pipeline, selectors, the cascade, values and custom properties | 0–3 | 56 |
| 2 | **[Layout](syllabus/02-layout.md)** | The box model, flexbox, grid, positioning and stacking | 4–7 | 62 |
| 3 | **[Adaptive and visual](syllabus/03-adaptive-and-visual.md)** | Responsive and container queries, typography, color, motion | 8–11 | 63 |
| 4 | **[CSS in a real application](syllabus/04-at-scale.md)** | Native UI and state, architecture and the stack, performance and accessibility | 12–14 | 49 |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="css" compact />

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 66 | 29 % |
| <span className="db-tier t-understand">Understand</span> | 116 | 50 % |
| <span className="db-tier t-know">Know</span> | 45 | 20 % |
| <span className="db-tier t-when">When Needed</span> | 3 | 1 % |

Master sits inside the brief's 25–30 % band. It concentrates in Parts 1 and 2 —
the cascade and the two layout systems are what you use with no documentation
open, in every file, every day. Part 3 is deliberately lighter: `oklch`,
scroll-driven animation and OpenType features are things you look up, and
pretending otherwise would make the badge meaningless.

## Prerequisites

| | |
|---|---|
| Required | HTML: elements, attributes, the document tree. CSS selects *something*, and this syllabus assumes you know what |
| Required for Phase 13 | **React** basics — Phase 13 decides how styles reach a component, and assumes you know what a component is |
| Pairs with | **JavaScript** Phase 9 (DOM) — the script side of `classList` and custom properties |
| Not required | Any Node, Express or database phase. CSS resolves in the browser, and nothing here needs a server |

## Example policy

Every claim on a CSS page is checked against a **real render**, not against
recollection. A page shows:

| | |
|---|---|
| The code | Complete and runnable — a full HTML file with its stylesheet, no `…` elisions |
| The resolved value | Real `getComputedStyle` output — `grid-template-columns` reported as `160px 160px 160px`, not described as "three equal columns" |
| The geometry | Real `getBoundingClientRect()` numbers where the point of the topic is *where things land* |
| The support claim | Baseline status and date from `web-features`, quoted with the feature key |
| The engine | Named. A measurement is labelled `Firefox 153.0.3` because that is what produced it |

**The single-engine limitation is stated, not hidden.** "Works in Firefox 153"
is not the same claim as "Baseline: Widely available", so the pages keep the two
apart: measured behaviour comes from the local render, and cross-browser
availability comes from `web-features`. Where a topic's whole point is an
engine *difference*, the page says it could not be verified here rather than
inventing the other engine's result.

## Open questions — recorded, not silently decided

1. **Should Chromium be installed for cross-engine checks?** Right now Blink
   behaviour cannot be measured on this machine at all. Baseline data covers
   *whether* a feature ships; it does not cover the rendering differences that
   actually bite (scrollbar sizing, form-control defaults, subpixel rounding).
2. **Do visual topics get checked-in screenshots?** Firefox headless produces
   PNGs, verified working. Gradients, `mix-blend-mode` and `clip-path` are hard
   to convey as numbers — but images add repo weight and cannot be diffed.
3. **How deep does Phase 13 go on Tailwind, Sass and CSS-in-JS?** Currently
   scoped as "enough to choose between them and use the chosen one well", with
   the React-specific half deferred to the React syllabus.

## Explanations

The explanations will live in **`pages/`** — one page per topic (or tight
group), with code, gotchas and interview questions. **Nothing is written yet**;
this syllabus is the proposal.

## Tier legend

| Badge | Bar to clear |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; looking up exact syntax is fine |
| <span className="db-tier t-know">Know</span> | Know what, why and when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

---

Start → [Part 1 — How CSS works](syllabus/01-how-css-works.md)
