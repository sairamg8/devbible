---
title: "async_hooks and AsyncResource"
sidebar_label: "21 · async_hooks"
sidebar_position: 21
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-10-08 on **Node 24.19.0** (LTS) against
> [Async hooks](https://nodejs.org/api/async_hooks.html),
> [Async context](https://nodejs.org/api/async_context.html),
> the [24.0.0 release notes](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md),
> [CLI `--no-async-context-frame`](https://github.com/nodejs/node/blob/v24.19.0/doc/api/cli.md)
> and the sources `lib/async_hooks.js` and `lib/internal/async_local_storage/async_hooks.js`
> at v24.19.0 (the same `init` hook is in v22.22.0). `async_hooks` is
> **Stability 1 – Experimental** and has been for years; `AsyncResource` and
> `AsyncLocalStorage` are the stable parts. Re-checked 2026-10-08: the opening
> paragraph, "The model", the `EventEmitter` quote and the three interview answers that
> mention `AsyncLocalStorage`. **No sandbox run** — the listings and their `console` blocks are unchanged
> from the 2026-08 revision and were not re-run.

**The older, lower-level async-tracking API. Until Node 24 it was the machinery
underneath `AsyncLocalStorage`; since 24.0.0 `AsyncLocalStorage` no longer uses it
by default. You will almost never use the hooks directly — but `AsyncResource.bind`
is the fix for the most common context-loss bug, and the reason it is needed explains
why context is lost at all: a callback that something else invokes later runs in the
invoker's context, not in the one where you registered it.**

## The model

Every async operation in Node gets an **async id** and a **trigger id** — the id of
the operation that created it. Together they form a tree, and that tree is what
`async_hooks` reports to hooks. The hook-based `AsyncLocalStorage` (what v22.22.0
ships by default, and what `--no-async-context-frame` falls back to on Node 24) does
not follow the trigger ids: its `init` hook never reads `triggerAsyncId`, and instead
copies the store from `executionAsyncResource()` — the resource executing at the
moment the new one is created — onto each new resource. On Node 24 the default
`AsyncLocalStorage` uses neither hooks nor ids; it carries an `AsyncContextFrame`
instead (see [page 20](20-asynclocalstorage.md)).

```js
// hooks.mjs
import { executionAsyncId, triggerAsyncId } from 'node:async_hooks';

console.log('top-level executionAsyncId:', executionAsyncId());
setTimeout(() => console.log('inside timer  execId:', executionAsyncId(), 'triggerId:', triggerAsyncId()), 5);
```

```console
$ node hooks.mjs
top-level executionAsyncId: 0
inside timer  execId: 3 triggerId: 0
```

The timer callback runs in its own async context (`3`), triggered by the top-level
one (`0`) — the top-level code is what scheduled the timer. The docs gloss an
`executionAsyncId()` of `0` as *"being executed from C++ with no JavaScript stack
above it"*. Their own `executionAsyncId()` sample comments its top-level call
`// 1 - bootstrap` (in the CommonJS tab and the ES-module tab alike), while the
ES-module listing above records `0`. This block predates this pass and was not
re-run, so rely on the relationship between the two ids rather than on either
absolute number.

In its hook-based implementation, `AsyncLocalStorage` keeps its store on the async
*resources* this machinery creates; the `init` hook copies it from the executing
resource onto each new one. On Node 24 that is no longer the default: the store
travels in an `AsyncContextFrame`. For the `EventEmitter` case in the next section,
the Node docs state the hazard without tying it to either implementation:

> *"Event listeners triggered by an `EventEmitter` may be run in a different
> execution context than the one that was active when `eventEmitter.on()` was
> called."*
> — [async_context.md, "Integrating `AsyncResource` with `EventEmitter`"](https://nodejs.org/api/async_context.html#integrating-asyncresource-with-eventemitter)

This page claims only the listener-and-`bind` case. For other flows the CLI docs
leave room: the old model is kept *"for cases where the context flow may differ"*.

The four lifecycle hooks are `init`, `before`, `after` and `destroy`, registered
with `createHook`. **Do not use them in application code.** They fire for every
async operation, they cost real performance, and `console.log` inside one recurses
infinitely because logging is itself async. They exist for APM vendors.

## `AsyncResource.bind` — the useful part

Context is attached where a callback *runs*, not where it is registered. For an
`EventEmitter`, that means the context of whoever called `emit`:

```js
// hooks.mjs (continued)
import { AsyncResource, AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';

const als = new AsyncLocalStorage();
const ee = new EventEmitter();

als.run({ requestId: 'req-9' }, () => {
  ee.on('plain', () => console.log('plain listener  →', als.getStore()?.requestId ?? 'LOST'));
  ee.on('bound', AsyncResource.bind(() => console.log('bound listener  →', als.getStore()?.requestId ?? 'LOST')));
});

setTimeout(() => { ee.emit('plain'); ee.emit('bound'); }, 10);
```

```console
plain listener  → LOST
bound listener  → req-9
```

Both listeners were registered **inside** `als.run`, so intuition says both should
see `req-9`. Only the bound one does. The plain listener runs synchronously inside
`emit`, which happens in the timer's context — where there is no store.

`AsyncResource.bind(fn)` captures the async context at bind time and restores it
whenever `fn` runs. That one line is the fix for the overwhelming majority of
"my request id disappeared" bugs.

## When you need `new AsyncResource`

If you write a pool, a queue or a scheduler that holds callbacks and runs them
later, the context is broken for the same reason — and `bind` handles most of it:

```js
// pseudo-code: a queue that preserves each caller's context
class ContextQueue {
  #jobs = [];
  push(fn) { this.#jobs.push(AsyncResource.bind(fn)); }   // capture at push time
  async drain() { for (const job of this.#jobs) await job(); }
}
```

The fuller form — `new AsyncResource('MyQueue')` plus `runInAsyncScope` — also
makes your operation visible to diagnostic tooling under a name you choose. That
matters if you are writing a library others will profile; for application code,
`bind` is enough.

## Why you are told not to use `createHook`

| Reason | Detail |
|---|---|
| Experimental | Stability 1 for years; the API has changed before |
| Performance | Hooks fire for **every** async operation, in a hot path |
| Recursion | `console.log` inside a hook triggers async work, which triggers the hook |
| Better options exist | `AsyncLocalStorage` for context, `diagnostics_channel` for instrumentation |

For instrumenting your own code, `node:diagnostics_channel` is the supported
mechanism — named channels you publish to and subscribers listen on, with near-zero
cost when nobody is subscribed.

## Gotchas

**Symptom:** Context lost inside an `EventEmitter` listener
**Cause:** Listeners run in the context of `emit`.
**Fix:** `AsyncResource.bind(listener)` at registration.

**Symptom:** Context lost in callbacks stored by a pool or queue
**Cause:** The callback runs later, in the context of whatever drains the queue.
**Fix:** `AsyncResource.bind` when the callback is stored.

**Symptom:** The process hangs or output floods after adding `createHook`
**Cause:** `console.log` inside a hook — logging is async, so the hook re-enters.
**Fix:** Write with `fs.writeSync(1, ...)`, or do not use hooks.

**Symptom:** Throughput drops noticeably after adding tracing
**Cause:** `createHook` runs on every async operation.
**Fix:** `diagnostics_channel`, or an APM agent that has already paid for this
carefully.

**Symptom:** Context is lost across a third-party library's callback
**Cause:** A native binding or custom queue that does not propagate context.
**Fix:** Bind the callback before handing it over, or capture the values you need
first.

## Interview questions

**★ What is `AsyncResource.bind` for?**
Capturing the current async context and restoring it when a callback later runs. It
is the fix for context loss in `EventEmitter` listeners and in queues or pools that
store callbacks and invoke them later.

**★ Why is `AsyncLocalStorage` context lost in an event listener?**
Because the listener executes inside the `emit` call, in whatever async context the
emitter was triggered from — not the context where it was registered. The store
travels with the current async context (an `AsyncContextFrame` on Node 24, a value
on the executing async resource under the `--no-async-context-frame` fallback), and
`emit` runs in a different one.

**★ Should you use `async_hooks.createHook` in application code?**
No. It is experimental, it fires on every async operation so it is expensive, and
logging inside a hook recurses. Use `AsyncLocalStorage` for context and
`diagnostics_channel` or an APM agent for instrumentation.

**★ What are `executionAsyncId` and `triggerAsyncId`?**
The id of the async context currently executing, and the id of the context that
created it. They form the tree `async_hooks` reports to hooks. `AsyncLocalStorage`
does not walk that tree even where it is built on `async_hooks` (v22.22.0's default,
Node 24's `--no-async-context-frame` fallback): its `init` hook never reads
`triggerAsyncId`, and copies the store from `executionAsyncResource()` — the resource
executing when the new one is created — onto the new resource. On Node 24 the default
implementation needs neither the hooks nor the ids to work across `await`.

**How does `AsyncLocalStorage` relate to `async_hooks`?**
It lives in the `node:async_hooks` module and shares `AsyncResource` with it, but
on Node 24 it is no longer built on the hooks. Before 24.0.0 it relied on
`async_hooks` by default (Node 22.7+ also had an opt-in
`--experimental-async-context-frame` that selected the `AsyncContextFrame`
implementation); the fallback implementation still in the v24.19.0 tree
(`internal/async_local_storage/async_hooks.js`) registers a `createHook` `init`
callback that propagates the store from the current resource to each new one. Since
24.0.0 the default is `AsyncContextFrame`, and the hook-based implementation is the
fallback behind `--no-async-context-frame` (*"retained for compatibility with
Electron and for cases where the context flow may differ"*). You call
`run`/`getStore` either way, not lifecycle callbacks.

---

← Prev: [AsyncLocalStorage](20-asynclocalstorage.md) · Next → [CPU-bound work](22-cpu-bound-work.md)
