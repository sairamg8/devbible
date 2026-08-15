---
title: "01 · Starting a worker and talking to it"
sidebar_label: "01 · Starting and talking"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Worker`](https://developer.mozilla.org/en-US/docs/Web/API/Worker), [`Worker()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker), [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [`DedicatedWorkerGlobalScope`](https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope), [Functions available to workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers), [`WorkerGlobalScope.importScripts()`](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts). Documentation-validated; **no timings and no console output**.

A worker is a **second JavaScript realm with its own event loop**, running in parallel with the
page. It shares no variables, no DOM and no memory with the main thread — the only channel is
messages. That isolation is the whole design: it is why a worker cannot make your UI
inconsistent, and why moving work into one is never as simple as calling a function.

## Starting one

```js
const worker = new Worker(new URL('./search.worker.js', import.meta.url), {
  type: 'module',
  name: 'search',          // shows up in DevTools — worth setting
});
```

🔴 **`new URL('./x.js', import.meta.url)` is the idiom, not a string path.** A bare
`new Worker('./search.worker.js')` resolves against the *document's* URL, so it breaks on any
route that is not at the root, and bundlers cannot see it. The `URL` form is what Vite, webpack
and esbuild all recognise as "bundle this as a worker entry".

**`type: 'module'`** gives the worker `import`/`export`. Without it the worker is a *classic*
script and pulls dependencies with `importScripts('a.js', 'b.js')`, which loads synchronously and
throws inside a module worker. New code should be a module worker; `importScripts` is the legacy
path ([Phase 8 · 01 · ES modules](../../phase-8-modules-errors/01-es-modules/README.md)).

⚠️ **The worker script must be same-origin.** A cross-origin URL throws a `SecurityError`. The
standard workaround is to fetch the code and start the worker from a `blob:` URL — which is also
how a worker gets written inline, and which a strict CSP (`worker-src`) may block.

## Inside: what exists and what does not

```js
// search.worker.js
self.onmessage = (e) => {
  const results = search(e.data.query);
  self.postMessage({ results });
};
```

| Not available | Available |
|---|---|
| `window`, `document`, the DOM | `self`, `fetch`, `WebSocket`, `XMLHttpRequest` |
| `alert`, `localStorage` | `indexedDB`, `caches`, `crypto` (including `subtle`) |
| Anything that paints | timers, `performance`, `structuredClone`, `TextEncoder` |
| Direct access to page variables | `OffscreenCanvas`, `WebAssembly`, `importScripts` (classic) |

🔴 **No DOM, and that is not a limitation to work around.** A worker that needs the DOM is a
worker in the wrong place: send it data, get data back, and let the main thread render. The one
exception is `OffscreenCanvas`, which is explicitly transferable so that drawing can happen off
the main thread.

**`localStorage` is unavailable on purpose** — it is synchronous, and a second thread blocking on
it would deadlock the page. Workers get `indexedDB`, which is asynchronous.

## The channel

```js
worker.postMessage({ type: 'search', query });     // main → worker
worker.onmessage = (e) => render(e.data);          // worker → main
```

Both sides use the same two calls. **Messages are queued and delivered as tasks** on the
receiving side's event loop, so a busy worker does not deliver until its current task ends —
a worker stuck in a long synchronous loop is exactly as unresponsive as a blocked main thread,
it just does not freeze the UI.

`worker.addEventListener('message', …)` works too, and is what you want when several parts of the
app listen — `onmessage` has one slot and the second assignment silently wins.

### Errors cross the boundary badly

```js
worker.onerror = (e) => report(e.message, e.filename, e.lineno);   // uncaught error in the worker
worker.onmessageerror = () => report('a message could not be deserialised');
```

⚠️ **An `Error` thrown inside a worker does not reject anything on the main thread.** You get an
`ErrorEvent` with a message and a location — no stack you can rely on, and no association with
the message that caused it. **Catch inside the worker and post the failure as data:**

```js
self.onmessage = async (e) => {
  try   { self.postMessage({ id: e.data.id, ok: true, value: await work(e.data) }); }
  catch (err) { self.postMessage({ id: e.data.id, ok: false, error: String(err) }); }
};
```

**`messageerror`** fires when something arrived that could not be deserialised — rare, and almost
always a sign that something unclonable was sent ([02 · The message boundary](./02-the-message-boundary.md)).

## Request and response over a one-way channel

`postMessage` has no reply. Every real worker wrapper adds an id and a pending map:

```js
const pending = new Map();
let nextId = 0;

worker.addEventListener('message', ({ data }) => {
  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);
  data.ok ? entry.resolve(data.value) : entry.reject(new Error(data.error));
});

function call(payload, { signal } = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    signal?.addEventListener('abort', () => { pending.delete(id); reject(signal.reason); });
    worker.postMessage({ id, ...payload });
  });
}
```

🔴 **Aborting removes the pending entry; it does not stop the worker.** The worker finishes the
work and posts a result nobody is waiting for. Real cancellation means either checking a flag
between chunks inside the worker, or `terminate()` — see
[03 · Deciding and using them well](./03-deciding-and-patterns.md).

**`MessageChannel` is the tidier version** when two parties need a private pipe — including two
workers talking to each other without routing through the page. Send one `MessagePort` across
(it is transferable) and both ends have a direct channel.

## Ending one

```js
worker.terminate();     // from the page: immediate, no cleanup, no final message
self.close();           // from inside: finishes the current task, then stops
```

**`terminate()` is a hard stop.** It is the one true cancellation a worker offers — the thread
dies mid-loop, which is precisely why long CPU work in a worker is cancellable and the same work
on the main thread is not.

⚠️ **A worker is not garbage-collected because you dropped the reference.** It has its own
realm, its own timers and possibly open connections. Terminate it explicitly when the feature is
gone; a route change that leaves five workers running is a leak the profiler will not obviously
show ([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).

## The three kinds

| Kind | Scope | Use |
|---|---|---|
| **Dedicated** (`new Worker`) | one page, one worker | almost everything — this topic |
| **Shared** (`SharedWorker`) | several tabs of the same origin, via `port` | one connection or cache shared across tabs |
| **Service worker** | intercepts network, survives the page | offline, caching — **Phase 11 · 17** *(not written yet)* |

`SharedWorker` needs `port.start()` and has thinner support and much thinner tooling; for
cross-tab coordination, `BroadcastChannel` and Web Locks are usually the better answer
(**15 · Cross-tab coordination** *(not written yet)*).

## Gotchas

**Symptom: the worker 404s on a nested route.**
Cause — a relative string path resolved against the document URL.
Fix — `new URL('./x.worker.js', import.meta.url)`, which also lets the bundler find it.

**Symptom: `importScripts is not defined`.**
Cause — it does not exist in a module worker.
Fix — use `import`; or drop `type: 'module'` if the code really is a classic script.

**Symptom: a `SecurityError` when constructing the worker.**
Cause — the script URL is cross-origin.
Fix — serve it from your own origin, or fetch and start it from a `blob:` URL — and check
`worker-src` in the CSP.

**Symptom: an error in the worker disappears.**
Cause — nothing was listening on `worker.onerror`, and errors do not reject the caller's promise.
Fix — try/catch inside the worker, post failures as data, and keep an `onerror` for the rest.

**Symptom: only the last of several message listeners runs.**
Cause — `onmessage` is a single slot.
Fix — `addEventListener('message', …)`.

**Symptom: workers accumulate as the user navigates a single-page app.**
Cause — nothing terminated them; dropping the reference is not enough.
Fix — `terminate()` in the teardown path.

**Symptom: `localStorage is not defined` inside the worker.**
Cause — synchronous storage is deliberately not exposed to workers.
Fix — `indexedDB`, or keep the storage on the main thread and pass data.

## Interview questions

**★ What is a Web Worker, and what does it share with the page?**
A second JavaScript realm with its own event loop, running in parallel. It shares nothing —
no DOM, no `window`, no variables, no memory (short of `SharedArrayBuffer`). Communication is
messages, which is what makes the isolation safe.

**★ Why can a worker not touch the DOM?**
Because the DOM is not thread-safe and the platform will not make it so. A worker's job is
computation; rendering stays where the DOM lives. `OffscreenCanvas` is the deliberate exception.

**★ How do you get a reply to a `postMessage`?**
You build it: tag each message with an id, keep a map of pending promises, and resolve by id when
the worker posts back. `MessageChannel` gives a private port pair when you need a dedicated
channel.

**★ How do errors from a worker reach the page?**
Badly, by default — an uncaught error surfaces as an `ErrorEvent` on `worker.onerror` with no
usable stack and no link to the request. Catch inside the worker and post the failure as a normal
message.

**★ How do you cancel work already running in a worker?**
`terminate()` — the only true cancellation, since it kills the thread mid-task. Anything gentler
means the worker checking a flag between chunks of its own work.

**When would you reach for a `SharedWorker`?**
When several tabs of one origin genuinely need to share one instance — a single socket, one
in-memory cache. For most cross-tab needs `BroadcastChannel` or Web Locks are simpler and better
supported.

---

[Topic index](./README.md) · [02 · The message boundary](./02-the-message-boundary.md) →
