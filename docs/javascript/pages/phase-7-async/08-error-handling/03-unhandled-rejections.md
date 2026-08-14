---
title: "08.3 · Unhandled rejections"
sidebar_label: "03 · Unhandled rejections"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`unhandledrejection` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) — and the Node.js [`process`](https://nodejs.org/api/process.html) documentation, events `'unhandledRejection'` and `'rejectionHandled'`. Documentation-validated.

**The last line of defence, and the only place a vanished rejection from
[chunk 02](./02-rejections-that-vanish.md) becomes visible.** MDN:

> "If a promise rejection event is not handled by any handler, it **bubbles to the top of
> the call stack**, and the host needs to surface it."

Note *the host* — this is not a language feature. The behaviour is defined by the browser and
by Node separately, and they differ in ways that matter.

## In the browser: two events

MDN:

> **`unhandledrejection`** — "Sent when a promise is rejected but there is no rejection
> handler available."
>
> **`rejectionhandled`** — "Sent when a handler is attached to a rejected promise that has
> already caused an `unhandledrejection` event."
>
> "In both cases, the event (of type `PromiseRejectionEvent`) has as members a `promise`
> property indicating the promise that was rejected, and a `reason` property that provides
> the reason given for the promise to be rejected."

The pairing is the interesting part: **the browser is willing to be told it was wrong.** A
rejection reported as unhandled can later acquire a handler, and the second event says so —
which is the documented acknowledgement of the late-attachment case from
[chunk 02](./02-rejections-that-vanish.md).

MDN on where these listeners live and what they are for:

> "These make it possible to offer fallback error handling for promises, as well as to help
> debug issues with your promise management. **These handlers are global per context, so all
> errors will go to the same event handlers, regardless of source.**"

### Suppressing the console output

> "Allowing the `unhandledrejection` event to bubble will eventually result in an error
> message being output to the console. You can prevent this by calling `preventDefault()` on
> the `PromiseRejectionEvent`"

```js
window.addEventListener("unhandledrejection", (event) => {
  // Handle the unhandled rejection

  // Prevent the default handling (such as outputting the
  // error to the console)
  event.preventDefault();
});
```

🔴 **Call `preventDefault()` only if you are genuinely reporting the error somewhere else.**
Suppressing the console message without forwarding it to your monitoring is how a codebase
ends up with a class of failures nobody can see.

## In Node: a different name, and a harder default

MDN flags the naming difference first:

> "In Node.js, handling promise rejection is slightly different. You capture unhandled
> rejections by adding a handler for the Node.js `unhandledRejection` event (**notice the
> difference in capitalization of the name**)"

```js
process.on("unhandledRejection", (reason, promise) => {
  // Add code here to examine the "promise" and "reason" values
});
```

Node's own documentation supplies the two facts that matter more:

> "The `'unhandledRejection'` event is emitted whenever a `Promise` is rejected and no error
> handler is attached to the promise **within a turn of the event loop**."

That is the **timing definition** — the window is one turn, which is why the late-attachment
case in [chunk 02](./02-rejections-that-vanish.md) reports even though the handler works.

And the default, which is the sharp edge:

> "If an `'unhandledRejection'` event is emitted but not handled **it will be raised as an
> uncaught exception**. This alongside other behaviors of `'unhandledRejection'` events can
> be changed via the `--unhandled-rejections` flag."

🔴 **In Node, an unhandled rejection is raised as an uncaught exception by default** — so a
forgotten `catch` in a background job can take down the process. On the web the same mistake
only logs. The identical code is far more dangerous on the server, which is worth knowing
before you copy a pattern from a front-end codebase into a service.

Node also has the counterpart event:

> "The `'rejectionHandled'` event is emitted whenever a `Promise` has been rejected and an
> error handler was attached to it (using `promise.catch()`, for example) **later than one
> turn of the Node.js event loop**."

Its argument is only the `promise` — no reason — because it exists to let you *retract* an
earlier report rather than to handle anything.

### Registering a listener changes the default

MDN:

> "For Node.js, to prevent the error from being logged to the console (the default action
> that would otherwise occur), **adding that `process.on()` listener is all that's
> necessary**; there's no need for an equivalent of the browser runtime's `preventDefault()`
> method."

And immediately, the warning that matters most in this whole topic:

> "However, if you add that `process.on` listener but **don't also have code within it to
> handle rejected promises, they will just be dropped on the floor and silently ignored**. So
> ideally, you should add code within that listener to examine each rejected promise and make
> sure it was not caused by an actual code bug."

