---
title: "Cancelling a thunk, winning the race, and knowing when `createAsyncThunk` is the wrong tool"
sidebar_label: "Cancellation, races & limits"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createAsyncThunk`](https://redux-toolkit.js.org/api/createAsyncThunk),
> [RTK Query comparison](https://redux-toolkit.js.org/rtk-query/comparison).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 Cancellation, Races & The Limits of `createAsyncThunk`

**The lifecycle on [the previous page](./01-create-async-thunk.md) assumes one request at a time.**
Every hard bug in async Redux comes from the case it does not cover: two dispatches of the same thunk
in flight together, a component unmounting mid-request, or a response arriving after the user has
moved on. This chunk is that case.

## 1. Under-The-Hood Mechanics

### `abort()` is on the promise, not on the thunk

🔴 **`fetchUser.abort()` does not exist.** The action creator carries `.pending`, `.fulfilled`,
`.rejected` and their `.match` predicates — nothing else. Cancellation lives on the promise that
**dispatching** returns, which is the documented shape:

```typescript
// file: MyComponent.ts
const promise = dispatch(fetchUserById(props.userId));
return () => {
  promise.abort();
};
```

That is not pedantry about where a method hangs. The handle is **per dispatch**: to cancel something
you must be holding the promise from the exact call you want to stop. There is deliberately no way to
reach through the action creator and cancel "whatever is currently in flight" — that would require RTK
to keep a registry of live requests per thunk, which is precisely the cache-shaped problem it declines
to solve here.

### What `abort()` actually does, and what it does not

Aborting resolves the dispatch promise with a `rejected` action carrying `meta.aborted === true`, and
fires the `AbortSignal` handed to the payload creator as `thunkAPI.signal`. What it does **not** do is
stop your code. Nothing interrupts a running `async` function; the signal is a notification, and the
work continues unless something is listening. `fetch` listens only if you pass the signal to it.

### `requestId` — the identity that makes races solvable

Every lifecycle action carries `meta.requestId`, identical across the `pending`, `fulfilled` and
`rejected` of one dispatch, and different for every other dispatch. That is the whole basis of
last-write-wins: record the id at `pending`, compare it at `fulfilled`, and discard anything that no
longer matches.

## 2. Real-World Engineering Scenario

**Scenario**: A Search Box Where the Fast Query Loses.
A user types `rea`, then `react`. Both dispatches are in flight; `rea` matches ten thousand rows and
`react` matches twelve. The narrow query returns in 40ms, the broad one in 900ms — so the results the
user is looking at are replaced, a second later, by results for a prefix they have already finished
typing. Nothing errored, nothing was mis-dispatched, and no amount of loading-flag bookkeeping fixes
it: the state layer has to decide which response is still relevant.

## 3. Production-Grade Code Example

```typescript
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

interface Hit { id: string; title: string; }
interface SearchState {
  results: Hit[];
  currentRequestId: string | null;
  status: 'idle' | 'loading' | 'error';
}

export const search = createAsyncThunk<Hit[], string, { state: RootState }>(
  'search/run',
  async (term, { signal }) => {
    // Pass the signal through, or abort() is a no-op as far as the network is concerned
    const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal });
    return (await res.json()) as Hit[];
  },
);

const searchSlice = createSlice({
  name: 'search',
  initialState: { results: [], currentRequestId: null, status: 'idle' } as SearchState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(search.pending, (state, action) => {
        state.status = 'loading';
        state.currentRequestId = action.meta.requestId;   // this dispatch is now the only relevant one
      })
      .addCase(search.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;  // a slow loser — drop it
        state.status = 'idle';
        state.results = action.payload;
      })
      .addCase(search.rejected, (state, action) => {
        if (action.meta.aborted) return;                  // cancelled on purpose, not a failure
        if (state.currentRequestId !== action.meta.requestId) return;
        state.status = 'error';
      });
  },
});

