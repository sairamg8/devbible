---
title: "02 · Managing focus"
sidebar_label: "02 · Managing focus"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert), [`HTMLDialogElement.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal), [`HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus), [`Document.activeElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement), [`tabindex`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/tabindex). Documentation-validated; **no timings**.

Managing focus is three obligations, and every dialog, drawer, menu and toast gets judged on all
three:

1. **Send focus** to the thing that just appeared.
2. **Keep focus inside it** while it is modal.
3. **Give focus back** to what opened it.

Skip the third and a keyboard user is stranded at the top of the document every time they close
something.

## Sending focus in

```js
function openDialog(dialog) {
  dialog.previousFocus = document.activeElement;      // remember before anything moves
  dialog.hidden = false;
  const target = dialog.querySelector('[autofocus]')
    ?? dialog.querySelector('h2, h3')                 // the title, if there is one
    ?? dialog;                                        // the container itself, tabindex="-1"
  target.focus();
}
```

Where to send it, in order of preference:

- **The first meaningful control** — a search field in a search dialog, the confirm button in a
  confirmation. Not "the first focusable element", which is usually the close button, so the first
  thing announced is "Close".
- **The dialog's heading**, with `tabindex="-1"` on it, so a screen reader reads the title and the
  user starts at the top of the content.
- **The dialog container** itself with `tabindex="-1"`, as the fallback.

🔴 **Record `document.activeElement` before you change anything.** Once the dialog opens and the
trigger is hidden or inerted, the information is gone.

## Keeping focus inside: `inert` beats a hand-written trap

The old approach was a keydown handler that intercepts Tab, computes the focusable elements, and
wraps around. It is fragile: the focusable-element selector is never complete, it goes stale when
content changes, and it cannot stop the browser's own UI from being reached.

`inert` is the platform version. MDN's list of what it does to a subtree: clicks do not fire, focus
cannot land there and focus events do not fire, text cannot be selected, inputs cannot be edited,
**find-in-page skips it**, and it is **removed from the accessibility tree**.

```js
const page = document.querySelector('#app-root');

function openModal(modal) {
  modal.previousFocus = document.activeElement;
  page.inert = true;                    // everything behind is unreachable
  modal.hidden = false;
  modal.querySelector('[autofocus]')?.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  page.inert = false;
  modal.previousFocus?.focus();          // ← the obligation people forget
}
```

Requirements and limits worth holding:

- **The modal must not be inside the inerted subtree** — put it as a sibling of the page root, not
  a descendant. Otherwise you have inerted your own dialog.
- **Baseline widely available since April 2023**, so `inert` is safe to use directly.
- ⚠️ **There is no visual change.** MDN calls this out: nothing indicates a region is inert, so
  provide your own dimming or overlay, or sighted users will click things that do nothing.
- **`inert` versus `aria-hidden` versus `disabled`:** `inert` takes a whole subtree out of
  interaction *and* the accessibility tree; `aria-hidden="true"` hides from assistive technology
  only, leaving the content clickable and tabbable — which produces the worst state of all, a
  control a keyboard user can reach but a screen reader cannot describe. `disabled` is for
  individual form controls. Use `inert` for regions, `disabled` for controls, and `aria-hidden`
  rarely.

### `<dialog>` does the whole job

```js
dialog.showModal();          // modal: focus moves in, the rest of the page becomes inert,
                             // Esc closes it, ::backdrop paints behind
dialog.close('confirm');     // returns focus to the previously focused element
```

`showModal()` gives you the focus trap, the background inerting, Escape handling and the backdrop
without any of the code above. Two details from MDN worth knowing: a modal dialog **escapes
inertness** — it does not inherit `inert` from an ancestor, and can only be inerted by setting the
attribute on the dialog itself. And `show()` (non-modal) does **none** of this: no trap, no
inerting, no Escape.

That is topic **16 · `<dialog>`, the popover API and `inert`** *(not written yet)*; the point here
is that hand-rolling a focus trap is now the fallback, not the default.

### If you must write a trap

```js
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
  ' textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function trap(container, event) {
  if (event.key !== 'Tab') return;
  const items = [...container.querySelectorAll(FOCUSABLE)]
    .filter((el) => el.offsetParent !== null);        // crude visibility filter
  if (!items.length) return;
  const first = items[0], last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && document.activeElement === last) {
    first.focus();
    event.preventDefault();
  }
}
```

Query the list **on every Tab**, not once at open — content changes, and a cached list sends focus
to a removed node. The `offsetParent` filter is a rough "is it rendered" check and misses
`position: fixed` elements; there is no reliable one-liner, which is the argument for `inert`.

## Giving focus back

```js
function close(component) {
  const returnTo = component.previousFocus;
  component.remove();
  if (returnTo?.isConnected) returnTo.focus();
  else fallbackTarget.focus();               // the trigger is gone — pick something sensible
}
```

`isConnected` matters: the trigger may have been removed while the dialog was open — a "delete
this row" button, for example, deletes its own row. Falling back to a stable ancestor, the list
heading, or the toolbar keeps the user near where they were.

This is the same cleanup obligation as
[10 · Removing and replacing](../10-removing-and-replacing/02-cleanup.md): removing the focused
element drops focus to `<body>`, so check `el.contains(document.activeElement)` **before** the
removal and move focus deliberately.

## Roving tabindex — one tab stop for a group

A toolbar, a tab list, a menu or a grid should be **one** stop in the tab order, with arrow keys
moving inside it. That is the roving-tabindex pattern: exactly one item has `tabindex="0"`, every
other has `-1`, and the pair moves as the user arrows.

```js
function moveTo(items, index) {
  items.forEach((el, i) => { el.tabIndex = i === index ? 0 : -1; });
  items[index].focus();
}

