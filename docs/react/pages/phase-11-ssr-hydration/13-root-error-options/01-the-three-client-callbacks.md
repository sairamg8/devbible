---
title: "The three client callbacks"
sidebar_label: "01 · The three client callbacks"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`createRoot`](https://react.dev/reference/react-dom/client/createRoot) and
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) (the
> `onCaughtError`, `onUncaughtError` and `onRecoverableError` options and the default logging
> behaviour).
> No sandbox script backs this page; claims are cited, not measured.

**React 19 gave the root three error callbacks, and they partition every error React knows
about into exactly three cases.** Both `createRoot` and `hydrateRoot` take the same three, with
identical wording:

| Option | Fires when |
|---|---|
| `onCaughtError` | *"React catches an error in an Error Boundary"* |
| `onUncaughtError` | *"an error is thrown and not caught by an Error Boundary"* |
| `onRecoverableError` | *"React automatically recovers from errors"* |

That is the whole taxonomy: **somebody handled it, nobody handled it, or React handled it
itself.** Every error React surfaces goes to exactly one of the three.

## Why these exist at all

Before them, an error boundary told you about errors *underneath it*, and everything else went
to the console. Two things were awkward. There was no single place to send errors to a reporting
service — you had to remember a boundary at every level, and you still missed the ones nothing
caught. And errors React quietly recovered from were essentially invisible.

Root options fix both by attaching to **the root**, not to a component. One place, all three
categories, for the whole tree.

🔴 **They are not a replacement for error boundaries.** A boundary decides *what the user sees*;
these callbacks decide *what you find out*. `onCaughtError` fires **because** a boundary did its
job — the fallback UI still renders. Removing your boundaries and adding `onUncaughtError` would
give you excellent telemetry about a blank screen.

## What each one receives

All three are called with the same two arguments:

> Called with the `error` caught by the Error Boundary, and an `errorInfo` object containing the
> `componentStack`.

**`errorInfo.componentStack`** is the piece worth wiring up. A JavaScript stack tells you which
function threw; a component stack tells you which part of the tree it was rendering, which is
usually the question you actually have.

`onRecoverableError` adds one detail:

> Called with an `error` React throws, and an `errorInfo` object containing the
> `componentStack`. **Some recoverable errors may include the original error cause as
> `error.cause`.**

⚠️ **"Some" and "may" are load-bearing.** For recoverable errors, the `error` React hands you may
be React's own description of what it recovered from, with the thing that actually went wrong
hanging off `error.cause`. When reporting, send both — a report that shows only React's wrapper
loses the cause.

## `onCaughtError` — the boundary worked

This fires on the errors your application already handles. The user is looking at a fallback and
the app is still alive.

Which makes it the callback with the most **filtering** in real code. React's own example does
exactly that:

```js
const root = createRoot(container, {
  onCaughtError: (error, errorInfo) => {
    if (error.message !== "Known error") {
      reportCaughtError({
        error,
        componentStack: errorInfo.componentStack,
      });
    }
  },
});
```

The shape to copy is not the string comparison — it is the idea that **a caught error is a
routine event you may legitimately not want to page anyone about**, and the root is where you
express that policy once rather than in every boundary.

## `onUncaughtError` — nothing caught it

Nothing rendered a fallback. Whatever the user was looking at is gone or broken.

This is the one to treat as a real incident: it means the tree threw somewhere with no boundary
above it. Two reasonable things to do in it, and they are different jobs:

- **Report it**, with the component stack — that is where you learn which subtree needed a
  boundary and did not have one.
- **Show something**, if you have nowhere else to. The root callback is not a rendering API, so
  anything user-facing here is your own code — a dialog, a toast, a full-page message — rather
  than React rendering a fallback for you.

⛔ **Do not use it as a substitute for a boundary.** A boundary can keep the rest of the page
alive; a root callback cannot put anything back.

## `onRecoverableError` — React fixed it, and you still want to know

The subtle one. React recovered, the user may have seen nothing wrong, and there is still
something to fix.

**Hydration mismatches are the case that matters in this phase.** `hydrateRoot`'s reference is
blunt about their status:

> React recovers from some hydration errors, but **you must fix them like other bugs.** In the
> best case, they'll lead to a slowdown; in the worst case, event handlers can get attached to
> the wrong elements.

