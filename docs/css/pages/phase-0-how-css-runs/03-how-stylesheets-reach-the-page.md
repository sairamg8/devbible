---
title: "How stylesheets reach the page"
sidebar_label: "03 · Getting CSS to the page"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex05-render-blocking-and-import.mjs`.

**There are four ways to get CSS onto a page, and one of them is a performance
bug.** They differ in when the bytes arrive, what they cost the first paint, and
where they sit in the cascade.

## The four

```html
<!-- 1. external stylesheet — the default for anything real -->
<link rel="stylesheet" href="/styles.css">

<!-- 2. embedded — no request, but not cacheable separately -->
<style>
  .card { padding: 1rem; }
</style>

<!-- 3. inline attribute — one element, highest priority, no reuse -->
<div style="padding: 1rem"></div>

<!-- 4. @import, inside CSS — avoid; see below -->
<style>@import url("/more.css");</style>
```

| Method | Cacheable | Reusable | Cascade position | Use it for |
|---|---|---|---|---|
| `<link>` | ✅ separately | ✅ every page | normal author origin | everything |
| `<style>` | with the HTML only | that page only | normal author origin | critical CSS, tiny pages |
| `style=""` | ❌ | ❌ | beats all author rules | script-set dynamic values |
| `@import` | ✅ | ✅ | normal author origin | **nothing — see below** |

## `@import` costs a full round trip, measured

`@import` is not a build-time include. The browser cannot discover the imported
file until the importing stylesheet has arrived *and been parsed* — so the
requests serialise instead of overlapping.

Three deliveries of the same two stylesheets, each delayed 500 ms by the server:

```js
// sandbox/css/ex05-render-blocking-and-import.mjs
'/parallel.html': `<link rel="stylesheet" href="/a.css">
                   <link rel="stylesheet" href="/b.css">`,

'/import.html':   `<link rel="stylesheet" href="/a-with-import.css">`,
// a-with-import.css begins:  @import url("/b.css");
```

```console
$ node ex05-render-blocking-and-import.mjs
engine: Firefox/153.0
every stylesheet delayed 500ms server-side

=== First Contentful Paint by delivery shape (median of 5, after warm-up) ===
  1 blocking sheet           FCP   687ms   sheets 1   request start gap 0ms
  2 sheets, parallel <link>  FCP   636ms   sheets 2   request start gap 1ms
  2 sheets, chained @import  FCP  1076ms   sheets 2   request start gap 532ms
```

**Read the start gap, not just the FCP.** Two `<link>`s started their requests
**1 ms** apart — they overlap, so two stylesheets cost about the same as one.
The `@import` chain started its second request **532 ms** later, because it could
not know the file existed until the first one had been parsed. The delays add:
1076 ms versus 636 ms, for identical bytes.

One blocking sheet (687 ms) and two parallel sheets (636 ms) are within noise of
each other — that is the point. Parallelism is free; serialisation is not.

:::caution The first measurement of this was wrong
Measured cold, one stylesheet appeared to cost *more* than two, because the
first navigation in a fresh browser carries start-up cost that has nothing to do
with CSS — its request started 80 ms later than the rest. The numbers above are
the median of five runs after three warm-up navigations.
:::

## Inline `style` is a cascade decision, not just a styling one

An inline `style` attribute beats every author rule regardless of specificity —
only `!important` in an author stylesheet outranks it. That makes it right for
exactly one thing: **values a script computes**, which cannot be known when the
stylesheet is written.

```js
// legitimate: the value is not knowable at author time
el.style.setProperty('--progress', `${percent}%`);

// not legitimate: this belongs in a stylesheet, and now nothing can override it
el.style.color = 'red';
```

Setting a **custom property** inline is the pattern worth keeping: the inline
attribute carries the *value*, while the stylesheet keeps the *rule* that uses
it. You get dynamic values without surrendering the cascade
(**Phase 3**).

## Where each one belongs

- **`<link>` for everything by default.** Separately cacheable, parallel-loaded,
  and the only option that survives a page you did not author.
- **`<style>` for critical CSS** — the small subset needed for the first
  screenful, inlined so it costs zero requests. The rest still comes by `<link>`.
  Covered in **Phase 14**.
- **`style=""` only for script-computed values**, preferably custom properties.
- **`@import` never**, in delivered CSS. It is fine in source that a bundler
  flattens — Sass's `@use` and PostCSS imports are resolved at build time and
  never reach the browser.

## Gotchas

**Symptom:** the site got slower after splitting one stylesheet into several
"for maintainability", and the files are chained with `@import`.
**Cause:** each `@import` adds a full round trip that cannot overlap the
previous one. Four chained imports mean four sequential requests.
**Fix:** emit multiple `<link>`s, or bundle at build time. Keep the source split.

**Symptom:** a style will not override an element no matter how specific the
selector, and DevTools shows the winning declaration coming from the element
itself.
**Cause:** an inline `style` attribute, probably set by script.
**Fix:** remove the inline write and set a class or a custom property instead.
Adding `!important` to beat it works and starts an arms race.

**Symptom:** styles apply on the deployed site but not locally, or vice versa.
**Cause:** a `<style>` block is cached with the HTML while `<link>`ed CSS is
cached separately, so the two can be at different versions.
**Fix:** check what the browser actually loaded in DevTools' Network panel
before assuming the CSS is wrong.

## Interview questions

**★ Why is `@import` in CSS considered harmful?**
Because it serialises requests. The browser cannot discover the imported file
until the importing stylesheet has been downloaded and parsed, so each import
adds a round trip that cannot overlap. Measured with a 500 ms server delay, two
stylesheets chained by `@import` painted at 1076 ms versus 636 ms for two
parallel `<link>`s — same bytes, nearly double the time. Build-time `@import`
(Sass, PostCSS) is a different thing and is fine.

**★ When is an inline `style` attribute the right choice?**
When the value is not knowable at author time — a computed position, a progress
percentage, a user-selected colour. Even then, prefer setting a custom property
inline and consuming it from a stylesheet rule, so the styling logic stays in
CSS. Inline styles beat all normal author declarations, so using them for static
styling makes everything downstream harder to override.

**Does an inline style beat `!important` in a stylesheet?**
No. A normal inline declaration beats normal author rules, but an `!important`
author declaration beats a normal inline one. An `!important` *inline*
declaration beats that in turn.

**Do two `<link>` elements cost twice as much as one?**
Not in wall-clock time — their requests overlap. Measured, one delayed sheet and
two delayed sheets in parallel painted within noise of each other. They do cost
two connections and two cache entries, which matters at a much larger count.

**Where does `<style>` sit relative to `<link>` in the cascade?**
Nowhere special — both are the author origin, and they are ordered by document
position. A `<style>` block before a `<link>` loses to it on source order.

---

← [02 · The rendering pipeline](./02-the-rendering-pipeline.md) · Next: [04 · Render-blocking CSS](./04-render-blocking-css.md) →