export const searchReducer = searchSlice.reducer;
```

```tsx
// The component side: hold the promise so the cleanup can abort it
function SearchBox() {
  const dispatch = useAppDispatch();
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (!term) return;
    const promise = dispatch(search(term));
    return () => { promise.abort(); };   // superseded keystroke — cancel, don't just ignore
  }, [term, dispatch]);

  return <input value={term} onChange={(e) => setTerm(e.target.value)} />;
}
```

## Gotchas

### Ignoring `signal` after a cancellation
**Symptom.** Cancelled requests still resolve, dispatch `fulfilled`, and overwrite fresher data.
**Cause.** `.abort()` fires the signal, but nothing forces the payload creator to observe it. `fetch`
only aborts if you hand it the signal.
**Fix.** Pass it through, and let cancellation propagate rather than masking it as a network failure.
```typescript
const response = await fetch(`/users/${userId}`, { signal });
// … and in the catch:
if (signal.aborted) throw err;   // do NOT convert this into a NETWORK_ERROR
```

### Assuming the last `fulfilled` to arrive is the one you want
**Symptom.** Type-ahead search shows results for an earlier keystroke.
**Cause.** Nothing about `createAsyncThunk` orders responses. Two dispatches race and the slower one
lands last.
**Fix.** Compare `action.meta.requestId` against the request you last started, and ignore anything
else. Every lifecycle action carries the same `requestId`, which is exactly what it is for.
```typescript
.addCase(search.pending, (state, action) => { state.currentRequestId = action.meta.requestId; })
.addCase(search.fulfilled, (state, action) => {
  if (state.currentRequestId !== action.meta.requestId) return;  // a stale winner — drop it
  state.results = action.payload;
})
```
For anything more elaborate than this, `listenerMiddleware`'s `takeLatest`-style cancellation is the
better tool — see [the middleware page](../06-middleware/01-default-middleware-and-listener-middleware.md).

### Reaching for `createAsyncThunk` for plain server data
**Symptom.** Hundreds of lines of `pending`/`fulfilled`/`rejected` handlers that all say the same thing.
**Cause.** `createAsyncThunk` is a general async primitive, not a data-fetching cache. Used for CRUD it
reimplements caching, deduplication and invalidation by hand.
**Fix.** For server state, reach for [RTK Query](../04-rtk-query/01-api-slice-and-endpoints.md) instead;
RTK's own guidance is that `createAsyncThunk` is for async logic that is *not* simply "fetch and cache".
Keep it for orchestration: a checkout that reads state, calls two services and dispatches a sequence.

## Interview questions

**★ How do you cancel an in-flight thunk?**
Hold the promise that `dispatch()` returned and call `.abort()` on it — commonly from a `useEffect`
cleanup. It is not a method on the action creator; `fetchUser.abort()` does not exist, because the
handle has to identify one specific dispatch rather than a thunk in general. Aborting produces a
`rejected` action with `meta.aborted === true`.

**★ Does `abort()` stop the work?**
No. It resolves the dispatch and fires `thunkAPI.signal`, but nothing can interrupt a running `async`
function. The request keeps going unless something observes the signal — in practice, unless you passed
it to `fetch`. A payload creator that ignores `signal` will still complete and still dispatch, which is
how cancelled requests overwrite fresh data.

**A type-ahead search shows results for a keystroke the user has already replaced. Fix it.**
Race, not a bug in the thunk. Every lifecycle action carries `meta.requestId`; store the id from the
latest `pending` and ignore any `fulfilled` whose `requestId` no longer matches. The alternative — and
the better one once cancellation matters — is `listenerMiddleware` with `cancelActiveListeners()`, which
aborts the superseded request instead of merely discarding its result.

**When is `createAsyncThunk` the wrong tool?**
When the async work is "fetch server data and keep it fresh". That is a caching problem, and hand-rolling
it produces the same `pending`/`fulfilled`/`rejected` triple in every slice plus ad-hoc deduplication and
invalidation. RTK Query exists for exactly that. `createAsyncThunk` stays the right tool for orchestration
— sequences that read state, call several services and dispatch other actions.

**Why does every lifecycle action carry a `requestId`?**
So that concurrent dispatches of the same thunk remain distinguishable. It is stable across one
dispatch's `pending`/`fulfilled`/`rejected` and unique between dispatches, which is exactly what a
last-write-wins reducer needs: store the id at `pending`, compare at `fulfilled`, discard the mismatch.
Without it, the only identity available is the thunk itself, which every concurrent call shares.

**When you handle `rejected`, how do you tell a cancellation from a real failure?**
`action.meta.aborted` is `true` for an aborted dispatch, and `action.meta.condition` is `true` for one
short-circuited by `condition` with `dispatchConditionRejection` enabled. Neither should set an error
state — a cancelled request is an expected outcome. Treating them as failures is what produces error
toasts every time a user navigates away mid-load.

---

← [`createAsyncThunk`](./01-create-async-thunk.md) · [Topic index](../README.md) · Next → [RTK Query](../04-rtk-query/01-api-slice-and-endpoints.md)
