---
title: "Slice selectors and the `reducers` creator callback: two RTK 2.0 additions to `createSlice`"
sidebar_label: "`createSlice` · selectors & creators"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createSlice`](https://redux-toolkit.js.org/api/createSlice),
> [RTK 2.0 migration](https://redux-toolkit.js.org/usage/migrating-rtk-2).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Slice Selectors & The `reducers` Creator Callback

**`createSlice` grew two capabilities in RTK 2.0 that most existing code — and every tutorial written
before 2024 — does not use.** Neither is required: the object form of `reducers` on
[the previous page](./01-create-slice.md) is fully supported and is what most of this corpus writes.
Both exist to remove a specific coupling, and it is worth knowing which coupling each one removes.

## 1. Under-The-Hood Mechanics

### Two RTK 2.0 additions this page used to predate

**`slice.selectors` — selectors that travel with the slice.** Instead of every consumer knowing where
in the tree the slice lives, declare selectors against the slice's *own* state and let RTK rebase them:

```typescript
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: { /* … */ },
  selectors: {
    // `state` here is CartState, not RootState — the slice does not know its own mount point
    selectItemCount: (state) => state.items.length,
    selectSubtotalCents: (state) => state.items.reduce((n, i) => n + i.priceCents * i.quantity, 0),
  },
});

// Rebased onto RootState automatically, using the slice's `name` as the path
export const { selectItemCount, selectSubtotalCents } = cartSlice.selectors;
```
If the slice is mounted under a different key, `cartSlice.getSelectors((root) => root.checkout.cart)`
gives you the same selectors rebased onto that path instead.

**The `reducers` creator callback — thunks declared inside the slice.** The object form is still fully
supported and is what the rest of this page uses. The callback form additionally lets a slice declare
its own async thunk and prepared reducers in place, rather than defining them outside and wiring them
through `extraReducers`:

```typescript
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: (create) => ({
    couponApplied: create.reducer<string>((state, action) => { state.couponCode = action.payload; }),
    itemAdded: create.preparedReducer(
      (productId: string, priceCents: number) => ({ payload: { productId, priceCents, quantity: 1 } }),
      (state, action) => { state.items.push(action.payload); },
    ),
    syncCart: create.asyncThunk(
      async (cartId: string) => (await fetch(`/api/carts/${cartId}`)).json(),
      {
        pending: (state) => { state.status = 'syncing'; },
        fulfilled: (state, action) => { state.status = 'idle'; state.items = action.payload; },
        rejected: (state) => { state.status = 'error'; },
      },
    ),
  }),
});
```
⚠️ Using `create.asyncThunk` requires building the slice with `buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } })`
rather than the plain `createSlice` import — RTK keeps it opt-in so that apps not using it do not pay
for `createAsyncThunk` in their bundle.

## 2. Real-World Engineering Scenario

**Scenario**: A Slice That Gets Remounted During a Micro-Frontend Migration.
A `cart` slice lives at `state.cart` in the monolith. Mid-migration it has to be mounted under
`state.checkout.cart` inside a host application, while the old route still serves the original path.
Every hand-written selector (`state => state.cart.items`) is a compile error in the new mount and a
silent `undefined` in the old one. Slice-owned selectors turn that migration into one line per mount
point — `cartSlice.getSelectors(root => root.checkout.cart)` — because the slice never claimed to know
its own address in the first place.

## 3. Production-Grade Code Example

```typescript
import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit';

// The opt-in build: only this createSlice can use create.asyncThunk
const createAppSlice = buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } });

interface Invoice { id: string; totalCents: number; }
interface BillingState { invoices: Invoice[]; status: 'idle' | 'loading' | 'error'; }

const billingSlice = createAppSlice({
  name: 'billing',
  initialState: { invoices: [], status: 'idle' } as BillingState,
  reducers: (create) => ({
    cleared: create.reducer((state) => { state.invoices = []; }),
    fetchInvoices: create.asyncThunk(
      async (customerId: string, { rejectWithValue }) => {
        const res = await fetch(`/api/customers/${customerId}/invoices`);
        if (!res.ok) return rejectWithValue(`HTTP ${res.status}`);
        return (await res.json()) as Invoice[];
      },
      {
        pending: (state) => { state.status = 'loading'; },
        fulfilled: (state, action) => { state.status = 'idle'; state.invoices = action.payload; },
        rejected: (state) => { state.status = 'error'; },
      },
    ),
  }),
  selectors: {
    selectInvoices: (state) => state.invoices,
    selectOutstandingCents: (state) => state.invoices.reduce((n, i) => n + i.totalCents, 0),
  },
});

