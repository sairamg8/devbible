---
title: "Cart state"
sidebar_label: "06 · Cart state"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against react.dev (context, `useReducer`,
> `useOptimistic` caveats). Concept home:
> [React — refs, context and reducers](../../../react/pages/phase-5-refs-context-reducers/README.md)
> and [share logic, not state](../../../react/pages/phase-7-custom-hooks/03-share-logic-not-state/README.md).

## The problem

The cart is read by the badge, the drawer, the cart page and checkout —
and written from product cards, quantity steppers and remove buttons.
That is context territory. The hard requirement is **optimistic add**:
tapping "add to cart" must feel instant (the button is the app's
heartbeat), while the server remains the truth and failures roll back
visibly. One reducer holds the choreography.

## The implementation

```jsx
// src/cart/CartProvider.jsx
import {createContext, useContext, useEffect, useReducer, useRef} from 'react';
import {api} from '../lib/api.js';

const CartContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'server': return {items: action.items, pending: state.pending};
    case 'optimistic': {
      const items = state.items.some((i) => i.product_id === action.item.product_id)
        ? state.items.map((i) => i.product_id === action.item.product_id
            ? {...i, quantity: action.item.quantity} : i)
        : [...state.items, action.item];
      return {
        items: action.item.quantity === 0
          ? items.filter((i) => i.product_id !== action.item.product_id)
          : items,
        pending: state.pending + 1,
      };
    }
    case 'settle': return {...state, pending: state.pending - 1};
    case 'rollback': return {items: action.items, pending: state.pending - 1};
    default: throw new Error(`unknown action ${action.type}`);
  }
}

export function CartProvider({children, setCartMirror}) {
  const [state, dispatch] = useReducer(reducer, {items: [], pending: 0});
  const serverItems = useRef([]);                  // last confirmed truth

  useEffect(() => {                                // initial load
    const c = new AbortController();
    api('/cart', {signal: c.signal}).then((cart) => {
      serverItems.current = cart.items;
      dispatch({type: 'server', items: cart.items});
    }).catch(() => {});
    return () => c.abort();
  }, []);

  async function setQuantity(product, quantity) {
    const before = serverItems.current;
    dispatch({type: 'optimistic', item: {
      product_id: product.product_id ?? product.id,
      slug: product.slug, name: product.name,
      price_cents: product.price_cents, quantity, available: true,
    }});
    try {
      await api(`/cart/items/${product.product_id ?? product.id}`,
        {method: 'PUT', body: {quantity}});
      const cart = await api('/cart');             // re-read the truth
      serverItems.current = cart.items;
      dispatch({type: 'server', items: cart.items});
      dispatch({type: 'settle'});
      setCartMirror({count: cart.items.length});   // ch. 05's badge mirror
    } catch (err) {
      dispatch({type: 'rollback', items: before});
      throw err;                                   // caller shows the toast
    }
  }

  return (
    <CartContext.Provider value={{...state, setQuantity}}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart outside CartProvider');
  return ctx;
}
```

```jsx
// a writer — the add button, instant and honest
function AddToCart({product}) {
  const {items, setQuantity} = useCart();
  const current = items.find((i) => i.product_id === product.id)?.quantity ?? 0;
  return (
    <button onClick={() =>
      setQuantity(product, current + 1).catch(() => toast('Could not add — try again'))
    }>
      Add to cart
    </button>
  );
}
```

## The choreography, spelled out

1. **Optimistic:** the reducer applies the intended state instantly;
   `pending` increments (the drawer can show a subtle syncing hint).
