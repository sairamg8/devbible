---
title: "uncaughtException and unhandledRejection"
sidebar_label: "18 · Crash handlers"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**These two handlers exist so you can log a fatal error before dying. They do not
exist so you can keep running. Log, stop accepting work, exit non-zero — and let
the orchestrator start a process whose state you can reason about.**

The mechanics of *why* a rejection goes unhandled are
[Phase 2, page 15](../phase-2-async/15-unhandled-rejections.md). This page is what
to do about it at the process level.

## The defaults

```console
$ node crash1.mjs
file:///…/crash1.mjs:1
Promise.reject(new Error('nobody catches me'));
               ^
actual status=1
```

An unhandled rejection **terminates the process with exit code 1** — the default
since Node 15, equivalent to `--unhandled-rejections=throw`. The timer scheduled
after it never ran. An uncaught exception does the same.

That default is correct. The handlers below only change *how* you die, not
whether you should.

## Installing one does change behaviour

```console
$ node crash2.mjs
handler saw: caught by handler — process continues
and the timer still ran
status=0
```

With a listener registered, Node stops terminating and the process carries on with
whatever state the failure left behind. That is the trap: adding a handler to
"stop the crashes" converts a loud, restartable failure into a silent, corrupted
one.

```console
$ node crash4.mjs
swallowed: failed mid-section
lock is now: held — corrupted, and the process kept running
```

The function threw between acquiring and releasing. The process survived; the lock
is held forever. Real versions of this are a database transaction never committed
or rolled back, a connection checked out of the pool and never returned, a
half-written file, a queue message neither acked nor nacked.

## What the handlers are for

```js
process.on('uncaughtException', (err, origin) => {
  log.fatal({ err, origin }, 'uncaught exception — exiting');
  shutdown('uncaughtException').finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();     // if shutdown itself hangs
});

process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'unhandled rejection — exiting');
  shutdown('unhandledRejection').finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
});
```

```console
$ node crash3.mjs
listening
uncaughtException: boom from a timer (origin=uncaughtException)
correct response: log, stop accepting, exit non-zero — NOT continue
status=1
```

Three requirements:

1. **Log with your real logger**, structured, including the stack. Without the
   handler you get Node's stderr dump, which a JSON log pipeline will mangle into
   an unsearchable blob.
2. **Exit non-zero**, so the supervisor restarts and the failure is visible in
   restart metrics.
3. **Bound the shutdown.** The process is already in an unknown state, so a
   `shutdown()` that hangs must not prevent exit — hence the unref'd timer.

Doing a full graceful drain here is a judgement call. Something already went
wrong, and running more code over corrupted state can make it worse; exiting
immediately after logging is a defensible choice, and the drain is the ambitious
one. What is not defensible is continuing to serve.

`origin` distinguishes `'uncaughtException'` from `'unhandledRejection'` when both
route to the same handler. There is also
`process.on('uncaughtExceptionMonitor')`, which observes without suppressing the
default termination — the right hook for a reporter like Sentry, because it cannot
accidentally keep a broken process alive.

## Where these come from

Almost always a missing `catch` on a path nobody exercised:

```js
app.get('/orders', async (req, res) => {       // Express 4: throws here are NOT caught
  const orders = await db.query(...);          // an async throw becomes an
  res.json(orders);                            // unhandled rejection
});
```

Express 5 forwards rejections from async handlers to the error middleware; Express
4 does not, and neither does raw `node:http`
([page 01](01-http-server.md)). Fastify handles it natively. The other common
sources are event-emitter listeners — an `async` listener's rejection has nowhere
to go — and floating promises
([Phase 2, page 12](../phase-2-async/12-floating-promises.md)).

The fix is upstream: `catch` at the boundary, an async-safe wrapper on every
route, and the `no-floating-promises` lint rule. These handlers are the net under
the net.

## `warning` and `beforeExit`

```js
process.on('warning', (w) => log.warn({ name: w.name, message: w.message }, 'node warning'));
```

`MaxListenersExceededWarning` and deprecation notices arrive here — worth
capturing, since a listener leak warning at 11 handlers is often the first sign of
the leak that eventually kills you.

`beforeExit` fires when the loop empties, and **not** after `process.exit()` or a
fatal error, so it is unsuitable for cleanup. `exit` is synchronous-only
([page 15](15-process.md)).

## Gotchas

**Symptom:** Crashes stopped after adding a handler, and now data is subtly wrong
**Cause:** The handler suppresses termination and the process runs on corrupted
state.
**Fix:** Always exit non-zero from these handlers.

**Symptom:** The process dies with no log line
**Cause:** No handler, so Node writes to stderr in its own format, which the log
pipeline discards.
**Fix:** Install a handler that logs structurally, then exits.

**Symptom:** Requests hang after a route throws
**Cause:** Express 4 does not catch async errors; the response is never written.
**Fix:** An async wrapper, Express 5, or Fastify.

**Symptom:** Connections leak after every error
**Cause:** The process survives with checked-out connections and held locks.
**Fix:** Exit and let a fresh process start.

**Symptom:** The handler itself hangs and the process never exits
**Cause:** Graceful shutdown over broken state.
**Fix:** An unref'd forced-exit timer.

**Symptom:** Sentry stops reporting after adding an `uncaughtException` handler
**Cause:** Two handlers, and yours exits before the reporter flushes.
**Fix:** `uncaughtExceptionMonitor` for reporting; keep one owner of the exit.

## Interview questions

**★ Should you keep the process alive in `uncaughtException`?**
No. The stack unwound from an unknown point, so locks may be held, transactions
open and connections leaked. Demonstrated above: a function that threw between
acquiring and releasing left the lock held while the process kept serving. Log and
exit non-zero.

**★ What happens by default without any handler?**
The process prints the error to stderr and exits 1 — including for unhandled
rejections, which have terminated the process by default since Node 15. Installing
a listener replaces that with "carry on", which is why the handler must exit
itself.

**★ Why does an Express 4 async route produce an unhandled rejection?**
The router calls the handler and ignores the returned promise, so a rejection has
no catcher. The response is never sent and the client hangs until it times out.
Express 5 and Fastify forward it to the error handler instead.

**★ What is `uncaughtExceptionMonitor` for?**
Observing a fatal error without suppressing Node's default termination. It is the
correct hook for crash reporters, because a monitor cannot accidentally turn a
crash into a zombie process.

**Is a full graceful drain the right thing to do in these handlers?**
It is a judgement call. The state is already suspect, so running more code can
compound the damage; whatever you choose must be bounded by a forced-exit timer so
a hung shutdown cannot keep a broken process alive.

**Why is `beforeExit` no good for cleanup?**
It only fires when the event loop empties naturally — not after `process.exit()`
and not after a fatal error, which are exactly the cases cleanup is for.

---

← Prev: [Graceful shutdown](17-graceful-shutdown.md) · Next → [child_process](19-child-process.md)
