---
title: "Code Splitting: `combineSlices` & `injectEndpoints`"
sidebar_label: "Code Splitting"
sidebar_position: 1
---

# 📦 Code Splitting: `combineSlices` & `injectEndpoints`

## 1. Under-The-Hood Mechanics

A store built with a static `reducer: { a, b, c }` object requires every slice's code to be bundled and loaded upfront — fine for small apps, wasteful for large ones with route-based code splitting where most users never visit most routes. RTK supports **dynamic reducer injection**: adding a slice's reducer to the live store only once its owning route/feature actually loads.

```
Initial store: combineSlices(coreSlice)
        │
        ▼ (user navigates to /settings, triggering a dynamic import)
settingsSlice module loads ──► store.inject(settingsSlice)
        │
        ▼
Store's root reducer is REPLACED with a new combined reducer including settingsSlice,
and store.replaceReducer() is called internally so existing subscribers keep working seamlessly.
```

### `combineSlices()`
RTK 2.x's `combineSlices(...slices)` (as the `reducer` argument to `configureStore`) returns a combined reducer object that also exposes an `.inject(slice)` method — calling it at any point after store creation merges in a new slice's reducer under its `name` key, backed by `store.replaceReducer()` under the hood, and lazily hydrates that slice's `initialState` for any already-existing state (e.g. persisted from `localStorage`) if provided.

### `injectEndpoints()` for RTK Query
Since a single `createApi()` instance is meant to be shared across the whole app (see [RTK Query endpoints](../04-rtk-query/01-api-slice-and-endpoints.md)), feature code doesn't create new `createApi()` calls — it calls `baseApi.injectEndpoints({ endpoints: (builder) => ({...}) })` from within its own feature folder, adding new query/mutation endpoints to the shared API slice without the base API module needing to know about every feature in advance.

---

## 2. Real-World Engineering Scenario

**Scenario**: Large Admin Panel With 40 Rarely-Visited Settings Pages.
Most users of an admin panel touch 3-4 of its 40 settings pages in a given session. Bundling all 40 settings slices + their RTK Query endpoints into the initial JS bundle would meaningfully hurt first-load performance for the 95% of users who never open most pages. Route-level code splitting (`React.lazy(() => import('./BillingSettingsPage'))`) paired with `store.inject(billingSlice)` and `baseApi.injectEndpoints(...)` inside that same lazy-loaded module means the settings page's Redux logic only ever downloads and registers itself when a user actually navigates there.

---

## 3. Production-Grade Code Example

```typescript
// app/store.ts — core store with only always-needed slices upfront
import { configureStore, combineSlices } from '@reduxjs/toolkit';
import { authSlice } from '../features/auth/authSlice';
import { baseApi } from '../features/api/baseApi';

const rootReducer = combineSlices(authSlice, {
  [baseApi.reducerPath]: baseApi.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
```

```typescript
// features/billing/billingSlice.ts — loaded only when the billing route is visited
import { createSlice } from '@reduxjs/toolkit';
import { store } from '../../app/store';

export const billingSlice = createSlice({
  name: 'billing',
  initialState: { invoices: [] as string[] },
  reducers: {
    invoicesLoaded: (state, action) => { state.invoices = action.payload; },
  },
});

// Register this slice's reducer into the live store the moment this module is imported
store.inject(billingSlice);
```

```typescript
// features/billing/billingApi.ts — extending the shared baseApi, not creating a new createApi()
import { baseApi } from '../api/baseApi';

export const billingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoices: builder.query<string[], void>({ query: () => '/billing/invoices' }),
  }),
});

export const { useGetInvoicesQuery } = billingApi;
```

```tsx
// routes.tsx — the dynamic import is what actually triggers billingSlice/billingApi registration
const BillingPage = React.lazy(() => import('../features/billing/BillingPage'));
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Reading Injected Slice State Before It's Injected
```typescript
// ❌ WRONG: if BillingPage hasn't been visited yet this session, state.billing is undefined —
// a selector written assuming it always exists will throw or silently misbehave
const invoices = useSelector((state: RootState) => state.billing.invoices);

// ✅ CORRECT: guard for the not-yet-injected case, or only read this selector from within
// components that are themselves inside the lazy-loaded feature (guaranteeing injection already ran)
const invoices = useSelector((state: RootState) => state.billing?.invoices ?? []);
```

### ⚠️ Pitfall 2: Creating a Second `createApi()` Instead of `injectEndpoints`
As covered in the [RTK Query endpoints](../04-rtk-query/01-api-slice-and-endpoints.md) section, a feature module calling its own `createApi()` fragments the cache and duplicates middleware registration — dynamic code splitting is exactly the scenario `injectEndpoints()` was designed for for this reason.

### ⚠️ Pitfall 3: Forgetting Injection Is Idempotent-but-Not-Free
Calling `store.inject(billingSlice)` multiple times (e.g. if the lazy module is re-imported) is safe — RTK's injection is idempotent for the same slice — but each `.inject()` call still triggers a `replaceReducer()` internally. Guarding injection to run once per slice (e.g. checking a `whenSelectorReady`-style flag, or simply relying on ES module caching so the top-level `store.inject()` call only executes once) avoids unnecessary reducer-replacement churn.
