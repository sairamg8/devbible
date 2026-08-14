---
title: "01 · Building on the platform"
sidebar_label: "01 · Building on the platform"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), [`EventTarget()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Documentation-validated; **no timings**.

The syllabus row is *building your own emitter on the platform instead of shipping one* — and the
short version is that `EventTarget` is **constructible**, so a store, a router or a websocket
wrapper can be an event emitter with no dependency at all.

```js
class Store extends EventTarget {
  #state = { items: [] };

  get state() { return this.#state; }

  add(item) {
    this.#state = { ...this.#state, items: [...this.#state.items, item] };
    this.dispatchEvent(new CustomEvent('change', { detail: this.#state }));
  }
}

const store = new Store();
store.addEventListener('change', (e) => render(e.detail));
```

That is the whole thing. No `on`/`off`/`emit` to write, no listener array to maintain, no bug in
your own removal logic.

## What you get for free

| Feature | Why it matters |
|---|---|
| `addEventListener` / `removeEventListener` / `dispatchEvent` | the API every JavaScript developer already knows |
| **`{ once: true }`** | one-shot listeners, removed automatically |
| **`{ signal }`** | 🔴 remove every listener with one `AbortController.abort()` |
| `CustomEvent` and `detail` | a payload convention already established |
| `cancelable` + `preventDefault()` | a veto protocol, with `dispatchEvent()` returning `false` |
| the same object identity rules | listeners deduplicate per (type, callback, capture) |

🔴 **`{ signal }` is the feature that makes this better than a hand-written emitter.** Most
home-grown emitters have no cleanup story beyond "remember to call `off` with the same function
reference", which is the identity trap from
[02 · `addEventListener`](../02-addeventlistener/README.md).

```js
class Widget {
  #ac = new AbortController();

  constructor(store) {
    store.addEventListener('change', () => this.render(), { signal: this.#ac.signal });
    store.addEventListener('error', (e) => this.showError(e.detail), { signal: this.#ac.signal });
  }

  destroy() { this.#ac.abort(); }        // both listeners, gone
}
```

## What it does not give you

Be honest about the differences from a Node-style `EventEmitter`:

| `EventEmitter` (Node) | `EventTarget` |
|---|---|
| listener receives **arguments** — `emit('x', a, b)` | receives **one event object**; payload goes in `detail` |
| `emitter.on()` returns the emitter (chainable) | `addEventListener()` returns `undefined` |
| `listenerCount`, `eventNames`, `off(type)` for a whole type | **no introspection** — you cannot list or count listeners |
| `error` events **throw** when unhandled | nothing special about any event name |
| synchronous, ordered | synchronous, ordered — the same |

⚠️ **The lack of introspection is the one that bites.** There is no way to ask "does anything listen
to this?" or to remove all listeners for a type. If you need that, keep your own registry — or
reconsider whether the coupling that needs it should be an event at all
([08 · 02](../08-custom-events/02-decoupling-components.md)).

## When a class should extend it, and when it should not

**Extend `EventTarget` when** the object has a lifecycle other code wants to observe and there is no
element to hang events on: a store, a router, a media controller, a connection wrapper, a background
job.

**Do not** when:

- **There is an element.** A component should dispatch on its own DOM node, so events bubble and
  delegation works ([08 · 01](../08-custom-events/01-dispatching-and-listening.md)).
- **There is exactly one consumer.** A callback in the constructor is simpler, traceable, and can
  return a value.
- **You need a return value.** Events are one-way; a listener cannot answer.
- **Ordering between listeners matters.** Registration order is all you get, and nothing documents
  it as stable.

**The trade-off, plainly:** `EventTarget` gives you a familiar, well-specified, dependency-free
emitter with real cleanup — at the cost of Node-style ergonomics (arguments, introspection,
chaining) and of a control flow that is harder to follow than a direct call.

## Composition when you cannot extend

If the class already extends something else, hold an `EventTarget` instead of being one:

```js
class Player extends MediaController {
  #bus = new EventTarget();

  addEventListener(...args) { this.#bus.addEventListener(...args); }
  removeEventListener(...args) { this.#bus.removeEventListener(...args); }
  dispatchEvent(event) { return this.#bus.dispatchEvent(event); }
}
```

Three forwarding methods and the object is externally indistinguishable from an `EventTarget` —
which is also how you keep dispatch private, since only the class can reach `#bus` to fire events.
That is a real advantage over extending, where any caller can `dispatchEvent()` on your object and
fake your events.

## Typing the events (for the TypeScript case)

A hand-written emitter is easier to type than `EventTarget`, whose `addEventListener` signature is
generic over event maps that only DOM interfaces populate. In TypeScript you either declare an
interface map for your subclass or accept `Event` and narrow inside the listener. That inconvenience
is the main argument people make for a small custom emitter — weigh it against losing `{ signal }`
and `{ once }`.

## Gotchas

**Symptom: `new EventTarget()` throws in an old environment.**
Cause — the constructor was not always available; `EventTarget` existed only as a base class.
Fix — it is widely available now, but in a genuinely old target either polyfill or use a
`DocumentFragment` as the bus, which has the same interface.

**Symptom: listeners on your store are never cleaned up.**
Cause — no `signal`, and the removal used a different function reference.
Fix — register with `{ signal }` and `abort()` in teardown.

**Symptom: you cannot tell whether anyone is listening.**
Cause — `EventTarget` has no introspection.
Fix — track it yourself if you truly need it, or reconsider the design.

**Symptom: the payload is `undefined` in listeners.**
Cause — dispatching `new Event(type)` instead of `new CustomEvent(type, { detail })`, or passing
arguments as if it were Node's `emit`.
Fix — everything goes in `detail`.

**Symptom: outside code fires your object's own events.**
Cause — extending `EventTarget` makes `dispatchEvent` public.
Fix — compose instead: hold a private `EventTarget` and expose only the three methods.

**Symptom: `bubbles: true` on a store's event does nothing.**
Cause — there is no tree off-DOM, so bubbling is meaningless.
Fix — drop the option; dispatch reaches the listeners on that object.

## Interview questions

**★ Why extend `EventTarget` instead of writing an emitter?**
It is constructible, dependency-free and already known to every JavaScript developer — and it brings
`{ once }` and `{ signal }`, which give you real cleanup. Most hand-written emitters have no
cleanup story beyond matching function references.

**★ What does `EventTarget` not give you compared with Node's `EventEmitter`?**
Multiple arguments (payload goes in `detail`), chaining, and any introspection — you cannot count
or list listeners, or remove all of a type. Nor is `error` special.

**★ When should an object *not* be an `EventTarget`?**
When it has a DOM element to dispatch from, when there is exactly one consumer (use a callback),
when you need a return value, or when listener ordering matters.

**★ How do you add events to a class that already extends something?**
Compose: hold a private `EventTarget` and forward `addEventListener`, `removeEventListener` and
`dispatchEvent`. It also keeps dispatch private, which extending does not.

**★ How do you clean up listeners on a long-lived bus?**
Register them with an `AbortController`'s `signal` and call `abort()` in teardown — one call
removes all of them, with no reference matching.

**Does `bubbles` do anything off the DOM?**
No. There is no tree, so a dispatch simply reaches that object's listeners.

---

[Topic index](./README.md) · [Phase 10 index](../README.md) →
