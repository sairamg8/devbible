---
title: "Modal, portal and focus trap"
sidebar_label: "07 · Modal, portal, focus"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN (`<dialog>`, `showModal`, inert), react.dev
> (`createPortal`), and the WAI-ARIA dialog pattern. Concept home:
> [React — refs, context and reducers](../../../react/pages/phase-5-refs-context-reducers/README.md);
> the stacking-context styling is Phase 7's overlay chapter.

## The problem

The product gallery's zoom, the "remove item?" confirm, the login prompt
mid-checkout. Overlay UI has a decade of hand-rolled folklore — portals,
focus traps, escape handlers, scroll locks — and most of it predates the
platform catching up. The 2026 answer starts from **the native
`<dialog>`**, which ships focus management, `Escape`, `::backdrop`,
top-layer rendering and inertness of the background *in the browser* —
and the chapter's real content is the React wrapper that makes it
composable, plus the honest list of what still needs code.

## The implementation

```jsx
// src/components/Modal.jsx
import {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';

export function Modal({open, onClose, labelledBy, children}) {
  const ref = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement;   // return focus later
      dialog.showModal();                           // top layer + trap + inert bg
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {                     // Escape and dialog.close()
      openerRef.current?.focus?.();                 // restore focus to the opener
      onClose();
    };
    const handleClick = (e) => {                    // backdrop click = close
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  if (!open) return null;
  return createPortal(
    <dialog ref={ref} className="modal" aria-labelledby={labelledBy}>
      {children}
    </dialog>,
    document.body,
  );
}
```

```jsx
// consumers — the confirm, four lines where the folklore was forty
function RemoveItemConfirm({item, onConfirm, onCancel}) {
  return (
    <Modal open onClose={onCancel} labelledBy="rm-title">
      <h2 id="rm-title">Remove {item.name}?</h2>
      <div className="modal-actions">
        <button onClick={onCancel}>Keep it</button>
        <button className="danger" onClick={onConfirm}>Remove</button>
      </div>
    </Modal>
  );
}
```

```jsx
// src/hooks/useOutsideClick.js — for the NON-modal overlays (the cart
// drawer, the sort dropdown) where showModal's trap would be wrong
import {useEffect} from 'react';

export function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [ref, onOutside]);
}
```

## What the platform gives, and what remains yours

| Concern | `<dialog>.showModal()` | Still your code |
|---|---|---|
| Top-layer rendering (no z-index war) | ✅ | — |
| Focus moved in + trapped | ✅ | **returning** focus to the opener |
| `Escape` closes | ✅ | syncing that close back to React state |
| Background inert to clicks/AT | ✅ | — |
| Backdrop styling / click-to-close | `::backdrop` / — | the click handler above |
| Background scroll lock | — | one CSS rule: `body:has(dialog[open]) { overflow: hidden }` |

Two disciplines make the wrapper sound: **React state stays the owner**
(`open` drives `showModal`/`close`; the `close` event syncs the other
direction, so Escape can't desync the two worlds), and **the portal to
`document.body`** keeps the dialog outside any `overflow: hidden` or
`transform`ed ancestor — still worth doing even though the top layer
would rescue rendering, because portaling also removes the ancestor's
event-bubbling surprises.

The drawer and dropdowns are *not* dialogs — they must not trap focus or
inert the page. They get the portal, `useOutsideClick`, and their own
Escape handling: **modal is a behaviour, not a look**, and choosing
which overlay gets which behaviour is the actual skill.

## Gotchas

- **Symptom:** focus lands on `<body>` after closing the confirm, and a
  keyboard user is lost. **Cause:** `close` fired without focus
  restoration — the one thing `showModal` does not do. **Fix:** the
  `openerRef` capture-and-restore above; it is the difference between
  passing and failing the ARIA dialog pattern's checklist.
- **Symptom:** clicking a button *inside* the dialog closes it.
  **Cause:** the backdrop-click handler tested `e.target` loosely —
  clicks on the dialog's padding hit the `<dialog>` element itself.
  **Fix:** as written (`e.target === dialog` is true only for the
  backdrop/padding area); dialogs whose padding is clickable space wrap
  content in an inner container and hit-test that instead.
- **Symptom:** the gallery zoom opens and the page scrolls behind it on
  iOS. **Cause:** the `:has` scroll-lock rule missing (or an older
  engine) — `showModal` inerts interaction but not scroll. **Fix:** the
  one CSS rule, plus `overscroll-behavior: contain` on the dialog for
  the scroll-chaining edge; Phase 7's overlay chapter carries the
  styling half.
- **Symptom:** tests can't find the dialog content. **Cause:** portal —
  the content renders under `document.body`, not inside the component's
  container; `within(container)` queries miss it. **Fix:** query the
  document (`screen` in Testing Library does), and assert on
  `dialog.open` for state — the
  [testing pages](../../../react/pages/phase-7-custom-hooks/11-testing-a-custom-hook.md)
  pattern extends to portals.

## Interview questions

1. **★ What does `showModal()` provide that `open` (the attribute) and
   hand-rolled overlays don't?** The top layer (above every stacking
   context, ending z-index arms races), a real focus trap, `Escape`
   handling, and an inert background — the four things overlay libraries
   existed to fake. The non-modal `show()`/`open` path renders in normal
   flow with none of them; knowing the difference *is* the API.
2. **★ Why must focus return to the opener, and why doesn't the platform
   do it?** For keyboard and AT users the dialog was a detour; landing
   anywhere else after it closes discards their position. The platform
   can't know the "right" target (the opener may be gone — a removed
   cart line's button), so it leaves the policy to you; the wrapper's
   fallback chain (opener, else a sensible ancestor) is the accessible
   answer.
3. **When is a focus trap wrong?** Any overlay the user should be able to
   leave without a decision: drawers, dropdowns, toasts, popovers.
   Trapping there breaks tab-through and screen-reader flow. The
   modal/non-modal split is a behavioural contract — which is why the
   drawer uses `useOutsideClick` and never `showModal`.

---

← Prev: [Cart state](06-cart-state.md) ·
Next → [Upload with progress](08-upload-with-progress.md)
