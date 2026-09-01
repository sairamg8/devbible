---
title: "Scroll lock, and the sticky header everything else is measured against"
sidebar_label: "04 · Scroll lock and the header"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior),
> [`scrollbar-gutter`](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter),
> [`scroll-padding`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding),
> [`scroll-margin`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin),
> [`position: sticky`](https://developer.mozilla.org/en-US/docs/Web/CSS/position),
> [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert),
> [viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/length).
> Concept home: **`position: sticky`** is
> [CSS 7·03](../../../../css/pages/phase-7-positioning/03-position-sticky.md).
> No sandbox, no measured timings.

**Two things in this app have a reach far beyond themselves: the page behind an
open overlay, and the height of the sticky header.** The first decides whether a
modal is usable on a phone; the second is referenced by the scroll position of
every in-page link, the top of the mega-menu, and the offset of the toast stack.
Both are handled once, at the root, and everything else reads the result.

## The scroll lock

`showModal()` makes the background **inert** — it cannot be clicked, focused or
reached by assistive technology ([chunk 02](02-the-top-layer-and-popover.md)).
Whether the page behind can still *scroll* is the part worth handling
explicitly rather than assuming, because it is the difference between a modal
that feels native and one that slides the catalogue around behind itself while
someone is trying to read it.

```css
@layer base {
  :root { scrollbar-gutter: stable; }        /* ALWAYS, not only while locked */
}

@layer components {
  body:has(dialog[open]) { overflow: hidden; }
}
```

🔴 **`scrollbar-gutter: stable` is declared unconditionally, and that is the
whole trick.** Applying `overflow: hidden` to a page that currently has a
scrollbar removes it, the content widens by the scrollbar's width, and the
entire page — including the sticky header behind the scrim — jumps sideways at
the moment the modal opens. Reserving the gutter permanently means there is
nothing to remove. The alternative, measuring the scrollbar width in JavaScript
and adding matching padding, is what this replaces.

`body:has(dialog[open])` keeps the lock declarative: no class to add, no state
to synchronise, and no way for the lock to survive a dialog that closed by a
route the JavaScript did not observe. A stuck scroll lock is one of the worst
failure modes an overlay system has, because the page looks fine and simply
refuses to move.

### Scroll chaining inside the drawer

The cart drawer scrolls its own content. When that content reaches its end, the
gesture continues into whatever is behind it — the page, or on mobile, a
pull-to-refresh.

```css
.drawer__body {
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

`contain` stops the chaining and suppresses the overscroll affordance without
disabling the drawer's own scrolling. It belongs on every scrollable region
inside an overlay: the drawer body, a long dialog, and the admin table inside a
modal.

### Heights on a phone

```css
dialog, .drawer { max-block-size: 100dvb; }
```

`dvb` (and `dvh`) track the *dynamic* viewport as mobile browser chrome appears
and retracts. `vh` is the large viewport, so a full-height drawer sized with it
extends under the address bar, and its action row — "Checkout", the one control
the drawer exists for — is the part that goes missing.

## The sticky header

```css
@layer components {
  .site-header {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--z-header);
    block-size: var(--header-h);
    background: var(--surface-raised);
  }
}

