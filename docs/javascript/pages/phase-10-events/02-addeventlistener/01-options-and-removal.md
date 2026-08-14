---
title: "02.1 · Options and removal"
sidebar_label: "01 · Options and removal"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`EventTarget.removeEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Documentation-validated.

**Four options, and one of them makes the removal problem disappear entirely.**

```js
addEventListener(type, listener)
addEventListener(type, listener, options)
addEventListener(type, listener, useCapture)   // legacy boolean form
```

| Option | Default | What it does |
|---|---|---|
| `capture` | `false` | fire during the capture phase instead of bubble |
| `once` | `false` | "invoked at most once, then automatically removed" |
| `passive` | `false`\* | "the listener will never call `preventDefault()`" |
| `signal` | — | "listener removed when `AbortSignal.abort()` is called" |

\* with a documented exception, below.

## The identity trap

The rule that generates most listener bugs:

> `removeEventListener()` requires keeping a reference to the original function.

```js
function processEvent(e) {}
el.addEventListener("click", processEvent);
el.removeEventListener("click", processEvent);   // ✅ works

el.addEventListener("click", () => {});
el.removeEventListener("click", () => {});       // ❌ different function — removes nothing
```

🔴 **Two identical arrow functions are two different functions.** MDN is explicit that
anonymous functions are each treated as unique:

```js
// Creates TWO separate listeners
el.addEventListener('click', () => { console.log('hi'); });
el.addEventListener('click', () => { console.log('hi'); });
```

whereas the same reference twice is a no-op:

```js
function handler() {}
el.addEventListener('click', handler);
el.addEventListener('click', handler); // Not added again
```

**That asymmetry is the whole trap.** Registering a named handler repeatedly is harmless;
registering an inline arrow repeatedly stacks listeners silently, and each one is
unremovable. It is the standard cause of "my handler fires four times" after four re-renders,
and of the listener leak in
[Phase 8 · 04 · 02](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md).

A bound method has the same problem, and it is less obvious:

```js
el.addEventListener("click", this.onClick.bind(this));   // ⚠️ new function every call
this.onClick = this.onClick.bind(this);                   // ✅ bind once, keep the reference
```

## `signal` — the option that solves it

```js
const ac = new AbortController();

el.addEventListener("click", onClick, { signal: ac.signal });
window.addEventListener("resize", onResize, { signal: ac.signal });
document.addEventListener("keydown", onKey, { signal: ac.signal });

ac.abort();   // ✅ all three removed
```

**One controller per component or per lifecycle, one `abort()` in teardown.** It removes the
identity problem completely — you never name the function again — and it scales to any number
of listeners across any number of targets, including ones you would otherwise forget.

MDN lists it among its recommended practices: *"Use `AbortSignal` for cleanup instead of
relying on `removeEventListener()` when possible."* Treat it as the default for anything with
a lifecycle. Inline arrows become safe again, because removal no longer depends on the
reference.

## `once`

> "Listener invoked at most once, then automatically removed."

```js
el.addEventListener("animationend", cleanup, { once: true });
```

For genuinely single-shot events this is better than removing yourself inside the handler:
there is no window in which a second event can arrive, and nothing to forget. It composes
with `signal` — an aborted controller removes a `once` listener that never fired.

## `passive` — a performance contract

> "If `true`, listener will never call `preventDefault()`."

The point is what the browser can do with that promise: **start the default action immediately
instead of waiting to see whether the listener cancels it.** Without it, a scroll cannot begin
until every `touchstart`/`wheel` listener has run, so a slow handler stalls the scroll — the
jank this option exists to remove.

🔴 **`passive` is a promise you can break, and breaking it fails silently.** MDN: if a passive
listener calls `preventDefault()`, *"it has no effect and may generate a console warning."*
So the scroll you meant to block happens anyway, and only the console says why.

The default is `false` — **with an exception worth knowing exactly**:

> "For `wheel`, `mousewheel`, `touchstart`, and `touchmove` events on **root nodes**
> (`Window`, `Document`, `Document.body`), `passive` defaults to **`true`** in most browsers
> (except Safari)."

Two consequences:

- **`preventDefault` in a `touchmove` handler on `document` may already be a no-op**, because
  the default flipped to passive to make legacy code fast.
- To block scrolling you must opt out explicitly: `{ passive: false }`.

Note MDN's hedge — *"in most browsers (except Safari)"*. This is a case where the
documentation itself declines to state one universal behaviour, so neither will this page:
**check the target browsers rather than assuming.**

## Choosing

```js
// anything with a lifecycle — the default
el.addEventListener("click", onClick, { signal: ac.signal });

