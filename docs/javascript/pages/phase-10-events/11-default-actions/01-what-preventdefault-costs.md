---
title: "01 · What preventDefault costs"
sidebar_label: "01 · What preventDefault costs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Event.preventDefault()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault), [`Event.cancelable`](https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action), [`Event.defaultPrevented`](https://developer.mozilla.org/en-US/docs/Web/API/Event/defaultPrevented). Documentation-validated; **no timings**.

Every default action is a behaviour a user has learned somewhere else and expects here.
`preventDefault()` deletes one of them, and the cost is rarely visible from the code that calls it.

## What is even cancelable

```js
event.cancelable;         // false ⇒ preventDefault() does nothing at all
event.defaultPrevented;   // did someone already cancel this?
```

🔴 **`preventDefault()` on a non-cancelable event is a silent no-op.** MDN notes it may log a
warning in some browsers, but nothing throws — which is why "I called preventDefault and it still
scrolled" is such a common report.

Not cancelable, among others: `scroll` (it reports a scroll that already happened), `resize`,
`focus`/`blur`, and any custom event created without `cancelable: true`
([08 · Custom events](../08-custom-events/01-dispatching-and-listening.md)).

## The passive default, and why it exists

MDN records that browsers changed the default of `passive` to `true` for **`wheel`,
`mousewheel`, `touchstart` and `touchmove`** on `Window`, `Document` and `Document.body` — because
the browser otherwise cannot start scrolling until your listener has finished, and that delay is
visible as jank.

```js
// ⚠️ ignored, with a console warning — the listener is passive by default here
window.addEventListener('touchstart', (e) => e.preventDefault());

// explicit opt-out, when you genuinely must cancel
window.addEventListener('touchstart', handler, { passive: false });
```

**A passive listener's `preventDefault()` does nothing**, and MDN says a console warning may be
generated. If you need to cancel, you must pass `{ passive: false }` deliberately — and accept that
you have reintroduced the jank the default was protecting against.

🔴 **For touch gestures, `touch-action` in CSS is the better tool.** The browser reads it up front
instead of waiting to see whether you cancel
([07 · Pointer events](../07-pointer-events/01-the-unified-model.md)).

## The list you should not block

| Default | Blocking it breaks |
|---|---|
| **Tab / Shift+Tab** | 🔴 focus navigation — the page becomes a trap |
| Ctrl/⌘ +/− and 0 | zoom — an accessibility control |
| **Scrolling** (wheel, touch, space, PageDown, arrows) | reading the page at all |
| Text selection | copying, quoting, translating |
| Right-click / context menu | copy, open in new tab, translate, save image |
| Middle-click and ⌘/Ctrl-click on links | open in a new tab |
| Browser Back/Forward gestures | navigation |
| Enter on a focused button, Space on a checkbox | keyboard operation of controls |
| Native form validation, before you have replaced it | error reporting |

⚠️ **`e.preventDefault()` on a `click` on an `<a href>` also kills middle-click and ⌘-click** —
those are separate default actions the user relies on. If you are intercepting link clicks for a
router, check the modifiers first:

```js
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  if (e.defaultPrevented) return;                       // someone else handled it
  if (e.button !== 0) return;                           // middle/right click
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // new tab / window / download
  if (link.target && link.target !== '_self') return;
  if (link.origin !== location.origin) return;          // external
  if (link.hasAttribute('download')) return;

  e.preventDefault();
  router.navigate(link.pathname + link.search + link.hash);
});
```

Every one of those guards is a default action that would otherwise be destroyed by a single
`preventDefault()`. This is the shape every client-side router needs, and the reason to use one
rather than write it.

## Where blocking *is* correct

`preventDefault()` is not a bad word — it is the point of `cancelable`:

- **`submit`**, when you are sending the form yourself
  ([05 · 01](../05-form-and-input-events/01-the-event-set.md)).
- **`beforeinput`**, to reject or transform an edit
  ([05 · 02](../05-form-and-input-events/02-a-controlled-input.md)).
- **`dragover`**, which you *must* cancel for a drop target to accept a drop — the one case where
  the default is "reject", and cancelling is how you say yes.
- **`contextmenu`**, only where you replace it with a menu that offers the same operations, keyboard
  accessible.
