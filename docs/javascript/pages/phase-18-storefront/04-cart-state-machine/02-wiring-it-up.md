---
title: "04.2 · Wiring it to the UI and the server"
sidebar_label: "02 · Wiring it up"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`QuotaExceededError`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException). Documentation-validated; **no timings**.

**The state machine is pure; the wiring is where it meets reality** — a store with subscribers,
persistence that can fail, other tabs, and a server that disagrees.

## A store in twenty lines

```js
function createStore(reducer, initial) {
  let state = initial;
  const listeners = new Set();

  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;                    // 🔴 no-op: do not notify
      state = next;
      for (const l of [...listeners]) l(state);      // 🔴 copy before iterating
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);       // 🔴 return the unsubscribe
    },
  };
}
```

Three details, each a real bug:

- 🔴 **`if (next === state) return`** — this is why the transitions return the *same* object for a
  no-op (an unknown SKU, setting a quantity to its current value). Reference equality makes
  "nothing changed" free to detect, and it stops a re-render per keystroke on a quantity field.
- 🔴 **Copy the listener set before iterating.** A listener that unsubscribes during notification
  mutates the set mid-iteration — the same class of bug as the `EventEmitter`'s
  mutation-during-emit.
- 🔴 **`subscribe` returns its own unsubscribe.** A subscribe that returns nothing forces callers to
  keep the exact function reference to remove it later, and every forgotten one is a leak
  ([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).

## Persistence

```js
const KEY = "cart:v2";                                // 🔴 version in the key

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, ...state }));
  } catch (err) {
    if (err.name === "QuotaExceededError") return;    // 🔴 degrade, do not crash
    throw err;
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return migrate(parsed);                           // 🔴 validate AND migrate
  } catch {
    return EMPTY;                                     // corrupt → start clean
  }
}
```

⚠️ **`localStorage` fails in more ways than people expect**, and every one of them must degrade
rather than throw:

- **Quota exceeded** — `QuotaExceededError`. A cart is small, but the quota is shared with
  everything else on the origin.
- **Disabled entirely** — private mode in some browsers, or a policy. **Accessing
  `localStorage` can throw**, so even the read needs a `try`.
- **Corrupt JSON** — a half-written value, or a different version of the app.
- 🔴 **A different shape from an older release.** This is the common one, and it is why the version
  belongs **in the key or in the payload** with a `migrate` step. Without it, an old cart shape
  crashes the new code on load — for every returning user at once.

⚠️ **Validate on load, do not trust.** `localStorage` is user-editable: a negative quantity or a
tampered `unitPrice` arrives as easily as a real one. **Prices must be re-fetched from the server
anyway**, which is [05 · Money](../05-money-and-rounding/README.md) and
[Phase 12 · 02 · 01](../../phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md).

**Debounce the save.** A quantity stepper held down writes on every tick, and `localStorage` is
synchronous and blocks the main thread.

## Other tabs

```js
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;                          // 🔴 fires for every key
  store.replace(load());
});
```

🔴 **The `storage` event fires in *other* tabs, not the one that wrote** — which is exactly what you
want and is the opposite of most people's first guess. It also fires for **every** key on the
origin, so filtering by `e.key` is required.

**`BroadcastChannel` is the better mechanism** where available — it carries structured data, is not
tied to storage, and does not require serialising:

```js
const channel = new BroadcastChannel("cart");
channel.postMessage({ type: "changed", state });
channel.onmessage = (e) => store.replace(e.data.state);
```

⚠️ **Both need loop protection.** Applying a received update must not re-broadcast it, or two tabs
ping-pong forever. A flag around the apply, or an origin id on the message.

## The server, and who wins

🔴 **The client cart is a draft; the server cart is the truth.** For a logged-out user the local
cart is all there is, but the moment it syncs, three questions need answers **decided in advance**:

| Situation | Decision |
|---|---|
| Local and server both have items (after login) | **merge**, summing quantities per SKU — losing a user's items is worse than a surprising quantity |
| An item is out of stock server-side | remove it and **say so** — silently dropping it is the worst option |
| The price changed | take the **server** price and surface the change before checkout |
| Quantity exceeds stock | clamp to available, and tell the user |

⚠️ **"Last write wins" is not a strategy for a cart** — it silently discards whichever side the user
did not expect to lose. Merging is more code and it is the behaviour users assume.

🔴 **And every one of these must be visible.** A cart that quietly changes between the page and the
checkout is how users lose trust in a store — the change is fine, the silence is not.

## Gotchas

**Symptom:** A re-render on every keystroke in a quantity field
**Cause:** The reducer returns a new object even for a no-op.
**Fix:** Return the same state, and skip notification on reference equality.

**Symptom:** A listener is skipped during notification
**Cause:** Another listener unsubscribed mid-iteration.
**Fix:** Iterate a copy of the set.

**Symptom:** Listeners accumulate
**Cause:** `subscribe` returns nothing, so callers cannot unsubscribe reliably.
**Fix:** Return the unsubscribe function.

**Symptom:** The app crashes on load for returning users after a release
**Cause:** An old cart shape in `localStorage`.
**Fix:** A version in the key or payload, plus a `migrate` step.

**Symptom:** A crash in private mode
**Cause:** Accessing `localStorage` can throw when it is unavailable.
**Fix:** Wrap reads and writes; degrade to in-memory.

**Symptom:** `QuotaExceededError` breaks checkout
**Cause:** Persistence failure treated as fatal.
**Fix:** Catch it and continue in memory.

**Symptom:** Cross-tab sync does not fire in the tab that changed it
**Cause:** `storage` fires in *other* tabs by design.
**Fix:** Expected — update the writing tab locally.

**Symptom:** A `storage` handler runs for unrelated keys
**Cause:** The event fires for every key on the origin.
**Fix:** Check `e.key`.

**Symptom:** Two tabs update each other forever
**Cause:** Applying a received update re-broadcasts it.
**Fix:** A guard flag or an origin id.

**Symptom:** Items vanish after login
**Cause:** The server cart replaced the local one.
**Fix:** Merge, and surface every change.

## Interview questions

**★ Why does the reducer return the *same* object for a no-op?**
So the store can detect "nothing changed" with reference equality and skip notifying subscribers.
Without it a quantity field that re-sets the same value re-renders on every keystroke.

**★ What breaks if you iterate the listener set directly?**
A listener that unsubscribes during notification mutates the collection mid-iteration and another
listener gets skipped. Iterate a copy.

**★ Name three ways `localStorage` fails.**
Quota exceeded (`QuotaExceededError`); unavailable entirely, where **even accessing it can throw**;
and holding a **shape from an older release** — the common one, which is why the schema version
belongs in the key or payload with a `migrate` step.

**★ Which tab receives the `storage` event?**
The **other** tabs — not the one that wrote. It also fires for every key on the origin, so you must
filter by `e.key`. `BroadcastChannel` is the better mechanism where available, and both need loop
protection.

**★ A logged-out user has a local cart and then signs in to an account with items. What happens?**
Merge, summing quantities per SKU. "Last write wins" silently discards one side, and losing a
user's items is worse than a surprising quantity — but **every adjustment must be surfaced**.

**★ Can you trust what you load from `localStorage`?**
No — it is user-editable, so quantities and prices can be tampered with. Validate on load, and
re-fetch prices from the server regardless; the client price is a display value, never an input to
what is charged.

**Why debounce the save?**
Because `localStorage` is synchronous and blocks the main thread, and a held-down quantity stepper
writes on every tick.

---

← [01 · The state machine](./01-the-state-machine.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