// single-shot
el.addEventListener("transitionend", done, { once: true });

// scroll/touch handler that only reads
el.addEventListener("touchstart", track, { passive: true });

// one that genuinely blocks the default
el.addEventListener("touchmove", block, { passive: false });

// intercept before a child can stop it
document.addEventListener("click", audit, { capture: true });
```

## Gotchas

**Symptom:** A handler fires several times for one interaction
**Cause:** An inline arrow was registered repeatedly. MDN: each anonymous function is unique,
so they stack — where the **same named reference** would have been discarded as a duplicate.
**Fix:** Register once, or use `{ signal }` and abort on teardown.

**Symptom:** `removeEventListener` does nothing
**Cause:** A different function reference — an arrow, or a fresh `.bind(this)`.
**Fix:** Keep the reference (bind once in the constructor), or use `{ signal }`.

**Symptom:** `preventDefault()` in a scroll or touch handler does nothing, with a console
warning
**Cause:** The listener is **passive** — either explicitly, or by the root-node default for
`wheel`/`touchstart`/`touchmove`.
**Fix:** `{ passive: false }` explicitly.

**Symptom:** Scrolling stutters while a touch handler runs
**Cause:** A non-passive listener; the browser must wait to see whether you cancel.
**Fix:** `{ passive: true }` if the handler only reads.

**Symptom:** A listener leaks after a component unmounts
**Cause:** It was never removed, and the target (`window`, `document`) outlives the component.
**Fix:** One `AbortController` per lifecycle, `abort()` in teardown.

**Symptom:** A `once` listener still needs cleanup if it never fires
**Cause:** `once` removes it **after** firing, not on teardown.
**Fix:** Combine with `{ signal }`.

## Interview questions

**★ Why doesn't `removeEventListener` work with an arrow function?**
Because removal matches on the **function reference**, and every arrow literal is a new
function — MDN notes anonymous functions are each treated as unique. Keep the reference, or
use `{ signal }` and `abort()`.

**★ What happens if you add the same listener twice?**
With the **same reference**, nothing — the duplicate is discarded. With two identical
**arrows**, you get two listeners, both unremovable. That asymmetry is why "it fires four
times" happens after four re-renders.

**★ What does `passive: true` actually buy?**
It promises the listener *"will never call `preventDefault()`"*, so the browser can start
scrolling immediately instead of waiting for the handler. Without it, a slow handler stalls
the scroll.

**★ Why might `preventDefault()` in a `touchmove` handler do nothing?**
Because `passive` defaults to **`true`** for `wheel`, `mousewheel`, `touchstart` and
`touchmove` on root nodes (`Window`, `Document`, `body`) in most browsers — MDN notes Safari
as an exception. Pass `{ passive: false }` to opt out.

**★ What is the best way to clean up listeners?**
An `AbortController`: register everything with `{ signal }` and call `abort()` once in
teardown. MDN recommends it over `removeEventListener`. It removes the identity problem
entirely and covers any number of listeners and targets.

**When is `once` better than removing inside the handler?**
Always, for genuinely single-shot events — there is no window for a second event and nothing
to forget. Combine it with `{ signal }` so it is also cleaned up if it never fires.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