@layer base {
  :root {
    --header-h: 4rem;
    scroll-padding-block-start: calc(var(--header-h) + var(--space-2));
  }
}
```

**`--header-h` is a token because four other things need it**: the scroll
padding above, the mega-menu's top edge, the toast region's offset when the
consent bar is absent, and the `scroll-margin` on anchor targets. Hard-coding
`4rem` in four places is how a header redesign quietly breaks in-page links.

### `scroll-padding-block-start` is not optional

Without it, every in-page navigation lands its target *underneath* the sticky
header: the checkout's "Payment" section anchor, a link into the product
description, and — the one that matters most — the browser scrolling a focused
element into view during keyboard navigation. That last case is a genuine
accessibility failure, not a cosmetic one: the focused control is on screen as
far as the browser is concerned, and invisible to the user.

Setting it on the scroll container (here, the root) fixes all three at once.
`scroll-margin-block-start` on individual targets is the per-element escape
hatch for anything that needs a different offset.

### 🔴 The silent `position: sticky` failure

`position: sticky` stops working — with no error, no warning, and no visual
clue other than the header scrolling away — if **any ancestor** has an
`overflow` value other than `visible`. The mechanism is
[CSS 7·03](../../../../css/pages/phase-7-positioning/03-position-sticky.md).

It matters here because overlay work is exactly what introduces the offending
ancestor. Someone adds `overflow: hidden` to a wrapper to clip a decorative
element, or to stop a horizontal scrollbar appearing during a drawer animation,
and the header stops sticking on an unrelated page. The defence is to know it is
the first thing to check, and to keep the header's ancestors — `html`, `body`,
the app root — free of `overflow` declarations that were added for a reason
nobody recorded.

Note that the `body:has(dialog[open]) { overflow: hidden }` rule above is exactly
such a declaration. It is safe **because it applies only while a modal is open**,
when the header is behind a scrim and inert. Making it unconditional would break
sticky positioning site-wide.

### The scrolled state

The header gains a shadow once the page has moved. The robust way to know that
without a scroll listener is a zero-height sentinel at the top of the document
observed with `IntersectionObserver` — when the sentinel leaves the viewport,
the header is detached.

```css
.site-header[data-scrolled] { box-shadow: var(--shadow-header); }
```

Where scroll-driven animations are available they can replace the observer
entirely, and the storefront treats that as a progressive enhancement: the
sentinel is the baseline, because a header without a shadow is a smaller defect
than a header that never gets one.

**Do not animate the header's `block-size` on scroll.** A shrinking header
changes `--header-h`, which changes the scroll padding, which changes what is
under the pointer — and it forces layout on every frame of a scroll.

## Gotchas

### The page jumps sideways when a modal opens
**Symptom.** Everything shifts by the scrollbar width as the dialog appears.
**Cause.** `overflow: hidden` removed the scrollbar, so the content got wider.
**Fix.** `scrollbar-gutter: stable` on `:root`, declared unconditionally.

### The scroll lock is stuck
**Symptom.** The page will not scroll and no dialog is visible.
**Cause.** A class-based lock whose removal was missed on one close path.
**Fix.** `body:has(dialog[open])` — the lock is a consequence of the dialog's
state and cannot desynchronise.

### Scrolling to the end of the drawer scrolls the page
**Symptom.** The catalogue moves behind the open drawer, or the phone triggers
pull-to-refresh.
**Cause.** Scroll chaining.
**Fix.** `overscroll-behavior: contain` on the scrollable region.

### The drawer's Checkout button is unreachable on a phone
**Symptom.** The bottom of the drawer sits under the browser chrome.
**Cause.** `100vh`, which is the large viewport.
**Fix.** `100dvb` / `100dvh`.

### The header stopped sticking, and nothing about the header changed
**Symptom.** It scrolls away on some pages.
**Cause.** An ancestor gained a non-`visible` `overflow` — very often added
while working on an overlay.
**Fix.** Find and remove it. This is always the first thing to check, because
`position: sticky` fails silently.

### In-page links land under the header
**Symptom.** Clicking an anchor scrolls the target out of sight.
**Cause.** No `scroll-padding-block-start` on the scroll container.
**Fix.** Set it to the header height plus a little. The same fix repairs
keyboard focus being scrolled under the header, which is the more serious half.

### The header height is written in several places
**Symptom.** A redesign fixes the header and breaks anchor offsets.
**Cause.** `4rem` hard-coded in the scroll padding, the menu offset and the
toast offset.
**Fix.** `--header-h`, referenced by all of them.

### Scroll performance collapses on the catalogue
**Symptom.** Janky scrolling on long product lists, worst on mobile.
**Cause.** A scroll event listener toggling the header class, or an animated
header height forcing layout every frame.
**Fix.** A sentinel with `IntersectionObserver`, and a header whose size does not
change.

## Interview questions

**Why is `scrollbar-gutter: stable` declared all the time rather than with the
lock?**
Because the jump happens at the moment the scrollbar is removed. Reserving the
gutter permanently means there is nothing to remove, which replaces the older
measure-the-scrollbar-and-pad-the-body workaround entirely.

**Why express the scroll lock as `body:has(dialog[open])`?**
So the lock is a consequence of the dialog's state rather than a class someone
has to remember to remove. A stuck scroll lock looks like a frozen page with no
visible cause.

**Is that `overflow: hidden` not a risk to `position: sticky`?**
It would be if it were unconditional — a non-`visible` `overflow` on an ancestor
disables sticky silently. It is safe here only because it applies while a modal
is open, when the header is inert behind a scrim.

**What does `overscroll-behavior: contain` do that `overflow: hidden` on the
body does not?**
It stops the *gesture* chaining out of the drawer once its own content is
exhausted, including mobile pull-to-refresh, while leaving the drawer itself
scrollable. The body lock addresses a different surface.

**Why `100dvb` instead of `100vh` for a full-height drawer?**
`vh` is the large viewport, which assumes retracted mobile browser chrome. A
drawer sized with it extends under the address bar and loses its action row.

**Why is the header height a custom property?**
Because the scroll padding, the mega-menu offset, the toast offset and anchor
`scroll-margin` all derive from it. Hard-coding it is how a header redesign
silently breaks in-page links.

**What is the accessibility consequence of omitting `scroll-padding-block-start`?**
Keyboard focus gets scrolled to a position underneath the sticky header. The
browser considers the element visible; the user cannot see it. That is a focus
visibility failure, not a cosmetic offset.

**Why is a sentinel plus `IntersectionObserver` preferred over a scroll
listener?**
Because the listener runs on every scroll event on pages built around long
product lists, and toggling a class from it forces work on the scroll path. The
observer fires twice — on detach and re-attach — regardless of scroll length.

---

← Prev: [The toast region](03-the-toast-region.md) · Index: [The overlay layer](README.md) · Next → [The complete stylesheet](05-the-complete-stylesheet.md)
