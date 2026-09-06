---
title: "RTK Query: `createApi`, Query & Mutation Endpoints"
sidebar_label: "RTK Query"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the Redux Toolkit documentation for **@reduxjs/toolkit 2.12.0** —
> [`createApi`](https://redux-toolkit.js.org/rtk-query/api/createApi),
> [cache behaviour](https://redux-toolkit.js.org/rtk-query/usage/cache-behavior).
> Documentation-validated; **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 3a6945a3

# 📦 RTK Query: `createApi`, Query & Mutation Endpoints

## 1. Under-The-Hood Mechanics

RTK Query is not a separate library — it's a `createSlice`-like code generator that produces an entire reducer, middleware, and set of React hooks from a single declarative `createApi()` call. It replaces hand-written `createAsyncThunk` + loading-state boilerplate for server data.

```
createApi({ baseQuery, endpoints, reducerPath })
        │
        ├── reducerPath ──► the store key this API's cache lives under (e.g. state.api)
        ├── baseQuery ──► fetchBaseQuery({ baseUrl }) — a fetch() wrapper handling headers/auth/errors
        └── endpoints(builder) ──► builder.query() / builder.mutation() per operation
                    │
                    ▼
        Auto-generated per endpoint:
          - use<EndpointName>Query() / use<EndpointName>Mutation() React hooks
          - api.endpoints.<name>.select(arg) — memoized cache selector
          - api.endpoints.<name>.initiate(arg) — the underlying thunk-like dispatch
```

### The Three Endpoint Types
- **`builder.query()`** — for reads (GET-like). Deduplicates identical in-flight requests, caches by
  serialized `arg`, and refetches based on subscription lifecycle (mount, focus, reconnect, poll).
- **`builder.mutation()`** — for writes (POST/PUT/DELETE-like). No caching by argument — every call
  executes fresh — but can declare `invalidatesTags` to trigger re-fetches of related queries (see
  [cache management](./02-cache-management-and-invalidation.md)).
- **`builder.infiniteQuery()`** — for paginated datasets held as one cache entry of many pages. Covered
  with `queryFn` and the transforms on
  [the next page](./01b-queryfn-transforms-and-infinite-queries.md).

### Reference-Counted Cache Subscriptions
Every component calling `useGetPostQuery(id)` increments a subscriber count for the cache entry keyed by `(endpointName, serializedArg)`. When the last subscriber unmounts, RTK Query starts a cleanup timer (`keepUnusedDataFor`, default 60s) before evicting that cache entry — this is why navigating back to a page you just left often shows data instantly with no loading spinner.

---

## 2. Real-World Engineering Scenario

**Scenario**: Blog Platform With Shared Post Cache Across List and Detail Views.
A post list page and a post detail page both need `Post` data. Instead of each view managing its own
`useState`/`useEffect`/loading flags, both call generated hooks from the same API slice.

🔴 **Be precise about what is shared, because this is where people over-claim.** `getPosts` and
`getPostById('1')` are **separate cache entries** — the key is `(endpointName, serializedArg)`, so a
list query does **not** populate the detail query's entry, and tags do not transfer data between them
either (tags cause *refetching*, never *filling*). What you genuinely get is: every component asking
for the same endpoint+arg shares one entry and one request, no matter how far apart they are in the
tree; and navigating back within `keepUnusedDataFor` renders from cache with no spinner. If you truly
want the list to seed the detail entry, that is an explicit
`api.util.upsertQueryData('getPostById', id, post)` call — see
[cache management](./02-cache-management-and-invalidation.md).

---

## 3. Production-Grade Code Example

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../app/store';

interface Post {
  id: string;
  title: string;
  body: string;
  authorId: string;
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set('authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], { page: number }>({
      query: ({ page }) => `/posts?page=${page}`,
    }),
    getPostById: builder.query<Post, string>({
      query: (id) => `/posts/${id}`,
    }),
    createPost: builder.mutation<Post, Partial<Post>>({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
    }),
    updatePost: builder.mutation<Post, { id: string; changes: Partial<Post> }>({
      query: ({ id, changes }) => ({ url: `/posts/${id}`, method: 'PATCH', body: changes }),
    }),
    deletePost: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `/posts/${id}`, method: 'DELETE' }),
    }),
  }),
});

