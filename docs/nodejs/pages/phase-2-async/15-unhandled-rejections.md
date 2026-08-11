---
title: "unhandledRejection and uncaughtException"
sidebar_label: "15 · Unhandled rejections"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Unhandled rejections have
> been fatal by default since **Node 15**.

**The two process-level events that fire when an error escapes everything. Both are
crash reporters, not error handlers — treating either as a way to keep running is
how you get a corrupted process serving traffic.**

## The default is to crash, and that is correct

```js
// float.mjs
async function save(record) { throw new Error('db write failed'); }
save({ id: 1 });
setTimeout(() => console.log('THIS NEVER PRINTS'), 100);
```

```console
$ node float.mjs
Error: db write failed
    at save (file:///home/you/float.mjs:1:37)
$ echo $?
1
```

Before Node 15 this printed a warning and continued, which meant applications ran
for weeks in a state nobody understood. The current behaviour — exit code 1 — is
the right default: an error nobody handled means your assumptions are wrong, and
the safe move is to restart into a known state.

The flag `--unhandled-rejections=warn` restores the old behaviour. **Do not use it
to make a crash go away.** Use it, briefly, to inventory the damage in a legacy
codebase you are fixing.

## The two events

| | `unhandledRejection` | `uncaughtException` |
|---|---|---|
| Fires when | A rejected promise has no handler | A synchronous throw escapes all `try`/`catch` |
| Argument | `(reason, promise)` | `(err, origin)` |
| Default | Exit code 1 | Exit code 1 |
| State afterwards | Unknown | **Unknown, likely corrupt** |
| Safe to continue | No | Definitely not |

## What a handler is for

Logging, and a controlled shutdown. Nothing else.

```js
// shutdown.mjs — the shape every production service needs
process.on('unhandledRejection', (reason, promise) => {
  log.fatal({ err: reason }, 'unhandled rejection — shutting down');
  shutdown(1);
});

process.on('uncaughtException', (err, origin) => {
  log.fatal({ err, origin }, 'uncaught exception — shutting down');
  shutdown(1);
});

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;          // a second failure during shutdown must not loop
  shuttingDown = true;
  process.exitCode = code;

  const force = setTimeout(() => process.exit(code), 5000).unref();   // hard cap
  server.close(() => {               // stop accepting, drain in-flight
    db.end().finally(() => clearTimeout(force));
  });
}
```

Four things that make this correct:

1. **It logs before anything else** — the reason is the only artefact you get.
2. **It stops accepting new work** but lets in-flight requests finish.
3. **It has a hard timeout**, `unref()`ed so it cannot itself hold the process open.
4. **It is idempotent** — a failure *during* shutdown must not re-enter.

Pair it with `SIGTERM` handling, which is the same shutdown path for the planned
case — see [Phase 0 globals](../phase-0-runtime-model/06-globals.md).

## Why "log and continue" is wrong

The tempting version:

```js
// ❌ do not do this
process.on('uncaughtException', (err) => {
  log.error(err);            // and carry on
});
```

After an uncaught exception, some function stopped partway through. A lock is
still held, a transaction is open, a counter was incremented but not decremented,
a half-written file is on disk. The process keeps serving traffic with invariants
broken, and the bugs that follow have no relationship to the original error.

Crash and restart. A process manager — systemd, Kubernetes, pm2 — brings you back
in a clean state in milliseconds. That is what they are for.

The narrow exception is `unhandledRejection` in a job worker where each job is
isolated and you can reliably fail just that job. Even then, the fix belongs at the
call site.

## `rejectionHandled` — the late-handler case

A rejection can be handled *after* Node has already reported it:

```js
// late.mjs
const p = Promise.reject(new Error('late'));
process.on('unhandledRejection', () => console.log('reported as unhandled'));
process.on('rejectionHandled', () => console.log('...but a handler arrived later'));
setTimeout(() => p.catch(() => {}), 100);
```

```console
$ node late.mjs
reported as unhandled
...but a handler arrived later
```

This is why attaching `.catch()` in a later tick is a bad habit — Node has already
decided. Attach handlers at creation time.

## Gotchas

**Symptom:** The process exits 1 with a stack trace and no obvious trigger
**Cause:** A floating promise rejected somewhere. See
[floating promises](12-floating-promises.md).
**Fix:** Find the call site. `--trace-warnings` and the `promise` argument to the
handler help locate it.

**Symptom:** Adding `--unhandled-rejections=warn` "fixed" the crashes
**Cause:** It suppressed the report. The bugs are still there.
**Fix:** Revert it and fix the call sites.

**Symptom:** The process hangs during shutdown
**Cause:** The shutdown handler awaits something that never settles, with no
timeout.
**Fix:** A `setTimeout(...).unref()` hard cap that calls `process.exit`.

**Symptom:** Shutdown logs appear twice, or the handler re-enters
**Cause:** A second failure occurred while shutting down.
**Fix:** The `shuttingDown` guard.

**Symptom:** Nothing is logged before the process dies
**Cause:** `process.exit()` called immediately, abandoning buffered stdout.
**Fix:** Set `process.exitCode` and let the loop drain; only force-exit on the
timeout.

## Interview questions

**★ What happens to an unhandled promise rejection in modern Node?**
The process prints the reason and exits with code 1. This has been the default
since Node 15; before that it warned and continued. The old behaviour is available
via `--unhandled-rejections=warn`, which should only be used temporarily while
auditing legacy code.

**★ Should you use `uncaughtException` to keep the process running?**
No. After an uncaught exception a function was interrupted partway, so locks,
transactions and counters may be in an inconsistent state. The handler's job is to
log and start a controlled shutdown; a process manager restarts you clean.

**★ What does a correct crash handler do?**
Logs the error first, stops accepting new work, drains in-flight requests, and
enforces a hard timeout — `unref()`ed so it does not itself keep the process
alive. It must also be idempotent, since a failure during shutdown would otherwise
re-enter it.

**★ What is the difference between `unhandledRejection` and `uncaughtException`?**
The first fires when a rejected promise has no handler; the second when a
synchronous throw escapes every `try`/`catch`. Both are fatal by default and both
mean an error reached the top of the process without being dealt with.

**Why is attaching `.catch()` later a problem?**
Node decides a rejection is unhandled at the end of the current turn. A handler
attached in a later tick triggers `rejectionHandled`, but the process has already
reported — and by default exited. Attach handlers when the promise is created.

---

← Prev: [Concurrency control](14-concurrency-control.md) · Next → [Error design](16-error-design.md)
