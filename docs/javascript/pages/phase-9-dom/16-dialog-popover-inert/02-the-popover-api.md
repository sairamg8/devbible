---
title: "02 · The Popover API"
sidebar_label: "02 · The Popover API"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), [`popover` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover), [`HTMLElement.showPopover()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/showPopover), [`beforetoggle` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/beforetoggle_event), [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog). Documentation-validated; **no timings**.

The Popover API is the platform's answer to everything that is *not* a modal: menus, tooltips,
toasts, date pickers, "more actions" panels. It gives you the top layer and light dismiss without
writing a single outside-click handler.

⚠️ **Baseline 2025 — newly available** (since January 2025). It works in current browsers; check
before relying on it in an environment that pins older ones.

## The declarative version has no JavaScript at all

```html
<button popovertarget="filters">Filters</button>

<div id="filters" popover>
  <!-- menu content -->
</div>
```

That is the whole component. The button toggles the popover, the popover renders in the top layer,
clicking outside closes it, Escape closes it.

| Attribute | On | Does |
|---|---|---|
| `popover` (`= "auto"`) | the popover | light-dismissable, closes other auto popovers |
| `popover="manual"` | the popover | only closes via a control or the API |
| `popover="hint"` | the popover | for hover/focus-triggered hints (interest invokers) |
| `popovertarget="id"` | a `<button>` or `<input>` | which popover it controls |
| `popovertargetaction` | the same control | `"show"`, `"hide"` or `"toggle"` (default) |

**`auto` versus `manual` is the decision that matters.** `auto` gets light dismiss — click outside,
Escape, or another `auto` popover opening — which is right for menus and pickers. `manual` stays
until something explicitly closes it, which is right for a toast that must not vanish when the user
clicks elsewhere, and wrong for almost everything else.

## The JavaScript surface

```js
el.showPopover();
el.hidePopover();
el.togglePopover();          // optional boolean forces a direction
el.popover = 'manual';       // the reflected property
```

Events fire on the popover itself:

```js
panel.addEventListener('beforetoggle', (e) => {
  if (e.newState === 'open') loadContentsOnce();     // cancellable
});

panel.addEventListener('toggle', (e) => {
  console.log(e.newState);   // 'open' | 'closed' — after the change
});
```

`beforetoggle` is the hook for lazy-loading a menu's contents, and it can be cancelled with
`preventDefault()`. `toggle` is the "it has happened" notification — use it to sync
`aria-expanded` on a control you built yourself.

## Popover is not a modal, and that is the point

| | `popover="auto"` | `dialog.showModal()` |
|---|---|---|
| Rest of the page | **stays interactive** | **inert** |
| Focus | not trapped, not moved for you | moved in, trapped, returned |
| Light dismiss | **built in** | no — Escape only |
| Backdrop | `::backdrop` available, not modal | `::backdrop`, blocks the page |
| Several open at once | one `auto` chain; `manual` freely | one |

🔴 **Do not build a confirmation dialog out of a popover.** The page stays interactive and focus is
not contained, so the user can act on the thing they are being asked about. Modal question →
`<dialog>.showModal()` ([01 · The dialog element](./01-the-dialog-element.md)). Transient,
dismissable surface → popover.

The two do compose: a `<dialog popover>` is legal, and MDN documents the combination.

## What you still owe a popover

The API handles positioning-layer and dismissal. It does **not** make your menu accessible:

- **The role and state.** A popover is a `<div>` unless you say otherwise. A menu button needs
  `aria-expanded` on the trigger — and when you use `popovertarget`, the browser manages that for
  the built-in control, but any custom trigger you wire up with `showPopover()` is yours to keep in
  sync ([15 · 03 · ARIA from JavaScript](../15-focus-and-accessibility/03-aria-from-javascript.md)).
- **Keyboard navigation inside it.** Arrow keys through a menu are the roving-tabindex pattern from
  [15 · 02](../15-focus-and-accessibility/02-managing-focus.md); the popover gives you none of it.
- **Focus placement.** Nothing moves focus into an `auto` popover. For a menu opened by keyboard,
  focus the first item yourself on `toggle`.
- **Positioning.** Popovers are centred in the viewport by default. Anchoring one to its trigger is
  CSS anchor positioning, or a positioning library — not part of this API.

## Where popovers replace old code

- **Outside-click dismissal.** The `document.addEventListener('click', …)` handler with the
  `contains()` check, the capture-phase ordering bug and the "the trigger reopens it immediately"
  bug — all deleted.
- **z-index escalation.** Top layer, so a menu can no longer be clipped by an ancestor's
  `overflow: hidden` or lose to another component's `z-index`.
- **Escape handling** for the dismissable case.

## Gotchas

**Symptom: the popover appears in the middle of the screen instead of next to its button.**
Cause — default positioning is viewport-centred; the API does not anchor.
Fix — CSS anchor positioning, or your own positioning code. Do not assume it follows the trigger.

**Symptom: a toast disappears as soon as the user clicks anything.**
Cause — `popover` defaults to `auto`, which light-dismisses.
Fix — `popover="manual"` and close it on a timer or a button.

**Symptom: opening one menu closes another one that should have stayed.**
Cause — opening an `auto` popover closes other `auto` popovers that are not its ancestors.
Fix — `manual` for the one that must persist, or nest them so the relationship is real.

**Symptom: keyboard users can tab straight out of an open menu into the page.**
Cause — popovers do not trap focus; they are non-modal by design.
Fix — that is correct for a menu; add roving-tabindex navigation and close on `focusout` when focus
leaves. If you actually need containment, you need a modal dialog.

**Symptom: `aria-expanded` on the trigger never updates.**
Cause — you opened the popover with `showPopover()` from a custom control rather than
`popovertarget`.
Fix — sync it in the `toggle` handler using `event.newState`.

**Symptom: `showPopover()` throws.**
Cause — the element has no `popover` attribute, or it is not in the document.
Fix — set `el.popover = 'auto'` (or the attribute) and insert it before showing.

## Interview questions

**★ When do you use a popover and when a modal dialog?**
Popover for transient, dismissable surfaces where the page should stay usable — menus, tooltips,
pickers, toasts. Modal `<dialog>` when the user must answer before continuing: it inerts the page,
traps focus and returns it.

**★ What does `popover="auto"` give you for free?**
The top layer, light dismiss on outside click and Escape, and mutual exclusion with other `auto`
popovers — all without JavaScript when paired with `popovertarget` on a button.

**★ What is the difference between `beforetoggle` and `toggle`?**
`beforetoggle` fires before the state changes and can be cancelled — the place to lazy-load
content. `toggle` fires after, and is where you sync external state such as `aria-expanded`. Both
carry `newState`.

**★ Does the Popover API make a menu accessible?**
No. It handles layering and dismissal. Role, `aria-expanded` on custom triggers, arrow-key
navigation and initial focus placement are still yours.

**Why does the top layer matter?**
Content in it escapes stacking contexts entirely, so a menu cannot be clipped by an ancestor's
`overflow: hidden` or lose a `z-index` fight — the two oldest bugs in dropdown code.

**What is `popover="manual"` for?**
Surfaces that must not light-dismiss: toasts, a persistent inspector panel, anything the user
should close deliberately.

---

← [01 · The dialog element](./01-the-dialog-element.md) · [Topic index](./README.md) ·
[03 · inert and the top layer](./03-inert-and-the-top-layer.md) →