2. **Confirm:** the idempotent `PUT`
   ([chapter 3·06's verb](../phase-3-express-api/06-cart-endpoints.md))
   lands; the follow-up `GET` re-reads *the server's* cart — which may
   differ from the optimistic guess (a price changed, an item merged) —
   and `server` replaces wholesale. The optimistic entry was a
   placeholder, never a fork.
3. **Rollback:** on failure, state returns to the last *confirmed* truth
   (`serverItems.current`), not to a diff-reversal — undoing "my change"
   is fragile when two writes overlap; restoring "last known truth" is
   always coherent.

Why not `useOptimistic`? It scopes optimism to a transition and reverts
automatically — beautiful for a single action's lifetime, awkward for a
*store* whose optimistic states overlap and whose truth arrives from
re-reads. The reducer owns a longer-lived choreography; `useOptimistic`
is the right tool one level down (chapter 08 uses it for upload
progress rows).

## Design notes

- **Context carries state that is genuinely global; the provider sits
  once, in the app shell.** Re-render cost is real (every consumer on
  every cart change) and acceptable at this consumer count; the
  [context-performance material](../../../react/pages/phase-5-refs-context-reducers/README.md)
  covers the split-context escalation if a hot consumer appears.
- **`setQuantity` is the *only* writer** — and it is also where the
  [chapter 05 mirror](05-uselocalstorage-and-cart.md) updates, which is
  what made "the mirror is push-updated from one place" a fact rather
  than a hope.
- **The PUT-then-GET pair is deliberate** over trusting the PUT's echo:
  the GET returns the cart as the *server* composed it (merges, price
  updates, availability), and it is the same read the cart page uses —
  one shape, no drift. Cost: one extra round trip per mutation, on an
  action whose perceived latency is already zero.
- **Login integration:** after
  [merge-on-login](../phase-3-express-api/06-cart-endpoints.md), the auth
  flow (chapter 09) calls the provider's reload — the merged cart arrives
  as a `server` action like any other truth.

## Gotchas

- **Symptom:** rapid +/+/+ on the stepper ends at quantity 2, not 3.
  **Cause:** each tap computed `current + 1` from stale state — two taps
  read the same `current`. **Fix:** steppers dispatch *absolute* targets
  from the rendered value (the UI's stepper widget tracks its own
  target), or serialize taps; the idempotent PUT means the last write
  honestly wins — which is the semantic the spec chose.
- **Symptom:** a failed add leaves the badge wrong until refresh.
  **Cause:** the mirror updated in the optimistic branch. **Fix:** as
  written — the mirror writes *only* in the confirmed branch; optimism
  is for React state, not for persisted mirrors.
- **Symptom:** "cart flickers" on slow networks — item appears, vanishes,
  reappears. **Cause:** `server` replacing state between the optimistic
  apply and the settle when *another* mutation's GET returned in
  between. **Fix:** the `pending` counter exists for this: consumers may
  hold rendering of removals while `pending > 0` — a UX choice the state
  makes possible; at this app's mutation rate the simple version rarely
  shows it.

## Interview questions

1. **★ Why roll back to last-confirmed truth instead of reverting the
   optimistic diff?** Diff-reversal assumes the optimistic change is the
   only delta between local and truth — false the moment two optimistic
   writes overlap or the server transformed the write (merge, clamp).
   Restoring a snapshot is unconditionally coherent, and the snapshot is
   free: it is whatever the last `server` action carried.
2. **★ Why re-GET after a successful PUT instead of applying the PUT
   locally?** The server's cart is *composed* — availability flags, merged
   guest items, prices as of now. Locally applying the PUT forks that
   composition into a second implementation that must chase the first.
   The re-read makes the client's cart definitionally identical to the
   cart page's, at the price of a background round trip.
3. **Why a reducer rather than `useState` calls in the provider?** The
   transitions are the specification: optimistic/settle/rollback/server
   name exactly what may happen to the cart, and illegal states
   (negative pending, forked items) have no constructor. With scattered
   `useState`, the choreography lives in call sites; with a reducer it
   is one auditable function — the same argument as the API's single
   error funnel.
4. **When does this outgrow context+reducer?** When consumers multiply
   and re-renders hurt (split contexts or a selector-based store), or
   when cache semantics grow past one resource (normalized entities,
   invalidation graphs — chapter 12's TanStack Query discussion). The
   cart alone never gets there; knowing what *would* move it is the
   answer interviewers want.

---

← Prev: [`useLocalStorage` and the persisted cart](05-uselocalstorage-and-cart.md) ·
Next → [Modal, portal and focus trap](07-modal-portal-focus.md)
