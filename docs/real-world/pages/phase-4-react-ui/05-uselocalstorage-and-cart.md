---
title: "useLocalStorage and the persisted cart"
sidebar_label: "05 · useLocalStorage"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN (Web Storage, `storage` event) and
> react.dev (`useSyncExternalStore`). Concept home:
> [JavaScript — web storage](../../../javascript/pages/README.md) (phase
> 11's storage pages own the platform facts).

## The problem

The cart's truth lives server-side
([chapter 3·06](../phase-3-express-api/06-cart-endpoints.md)) — so what is
localStorage for? Two narrow jobs: **instant cart-badge hydration** (the
item count paints before any fetch returns) and **checkout-form field
memory** (a returning guest's address fields). Both are *mirrors of
convenience*, never truth — and the hook is built so misusing it as truth
is awkward. The platform semantics (5 MB, string-only, synchronous, the
cross-tab `storage` event) are the JS section's; this chapter is the
React binding done right.

## The implementation

`useSyncExternalStore` is the correct primitive — localStorage is an
external store, and the naive `useState`-plus-effect binding tears across
tabs and breaks under concurrent rendering:

```jsx
// src/hooks/useLocalStorage.js
import {useCallback, useSyncExternalStore} from 'react';

const listeners = new Set();
function emit() { for (const l of listeners) l(); }

function subscribe(listener) {
  listeners.add(listener);                       // same-tab writes
  window.addEventListener('storage', listener);  // other-tab writes
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useLocalStorage(key, fallback) {
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key) ?? null;
    } catch {
      return null;                               // storage disabled: behave empty
    }
  }, [key]);

  const raw = useSyncExternalStore(getSnapshot, getSnapshot, () => null);

  const value = raw === null ? fallback : safeParse(raw, fallback);

  const set = useCallback((next) => {
    try {
      if (next === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(next));
    } catch { /* quota or disabled — the mirror just stays stale */ }
    emit();                                      // storage event ≠ same tab
  }, [key]);

  return [value, set];
}

function safeParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}
```

```jsx
// the badge — paints from the mirror, corrects from the server
function CartBadge() {
  const [mirror] = useLocalStorage('cart-summary', {count: 0});
  const {data} = useAsync((signal) => api('/cart', {signal}), []);
  const count = data ? data.items.length : mirror.count;
  return <span className="cart-badge" aria-label={`${count} items in cart`}>
    {count}
  </span>;
}

// the writer — cart mutations update the mirror as a side note
// (inside chapter 06's cart actions)
setCartMirror({count: updated.items.length});
```

## The rules

- **The mirror stores derivatives, never entities.** `{count}` and address
  *field* values — nothing the server owns (line items, prices), nothing
  sensitive ([tokens are cookie-only](../phase-3-express-api/03-auth/01-sessions.md),
  and the [token-storage page](../../../nodejs/pages/phase-8-security/03-token-storage.md)
  is why). A mirror that stores entities becomes a second source of truth
  the moment a fetch fails.
- **Server data always wins on arrival** — `data ? … : mirror.count`. The
  mirror's only privilege is being first.
- **Every read is guarded.** localStorage throws in private modes and
  under storage policies; raw is user-editable via devtools, so
  `safeParse` treats corruption as absence. A convenience layer must
  never be able to crash the app it serves.
- **`useSyncExternalStore` for a reason:** the `storage` event only fires
  in *other* tabs, so same-tab writers `emit()` through the local
  listener set; concurrent rendering reads a consistent snapshot; and
  the server-snapshot argument (`() => null`) keeps the hook SSR-safe.
  The [cross-tab pages](../../../javascript/pages/README.md) cover the
  event's semantics; the hook just wires both channels into one
  subscription.

## Gotchas

- **Symptom:** the badge shows 3, the cart page shows 2. **Cause:** a
  mutation path forgot the mirror write — the mirror is push-updated,
  and pushes can be missed. **Fix:** the mirror write lives inside the
  cart actions (chapter 06), the *only* module that mutates the cart;
  scattered `setCartMirror` calls are the review smell.
- **Symptom:** hydration warning / badge flicker under SSR or the dev
  server. **Cause:** reading localStorage during render on the server
  path (the naive `useState(() => localStorage.getItem(…))` init).
  **Fix:** the third `useSyncExternalStore` argument returns the server
  snapshot (`null` → fallback), so server and first client render agree,
  and the mirror value arrives in the post-hydration pass.
- **Symptom:** another tab's logout leaves this tab's badge populated.
  **Cause:** logout cleared the cookie (server truth) but not the
  mirror. **Fix:** chapter 09's logout clears the mirror keys too — the
  `storage` event then propagates the clearing to every tab, which is
  exactly the cross-tab path this hook subscribed to.

## Interview questions

1. **★ Why `useSyncExternalStore` instead of `useState` + effect?** Three
   failures of the naive version: cross-tab writes never update (no
   subscription), same-tab duplicate hooks desync (each has private
   state), and concurrent rendering can read mid-write states (tearing).
   `useSyncExternalStore` is React's contract for exactly this shape:
   one external source, one subscribe, snapshot-consistent reads.
2. **★ What belongs in localStorage in an app whose truth is
   server-side?** Derivatives that improve first paint (counts, UI
   preferences, draft field values) — data whose staleness or loss is
   cosmetically annoying and nothing more. The test: if a mismatch with
   the server requires *reconciliation logic*, it was truth, and it
   belonged on the server.
3. **Why does the `storage` event not fire in the writing tab, and how do
   you compensate?** By spec, it notifies *other* same-origin tabs — the
   writing tab already knows. Compensation is an in-process listener set
   the setter emits through — two channels, one subscription surface,
   which is precisely what the subscribe function merges.

---

← Prev: [`useForm` and the checkout form](04-useform-and-checkout.md) ·
Next → **Cart state** *(not written yet)*
