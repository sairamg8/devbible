---
title: "AsyncLocalStorage"
sidebar_label: "20 · AsyncLocalStorage"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Stable since **Node 16**.

**Per-request context that follows your code through `await` without being passed
as an argument. It is how request IDs reach your logger without every function
signature growing a `ctx` parameter.**

## The problem

A request id needs to appear in every log line, including from a repository
function four layers down. The honest options are both bad: thread `ctx` through
every signature, or use a module-level variable — which is shared by all concurrent
requests and immediately wrong.

A module-level variable fails because Node interleaves requests: request A awaits a
query, request B overwrites the variable, A resumes with B's id.

## What it does

```js
// als.mjs
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

const als = new AsyncLocalStorage();

function log(msg) {
  const store = als.getStore();
  console.log(`[${store?.requestId ?? 'no-context'}] ${msg}`);
}

async function repository() { await sleep(5); log('db query'); }
async function service()    { log('service start'); await repository(); }

async function handle(requestId) {
  await als.run({ requestId }, async () => { await service(); log('done'); });
}

await Promise.all([handle('req-1'), handle('req-2')]);
log('outside any run()');
```

```console
$ node als.mjs
[req-1] service start
[req-2] service start
[req-1] db query
[req-1] done
[req-2] db query
[req-2] done
[no-context] outside any run()
```

Read that output carefully — it is the whole point. The two requests **interleave**
(`req-1` and `req-2` both start before either finishes), yet every line carries the
right id. Neither `service` nor `repository` takes a `requestId` parameter, and
`log` gets it from nowhere visible.

Outside any `run()`, `getStore()` returns `undefined`. Always handle that — the
`?.` and `??` above are not decoration.

## How it works

`als.run(store, fn)` runs `fn` with `store` attached to the **current async
context**. Node propagates that context across every async boundary: promises,
`await`, timers, I/O callbacks. When `repository` resumes after its `await`, it
resumes in the same context it suspended in.

The mechanism underneath is `async_hooks` — see
[page 21](21-async-hooks.md). You do not need to touch it.

## The realistic use: request context

```js
// pseudo-code for the middleware shape
const als = new AsyncLocalStorage();

app.use((req, res, next) => {
  als.run({ requestId: randomUUID(), userId: req.user?.id }, next);
});

// anywhere below, at any depth
export function log(level, msg) {
  const { requestId, userId } = als.getStore() ?? {};
  logger[level]({ requestId, userId }, msg);
}
```

One middleware, and every log line in the request is correlated. This is exactly
how OpenTelemetry, pino's request context and most APM agents propagate trace ids —
if you have used those, you have used `AsyncLocalStorage`.

The legitimate uses are narrow and they all look the same:

| Use | Why it fits |
|---|---|
| Request / trace ids for logging | Cross-cutting, needed everywhere, not domain data |
| Tenant or locale for a request | Same |
| The current DB transaction | So repositories join the caller's transaction |
| Auth principal for auditing | Read-only, ambient |

## When not to use it

**It is hidden state, and hidden state is harder to test, read and refactor.** The
line: use it for cross-cutting concerns that would pollute every signature; pass
real arguments for anything a function genuinely operates on.

If a function's behaviour depends on it, that dependency is invisible at the call
site and in its type signature. `getUser(id)` that silently reads a tenant from
ambient context is a function you cannot unit-test without setting up context, and
cannot reason about locally.

There is also a cost — enabling async context tracking makes async operations
measurably slower. It is small and worth it for tracing; it is not free, so do not
reach for it as a general dependency-injection mechanism.

## `enterWith` and `exit`

```js
als.enterWith(store);      // sets context for the REST of the current execution
```

`enterWith` sets the store without a callback, which sounds convenient and is a
common source of bugs: it leaks into everything that follows in the same async
context, with no scope you can see. **Prefer `run()`**, which has clear
boundaries. `enterWith` exists for framework integration points where no callback
is available.

`als.exit(fn)` runs `fn` outside any store — occasionally useful for background
work that should not inherit a request's context.

## Gotchas

**Symptom:** `getStore()` returns `undefined` in some code paths
**Cause:** That code runs outside `run()` — module top level, an interval created
at startup, or a callback registered before the context existed.
**Fix:** Handle `undefined`. If it should have context, move the registration
inside `run()` or bind it — [`AsyncResource.bind`](21-async-hooks.md).

**Symptom:** Context is lost inside an `EventEmitter` listener
**Cause:** Listeners run in the context of the **`emit`**, not of registration.
**Fix:** `AsyncResource.bind(listener)` — demonstrated on
[page 21](21-async-hooks.md).

**Symptom:** Context is lost after a third-party library's callback
**Cause:** The library uses its own queue or a native binding that does not
propagate context.
**Fix:** Capture what you need before calling in, or bind the callback.

**Symptom:** Requests see each other's context
**Cause:** `enterWith` used where `run()` was needed, so the store leaked past its
intended scope.
**Fix:** Use `run()`.

**Symptom:** Mutating the store from one place affects another request
**Cause:** The same object was passed to multiple `run()` calls.
**Fix:** A fresh object per request.

## Interview questions

**★ What problem does `AsyncLocalStorage` solve?**
Carrying per-request context — a request id, a tenant, a transaction — through
deeply nested async calls without adding a parameter to every signature. A
module-level variable cannot do it, because concurrent requests interleave and
would overwrite each other.

**★ How does it survive an `await`?**
Node tracks the current async context and restores it whenever an async operation
resumes, using `async_hooks` underneath. Code that continues after `await` resumes
in the context it suspended in, so `getStore()` still returns the right store.

**★ When should you not use it?**
For data a function genuinely operates on. It is ambient hidden state, so it makes
dependencies invisible at the call site and harder to test. Restrict it to
cross-cutting concerns like tracing and logging, and pass real arguments otherwise.

**★ Why is context lost in an `EventEmitter` listener?**
The listener runs in the async context of whoever called `emit`, not the context in
which it was registered. `AsyncResource.bind` captures the registration context so
the listener runs in it.

**What is the difference between `run()` and `enterWith()`?**
`run(store, fn)` scopes the store to `fn` and its async descendants. `enterWith`
sets it for the remainder of the current async context with no visible boundary,
which leaks easily. Prefer `run()`.

---

← Prev: [AbortController](19-abortcontroller.md) · Next → [async_hooks](21-async-hooks.md)
