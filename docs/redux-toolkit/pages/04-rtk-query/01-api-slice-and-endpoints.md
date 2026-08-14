---
title: "RTK Query: `createApi`, Query & Mutation Endpoints"
sidebar_label: "RTK Query"
sidebar_position: 1
---

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

### Query vs Mutation Endpoints
- **`builder.query()`** — for reads (GET-like). Automatically deduplicates identical in-flight requests, caches by serialized `arg`, and refetches based on subscription lifecycle (mount, focus, reconnect, poll interval).
- **`builder.mutation()`** — for writes (POST/PUT/DELETE-like). No caching by argument — every call executes fresh — but can declare `invalidatesTags` to trigger re-fetches of related queries (see [cache management](./02-cache-management-and-invalidation.md)).

### Reference-Counted Cache Subscriptions
Every component calling `useGetPostQuery(id)` increments a subscriber count for the cache entry keyed by `(endpointName, serializedArg)`. When the last subscriber unmounts, RTK Query starts a cleanup timer (`keepUnusedDataFor`, default 60s) before evicting that cache entry — this is why navigating back to a page you just left often shows data instantly with no loading spinner.

---

## 2. Real-World Engineering Scenario

**Scenario**: Blog Platform With Shared Post Cache Across List and Detail Views.
A post list page and a post detail page both need the same `Post` data. Instead of each view independently managing `useState`/`useEffect`/loading flags, both call `useGetPostQuery(postId)` from the same generated hook. RTK Query normalizes this into one shared cache entry — if the user already saw the post in the list (which fetched a paginated set), and RTK Query cache logic can serve related data instantly on navigating to the detail view once tags line up (see cache management), avoiding a duplicate network round-trip.

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

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: One `createApi` Instance Per Feature (Should Be One Per App)
```typescript
// ❌ WRONG: separate createApi() calls per feature fragment the cache and duplicate middleware
export const postsApi = createApi({ reducerPath: 'postsApi', ... });
export const usersApi = createApi({ reducerPath: 'usersApi', ... });

// ✅ CORRECT: one base API slice per app, features add endpoints via injectEndpoints()
// (see code splitting → injectEndpoints)
```
RTK Query is explicitly designed around **a single `createApi` per base URL/service**, with feature code using `injectEndpoints()` to extend it — not one instance per feature.

### ⚠️ Pitfall 2: Forgetting `query` Object Form for Non-GET Requests
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

### ⚠️ Pitfall 3: Reading Stale `data` Immediately After a Mutation Resolves
Calling `updatePost(...)` and expecting `data` from a sibling `useGetPostByIdQuery` to update in the same tick is a race — the mutation's promise resolving does **not** by itself refetch other queries. You must declare `invalidatesTags`/`providesTags` (or manually `dispatch(apiSlice.util.invalidateTags(...))`) for RTK Query to know these two endpoints are related — see [cache management](./02-cache-management-and-invalidation.md).
