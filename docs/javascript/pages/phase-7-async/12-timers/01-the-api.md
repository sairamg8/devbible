---
title: "01 · The API, and clearing it correctly"
sidebar_label: "01 · The API and clearing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`clearInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearInterval) — and the [HTML Standard § Timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers), [Node.js `timers`](https://nodejs.org/api/timers.html). Documentation-validated; **no timings, no console blocks**.

Four functions, and every one of them is on the global object in both the browser and Node:

```js
const id = setTimeout(fn, delay, ...args);   // run fn once, at least `delay` ms from now
const id = setInterval(fn, delay, ...args);  // run fn repeatedly, at least `delay` ms apart
clearTimeout(id);
clearInterval(id);
```

That is the whole surface. Everything hard about timers is in what `delay` actually means
([02](./02-why-zero-is-not-zero.md)) and in what repeats do to your clock
([03](./03-drift-and-repeating-work.md)). This page is the mechanics.

## The return value is not the same thing in both runtimes

| | Browser | Node.js |
|---|---|---|
| Returns | a **positive integer** ID | a **`Timeout` object** |
| Falsy-safe? | ✅ IDs are non-zero, so `if (id)` is safe | ✅ an object is always truthy |
| Serialisable? | ✅ it is a number | ❌ — `Timeout` has a `Symbol.toPrimitive` that yields a number, but the object is what you should keep |
| Extra methods | none | `unref()`, `ref()`, `refresh()` |

🔴 **Never store the ID in something that will be sent over the wire, put in `localStorage`,
or compared across a page load.** It is meaningful only to the one global that created it. A
timer ID from an iframe means nothing to the parent document.

**In browsers, `setTimeout` and `setInterval` share one pool of IDs**, and MDN says plainly
that `clearTimeout` and `clearInterval` can technically be used interchangeably. Do not.
Using the matching one is free, and the mismatched pair reads as a bug to every reviewer.

### Node's `Timeout` object earns its extra methods

```js
const t = setInterval(poll, 30_000);
t.unref();   // this timer no longer keeps the process alive
t.refresh(); // restart the countdown from now, without allocating a new timer
```

`unref()` is the one that matters in a CLI or a worker: a live `setInterval` **holds the Node
process open forever**, so a program that "won't exit" is very often a heartbeat nobody
cleared. `refresh()` is the idiomatic way to build an idle timeout — reset it on every request
instead of `clearTimeout` + `setTimeout`.

## Arguments after the delay are passed to the callback

```js
setTimeout(greet, 1000, 'Ada', 'Lovelace');   // greet('Ada', 'Lovelace')
```

This is a real part of the signature, not a curiosity, and it is the reason
`setTimeout(fn(x), 1000)` is such a common slip — that calls `fn` **immediately** and schedules
whatever it returned. Two forms are correct, and one is not:

```js
setTimeout(() => save(draft), 1000);   // ✅ closure
setTimeout(save, 1000, draft);         // ✅ extra arguments
setTimeout(save(draft), 1000);         // ❌ calls save() now, schedules its return value
```

The third one usually fails **silently**, because scheduling a non-function is not an error —
the platform simply has nothing to run when the timer fires.

## `this` inside the callback is not what you meant

MDN documents it for the browser: the callback runs in a separate execution context, so a
non-arrow callback sees `this` as the **global object** (`window`), *not* the object whose
method you passed.

```js
class Poller {
  #url = '/api/status';
  start() {
    setTimeout(function () { fetch(this.#url); }, 1000);  // ❌ `this` is not the Poller
    setTimeout(() => fetch(this.#url), 1000);             // ✅ arrow closes over `this`
    setTimeout(this.tick.bind(this), 1000);               // ✅ explicit bind
  }
}
```

⚠️ **Strict mode does not save you here.** The usual rule — a plain call in strict mode gets
`this === undefined` — applies to *your* call sites. The platform is what invokes a timer
callback, and it supplies its own value. Node does not hand you `globalThis` either, so the
only portable answer is: **never rely on `this` in a timer callback.** Use an arrow function,
or `bind`.

## The delay argument is coerced, clamped and capped

`delay` is converted to a number and truncated to an integer, and anything that cannot be one
becomes `0`:

| You pass | What is used |
|---|---|
| `undefined`, omitted | `0` |
| `'100'` | `100` — string coercion |
| `'soon'`, `NaN` | `0` |
| `-500` | `0` |
| `1.9` | `1` — truncated |
| `> 2_147_483_647` | 🔴 **overflows** |

🔴 **The 32-bit ceiling is a real production bug.** The delay is stored as a signed 32-bit
integer, so **2,147,483,647 ms — about 24.8 days — is the maximum**. Go one millisecond past
it and the value overflows: in browsers the timeout fires **immediately**, and Node clamps the
delay to `1` and prints a `TimeoutOverflowWarning`.

```js
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;   // 2_592_000_000
setTimeout(expireSession, THIRTY_DAYS);          // ❌ fires now, not in 30 days
```

Anything measured in days does not belong in a timer at all. Store the target timestamp,
schedule a short timer, and compare against the clock when it fires — the same discipline
[03 · Drift](./03-drift-and-repeating-work.md) argues for at every scale.

## A string as the first argument is `eval`

```js
setTimeout("doThing()", 100);   // ❌ compiled and run like eval
```

MDN documents this legacy form and warns against it for the same reasons as `eval`: it is a
security risk, it defeats minifiers and it cannot be reasoned about statically. A
`Content-Security-Policy` without `unsafe-eval` **blocks it outright**, which means the failure
mode is a page that works locally and does nothing in production.

