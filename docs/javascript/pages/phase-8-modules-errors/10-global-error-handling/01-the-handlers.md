---
title: "01 · The handlers"
sidebar_label: "01 · The handlers"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window: error` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event), [`GlobalEventHandlers.onerror`](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event), [`ErrorEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent), [`Window: unhandledrejection` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event), [`Window: rejectionhandled` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/rejectionhandled_event), [`PromiseRejectionEvent`](https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent), [`HTMLElement: error` event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/error_event), [`crossorigin`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/crossorigin), [`securitypolicyviolation`](https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event) — and Node.js [`process` § `uncaughtException`](https://nodejs.org/api/process.html#event-uncaughtexception), [§ `unhandledRejection`](https://nodejs.org/api/process.html#event-unhandledrejection). Documentation-validated; **no timings, no console blocks**.

🔴 **A global handler is the net under everything your `try`/`catch` blocks missed.** It is not
error *handling* — nothing is recovered there — it is error *reporting*, and its job is to make
sure no failure reaches a user without also reaching you.

There are **four separate channels** in a browser and **two** in Node, and none of them covers
the others.

## The browser's four channels

```js
// 1 · uncaught exceptions
window.addEventListener('error', (event) => {
  report(event.error ?? event.message);      // 🔴 event.error can be null — see below
});

// 2 · unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  report(event.reason);
});

// 3 · resource load failures — capture phase, because they do not bubble
window.addEventListener('error', (event) => {
  if (event.target instanceof HTMLElement) reportResource(event.target);
}, true);

// 4 · CSP violations
document.addEventListener('securitypolicyviolation', (event) => {
  report(`CSP: ${event.violatedDirective} blocked ${event.blockedURI}`);
});
```

**They do not overlap.** A rejected promise never fires `error`; a failed `<img>` never fires
`unhandledrejection`; a blocked script fires neither. Installing only the first is the usual
state of a codebase, and it is why "we have error tracking" and "we see our errors" are different
claims.

### 1 · `error` — and the legacy `onerror` signature

`window.onerror` predates the event and has its own positional signature, which you will still
meet in older code and in some SDKs:

```js
window.onerror = (message, source, lineno, colno, error) => {
  report(error ?? message);
  return true;                 // 🔴 truthy = "handled": suppresses the default console output
};
```

The event form gives you the same data on an `ErrorEvent` — `message`, `filename`, `lineno`,
`colno` and `error` — and composes properly, because several listeners can coexist while there is
only one `onerror` slot. **Prefer `addEventListener`**, and note the suppression mechanism differs:
`return true` for `onerror`, `event.preventDefault()` for the listener.

⚠️ **Do not suppress by default.** Silencing the console makes local debugging materially worse
and buys nothing — the report has already been sent by then.

### 2 · `unhandledrejection`, and its partner

```js
window.addEventListener('unhandledrejection', (event) => {
  report(event.reason);        // the rejection value — often, but not always, an Error
  // event.promise is the promise itself
});
window.addEventListener('rejectionhandled', (event) => {
  unreport(event.promise);     // a handler was attached LATER; it was not really unhandled
});
```

**`rejectionhandled` exists because "unhandled" is a judgement made at a moment in time** — at the
microtask checkpoint. Attaching a `.catch` in a later task fires `unhandledrejection` first and
`rejectionhandled` afterwards, so a reporter that ignores the second files a false positive. The
timing itself is
[Phase 7 · 08 · Unhandled rejections](../../phase-7-async/08-error-handling/03-unhandled-rejections.md).

🔴 **`event.reason` is whatever was rejected — a string, `undefined`, a `Response`.** Normalise
before reporting, or half your dashboard is `[object Object]`:

```js
const toError = (v) => v instanceof Error ? v : new Error(String(v), { cause: v });
```

### 3 · Resource errors do not bubble

A failed `<img>`, `<script>`, `<link>` or `<video>` fires `error` **on the element**, and that
event does not bubble — so a listener on `window` sees it only in the **capture** phase, which is
what the `true` third argument is for.

**Distinguish it from a script exception by the target:** an `ErrorEvent` from a script has
`error`/`message`; a resource failure's `event.target` is the element that failed. These are
worth reporting separately — a 404 on a chunk is the deploy problem from
[05 · Code splitting](../05-dynamic-import/02-code-splitting.md), not an application bug.

### 4 · "Script error." and `crossorigin`

```
Script error.
```

🔴 **A cross-origin script's exceptions are censored by default** — no message, no filename, no
line, no stack. It is a security measure, and it is why errors from your CDN-hosted bundle arrive
useless. Two things are required to lift it, and **both** must be in place:

```html
<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>
```

…plus an `Access-Control-Allow-Origin` header on the script response. Miss either and you are
back to `Script error.`

⚠️ **This also applies to modules and to workers**, and it is the single highest-value fix for a
front-end error dashboard full of blanks.

## Node's two channels

```js
process.on('unhandledRejection', (reason, promise) => {
  report(reason);
  process.exitCode = 1;                     // let the process wind down and fail
});

process.on('uncaughtException', (err, origin) => {
  report(err);                              // 🔴 then EXIT — see below
  process.exit(1);
});
```

**`unhandledRejection`**: since Node 15 the default behaviour is to **throw**, crashing the
process — which is the right default, and the reason a handler here should report and still let
the process fail rather than swallowing it.

🔴 **`uncaughtException` is not a recovery mechanism, and Node's documentation says so.** By the
time it fires, the exception has already unwound arbitrary stack frames: locks may be held,
callbacks abandoned, state half-written. **Correct use is to log, flush what you can, and exit**;
a server that keeps serving after one is serving from unknown state.

**Resuming is what a process manager is for** — systemd, a container orchestrator, `pm2`. Let the
process die and be restarted clean.

⚠️ **Each worker thread has its own handlers.** Installing them on the main thread does not cover
a `worker_threads` worker, and the same is true of a browser Web Worker: it needs its own `error`
and `unhandledrejection` listeners, or its failures are invisible.

## Install them first, and defensively

```js
// the FIRST module imported by the entry point
window.addEventListener('error', onError);
window.addEventListener('unhandledrejection', onRejection);
```

**An error thrown while your app is booting is the one you most need to see**, so the handlers
must be installed before anything else runs — ideally in a tiny inline script, so even a failure
loading the main bundle is captured.

🔴 **The handler itself must never throw.** An exception inside an `error` listener is an
uncaught exception, which is a fine way to build an infinite loop:

```js
function onError(event) {
  try { report(normalise(event)); } catch { /* reporting must never break the page */ }
}
```

## What these handlers cannot see

| Not captured | Why |
|---|---|
| Errors inside a Worker | separate global scope; needs its own listeners |
| `console.error(...)` calls | logging is not throwing |
| Errors you caught and swallowed | an empty `catch` is invisible by design ([09](../09-failing-well/02-results-versus-exceptions.md)) |
| A rejection nobody ever observed *and* nobody ever failed | pending forever is not rejected |
| Errors inside a cross-origin iframe | separate origin and document |

**The second and third rows are the important ones.** Global handlers cannot compensate for
errors your code deliberately hid — which is the practical argument for the four-things rule in
[09 · Results versus exceptions](../09-failing-well/02-results-versus-exceptions.md).

## Gotchas

**Symptom: the dashboard shows only "Script error." with no stack.**
Cause — a cross-origin script without CORS.
Fix — `crossorigin="anonymous"` on the tag **and** `Access-Control-Allow-Origin` on the response.

**Symptom: promise rejections never appear in error tracking.**
Cause — only `error` was wired up; rejections need `unhandledrejection`.
Fix — install both, and normalise `event.reason` into an `Error`.

**Symptom: a failed image or chunk never reports.**
Cause — resource errors do not bubble.
Fix — a `window` listener in the capture phase, branching on `event.target`.

**Symptom: rejections are reported that the code clearly handles.**
Cause — the handler was attached in a later task; `rejectionhandled` was ignored.
Fix — listen for `rejectionhandled` and retract the report.

**Symptom: the server keeps running after an `uncaughtException` and behaves strangely.**
Cause — treating it as recovery; the stack was already unwound.
Fix — report, flush, exit; let the supervisor restart.

**Symptom: errors during start-up are missing.**
Cause — the handlers were installed after the application code ran.
Fix — install them first, in the entry point or an inline script.

**Symptom: a Worker's failures are invisible.**
Cause — the worker has its own global scope.
Fix — install `error` and `unhandledrejection` listeners inside the worker too.

**Symptom: the page enters an error loop.**
Cause — the reporting handler itself threw.
Fix — wrap the handler body in its own `try`/`catch`.

## Interview questions

**★ Which global channels does a browser application need?**
Four: `error` for uncaught exceptions, `unhandledrejection` for promises, a **capture-phase**
`error` listener for resource failures (they do not bubble), and `securitypolicyviolation` for CSP.
None covers the others.

**★ Why do you only see "Script error."?**
The script is cross-origin, so its exception details are censored. Add `crossorigin="anonymous"`
to the tag and `Access-Control-Allow-Origin` on the script response — both are required.

**★ What is `rejectionhandled` for?**
"Unhandled" is decided at a microtask checkpoint. If a `.catch` is attached later, this event
fires and lets a reporter retract a false positive.

**★ Is `uncaughtException` a way to keep a Node server alive?**
No. Node's documentation is explicit that the stack has already unwound and the state is unknown.
Report, flush, and exit; let a process manager restart.

**★ `window.onerror` or `addEventListener('error')`?**
The listener — multiple listeners can coexist, and the data comes on an `ErrorEvent`. Suppression
differs: `return true` versus `event.preventDefault()`.

**★ What can a global handler never see?**
Errors you swallowed in an empty `catch`, `console.error` calls, and anything thrown inside a
Worker or a cross-origin iframe, which have their own global scopes.

**Where should the handlers be installed?**
First — before any application code — so start-up failures are captured, and the handler must
never throw.

---

[Topic index](./README.md) · [02 · Shipping errors to a reporter](./02-shipping-to-a-reporter.md) →
