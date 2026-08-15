---
title: "03 · Variable heights, and what windowing breaks"
sidebar_label: "03 · What windowing breaks"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`Element.scrollTop`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/position), [`overflow-anchor`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor), [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility), [`tabindex`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/tabindex), [`aria-setsize`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-setsize). Documentation-validated; **no timings and no console output**.

Chunk 02's list works because every row is 96px. Real catalogues have two-line titles, optional
badges and rows that grow when the viewport narrows — and a windowed list with unknown heights is a
genuinely harder problem. This page covers how to do it anyway, and then the part most articles
leave out: **the list of things that stop working once rows are not in the document.**

## Variable heights: the three honest options

### Option A — make them fixed anyway

Not a cop-out. A product row that clamps its title to two lines
(`-webkit-line-clamp` / `line-clamp`) and reserves space for the badge is a **design decision that
buys exact maths**, and it is what most fast lists in production actually do. Take this option
unless the content genuinely cannot be constrained.

### Option B — estimate, measure, correct

Keep a height per index, seeded with an estimate and replaced by the real value once the row has
been rendered:

```js
const est = 96;
const heights = new Array(items.length).fill(est);   // measured values replace estimates
const measured = new Set();

function totalHeight() { return heights.reduce((a, b) => a + b, 0); }   // ⚠️ O(n) — see below
```

`reduce` over 20,000 numbers on every frame is its own performance bug. The fix is a **prefix-sum
array** — `offsets[i]` is the top edge of row `i` — rebuilt only when a height actually changes,
with `start` found by **binary search** rather than division:

```js
function startIndexFor(scrollTop) {          // offsets is ascending, so bisect it
  let lo = 0, hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= scrollTop) lo = mid; else hi = mid - 1;
  }
  return lo;
}
```

Measure with a `ResizeObserver` on the rendered rows — it reports the real box without you calling
`getBoundingClientRect()` in a scroll handler
([Phase 12 · 05 · `ResizeObserver`](../../phase-12-browser-platform/05-resizeobserver/README.md)):

```js
const ro = new ResizeObserver((entries) => {
  let changed = false;
  for (const entry of entries) {
    const index = Number(entry.target.dataset.index);
    const h = entry.contentRect.height;
    if (heights[index] !== h) { heights[index] = h; measured.add(index); changed = true; }
  }
  if (changed) rebuildOffsets();               // then re-render, and correct the scroll (below)
});
```

🔴 **The correction jump is the hard part.** When a row *above* the viewport turns out to be taller
than its estimate, everything below it moves down — and the user, who was reading row 500, is now
looking at row 497. Compensate in the same frame:

```js
const before = offsets[anchorIndex];           // the top edge of the row at the top of the viewport
rebuildOffsets();
const delta = offsets[anchorIndex] - before;
if (delta !== 0) viewport.scrollTop += delta;  // 🔴 keep the anchor row where it was
```

⚠️ **The browser's own scroll anchoring cannot help you here.** MDN describes scroll anchoring as
adjusting the scroll position to avoid shifts when content changes above the viewport, with
`overflow-anchor: none` to opt out — but it is marked **not Baseline** (it does not work in some
widely used browsers), and it anchors to elements that exist. In a windowed list the rows above you
do not exist. Anchor by hand, as above.

### Option C — do not window at all

Re-read [01 · Why a long list freezes](./01-why-a-long-list-freezes.md). `content-visibility: auto`
with `contain-intrinsic-size: auto <estimate>` gives you *the browser's* version of estimate-then-
measure — it skips layout and paint for off-screen rows, remembers the measured size once it has
one, and, crucially, keeps every row in the document. For variable-height content that is often the
better trade, because everything in the next section keeps working.

## 🔴 What windowing breaks

Every item here is a direct consequence of the rows not being in the DOM. None of them is a bug you
can fix; each is a cost you accept and mitigate.

**Find-in-page (Ctrl+F).** The browser can only find text that exists. Users searching a long list
is not a niche case — it is the main reason people open one.
*Mitigation:* a real in-app search box that filters the data, placed where someone reaching for
Ctrl+F will see it. There is no way to make the browser's own find work over data you did not render.

**Text selection and copy.** Select-all, or dragging from row 3 to row 900, only ever picks up the
rendered window.
*Mitigation:* a copy/export action that works from the data, not the DOM.

**Printing.** The print output contains the window, not the list.
*Mitigation:* a print path that renders everything (accepting the freeze — nobody is interacting
with a page while it prints), or an export to CSV/PDF.

**Focus.** This is the one that produces real bugs. If the focused row scrolls out and its node is
recycled or removed, **focus falls back to the body** and the keyboard user loses their place
mid-list.
*Mitigation:* a **roving `tabindex`** — one row is `tabindex="0"`, the rest `tabindex="-1"`, and
arrow keys move it — plus a rule that the focused index is *always* inside the rendered window, even
when the user has scrolled away from it. Restore focus explicitly after a re-render if the focused
row's node was reused ([Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/README.md)).

**Screen-reader "read everything".** `aria-setsize` and `aria-posinset` make each row announce its
true position, which is most of the way there — but a virtual cursor cannot walk rows that are not
there, so continuous reading stops at the window edge.
*Mitigation:* the set attributes are mandatory, not optional; and keyboard navigation must move the
window, not just the focus ring.