## Clearing: the part that is actually easy to get wrong

Clearing is forgiving in every direction that does not matter and unforgiving in the one that
does.

```js
clearTimeout(undefined);     // fine — silently does nothing
clearTimeout(999999);        // fine — an unknown ID is ignored
clearTimeout(id); clearTimeout(id);   // fine — clearing twice is not an error
```

🔴 **What is *not* fine: keeping a stale ID.** IDs are recycled, so an ID captured before its
timer fired can, later, name **a different timer** — and clearing it cancels someone else's
work. Null the handle the moment it is spent:

```js
let id = null;

function schedule() {
  clearTimeout(id);                       // safe even when id is null
  id = setTimeout(() => { id = null; run(); }, 300);
}

function cancel() {
  clearTimeout(id);
  id = null;                              // 🔴 the line people forget
}
```

**A timer that fired does not need clearing, and a timer that was cleared cannot be
restarted.** `clearTimeout` does not "pause" anything — to restart, schedule a new one (or, in
Node, `refresh()` the existing `Timeout`).

### Clearing is teardown, and teardown is not optional

A pending timer is a **strong reference** to its callback, and therefore to everything that
callback closes over — a DOM subtree, a response body, a whole component. A `setInterval` that
is never cleared holds that graph for the lifetime of the page. This is one of the four leaks
catalogued in
[Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md),
and it is the one that survives every framework.

```js
function mount(el) {
  const id = setInterval(() => el.textContent = new Date().toLocaleTimeString(), 1000);
  return () => clearInterval(id);          // ✅ hand the caller its teardown
}
```

**Return the teardown from the thing that created the timer.** A `useEffect` cleanup, a
`disconnectedCallback`, an `AbortSignal` listener — the shape differs, the discipline does not.

### Tying a timer to an `AbortSignal`

Timers predate `AbortController` and take no `signal` option, so the wiring is manual — and
worth it, because it lets one controller tear down timers, listeners and fetches together:

```js
function delay(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });
}
```

**Node already ships this**: `timers/promises` exports a promise-returning `setTimeout` that
accepts `{ signal }` directly, so a Node-only codebase should import it rather than hand-roll
the above. The general shape — and the cancellation vocabulary it belongs to — is
**14 · Cancellation** *(not written yet)*.

## Gotchas

**Symptom: the callback runs immediately instead of after the delay.**
Cause — you called it: `setTimeout(save(draft), 1000)`.
Fix — `setTimeout(() => save(draft), 1000)`, or pass the argument after the delay.

**Symptom: `this` is `undefined` or the wrong object inside a timer callback.**
Cause — the platform invokes the callback with its own `this`; strict mode does not change it.
Fix — an arrow function, or `.bind(this)`.

**Symptom: a timer set for weeks in the future fires at once.**
Cause — the delay exceeded 2,147,483,647 ms and overflowed the signed 32-bit field.
Fix — store the target timestamp; schedule a short timer and re-check the clock when it fires.

**Symptom: a Node script finishes its work but never exits.**
Cause — a pending `setInterval` (or a long `setTimeout`) keeps the event loop alive.
Fix — `clearInterval` on shutdown, or `unref()` the timer if it should never hold the process.

**Symptom: cancelling one component's timer stops an unrelated one.**
Cause — a stale ID was kept and later matched a recycled timer.
Fix — set the handle to `null` when the timer fires and when it is cleared.

**Symptom: `setTimeout("render()", 0)` works locally and silently does nothing in production.**
Cause — the string form is `eval`, and CSP without `unsafe-eval` blocks it.
Fix — pass a function.

**Symptom: memory grows every time a view is opened and closed.**
Cause — an interval was never cleared, pinning its closure and the DOM it captured.
Fix — return a teardown from whatever created the timer, and call it.

## Interview questions

**★ What does `setTimeout` return, and what can you do with it?**
A positive integer ID in browsers, a `Timeout` object in Node. It is only useful for passing to
`clearTimeout`/`clearInterval` in the same global. Node's object additionally offers `unref()`,
`ref()` and `refresh()`.

**★ Why does `this` misbehave inside a timer callback?**
Because the callback is invoked by the platform, not by your call site, so the `this` binding
comes from the platform — the global object in browsers. Strict mode does not affect it. Use an
arrow function or `bind`.

**★ How do you pass arguments to a timer callback?**
Either close over them in an arrow function, or pass them after the delay:
`setTimeout(fn, 100, a, b)`. Do not call the function in the argument position.

**★ Is it safe to call `clearTimeout` twice, or with an ID that already fired?**
Yes — an unknown or already-used ID is silently ignored, and `undefined` is fine too. The unsafe
case is the opposite: holding a stale ID long enough that it names a recycled timer.

**★ What is the longest delay you can pass?**
2,147,483,647 ms, about 24.8 days. Beyond that the value overflows: browsers fire the timeout
immediately, Node clamps to 1 ms and warns.

**★ Why is a forgotten `setInterval` a memory leak?**
The pending timer strongly references its callback, and the callback references everything it
closes over. Nothing in that graph can be collected until the interval is cleared.

**Can `clearInterval` cancel a `setTimeout`?**
In a browser, yes — they share one ID pool — but doing so is a code smell, not a technique.

---

[Topic index](./README.md) · [02 · Why `0` is not `0`](./02-why-zero-is-not-zero.md) →
