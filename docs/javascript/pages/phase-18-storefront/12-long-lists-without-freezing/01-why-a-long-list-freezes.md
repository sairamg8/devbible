---
title: "01 · Why a long list freezes"
sidebar_label: "01 · Why a long list freezes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility), [`contain-intrinsic-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain-intrinsic-size), [`Scheduler.yield()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield), [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment), [`Element: scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event), [`Window.requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). Documentation-validated; **no timings and no console output**.

Windowing — rendering only the rows on screen — is the famous answer to a long list, and it is the
**last** thing you should reach for. It is the only fix on this page that takes rows out of the
document, and everything that expects them to be there (find-in-page, the accessibility tree, focus,
text selection, printing) breaks the moment they are gone. Chunk 02 writes one from scratch. This
page is the part that decides whether you need to.

## "Freezing" is one specific thing

The page is frozen when the main thread is inside a single long task. While that task runs, the
browser cannot paint a frame, cannot run your click handler, and cannot even show the pressed state
of a button — the whole interaction layer is queued behind it
([Phase 7 · 02 · The event loop](../../phase-7-async/02-the-event-loop/README.md)).

A long list produces **two different freezes**, and they need different fixes:

| | When it happens | What is expensive |
|---|---|---|
| **The build freeze** | once, when the rows are created and inserted | making thousands of nodes, then the style, layout and paint pass over all of them |
| **The scroll freeze** | continuously, while the user scrolls | style recalculation, layout and hit-testing across a document that is now enormous — plus the memory the nodes hold |

🔴 **Windowing fixes both, but almost everything else on this page fixes one of them for far less
damage.** Work down the list in order and stop as soon as the list is smooth.

## Fix 0 — do not render the list at all

The cheapest row is the one that never exists. Before any of the technical fixes, ask whether the
user actually asked for ten thousand rows:

- **Paginate, or load on demand** — [11 · Infinite scroll and lazy images](../11-infinite-scroll-and-lazy-images/README.md)
  keeps the DOM proportional to how far the user has actually scrolled, and it is a smaller change
  than windowing with none of the accessibility cost.
- **Filter and search server-side.** A product catalogue is browsed, not read end to end. A search
  box that narrows 20,000 rows to 40 is a better answer than making 20,000 rows fast.
- **Summarise.** Grouped counts with drill-down beat a flat list nobody scrolls through.

⚠️ **"But the user asked to see everything"** is usually the export button in disguise. A CSV
download is a better all-of-it than a list nobody can scroll.

## Fix 1 — make each row cheaper

Per-row cost is multiplied by the row count, so it is the highest-leverage thing you control.

- **One listener on the container, not one per row.** Event delegation is the difference between
  10,000 listeners and one ([Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md)).
  The same applies to observers: do not attach an `IntersectionObserver` or a `ResizeObserver` per
  row when one on the container will do.
- **Flatten the row.** A card with 20 elements in it is 200,000 nodes at 10,000 rows. Every one of
  them costs style resolution, layout and memory. Cut wrappers; use CSS for the decoration you were
  building with elements.
- **Give images `width` and `height`** so the row's box is known before the bytes land — the same
  reservation rule as [11 · 02 · Images that do not shift](../11-infinite-scroll-and-lazy-images/02-images-that-do-not-shift.md).
- **Avoid the layout-triggering CSS** in row internals where you can: a per-row `box-shadow` on a
  huge list is paint cost, and a row that measures itself is layout cost
  ([Phase 9 · 13 · Measuring elements](../../phase-9-dom/13-measuring-elements/README.md)).

## Fix 2 — insert in one shot

```js
const frag = document.createDocumentFragment();
for (const item of items) frag.append(renderRow(item));   // no layout yet — frag is not in the document
list.append(frag);                                        // 🔴 one insertion, one layout pass
```

**Why a fragment:** a `DocumentFragment` is not part of the document, so building inside it triggers
no layout at all; appending it moves its children in as a single mutation. The two ways people get
this wrong both look harmless:

- ⛔ **`list.innerHTML += row`** in a loop — every iteration serialises the entire existing list back
  to a string, reparses it, and throws away and rebuilds every node. It is quadratic, and it
  destroys any listener, focus or scroll state the old nodes had
  ([Phase 9 · 04 · Text vs HTML](../../phase-9-dom/04-text-vs-html/README.md)).
- ⛔ **Appending one row at a time and reading a layout property in the same loop** — `offsetHeight`,
  `getBoundingClientRect()`, `scrollTop` — forces the browser to flush layout on every iteration.
  That is layout thrashing, and it is the difference between one layout and ten thousand
  ([Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/README.md),
  [Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/README.md)).

## Fix 3 — `content-visibility`, the one that is nearly free

```css
.row {
  content-visibility: auto;
  contain-intrinsic-size: auto 96px;   /* the row's estimated height */
}
```

`content-visibility: auto` lets the browser **skip the rendering work — layout and paint — for
content that is off screen**, and do it lazily when the content approaches the viewport.
`contain-intrinsic-size` gives it a size to assume in the meantime, so the scrollbar and the page
geometry are right before anything is rendered; MDN pairs the two properties for exactly this
reason. The `auto` keyword in `contain-intrinsic-size: auto 96px` means "use 96px until you have
measured this element for real, then remember the real value".

🔴 **The reason to try this before windowing:** the rows are still in the document. MDN is explicit
that skipped content, unlike `hidden` content, must still be available to find-in-page, tab-order
navigation, focus and selection, and it stays in the accessibility tree. You get most of the scroll
win and lose none of the semantics — which is the exact trade windowing forces you to make.