**Sticky things inside the layer.** MDN: a sticky element is offset relative to its nearest
scrolling ancestor and its containing block — and an ancestor with a `transform` other than `none`
becomes the containing block. The layer in chunk 02 is transformed, so a sticky header inside it
sticks to the moving layer, not to the viewport.
*Mitigation:* put sticky headers **outside** the layer, as a sibling inside the scroll container.

**Sibling-based CSS.** `:nth-child(even)` stripes the *rendered* rows, so the banding flickers as
the window slides, and `:first-child` / `:last-child` fire on the wrong rows.
*Mitigation:* set the parity from the absolute index in `fillRow` — `el.classList.toggle('odd',
index % 2 === 1)`.

**Deep links, `#hash` targets and scroll restoration.** `element.scrollIntoView()` on row 500 does
nothing when row 500 does not exist, and Back lands on a list rendered from scratch.
*Mitigation:* scroll by index (`scrollTop = offsets[index]`), render, *then* focus. Persist the
index rather than the pixel offset
([Phase 12 · 08 · The History API](../../phase-12-browser-platform/08-history-and-routing/README.md)).

**Testing and debugging.** An assertion that a row exists fails for reasons that have nothing to do
with the feature under test, and inspecting a row in DevTools is a moving target.
*Mitigation:* test the windowing maths (`windowFor`, `startIndexFor`) as pure functions, and test
the list's behaviour through its rendered window deliberately.

**Very tall sizers.** Browsers cap how tall an element may be. The limit is
**implementation-defined and not in any specification** — I could not confirm a current, citable
number, so treat it as a real constraint whose value you must measure rather than a figure to hard-
code. It matters only for lists in the millions of rows, where the answer is a **scaled sizer**: cap
the height, and map scroll position to index by proportion instead of by pixels.

## When to use a library instead

Writing one is the right way to *understand* it; shipping one is a judgement call. Reach for an
existing virtualiser when you need variable heights **and** any of: horizontal windowing, a sticky
grid header, column virtualisation, or dynamic insertion at the top of the list. Those interactions
are where the edge cases multiply.

What to check before adopting one, in this order: **does it emit the ARIA set attributes**, does it
support **keyboard navigation and focus retention**, can you **scroll to an index** and restore a
position, and does it let you supply a **measurement cache** so heights survive a re-mount. A
virtualiser that fails the first two ships an inaccessible list no matter how fast it scrolls.

## Gotchas

**Symptom: the scroll position drifts as the user scrolls a variable-height list.**
Cause — estimates above the viewport being replaced by real measurements, with no correction.
Fix — anchor on a row, diff its offset before and after the rebuild, and add the delta to `scrollTop`.

**Symptom: scrolling gets slower the further down the list you go.**
Cause — summing or scanning the heights array on every frame.
Fix — a prefix-sum array rebuilt only on change, and binary search for the start index.

**Symptom: keyboard focus jumps to the top of the page mid-list.**
Cause — the focused row was recycled or removed when it scrolled out.
Fix — roving `tabindex`, keep the focused index inside the rendered window, restore focus after re-render.

**Symptom: zebra striping flickers while scrolling.**
Cause — `:nth-child` applying to the rendered subset.
Fix — set a parity class from the absolute index.

**Symptom: the sticky group header scrolls away with the rows.**
Cause — it is inside the transformed layer, which has become its containing block.
Fix — move it out, into the scroll container.

**Symptom: users report "the search finds nothing" on a list that clearly contains the word.**
Cause — Ctrl+F over a windowed list.
Fix — an in-app filter; and say so in the UI, because the browser's find silently reports zero.

**Symptom: printing the page prints ten rows.**
Cause — only the window exists at print time.
Fix — an export, or a print path that renders the full list.

**Symptom: heights are measured correctly but the list still jumps on first paint.**
Cause — every row starts at the estimate, so the first measurement pass moves everything.
Fix — take the estimate from a real rendered row, and measure the first screenful before the initial
scroll is possible.

## Interview questions

**★ How do you window a list whose rows have different heights?**
Keep a per-index height array seeded with an estimate, measure rendered rows with a `ResizeObserver`,
maintain a prefix-sum of offsets, and binary-search it for the start index instead of dividing by a
constant.

**★ What is the correction jump, and how do you avoid it?**
When a measured height above the viewport differs from its estimate, everything below shifts. Record
an anchor row's offset before rebuilding the offsets, and adjust `scrollTop` by the difference
afterwards.

**★ Why can't you rely on the browser's scroll anchoring for that?**
It anchors to elements that exist — in a windowed list the content above the viewport does not — and
MDN marks `overflow-anchor` as not Baseline, so the behaviour is not something to depend on.

**★ Name three things a virtualised list breaks.**
Find-in-page, text selection and printing, because they operate on the DOM; plus focus, which is
lost when the focused row is recycled.

**★ How do you keep a virtual list keyboard-accessible?**
A roving `tabindex` with arrow-key navigation, the focused index always kept inside the rendered
window, focus restored after re-renders, and `aria-setsize` / `aria-posinset` so position is
announced from the real total.

**★ When would you use `content-visibility` instead of windowing, given both skip off-screen work?**
When the semantics matter more than the memory. `content-visibility: auto` keeps the rows in the
document — MDN guarantees they stay available to find-in-page, tab order, focus and the accessibility
tree — so it costs none of the things above; windowing is what you take when the DOM itself is too
big to keep.

---

← [02 · A windowing list from scratch](./02-windowing-from-scratch.md) · [Topic index](./README.md)
