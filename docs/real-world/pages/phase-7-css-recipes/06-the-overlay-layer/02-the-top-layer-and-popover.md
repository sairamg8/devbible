---
title: "The top layer, and the UA styles you have to undo"
sidebar_label: "02 · Top layer and popover"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer),
> [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog),
> [`HTMLDialogElement.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal),
> [`::backdrop`](https://developer.mozilla.org/en-US/docs/Web/CSS/::backdrop),
> [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API),
> [`:popover-open`](https://developer.mozilla.org/en-US/docs/Web/CSS/:popover-open),
> [`overlay`](https://developer.mozilla.org/en-US/docs/Web/CSS/overlay),
> [`transition-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior),
> [`@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style).
> Baseline note carried from
> [CSS 7·04](../../../../css/pages/phase-7-positioning/04-the-clipped-dropdown-problem.md):
> `<dialog>` **widely available**, `popover` **newly available since
> 2025-01-27**. The React wrapper is
> [chapter 4·07](../../phase-4-react-ui/07-modal-portal-focus.md).
> No sandbox, no measured timings.

**The top layer is a separate painting surface above the whole document. An
element promoted into it ignores every ancestor's `overflow` and every ancestor's
stacking context**, which is why [chunk 01](01-the-storefront-overlays.md) can
retire nine of this app's eleven overlays from the numbering problem entirely.
Order within it is insertion order, and `z-index` does not apply.

What the top layer does *not* do is style anything for you. Both promotion
mechanisms ship opinionated user-agent styles, and most of the work in this
chapter is undoing them precisely enough that the storefront's tokens take over
without breaking the behaviour that made the element worth promoting.

## Two ways in, and they are not interchangeable

| | `<dialog>` + `showModal()` | `popover` attribute |
|---|---|---|
| Top layer | yes | yes |
| `::backdrop` | yes | yes |
| Focus moved in | yes | no |
| Background inert | yes | no |
| `Escape` closes | yes | yes (for `auto`) |
| Light dismiss | no | yes (for `auto`) |
| Needs JavaScript | yes | **no** |

`dialog.show()` — without `Modal` — is the trap: it opens the dialog **without
promoting it to the top layer**, so there is no backdrop, no inertness, and
every clipping and stacking problem returns. In this codebase `show()` is never
correct; the cart drawer is modal, and everything non-modal is a popover.

## Undoing the `<dialog>` UA styles

The user-agent stylesheet gives `<dialog>` a border, padding, `margin: auto`,
and `max-width`/`max-height` constraints — plus `display: none` when it is not
open, which is the one rule that must survive.

```css
@layer components {
  dialog {
    margin: auto;                    /* keep: this is what centres it */
    padding: 0;                      /* reset: we own the chrome */
    border: 0;
    background: var(--surface-raised);
    color: var(--text);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-overlay);
    max-inline-size: min(32rem, 100% - 2rem);
    max-block-size: min(40rem, 100dvb - 2rem);
    overflow: auto;
  }

  dialog::backdrop {
    background: var(--overlay-scrim);
  }
}
```

`100dvb` rather than `100vh`: the dynamic viewport unit accounts for mobile
browser chrome that appears and disappears, which is exactly the case where a
fixed-height dialog ends up with its action buttons under the address bar. The
logical properties (`max-inline-size`, `max-block-size`) cost nothing and are
correct if the storefront is ever translated into a vertical writing mode.

### 🔴 `::backdrop` and custom properties

`::backdrop` is generated for top-layer elements and is **not** a descendant of
the element it belongs to, so inheritance of custom properties into it has been
inconsistent across engines. The reliable pattern is to define the scrim on
`:root` and reference it:

```css
:root                             { --overlay-scrim: rgb(0 0 0 / 0.5); }
:root[data-theme="dark"]          { --overlay-scrim: rgb(0 0 0 / 0.7); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --overlay-scrim: rgb(0 0 0 / 0.7); }
}
```

The same three-block structure as every other token
([Dark mode chunk 01](../05-dark-mode/01-three-states-not-two.md)). The dark
scrim is *stronger*, not weaker: a 50% black scrim over an already-dark page
barely separates the dialog from what is behind it.

Defining it on `:root` also means the value is resolvable no matter how the
engine treats backdrop inheritance — a token that fails to inherit is not a
subtle bug, it is a fully transparent scrim over a fully interactive-looking
page.

## Undoing the popover UA styles

A popover's defaults are more surprising than the dialog's: when open it is
`position: fixed` and centred in the viewport by `inset: 0; margin: auto`. That
is correct for a command palette and wrong for every menu.

```css
@layer components {
  [popover] {
    margin: 0;                       /* undo the centring */
    padding: 0;
    border: 0;
    inset: auto;                     /* undo inset: 0 */
    background: var(--surface-raised);
    color: var(--text);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
  }
}
```

`inset: auto` and `margin: 0` are the two that matter. Leaving either in place
produces a menu pinned to the middle of the screen, which reads as a broken
modal rather than a mispositioned menu.

The declarative form needs no JavaScript at all:

```html
<button popovertarget="cat-menu">Categories</button>
<div id="cat-menu" popover>…</div>
```

The browser wires the toggle, `Escape`, and light dismiss. For the search
suggestions and the admin row menu this removes the entire open/close state from
React, which is worth more than the CSS it costs.

**Positioning it against its trigger** is the part the API does not do on its
own in every engine. The storefront's approach is to treat CSS anchor
positioning as a progressive enhancement and keep a workable default underneath:
the popover is positioned with `position-area` where that is supported, and
otherwise falls back to being placed by the trigger's measured rectangle. What
must not happen is styling the fallback as if it were centred — that is the
default this section just undid.

## Animating in and out of the top layer

This is where overlays that look finished fall apart, because three properties
involved are **discrete**: `display`, and — for top-layer elements — `overlay`,
which is what actually holds the element in the top layer.

A naive fade-out plays with the element already removed from the top layer,
which means it drops behind the page for the whole animation.

```css
@layer components {
  dialog {
    opacity: 0;
    translate: 0 0.5rem;
    transition:
      opacity 150ms ease,
      translate 150ms ease,
      display 150ms allow-discrete,
      overlay 150ms allow-discrete;    /* keeps it in the top layer while it leaves */
  }

  dialog[open] { opacity: 1; translate: 0 0; }

  /* The entry values, applied for the first frame only. */
  @starting-style {
    dialog[open] { opacity: 0; translate: 0 0.5rem; }
  }
}
```

Three pieces, all required: `allow-discrete` so `display` and `overlay` animate
at all, `overlay` in the transition list so the element stays promoted while it
fades, and `@starting-style` to give the browser a "before" to transition *from*
— without it the entry animation is skipped entirely, because the element goes
straight from not-rendered to its open state.

All of it sits under a motion guard, as the storefront's motion rules require:

```css
@media (prefers-reduced-motion: reduce) {
  dialog, [popover] { transition: none; }
}
```

## Gotchas

### The dialog opens with no backdrop and gets clipped
**Symptom.** The modal appears, but inside its container and with no scrim.
**Cause.** `dialog.show()` instead of `showModal()`. Only the modal form
promotes to the top layer.
**Fix.** `showModal()`. There is no case in this app for `show()`.

### The scrim is transparent
**Symptom.** No dimming behind the dialog; the page looks interactive.
**Cause.** `::backdrop` referenced a custom property defined on an ancestor, and
it did not inherit.
**Fix.** Define scrim tokens on `:root` and reference those.

### Dark mode's scrim is too weak
**Symptom.** The dialog does not separate from the page in dark mode.
**Cause.** One scrim value shared by both themes.
**Fix.** The dark scrim is stronger. It is a themed token like any other.

### Every menu opens in the centre of the screen
**Symptom.** Popovers appear as small centred boxes.
**Cause.** The UA default `inset: 0; margin: auto` was not undone.
**Fix.** `inset: auto; margin: 0` on `[popover]`.

### The exit animation plays behind the page
**Symptom.** The dialog fades out *underneath* the content it was covering.
**Cause.** The element left the top layer immediately, because `overlay` was not
in the transition list.
**Fix.** `overlay <duration> allow-discrete` alongside `display`.

### The entry animation never plays
**Symptom.** The dialog appears instantly; the exit animation works.
**Cause.** No `@starting-style`, so there is no "from" state — the element is
not rendered at all before it opens.
**Fix.** `@starting-style` with the entry values.

### The dialog's buttons are under the mobile address bar
**Symptom.** The action row is unreachable on a phone.
**Cause.** `max-height: 100vh`, which ignores the dynamic browser chrome.
**Fix.** `100dvb` (or `100dvh`).

### A `z-index` was added to make the dialog appear on top
**Symptom.** Nothing changes, and the declaration stays.
**Cause.** `z-index` does not apply to top-layer elements.
**Fix.** Remove it — and check `showModal()` is actually being called, because
if the number *did* help, the element was never promoted.

## Interview questions

**What does promotion to the top layer actually buy?**
Escape from every ancestor's `overflow` clipping and every ancestor's stacking
context, plus a `::backdrop` pseudo-element. It removes both failure modes that
`z-index` cannot address.

**What is the difference between `show()` and `showModal()`?**
`showModal()` promotes to the top layer, moves focus in, makes the background
inert and renders `::backdrop`. `show()` does none of that — it just makes the
dialog visible in place, with all the clipping and stacking problems intact.

**Why are scrim colours defined on `:root` rather than on the dialog?**
`::backdrop` is not a descendant of its originating element, and custom-property
inheritance into it has been inconsistent across engines. A token on `:root`
resolves regardless, and the failure it prevents — a fully transparent scrim —
is not subtle.

**Why is the dark-mode scrim stronger than the light one?**
Because a 50% black scrim over an already-dark page provides almost no
separation. The scrim's job is contrast against what is behind it, which is
theme-dependent.

**What are the three parts of animating a dialog in and out?**
`transition-behavior: allow-discrete` for `display`; `overlay` in the transition
list so the element stays in the top layer while it exits; and `@starting-style`
to supply the from-state for the entry.

**What happens if `overlay` is left out of the transition?**
The element leaves the top layer immediately, so the exit animation plays behind
the page content it was covering.

**Why does the declarative popover form matter beyond saving code?**
It moves open/close state, `Escape` and light dismiss out of React entirely.
For the search suggestions and the admin row menu that removes a whole class of
state-synchronisation bugs, which is worth more than the CSS reset it costs.

---

← Prev: [The inventory](01-the-storefront-overlays.md) · Index: [The overlay layer](README.md) · Next → [The toast region](03-the-toast-region.md)
