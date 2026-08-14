---
title: "02 · Landing on an element"
sidebar_label: "02 · Landing on an element"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView), [`scroll-margin`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin), [`scroll-padding`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding), [`Element.scrollend` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event), [`HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus). Documentation-validated; **no timings**.

`scrollIntoView()` is the API to reach for, because it asks the question you actually have —
*put this element on screen* — instead of the one you would have to compute.

```js
row.scrollIntoView();                    // default: { block: 'start', inline: 'nearest' }
row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

## The four options

| Option | Values | Default |
|---|---|---|
| `behavior` | `'auto'` · `'instant'` · `'smooth'` | `'auto'` |
| `block` (vertical) | `'start'` · `'center'` · `'end'` · `'nearest'` | **`'start'`** |
| `inline` (horizontal) | `'start'` · `'center'` · `'end'` · `'nearest'` | **`'nearest'`** |
| `container` | `'all'` · `'nearest'` | **`'all'`** |

`behavior` is the same setting as everywhere else — see
[01 · Moving the scroll position](./01-moving-the-scroll-position.md).

🔴 **The asymmetric defaults are the surprise: vertical is `start`, horizontal is `nearest`.** So
the bare call always yanks the element to the top of the scrollport even when it was already fully
visible one line down.

`{ block: 'nearest' }` is what you almost always want for keyboard navigation through a list — it
scrolls the minimum needed, and does **nothing at all** when the item is already on screen:

```js
list.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown') return;
  const next = document.activeElement.nextElementSibling;
  if (!next) return;
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'nearest' });   // no jump when it is already visible
});
```

### The legacy boolean argument

Still common in older code, and worth being able to read:

| Call | Equivalent |
|---|---|
| `scrollIntoView(true)` | `{ block: 'start', inline: 'nearest' }` |
| `scrollIntoView(false)` | `{ block: 'end', inline: 'nearest' }` |
| `scrollIntoView()` | `{ block: 'start', inline: 'nearest' }` |

⚠️ `true` and `false` are **not** "do it" / "don't do it". Both scroll; they differ only in
alignment. A `scrollIntoView(false)` you inherit is aligning to the bottom, not opting out.

### `container` — how far up the tree it reaches

`container: 'all'`, the default, scrolls **every** scrollable ancestor until the element is
visible: the panel, then the page, then anything above it. `container: 'nearest'` restricts the
work to the closest scroll container.

Use `'nearest'` when a widget must not move the page underneath the user — a combobox scrolling its
own option list, a chat pane pinning itself to the newest message, a diff viewer stepping through
hunks. Anything where the page jumping would feel like a bug.

### It returns a Promise

Like the other scroll methods, `scrollIntoView()` fulfils with `{ interrupted }`. The same
feature-detection caveat applies — some browsers still return `undefined`, and `await undefined`
resolves immediately rather than failing.

## The fixed-header problem, solved in CSS

`block: 'start'` puts the element's top edge at the top of the scrollport, which is *underneath* a
sticky header. Do not subtract the header height by hand — the platform has two properties for
exactly this:

```css
/* on the TARGET: an outset the scroll should leave around it */
:target,
[data-scroll-target] { scroll-margin-top: 5rem; }

/* on the SCROLL CONTAINER: an inset applied to every target inside it */
.scroll-pane { scroll-padding-top: 5rem; }
```

| Property | Goes on | Reach |
|---|---|---|
| `scroll-margin-*` | the element being scrolled to | that element only |
| `scroll-padding-*` | the scroll container | every target inside it |

One `scroll-padding-top` on the container beats a `scroll-margin-top` on every heading. Both are
honoured by `scrollIntoView()`, by `:target` anchor navigation **and** by scroll snapping — a
hand-rolled offset fixes only the first of the three, and breaks the moment the header changes
height at a breakpoint:

```js
// ⚠️ don't: brittle, and does nothing for anchor links
const y = el.getBoundingClientRect().top + window.scrollY - 80;
window.scrollTo({ top: y });
```

That version also **forces layout** on every call
([12 · Layout thrashing](../12-layout-thrashing/01-the-forced-reflow.md)), which the CSS route
avoids entirely.

## Knowing when the scroll finished: `scrollend`

There is no callback on a smooth scroll, and polling `scrollTop` until it stops changing is the
hack this replaces. `scrollend` fires when the scroll position has **no pending updates and the
user's gesture has ended** — a released touch pan or trackpad gesture, a completed smooth or
instant scroll, a settled scroll snap.

```js
function waitForScrollEnd(target = document, timeout = 1000) {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, timeout);          // the guard, not optional
    target.addEventListener('scrollend', done, { once: true });
  });
}
```

Two things to hold onto:

- ⚠️ **It is Baseline 2025 — newly available**, so feature-detect with `'onscrollend' in window`
  rather than assuming it. Prefer the promise returned by the scroll method where you have one.
- 🔴 **If the scroll position did not change, no `scrollend` fires.** A promise that waits for it
  hangs forever when the element was already in view — hence the timeout above. This is the single
  most common way a "scroll then focus" sequence deadlocks.

## Scrolling and focus are different things

Moving the viewport does **not** move keyboard focus. A "skip to content" link that only calls
`scrollIntoView()` leaves a keyboard user's focus back on the link, so their next Tab returns them
to the header they just skipped, and a screen reader carries on reading from where it was.

```js
main.setAttribute('tabindex', '-1');       // programmatically focusable, not in the tab order
main.focus();                               // focusing scrolls it into view by itself
```

`focus()` scrolls the element into view as part of its own definition, so the two-step is often one
step. The reverse matters too: when you have already positioned the page yourself, suppress the
second jump with `focus({ preventScroll: true })`.

**The order that works:** scroll first with the alignment you want, then focus with
`preventScroll: true`. Focusing first and scrolling second means the browser's default scroll runs
before yours and the page visibly jumps twice.

## Gotchas

**Symptom: arrow-key navigation through a list jumps the item to the top of the screen every time.**
Cause — `block` defaults to `'start'`, not `'nearest'`.
Fix — `item.scrollIntoView({ block: 'nearest' })`.

**Symptom: the heading you scrolled to is hidden behind the sticky header.**
Cause — `block: 'start'` aligns with the top of the scrollport, and the header covers it.
Fix — `scroll-margin-top` on the target, or `scroll-padding-top` on the scroll container. Never
subtract a hardcoded header height in JavaScript.

**Symptom: clicking an item in a dropdown scrolls the whole page as well as the list.**
Cause — `container` defaults to `'all'`, so every scrollable ancestor scrolls.
Fix — `scrollIntoView({ container: 'nearest' })`.

**Symptom: `scrollIntoView()` does nothing for an element you just created.**
Cause — it is not in the document yet, or it is `display: none`; a node with no box has no position
to scroll to. Same reason its measurements are all zero
([13 · Measuring elements](../13-measuring-elements/01-the-four-families.md)).
Fix — insert it first, then scroll. `visibility: hidden` still has a box and still scrolls.

**Symptom: `await waitForScrollEnd()` never resolves.**
Cause — the element was already in view, so the scroll position never changed and no `scrollend`
fired.
Fix — race the listener against a timeout, as above, or use the scroll method's promise.

**Symptom: the page jumps twice on a "skip to content" link.**
Cause — you scrolled, then called `focus()`, which scrolls again by default.
Fix — `focus({ preventScroll: true })` after your own scroll.

**Symptom: `scrollIntoViewIfNeeded()` works in Chrome and Safari but throws in Firefox.**
Cause — it is a **non-standard** WebKit/Blink method, not part of the platform.
Fix — `scrollIntoView({ block: 'nearest', inline: 'nearest' })` is the standard equivalent and does
the same minimal-movement job.

## Interview questions

**★ Why does `scrollIntoView()` move an element that was already visible?**
Because `block` defaults to `'start'`, which aligns the element's top with the top of the
scrollport regardless of where it was. `'nearest'` is the minimal-movement option and does nothing
when the element is already fully in view.

**★ How do you scroll past a sticky header without hardcoding its height?**
`scroll-margin-top` on the target, or `scroll-padding-top` on the scroll container. Both are
respected by `scrollIntoView()`, `:target` anchor navigation and scroll snapping — a JavaScript
offset fixes only the first of the three and re-breaks at every breakpoint.

**★ How do you know when a smooth scroll has finished?**
Await the promise returned by the scroll method (`{ interrupted }`), or listen for `scrollend`.
`scrollend` needs a feature check and a timeout guard, because no event fires if the position never
changed.

**★ Why is scrolling to an element not enough for accessibility?**
Scrolling moves the viewport, not focus. Keyboard and screen-reader users stay where they were, so
the target needs `tabindex="-1"` and a `focus()` call — and once you focus it, `preventScroll: true`
stops the double jump.

**What does the boolean argument to `scrollIntoView()` do?**
`true` means `{ block: 'start', inline: 'nearest' }`, `false` means `{ block: 'end', inline:
'nearest' }`. Both scroll — it is an alignment switch, not an on/off switch.

**When would you pass `container: 'nearest'`?**
When only the widget should move: a combobox scrolling its own option list, a chat pane pinning to
the newest message. The default `'all'` also scrolls the page, which reads as a bug to the user.

---

← [01 · Moving the scroll position](./01-moving-the-scroll-position.md) · [Topic index](./README.md) ·
[03 · Scroll containers and sticky](./03-scroll-containers-and-sticky.md) →
