---
title: "12 · Layout thrashing"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect), [`Window.getComputedStyle()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [CSS `contain`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain); and the Chrome team's *Avoid large, complex layouts and layout thrashing* on web.dev, whose companion list — Paul Irish's *What forces layout / reflow* gist — is the canonical enumeration of the triggering properties. Documentation-validated; **no timings**.

**One sentence:**

> The browser batches your DOM writes and lays out **once**. Reading a geometry property while
> writes are pending forces it to lay out **now** — and doing that in a loop is layout thrashing.

```js
// ⚠️ one forced layout per iteration
for (const el of items) {
  el.style.width = el.offsetWidth + 10 + 'px';   // write, then read, then write…
}

// ✅ one layout, whatever the list size
const widths = items.map((el) => el.offsetWidth);   // read phase
items.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });   // write phase
```

Both loops do the same DOM work. The first asks the engine to recompute layout on every
iteration, because each read must reflect the write that preceded it; the second reads everything
while the layout is clean and then writes everything without reading again.

🔴 **This is the DOM performance problem that batching does not solve.** You can build every node
off-document, insert once, and still thrash — the two are independent, which is why
[11 · Batching DOM work](../11-batching-dom-work/README.md) and this topic are separate rows.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The forced reflow](./01-the-forced-reflow.md)** | The rendering pipeline, what "invalidated" means, the properties and methods that force layout, and how to recognise it in DevTools |
| 02 | **[Fixing it](./02-fixing-it.md)** | Read/write phases, `requestAnimationFrame` placement, observers that measure without forcing, animating `transform`/`opacity`, and CSS `contain` |

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [11 · Batching DOM work](../11-batching-dom-work/README.md) — the independent other half
- [08 · Classes and styles](../08-classes-and-styles/README.md) — `getComputedStyle` is on the
  forcing list, which is why that page says to batch reads
- **13 · Measuring elements** *(not written yet)* — the geometry APIs themselves

---

Start → [01 · The forced reflow](./01-the-forced-reflow.md)
