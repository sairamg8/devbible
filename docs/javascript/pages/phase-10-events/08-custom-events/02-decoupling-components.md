---
title: "02 · Decoupling components"
sidebar_label: "02 · Decoupling components"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent), [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel). Documentation-validated; **no timings**.

The syllabus row ends with *decoupling components without a framework* — which is the actual point
of custom events. The mechanics are one page; knowing when this is the right shape is the rest.

## The pattern: emit up, command down

```js
// the component knows nothing about who is listening
class QuantityStepper extends HTMLElement {
  #emit(quantity) {
    this.dispatchEvent(new CustomEvent('quantity:change', {
      detail: { sku: this.dataset.sku, quantity },
      bubbles: true,
    }));
  }
}
```

```js
// the page decides what it means
cart.addEventListener('quantity:change', (e) => {
  updateTotal(e.detail.sku, e.detail.quantity);
});
```

The component **emits facts about itself**. The listener **decides what they mean**. Neither
imports the other, and the component can be dropped into a different page that reacts differently
— that is the decoupling, and it is the same contract a `<input>` has with you.

The reverse direction is **not** an event: to tell a component to do something, call its method or
set an attribute. Events are notifications, not commands.

| Direction | Mechanism |
|---|---|
| component → page | a custom event |
| page → component | a method call, a property, or an attribute |

## `EventTarget` as a standalone bus

When there is no element to hang the event on — a store, a router, a websocket wrapper —
`EventTarget` is constructible and can be extended:

```js
class Store extends EventTarget {
  #state = { items: [] };

  add(item) {
    this.#state = { ...this.#state, items: [...this.#state.items, item] };
    this.dispatchEvent(new CustomEvent('change', { detail: this.#state }));
  }
}

const store = new Store();
store.addEventListener('change', (e) => render(e.detail));
```

Everything the DOM gives you comes along: `once`, `signal`, `capture` semantics, and no dependency.
Note that `bubbles` is meaningless here — there is no tree — so a plain dispatch is enough.

This is the Know-tier topic **12 · `EventTarget` as a base class** *(not written yet)* in its
practical form; the point here is that a custom-event architecture does not require elements.

## Cleanup is the part that leaks

An event bus that outlives its listeners is a memory leak with extra steps: the bus holds the
listener, the listener closes over the component, the component holds its DOM
([Phase 9 · 10 · 02](../../phase-9-dom/10-removing-and-replacing/02-cleanup.md)).

```js
class CartBadge extends HTMLElement {
  #ac = new AbortController();

  connectedCallback() {
    store.addEventListener('change', (e) => this.#render(e.detail),
      { signal: this.#ac.signal });
  }

  disconnectedCallback() {
    this.#ac.abort();          // every listener registered with the signal, gone
  }
}
```

🔴 **One `AbortController` per component, aborted in teardown.** It removes the identity trap
(`removeEventListener` needs the same function reference) and it scales — ten listeners, one
`abort()`. ⚠️ Note that `disconnectedCallback` can fire on a mere move, so a component that
re-connects needs a fresh controller
([Phase 9 · 18 · 01](../../phase-9-dom/18-shadow-dom-and-custom-elements/01-custom-elements.md)).

## When custom events are the wrong tool

They are excellent for **one component telling its surroundings something happened**. They are a
poor fit for:

| Situation | Better |
|---|---|
| shared state several components read | a store object, with events **as its change notification** |
| a request that needs a **result** back | a method call — events are one-way, and `detail` mutation as a return channel is a trap |
| deep parent → child communication | pass a reference, or an attribute |
| ordering between many listeners | explicit calls; listener order is registration order, which nothing guarantees to stay stable |
| **cross-tab** messaging | `BroadcastChannel`, or `storage` events — DOM events never leave the document |

🔴 **The failure mode of an event bus is invisibility.** With enough `document`-level events, "what
happens when I click this" has no answer you can find by reading — you have to grep for the string
and hope you found every listener. Keep events local to a component and its container, where the
listener is next to the markup that produces them.

**The trade-off, stated plainly:** custom events buy you components that do not know about each
other, at the cost of a control flow no reader can follow by clicking through definitions. That is
worth paying at a component boundary and rarely worth paying inside one.

## A checklist for a component's event contract

- **Name it** with a namespace, past tense for notifications, `before-` for cancelable intents.
- **Dispatch on the component's own element**, with `bubbles: true` (and `composed: true` if there
  is a shadow root).
- **Put everything the listener needs in `detail`** — including which instance, since a delegated
  listener sees many.
- **Freeze the shape.** `detail` is your public API; adding fields is safe, renaming is a breaking
  change.
- **Document it** next to the component, in the same place as its attributes and methods.
- **Do not emit in a loop.** Dispatch is synchronous — one `items:changed` beats fifty
  `item:changed`.

## Gotchas

**Symptom: the listener runs, but state read from `detail` is already stale.**
Cause — `detail` captured a snapshot at dispatch time and something changed afterwards, or the
listener mutated a shared object it received.
Fix — pass values, not live references; treat `detail` as read-only in listeners.

**Symptom: you cannot tell which component emitted the event.**
Cause — dispatching on `document` gives every event the same target.
Fix — dispatch on the component's element and let it bubble; use `event.target`.

**Symptom: memory grows as components are added and removed.**
Cause — listeners registered on a long-lived bus are never removed.
Fix — an `AbortController` per component, aborted in teardown.

**Symptom: two features respond to the same event in the wrong order.**
Cause — listener order is registration order; nothing else guarantees it.
Fix — if order matters, it is not an event — call the functions explicitly in the order you need.

**Symptom: an event fires fifty times on a bulk update.**
Cause — emitting per item inside a loop, synchronously.
Fix — one event describing the batch.

**Symptom: the other browser tab does not react.**
Cause — DOM events are per-document.
Fix — `BroadcastChannel` or the `storage` event.

## Interview questions

**★ What is the contract a custom event expresses?**
The component emits a fact about itself and knows nothing about listeners; the listener decides
what it means. Communication in the other direction — telling the component to do something — is a
method call or an attribute, not an event.

**★ How do you build an event bus without any DOM element?**
Extend `EventTarget` — it is constructible, so a store or router gets `addEventListener`,
`dispatchEvent`, `once` and `signal` with no dependency. `bubbles` is meaningless off-tree.

**★ How do you stop an event bus leaking memory?**
Register every listener with an `AbortController`'s `signal` and `abort()` in teardown. It avoids
the `removeEventListener` identity trap and scales to any number of listeners.

**★ When are custom events the wrong choice?**
When you need a return value, when several components share state (use a store and emit change
notifications from it), when order between listeners matters, and for cross-tab messaging —
`BroadcastChannel` handles that; DOM events never leave the document.

**★ What is the main cost of an event-driven architecture?**
Traceability. "What happens when I click this" stops being answerable by reading, because the
listeners are somewhere else and matched by a string. Keeping events at component boundaries limits
the damage.

**Why is `detail` effectively public API?**
Because every listener depends on its shape. Adding fields is backwards-compatible; renaming or
removing them breaks consumers you may not be able to find.

---

← [01 · Dispatching and listening](./01-dispatching-and-listening.md) · [Topic index](./README.md) ·
**09 · Scroll, resize and visibility** *(not written yet)* →