export const {
  useGetPostsQuery,
  useGetPostByIdQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
} = apiSlice;
```

```tsx
function PostDetail({ postId }: { postId: string }) {
  const { data: post, isLoading, isError, error } = useGetPostByIdQuery(postId);
  const [updatePost, { isLoading: isSaving }] = useUpdatePostMutation();

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorBanner message={String(error)} />;

  return (
    <article>
      <h1>{post!.title}</h1>
      <button
        disabled={isSaving}
        onClick={() => updatePost({ id: postId, changes: { title: 'Edited Title' } })}
      >
        {isSaving ? 'Saving…' : 'Save Title'}
      </button>
    </article>
  );
}
```

---

## Gotchas

### One `createApi` per feature
**Symptom.** Tag invalidation stops working across features — updating a user does not refresh the
user list, though both endpoints clearly exist.
**Cause.** Automatic tag invalidation works only **within** a single API slice. Two `createApi` calls
are two independent caches with two middlewares, and neither can see the other's tags.
**Fix.** One API slice per **base URL / service**, extended from feature folders.
```typescript
// ❌ WRONG: separate createApi() calls per feature fragment the cache and duplicate middleware
export const postsApi = createApi({ reducerPath: 'postsApi', ... });
export const usersApi = createApi({ reducerPath: 'usersApi', ... });

// ✅ CORRECT: one base API slice per service, features add endpoints via injectEndpoints()
export const billingApi = baseApi.injectEndpoints({ endpoints: (builder) => ({ /* … */ }) });
```
⚠️ Note the unit is the **service**, not the app. An app talking to two genuinely separate backends
legitimately has two API slices — you simply cannot invalidate across them.

### Returning a bare string from a non-GET `query`
**Symptom.** A "successful" mutation that changes nothing on the server.
**Cause.** The string form of `query` builds a **GET** to that URL. The body you meant to send is
silently dropped, and the server answers the GET happily.
**Fix.** Return the `FetchArgs` object whenever the method is not GET.
```typescript
// ❌ WRONG: query() defaults to a GET request to the returned URL string
createPost: builder.mutation<Post, Partial<Post>>({
  query: (body) => '/posts', // body is silently dropped, request is GET not POST!
}),

