---
title: "async_hooks and AsyncResource"
sidebar_label: "21 · async_hooks"
sidebar_position: 21
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). `async_hooks` is
> **Stability 1 – Experimental** and has been for years; `AsyncResource` and
> `AsyncLocalStorage` are the stable parts.

**The machinery underneath `AsyncLocalStorage`. You will almost never use the hooks
directly — but `AsyncResource.bind` is the fix for the most common context-loss
bug, and knowing the model explains why context is lost at all.**

## The model

Every async operation in Node gets an **async id** and a **trigger id** — the id of
the operation that created it. Together they form a tree, and that tree is what
context propagation walks.

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
one (`0`). `AsyncLocalStorage` is a store hung off exactly this tree — which is why
it survives `await`, and why it is lost anywhere the tree is broken.

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
emitter was triggered from — not the context where it was registered. The store is
attached to the async context tree, and `emit` is a different branch.

**★ Should you use `async_hooks.createHook` in application code?**
No. It is experimental, it fires on every async operation so it is expensive, and
logging inside a hook recurses. Use `AsyncLocalStorage` for context and
`diagnostics_channel` or an APM agent for instrumentation.

**★ What are `executionAsyncId` and `triggerAsyncId`?**
The id of the async context currently executing, and the id of the context that
created it. They form the tree Node uses to propagate async context, which is what
makes `AsyncLocalStorage` work across `await`.

**How does `AsyncLocalStorage` relate to `async_hooks`?**
It is the stable, supported abstraction built on top of it. The hooks track the
async context tree; `AsyncLocalStorage` hangs a store off that tree and gives you
`run`/`getStore` instead of lifecycle callbacks.

---

← Prev: [AsyncLocalStorage](20-asynclocalstorage.md) · Next → [CPU-bound work](22-cpu-bound-work.md)
