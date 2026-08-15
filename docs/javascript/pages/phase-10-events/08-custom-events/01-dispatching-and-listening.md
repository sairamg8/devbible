---
title: "01 · Dispatching and listening"
sidebar_label: "01 · Dispatching and listening"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent), [`CustomEvent()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent), [`EventTarget.dispatchEvent()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent), [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event), [`Event.composed`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composed). Documentation-validated; **no timings**.

A custom event is how one part of a page tells another that something happened, without the two
knowing about each other. The DOM is already an event bus; you do not need a library to use it.

## Creating and dispatching

```js
const event = new CustomEvent('cart:item-added', {
  detail: { sku: 'A-1042', quantity: 2 },
  bubbles: true,
  cancelable: false,
  composed: false,
});

cartButton.dispatchEvent(event);
```

🔴 **Every option defaults to off.** `bubbles`, `cancelable` and `composed` are all `false` unless
you say otherwise, and `detail` is `null`. That is the opposite of what most built-in events do,
and it is why a hand-made event so often "does not fire" — it fired, on that element only, and
nothing was listening there.

Listening is ordinary:

```js
document.addEventListener('cart:item-added', (e) => {
  updateBadge(e.detail.quantity);      // detail is read-only
});
```

## `CustomEvent` versus `Event`

```js
new Event('cart:cleared');                             // no payload
new CustomEvent('cart:item-added', { detail: {…} });   // payload in detail
```

`CustomEvent` exists for exactly one reason: `detail`. If the event name carries the whole message,
`new Event(...)` is enough. MDN also notes the third option — **subclass `Event`** — when you want
named properties rather than everything inside `detail`:

```js
class CartEvent extends Event {
  constructor(type, { sku, quantity, ...init } = {}) {
    super(type, init);
    this.sku = sku;
    this.quantity = quantity;
  }
}
```

⚠️ `initCustomEvent()` and `document.createEvent()` are the deprecated pre-constructor spelling. If
you meet them, translate to the constructor rather than extending them.

## `dispatchEvent()` is synchronous

🔴 **Listeners run to completion before `dispatchEvent()` returns.** It is a function call, not a
queued message.

```js
console.log('before');
el.dispatchEvent(new CustomEvent('thing'));   // every listener runs here, in order
console.log('after');
```

Consequences worth holding:

- **A slow listener blocks the dispatcher.** A component that emits an event in a loop is running
  every listener's work inline.
- **A throwing listener does not stop the others** — the error is reported and dispatch continues —
  but it does surface as an uncaught error.
- **Re-entrancy is possible.** A listener that dispatches the same event again recurses
  synchronously.

If you want the emitter to continue immediately, dispatch from a microtask
(`queueMicrotask(() => el.dispatchEvent(e))`) — but be deliberate, because ordering then depends on
the task queue.

## `cancelable` and the return value

```js
const event = new CustomEvent('cart:before-remove', {
  detail: { sku },
  cancelable: true,          // required, or preventDefault() does nothing
  bubbles: true,
});

if (!cartButton.dispatchEvent(event)) return;   // false ⇒ a listener cancelled it
removeItem(sku);
```

`dispatchEvent()` returns **`false` when `preventDefault()` was called on a cancelable event**, and
`true` otherwise. That is the whole "let a listener veto this" protocol — the same shape as the
platform's own `submit` and `beforeinput`.

📌 Without `cancelable: true`, `preventDefault()` is a no-op and the return value is always `true`.
Making it cancelable is a promise you are keeping: if you dispatch and then act regardless, the
option is a lie.

## Naming, and why the prefix matters

```js
'cart:item-added'      // ✅ namespaced, hyphenated, past tense
'itemAdded'            // ⚠️ camelCase collides with nothing, but reads unlike every DOM event
'change'               // 🔴 collides with the platform's own event
```