🔴 **An empty `process.on('unhandledRejection', () => {})` is worse than no listener at all.**
It converts a loud crash into total silence. This is a real and common "fix" applied to a
noisy service, and it hides the bug rather than solving it.

## What a listener should actually do

The two hosts differ, but the shape of a correct listener does not:

1. **Report it** — to your logging or monitoring, with the `reason` and, if you can,
   something identifying the promise.
2. **Treat it as a bug, not as an error class.** Every unhandled rejection is a place where
   [chunk 02](./02-rejections-that-vanish.md)'s ownership rule was broken. The listener is
   an alarm, not a handler.
3. **Decide deliberately whether to exit.** On a server, continuing after an unknown failure
   may leave inconsistent state; Node's default of raising an uncaught exception is a
   defensible choice, and overriding it should be a decision rather than a side effect of
   adding a logger.

```js
// Node — report, then let the default behaviour stand where possible
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ err: reason }, "unhandled rejection — a promise lost its owner");
  throw reason;   // preserve the crash rather than silently continuing
});
```

**A global handler is a safety net and a diagnostic. It is never the error handling.**

## Gotchas

**Symptom:** A Node service exits on an error that only logged a warning in the browser
**Cause:** Node raises an unhandled rejection *"as an uncaught exception"* by default; the
web only logs.
**Fix:** Expected. Attach handlers to background work; do not port a front-end fire-and-forget
pattern to a server unchanged.

**Symptom:** Errors stopped appearing after someone "fixed the noisy logs"
**Cause:** Either `event.preventDefault()` in the browser without forwarding, or an **empty**
`process.on('unhandledRejection')` listener. MDN: they *"will just be dropped on the floor
and silently ignored"*.
**Fix:** A listener must report. Suppress the default only when something else is recording
the failure.

**Symptom:** `unhandledrejection` never fires; you used `unhandledRejection`
**Cause:** The browser event is all-lowercase; Node's is camel-case. MDN calls out the
capitalisation difference explicitly.
**Fix:** `window.addEventListener("unhandledrejection", …)` on the web,
`process.on("unhandledRejection", …)` in Node.

**Symptom:** A rejection is reported despite a `catch` being attached
**Cause:** It was attached **later than one turn** of the event loop.
**Fix:** Attach in the same turn. `rejectionHandled` / `rejectionhandled` exists to tell you
this happened.

**Symptom:** The global handler fires but the stack trace points nowhere useful
**Cause:** The rejection is discovered by the host after the fact, not at the throw site.
**Fix:** This is why the net is not a substitute for local handling. Give every promise an
owner so the error is caught where it has context.

**Symptom:** Unrelated libraries' failures arrive in your handler
**Cause:** MDN: *"These handlers are global per context, so all errors will go to the same
event handlers, regardless of source."*
**Fix:** Expected. Do not assume the rejection came from your code.

## Interview questions

**★ What happens to a rejection nobody handles?**
MDN: it *"bubbles to the top of the call stack, and the host needs to surface it."* The
browser fires **`unhandledrejection`** on the global scope; Node emits
**`unhandledRejection`** on `process`. It is host behaviour, not a language feature, and the
two hosts differ.

**★ How does Node's default differ from the browser's?**
Node's docs: an unhandled rejection *"will be raised as an uncaught exception"* — it can
terminate the process. On the web it eventually logs an error to the console. The same
forgotten `catch` is far more dangerous on a server.

**★ When exactly is a rejection considered unhandled?**
Node defines the window: *"no error handler is attached to the promise within a turn of the
event loop."* A handler attached later still receives the rejection, but the report has
already fired — which is why `rejectionHandled` exists, for a handler attached *"later than
one turn"*.

**★ Why is an empty `process.on('unhandledRejection', () => {})` dangerous?**
Because registering the listener replaces the default behaviour. MDN: without code inside,
rejections *"will just be dropped on the floor and silently ignored."* It converts a loud
crash into total silence — the bug is hidden, not fixed.

**★ Should a global handler be your error handling?**
No. It is a safety net and a diagnostic. Every unhandled rejection marks a promise that lost
its owner, and the stack is discovered after the fact, so it rarely points anywhere useful.
Handle errors where they have context.

**What does `preventDefault()` on a `PromiseRejectionEvent` do?**
Stops the default handling — MDN names *"outputting the error to the console"*. Only use it
when you are forwarding the failure to monitoring instead.

---

← Prev [02 · Rejections that vanish](./02-rejections-that-vanish.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
