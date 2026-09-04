---
title: "A component that takes focus must give it back, `aria-hidden` on the page behind a modal is the wrong tool because it leaves the background tabbable, and two of WCAG 2.2's new criteria are about the sticky header rather than the component"
sidebar_label: "04f · Dialogs and focus restoration"
sidebar_position: 23
description: "The APG modal dialog contract in full, why the native dialog with showModal() is the cheapest correct implementation, inert versus aria-hidden, capturing and restoring the invoker, :focus-visible, WCAG 2.4.11 and 2.5.8, and focus after a client-side route change."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the WAI-ARIA Authoring Practices Guide —
> [*Modal Dialog* pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — quoted
> verbatim; **WCAG 2.2** criteria 2.1.2, 2.4.7, 2.4.11 and 2.5.8
> ([w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)); MDN's
> [`inert`](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/inert) reference
> (Baseline widely available since April 2023); and the Next.js
> [Accessibility architecture page](https://nextjs.org/docs/architecture/accessibility)
> (`lastUpdated: 2024-11-06`) for what the route announcer does — and does not — claim.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**Focus is borrowed, not taken. A dialog, a menu, a drawer and a route transition all move it, and every one of them owes the user a defined place to put it back. The failure is not subtle once you look for it: a keyboard user opens a confirmation, presses Escape, and finds themselves at the top of the document with fifty tab presses between them and where they were. This page is the contract for taking focus, the platform features that implement most of it for free, and the two WCAG 2.2 criteria that fail because of a component you did not write.**

## The modal dialog contract

The APG's pattern is a list of obligations, and skipping any one of them is the difference between a dialog and a trap.

**On open**, move focus into the dialog: generally the first focusable element, but a `tabindex="-1"` static element at the top when the content is long or structured, and the **least destructive action** when the dialog completes an irreversible step. That last clause is a design instruction as much as a code one — a delete confirmation should open with focus on Cancel.

**While open**, Tab and Shift+Tab wrap within the dialog, and Escape closes it. This is the one place a keyboard "trap" is intended — and note it does not violate WCAG **2.1.2 No Keyboard Trap**, which requires that *"focus can be moved away from that component using only a keyboard interface"*: Escape is that mechanism.

**On close**, return focus to the invoking element — *"unless that element is gone or the workflow logically continues elsewhere."*

And:

> *"It is strongly recommended that the tab sequence of all dialogs include a visible element with role button that closes the dialog."*

### The native `<dialog>` does most of this

```tsx
'use client'
import { useEffect, useRef } from 'react'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal() // focus trap, inert background, Escape — all from the platform
      cancelRef.current?.focus() // least destructive action, per the APG
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onClose={onClose}
      onCancel={onClose} // fires on Escape
    >
      <h2 id="confirm-title">Delete task</h2>
      <p>This cannot be undone.</p>
      <button ref={cancelRef} type="button" onClick={onClose}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm}>
        Delete
      </button>
    </dialog>
  )
}
```

`showModal()` gives you the focus trap, Escape handling, the top layer, and background inertness — and per MDN, a modal `<dialog>` opened with `showModal()` is the **only** thing that escapes ancestor inertness, which is what makes it composable with an `inert` app shell.

What it does **not** give you is focus restoration in every case, so keep a reference to the invoker:

```tsx
const invoker = useRef<HTMLElement | null>(null)

function openDialog() {
  invoker.current = document.activeElement as HTMLElement
  setOpen(true)
}

function closeDialog() {
  setOpen(false)
  invoker.current?.focus()
}
```

### If you must build one by hand

Use `inert` on the app shell rather than `aria-hidden`, for the reason in [04c](04c-aria-is-a-promise-you-then-have-to-keep.md): `aria-hidden` leaves the background focusable and W3C's fourth rule of ARIA use forbids it on focusable elements. MDN's summary of `inert` — no click events, not focusable, excluded from find-in-page, not selectable, removed from the tab order **and** the accessibility tree — is exactly the required behaviour, and it is Baseline widely available since April 2023.

MDN also notes the scoping rule that matters for controls: prefer `disabled` for individual form controls; `inert` is for regions.

## Focus visibility

> *"Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible."*
> — **2.4.7 Focus Visible (Level AA)**

```css
/* 🔴 Never this */
*:focus { outline: none; }

/* ✅ A ring for keyboard users, none for mouse users */
:focus-visible {
  outline: 2px solid var(--sd-focus);
  outline-offset: 2px;
}

/* Keep a ring for anything that gets programmatic focus */
[tabindex='-1']:focus { outline: none; }
```

`:focus-visible` is the browser's heuristic for "this focus came from the keyboard", which is what lets you remove the ring on mouse click without removing it from keyboard users. The `[tabindex='-1']` rule is the deliberate exception: a container you focused programmatically after a route change or a skip link does not need a ring, and a large outline around the whole `<main>` is startling.

Two newer criteria worth designing for:

> *"When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content."*
> — **2.4.11 Focus Not Obscured (Minimum) (Level AA)** — 🔴 **new in WCAG 2.2**

A sticky header or a cookie banner that covers the focused element fails this, and it is very common: the element is focused, the page has scrolled it to just under the sticky bar, and the user sees nothing move. `scroll-margin-top` on focusable elements equal to the header height is the cheap structural fix.

> *"The size of the target for pointer inputs is at least 24 by 24 CSS pixels"*
> — **2.5.8 Target Size (Minimum) (Level AA)** — also new in 2.2, with spacing, equivalent, inline and user-agent exceptions.

## Focus after a client-side route change

[04](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md) establishes that Next.js ships a route announcer, and that the architecture page describes announcement only. ⚠️ **It says nothing about focus, and this page does not claim it moves focus.**

What is certain is the requirement: after a client-side navigation the DOM has been replaced, and focus that was on a link in the previous page has nowhere meaningful to be. If you have verified in your own application that focus is not being moved somewhere sensible, the standard remedy is to move it to the main region:

```tsx
// app/components/focus-on-navigate.tsx
'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function FocusOnNavigate() {
  const pathname = usePathname()

  useEffect(() => {
    const main = document.getElementById('main')
    main?.focus() // requires tabIndex={-1} on <main>
  }, [pathname])

  return null
}
```

⚠️ Two cautions. Moving focus on **every** navigation is not free — it interrupts a screen reader mid-announcement if the route announcer is speaking, and it undoes the browser's own restoration on a back-navigation. Test with a screen reader before shipping it, and prefer the skip link as the primary mechanism, which is [04](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md).

## Gotchas

**★ A modal opens and focus stays on the page behind it.** Nothing moved it. Fix: `showModal()` on a native `<dialog>`, or an explicit `.focus()` on the first focusable element — or on the least destructive action when the dialog confirms something irreversible.

**★ A modal closes and focus lands at the top of the document.** The invoker was never recorded. Fix: capture `document.activeElement` before opening and `.focus()` it on close, unless that element is gone.

**★ The background is `aria-hidden` and is still tabbable.** W3C's fourth rule of ARIA use, verbatim: do not use `aria-hidden="true"` on a focusable element. Fix: `inert` on the app shell, which removes focusability as well.

**★ A hand-rolled modal has no Escape handler.** With a focus trap and no exit, this is a real WCAG 2.1.2 failure — focus can be moved in and not out by keyboard. Fix: Escape closes, and there is a visible close button in the tab sequence, which the APG strongly recommends.

**★ A `role="dialog"` with `aria-modal="true"` and no focus management at all.** The attribute announces a modal; nothing behaves like one. Fix: this is the "role is a promise" failure from [04c](04c-aria-is-a-promise-you-then-have-to-keep.md) — implement the pattern or use `<dialog>`.

**★ A dropdown closes on blur and cannot be operated by keyboard.** `onBlur` fires as focus moves *into* the menu. Fix: close on Escape and on focus leaving the whole container (compare `relatedTarget` against the container with `contains`), never on the trigger's blur alone.

**★ `*:focus { outline: none }` in a reset.** Removes the indicator for every keyboard user on the site. Fix: style `:focus-visible` instead, and only null the outline for `[tabindex="-1"]` programmatic targets.

**★ A sticky header hides the focused input.** WCAG 2.4.11, new in 2.2. Fix: `scroll-margin-top` on focusable elements matching the header height.

**★ Icon buttons are 16×16.** WCAG 2.5.8 asks for 24×24 CSS pixels or adequate spacing. Fix: pad the button rather than the icon — the target is the button's box.

**★ Focus is moved to `<main>` on every navigation and a screen reader is cut off mid-sentence.** The route announcer and your focus call are competing for the same moment. Fix: verify with an actual screen reader before shipping route-change focus management at all; the skip link is the mechanism that always works and costs nothing.

**★ A drawer is closed with `display: none` while focus is inside it.** Focus falls back to `<body>` and the next Tab restarts from the top of the page. Fix: move focus to the trigger *before* hiding the container.

## Interview questions

**★ A modal traps focus. Is that a WCAG failure?**
No, provided there is a keyboard way out. 2.1.2 No Keyboard Trap requires that focus can be moved away using only a keyboard, and, if the method is not standard, that the user is told what it is. Escape is the conventional, expected exit for a dialog, and the APG additionally recommends a visible close button in the tab sequence — which covers the user who does not know about Escape. A trap with neither is a genuine failure and one of the more severe ones, because it can strand a keyboard user on the page entirely.

**★ Where should focus land when a delete-confirmation dialog opens, and why is that not "the first focusable element"?**
On the least destructive action — Cancel. The APG's general rule is the first focusable element, or a `tabindex="-1"` container at the top for long content, but it names an explicit exception: when the dialog performs an irreversible action, focus should go to the least destructive control. The reason is the interaction between focus and habit — a user who dismisses dialogs with Enter, or who presses Space having not yet heard the announcement, should not be able to delete something by reflex.

**★ Why is `*:focus { outline: none }` still in so many codebases, and what should replace it?**
Because the default ring is ugly on mouse click and, historically, there was no way to distinguish keyboard focus from pointer focus in CSS. `:focus-visible` is that distinction — the browser applies it when it judges the focus came from the keyboard — so the correct pattern is to style `:focus-visible` and leave `:focus` alone. WCAG 2.4.7 requires a visible focus indicator for keyboard operation, so removing it globally is a straightforward AA failure. The one place you legitimately suppress the ring is `[tabindex="-1"]` elements you focus programmatically, like a `<main>` after a skip link, where an outline around a whole region is noise.

**★ What does WCAG 2.2 add that a 2.1-era design system will not have considered?**
Two criteria that are about the *environment* around a focused element rather than the element itself. 2.4.11 Focus Not Obscured (Minimum) requires that a focused component not be entirely hidden by author-created content — which sticky headers, cookie banners and chat widgets all routinely violate, and which no component-level review will catch because it is an interaction between two independent components. And 2.5.8 Target Size (Minimum) asks for 24×24 CSS pixel targets with defined spacing exceptions, which invalidates a lot of dense icon-button toolbars. Both are AA, both are new, and both are structural rather than fixable inside a single component.

**★ Why is the native `<dialog>` with `showModal()` the cheapest correct modal, and what does it still not give you?**
Because `showModal()` supplies the focus trap, Escape handling, the top layer and background inertness from the platform, and — per MDN — a modal `<dialog>` is the only thing that escapes ancestor inertness, so it composes with an `inert` app shell instead of fighting it. Every one of those is a piece you would otherwise hand-write and re-test on each browser. What it does not reliably give you is restoration of focus to the element that opened it, so you still capture `document.activeElement` before opening and call `focus()` on it after closing — and you still choose *where inside* the dialog focus starts, which for a destructive confirmation is Cancel rather than the first control.

**★ How should focus be handled after a client-side route change in the App Router?**
Carefully, and only after testing with a real screen reader. Next.js ships a route announcer that reads the new page's name from `document.title`, then the `<h1>`, then the pathname — but its documentation describes announcement and says nothing about focus, so you should not assume focus is being managed. The common remedy is an Effect keyed on `usePathname` that focuses a `tabIndex={-1}` `<main>`, and the caution is real: it can interrupt the announcer mid-sentence and it overrides the browser's own restoration on a back-navigation. The mechanism that always works and never fights anything is the skip link.

---

← [Keyboard-first interactive components](04e-keyboard-first-interactive-components.md) · [Chapter 12 overview](01-explanation.md) · Next → [Auditing a11y and what no tool can reach](04g-auditing-accessibility-and-what-no-tool-can-reach.md)
