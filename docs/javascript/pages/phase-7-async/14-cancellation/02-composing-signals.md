---
title: "02 · Composing and propagating signals"
sidebar_label: "02 · Composing signals"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortSignal.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/abort_static), [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason), [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException), [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race) — and the [DOM Standard § Aborting ongoing activities](https://dom.spec.whatwg.org/#aborting-ongoing-activities). Documentation-validated; **no timings, no console blocks**.

Real cancellation is rarely one controller. A request should stop when the user navigates away
**or** when it has taken too long **or** when the whole page is tearing down. Three static
methods on `AbortSignal` cover all of it without a single manual listener.

## The three statics

| Static | Gives you | Reason when it fires |
|---|---|---|
| `AbortSignal.abort(reason?)` | a signal that is **already aborted** | the reason you passed, else `AbortError` |
| `AbortSignal.timeout(ms)` | a signal that aborts after `ms` | 🔴 a `DOMException` named **`TimeoutError`** |
| `AbortSignal.any([a, b, …])` | a signal that aborts when **any** input does | the reason of whichever fired first |

### `AbortSignal.abort()` — the already-cancelled signal

Useful mostly as a default, so a code path that has no signal still exercises the same branch:

```js
function load(url, { signal = new AbortController().signal } = {}) { … }
```

…and in tests, where `AbortSignal.abort()` is the one-liner that proves your function refuses to
start.

### `AbortSignal.timeout(ms)` — and why its reason is different

```js
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

No controller, no `setTimeout`, no `clearTimeout`. Two properties of it matter:

🔴 **It aborts with a `TimeoutError`, not an `AbortError`** — which is exactly what you want,
because a timeout and a user cancellation deserve different handling: one is worth retrying and
reporting, the other must stay silent.

```js
try {
  await load({ signal });
} catch (err) {
  if (err.name === 'AbortError')  return;         // the user cancelled — say nothing
  if (err.name === 'TimeoutError') return retry(); // the server was slow — worth retrying
  throw err;
}
```

⚠️ **The clock starts when the signal is created, not when it is used.** A signal built at module
load and used minutes later is already spent. Create it at the call site, inside the function
that starts the work.

**It also cannot be cancelled early or extended** — there is no controller behind it. When you
need "5 seconds, unless the user cancels first", that is the next static.

### `AbortSignal.any([...])` — the composition primitive

```js
function fetchWithLimits(url, { signal, timeoutMs = 5000 } = {}) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  return fetch(url, { signal: AbortSignal.any(signals) });
}
```

The composite aborts as soon as **any** input does, and takes **that** signal's reason — so the
`err.name` branch above still tells you which one fired. This replaces the hand-written version
where you wire an `abort` listener from each parent onto a fresh controller, and it replaces it
correctly, including the case where one input was already aborted before you composed.

**The two-source shape is the common one in an application:** a long-lived signal for "this view
is gone" and a short-lived one for "this request took too long".

## Propagating down a call tree

A signal is threaded exactly like a database transaction or a request context: **every layer
accepts it, passes it on, and never invents its own**.

```js
async function renderDashboard({ signal }) {
  const [user, stats] = await Promise.all([
    getUser({ signal }),                 // ✅ down
    getStats({ signal }),                // ✅ down
  ]);
  return draw(user, stats);
}

async function getStats({ signal }) {
  const res = await fetch('/stats', { signal });          // ✅ to the platform
  signal?.throwIfAborted();                                // ✅ across the suspension
  return res.json();
}
```

🔴 **The layer that drops the signal is where cancellation dies**, and it fails silently — the
call still works, it just cannot be stopped. When a function takes an options object, adding
`signal` to it costs nothing and keeps the chain intact.

### One controller per scope, aborted in teardown

```js
class SearchView {
  #ac = new AbortController();