// ✅ CORRECT: return the FetchArgs object form with method + body
createPost: builder.mutation<Post, Partial<Post>>({
  query: (body) => ({ url: '/posts', method: 'POST', body }),
}),
```

### Expecting a mutation to refresh other queries on its own
**Symptom.** A detail view updates after saving; a list still shows the old value until a reload.
**Cause.** A resolved mutation promise is not a cache event. Nothing connects two endpoints unless you
declare the relationship.
**Fix.** `providesTags` on the queries, `invalidatesTags` on the mutation — or an explicit
`dispatch(api.util.invalidateTags([...]))`. Fully worked in
[cache management](./02-cache-management-and-invalidation.md).

### Reading `data` without handling the moment it is `undefined`
**Symptom.** `Cannot read properties of undefined` on the first render of a detail page, or a crash
after an arg change that people "fix" with `data!`.
**Cause.** `data` is `undefined` before the first successful response **and** — this is the part that
surprises — while an *arg change* is being fetched, if there is no cache entry for the new arg.
`isLoading` is true only for the first load of a given entry; `isFetching` is true for any in-flight
request including a refetch.
**Fix.** Branch on the flags, and reach for `isFetching` when the distinction matters.
```tsx
const { data, isLoading, isFetching, isError } = useGetPostByIdQuery(postId);
if (isLoading) return <Spinner />;            // no cached data at all yet
if (isError) return <ErrorBanner />;
return <article className={isFetching ? 'stale' : ''}>{data!.title}</article>;
```

### A new object or array literal as the query argument
**Symptom.** An endless refetch loop, or a cache entry per render.
**Cause.** Cache keys are the **serialized** argument, but the hook also compares the arg to decide
whether it changed. A fresh `{ page: 1 }` literal each render is a new reference every time.
**Fix.** Hoist the argument, memoise it, or pass primitives. `useGetPostsQuery({ page })` inside a
component that re-renders often should have `page` come from state, not be rebuilt inline from several
values.

### Forgetting `setupListeners` and wondering why focus refetching is dead
**Symptom.** `refetchOnFocus` / `refetchOnReconnect` are set and nothing happens.
**Cause.** Those options describe *intent*; the browser events are wired by a separate call. The docs
say plainly: "this requires `setupListeners` to have been called."
**Fix.** Once, at app init, next to the store:
```typescript
import { setupListeners } from '@reduxjs/toolkit/query';
setupListeners(store.dispatch);
```

### Assuming the cache entry dies the moment the component unmounts
**Symptom.** A "stale" value briefly appears when returning to a page, or a colleague insists the data
was refetched when it was not.
**Cause.** Subscriptions are reference-counted; when the last one goes away the entry survives for
`keepUnusedDataFor`, **default 60 seconds**, before removal.
**Fix.** Treat 60s as a real window. Shorten it per-endpoint for sensitive or fast-moving data
(`keepUnusedDataFor: 5`), and remember that a remount inside the window renders cached data first —
which is a feature until the data is a bank balance.

## Interview questions

**★ What does one `createApi` call actually generate?**
A reducer (the cache slice, mounted at `reducerPath`), a middleware that drives subscriptions, cache
lifetime, invalidation and polling, and — from the `/react` entry point — a hook per endpoint. It also
exposes `api.endpoints.<name>.initiate(arg)` (the underlying thunk), `.select(arg)` (a memoised
selector) and `api.util` for manual cache work. Both the reducer and the middleware must be added to
the store; with only the reducer, almost everything silently does nothing.

**★ How is a cache entry keyed, and what follows from that?**
By `(endpointName, serializedArg)`. Two components asking for the same endpoint and the same argument
share one entry and one in-flight request regardless of where they sit in the tree — that is the
deduplication. It also means `getPosts` and `getPostById('1')` are unrelated entries: a list does not
populate a detail view, and no tag will make it do so, because tags trigger refetching rather than
filling. Seeding one from the other is an explicit `upsertQueryData`.

**★ Why is one API slice per service recommended rather than one per feature?**
Because automatic tag invalidation only works inside a single API slice, and each instance adds its own
middleware. Split by feature and a mutation in one slice can never invalidate a query in another, so you
end up hand-rolling cross-cache messaging. Features extend the shared slice with `injectEndpoints`,
which also keeps their endpoints out of the initial bundle.

**★ What is the difference between `isLoading` and `isFetching`?**
`isLoading` means there is no cached data for this entry yet — the true first load. `isFetching` means a
request is in flight for any reason, including a background refetch over data you already have. A
full-page spinner belongs on `isLoading`; a subtle staleness indicator that does not blank the screen
belongs on `isFetching`. Using `isLoading` for both is why refetches look like nothing is happening.

**When does data leave the cache?**
Not at unmount. Subscriptions are reference-counted, and when the count reaches zero a timer starts —
`keepUnusedDataFor`, default 60 seconds — after which the entry is removed. That window is why
navigating back to a page you just left is instant, and why a value you expected to be refetched can
still be the old one.

**A mutation succeeds but the list on screen does not update. Where do you look?**
First at whether the relationship is declared at all: a resolved mutation is not a cache event, so
without `providesTags`/`invalidatesTags` nothing connects them. Then at whether the tags actually
overlap — a create that invalidates only `{ type: 'User', id: result.id }` never touches the list's
`'LIST'` tag. Then at whether the list still has an active subscriber, since RTK Query refetches
invalidated entries only while something is subscribed. Then at whether `api.middleware` is installed.

**When would you reach for RTK Query over `createAsyncThunk`?**
Whenever the async work is "fetch server data and keep it fresh". Hand-written thunks reproduce the same
`pending`/`fulfilled`/`rejected` triple in every slice, then grow ad-hoc deduplication, cache lifetime
and invalidation — which is the problem RTK Query already solved declaratively. Thunks stay the right
tool for orchestration that is not a cache: a checkout that reads state, calls two services in order and
dispatches other actions.

---

← [Cancellation, races & limits](../03-async-thunks/01b-cancellation-races-and-limits.md) · [Topic index](../README.md) · Next → [`queryFn`, transforms & infinite queries](./01b-queryfn-transforms-and-infinite-queries.md)