⚠️ **What it does not fix.** The nodes still exist, so the **build** freeze and the memory are
untouched: creating 20,000 rows is still creating 20,000 rows. And an estimate that is far from the
real height will move the scrollbar as the browser corrects itself — pick the estimate from a real
row, not from a round number you liked.

## Fix 4 — stop hogging the main thread while you build

If the list genuinely has to be built in one go, break the task up so the browser can paint and
respond between pieces:

```js
async function appendInChunks(items, size = 200) {
  for (let i = 0; i < items.length; i += size) {
    const frag = document.createDocumentFragment();
    for (const item of items.slice(i, i + size)) frag.append(renderRow(item));
    list.append(frag);
    await yieldToBrowser();                 // let a frame happen
  }
}

const yieldToBrowser = globalThis.scheduler?.yield
  ? () => scheduler.yield()                 // ⚠️ limited availability — feature-detect, as MDN shows
  : () => new Promise((r) => setTimeout(r, 0));
```

`scheduler.yield()` yields to the main thread and resumes as a **prioritised continuation** — MDN
describes it as enqueuing at a boosted priority relative to a same-priority `postTask()`, so your
loop gets the thread back before newly queued work of the same importance. It is marked **limited
availability, not Baseline**, so the feature detection above is not optional. The mechanics and the
alternatives live in
[Phase 12 · 14 · Yielding to the main thread](../../phase-12-browser-platform/14-yielding-to-the-main-thread.md).

⚠️ **Chunking makes the page responsive, not the work faster.** Total time goes up slightly. What
changes is that the user can click, scroll and see progress while it happens — which is the entire
complaint behind "it freezes".

## 🔴 The point at which windowing beats rendering everything

There is no universal row count, and anyone who gives you one is quoting their own hardware. The
honest version is that the threshold moves with **row complexity × device**: a list of plain text
rows survives numbers that a list of image cards with shadows and per-row state does not, and the
cheapest phone your users own decides, not your laptop.

**Signals that you have passed it** — any two of these together mean windowing:

- The **first render is a visible pause** even after fragment-batching and chunking.
- **Scrolling drops frames** on a mid-range device, with style recalculation and layout dominating a
  DevTools performance profile ([Phase 12 · 01 · DevTools](../../phase-12-browser-platform/01-devtools/README.md)).
- **Memory grows with the list** and does not come back — every row is retained DOM.
- **`content-visibility` did not help enough**, which usually means the cost is in *building* the
  nodes rather than in laying them out.
- The list is **unbounded by design** — a log viewer, a chat backlog, a data grid — where "just
  paginate" is not available.

**Signals that you have not** — and windowing would be a net loss:

- The list has a **natural cap** (a cart, an order's line items, a page of search results).
- Users **search inside it with Ctrl+F**, or the content must be selectable and printable in full.
- Rows have **wildly variable, content-driven heights** — this is where a windowed list is hardest
  to get right, and chunk 03 is mostly about that.
- It is **fast already**. "It might get slow" is not a measurement.

## Gotchas

**Symptom: the page locks up for a moment when the list first renders, then scrolls fine.**
Cause — the build freeze: one long task creating and inserting everything.
Fix — a `DocumentFragment` insert, then chunk the build with a yield between chunks.

**Symptom: it renders fine but scrolling is janky.**
Cause — the scroll freeze: style and layout across a huge document.
Fix — `content-visibility: auto` with `contain-intrinsic-size`, then windowing if that is not enough.

**Symptom: adding rows gets slower the more rows there are.**
Cause — `innerHTML +=` in a loop, or reading a layout property between appends.
Fix — build in a fragment; never interleave reads and writes.

**Symptom: `content-visibility: auto` made the scrollbar jump around.**
Cause — `contain-intrinsic-size` estimates that are far from the real row heights.
Fix — measure one real row and use that; `auto <size>` lets the browser remember the measured value.

**Symptom: the freeze moved but did not go away after chunking.**
Cause — the per-chunk work is still one long task, or the chunk size is too large.
Fix — smaller chunks; and check the per-row cost first, because chunking cannot fix an expensive row.

**Symptom: memory keeps climbing as the user scrolls a "load more" list.**
Cause — rows accumulate and nothing is ever released; `content-visibility` skips rendering, not retention.
Fix — windowing, or cap the retained pages and drop the oldest.

## Interview questions

**★ What actually makes a long list slow?**
Two separate things: one long task to build and insert the nodes, and ongoing style, layout and
hit-testing cost across a very large document while scrolling. They have different fixes.

**★ Would you reach for virtualisation first?**
No — it is the fix with the highest cost, because it removes rows from the DOM and breaks
find-in-page, the accessibility tree, focus and printing. Pagination, cheaper rows, one batched
insert and `content-visibility: auto` all come first.

**★ What does `content-visibility: auto` do that windowing does not?**
It keeps the content in the document. MDN specifies that skipped content stays available to
find-in-page, tab order, focus and selection — so you get the rendering saving without the
semantic loss.

**★ Why is `innerHTML +=` in a loop so bad?**
It re-serialises and reparses the whole list on every iteration, rebuilding every node and
discarding listeners, focus and state. It is quadratic in the number of rows.

**★ How do you keep a page responsive while doing a lot of DOM work?**
Break the work into chunks and yield between them — `scheduler.yield()` where available, feature
detected, falling back to a task. It does not reduce total work; it lets frames and input happen
in between.

**★ When is windowing the right call?**
When the list is unbounded by design, the build or the scroll is still slow after the cheaper fixes,
and nothing about the feature depends on all the rows being present in the document.

---

[Topic index](./README.md) · [02 · A windowing list from scratch](./02-windowing-from-scratch.md) →