- **`keydown`**, for keys you have genuinely taken over — inside a widget, not globally
  ([06 · 02](../06-keyboard-events/02-building-a-shortcut.md)).
- **A cancelable custom event**, where cancelling is your own documented protocol.

**The test:** can the user still do the thing they were trying to do, by some route you provide?
If not, you have removed a capability rather than replaced one.

## Cancel narrowly

```js
// ❌ everything, forever
document.addEventListener('keydown', (e) => e.preventDefault());

// ✅ one key, one condition, inside the branch that handled it
grid.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown') return;
  moveSelection(1);
  e.preventDefault();          // last, and only here
});
```

Three habits that follow:

- **Attach to the smallest element**, not `document`. A grid's arrow keys are the grid's business.
- **Call it last**, inside the branch that did the work — never at the top as a precaution.
- **Check `defaultPrevented`** before acting on an event another handler already claimed.

📌 `preventDefault()` and `stopPropagation()` are unrelated: one cancels the browser's action, the
other stops the event travelling. Reaching for both "to be safe" is how a delegated listener
upstream silently stops working
([03 · The event object](../03-the-event-object/README.md)).

## Gotchas

**Symptom: `preventDefault()` in a `touchstart`/`wheel` handler is ignored, with a console
warning.**
Cause — the listener is passive by default on `window`, `document` and `body`.
Fix — `{ passive: false }` if you truly must cancel; prefer `touch-action` in CSS.

**Symptom: `preventDefault()` on `scroll` does nothing.**
Cause — `scroll` is not cancelable; it reports a scroll that already happened.
Fix — cancel the input that causes scrolling (`wheel`, `touchstart`, `keydown`), or use CSS.

**Symptom: ⌘-clicking a link no longer opens a new tab.**
Cause — a router intercepting every `click` on an anchor.
Fix — check modifier keys, `button`, `target`, cross-origin and `download` before cancelling.

**Symptom: users cannot select or copy text on the page.**
Cause — a `selectstart` or `mousedown` handler cancelling the default, or `user-select: none`
applied too broadly.
Fix — restrict it to genuinely non-textual UI (drag handles), never to content.

**Symptom: the keyboard cannot reach half the page.**
Cause — a global `keydown` handler cancelling Tab.
Fix — never cancel Tab; scope key handling to the widget that owns it.

**Symptom: a drop target refuses every drop.**
Cause — `dragover` was not cancelled, and its default is to reject.
Fix — `e.preventDefault()` in `dragover` — the case where cancelling is required.

**Symptom: a delegated handler higher up stopped firing after a "safety" fix.**
Cause — `stopPropagation()` added alongside `preventDefault()`.
Fix — they do different things; only cancel propagation when you mean the event to end there.

## Interview questions

**★ What happens when you call `preventDefault()` on a non-cancelable event?**
Nothing — it is a silent no-op, possibly with a console warning. Check `event.cancelable`; `scroll`,
`resize`, `focus` and custom events without `cancelable: true` are all non-cancelable.

**★ Why is `preventDefault()` in a `touchstart` handler often ignored?**
Because browsers default those listeners to `passive: true` on window, document and body, so the
browser can start scrolling without waiting. Opt out explicitly with `{ passive: false }`, or state
the intent declaratively with `touch-action`.

**★ What breaks when a router calls `preventDefault()` on every link click?**
Middle-click and ⌘/Ctrl-click to open in a new tab, download links, `target="_blank"`, and external
navigation. Guard on `button`, the modifier keys, `target`, `download` and origin before cancelling.

**★ Which defaults should never be blocked?**
Tab and Shift+Tab, zoom, scrolling, and the browser's own navigation gestures. Text selection and
the context menu should only be replaced by something offering the same operations, keyboard
accessible.

**★ When is cancelling required rather than harmful?**
`dragover` — its default is to reject the drop, so cancelling is how a target accepts one. Also
`submit` when you send the form yourself, and `beforeinput` when you transform an edit.

**What is the difference between `preventDefault()` and `stopPropagation()`?**
`preventDefault()` cancels the browser's action; `stopPropagation()` stops the event travelling to
other listeners. Using both reflexively breaks delegated handlers upstream.

---

[Topic index](./README.md) · [Phase 10 index](../README.md) →