export const { cleared, fetchInvoices } = billingSlice.actions;
export const { selectInvoices, selectOutstandingCents } = billingSlice.selectors;
export const billingReducer = billingSlice.reducer;
```

## Gotchas

### `create.asyncThunk` on a plain `createSlice` import
**Symptom.** A runtime error the moment the slice is constructed, saying the `asyncThunk` creator is
not available — not a type error, so it survives `tsc` and fails at import time.
**Cause.** RTK keeps the async creator opt-in so that apps not using it do not pull `createAsyncThunk`
into their bundle. The plain `createSlice` export simply has no `create.asyncThunk` on its callback.
**Fix.** Build your own `createSlice` once, and export it.
```typescript
// app/createAppSlice.ts — import this everywhere instead of createSlice
import { buildCreateSlice, asyncThunkCreator } from '@reduxjs/toolkit';
export const createAppSlice = buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } });
```

### Writing `selectors` against `RootState`
**Symptom.** `undefined` reading a property, or a type error saying the slice's state has no such key.
**Cause.** The `selectors` field receives the **slice's own state**, not the root. Writing
`(state) => state.cart.items` inside `cartSlice` looks for `items` on `state.cart.cart`.
**Fix.** Drop the slice's own name — `(state) => state.items`. The rebasing onto `RootState` is what
RTK does for you.

### Assuming `slice.selectors` finds the slice wherever it is mounted
**Symptom.** Selectors work in the app and return `undefined` in a test, or after a slice is moved.
**Cause.** The automatic rebasing uses the slice's `name` as the path — it assumes the slice is mounted
at `state[name]`. Mount it anywhere else and the assumption is silently wrong.
**Fix.** Be explicit at the non-default mount point.
```typescript
export const { selectInvoices } = billingSlice.getSelectors(
  (root: RootState) => root.checkout.billing,
);
```

### Reaching for the creator callback expecting it to replace `extraReducers`
**Symptom.** You convert a slice to the callback form and find nowhere to handle another slice's
actions.
**Cause.** The two solve different problems. The callback lets a slice declare its **own** thunks and
prepared reducers inline; it says nothing about foreign actions.
**Fix.** Keep `extraReducers` alongside it. A slice using `create.asyncThunk` for its own fetches still
uses `extraReducers` to reset itself on `logout`.

## Interview questions

**What does `slice.selectors` solve that a plain exported selector does not?**
Coupling to the mount point. A hand-written `state => state.cart.items` bakes in where the slice lives,
so moving it under `checkout.cart` breaks every consumer. `slice.selectors` are written against the
slice's own state and rebased by RTK using the slice's `name`, and `slice.getSelectors(rootSelector)`
rebases them anywhere else. The slice stops needing to know its own address.

**Why is `create.asyncThunk` opt-in rather than available from the plain `createSlice` import?**
Bundle size. Wiring `createAsyncThunk` into every `createSlice` call would pull it into apps that never
use it, so RTK makes you assemble the creator explicitly with
`buildCreateSlice({ creators: { asyncThunk: asyncThunkCreator } })`. It is a deliberate trade of one
line of setup against what every consumer would otherwise ship.
**★ Why would you write `selectors` inside `createSlice` rather than exporting plain functions?**
To stop the slice from having to know where it is mounted. A plain `state => state.cart.items` encodes
the mount point in every consumer, so relocating the slice — a micro-frontend host, a differently
shaped test store — breaks all of them. Slice-owned selectors are written against the slice's own state
and rebased by RTK, with `getSelectors(rootSelector)` as the escape hatch for any non-default mount.

**Is the creator callback a replacement for the object form of `reducers`?**
No, and there is no deprecation involved — both are fully supported and the object form remains the
common case. The callback adds capability: `create.asyncThunk` and `create.preparedReducer` let a slice
own its async lifecycle in one place instead of defining a thunk outside and wiring it back through
`extraReducers`. Choose it when a slice's thunks are genuinely its own.

---

← [`createSlice`](./01-create-slice.md) · [Topic index](../README.md) · Next → [`createAction` & matchers](./02-create-action-and-matchers.md)