toolbar.addEventListener('keydown', (e) => {
  const items = [...toolbar.querySelectorAll('[role="button"]')];
  const i = items.indexOf(document.activeElement);
  if (i < 0) return;
  if (e.key === 'ArrowRight') moveTo(items, (i + 1) % items.length);
  else if (e.key === 'ArrowLeft') moveTo(items, (i - 1 + items.length) % items.length);
  else if (e.key === 'Home') moveTo(items, 0);
  else if (e.key === 'End') moveTo(items, items.length - 1);
  else return;
  e.preventDefault();                  // stop the arrow key also scrolling the page
});
```

**The trade-off against `aria-activedescendant`:** roving tabindex moves real DOM focus, so
`:focus-visible` and `document.activeElement` behave normally — at the cost of rewriting
`tabIndex` on every move. `aria-activedescendant` keeps focus on the container and points at a
child by id; it suits very long lists, but nothing is really focused, so you style the "active"
item yourself.

Two details that decide whether it feels right: keep the **last-focused item** as the `0` so
returning by Tab lands where the user left, and `preventDefault()` on the arrow keys so the page
does not scroll underneath — the concern from
[14 · Scrolling](../14-scrolling/01-moving-the-scroll-position.md).

## Gotchas

**Symptom: closing a dialog leaves the user at the top of the page.**
Cause — focus was inside the dialog when it was removed, so it fell back to `<body>`.
Fix — save `document.activeElement` on open and restore it on close, guarded by `isConnected`.

**Symptom: Tab escapes the modal into the page behind it.**
Cause — no trap, and the background is not inert.
Fix — `page.inert = true`, or `<dialog>.showModal()`. Hand-written traps also fail this way when
the focusable list is computed once at open.

**Symptom: setting `inert` on the app root inerted the modal too.**
Cause — the modal is a descendant of the inerted subtree.
Fix — move it to a sibling of the root, or use `<dialog>.showModal()`, which escapes inertness.

**Symptom: screen-reader users can still tab to background content that is announced as nothing.**
Cause — `aria-hidden="true"` was used instead of `inert`; it hides from assistive technology but
leaves the content focusable.
Fix — `inert` for whole regions. Never leave a focusable element inside an `aria-hidden` subtree.

**Symptom: focus lands on the close button, so the first thing announced is "Close".**
Cause — "first focusable element" is not "first meaningful element".
Fix — focus the primary control, or the heading with `tabindex="-1"`.

**Symptom: arrow keys move through the toolbar *and* scroll the page.**
Cause — the default action was not prevented.
Fix — `event.preventDefault()` for the keys you handle, and only those.

**Symptom: Tab into a toolbar always lands on the first button, never where the user was.**
Cause — the roving `tabindex="0"` is reset to the first item.
Fix — leave the `0` on the last-focused item.

## Interview questions

**★ What are the three obligations of a modal dialog for keyboard users?**
Move focus into it, keep focus inside it while it is open, and return focus to the element that
opened it. Missing the third strands the user at the top of the document.

**★ Why is `inert` better than a hand-written focus trap?**
It is one attribute that removes an entire subtree from clicks, focus, text selection, find-in-page
and the accessibility tree. A hand-written trap depends on a focusable-element selector that is
never complete, goes stale as content changes, and only intercepts Tab.

**★ What is the difference between `inert` and `aria-hidden="true"`?**
`inert` removes interaction **and** accessibility exposure for the subtree. `aria-hidden` only
hides from assistive technology — the content stays clickable and tabbable, producing a control a
keyboard user can reach and a screen reader cannot describe. `disabled` is the per-control tool.

**★ What is roving tabindex and why use it?**
A composite widget is one tab stop: exactly one child has `tabindex="0"`, the rest `-1`, and arrow
keys move both focus and the `0`. It keeps a twenty-button toolbar from being twenty tab stops.

**★ Where should focus go when a dialog opens?**
To the first meaningful control, or the dialog's heading with `tabindex="-1"`. Not automatically to
the first focusable element, which is usually the close button.

**What does `<dialog>.showModal()` give you for free?**
Focus moved into the dialog, the rest of the page made inert, Escape to close, a `::backdrop`, and
focus returned on close. `show()` gives none of it. A modal dialog also escapes an ancestor's
`inert`.

**How do you restore focus when the element that opened the dialog no longer exists?**
Check `isConnected` before focusing it, and fall back to a stable nearby element — the list
heading, the toolbar — so the user resumes near where they were rather than at `<body>`.

---

← [01 · What can hold focus](./01-what-can-hold-focus.md) · [Topic index](./README.md) ·
[03 · ARIA from JavaScript](./03-aria-from-javascript.md) →
