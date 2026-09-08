---
title: "postMessage looks like a function call but is actually a structured-clone copy across a thread boundary, and that cost is the real reason Transferables and SharedWorker's port model exist"
sidebar_label: "01b · Shared workers & messaging"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Features](https://vite.dev/guide/features); MDN — [`SharedWorker`](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ SharedWorker's port model, messaging costs, and worker lifecycle

**A dedicated worker and a `SharedWorker` are not the same primitive with a shared-vs-not-shared flag — a `SharedWorker` has an entirely different connection model, `postMessage` between any of these contexts always defaults to a structured-clone copy rather than a reference, and neither Vite's `?worker`/`?sharedworker` bundling nor its docs change any of that platform behaviour.** This page is about what happens *after* the import — the parts that are unrelated to bundling and entirely about how the browser's worker and messaging primitives actually behave, because Vite's job stopped at "here is a constructor" and everything past that point is standard Web Workers API, not a Vite feature.

## SharedWorker: one instance, many ports, not many instances

A dedicated `Worker` (via `?worker`) is 1:1 — one script instance per `new Worker()` call, owned by whatever created it. A `SharedWorker` is fundamentally different: multiple browsing contexts (tabs, iframes, windows) that construct a `SharedWorker` against the **same script URL and same origin** connect to the **same running worker instance**, each getting its own `MessagePort` to talk to it.

```typescript
// sync.sharedworker.ts — one instance, connected to by every tab that opens it
const clients = new Set<MessagePort>();

onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  clients.add(port);

  port.addEventListener('message', (e: MessageEvent<{ type: 'broadcast'; payload: unknown }>) => {
    if (e.data.type === 'broadcast') {
      for (const client of clients) {
        if (client !== port) client.postMessage(e.data.payload);
      }
    }
  });

  port.start(); // ports created via `onconnect` start paused — required before messages flow
};
```

```typescript
// tab-side usage — via Vite's ?sharedworker suffix
import SyncWorker from './sync.sharedworker.ts?sharedworker';

const worker = new SyncWorker();
worker.port.start(); // the constructing side must ALSO call start() — it is not implicit either side
worker.port.postMessage({ type: 'broadcast', payload: { cartUpdated: true } });
worker.port.onmessage = (e) => applyRemoteUpdate(e.data);
```

The connection model, quoted from MDN, is exactly this two-sided handshake: the worker side receives each new tab as an `onconnect` event carrying a `MessagePort` in `event.ports[0]`, and the constructing side talks through `sharedWorkerInstance.port`, not through the `SharedWorker` object itself — this is the detail people miss coming from `?worker`, where the constructed instance *is* the thing you call `postMessage` on.

> *"SharedWorker constructors are **not exposed in `DedicatedWorkerGlobalScope`**"* — a `SharedWorker` cannot be created from inside a dedicated worker.

## SharedWorker lifetime — it outlives any single tab

> *"A shared worker will remain alive as long as any open page holds a reference to it."*

This is the entire point of choosing `SharedWorker` over a per-tab `Worker`: state (an in-memory cache, a websocket connection, a lock coordinating writes across tabs) survives a tab closing, as long as at least one other tab is still connected. It also means a `SharedWorker` does **not** die the instant the tab that first created it closes — a common wrong mental model carried over from dedicated workers, where the creating context *is* the only context, so closing it ends the worker.

MDN also documents an `extendedLifetime` constructor option to keep the worker alive briefly *after* the last connected page closes, specifically to let it finish cleanup:

> *"The `extendedLifetime` constructor option can be set to keep a shared worker alive for a short period after all references are closed. This allows the worker to perform any cleanup tasks, such as writing state information to storage, or sending analytics data back to servers."*

⚠️ MDN documents `SharedWorker` as **Baseline "newly available"** with a caveat that *"some parts of this feature may have varying levels of support"* across devices and browser versions — check the exact browsers your app must support before relying on it as a cross-tab primitive for anything load-bearing.

## `postMessage` copies by default — Transferables are the opt-out

Every message across a worker boundary — dedicated or shared — goes through the **structured clone algorithm** by default, which means `postMessage` is not "pass a reference," it is "serialize, copy, deserialize on the other side." For a large `ArrayBuffer` (image data, an audio buffer, a large typed array), that copy is real work and real memory duplication on every single call.

> *"Transferable objects are objects that own resources that can be transferred from one context to another, ensuring that the resources are only available in one context at a time. Following a transfer, the original object is no longer usable"* — [MDN, Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)

Passing the transfer list as `postMessage`'s second argument moves ownership of the listed resources instead of copying them:

```typescript
// image-filter.worker.ts
self.onmessage = (event: MessageEvent<{ pixels: ArrayBuffer; width: number; height: number }>) => {
  const filtered = applyExpensiveFilter(event.data.pixels, event.data.width, event.data.height);
  // transfer the OUTPUT buffer back — no second copy of the (potentially large) result
  self.postMessage({ result: filtered }, [filtered]);
};

function applyExpensiveFilter(pixels: ArrayBuffer, width: number, height: number): ArrayBuffer {
  const view = new Uint8ClampedArray(pixels);
  // ... in-place pixel processing on `view`, backed by `pixels` ...
  return pixels;
}
```

```typescript
// main thread — transfer the SOURCE buffer into the worker
import ImageFilterWorker from './image-filter.worker.ts?worker';

const worker = new ImageFilterWorker();
const pixels = new Uint8ClampedArray(sourceImageData.data.buffer).buffer;

worker.postMessage({ pixels, width: sourceImageData.width, height: sourceImageData.height }, [pixels]);
// `pixels` is now a detached ArrayBuffer on the MAIN thread — any read/write throws.
// This is documented behaviour: "Following a transfer, the original object is no
// longer usable; it no longer points to the transferred resource, and any attempt
// to read or write the object will throw an exception."
```

`ArrayBuffer` and `MessagePort` are the two you reach for most; MDN's list of transferable types also includes `OffscreenCanvas`, `ImageBitmap`, `ReadableStream`, `WritableStream`, `TransformStream`, `MediaStreamTrack`, `VideoFrame`, and `AudioData` — worth checking before assuming a large object you're passing has no transfer option at all.

## Nested workers — the documentation does not address this

Vite's [Features](https://vite.dev/guide/features) page does not mention nested workers anywhere — a worker whose own source imports `?worker` and constructs another worker from inside itself. Reasoning only from the documented mechanism (each `?worker`/`?sharedworker`/`new URL(new Worker(...))` site is independently detected and given its own build entry point, regardless of which file it appears in), there is no stated reason the detection wouldn't also fire inside a worker's own source file — but this is **not confirmed by the documentation**, and should be treated as unverified rather than assumed safe for a production dependency. If nested workers matter to your architecture, test the specific Vite version and browser combination rather than relying on this page or the official docs to have settled it either way.

## Workers under SSR / Node

Vite's own coverage of Node-runtime behaviour for this feature area is written for WebAssembly specifically, not workers — see [01c](01c-webassembly-imports.md) for the `node:fs`-based SSR restriction on `.wasm` imports. The docs do not separately state a Node-specific restriction for `?worker` imports themselves; `node:worker_threads` is Node's own worker primitive and is a different API surface from the DOM `Worker`/`SharedWorker` used in this page — a `?worker`-imported file that calls `postMessage`/`onmessage` against the browser `Worker` API is not directly portable to `node:worker_threads`, which uses `parentPort` and a different event model. If your SSR entry needs to spin up background work, that is an argument for reaching for `node:worker_threads` directly in server-only code, not for trying to make a `?worker` import behave identically on both sides.

## `terminate()` and the leaks that happen without it

A `Worker` (dedicated) has a `.terminate()` method that stops it immediately, discarding any in-flight work. A `SharedWorker` does **not** expose `terminate()` on the constructing side at all — a connecting tab can only close its own port (`port.close()`), because the worker is, by design, not owned by any single connection.

```typescript
// ✅ dedicated worker — the owner is responsible for cleanup
function useImageFilter() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new ImageFilterWorker();
    workerRef.current = worker;
    return () => worker.terminate(); // 🔴 without this, the worker outlives the component
  }, []);
}
```

```typescript
// ✅ shared worker — close YOUR port; do not try to terminate the shared instance
function useSyncWorker() {
  const portRef = useRef<MessagePort | null>(null);

  useEffect(() => {
    const worker = new SyncWorker();
    worker.port.start();
    portRef.current = worker.port;
    return () => portRef.current?.close(); // releases this tab's connection only
  }, []);
}
```

A dedicated worker created and never terminated is a genuine leak: the worker keeps running, keeps its own JS heap alive, and keeps any timers or open connections (a websocket, a `setInterval`) it created alive too, entirely independent of whether the component or code that spawned it still exists. React's `StrictMode` double-invoking effects in development is a common way this surfaces — two workers get created, only one reference is kept, and the first is now unreachable but still running.

## Gotchas

**★ Symptom: calling `sharedWorkerInstance.postMessage(...)` throws `TypeError: sharedWorkerInstance.postMessage is not a function`.** Cause: a `SharedWorker` instance has no `postMessage` method of its own — messaging goes through its `.port` property, unlike a dedicated `Worker`, where the instance itself is the messaging endpoint. This is the single most common porting mistake going from `?worker` to `?sharedworker`. Fix:
```typescript
worker.port.postMessage(payload); // not worker.postMessage(payload)
```

**★ Symptom: a `SharedWorker`'s `onmessage` handler never fires, on either side, even though `postMessage` was called and no error was thrown.** Cause: a port obtained from `onconnect`'s `event.ports[0]`, or from `sharedWorkerInstance.port`, starts in a paused state and must have `.start()` called on it before any queued or future messages are delivered. Fix: call `.start()` on **both** ends — the worker-side port from `onconnect`, and the constructing side's `.port` — not just one.

**★ Symptom: closing the tab that first opened a `SharedWorker` kills state other tabs were depending on.** Cause: a wrong mental model carried over from dedicated workers — the assumption that the creating tab owns the worker's lifetime. `SharedWorker` lifetime is documented as tied to *any* open page holding a reference, not the first one specifically; if this symptom is actually observed, the more likely cause is that every other tab failed to keep its own live reference (e.g., stored it in a variable that got garbage-collected, or never called `port.start()` so the connection was effectively inert). Fix: verify every tab holds a live reference and has started its port; do not special-case the "first" tab in application logic.

**★ Symptom: transferring a large `ArrayBuffer` to a worker, then reading it again on the sending side, throws.** Cause: this is *correct*, documented behaviour, not a bug — a transferred object is detached on the origin side: *"any attempt to read or write the object will throw an exception."* Fix: if the sending side genuinely needs to keep using the data after sending it, don't transfer it — pass it without a transfer list and accept the structured-clone copy, or clone the buffer yourself (`buffer.slice(0)`) before transferring one copy and keeping the other.

**★ Symptom: a dedicated worker keeps running — visible in the browser's task manager or process list — long after the component or feature that created it has unmounted.** Cause: no `.terminate()` was ever called; workers are not garbage-collected just because the reference holding them went out of scope in application code, because the browser itself still holds the worker's execution context alive. Fix: pair every `new Worker()` (or `?worker`-imported constructor call) with a `.terminate()` in the corresponding cleanup path — a component unmount, a route change, an explicit "stop" action.

## Interview questions

**★ Why can't you call `.postMessage()` directly on a `SharedWorker` instance the way you can on a dedicated `Worker`?**
Because the object model reflects a genuinely different relationship. A dedicated `Worker` instance *is* the connection — there's exactly one owner, so the instance can double as the messaging endpoint. A `SharedWorker` instance represents a connection to a worker that may already be running and already talking to other tabs; the instance itself is just a handle, and the actual communication channel — a `MessagePort` — is exposed separately as `.port` specifically so each connecting context gets its own independent channel into the one shared instance, mirroring how the worker side receives each new connection as a separate port via `onconnect`.

**★ What's the actual cost of `postMessage`, and when does it matter enough to reach for Transferables?**
`postMessage` runs the structured clone algorithm by default — every argument is serialized and copied, then deserialized on the receiving side, whether the receiver is a dedicated worker, a shared worker's port, or the main thread receiving a reply. For small plain objects, that cost is negligible. For a large `ArrayBuffer` — image pixel data, audio samples, a big typed array backing a WASM linear memory view — the copy is real: memory is duplicated and the clone takes measurable time proportional to size. Transferables sidestep this entirely by moving ownership instead of copying, at the cost that the sending side's reference becomes unusable afterward (`byteLength` becomes `0`, and per MDN, "any attempt to read or write the object will throw"). The decision point is simple: if you don't need the data on the sending side after the call, transfer it.

**★ Does closing the browser tab that created a `SharedWorker` end the worker?**
Not necessarily. MDN states the worker stays alive *"as long as any open page holds a reference to it"* — so if a second tab is still connected, the shared worker instance and any state it holds (an in-memory cache, an open websocket, a lock) persists past the first tab closing. It only actually terminates once every connected page has disconnected, optionally delayed further by `extendedLifetime` if the constructor set that option, specifically to let the worker flush state to storage or send final telemetry before it's torn down.

**★ Why doesn't a `SharedWorker` expose `.terminate()`?**
Because no single connecting context is the owner. A dedicated `Worker` has exactly one creator, so it's unambiguous which code is entitled to kill it. A `SharedWorker` may have several tabs depending on it simultaneously; letting any one of them unilaterally terminate the shared instance would break every other tab's connection with no coordination. The platform's answer is that a tab can only close *its own* port (`port.close()`) — it can opt itself out, but it cannot force the shared instance to stop for everyone else.

**★ Your component spawns a worker in a `useEffect`, but you're seeing two worker instances running after a re-render in development. What's happening, and does it matter in production?**
This is almost always React `StrictMode` double-invoking effects in development specifically to surface missing cleanup — it mounts, unmounts, and remounts the effect once, on purpose. If the effect's cleanup function correctly calls `.terminate()` on the worker created in that same effect run, the first worker is torn down before the second is created, and there's no real leak. If the symptom persists, the cleanup function is either missing or terminating the wrong reference (a common bug: reading from a `ref` that a later render already overwrote before cleanup ran). This does not reproduce in a production build, where effects run once — which is exactly why relying on "it only happens in dev, so it's fine" is the wrong conclusion; StrictMode surfaced a bug that would otherwise leak silently in any scenario a component mounts and unmounts more than once, dev or not.

---

← [01a · Worker build configuration](01a-worker-build-configuration.md) · [Vite overview](../../README.md) · Next → [01c · WebAssembly imports](01c-webassembly-imports.md)
