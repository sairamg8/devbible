---
title: "2 · Cancellation as a lifecycle"
sidebar_label: "2 · Cancellation as a lifecycle"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`AbortController.abort()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response), [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream), [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver). Documentation-validated; **no timings**.

## 🔴 `addEventListener(..., { signal })`

**This is the feature most people never learn, and it deletes more code than the `fetch`
case does.**

```js
const controller = new AbortController();
const { signal } = controller;

window.addEventListener("resize", onResize, { signal });
document.addEventListener("keydown", onKey, { signal });
el.addEventListener("click", onClick, { signal });

controller.abort();   // ✅ removes ALL THREE at once
```

**Compare what it replaces:**

```js
// 🔴 the old way — every listener needs its own named function and its own removal
window.addEventListener("resize", onResize);
document.addEventListener("keydown", onKey);
el.addEventListener("click", onClick);

function cleanup() {
  window.removeEventListener("resize", onResize);
  document.removeEventListener("keydown", onKey);
  el.removeEventListener("click", onClick);
}
```

⚠️ **`removeEventListener` requires the *same function reference***, which is why an inline
arrow can never be removed and why so much code keeps handlers in variables purely to be
able to detach them. With a signal, an inline arrow is fine:

```js
el.addEventListener("click", () => doThing(), { signal });   // ✅ removable after all
```

**One controller per lifetime is the pattern:** create it when the thing starts, pass its
signal to every subscription and every request, and call `abort()` once when the thing
ends. The listeners, the fetches and your own async work all stop together.

## Cancelling on unmount, and the race it prevents

**The classic bug:**

```js
// 🔴 the response arrives after the component is gone
useEffect(() => {
  fetch(`/api/user/${id}`)
    .then((r) => r.json())
    .then(setUser);
}, [id]);
```

**Two separate problems, and cancellation fixes both:**

1. **Work continues after the component is gone**, wasting bandwidth and CPU, and in some
   frameworks warning about setting state on an unmounted component.
2. 🔴 **The stale-response race.** `id` changes from 1 to 2, two requests are in flight,
   and the response for `1` arrives *second* — so the UI shows the wrong user. Nothing
   about the code looks wrong; it depends entirely on network timing.

✅ **The fix is one controller per effect run:**

```js
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/user/${id}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((err) => {
      if (err.name === "AbortError") return;   // ✅ expected
      setError(err);
    });

  return () => controller.abort();             // ✅ on unmount AND before the next run
}, [id]);
```

**The cleanup runs before each re-run as well as on unmount**, which is what makes the
stale response impossible rather than merely unlikely: request 1 is aborted the moment
`id` becomes 2.

⚠️ **This is not a React-specific pattern.** Any lifecycle with a teardown — a custom
element's `disconnectedCallback`, a route change, a modal close, a subscription — is the
same shape.

## One controller per what?

| Scope | Use |
|---|---|
| **per request** | the request can be cancelled individually — a typeahead cancelling the previous keystroke's fetch |
| **per component or view** | everything that view started stops together on teardown |
| **per user action** | a "cancel" button on a long operation |
| **global / app-level** | logout, or a page-wide "stop everything" |

🔴 **A controller cannot be reused.** Once aborted, its signal is aborted forever — a
second `abort()` does nothing and a new request handed that signal fails immediately:

```js
controller.abort();
fetch(url, { signal: controller.signal });   // 🔴 rejects at once, already aborted
```

✅ **Make a new controller for each new operation.** In a typeahead that means: abort the
previous one, create a fresh one, fire the request.

```js
let inFlight = null;

