---
title: "01 · The dialog element"
sidebar_label: "01 · The dialog element"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), [`HTMLDialogElement.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal), [`HTMLDialogElement.close()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/close), [`cancel` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/cancel_event), [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert). Documentation-validated; **no timings**.

`<dialog>` replaces the modal component every codebase used to write by hand — and, more to the
point, replaces the parts of it that were quietly wrong. The whole of
[15 · 02 · Managing focus](../15-focus-and-accessibility/02-managing-focus.md) is what
`showModal()` does for you in one call.

## `show()` versus `showModal()` — not a small difference

```js
dialog.show();        // non-modal: page stays interactive
dialog.showModal();   // modal: everything else becomes inert
```

| | `show()` | `showModal()` |
|---|---|---|
| Rest of the page | interactive | **inert** — "as if the `inert` attribute is specified" |
| Top layer + `::backdrop` | no | **yes** |
| Escape closes it | **no** | **yes**, firing `cancel` |
| `aria-modal` | `false` | **`true`** |
| How many at once | many | **one** |

🔴 **`show()` gives you almost none of the safety.** MDN says plainly that non-modal dialogs do not
dismiss on Escape by default, and they leave the page interactive. If you mean a modal, call
`showModal()`.

`showModal()` throws **`InvalidStateError`** if the dialog is already open non-modally — a real
crash when a "toggle" handler calls `show()` once and `showModal()` later. Check `dialog.open`
first, or always use the same method.

⚠️ **Do not render a dialog by setting the `open` attribute.** MDN recommends `show()` /
`showModal()` instead, and the reason is concrete: the attribute route gives you the non-modal
behaviour with none of the top-layer, backdrop, inerting or Escape handling, whatever the element
looks like on screen.

## The top layer is why z-index stops mattering

A modal dialog is promoted to the **top layer** — a rendering layer above the entire page,
outside the normal stacking context. So it cannot be trapped behind an ancestor's `overflow:
hidden`, a `transform`, or a competing `z-index: 9999`. The whole class of "my modal is behind the
header" bugs disappears.

`::backdrop` is the layer painted behind it, and it is styleable:

```css
dialog::backdrop { background: rgb(0 0 0 / 0.5); backdrop-filter: blur(2px); }
```

`::backdrop` exists only for the modal case. A dialog opened with `show()` has none.

## Focus, and the one attribute you should set

MDN: when `showModal()` opens a dialog, focus is set on **the first nested focusable element**.
That is usually the close button — so the first thing announced is "Close", which is exactly the
problem
[15 · 02](../15-focus-and-accessibility/02-managing-focus.md) describes.

The fix is declarative:

```html
<dialog id="confirm-delete">
  <h2>Delete this invoice?</h2>
  <p>This cannot be undone.</p>
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="delete" autofocus>Delete</button>
  </form>
</dialog>
```

MDN's guidance is to name the initial focus explicitly with `autofocus` — on the primary action, or
on the close button when nothing else needs immediate interaction.

⚠️ **Never put `tabindex` on the `<dialog>` element itself.** MDN states it outright: the attribute
"must not be used" there. The dialog's contents are focusable on their own; a `tabindex` on the
container makes the dialog a tab stop that announces nothing.

**On close, focus returns to the element that opened it** — the obligation you would otherwise
implement by hand. Which means the trigger must still be in the document: if your dialog deletes the
row that contained its own trigger, you are back to moving focus deliberately.

## Closing: `close()`, `returnValue`, and `method="dialog"`

```js
dialog.close('delete');            // closes and sets returnValue
dialog.returnValue;                // 'delete' — readable in the close handler

dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'delete') removeInvoice();
});
```

A `<form method="dialog">` inside the dialog is the declarative version: submitting it **closes the
dialog without sending anything to a server**, and sets `returnValue` to the submitting button's
`value`. The form's data is collected but not submitted — which makes it the natural way to build a
confirm dialog with no JavaScript at all beyond reading the result.

`returnValue` defaults to `''`, so distinguish "cancelled" from "confirmed" by value, not by
truthiness — a button with `value=""` and Escape both leave it empty.

### The `cancel` event

Escape on a modal dialog fires `cancel`, then closes it. Preventing the default keeps it open:

```js
dialog.addEventListener('cancel', (event) => {
  if (formIsDirty) {
    event.preventDefault();       // stop Escape from discarding the edit
    confirmDiscard();
  }
});
```

Use this sparingly. Escape closing a modal is a platform expectation, and blocking it needs a
visible reason — an unsaved-changes prompt, not a marketing modal that refuses to leave.

MDN also insists on an **explicit close button** regardless: Escape is not available on every
device, and a dialog closable only by keyboard is not closable for a lot of people.

## What you still have to do yourself

`showModal()` is not the whole component:

- **A name.** `aria-labelledby` pointing at the dialog's heading, or `aria-label`. Without it the
  dialog is announced with no title.
- **Scroll containment.** The page behind is inert, but a long dialog's own scrolling still chains
  to the page — `overscroll-behavior: contain` on the scrollable part
  ([14 · 03](../14-scrolling/03-scroll-containers-and-sticky.md)).
- **A trigger that still exists** when the dialog closes, or your own restoration.
- **Animation.** `<dialog>` moves in and out of the top layer, so the exit transition needs
  `transition-behavior: allow-discrete` and `@starting-style` rather than a plain `opacity`
  transition — otherwise it vanishes instantly on close.

## Gotchas

**Symptom: `showModal()` throws `InvalidStateError`.**
Cause — the dialog is already open non-modally, from an earlier `show()` or the `open` attribute.
Fix — check `dialog.open`, or close it first. Do not mix `show()` and `showModal()` on one dialog.

**Symptom: Escape does not close the dialog.**
Cause — it was opened with `show()` or by setting `open`; only modal dialogs get Escape handling.
Fix — `showModal()`, or implement Escape yourself for the non-modal case.

**Symptom: the modal appears behind a sticky header.**
Cause — the dialog was opened non-modally, so it never reached the top layer and is subject to
z-index and stacking contexts.
Fix — `showModal()`. If it is genuinely non-modal, it is an ordinary element and the stacking rules
apply.

**Symptom: the first thing the screen reader says is "Close".**
Cause — focus goes to the first focusable element, which is the close button.
Fix — `autofocus` on the primary control, and `aria-labelledby` on the dialog so the title is
announced.

**Symptom: `dialog.returnValue` is empty after the user confirmed.**
Cause — the button had no `value`, or the form was not `method="dialog"`, or `close()` was called
without an argument.
Fix — give each button a `value`, and read `returnValue` in the `close` handler.

**Symptom: the dialog disappears instantly instead of animating out.**
Cause — it leaves the top layer the moment it closes, so a normal transition has nothing to
animate.
Fix — `transition-behavior: allow-discrete` with `@starting-style` for the entry.

**Symptom: scrolling inside a long dialog scrolls the page behind it.**
Cause — scroll chaining; inertness does not stop it.
Fix — `overscroll-behavior: contain` on the dialog's scrolling element.

## Interview questions

**★ What does `showModal()` give you that `show()` does not?**
The top layer and `::backdrop`, the rest of the document made inert, Escape-to-close firing
`cancel`, `aria-modal="true"`, and focus moved in and returned on close. `show()` gives none of
these, and only one modal dialog can be open at a time.

**★ Why does a modal `<dialog>` never get hidden behind other content?**
It is promoted to the top layer, outside normal stacking contexts, so `z-index`, `transform` and
`overflow` on ancestors cannot affect it.

**★ How do you control where focus lands when a dialog opens?**
`autofocus` on the element that should receive it. Otherwise focus goes to the first focusable
element — usually the close button. And never put `tabindex` on the `<dialog>` itself; MDN says it
must not be used there.

**★ How does `<form method="dialog">` work?**
Submitting it closes the dialog without sending data to a server and sets `returnValue` to the
submitting button's `value`, then fires `close`. It is the no-JavaScript route to a confirm dialog.

**★ What is the `cancel` event?**
It fires when Escape is pressed on a modal dialog, before it closes; `preventDefault()` keeps the
dialog open. Reserve that for genuine unsaved-work prompts — Escape closing a modal is a platform
expectation.

**What does `<dialog>` still not do for you?**
Give itself an accessible name, contain its own scrolling, animate out of the top layer, or cope
with a trigger that no longer exists when it closes.

---

[Topic index](./README.md) · [02 · The Popover API](./02-the-popover-api.md) →