and it is equally clear that recovery is not a guarantee:

> In development mode, React warns about mismatches during hydration. There are no guarantees
> that attribute differences will be patched up in case of mismatches.

⬜ **The reference does not state explicitly that hydration mismatches are delivered to
`onRecoverableError`.** It documents the callback as firing when *"React automatically recovers
from errors"*, and separately documents that React recovers from some hydration errors — which
is suggestive but not a statement. **This page does not assert the link**; wire the callback up
and look at what arrives in your own app, because that is the only honest way to know.

What is certain and useful: **a recoverable error is a bug with the symptom removed.** In
production, where the development warnings are gone, this callback is the surface that tells you
they are happening at all. See [topic 02 · Hydration mismatches](../02-hydration-mismatches.md)
for the causes and their fixes.

## The default, and what overriding it means

> By default, React will log all errors to the console.

That is the behaviour you get with no options at all, and it is the behaviour you are replacing
when you pass a handler.

🔴 **Keep logging to the console.** The server-side `onError`
([chunk 02](02-the-server-side.md)) makes this an explicit instruction — *"If you override it to
log crash reports, make sure that you still call `console.error`."* The client reference does not
spell out the same warning, so treat the discipline as the safe default rather than as a quoted
rule: a handler that only ships errors to a service and returns takes away the thing every
developer looks at first.

```js
const root = createRoot(container, {
  onUncaughtError: (error, errorInfo) => {
    console.error(error);              // keep the thing you debug with
    report(error, errorInfo.componentStack);
  },
});
```

## Gotchas

**Symptom:** errors stopped appearing in the console after wiring up a reporting service.
**Cause:** the default is that React logs all errors to the console; a handler is what runs
instead of the default path.
**Fix:** call `console.error` inside your handler. The server reference says so outright.

**Symptom:** `onUncaughtError` fires and the screen is blank.
**Cause:** that is what "uncaught" means — no boundary rendered a fallback. The callback reports;
it does not render.
**Fix:** add an error boundary above the subtree that threw. The component stack tells you where.

**Symptom:** `onCaughtError` is noisy.
**Cause:** it fires for every error a boundary handles, including ones your app deliberately
provokes and recovers from.
**Fix:** filter at the root — that is the point of having one place, and React's own example
filters by message.

**Symptom:** a reported recoverable error says nothing useful about the underlying failure.
**Cause:** *"Some recoverable errors may include the original error cause as `error.cause`"* —
the real error is nested.
**Fix:** report `error.cause` alongside `error`.

**Symptom:** production hydration problems are invisible; development is clean.
**Cause:** the mismatch warnings are development-only. Production surfaces them through the
recoverable path, if at all.
**Fix:** wire `onRecoverableError` in production and watch it — then fix the mismatches, because
*"you must fix them like other bugs."*

**Symptom:** the same error is reported twice.
**Cause:** a boundary logs it *and* the root callback fires. Both are doing their job.
**Fix:** report in one place — the root — and let boundaries handle UI only.

## Interview questions

**★ What are the three root error callbacks, and how do they partition errors?**
`onCaughtError` for errors an error boundary caught, `onUncaughtError` for errors nothing caught,
and `onRecoverableError` for errors React recovered from automatically. Somebody handled it,
nobody handled it, or React handled it — every error lands in exactly one.

**★ Do these replace error boundaries?**
No. A boundary decides what the user sees; these decide what you find out. `onCaughtError` fires
precisely *because* a boundary worked. With no boundaries you would get excellent reports about a
blank page.

**★ What is in `errorInfo`?**
The `componentStack` — which part of the tree was rendering when the error happened. For
recoverable errors, the original cause may also be attached to the error itself as
`error.cause`.

**★ Why does `onRecoverableError` matter if React already recovered?**
Because recovery removes the symptom, not the bug. Hydration mismatches are the canonical case,
and the reference says you must fix them like other bugs — at best a slowdown, at worst event
handlers attached to the wrong elements.

**★ What happens to console logging when you pass a handler?**
The documented default is that React logs all errors to the console, and your handler is what
runs in its place. The server-side `onError` reference says explicitly to keep calling
`console.error`; the same discipline is worth applying on the client.

---

← Index: [13 · Root error options](README.md) ·
Next → [The server side: `onError`](02-the-server-side.md)
