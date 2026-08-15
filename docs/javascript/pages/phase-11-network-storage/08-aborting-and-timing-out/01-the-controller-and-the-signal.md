---
title: "1 · The controller and the signal"
sidebar_label: "1 · The controller and the signal"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortController.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static), [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [`AbortSignal.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/abort_static), [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch). Documentation-validated; **no timings**.

## Two objects, on purpose

```js
const controller = new AbortController();
controller.signal;     // the read-only half — hand this out
controller.abort();    // the trigger — keep this
```

🔴 **The split is a capability boundary.** Anything holding the *signal* can observe
cancellation and react to it; only the holder of the *controller* can cause it. So passing
`signal` into a function does not give that function the power to cancel your work, which
is exactly what you want when the signal travels several layers down.

**The signal is an `EventTarget`** with an `abort` event, plus two properties worth
knowing:

```js
signal.aborted;   // boolean — has it already fired?
signal.reason;    // why — a DOMException by default, or whatever you passed to abort()
```

## Aborting a `fetch`

```js
const controller = new AbortController();

const promise = fetch("/api/search?q=cat", { signal: controller.signal });

controller.abort();   // the promise REJECTS
```

**An aborted `fetch` rejects** — it does not resolve with an empty response, and it does
not silently do nothing. The rejection is a `DOMException` whose `name` is
`"AbortError"`.

⚠️ **Abort works during the body read too**, not only while waiting for headers. A
`response.json()` on a slow, large body is interrupted by the same signal
([07 · Reading responses](../07-reading-responses/README.md)).

## 🔴 Telling a cancel from a failure

**This is the part that gets written wrong most often:**

```js
try {
  const res = await fetch(url, { signal });
  render(await res.json());
} catch (err) {
  showError("Something went wrong");   // 🔴 fires on every user-cancelled request
}
```

**A cancellation you caused is not an error to report.** The user navigated away, typed
another character, closed the panel — showing them a failure toast for that is a bug, and
a common one.

✅ **Branch on the name:**

```js
try {
  const res = await fetch(url, { signal });
  render(await res.json());
} catch (err) {
  if (err.name === "AbortError") return;    // ✅ expected — we caused it
  if (err.name === "TimeoutError") return showError("The request timed out");
  showError("Network error");               // ✅ a real failure
}
```

⚠️ **Check `err.name`, not `instanceof`.** These are `DOMException`s, and the distinction
between an abort and a timeout lives entirely in the name — `instanceof DOMException` is
true for both.

🔴 **And do not swallow everything.** The opposite mistake — an empty `catch` because
"aborts are noisy" — hides genuine network failures. The two cases are different and the
code should say so.

## `AbortSignal.timeout()`

**A timeout is a cancellation on a clock, and there is a built-in for it:**

```js
await fetch(url, { signal: AbortSignal.timeout(5000) });
```

**No controller, no `setTimeout`, no cleanup.** The signal aborts itself after the given
milliseconds.

🔴 **Its rejection is a `TimeoutError`, not an `AbortError`** — a deliberate distinction,
and the reason the `catch` above has two branches. A user cancelling and a server not
answering are different events and usually deserve different UI.

⚠️ **The timer starts when the signal is created, not when the request is sent.** Create
it at the call, not once at module scope — a module-level `AbortSignal.timeout(5000)` is
already expired by the time anything uses it.

**The hand-rolled version is worth seeing once**, because it shows what the built-in
removes:

```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);
try {
  await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timer);   // ⚠️ the line everyone forgets
}
```

**The forgotten `clearTimeout` is not harmless** — it keeps a timer alive that fires an
abort on a request that already finished, and in Node it can hold the process open.

## `AbortSignal.any()` — a timeout *and* a cancel

**The real case is both at once: cancel if the user leaves, and also give up after five
seconds.**

```js
const controller = new AbortController();     // user-initiated

