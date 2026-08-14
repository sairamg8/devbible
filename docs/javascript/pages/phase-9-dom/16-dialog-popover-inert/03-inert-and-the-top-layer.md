---
title: "03 · inert and the top layer"
sidebar_label: "03 · inert and the top layer"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert), [`HTMLDialogElement.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal), [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API), [`aria-hidden`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden). Documentation-validated; **no timings**.

`inert` and the top layer are the two primitives underneath both previous chunks. Knowing them
directly is what lets you reason about the cases the components do not cover.

## `inert`, precisely

Setting `inert` on an element makes it **and its entire subtree** non-interactive. MDN's list:

- `click` events do not fire
- elements cannot receive focus, and focus events do not fire
- content cannot be selected — as if text selection were disabled
- inputs and `contenteditable` cannot be edited
- **find-in-page skips it**
- it is **removed from the accessibility tree**

```js
appRoot.inert = true;        // property
appRoot.toggleAttribute('inert', true);   // attribute — same thing
```

**Baseline widely available since April 2023.**

### The three ways to say "not now", and why they differ

| | Scope | Blocks interaction | Out of the a11y tree | Still visible |
|---|---|---|---|---|
| `inert` | whole subtree | **yes** | **yes** | yes |
| `aria-hidden="true"` | subtree, announcement only | **no** | yes | yes |
| `disabled` | one form control | yes | as disabled | yes |

🔴 **`aria-hidden` on interactive content is a bug, not a lighter `inert`.** It produces an element
a keyboard user can Tab into and a screen reader announces as nothing — strictly worse than doing
nothing at all. Regions get `inert`; individual controls get `disabled`.

⚠️ **`inert` has no visual effect whatsoever.** MDN calls this out explicitly: nothing indicates a
region is inert, so provide the dimming, the overlay, or the reduced opacity yourself. An inert
region that looks live is a user pressing buttons that do nothing.

### Where it is genuinely useful

- **Off-screen navigation drawers.** The classic bug is a closed drawer that is translated
  off-screen but still in the tab order — Tab walks the user through invisible links. `inert` while
  closed fixes it in one attribute. (`display: none` and `visibility: hidden` also fix it, but they
  break the slide-in transition, which is why the drawer was translated in the first place.)
- **Carousel slides that are off-view.**
- **A form section disabled as a group** — one `inert` instead of `disabled` on twenty inputs. Note
  the difference in submission though: `disabled` controls are excluded from the form payload,
  while `inert` ones are **not** ([09 · Forms](../09-forms/01-formdata.md) — successful controls).
- **The page behind a hand-rolled modal**, which is what `showModal()` automates.

### The escape hatch

A modal dialog **escapes inertness**: it does not inherit `inert` from an ancestor, and can only be
made inert by setting the attribute on the dialog itself. Everything else inherits it, with no way
out — so a modal you open from inside an inerted subtree still works, and any other component there
does not.

## The top layer

The top layer is a rendering layer **above the entire document**, outside every stacking context.
Content promoted to it cannot be clipped or reordered by ancestors. Three things go there:

| Promoted by | What |
|---|---|
| `dialog.showModal()` | modal dialogs |
| `showPopover()` / `popovertarget` | popovers |
| `requestFullscreen()` | the fullscreen element |

What that buys you, concretely: `z-index` no longer matters between these and page content, an
ancestor's `overflow: hidden` cannot clip them, and an ancestor's `transform` — which normally
makes `position: fixed` descendants position against it rather than the viewport — cannot capture
them either. That last one is the bug that used to force people to portal a modal to `<body>` by
hand.

`::backdrop` is the pseudo-element painted behind top-layer content. Modal dialogs get one that
blocks the page; popovers can style one without it being modal.

### Animating in and out of the top layer

Entering and leaving the top layer is a **discrete** change, so a plain transition has nothing to
animate on the way out — the element is simply gone. The CSS that makes it work:

```css
dialog {
  opacity: 0;
  transition: opacity 200ms, overlay 200ms allow-discrete, display 200ms allow-discrete;
}
dialog[open] { opacity: 1; }

@starting-style {
  dialog[open] { opacity: 0; }      /* the state to animate FROM on entry */
}
```

`allow-discrete` lets `display` and `overlay` participate in the transition; `@starting-style`
supplies the entry starting point, because an element that has just been created has no previous
value to interpolate from. Without both, dialogs fade in and then vanish instantly.

## Choosing between the three

```
Must the user answer before continuing?      → <dialog>.showModal()
Transient surface, page stays usable?        → popover (auto)
Neither — a region that must go dormant?     → inert
```

**The trade-off in one line:** the components (`showModal`, `popover`) buy correct behaviour at the
cost of the platform's opinions about focus, dismissal and layering; `inert` buys precise control at
the cost of writing everything else yourself.

## Gotchas

**Symptom: Tab walks through an off-screen menu the user cannot see.**
Cause — the menu is moved off-screen with `transform` or `left: -9999px`, which does not remove it
from the tab order.
Fix — `inert` while it is closed. Keep `visibility: hidden` in mind as an alternative when a
transition is not needed.

**Symptom: users click things in a dimmed background and nothing happens, with no explanation.**
Cause — `inert` correctly blocks it, but nothing says so visually.
Fix — dim or overlay the inert region yourself; MDN warns there is no built-in indication.

**Symptom: setting `inert` on the page root also disabled the modal.**
Cause — the modal is inside the inerted subtree.
Fix — make it a sibling, or use `showModal()`, which escapes inertness.

**Symptom: fields in an `inert` section still arrive in the form submission.**
Cause — `inert` is not `disabled`; it blocks interaction, not participation.
Fix — `disabled` on the controls if they must be excluded from the payload.

**Symptom: the dialog animates in but disappears instantly on close.**
Cause — leaving the top layer is a discrete change.
Fix — `transition-behavior: allow-discrete` on `display`/`overlay`, plus `@starting-style` for the
entry.

**Symptom: a modal is clipped by an ancestor with `overflow: hidden`.**
Cause — it was not opened modally, so it never reached the top layer.
Fix — `showModal()` rather than `show()` or the `open` attribute.

## Interview questions

**★ What exactly does `inert` do?**
Makes a subtree non-interactive: no clicks, no focus, no text selection, no editing, skipped by
find-in-page, and removed from the accessibility tree. Baseline since April 2023, and with **no
visual effect** — the dimming is yours to provide.

**★ Why is `inert` the right tool where `aria-hidden` is wrong?**
`aria-hidden` hides content from assistive technology while leaving it clickable and tabbable — a
control a keyboard user reaches and a screen reader cannot describe. `inert` removes both the
interaction and the exposure.

**★ What is the top layer and what goes in it?**
A rendering layer above the whole document, outside all stacking contexts: modal dialogs, popovers
and the fullscreen element. Ancestor `z-index`, `overflow` and `transform` cannot affect content
there, which removes the reason to portal modals to `<body>`.

**★ Why does a dialog vanish instead of animating out?**
Leaving the top layer is a discrete change, so there is nothing to interpolate. `allow-discrete` on
`display`/`overlay` plus `@starting-style` for entry is what makes both directions animate.

**Does `inert` remove form fields from a submission?**
No — it blocks interaction, not participation. `disabled` is what excludes a control from the form
payload.

**Can a modal dialog be inerted?**
Only by putting `inert` on the dialog itself. A modal dialog does not inherit inertness from an
ancestor, unlike everything else.

---

← [02 · The Popover API](./02-the-popover-api.md) · [Topic index](./README.md) ·
**17 · `MutationObserver`** *(not written yet)* →