  connected() {
    const { signal } = this.#ac;
    input.addEventListener('input', this.#onInput, { signal });   // listener
    window.addEventListener('offline', this.#pause, { signal });  // listener
    this.#poll({ signal });                                        // work
  }

  disconnected() { this.#ac.abort(); }   // 🔴 listeners, timers and requests, all at once
}
```

**One `abort()` is the whole teardown** — because `addEventListener` accepts a signal, so do
timers you wrapped ([13 · Promisifying](../13-creating-promises/02-promisifying.md)), and so does
`fetch`. This is the pattern worth internalising: an `AbortController` is a *scope*, not a
network-request feature.

### A per-operation controller, when only the latest one matters

For a search-as-you-type box, each keystroke should cancel the previous request:

```js
let inFlight = null;

async function search(q) {
  inFlight?.abort();                     // cancel the previous one
  inFlight = new AbortController();
  const signal = AbortSignal.any([inFlight.signal, viewSignal]);
  try {
    render(await getResults(q, { signal }));
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(err);
  }
}
```

Cancelling the previous request is not only a bandwidth saving — it removes the possibility of a
stale response landing after a newer one. That failure and the other defences against it are
**17 · Race conditions in a UI** *(not written yet)*.

## `Promise.race` with a timer is not cancellation

```js
// ❌ looks like a timeout, cancels nothing
await Promise.race([slowWork(), delay(5000).then(() => { throw new Error('timeout'); })]);
```

`race` settles with the first promise to settle and **ignores the rest**. The slow work keeps
running, keeps its socket open, keeps its listeners attached and eventually resolves into
nothing. Worse, if it rejects after the race is over, that rejection has no handler
([08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md)).

| | `Promise.race` + timer | `AbortSignal.timeout` |
|---|---|---|
| Stops the work | ❌ | ✅ if the work honours the signal |
| Releases the socket / listeners | ❌ | ✅ |
| Leaves a dangling rejection | ⚠️ possible | ❌ |
| Distinguishes timeout from cancel | by hand | `TimeoutError` vs `AbortError` |

🔴 **Use `race` only when the loser genuinely cannot be cancelled** — and then know that you are
choosing to ignore it, not to stop it. Combining a signal *with* a retry policy is
**15 · Timeouts, retries, backoff and jitter** *(not written yet)*.

## The cleanup that composition still owes you

`AbortSignal.any` builds a signal that listens to its inputs. If an input is long-lived — a
page-level controller that lives for the session — and you compose against it once per request,
those composites are only collectable once the request's own signals are unreachable. **Keep the
short-lived controller short-lived**: create it in the function, drop the reference when the
operation settles, and never hold composites in a module-level array "just in case".

The same reasoning applies to your own `abort` listeners, and it is the leak family in
[Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md).

## Gotchas

**Symptom: a timeout is reported to the user as a cancellation, or vice versa.**
Cause — both were caught as one error.
Fix — `AbortSignal.timeout` aborts with `TimeoutError`; a manual `abort()` gives `AbortError`.
Branch on `err.name`.

**Symptom: `AbortSignal.timeout(5000)` fires immediately.**
Cause — the signal was created long before it was used; its clock starts at creation.
Fix — create it at the call site.

**Symptom: you cannot cancel a request early because it uses `AbortSignal.timeout`.**
Cause — there is no controller behind a timeout signal.
Fix — `AbortSignal.any([controller.signal, AbortSignal.timeout(ms)])`.

**Symptom: aborting the view's controller does not stop the inner request.**
Cause — an intermediate function accepted the signal and did not pass it on.
Fix — thread `signal` through every layer, including into `fetch` and any wrapper.

**Symptom: `Promise.race` "timed out" but the server still processed the request.**
Cause — `race` ignores the loser; it does not stop it.
Fix — pass a signal into the work so it is actually aborted.

**Symptom: an unhandled rejection appears seconds after a race resolved.**
Cause — the losing promise rejected later with nothing attached.
Fix — cancel it properly, or attach a `.catch(() => {})` deliberately and say why.

**Symptom: memory climbs on a long-lived page that composes signals per request.**
Cause — composites and `abort` listeners tied to a session-long controller are retained.
Fix — keep per-operation controllers local and let them go once the operation settles.

## Interview questions

**★ What does `AbortSignal.timeout(ms)` abort with, and why does it matter?**
A `DOMException` named `TimeoutError`, not `AbortError`. The distinction lets you retry or report
a timeout while staying silent about a cancellation the user asked for.

**★ How do you give an operation both a timeout and user cancellation?**
`AbortSignal.any([controller.signal, AbortSignal.timeout(ms)])`. The composite aborts on whichever
fires first and carries that signal's reason, so the `err.name` check still distinguishes them.

**★ Why is `Promise.race` against a timer not a timeout?**
Because `race` only chooses the first settlement — the losing work keeps running, holds its
resources, and may reject later with no handler. A signal actually stops the work.

**★ How do you cancel a whole view's async work at once?**
One `AbortController` per scope. Register every listener with `{ signal }`, pass the same signal
into every request and wrapper, and call `abort()` in teardown.

**★ Where does cancellation usually break in a real codebase?**
At the layer that accepts a signal and forgets to pass it down. Everything still works, so
nothing reveals it until an abort has no effect.

**★ How would you cancel the previous request in a search-as-you-type box?**
Keep the in-flight controller in a variable, `abort()` it at the start of the next call, replace
it with a fresh one, and swallow `AbortError` in the catch.

**Can you extend or cancel a timeout signal?**
No — it has no controller. Compose it with one via `AbortSignal.any` if you need both.

---

← [01 · The model](./01-the-model.md) · [Topic index](./README.md)
