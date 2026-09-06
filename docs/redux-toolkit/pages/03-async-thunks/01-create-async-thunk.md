---
title: "`createAsyncThunk`: Async Lifecycle, `thunkAPI` & Cancellation"
sidebar_label: "`createAsyncThunk`"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk),
> [matching utilities](https://redux-toolkit.js.org/api/matching-utilities).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 `createAsyncThunk`: Async Lifecycle, `thunkAPI` & Cancellation

## 1. Under-The-Hood Mechanics

`createAsyncThunk(typePrefix, payloadCreator)` wraps a Promise-returning function and auto-dispatches **three** plain action types across its lifecycle — this is the entire mechanism; there is no separate async middleware beyond the `redux-thunk` already in RTK's default stack.

```
dispatch(fetchUser(userId))
        │
        ├──► dispatch({ type: 'user/fetch/pending', meta: { requestId, arg } })
        │
        ▼
   payloadCreator(arg, thunkAPI) runs
        │
        ├── resolves ──► dispatch({ type: 'user/fetch/fulfilled', payload, meta })
        └── rejects  ──► dispatch({ type: 'user/fetch/rejected', error, meta })
```

### `thunkAPI` — The Second Argument
Every `payloadCreator` receives `(arg, thunkAPI)`, where `thunkAPI` exposes:
- `dispatch` / `getState` — full store access, for reading current state or chaining actions.
- `rejectWithValue(value)` — returns a **typed** rejection payload instead of throwing, so `action.payload` (not just `action.error`) carries structured error info in the `rejected` case.
- `fulfillWithValue(value, meta)` — attaches extra `meta` to a successful action.
- `signal` — an `AbortController.signal`, automatically aborted if the thunk is cancelled or a `condition` short-circuits it.
- `extra` — the "extra argument" injected via `configureStore({ middleware: getDefaultMiddleware({ thunk: { extraArgument } }) })`, typically an API client instance.

### The `condition` Option
`condition: (arg, { getState }) => boolean` runs **before** the `pending` action is even dispatched.
Returning `false` skips the entire thunk — the docs are explicit that "the default behavior is that no
actions will be dispatched at all" — which is the standard way to deduplicate in-flight requests for
the same resource.

🔴 **"No actions at all" is the part that bites.** A component that flips its own loading flag *before*
dispatching, and expects `pending`/`rejected` to flip it back, hangs forever on a short-circuited
thunk. If you need the rejection, opt into it: `{ condition, dispatchConditionRejection: true }`
dispatches a `rejected` action carrying `meta.condition === true`, so you can tell a deduplicated call
apart from a genuine failure.

### What `dispatch(thunk())` Returns
Dispatching a thunk returns a promise, and that promise is **not** the payload creator's promise. It
resolves with the final **action object** — `fulfilled` or `rejected` — and it does not reject on
failure. Two things hang off it:

- **`.abort()`** — cancels this dispatch, firing the `signal` inside the payload creator.
- **`.unwrap()`** — converts the action back into a conventional promise: resolves with the payload on
  success, and **throws** on rejection. This is what you want at a call site that needs `try`/`catch`.

```typescript
// The action-object form: never throws, so a try/catch around it catches nothing
const action = await dispatch(fetchUser(id));
if (fetchUser.fulfilled.match(action)) { /* action.payload is typed here */ }

// The unwrapped form: throws, so ordinary error handling works
try {
  const user = await dispatch(fetchUser(id)).unwrap();
} catch (err) {
  // the rejectWithValue payload, or the serialised error
}
```

---

## 2. Real-World Engineering Scenario

**Scenario**: Deduplicated User Profile Fetch With Typed Error Handling.
A profile page and a sidebar widget both mount `useEffect(() => dispatch(fetchUser(id)))` independently. Without `condition`, this fires two identical network requests. With `condition` checking `state.users.status === 'loading'`, the second dispatch is a no-op. Meanwhile, a 404 from the API should surface a specific "user not found" UI state distinct from a network failure — achieved via `rejectWithValue` carrying a typed error shape.

---

## 3. Production-Grade Code Example

```typescript
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface FetchUserError {
  code: 'NOT_FOUND' | 'NETWORK_ERROR';
  message: string;
}

export const fetchUser = createAsyncThunk<
  UserProfile,                          // Returned type on success
  string,                                 // Argument type (userId)
  { rejectValue: FetchUserError; extra: { api: { get: (url: string) => Promise<Response> } } }
>(
  'users/fetchUser',
  async (userId, { rejectWithValue, extra, signal }) => {
    try {
      const response = await extra.api.get(`/users/${userId}`);
      if (response.status === 404) {
        return rejectWithValue({ code: 'NOT_FOUND', message: `User ${userId} does not exist.` });
      }
      if (!response.ok) {
        return rejectWithValue({ code: 'NETWORK_ERROR', message: `HTTP ${response.status}` });
      }
      return (await response.json()) as UserProfile;
    } catch (err) {
      if (signal.aborted) throw err; // Let cancellation propagate, don't mask it as a network error
      return rejectWithValue({ code: 'NETWORK_ERROR', message: (err as Error).message });
    }
  },
  {
    // Skip dispatch entirely if a fetch for this exact user is already in flight
    condition: (userId, { getState }) => {
      const state = getState() as RootState;
      const entry = state.users.byId[userId];
      return entry?.status !== 'loading';
    },
  }
);

interface UsersState {
  byId: Record<string, { data: UserProfile | null; status: 'idle' | 'loading' | 'error'; error: FetchUserError | null }>;
}

const usersSlice = createSlice({
  name: 'users',
  initialState: { byId: {} } as UsersState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state, action) => {
        state.byId[action.meta.arg] = { data: null, status: 'loading', error: null };
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.byId[action.meta.arg] = { data: action.payload, status: 'idle', error: null };
      })
      .addCase(fetchUser.rejected, (state, action) => {
        // action.payload is the typed FetchUserError (present only when rejectWithValue was used)
        state.byId[action.meta.arg] = {
          data: null,
          status: 'error',
          error: action.payload ?? { code: 'NETWORK_ERROR', message: action.error.message ?? 'Unknown error' },
        };
      });
  },
});

export const usersReducer = usersSlice.reducer;
```

---

## Gotchas

### `try`/`catch` around `dispatch(thunk())` that never catches
**Symptom.** A failing request shows no error UI, and the `catch` block provably never runs — but the
`rejected` action *is* in the DevTools log.
**Cause.** The promise returned by dispatching resolves with the rejected **action object**; it does
not reject. From the caller's point of view nothing threw.
**Fix.** `.unwrap()` when you want exception semantics, or match on the action when you do not.
```typescript
// ❌ catch never fires
try { await dispatch(fetchUser(id)); } catch { showError(); }

// ✅ unwrap re-throws the rejection
try { await dispatch(fetchUser(id)).unwrap(); } catch (err) { showError(err); }
```

### Throwing where a typed error was needed
**Symptom.** `action.payload` is `undefined` in the `rejected` case and all you have is a string.
**Cause.** A thrown error is serialised onto `action.error`; only `rejectWithValue` populates
`action.payload`.
**Fix.**
```typescript
// ❌ Loses structured error info — action.payload is undefined, only action.error.message is available
if (!response.ok) throw new Error('Not found');

// ✅ CORRECT: rejectWithValue makes the error shape available on action.payload with full typing
if (!response.ok) return rejectWithValue({ code: 'NOT_FOUND', message: 'Not found' });
```
Declare it in the generics too — without `{ rejectValue: FetchUserError }` the payload types as
`unknown` at every handler.

### A `condition` that silently strands the UI
**Symptom.** A spinner that never stops, only when the user triggers the same fetch twice quickly.
**Cause.** `condition` returning `false` dispatches **nothing** — no `pending`, no `rejected`. Any
loading state the caller set by hand is never cleared.
**Fix.** Either derive loading state from the `pending` action only (never set it manually before
dispatch), or opt into the rejection so there is always a terminal action:
```typescript
{ condition: (id, { getState }) => !isLoading(getState(), id), dispatchConditionRejection: true }
// handlers can then check action.meta.condition to distinguish "deduplicated" from "failed"
```

### One global `status` flag for a thunk that runs per-id
**Symptom.** Two profile widgets load different users; one shows the other's spinner, or a stale
result wins.
**Cause.** `status: 'loading'` at the slice root cannot represent "user A loading while user B is
done". The last `pending` wins and the first `fulfilled` clears it.
**Fix.** Key async state by the thunk's argument, which is always available as `action.meta.arg`:
```typescript
.addCase(fetchUser.pending, (state, action) => {
  state.byId[action.meta.arg] = { data: null, status: 'loading', error: null };
})
```

## Interview questions

**★ What does `createAsyncThunk` actually generate, and what runs it?**
It generates one action creator with three lifecycle action creators hanging off it —
`.pending`, `.fulfilled`, `.rejected` — and a payload creator wrapper that dispatches them around your
promise. There is **no** new middleware involved: it runs on the `redux-thunk` already in the default
stack. That is the whole mechanism, and it is why a slice consumes it through `extraReducers` like any
other foreign action.

**★ Why does `await dispatch(myThunk())` not throw when the request fails?**
Because it resolves with the final action object rather than the payload. Rejection is data, not an
exception, which is what lets reducers handle it uniformly. `.unwrap()` opts back into exception
semantics — resolve with the payload, throw on rejection — and is the right call at a component-level
`try`/`catch`.

**★ `rejectWithValue` versus throwing — what actually differs?**
Where the information lands. A throw is serialised onto `action.error` (message, name, stack), losing
any structure. `rejectWithValue(value)` puts `value` on `action.payload`, typed via the `rejectValue`
generic, so the reducer can distinguish "user not found" from "network down" without parsing strings.
`isRejectedWithValue` then matches only the deliberate route.

**★ How do you stop two components from firing the same request twice?**
`condition`, which runs before `pending` and short-circuits the whole thunk when it returns `false`. The
trap worth naming is that it dispatches *nothing at all* by default, so any manually-set loading flag is
never cleared — either derive loading purely from `pending`, or pass `dispatchConditionRejection: true`
and check `action.meta.condition`.

**What is `thunkAPI.extra`, and why would you use it over importing your API client?**
It is an arbitrary value injected once at store construction —
`getDefaultMiddleware({ thunk: { extraArgument: { api } } })` — and handed to every payload creator. It
turns the API client into a dependency of the store rather than a module-level import, so tests can
build a store with a fake client without mocking module resolution. Type it through the `extra` key of
the `ThunkApiConfig` generic.


---

← [`createAction` & matchers](../02-slices-and-actions/02-create-action-and-matchers.md) · [Topic index](../README.md) · Next → [Cancellation, races & limits](./01b-cancellation-races-and-limits.md)
