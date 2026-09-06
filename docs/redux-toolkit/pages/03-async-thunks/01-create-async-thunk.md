---
title: "`createAsyncThunk`: Async Lifecycle, `thunkAPI` & Cancellation"
sidebar_label: "`createAsyncThunk`"
sidebar_position: 1
---

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
`condition: (arg, { getState }) => boolean` runs **before** the `pending` action is even dispatched. Returning `false` skips the entire thunk silently (no actions dispatched at all) — the standard way to deduplicate in-flight requests for the same resource.

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Throwing Instead of `rejectWithValue` When Typed Errors Are Needed
```typescript
// ❌ Loses structured error info — action.payload is undefined, only action.error.message (a string) is available
if (!response.ok) throw new Error('Not found');

// ✅ CORRECT: rejectWithValue makes the error shape available on action.payload with full typing
if (!response.ok) return rejectWithValue({ code: 'NOT_FOUND', message: 'Not found' });
```

### ⚠️ Pitfall 2: Ignoring `signal` — Wasted Work After Cancellation/Unmount
🔴 **`abort()` lives on the promise `dispatch()` returns, never on the thunk itself.**
`fetchUser.abort()` does not exist — the action creator has `.pending`/`.fulfilled`/`.rejected`
and nothing else. The documented shape is:

```typescript
const promise = dispatch(fetchUser(props.userId));
return () => { promise.abort(); };   // e.g. the cleanup returned from useEffect
```

That matters beyond the typo: the handle is per-dispatch, so cancelling means keeping the promise
from the exact call you want to stop — there is no way to reach back through the action creator and
cancel "whatever is in flight".

If a component dispatches a thunk and unmounts before it resolves (whether cancelled through that
promise handle, or superseded by `condition`), a `payloadCreator` that ignores `signal` still runs to completion and dispatches a `fulfilled` action into a state shape nothing reads anymore — wasted network and CPU, and potential stale-data bugs if a newer request resolves first.

### ⚠️ Pitfall 3: Reading `state.users.status` As a Single Global Flag for Multiple Concurrent Requests
A single top-level `status: 'loading'` flag cannot represent "user A is loading while user B already loaded" — race conditions between two different `arg` values will stomp each other's status. Key async state by the thunk's `arg` (as shown above with `byId[action.meta.arg]`), not by a single flat flag, whenever the same thunk can be in flight for multiple distinct inputs simultaneously.
