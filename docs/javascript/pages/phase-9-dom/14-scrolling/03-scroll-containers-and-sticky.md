---
title: "03 · Scroll containers and sticky"
sidebar_label: "03 · Scroll containers and sticky"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow), [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior), [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/position), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`Element.scrollsnapchange` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchange_event) — and the CSS Overflow Module Level 3 [viewport propagation rule](https://drafts.csswg.org/css-overflow-3/#overflow-propagation). Documentation-validated; **no timings**.

Every scroll API in [01](./01-moving-the-scroll-position.md) and
[02](./02-landing-on-an-element.md) acts on a **scroll container**. Call one on an element that is
not a scroll container and nothing happens — no error, no scroll. Knowing which element in the
tree actually scrolls is most of debugging scroll code.

## What makes an element a scroll container

It is `overflow`, and the values do not behave the way their names suggest:

| `overflow` | Scroll container? | Programmatically scrollable? |
|---|---|---|
| `visible` (default) | no | no |
| `scroll` | **always**, overflow or not | yes |
| `auto` | **only when content overflows** | yes, when it is one |
| `hidden` | **yes**, when content overflows | 🔴 **yes** |
| `clip` | **no** | **no** |

The two rows that matter:

- 🔴 **`overflow: hidden` is a scroll container.** MDN is explicit: the user cannot scroll it with
  a wheel or a drag, but the content "can also be scrolled to programmatically" by setting
  `scrollLeft` / `scrollTop`. Carousels are built on exactly this.
- **`overflow: clip` is the one that truly cannot scroll.** No scroll container, no programmatic
  scrolling, and — unlike `hidden` — no new formatting context. When you mean "clip this and never
  scroll it", `clip` says so; `hidden` does not.

### The viewport is a special case

The page's scroll container is the **root element**, which is why `document.body.scrollTop` reads
`0`. The CSS Overflow spec gives the exact rule:

> UAs must apply the overflow values set on the root element to the viewport […] However, when the
> root element is an HTML `html` element whose overflow value is `visible` (in both axes), and that
> element has as a child a `body` element whose display value is also not `none`, user agents must
> instead apply the overflow values of the first such child element to the viewport.

So `body { overflow: hidden }` locks the page **only because `html` is left at `visible`** and the
value propagates up. Set `overflow` on `html` as well and the body's value stops being used. That
is the whole explanation for "why does hiding overflow on body sometimes not work".

### Finding the scroll container from JavaScript

There is no `el.scrollParent`. You walk up and ask:

```js
function scrollParent(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY, overflowX } = getComputedStyle(node);
    if (/auto|scroll|hidden|overlay/.test(overflowY + overflowX)) return node;
  }
  return document.scrollingElement;         // nothing closer — the page scrolls
}
```

⚠️ `getComputedStyle` in a loop is on the forced-layout list
([12 · Layout thrashing](../12-layout-thrashing/01-the-forced-reflow.md)) — do this once and cache
the answer, not on every scroll event. And prefer `scrollIntoView()`, which makes the walk the
browser's problem.

## `overscroll-behavior` — stopping scroll chaining

**Scroll chaining** is the browser handing the scroll on: you reach the bottom of a dialog's
content, keep swiping, and the page behind it starts to move. Three values control it:

| Value | Chaining | Browser overscroll effects (bounce, pull-to-refresh) |
|---|---|---|
| `auto` (default) | on | on |
| `contain` | **off** | kept **inside** the element |
| `none` | **off** | **off** |

```css
.dialog-body {
  overflow: auto;
  overscroll-behavior-y: contain;    /* the page behind stops moving */
}

html { overscroll-behavior-y: none; } /* no pull-to-refresh on this app */
```

`contain` is the one you want for dialogs, drawers and chat panes: chaining stops, but the
platform's own bounce still happens inside the element so it does not feel dead. `none` also kills
that. Both disable native gestures such as pull-to-refresh and horizontal swipe-navigation on the
element they apply to — a real trade-off, not a free win.

📌 MDN notes it applies **only to scroll containers**, and that setting it on an element with
`overflow: hidden` still prevents chaining to ancestors — useful for an overlay that must not let
the background move. For an `<iframe>` it must be set on the `html`/`body` **inside** that
document; setting it on the iframe element does nothing.

## Locking the page behind a modal

The classic bug: open a modal, the page behind it scrolls under your finger; close it, and you are
somewhere else entirely.

```js
const root = document.documentElement;

function lockScroll() {
  const y = window.scrollY;
  root.dataset.scrollY = String(y);
  root.style.overflow = 'hidden';           // root, not body — see the propagation rule
  return y;
}

function unlockScroll() {
  root.style.overflow = '';
  window.scrollTo({ top: Number(root.dataset.scrollY ?? 0), behavior: 'instant' });
  delete root.dataset.scrollY;
}
```

Three details that decide whether this feels right:

- 🔴 **The layout shifts when the scrollbar disappears.** `scrollbar-gutter: stable` on the root
  reserves the space permanently and is the fix; the alternative is padding by the measured
  scrollbar width — see
  [13 · Measuring elements](../13-measuring-elements/02-viewports-and-device-pixels.md).
- ⚠️ **`position: fixed` on the body is the older trick and it loses your place** — the page jumps
  to the top when the modal opens, so you must save and restore `scrollY` yourself, exactly as
  above. It is still needed on some mobile browsers where `overflow: hidden` on the root does not
  hold; treat it as the fallback, not the default.
- **`overflow: hidden` does not stop scroll chaining** from inside the modal. Pair the lock with
  `overscroll-behavior: contain` on the modal's own scroll pane.

The platform now does most of this for you — a modal `<dialog>` blocks interaction with the page
behind it, and `inert` removes a subtree from focus and assistive technology. Those are
**16 · `<dialog>`, the popover API and `inert`** *(not written yet)*.

## `position: sticky`, and why it silently does nothing

Sticky is CSS, but it fails in ways that send people to JavaScript, so it belongs here. MDN's
definition:

> The element is positioned according to the normal flow of the document, and then offset relative
> to its *nearest scrolling ancestor* and containing block (nearest block-level ancestor) […] based
> on the values of `top`, `right`, `bottom`, and `left`.

Four requirements, and the failure mode of each:

1. **A threshold is mandatory.** If both inset properties for an axis are `auto`, on that axis
   sticky "will behave as `relative`" — the element scrolls away and nothing looks broken.
   `position: sticky` with no `top` is the single most common cause.
2. **It sticks inside its containing block.** Once the parent scrolls past, the sticky element
   goes with it. A sticky table header inside a short wrapper unsticks at the wrapper's bottom
   edge, not the viewport's.
3. 🔴 **Any ancestor with `overflow: hidden`, `scroll`, `auto` or `overlay` captures it.** MDN:
   the element sticks to its nearest ancestor with a *scrolling mechanism*, "even if that ancestor
   isn't the nearest actually scrolling ancestor". So an `overflow: hidden` set three levels up for
   an unrelated reason — clipping a decoration — makes the header stick to a box that never
   scrolls, i.e. never stick at all.
4. **The parent needs room.** If the containing block is exactly as tall as the sticky element,
   there is no distance to travel.

Debug it in that order: threshold → ancestor `overflow` → parent height. It is almost never
JavaScript's fault.

### Detecting "stuck" — there is no event

CSS gives no `:stuck` selector and the DOM fires no event when a sticky element pins. The standard
workaround is a **sentinel**: a zero-height element just above the sticky one, watched with an
`IntersectionObserver`. When the sentinel leaves the top of the scrollport, the header is stuck.

```html
<div class="sentinel" aria-hidden="true"></div>
<header class="site-header">…</header>
```

```js
const sentinel = document.querySelector('.sentinel');
const header = document.querySelector('.site-header');

new IntersectionObserver(
  ([entry]) => header.classList.toggle('is-stuck', !entry.isIntersecting),
  { threshold: 0 },
).observe(sentinel);
```

Why a sentinel rather than observing the header itself: a sticky header **never stops
intersecting** — that is the point of sticky — so an observer on it reports `isIntersecting: true`
forever. The sentinel is an ordinary element that scrolls away normally.

🔴 **Do not do this with a `scroll` listener and `getBoundingClientRect()`.** That runs on every
scroll tick and forces layout each time; the observer costs nothing and fires only on the
transition — the argument made in full in
[11 · Batching DOM work](../11-batching-dom-work/02-not-freezing-the-page.md).

## Scroll snapping, and what JavaScript sees

Snapping is declared in CSS — `scroll-snap-type` on the container, `scroll-snap-align` on the
children — and it changes what your scroll code observes: after any scroll, programmatic ones
included, the container settles onto a snap point rather than where you put it.

```css
.carousel { overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 1rem; }
.carousel > * { scroll-snap-align: start; }
```

- `scrollTo()` and `scrollIntoView()` still work — the browser snaps afterwards, so
  `scrollTop` right after the call is not the value you asked for. Read it after `scrollend`.
- `scroll-padding` on the container is honoured by snapping as well as by `scrollIntoView()`.
- `mandatory` always lands on a snap point and can make content between points unreachable;
  `proximity` only snaps when you are already close. Prefer `proximity` when items vary in size.
- ⚠️ The dedicated `scrollsnapchange` / `scrollsnapchanging` events — which hand you
  `snapTargetBlock` / `snapTargetInline`, the newly selected element — are **experimental and not
  Baseline** as of this writing. Feature-detect before relying on them; the portable version is
  `scrollend` plus your own "which child is centred" check.

## Gotchas

**Symptom: `el.scrollTop = 100` does nothing.**
Cause — `el` is not a scroll container; its `overflow` is `visible`, or it is `clip`, or the
content does not overflow under `auto`.
Fix — check the computed `overflow` of `el` itself, then walk up to find the element that really
scrolls. `hidden` **is** scrollable programmatically; `clip` is not.

**Symptom: `body { overflow: hidden }` does not lock the page.**
Cause — the propagation rule only uses `body`'s value while `html`'s overflow is `visible` in both
axes. Something set `overflow` on `html`, so the root's value wins.
Fix — set the lock on `document.documentElement`.

**Symptom: the page jumps sideways when a modal opens.**
Cause — hiding overflow removes the scrollbar, so the content box gets wider.
Fix — `scrollbar-gutter: stable` on the root, or pad by the measured scrollbar width.

**Symptom: scrolling to the end of a dropdown starts scrolling the page.**
Cause — scroll chaining, which is the default.
Fix — `overscroll-behavior-y: contain` on the dropdown's scroll pane.

**Symptom: `position: sticky` does nothing, and nothing in DevTools looks wrong.**
Cause — in order of likelihood: no `top`/`bottom` threshold; an ancestor with `overflow: hidden`
capturing it; a containing block with no spare height.
Fix — add the threshold first, then grep ancestors for `overflow`. Chrome DevTools flags a
"non-sticky" sticky element in the Elements panel.

**Symptom: the stuck-header shadow never appears.**
Cause — you observed the sticky header itself, and a sticky element never stops intersecting.
Fix — observe a sentinel element placed just before it.

**Symptom: after `scrollTo()`, `scrollTop` is not the number you passed.**
Cause — the container has `scroll-snap-type`, so the position settles on the nearest snap point.
Fix — read the position after `scrollend`, and treat snap points as the source of truth.

## Interview questions

**★ Which `overflow` values create a scroll container?**
`scroll` always; `auto` when the content overflows; `hidden` when it overflows — and `hidden` is
still scrollable **programmatically**, which is how carousels are built. `clip` creates none and
cannot be scrolled at all.

**★ Why does `document.body.scrollTop` return `0`, and when does `body`'s overflow lock the page?**
The root element is the viewport's scroll container. Per the CSS Overflow spec, the root's overflow
applies to the viewport unless the root is `visible` on both axes, in which case the `body`'s value
propagates instead — which is exactly why `body { overflow: hidden }` usually works, and stops
working the moment something sets `overflow` on `html`.

**★ Why is `position: sticky` not sticking?**
No inset threshold on that axis (it degrades to `relative`), an ancestor with a scrolling mechanism
capturing it, or a containing block with no height to travel through. Check in that order.

**★ How do you detect that a sticky header has stuck?**
There is no event or selector. Put a sentinel element above it and use an `IntersectionObserver` —
observing the header itself never works, because a sticky element always intersects.

**★ What does `overscroll-behavior: contain` do that `none` does not?**
Both stop scroll chaining; `contain` keeps the platform's own overscroll effect inside the element,
while `none` removes it. Both also disable native gestures like pull-to-refresh on that element.

**How do you stop the page scrolling behind a modal without losing the reader's place?**
Save `window.scrollY`, set `overflow: hidden` on the root, and restore with
`behavior: 'instant'` on close. Reserve the scrollbar with `scrollbar-gutter: stable` so the layout
does not shift, and add `overscroll-behavior: contain` to the modal's scroll pane.

---

← [02 · Landing on an element](./02-landing-on-an-element.md) · [Topic index](./README.md) ·
[04 · Watching and restoring](./04-watching-and-restoring.md) →
