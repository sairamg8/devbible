---
title: "21 · `structuredClone`"
sidebar_label: "21 · structuredClone"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [`Worker.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage), [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [`History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState), [IndexedDB key characteristics](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology), [`DataCloneError`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException#datacloneerror), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Documentation-validated; **no timings**.

**`structuredClone` is not really a deep-copy utility. It is the platform's
serialisation algorithm, exposed as a function you can call directly.** That framing is
the whole topic, and it is what makes this worth its own page: the mechanics of *what it
copies* belong to
[Phase 4 · 04 · 02](../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md),
where deep copying lives and where the full table of what it handles, loses and throws on
already is.

**What is here instead: where else that algorithm runs, and how to choose between it and
the four other ways to copy an object.**

## The same algorithm runs at every boundary

```js
structuredClone(value);                    // call it directly
worker.postMessage(value);                 // → a Web Worker
otherWindow.postMessage(value, origin);    // → an iframe or popup
channel.postMessage(value);                // → a BroadcastChannel, to other tabs
store.put(value);                          // → IndexedDB, on disk
history.pushState(value, "", url);         // → the session history entry
```

🔴 **Every line there serialises with the structured clone algorithm.** They are not six
similar mechanisms; they are one mechanism with six entry points. Two consequences, and
both are practical:

**1 · `structuredClone` is a synchronous test for all of them.** If a value survives
`structuredClone`, it will cross a worker boundary, go into IndexedDB and land in a
history entry. If it throws, all of those will throw too — and you found out on one line
instead of inside an async postMessage handler with a useless stack:

```js
try {
  structuredClone(payload);      // ✅ same failure, synchronously, at the call site
} catch (e) {
  // DataCloneError — this payload can never cross a boundary
}
```

**2 · The things it refuses are refused everywhere.** A function, a DOM node, a class
with methods, a `WeakMap`, a getter — none of them can be sent to a worker, stored in
IndexedDB or pushed into history, for the same reason. That is not six separate
limitations to learn; it is one.

⚠️ **The prototype is the one people trip over at a boundary.** A class instance clones
as a plain object with the same own properties and **no methods**, so the value that
arrives in the worker is data, not an object of your class. The fix is to send data and
reconstruct on the other side — a `static from(data)` on the class — rather than to hope
the instance survives.

**Where this goes next in this book:** the boundaries themselves are phase 11 and
phase 12 — **14 · Same-origin and `postMessage`** *(not written yet)*, **16 · IndexedDB**
*(not written yet)* and **Phase 12 · 07 · Web Workers** *(not written yet)*. This page is
the shared serialisation model underneath all of them.

## Choosing a copy

**Five tools, and the decision is almost always made by two questions: how deep, and how
faithful?**

| Tool | Depth | Keeps accessors / prototype | Handles cycles | Refuses |
|---|---|---|---|---|
| `{ ...obj }` / `Object.assign` | shallow | ❌ | n/a | nothing |
| `Object.create` + `getOwnPropertyDescriptors` | shallow | ✅ | n/a | nothing |
| `JSON.parse(JSON.stringify(x))` | deep | ❌ | 🔴 throws | silently drops a lot |
| **`structuredClone(x)`** | **deep** | ❌ | ✅ | throws loudly |
| a library deep clone | deep | varies | ✅ | varies |
| `Class.from(data)` | as written | ✅ | as written | nothing |

**Read it as a decision, not a table:**

- **Flat data, and you only need a new top level** → spread. Most of the time this is the
  right answer, and reaching past it is the more common mistake
  ([Phase 4 · 04 · 01](../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md)).
- **You need the getters and the prototype to survive** → the descriptor clone
  ([18 · 03 · Descriptors and faithful copies](./18-object-statics/03-descriptors-and-faithful-copies.md)).
  Still shallow.
- **Genuinely detached nested data, including `Map`, `Set`, `Date`, `RegExp` and typed
  arrays** → `structuredClone`.
- **A real domain object with behaviour and private state** → not a copy at all. Give the
  class a `clone()` or a static `from()`; no generic copier can carry `#private` fields
  ([Phase 4 · 20 · 02](../phase-4-objects-and-classes/20-private-state-before-hash/02-hash-today-and-choosing.md)).

🔴 **`JSON.parse(JSON.stringify(x))` has no remaining niche.** It is slower than a real
clone, it throws on cycles, and it silently converts `Date` to a string and drops
`undefined`, functions, `Symbol` keys, `Map` and `Set`
([09 · `JSON`](./09-json/README.md)). `structuredClone` does that job correctly, and where
it refuses a value the refusal is information.

⚠️ **Loud refusal is a feature, and it is the honest reason to prefer it.** JSON copying
appears to succeed and hands you a `Map` turned into `{}`; `structuredClone` throws a
`DataCloneError` and names the problem.

## What it costs

**It is synchronous and it walks the whole graph.** A large object blocks the main thread
for the duration — the same work `postMessage` does, just visible at your call site
instead of hidden behind an event.

**So the two guardrails are the ordinary ones:**

- **Do not deep-clone to be safe.** Clone because something will mutate the copy. A copy
  nobody mutates is pure cost, and a shallow copy is usually the honest requirement.
- **Send less across a boundary.** The cheapest clone is the one you did not do — this is
  why `transfer` exists for large binary payloads
  ([Phase 4 · 04 · 02](../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md)
  has the transferables detail): the buffer is *moved*, not copied, and the original is
  detached.

⚠️ **`history.pushState` state objects are size-limited by browsers**, so a large cloned
object is a real failure there rather than merely slow. Keep an id in the history state
and the data in memory or storage.

## Availability

**It is a platform function, not a language one** — it lives on the global object in
browsers, Web Workers and Node (Node 17 and later). There is no `Object.structuredClone`
and never will be; the algorithm belongs to the HTML specification, not to ECMAScript.

⚠️ **That means it is unavailable in some sandboxed or older embedding environments**, and
`typeof structuredClone === "function"` is the honest feature test. The `Temporal` and
`Intl` pattern of "check your targets" applies here too.

## Gotchas

**Symptom:** `DataCloneError` from `postMessage` with an unhelpful stack
**Cause:** The payload contains something the structured clone algorithm refuses — a
function, a DOM node, a `WeakMap`, a class with methods.
**Fix:** Reproduce it synchronously with `structuredClone(payload)` at the call site, then
send plain data.

**Symptom:** A class instance arrived in a worker without its methods
**Cause:** The algorithm copies own properties, not the prototype. Every clone of an
instance is a plain object.
**Fix:** Send data and rebuild with a `static from(data)` on the other side.

**Symptom:** A getter arrived as a fixed value
**Cause:** Accessors are read and stored as data — the same flattening spread does.
**Fix:** Send the underlying data and define the getter on the reconstructed object.

**Symptom:** `structuredClone` is not defined
**Cause:** An older runtime or a restricted environment. It is an HTML-spec global, not an
ECMAScript one.
**Fix:** Feature-test, and fall back to a library clone.

**Symptom:** Cloning a large object froze the UI
**Cause:** It is synchronous and walks the entire graph.
**Fix:** Clone less, or `transfer` binary buffers instead of copying them.

**Symptom:** `pushState` failed on a large state object
**Cause:** Browsers cap the serialised size of a history state entry.
**Fix:** Store an id in history and keep the payload elsewhere.

**Symptom:** JSON round-tripping "worked" but dates came back as strings
**Cause:** JSON has no date type — the loss is silent.
**Fix:** `structuredClone`, which preserves `Date`, `Map`, `Set` and `RegExp` and throws
rather than degrading.

## Interview questions

**★ What is `structuredClone`, beyond "a deep copy"?**
It is the HTML specification's structured clone algorithm exposed as a function — the same
serialisation used by `postMessage` to workers, iframes and other tabs, by IndexedDB, and
by `history.pushState`. So it is also a synchronous test for whether a value can cross any
of those boundaries.

**★ Why prefer it over `JSON.parse(JSON.stringify(x))`?**
Because the JSON round trip loses data silently: `Date` becomes a string, `undefined`,
functions and `Symbol` keys vanish, `Map` and `Set` become `{}`, and a cycle throws.
`structuredClone` preserves those types, handles cycles, and where it genuinely cannot
copy something it throws a `DataCloneError` naming the problem instead of degrading.

**★ What does it not carry across?**
Functions, DOM nodes, `WeakMap`/`WeakSet` and symbol keys — those throw — and, silently,
the prototype and any accessors: a class instance clones as a plain object with data
properties and no methods, and `#private` fields do not exist for it at all.

**★ A `postMessage` throws `DataCloneError`. How do you debug it?**
Call `structuredClone` on the same payload synchronously at the call site. It fails
identically and immediately, with a stack pointing at your code rather than at an async
boundary. Then reduce the payload to plain data.

**When would you not use it?**
When a shallow copy is what you actually need — which is most of the time — or when you
need accessors and the prototype preserved, which is the descriptor clone. And for a real
domain object with behaviour or private state, a `clone()` or `static from()` on the class
beats any generic copier.

**What does `transfer` do, and why?**
It moves ownership of a transferable — an `ArrayBuffer`, a `MessagePort`, an
`ImageBitmap` — instead of copying it, leaving the original detached. For large binary
payloads that turns a full copy into a pointer handover, which is the whole reason to
prefer it at a worker boundary.

---

← [20 · `Intl`](./20-intl/README.md) · [Phase index](./README.md) · Next: **22 · Array-likes and iterables** *(not written yet)* →
