---
title: "02 · The message boundary: structured clone and transferables"
sidebar_label: "02 · The message boundary"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`Worker.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects), [`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel), [`SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer). Documentation-validated; **no timings and no console output**.

Nothing crosses the worker boundary by reference. Every message is **copied** by the structured
clone algorithm — unless you explicitly hand ownership over instead. Getting this wrong is how a
worker ends up slower than the main-thread version it replaced.

## What structured clone copies

It is not `JSON.parse(JSON.stringify(x))`. It is a deep copy that understands the platform's own
types:

| Copied faithfully | Notes |
|---|---|
| primitives, `Array`, plain objects | including **cycles**, which JSON cannot do |
| `Date`, `RegExp`, `Map`, `Set` | still a `Map` on the other side |
| `ArrayBuffer`, all typed arrays, `DataView` | **copied** unless transferred |
| `Blob`, `File`, `FileList`, `ImageData`, `ImageBitmap` | |
| `Error` and its standard subclasses | `name`, `message`, and where supported `cause` |

| ❌ Not copied | What happens |
|---|---|
| functions, class methods | **throws `DataCloneError`** |
| DOM nodes | throws |
| `Symbol`s, WeakMap/WeakSet | throws |
| **class instances** | arrive as **plain objects** — data survives, prototype does not |
| getters | evaluated; the *value* is copied, not the accessor |
| `undefined` in an object property | preserved (unlike JSON) |

🔴 **The class-instance rule is the one that bites.** A `new Money(4200)` posted to a worker
arrives as `{ cents: 4200 }` with no `format()` and no `instanceof`. Send data, reconstruct on
the other side — a `type` field and a factory function, not a hope.

⚠️ **`DataCloneError` is thrown by `postMessage` itself**, synchronously, on the sending side.
A callback, a DOM node or a class with a method attached somewhere deep in the payload takes the
whole message down. The usual culprits: a React element, an `AbortSignal`, a proxy object, or an
event.

**`structuredClone(value)` is the same algorithm as a plain function**, available on the main
thread. It is the correct deep clone for platform data — and a good way to check, in a test,
whether a payload is postable at all.

## The cost is real and proportional to size

Cloning walks the structure and allocates a second copy on the receiving side. Two consequences:

- **A big payload is charged twice** — serialise on one thread, deserialise on the other. The
  serialisation half happens **synchronously on the calling thread**, so posting a 50 MB object
  from the main thread blocks the main thread while it is copied. Moving work to a worker and
  then posting the whole dataset both ways can cost more than doing the work in place.
- **Deep structures cost more than flat ones.** A million-node tree is a million allocations; a
  typed array of the same bytes is a memcpy.

🔴 **Design the message, not just the work.** Send an id and let the worker fetch the data itself
(`fetch` works there); send a typed array instead of an array of objects; send a summary back
rather than the whole processed set. **The best message is a small one.**

## Transferables: move it instead of copying it

```js
const buffer = new ArrayBuffer(64 * 1024 * 1024);
worker.postMessage({ buffer }, [buffer]);      // second argument: the transfer list
// or: worker.postMessage({ buffer }, { transfer: [buffer] });

buffer.byteLength;   // 0 — detached; this thread no longer owns it
```

**Ownership moves; nothing is copied.** The cost stops depending on size. The price is that the
sender's reference is **detached** — reading it afterwards throws or reads as empty, and that is
a feature: it makes it impossible for two threads to hold the same buffer.

**The transferable types** (per MDN): `ArrayBuffer`, `MessagePort`, `ReadableStream`,
`WritableStream`, `TransformStream`, `ImageBitmap`, `OffscreenCanvas`, and media types such as
`VideoFrame` and `AudioData`.

⚠️ **A typed array is not transferable — its buffer is.** Transfer `view.buffer`, and be aware
that this detaches *every* view over that buffer, not only the one you sent.

```js
const pixels = new Uint8ClampedArray(width * height * 4);
worker.postMessage({ pixels, width, height }, [pixels.buffer]);   // 🔴 .buffer, not pixels
```

**Round-tripping is the normal pattern**: transfer the buffer in, have the worker transfer it
back when it is done. Otherwise the main thread has to allocate a fresh one every frame.

## `OffscreenCanvas`: the rendering exception

```js
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: offscreen }, [offscreen]);
```

The worker draws into the real on-screen canvas. This is the one case where a worker's output is
pixels rather than data, and it is how a heavy visualisation stays smooth while the main thread
is busy — pairing directly with the canvas sizing in
[05 · 01 · Element-level responsiveness](../05-resizeobserver/01-element-level-responsiveness.md).
After the transfer the main thread can no longer get a 2D context from that canvas; it belongs to
the worker.

## `SharedArrayBuffer`: genuinely shared memory

The only way two threads see the *same* bytes. It requires the page to be **cross-origin
isolated** — `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy:
require-corp` — which is a deployment decision, not a code one, and it breaks embeds that do not
send the matching headers. Coordination then needs `Atomics`, because ordinary reads and writes
race.

That is a **When Needed** topic in its own right — **21 · `SharedArrayBuffer` and `Atomics`**
*(not written yet)*. Reach for it for WebAssembly threads and ring buffers; not for passing a
result back.

## Ports, and a channel that is not the page

`MessagePort` is transferable, which makes `MessageChannel` the way to build private pipes:

```js
const { port1, port2 } = new MessageChannel();
workerA.postMessage({ peer: port2 }, [port2]);   // hand one end to another worker
port1.onmessage = (e) => …;                      // …and keep the other
port1.start();                                   // needed when using addEventListener
```

Two workers can then talk **directly**, without every message being relayed through the main
thread — which matters, because relaying means two clones and two hops through the busiest
thread in the app.

## A note on wrappers

Libraries such as Comlink wrap `postMessage` in a `Proxy` so a worker's exports look like async
functions (`await api.search(q)`). They remove the id-and-pending-map boilerplate from
[01](./01-starting-and-talking.md) and nothing else — **the clone rules still apply**, arguments
and return values are still copied, and functions still cannot cross except as explicitly
proxied callbacks. A pleasant wrapper does not make the boundary cheap.

## Gotchas

**Symptom: `DataCloneError: … could not be cloned`.**
Cause — a function, DOM node, symbol or proxy somewhere in the payload.
Fix — send plain data; check with `structuredClone(payload)` in a test.

**Symptom: methods are missing on the received object.**
Cause — structured clone copies data, not prototypes; class instances arrive as plain objects.
Fix — send a discriminated plain object and reconstruct on the far side.

**Symptom: the worker version is slower than doing the work inline.**
Cause — the payload dominates; two clones of a large structure cost more than the computation.
Fix — transfer buffers instead of cloning, send ids and let the worker fetch, or return a summary.

**Symptom: the array is empty right after posting it.**
Cause — its buffer was transferred, so every view over it is detached.
Fix — expected behaviour; transfer back when done, or clone if the sender still needs it.

**Symptom: transferring a typed array does nothing.**
Cause — the transfer list must contain `view.buffer`, not the view.
Fix — `[view.buffer]`.

**Symptom: `SharedArrayBuffer is not defined`.**
Cause — the page is not cross-origin isolated.
Fix — COOP/COEP headers, and accept the consequences for embeds; or redesign around transfers.

**Symptom: two workers exchanging data make the UI stutter.**
Cause — every message is relayed through the main thread, at two clones each.
Fix — a `MessageChannel`; transfer one port to each worker.

## Interview questions

**★ What actually happens to an object you `postMessage`?**
It is deep-copied by the structured clone algorithm — cycles, `Map`, `Set`, `Date` and typed
arrays survive; functions, DOM nodes and symbols throw `DataCloneError`; class instances lose
their prototype and arrive as plain objects. Serialisation happens synchronously on the sender.

**★ How is structured clone different from `JSON.parse(JSON.stringify(x))`?**
It handles cycles, keeps `Date`/`Map`/`Set`/`RegExp`/`ArrayBuffer` as themselves, preserves
`undefined` properties, and copies `Blob`s and `ImageData`. It also throws rather than silently
dropping a function.

**★ What is a transferable, and what does transferring cost?**
An object whose ownership can be moved rather than copied — `ArrayBuffer`, `MessagePort`,
`ImageBitmap`, `OffscreenCanvas`, the stream types. The cost stops depending on size; the sender's
reference is detached, so only one thread can ever hold it.

**★ You moved a computation to a worker and the page got slower. Why?**
The message is doing more work than the computation. Cloning a large structure costs on both
sides and the send half blocks the caller. Transfer buffers, pass an id instead of the data, or
return only what the UI needs.

**★ When is `SharedArrayBuffer` the answer, and what does it require?**
When two threads must read and write the same memory — WebAssembly threads, a ring buffer. It
requires cross-origin isolation (COOP + COEP) and `Atomics` for safe coordination, so it is a
deployment decision as much as a coding one.

**How would two workers talk without the main thread relaying?**
`MessageChannel` — transfer one `MessagePort` to each. Direct messages, no relay, no extra clone.

---

← [01 · Starting and talking](./01-starting-and-talking.md) · [03 · Deciding and patterns](./03-deciding-and-patterns.md) →