function search(q) {
  inFlight?.abort();                       // ✅ cancel the previous keystroke
  inFlight = new AbortController();
  return fetch(`/search?q=${encodeURIComponent(q)}`, { signal: inFlight.signal });
}
```

## Making your own work abortable

**Accept a signal and honour it** — that is the whole contract, and it makes your function
compose with everything else:

```js
async function processAll(items, { signal } = {}) {
  const out = [];
  for (const item of items) {
    signal?.throwIfAborted();          // ✅ cooperative check between units of work
    out.push(await processOne(item, { signal }));
  }
  return out;
}
```

**For a callback-based API, subscribe to the event:**

```js
function wait(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(id);                     // ✅ release the resource
      reject(signal.reason);
    }, { once: true });
  });
}
```

⚠️ **Note `{ once: true }`** — and that an abort listener on a long-lived signal is itself
a leak if the operation finishes first and never detaches. `{ once: true }` handles the
firing case; for the completion case, remove it or scope the signal to the operation.

**Signals compose downward**: pass the same signal to every nested call and one abort
unwinds the whole tree. That is why "take a `signal` option" is worth doing even for
functions that only forward it.

## What abort does not do

🔴 **Aborting does not un-send the request.** If the bytes already reached the server, the
server has already acted on them — the row is inserted, the email is sent, the payment is
taken. Abort stops your program *listening*; it does not reach across the network.

⚠️ **So a cancelled non-idempotent request is genuinely ambiguous.** After aborting a
`POST` you do not know whether it applied. The answers are the ordinary ones: make the
operation idempotent with a client-generated key, or reconcile afterwards. **Never treat a
cancelled write as "it did not happen".**

**Abort also does not:**

- **Stop synchronous code.** It is cooperative — a busy loop runs to completion.
- **Roll anything back.** There is no undo, only "stop doing more".
- **Free a body you already started reading**, unless the reader itself honours the
  signal — a stream should be cancelled explicitly
  ([07 · Reading responses](../07-reading-responses/README.md)).

✅ **Cancel freely for reads.** A `GET` that nobody is waiting for costs nothing to abandon,
which is why typeahead, prefetch and infinite scroll should all abort aggressively.

## Gotchas

**Symptom:** The UI showed data for the previous selection
**Cause:** Two requests in flight; the older response arrived last.
**Fix:** One controller per effect run, aborted in the cleanup so the stale request cannot
resolve.

**Symptom:** Listeners kept firing after a view was destroyed
**Cause:** `removeEventListener` was never called, or was called with a different function
reference.
**Fix:** Pass `{ signal }` to every `addEventListener` and abort once on teardown.

**Symptom:** An inline arrow listener could not be removed
**Cause:** `removeEventListener` needs the identical reference.
**Fix:** `{ signal }` — the handler no longer has to be named.

**Symptom:** Every request after the first failed instantly
**Cause:** A single controller was reused after being aborted; its signal stays aborted.
**Fix:** A new `AbortController` per operation.

**Symptom:** A `POST` was cancelled and the record was created anyway
**Cause:** Abort stops the client listening; the server had already received the request.
**Fix:** Idempotency keys, or reconcile. Do not assume a cancelled write did not happen.

**Symptom:** Aborting did not interrupt a long computation
**Cause:** Cancellation is cooperative.
**Fix:** Check `signal.aborted` or `throwIfAborted()` between units of work.

**Symptom:** Memory grew in a long-lived page with a shared signal
**Cause:** Abort listeners were added per operation and never removed.
**Fix:** `{ once: true }`, and remove the listener when the operation completes normally.

## Interview questions

**★ What does `addEventListener(handler, { signal })` give you?**
Removal without `removeEventListener`. Aborting the controller detaches every listener
registered with that signal at once, across any number of targets — and it makes inline
arrow handlers removable, which they otherwise are not, since removal requires the identical
function reference. One controller per lifetime, one `abort()` on teardown.

**★ How does cancellation fix the stale-response race?**
Two requests in flight can resolve out of order, so the older response can overwrite the
newer data. Creating a controller per effect run and aborting it in the cleanup means the
previous request is cancelled the instant the input changes, so it cannot resolve at all.
Without that, correctness depends on network timing.

**★ Can an `AbortController` be reused?**
No. Once aborted its signal is permanently aborted, and any request given that signal
rejects immediately. Create a new controller per operation — in a typeahead: abort the
previous, create a fresh one, fire the request.

**★ What does aborting a request *not* do?**
It does not un-send it. If the bytes reached the server, the server acted on them — so a
cancelled `POST` is ambiguous, and treating it as "it did not happen" is a real bug. Use an
idempotency key or reconcile. Abort also cannot interrupt synchronous code, and it rolls
nothing back.

**How do you make your own async function abortable?**
Accept a `signal` option, call `signal.throwIfAborted()` before starting and between units
of work, and forward the same signal to everything you call — so one abort unwinds the whole
tree. For callback APIs, listen for the `abort` event with `{ once: true }`, release the
resource and reject with `signal.reason`.

**When should you cancel aggressively?**
For reads. An abandoned `GET` costs nothing to cancel, so typeahead, prefetch and infinite
scroll should all abort superseded requests. Writes need more thought, because the server
may already have applied them.

---

← [1 · The controller and the signal](./01-the-controller-and-the-signal.md) · [Topic index](./README.md) · [Phase index](../README.md) →
