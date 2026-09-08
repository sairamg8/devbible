---
title: "An RTK Query endpoint is a declaration in a slice; a TanStack query is a key plus a function — the translation unit is a queryOptions factory, and the tag→key step over-invalidates unless you know prefix matching from identity matching"
sidebar_label: "01c · Endpoints → queryOptions"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Query Invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) — and, for the RTK side, this corpus's validated [`createApi` page](../../../redux-toolkit/pages/04-rtk-query/01-api-slice-and-endpoints.md) and [cache management page](../../../redux-toolkit/pages/04-rtk-query/02-cache-management-and-invalidation.md). Documentation-validated; **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8** · **@reduxjs/toolkit 2.12.0**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🧱 Endpoints Become Factories, Tags Become Prefixes

**RTK Query's unit of work is an *endpoint declared inside a slice*: a name, an argument type, a URL builder, and its tag declarations, all registered in one central object that generates hooks for you. TanStack Query's unit is a *query key plus a function*, and nothing registers it anywhere.** That difference is the whole port. The mechanical half — moving the URL builder into a `queryFn` — takes an afternoon. The half that produces bugs is `providesTags`/`invalidatesTags`, because RTK matches tags by **identity** and TanStack matches keys by **prefix**, and a literal translation of a tag list to a key silently widens or narrows what a mutation refreshes.

## 1. The two shapes, side by side

Here is a real RTK Query slice — the same one the Redux Toolkit track uses — with tags on it:

```typescript
// api/usersApi.ts — RTK Query: one registry, generated hooks, tag graph
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set('authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], { page: number; q: string }>({
      query: ({ page, q }) => `/users?page=${page}&q=${encodeURIComponent(q)}`,
      transformResponse: (raw: UserDto[]) => raw.map(toUser),
      providesTags: (result) =>
        result
          ? [{ type: 'User', id: 'LIST' }, ...result.map((u) => ({ type: 'User' as const, id: u.id }))]
          : [{ type: 'User', id: 'LIST' }],
    }),
    getUserById: builder.query<User, string>({
      query: (id) => `/users/${id}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
  }),
});

