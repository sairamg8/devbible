---
title: "Phase 0 — How CSS runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 in **Firefox 153.0.3**, with feature data from
> **`web-features` 3.34.3**. Every console block in this phase was produced by a
> script in `sandbox/css/`, named on the page that uses it.

**12 topics.** What the browser does with a stylesheet, what it does with your
mistakes, and how you decide whether a 2026 feature is safe to ship. Nothing here
is about layout — it is the mental model everything else sits on.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [What CSS is](./01-what-css-is.md) | <span className="db-tier t-understand">Understand</span> | Declarative and *resolved*, not executed — so you debug by asking which rule won |
| 02 | [The rendering pipeline](./02-the-rendering-pipeline.md) | <span className="db-tier t-master">Master</span> | Style → layout → paint → composite, and which stage each property costs |
| 03 | [Getting CSS to the page](./03-how-stylesheets-reach-the-page.md) | <span className="db-tier t-understand">Understand</span> | Four ways in; `@import` costs a full round trip, measured |
| 04 | [Render-blocking CSS](./04-render-blocking-css.md) | <span className="db-tier t-understand">Understand</span> | 47 ms with no CSS, 671 ms with one delayed stylesheet |
| 05 | [CSS fails silently](./05-css-fails-silently.md) | <span className="db-tier t-master">Master</span> | Zero console output for four different kinds of mistake |
| 06 | [User-agent stylesheets](./06-user-agent-stylesheets.md) | <span className="db-tier t-understand">Understand</span> | Every default, with its real value |
| 07 | [Resets and normalisers](./07-resets-and-normalisers.md) | <span className="db-tier t-understand">Understand</span> | Six lines, each one justified against a measured default |
| 08 | [The at-rule map](./08-the-at-rule-map.md) | <span className="db-tier t-understand">Understand</span> | Eleven at-rules, where each is covered, and the whole-block drop |
| 09 | [`@supports`](./09-supports-feature-queries.md) | <span className="db-tier t-understand">Understand</span> | Feature queries, and why the fallback usually needs no query at all |
| 10 | [Baseline](./10-baseline-and-shipping.md) | <span className="db-tier t-master">Master</span> | The shipping decision as data, not memory |
| 11 | [Vendor prefixes](./11-vendor-prefixes.md) | <span className="db-tier t-know">Know</span> | Mostly dead; the exceptions are not the ones you would guess |
| 12 | [DevTools for CSS](./12-devtools-for-css.md) | <span className="db-tier t-master">Master</span> | The error console the language does not have |

## What the measurements changed

Five results that contradict something commonly written or assumed:

1. **A non-matching `media` stylesheet does not delay the first paint.** Floor
   with no CSS 47 ms · `media="print"` **38 ms** · unmatched width query 53 ms ·
   matching stylesheet **671 ms** against a 600 ms server delay. An earlier,
   confounded run measured print at 971 ms and would have put prose on the page
   contradicting the number printed beneath it.
2. **`@import` roughly doubles time to first paint.** Identical bytes, each file
   delayed 500 ms: two parallel `<link>`s started their requests **1 ms** apart
   and painted at 636 ms; chained by `@import` the second request started
   **532 ms** later and the page painted at **1076 ms**.
3. **An invalid *selector* discards the entire rule**, while an invalid
   *declaration* is dropped alone. `.c, ::nonsense { color: green }` left `.c`
   black; `:is(.d, ::nonsense)` kept `.d` green. And an unclosed brace ate the
   following rule — five authored, four in the CSSOM.
4. **Firefox 153 ships two features that are not Baseline** — anchor positioning
   and `accent-color` both return `true` from `CSS.supports` while
   `web-features` reports them Limited availability. "It works in my browser" is
   how those reach production broken.
5. **`-webkit-line-clamp` is still required** (unprefixed `line-clamp` is
   `false`), while **`-moz-border-radius` is `false`** — Mozilla dropped its own
   prefix. Prefixes are neither permanent nor uniformly dead.

## Where this connects

- **→ Phase 2 — the cascade** — page 12's struck-through
  declarations are the cascade being resolved; Phase 2 is the algorithm behind
  them.
- **→ Phase 4 — the box model** — `content-box` and the
  8 px body margin measured in page 06 are the defaults that phase overrides.
- **→ Phase 14 — performance** — the pipeline
  stages in page 02 become the performance rules there.
- **→ JavaScript [Phase 9 — the DOM](/docs/javascript/)** — the CSSOM is read and
  written from script there; this phase only reads it to prove what the engine
  stored.

## Phase gate

Move on when you can take a rule that "isn't working" and say, in order,
**whether it parsed, whether it matched, and whether it won** — without editing
it at random to find out.

---

Next: [Phase 1 · Selectors](../phase-1-selectors/) →