- **Namespace it** (`cart:`, `app:`, or your component's tag name). The event name lives in a
  global space shared with every built-in event and every third-party script on the page.
- **Never reuse a built-in name** — `change`, `input`, `error`, `load`. A listener written for the
  real one will receive yours and read properties that are not there.
- **Past tense for notifications** (`item-added`), **present or `before-` for cancelable
  intentions** (`before-remove`). The tense tells a reader whether cancelling is possible.

## Where to dispatch from

The target decides who can hear it, because listeners are found by walking **up** from the target:

| Dispatch on | Heard by |
|---|---|
| the component's own element | the component, and any ancestor if `bubbles: true` |
| `document` | anything, anywhere — a global bus |
| `window` | the same, plus cross-frame-adjacent code |
| a bare `new EventTarget()` | only code holding that object |

**Prefer the component's element with `bubbles: true`.** It keeps the event's origin meaningful —
`event.target` identifies which cart button — and it lets a container use one delegated listener
([04 · Event delegation](../04-event-delegation/README.md)).

⚠️ A `document`-level bus is convenient and untraceable: every event has the same target, so you
cannot tell instances apart, and every listener anywhere receives every event. Use it for genuinely
global concerns (a session expiring), not as the default.

## Shadow DOM: `composed`

```js
this.dispatchEvent(new CustomEvent('pill:change', {
  detail: { state },
  bubbles: true,
  composed: true,        // ← without this it stops at the shadow root
}));
```

🔴 **`bubbles: true` is not enough to escape a shadow root** — `composed: true` is what lets the
event cross the boundary, and it defaults to `false`. This is the same rule as
[Phase 9 · 18 · 03](../../phase-9-dom/18-shadow-dom-and-custom-elements/03-living-with-the-boundary.md),
and it is the most common reason a web component's events "do not work".

## Gotchas

**Symptom: the custom event never reaches your listener on `document`.**
Cause — `bubbles` defaults to `false`, so it fired only on the target.
Fix — `{ bubbles: true }`, or listen on the element you dispatched from.

**Symptom: `preventDefault()` in a listener changes nothing.**
Cause — the event was not created with `cancelable: true`.
Fix — set it, and check `dispatchEvent()`'s return value before proceeding.

**Symptom: a component's event never leaves its shadow root.**
Cause — `composed` defaults to `false`.
Fix — `{ bubbles: true, composed: true }`.

**Symptom: `e.detail` is `null`.**
Cause — the event was created with `new Event()`, or `detail` was omitted.
Fix — `new CustomEvent(type, { detail })`.

**Symptom: dispatching an event freezes the UI briefly.**
Cause — dispatch is synchronous; every listener's work runs inline.
Fix — keep listeners cheap, or dispatch from a microtask when the emitter must not wait.

**Symptom: a third-party script reacts to your event and breaks.**
Cause — the event name collides with a built-in or with another library's.
Fix — namespace it (`cart:item-added`).

**Symptom: an event fires twice.**
Cause — the same listener is registered on both the target and an ancestor while the event bubbles.
Fix — listen in one place; use `event.target` to tell instances apart.

## Interview questions

**★ What do `bubbles`, `cancelable` and `composed` default to on a custom event?**
All three default to `false`, and `detail` defaults to `null` — the opposite of most built-in
events. A custom event that "does not fire" has usually fired on its target with no bubbling.

**★ Is `dispatchEvent()` synchronous?**
Yes. Every listener runs to completion before it returns, so a slow listener blocks the emitter and
re-entrant dispatch recurses immediately.

**★ How does a listener veto a custom event?**
Create it with `cancelable: true`; the listener calls `preventDefault()`; the dispatcher checks
`dispatchEvent()`'s return value, which is `false` when it was cancelled.

**★ When would you use `new Event()` rather than `CustomEvent`?**
When there is no payload — the name is the whole message. `CustomEvent` exists for `detail`, and
subclassing `Event` is the third option when you want named properties instead.

**★ Why does a web component's event not reach the page?**
`composed: false` by default, so it stops at the shadow boundary. `bubbles` moves it up the tree;
`composed` lets it out.

**Where should a component dispatch its events?**
On its own element with `bubbles: true`, so `event.target` identifies the instance and containers
can use one delegated listener. A `document`-level bus loses that identity and delivers everything
to everyone.

---

[Topic index](./README.md) · [02 · Decoupling components](./02-decoupling-components.md) →