export const { useGetUsersQuery, useGetUserByIdQuery } = usersApi;
```

And the TanStack Query equivalent. There is no registry, so the thing that replaces it is a module you write by hand: a **key factory** and an **options factory**.

```typescript
// api/http.ts — the replacement for fetchBaseQuery. Nothing ships; you own this.
export class HttpError extends Error {
  constructor(readonly status: number, readonly body: unknown, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();                       // wherever your session lives now
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new HttpError(res.status, body, `${init.method ?? 'GET'} ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

```typescript
// api/users.ts — the endpoint replacement: keys in one place, options in another.
import { queryOptions } from '@tanstack/react-query';
import { http } from './http';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: { page: number; q: string }) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const userQueries = {
  list: (filters: { page: number; q: string }) =>
    queryOptions({
      queryKey: userKeys.list(filters),
      queryFn: async () => {
        const raw = await http<UserDto[]>(
          `/users?page=${filters.page}&q=${encodeURIComponent(filters.q)}`,
        );
        return raw.map(toUser);          // transformResponse lives HERE — it is cached
      },
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: userKeys.detail(id),
      queryFn: () => http<User>(`/users/${id}`),
    }),
};
```

Call sites then read `useQuery(userQueries.detail(id))`, and every other consumer of that query — a prefetch, a `setQueryData`, an `invalidateQueries`, a `useSuspenseQuery` — takes the **same object or the same key factory**. That is the property `createApi` gave you for free and that ad-hoc `useQuery({ queryKey: ['users', id], … })` calls scattered through components destroy.

⚠️ `queryOptions()` is a v5 helper whose job is to tie the key to the `queryFn`'s return type so that `queryClient.getQueryData(userQueries.detail(id).queryKey)` is typed rather than `unknown`. **I could not re-confirm its reference page on 2026-09-08** — `https://tanstack.com/query/latest/docs/framework/react/reference/*` pages have been returning `{"isNotFound":true}` throughout this validation pass. The *pattern* is version-proof either way: a plain function returning a `{ queryKey, queryFn }` object works identically, minus the type tie.

## 2. What you actually gained and lost by deleting the registry

| `createApi` gave you | After the port |
|---|---|
| one file listing every server operation | nothing — until you write the `userQueries` module above |
| generated `use*Query` hooks, correctly typed | `useQuery(userQueries.x())`, typed through `queryOptions` |
| `injectEndpoints` for code splitting | free — each factory module is an ordinary import |
| `prepareHeaders`, error normalisation, `baseUrl` | your `http.ts`; nothing equivalent ships |
| tags resolved late, so a new query joins the graph automatically | keys resolved early, so a new query is only covered if its key sits under a prefix somebody already invalidates |
| every operation greppable by endpoint name | every operation greppable by key factory — **only if you have one** |

🔴 **The single decision that determines whether this migration ages well is whether keys are built in one module or inline at call sites.** Inline keys are the TanStack equivalent of stringly-typed action types: `['users', id]` in one component and `['user', id]` in another are two caches, and nothing warns you. There is no compiler error and no runtime error — just a second network request and a stale panel.

## 3. `transformResponse` → inside `queryFn`, not `select`

RTK Query's `transformResponse` runs once, before the value enters the cache, so the cache holds the transformed shape. `select` in TanStack Query runs **per observer over the cached raw value**, so the cache holds the response.

- Port `transformResponse` **into `queryFn`** when the transform is the canonical shape — parsing dates, unwrapping `{ data: … }`, mapping DTOs. Anything that later reads `getQueryData` sees the transformed shape, which is what your RTK code assumed.
- Use **`select`** only for per-component derivation — "this component needs just the count" — where the point is that different observers want different views of the same cached value.

Porting a `transformResponse` into `select` compiles, renders correctly, and quietly leaves untransformed data in the cache; the failure surfaces later, in the first `setQueryData` or `getQueryData` that assumes otherwise.

## 4. 🔴 Tags are matched by identity. Keys are matched by prefix.

This is the trap, and it is worth being exact about both models before translating.

**RTK Query.** A tag is `{ type, id }`. Invalidating `{ type: 'User', id: '7' }` marks stale exactly those cache entries whose `providesTags` returned that same pair. Invalidating the bare type — `invalidatesTags: ['User']` — matches every entry providing that type, which is why the Redux Toolkit track flags it as the standard over-invalidation bug. There is **no hierarchy**: `{ type: 'User', id: 'LIST' }` and `{ type: 'User', id: '7' }` are two unrelated strings as far as matching is concerned.

**TanStack Query.** A key is an array and the default filter is a **prefix** match. `invalidateQueries({ queryKey: ['users'] })` matches `['users', 'list', { page: 1 }]`, `['users', 'detail', '7']`, and also `['users', 'permissions', '7']` and `['users', 'avatar', '7']` — every key whose first element is `'users'`, forever, including keys added by a teammate next month.

So the naive translation goes wrong in both directions:

```typescript
// RTK: invalidatesTags: [{ type: 'User', id }]
// ❌ matches NOTHING — no query is registered under this key shape.
queryClient.invalidateQueries({ queryKey: ['users', id] });

// ❌ matches TOO MUCH — every key under 'users', including ones this mutation
//    has nothing to do with (permissions, avatars, audit log, presence).
queryClient.invalidateQueries({ queryKey: ['users'] });

// ✅ the deliberate pair: the detail entry exactly, and the lists as a prefix.
queryClient.invalidateQueries({ queryKey: userKeys.detail(id), exact: true });
queryClient.invalidateQueries({ queryKey: userKeys.lists() });
```

The behaviour an invalidation triggers is documented in two halves, and both matter here:

> *"It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks"*
> *"If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background"*

Read together: over-invalidating is not free-but-untidy. Every *mounted* match refetches now; every unmounted match refetches the moment it is next rendered, no matter what `staleTime` it was given. A `['users']` prefix invalidation on a dashboard that mounts eight user-related queries is eight requests per mutation.

### The key rules that make the hierarchy safe to rely on

> *"Query Keys are hashed deterministically!"*
> *"no matter the order of keys in objects, all of the following queries are considered equal"*
> *"Array item order matters!"*

Object key order is irrelevant, so `{ page, q }` and `{ q, page }` are the same filter object and you never need to memoise it. **Array position is identity**, so `['users', 'list', filters]` and `['users', filters, 'list']` are two caches — and only the first is reachable by a `userKeys.lists()` prefix. That asymmetry is the entire argument for the key factory in §1: the discriminator (`'list'`, `'detail'`) must come *before* the variable part, or prefix invalidation cannot address it.

## 5. `injectEndpoints` has no counterpart, and that is fine

`injectEndpoints` exists because `createApi` is a single registry that must be split to be code-split. Options factories are ordinary ES modules; a route-level `import('./api/users')` splits them with no library involvement, and there is no `reducerPath` collision to reason about, no `enhanceEndpoints` for tag types added later, and no "endpoint injected twice in development" warning. Delete the concept rather than looking for its equivalent.

## Gotchas

**★ Symptom: a mutation invalidates and half the dashboard refetches, including panels that have nothing to do with the mutated resource.** Cause: `invalidatesTags: ['User']` was translated to `invalidateQueries({ queryKey: ['users'] })`. RTK's bare type matched entries that *provided* that type; the key prefix matches every key beginning with `'users'`, which is a strictly larger set that grows every time someone adds a key. Fix: invalidate at the narrowest prefix that is still correct — `userKeys.lists()` and `userKeys.detail(id)` — and reserve `userKeys.all` for logout and hard resets.

**★ Symptom: a mutation runs, the invalidation looks right in code, and nothing refetches at all.** Cause: the mirror error — `invalidatesTags: [{ type: 'User', id }]` ported to `invalidateQueries({ queryKey: ['users', id] })`. No query is stored under that key; the detail query lives at `['users', 'detail', id]`, so the filter matches zero entries and `invalidateQueries` succeeds silently. Fix: always build the filter from the same key factory the query used. A raw array literal inside `invalidateQueries` is the single highest-yield thing to grep for in a code review of this migration.

**★ Symptom: two components fetch the same resource twice and the devtools show `['users', id]` and `['user', id]` as separate entries.** Cause: keys authored inline at call sites. There is no registry to collide with and no type to violate, so a typo is a new cache, not an error. Fix: the key factory module, imported everywhere; no array literal in a component file.

**★ Symptom: after the port, `getQueryData` returns raw API shapes and code that expects parsed dates crashes.** Cause: `transformResponse` was ported to `select`, which derives per observer and leaves the cache holding the untransformed response. Fix: move the transform into `queryFn`. Use `select` only when different components genuinely want different projections of the same cached value.

**★ Symptom: prefix invalidation refuses to match your list queries no matter how you write the filter.** Cause: the key puts the variable part before the discriminator — `['users', filters, 'list']`. *"Array item order matters!"*, so there is no prefix that names "all lists" without also naming a specific `filters` value. Fix: reorder to `['users', 'list', filters]` in the factory and let the compiler find the call sites; do it early, because every `setQueryData` and every invalidation encodes the old order.

**★ Symptom: you spend an afternoon looking for TanStack Query's `fetchBaseQuery`.** Cause: there isn't one, by design — TanStack Query is transport-agnostic and `queryFn` is any promise. Fix: write the twenty-line `http.ts` in §1 once. The part people forget is the `throw`: `fetch` does not reject on a 4xx or 5xx, so a `queryFn` that just returns `res.json()` **caches the error body as data** and the query never enters the error state.

**★ Symptom: `error` is typed `Error` and you have lost `status` and `data` from the old `FetchBaseQueryError`.** Cause: TanStack Query surfaces whatever `queryFn` threw and, since v5, types it as `Error` rather than `unknown`. Fix: throw the `HttpError` subclass above and narrow with `instanceof HttpError` at the boundary that cares. You get a better error object than RTK's union, but only because you wrote it.

**★ Symptom: `enhanceEndpoints` / `tagTypes` has no equivalent and a shared package's queries cannot be invalidated by the host app.** Cause: tags were a late-bound registry a consumer could extend; keys are early-bound strings. Fix: export the key factory from the shared package. A consumer that can import `userKeys.lists()` can invalidate it; a consumer that has to guess the array shape is coupled to an undocumented literal.

**★ Symptom: an endpoint with `providesTags` on a *mutation* result has nowhere to go.** Cause: RTK lets a mutation both invalidate and provide; a TanStack mutation has no cache entry of its own to provide from — `useMutation` results are not keyed by argument. Fix: if the mutation's response is data other screens should read, write it in with `setQueryData` in `onSuccess`, which is the explicit version of what the tag was doing implicitly. That is [`01d`](./01d-rtk-query-mutations-and-rollback.md).

## Interview questions

**★ RTK Query has one registry of endpoints. TanStack Query has none. What replaces it, and what breaks if nothing does?**
A key factory plus an options factory, in a module per resource. Nothing in the library requires it — `useQuery({ queryKey: ['users', id], queryFn })` inline in a component is perfectly valid — which is exactly why it degrades. Keys are stringly typed, so a divergent key is a second cache rather than a compile error, and an `invalidateQueries` written from memory can match zero entries and report success. The factory converts both of those into ordinary import-and-rename refactors, and it is the difference between a migration that ages well and one that accumulates duplicate caches.

**★ Why does translating `invalidatesTags` to a query key literally over-invalidate?**
Because the matching models differ. RTK tags are matched by identity: invalidating `{ type: 'User', id: '7' }` touches exactly the entries that declared that pair. TanStack keys are matched by prefix by default: `['users']` matches every key that starts with `'users'`, which includes queries that did not exist when the mutation was written. The cost is not cosmetic — the docs state that an invalidated query is marked stale in a way that *"overrides any `staleTime` configurations"*, and that a currently-rendered match *"will also be refetched in the background"*. So the widened filter turns one mutation into as many requests as there are mounted matches.

**★ Where does `transformResponse` go, and why is `select` the wrong answer?**
Into `queryFn`. `transformResponse` runs once before the value is cached, so RTK's cache holds transformed data and everything downstream — other components, manual cache reads, optimistic patches — assumes that shape. `select` runs per observer against the cached raw value, so porting the transform there leaves the cache holding untransformed responses while every component still looks right. The bug appears at the first `getQueryData` or `setQueryData`, far from the change that caused it. `select` is for per-component projections, not for canonicalising a response.

**★ What is `queryOptions()` for, given a plain object works?**
It ties the key's type to the `queryFn`'s return type, so that `queryClient.getQueryData(userQueries.detail(id).queryKey)` is typed as `User` rather than `unknown`, and so the same object can be handed to `useQuery`, `useSuspenseQuery`, a prefetch and `queryClient.query()` without restating anything. A plain function returning `{ queryKey, queryFn }` gives you the reuse but not the type link. Worth noting honestly: the reference page for the helper was not reachable when this page was validated, so treat the exact type surface as something to confirm against the version you install — the *pattern* is unaffected.

**★ What happened to `injectEndpoints` and code splitting?**
It disappears, because the problem it solved disappears. `injectEndpoints` exists to split a single `createApi` registry that would otherwise be one import graph pulling in every endpoint in the app. Options factories are ordinary modules; a dynamic `import()` at a route boundary code-splits them with no library API involved, no `reducerPath` to coordinate and no double-injection warnings in development. If you find yourself designing a registration mechanism for query options, you are re-implementing a problem you were handed the solution to.

**How do you invalidate "everything for this user" without invalidating unrelated `users` keys?**
You cannot, if the keys were designed that way — which is the point. The prefix is the only hierarchy you get, so `['users']` deliberately means "everything user-shaped". If permissions and avatars must be excluded from list invalidations, they need their own top-level prefix (`['permissions', userId]`) or a deeper shared one (`['users', userId, 'permissions']`) chosen so that the prefixes you invalidate from mutations do not cross them. Key design is invalidation design; it is not a naming convention you can settle later.

---

← [The option-by-option map](./01b-rtk-query-the-option-by-option-map.md) · [Topic index](../README.md) · Next → [Mutations and rollback](./01d-rtk-query-mutations-and-rollback.md)
