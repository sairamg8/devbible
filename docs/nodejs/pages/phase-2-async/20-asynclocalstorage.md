---
title: "AsyncLocalStorage"
sidebar_label: "20 · AsyncLocalStorage"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-10-08 on **Node 24.19.0** (LTS) against
> [Async context](https://nodejs.org/api/async_context.html),
> [CLI `--no-async-context-frame`](https://github.com/nodejs/node/blob/v24.19.0/doc/api/cli.md),
> the [24.0.0 release notes](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md),
> [CLI `--experimental-async-context-frame`](https://github.com/nodejs/node/blob/v22.22.0/doc/api/cli.md) (v22.22.0)
> and the v24.19.0 sources `lib/async_hooks.js`, `lib/internal/async_context_frame.js`
> and `lib/internal/async_local_storage/{async_context_frame,async_hooks}.js`.
> Stable since **Node 16**. Re-checked 2026-10-08: "How it works", the scoped note and the
> "How does it survive an `await`?" answer. **No sandbox run** — the `als.mjs` listing and
> its `console` block are unchanged from the 2026-08 revision and were not re-run.

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

**On Node 24 the mechanism underneath is not `async_hooks`.** The 24.0.0 release
notes:

> *"`AsyncLocalStorage` now uses `AsyncContextFrame` by default, which provides a
> more efficient implementation of asynchronous context tracking. This change
> improves performance and makes the API more robust for advanced use cases."*
> — [CHANGELOG_V24.md, 24.0.0](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md)

In the v24.19.0 source, `require('node:async_hooks').AsyncLocalStorage` is a getter
that picks one of two implementations: `internal/async_local_storage/async_context_frame`
when `AsyncContextFrame.enabled`, otherwise `internal/async_local_storage/async_hooks`.
The default implementation keeps no hook and no asyncId tree. It stores a **frame**
— a `Map` of store to value, copied from the current frame with your entry set — in
V8's continuation-preserved embedder data (the binding calls are named
`getContinuationPreservedEmbedderData` and `setContinuationPreservedEmbedderData`):

```js
// pseudo-code, abridged from lib/internal/async_local_storage/async_context_frame.js (v24.19.0)
enterWith(data) {
  const frame = new AsyncContextFrame(this, data); // current frame + this store's entry
  AsyncContextFrame.set(frame);                    // install as the current frame
}
run(data, fn, ...args) {
  const prior = this.getStore();
  this.enterWith(data);
  try { return fn(...args); } finally { this.enterWith(prior); }
}
getStore() { return AsyncContextFrame.current()?.get(this); }
```

The prior, `createHook`-based implementation is the fallback. From the CLI docs
(`--no-async-context-frame`, added v24.0.0):

> *"Disables the use of `AsyncLocalStorage` backed by `AsyncContextFrame` and uses
> the prior implementation which relied on async_hooks. The previous model is
> retained for compatibility with Electron and for cases where the context flow
> may differ. However, if a difference in flow is found please report it."*
> — [cli.md, v24.19.0](https://github.com/nodejs/node/blob/v24.19.0/doc/api/cli.md)

That is a change of **default**, not the first appearance of the implementation. On
Node 22.7 and later it was opt-in through `--experimental-async-context-frame`, so
"relied on `async_hooks`" describes the *default* before 24.0.0 and nothing more:

> *"Enables the use of `AsyncLocalStorage` backed by `AsyncContextFrame` rather than
> the default implementation which relies on async_hooks. This new model is
> implemented very differently and so could have differences in how context data
> flows within the application."*
> — [cli.md, v22.22.0](https://github.com/nodejs/node/blob/v22.22.0/doc/api/cli.md)
> (`--experimental-async-context-frame`, added v22.7.0)

The v24.19.0 `cli.md` has no entry for that flag; it documents
`--no-async-context-frame` instead.

What this changes for you: the API (`run`, `getStore`, `enterWith`, `exit`) is the
same, and the docs name no intended behaviour change — only that the flow "may
differ" in some cases and should be reported. What changed is internal: the store
is no longer copied onto each new async resource by an `async_hooks` `init` hook.
[Page 21](21-async-hooks.md) covers that API and why `AsyncResource.bind` still
matters.

**Scoped note, because Node 26 becomes LTS on 2026-10-28.** `--no-async-context-frame`
is still documented in `cli.md` at v25.0.0 and at every v26 tag checked (v26.0.0,
v26.1.0, v26.3.0, v26.5.0, v26.8.0, v26.11.1). It is absent from the `main` branch
docs, whose `node_version.h` is 27.0.0, and `main`'s `async_context_frame.js` has no
enabled check. The release notes that removed the opt-out were not found, so do
not build on the flag outside Node 24.

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

There is also a cost question, and the documentation gives no number for it. The
Node docs call `AsyncLocalStorage` *"a performant and memory safe implementation
that involves significant optimizations that are non-obvious to implement"*, and
the 24.0.0 notes call the `AsyncContextFrame` implementation more efficient than
the old one — neither publishes a benchmark. Measure on your own workload, and do
not reach for it as a general dependency-injection mechanism: the reason is hidden
state, not speed.

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
resumes. On Node 24 that context is an `AsyncContextFrame` held in V8's
continuation-preserved embedder data; the `async_hooks`-based implementation is
only the fallback behind `--no-async-context-frame`. Code that continues after
`await` resumes in the context it suspended in, so `getStore()` still returns the
right store.

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