await fetch(url, {
  signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
});
```

**`AbortSignal.any` returns a signal that aborts as soon as any input does**, carrying
that input's reason — so the `err.name` check still tells you which one fired.

⚠️ **It is recent.** Check your targets; the fallback is a controller that listens to both
sources and calls its own `abort`.

**`AbortSignal.abort()` gives an already-aborted signal**, which is useful as a default
argument or in a test:

```js
AbortSignal.abort();                  // aborted immediately
AbortSignal.abort("user logged out"); // with a custom reason
```

## `reason` and `throwIfAborted`

```js
controller.abort(new Error("user navigated away"));
signal.reason;    // that Error — whatever you passed
```

**A custom reason survives to every consumer**, which is how you distinguish two different
cancellations in the same code path. With no argument, the reason is the standard
`AbortError` `DOMException`.

**`throwIfAborted()` is the one-line guard for your own async code:**

```js
async function work(signal) {
  signal.throwIfAborted();          // ✅ before starting
  const a = await step1();
  signal.throwIfAborted();          // ✅ between awaits — cancellation is cooperative
  return step2(a);
}
```

🔴 **Cancellation is cooperative, not pre-emptive.** Aborting a signal does not stop
running JavaScript. Built-ins like `fetch` check it for you; your own functions have to
check it themselves, and the natural places are before starting and after every `await`.

## Gotchas

**Symptom:** An error toast appeared every time the user typed in a search box
**Cause:** The abort of the previous request was caught and reported as a failure.
**Fix:** `if (err.name === "AbortError") return;`.

**Symptom:** Genuine network errors stopped appearing
**Cause:** The `catch` swallows everything to silence aborts.
**Fix:** Branch by `err.name`; re-throw or report anything else.

**Symptom:** `instanceof` could not distinguish a timeout from an abort
**Cause:** Both are `DOMException`; only `name` differs.
**Fix:** Compare `err.name` to `"AbortError"` and `"TimeoutError"`.

**Symptom:** A module-level timeout signal aborted everything instantly
**Cause:** `AbortSignal.timeout()` starts counting when created.
**Fix:** Create it inside the call.

**Symptom:** A timer kept firing after the request finished
**Cause:** A hand-rolled timeout without `clearTimeout` in a `finally`.
**Fix:** `AbortSignal.timeout()`, or clear it.

**Symptom:** Aborting did not stop a long synchronous loop
**Cause:** Cancellation is cooperative — it cannot interrupt running code.
**Fix:** Check `signal.aborted` or call `throwIfAborted()` between chunks of work.

**Symptom:** `AbortSignal.any is not a function`
**Cause:** It is recent.
**Fix:** A controller that subscribes to both signals and aborts itself.

**Symptom:** A function that received a signal cancelled the caller's other work
**Cause:** The *controller* was passed instead of the signal.
**Fix:** Pass `controller.signal` — that is what the split is for.

## Interview questions

**★ Why does `AbortController` have a separate `signal`?**
Because they are different capabilities. The signal only lets you *observe* cancellation;
the controller lets you *cause* it. Passing the signal down through layers gives them the
ability to react without the ability to cancel your work, which matters as soon as the
signal travels beyond the code that created it.

**★ How do you add a timeout to `fetch`?**
`AbortSignal.timeout(ms)` — `fetch` has no timeout of its own and a stalled request stays
pending indefinitely. It rejects with a `TimeoutError`, distinct from the `AbortError` a
manual cancel produces. The hand-rolled `setTimeout` plus `controller.abort()` needs a
`clearTimeout` in a `finally`, which is the line people forget.

**★ How do you tell a cancelled request from a failed one?**
`err.name === "AbortError"` for a cancel and `"TimeoutError"` for a timeout — both are
`DOMException`s, so `instanceof` cannot separate them. Cancellations you caused should not
surface as errors to the user, but the `catch` must still report everything else.

**★ How do you combine a user cancel with a timeout?**
`AbortSignal.any([controller.signal, AbortSignal.timeout(ms)])` — it aborts when either
does and carries that source's reason, so the `name` check still tells you which fired.

**Does aborting stop the code that is running?**
No — cancellation is cooperative. Built-ins like `fetch` check the signal for you; your own
async functions must call `signal.throwIfAborted()` or test `signal.aborted`, typically
before starting and after each `await`. Aborting cannot interrupt a synchronous loop at
all.

**What is `signal.reason` for?**
It carries why the abort happened — the standard `AbortError` `DOMException` by default, or
whatever value you pass to `abort()`. That is how two different cancellations in the same
code path stay distinguishable downstream.

---

[Topic index](./README.md) · Next: [2 · Cancellation as a lifecycle](./02-cancellation-as-a-lifecycle.md) →
