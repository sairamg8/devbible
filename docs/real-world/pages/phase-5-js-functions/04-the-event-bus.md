---
title: "The event bus"
sidebar_label: "04 · The event bus"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN (`EventTarget`, `CustomEvent`). Concept
> home: [JS — an EventEmitter](../../../javascript/pages/phase-17-machine-coding/05-eventemitter/README.md)
> and [pub/sub and signals](../../../javascript/pages/phase-17-machine-coding/17-pubsub-and-signals/README.md)
> build the machinery; this chapter decides what may ride it.

## The problem

Three consumers care when an order is placed: the toast system
("Order #1042 confirmed ✓"), the analytics module, and the cart badge.
Wiring checkout to call all three couples the checkout flow to every
future listener; a bus decouples them. But app-wide event buses are also
how React codebases rot — state changes sneaking around props and
context until nothing is traceable. So this chapter is half
implementation, half **constitution**: what events exist, what may
listen, and what the bus is banned from carrying.

## The implementation

Phase 17 built an emitter from scratch to teach the mechanics; in
application code the platform's `EventTarget` is the emitter — typed
event names, options like `once`, zero code to own:

```js
// src/lib/bus.js
const bus = new EventTarget();

/** The event catalogue — the ONLY names the bus accepts. Adding one is a
 *  design decision and a PR review, not a string. */
export const EVENTS = Object.freeze({
  ORDER_PLACED: 'order:placed',        // {orderId, totalCents, itemCount}
  SESSION_EXPIRED: 'session:expired',  // {} — 4·09's broadcast, re-homed
  TOAST: 'toast',                      // {kind, text}
  ANALYTICS: 'analytics',              // {name, props} — the outbound firehose
});

export function emit(name, detail = {}) {
  if (!Object.values(EVENTS).includes(name)) {
    throw new Error(`unknown event ${name} — add it to EVENTS first`);
  }
  bus.dispatchEvent(new CustomEvent(name, {detail}));
}

export function on(name, handler, {signal} = {}) {
  const wrapped = (e) => handler(e.detail);
  bus.addEventListener(name, wrapped, {signal});   // AbortSignal-based cleanup
  return () => bus.removeEventListener(name, wrapped);
}
```

```js
// producers — checkout announces a FACT, knowing nothing of listeners
import {emit, EVENTS} from '../lib/bus.js';
emit(EVENTS.ORDER_PLACED, {orderId: order.id,
  totalCents: order.total_cents, itemCount: items.length});
```

```jsx
// a React consumer — subscription lifetime = component lifetime
import {useEffect} from 'react';
import {on, EVENTS} from '../lib/bus.js';

function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    on(EVENTS.ORDER_PLACED, ({orderId}) =>
      pushToast({kind: 'success', text: `Order #${orderId} confirmed`}),
      {signal: controller.signal});
    on(EVENTS.TOAST, pushToast, {signal: controller.signal});
    return () => controller.abort();     // one abort tears down every listener
  }, []);
  // …render the stack
}
```

```js
// a non-React consumer — analytics, batched and fire-and-forget
on(EVENTS.ANALYTICS, (event) => analyticsBatcher.add(event));
on(EVENTS.ORDER_PLACED, ({totalCents, itemCount}) =>
  emit(EVENTS.ANALYTICS, {name: 'purchase', props: {totalCents, itemCount}}));
```

## The constitution

The rules that keep the bus from becoming the architecture:

1. **Events are facts, past-tense, app-level.** `order:placed`,
   `session:expired` — things that *happened*, named in domain language.
   Never commands (`cart:add` — that is a function call wearing a
   disguise) and never component-level chatter (a dropdown closing is
   props' business).
2. **State never rides the bus.** Listeners may *react* (show a toast,
   send analytics, invalidate a cache) but no listener may be the
   *source of truth* for anything. The cart updates through
   [its provider](../phase-4-react-ui/06-cart-state.md); the bus at most
   tells the badge mirror to refresh. The test: unplug every listener
   and the app must still be *correct* — only quieter.
3. **The catalogue is closed.** `emit` throws on unknown names — four
   events after four phases is the healthy rate; a bus with forty
   event names is a state manager that grew in the dark. (Phase 6
   types `EVENTS`' payloads, making the catalogue compile-checked.)
4. **Listeners are exception-isolated by the platform** — one throwing
   listener doesn't stop the others (`dispatchEvent` semantics), which
   is half the reason to prefer `EventTarget` over the hand-rolled
   emitter where phase 17's error-handling caveats apply.

## Gotchas

- **Symptom:** a toast appears twice per order. **Cause:** `ToastHost`
  mounted twice (a layout refactor), or Strict Mode's double effect
  without the cleanup — each mount subscribed. **Fix:** the
  `AbortController` teardown as written survives Strict Mode; double
  *mounting* is the layout bug it exposed. Buses amplify subscription
  hygiene failures — which is an argument for few listeners, not for
  no bus.
- **Symptom:** analytics shows purchases that failed. **Cause:** the
  emit sat before the `await` on checkout — announcing an intention,
  not a fact. **Fix:** rule 1's tense is literal: emit *after* the
  operation's promise resolves, in the success path only. The place the
  emit lives is part of the event's meaning.
- **Symptom:** a feature "works only when the settings page has been
  visited". **Cause:** rule 2 violated — a listener in the settings
  screen became the writer of some state, so its subscription's
  existence is load-bearing. **Fix:** move the write to an owner that
  always exists (provider, module); the bus resumes being decoration.
  This is *the* failure mode that gave event buses their reputation.

## Interview questions

1. **★ When is an event bus the right tool in a React app that already
   has context?** For cross-cutting *reactions* between unrelated
   subsystems — analytics, toasts, logging — where the producer must
   not know its consumers and no shared state is involved. Context
   shares *state* down a tree; a bus broadcasts *facts* across trees.
   The moment a bus event carries state a consumer stores, you have
   rebuilt context with worse tooling.
2. **★ Why `EventTarget` over the phase-17 emitter in production?**
   Platform-maintained, listener-exception isolation, `once`/`signal`
   options, devtools familiarity — and it keeps the hand-rolled
   emitter where it belongs, as the exercise that teaches what these
   options cost to build. Owning code is a liability to justify, not a
   default.
3. **What makes past-tense naming more than style?** Tense encodes
   coupling direction. `order:placed` (fact) lets the producer proceed
   identically whether zero or ten listeners exist. `cart:add`
   (command) means someone *must* handle it — the producer now depends
   on a listener's existence, invisibly, which is a function call with
   the stack trace removed. The grammar is the architecture.

---

← Prev: [The concurrency-limited task queue](03-the-task-queue.md) ·
Next → **The form validation engine** *(not written yet)*
