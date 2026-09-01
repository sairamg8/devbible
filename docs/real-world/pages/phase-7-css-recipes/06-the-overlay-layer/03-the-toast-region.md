---
title: "The toast region, which must never take focus"
sidebar_label: "03 · The toast region"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`role="status"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role),
> [`role="alert"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/alert_role),
> [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions),
> [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API),
> [`env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env),
> [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) —
> the **WAI-ARIA Authoring Practices** on status messages, and **WCAG 2.2**
> SC 2.2.1 (Timing Adjustable) and SC 4.1.3 (Status Messages).
> Related: the announcement pattern for loading states is
> [chapter 7·04](../04-skeletons-and-spinners/01-skeleton-spinner-or-nothing.md).
> No sandbox, no measured timings.

**A toast is the only overlay in this app that must appear over everything and
take nothing.** "Added to cart" is the primary feedback for the storefront's
primary action, so it has to be reliable — and it fires while people are typing
discount codes, mid-checkout, inside open dialogs. A toast that moves focus,
that closes the dialog underneath it, or that disappears before an "Undo" can be
pressed is worse than no toast.

Every decision below follows from that one constraint: **top layer, never
modal.**

## The region exists before the first toast

```html
<!-- Rendered once, at app mount. Empty. -->
<div id="toasts" popover="manual" class="toast-region">
  <ol class="toast-region__list" role="status" aria-relevant="additions"></ol>
</div>
```

🔴 **A live region must be in the DOM before content is put into it.** Assistive
technology observes an *existing* region for changes; a region that is inserted
already containing its message is frequently not announced at all. This is the
single most common reason a toast system tests fine visually and announces
nothing.

`role="status"` carries an implicit `aria-live="polite"` and
`aria-atomic="true"` — it waits for a pause rather than interrupting, which is
right for confirmations. **`role="alert"` is assertive and interrupts**, and is
reserved here for the error toast that reports a failed checkout. Using `alert`
for "Added to cart" makes the app talk over its own user on every click.

The region is `popover="manual"`, which is what
[chunk 01](01-the-storefront-overlays.md) classified it as: promoted to the top
layer, so it survives any container and appears over an open dialog, **without**
the focus management and light-dismiss that `popover` (i.e. `auto`) would bring.
An `auto` popover here would close the mega-menu — or the dialog — every time an
item was added.

## The stack

```css
@layer components {
  .toast-region {
    /* undo the popover UA centring (chunk 02) */
    inset: auto;
    margin: 0;
    background: none;
    border: 0;
    box-shadow: none;
    padding: 0;

    position: fixed;
    inset-block-end: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    inset-inline-end: var(--space-4);
    inline-size: min(24rem, 100% - 2rem);
  }

  .toast-region__list {
    display: flex;
    flex-direction: column-reverse;   /* newest nearest the corner */
    gap: var(--space-2);
    margin: 0; padding: 0; list-style: none;
  }

  .toast {
    background: var(--surface-raised);
    color: var(--text);
    border: 1px solid var(--border);
    border-inline-start: 4px solid var(--toast-accent, var(--accent));
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-overlay);
    padding: var(--space-3);
  }

  .toast--success { --toast-accent: var(--stock-in); }
  .toast--error   { --toast-accent: var(--danger);   }
}
```

`env(safe-area-inset-bottom, 0px)` keeps the stack clear of the home indicator
on a notched phone — without it the newest toast, the one most likely to carry
the "Undo", is the one partly under the system gesture area.

**The region itself is transparent and unbordered.** It is a positioning shell,
not a surface: the UA popover styles from
[chunk 02](02-the-top-layer-and-popover.md) give it a background and a box,
which would render as an empty panel whenever the stack is empty.

`column-reverse` puts the newest toast nearest the screen corner, so the one
that just appeared is the one under the cursor's likely path — and older toasts
move away from it rather than shoving it.

## Colour is never the only channel

`.toast--success` and `.toast--error` differ by an accent stripe, and that is
deliberately not sufficient on its own. Each toast carries an icon and, more
importantly, text that states the outcome — "Added to cart", "Payment
declined". The stripe is recognition, not information, and this is the same rule
the order-status badges follow in
[Dark mode chunk 02](../05-dark-mode/02-the-token-layer.md).

## Motion

```css
@layer components {
  .toast {
    transition: opacity 150ms ease, translate 150ms ease;
  }
  @starting-style {
    .toast { opacity: 0; translate: 0 0.5rem; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast { transition: none; }
}
```

A toast entering is a *new element*, so `@starting-style` is what gives it a
from-state — the same mechanism as the dialog in chunk 02, for the same reason.
Sliding in from the edge of the screen is a larger movement than this warrants;
half a rem of vertical travel reads as "arrived" without dragging the eye off
the page.

## Timing, and the toast that must not expire

**A toast with an action never auto-dismisses.** "Item removed — Undo" that
vanishes on a timer fails WCAG 2.2 SC 2.2.1 for anyone who reads slowly, and
fails everyone who was looking somewhere else. The rule the storefront applies:

| Toast | Dismissal |
|---|---|
| Confirmation, no action ("Added to cart") | auto after a few seconds, **paused on hover or focus** |
| Carries an action ("Undo") | manual only — a close button, or the action itself |
| Error ("Payment declined") | manual only, `role="alert"` |

Pausing on hover and on **focus** matters equally: a keyboard user tabbing to
the Undo button is not hovering, and a timer that keeps running removes the
control from under their focus. That is a focus-loss bug, not just a timing one.

The timer belongs to the component, not the stylesheet, but the requirement is
recorded here because it is the constraint that decides whether the toast needs
a close button — and therefore what the stylesheet has to lay out.

## Ordering against dialogs

Top-layer order is insertion order. A toast raised **while** a dialog is open
enters the top layer later and paints above it, which is what is wanted. A toast
raised **before** a dialog opens is covered by it.

That asymmetry is acceptable and is not worked around: a toast that outlived the
opening of a modal has already served its purpose, and re-promoting the region
on every dialog open would put transient confirmations over a checkout
confirmation — the opposite of the priority the user has.

## Gotchas

### The toast is never announced
**Symptom.** It renders correctly; a screen reader says nothing.
**Cause.** The live region was created at the same moment as its content.
**Fix.** Render the empty region at app mount and insert into it.

### The app interrupts itself on every click
**Symptom.** Speech is cut off constantly while browsing.
**Cause.** `role="alert"` used for routine confirmations.
**Fix.** `role="status"` for confirmations; reserve `alert` for errors.

### Adding to cart closes the open dialog
**Symptom.** The confirm dialog vanishes when a toast appears.
**Cause.** The region was given `popover` (defaulting to `auto`), and opening an
auto popover closes other auto popovers.
**Fix.** `popover="manual"`.

### An empty panel floats in the corner
**Symptom.** A small blank box, visible when no toast is showing.
**Cause.** The popover UA background, border and padding were not reset on the
region shell.
**Fix.** The region is transparent; the `.toast` carries the surface.

### The newest toast sits under the phone's gesture bar
**Symptom.** The Undo button is unreachable on a notched device.
**Cause.** Bottom offset in fixed units.
**Fix.** `calc(var(--space-4) + env(safe-area-inset-bottom, 0px))`.

### Toasts appear instantly and leave with a fade
**Symptom.** Only the exit is animated.
**Cause.** No `@starting-style`, so a newly inserted element has no from-state.
**Fix.** `@starting-style` with the entry values.

### The Undo disappears while it is being pressed
**Symptom.** A user tabs to Undo and the toast expires under them.
**Cause.** The auto-dismiss timer pauses on hover but not on focus.
**Fix.** Actionable toasts do not auto-dismiss at all; where a timer exists it
pauses on hover **and** focus.

### The toast stack pushes the consent bar
**Symptom.** Overlap or displacement at the bottom of the screen.
**Cause.** Both are anchored to the bottom edge, and the consent bar is in
normal flow at `--z-consent` while the toasts are in the top layer.
**Fix.** Offset the region's `inset-block-end` by the consent bar's height while
it is present. The top layer cannot be reordered against page content, so the
only lever is geometry.

## Interview questions

**Why must the live region exist before the first toast?**
Assistive technology watches an existing region for changes. A region inserted
already containing its message is frequently not announced, which produces a
toast system that looks correct and is silent.

**When is `role="alert"` appropriate, and when is it harmful?**
Appropriate for errors that must interrupt — a declined payment. Harmful for
routine confirmations, because assertive announcements talk over the user on
every add-to-cart.

**Why is the toast region `popover="manual"` rather than `popover`?**
`popover` defaults to `auto`, which light-dismisses and closes other auto
popovers. A toast appearing would then close the mega-menu or the open dialog.
`manual` promotes to the top layer without either behaviour.

**Why does the region shell have no background of its own?**
Because the popover UA styles supply one, and it would render as an empty panel
whenever the stack is empty. The region is a positioning shell; the surface
belongs to each toast.

**A toast raised before a dialog opens is hidden behind it. Why is that not
fixed?**
Top-layer order is insertion order, and re-promoting the region on every dialog
open would place transient confirmations above a checkout confirmation. The
asymmetry matches the user's actual priority.

**Which toasts may auto-dismiss?**
Only those with no action to take. Anything carrying an Undo, and any error,
dismisses manually — a timer on an actionable message fails SC 2.2.1 and can
remove a control from under a user's focus.

**Why must the pause-on-hover behaviour also pause on focus?**
Because a keyboard user reaching the Undo button is not hovering. A timer that
only pauses on hover expires while the control is focused, which is a
focus-destroying bug rather than merely an inconvenient one.

**Why `column-reverse` for the stack?**
So the newest toast is nearest the corner, where the pointer is heading, and
older toasts move away from it instead of displacing it.

---

← Prev: [Top layer and popover](02-the-top-layer-and-popover.md) · Index: [The overlay layer](README.md) · Next → [Scroll lock and the sticky header](04-scroll-lock-and-the-sticky-header.md)
