---
title: "Global Configuration: `QueryClient` Defaults & Per-Query Overrides"
sidebar_label: "Global Configuration"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# 🔄 Global Configuration: `QueryClient` Defaults & Per-Query Overrides

## 1. Under-The-Hood Mechanics

`QueryClient`'s `defaultOptions` establish app-wide baseline behavior — *"Define defaults for all queries and mutations using this queryClient."* Every individual `useQuery`/`useMutation` call's own options **merge over** these defaults, overriding only the specific fields they explicitly set and leaving everything else at the global default.

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,   // 🔴 the ONE default worth changing — the library ships 0
      gcTime: 5 * 60_000,  // restates the shipped default of 5 minutes
    },
  },
});

// A SPECIFIC query overriding just ONE field — everything else still inherits the global default
useQuery({ queryKey: ['live-price'], queryFn: fetchPrice, staleTime: 0 }); // only staleTime overridden
```

### 🔴 Know which defaults the library already ships before you set any

Half of a typical `defaultOptions` block restates behaviour that is already the default, which makes it *look* as though the opposite would happen without it. Important Defaults states these outright:

> *"Query instances via `useQuery` or `useInfiniteQuery` by default consider cached data as stale."* — so `staleTime` is **0**.
> *"By default, 'inactive' queries are garbage collected after 5 minutes."* — `gcTime` is **5 minutes**.
> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing and displaying an error to the UI."* — `retry` is **3**, with backoff, already.

And on the write side the Mutations guide is equally plain: *"By default, TanStack Query will not retry a mutation on error."* Writing `mutations: { retry: 0 }` therefore changes nothing. It is worth keeping only as an executable comment, and it must not be described as the thing that makes mutations safe — the library was never going to retry them.

That leaves **`staleTime`** as the one line in a default block that genuinely changes behaviour for most apps, and it is the one most often left out.

### Three levels, not two: `setQueryDefaults`

Between the global block and the per-hook options sits a per-key layer. *"`setQueryDefaults` can be used to set default options for specific queries"*, with `setMutationDefaults` as its write-side twin, so a whole subtree of keys can carry its own policy without every call site repeating it.

```typescript
queryClient.setQueryDefaults(['reports'], { retry: 1, staleTime: 5 * 60_000 });
queryClient.setQueryDefaults(['reports', 'live'], { staleTime: 0 }); // registered AFTER the generic one
```

🔴 **Registration order is load-bearing**, and the reference says so explicitly:

> *"the order of registration of query defaults does matter. Since the matching defaults are merged by `getQueryDefaults`, the registration should be made in the following order: from the **most generic key** to the **least generic one**. This way, more specific defaults will override more generic defaults."*

### Changing defaults after the client exists
`setDefaultOptions` is the supported way, and it replaces rather than merges: *"The `setDefaultOptions` method can be used to dynamically set the default options for this queryClient. Previously defined default options will be overwritten."* So a partial object passed to it drops every default it does not mention.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team Standardizing Retry Behavior Once, Eliminating Inconsistent Per-Query Configuration Across the Codebase.
Before centralizing configuration, different engineers had configured `retry`/`staleTime` inconsistently across dozens of individual `useQuery` calls — some queries retried 5 times, others never retried at all, with no clear rationale distinguishing the choices; the inconsistency itself was a maintenance and reasoning burden. Establishing sensible `defaultOptions` once, at the `QueryClient` level, gave every query a consistent, deliberate baseline — individual queries only needed to override the default when they had a **genuinely specific** reason to (a live stock price needing `staleTime: 0`, a rate-limited endpoint needing a longer backoff), making every deviation from the baseline meaningful and intentional rather than arbitrary. The audit that produced it was itself the valuable part: every call site that could not justify its override lost it.

---

## 3. Production-Grade Code Example

```typescript
// queryClient.ts — centralized app-wide defaults
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🔴 The load-bearing line. The shipped default is 0, which means every mount of
      // every query is a refetch trigger. One minute is a reasonable general-purpose floor.
      staleTime: 60 * 1000,

      gcTime: 10 * 60 * 1000, // raised from the shipped 5 minutes
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
    // NOTE: no `mutations: { retry: 0 }` here — that IS the shipped default.
    // Writing it would imply mutations retry without it. They do not.
  },
});
```

```typescript
// Per-key defaults — a policy for a whole subtree, without touching every call site.
// 🔴 Generic key FIRST, specific key SECOND — the merge order depends on it.
queryClient.setQueryDefaults(['reports'], {
  retry: 1,                 // this endpoint is rate-limited; do not hammer it
  retryDelay: 5000,
  staleTime: 5 * 60 * 1000,
});
queryClient.setQueryDefaults(['reports', 'live'], { staleTime: 0 });
```

```typescript
// Per-query overrides — deliberate deviations, for reasons the reader can see
function useLiveStockPrice(ticker: string) {
  return useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => fetchStockPrice(ticker),
    staleTime: 0, // OVERRIDE: genuinely always-stale, unlike the 1-minute app default
  });
}
```

```typescript
// SSR: the request-scoped client needs its own staleTime, or hydration only half-works.
// "Server: always make a new query client"
function makeServerQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Writing `mutations: { retry: 0 }` and Believing It Did Something
```typescript
// ❌ MISLEADING: this is the shipped default. It reads like the guard-rail that stops
// duplicate orders, so the next engineer "tidies it away" and assumes nothing changed —
// which is true, but they now believe mutations retry when they do not.
defaultOptions: { mutations: { retry: 0 } },

// ✅ The real decision is the opposite one: opting IN, per mutation, only where the
// endpoint is idempotent or takes an idempotency key.
useMutation({ mutationFn: replaceProfile, retry: 2 });
```

### ⚠️ Pitfall 2: Setting a Global `staleTime` So High It Masks Genuinely Fresh-Data-Needing Queries
```typescript
// ❌ RISKY: a very high global staleTime "for performance" silently makes time-sensitive
// data (live prices, real-time status) wrong, whenever someone forgets to override it
defaultOptions: { queries: { staleTime: 10 * 60 * 1000 } }, // 10 minutes — too high for SOME data

// ✅ CORRECT: a modest general default, plus setQueryDefaults for the subtrees that
// genuinely differ — so the deviation lives with the data, not at every call site
```

### ⚠️ Pitfall 3: Registering Per-Key Defaults Specific-First
```typescript
// ❌ WRONG ORDER: the generic registration is merged over the specific one
queryClient.setQueryDefaults(['reports', 'live'], { staleTime: 0 });
queryClient.setQueryDefaults(['reports'], { staleTime: 5 * 60_000 });

// ✅ CORRECT: "from the most generic key to the least generic one"
queryClient.setQueryDefaults(['reports'], { staleTime: 5 * 60_000 });
queryClient.setQueryDefaults(['reports', 'live'], { staleTime: 0 });
```

### ⚠️ Pitfall 4: Calling `setDefaultOptions` With a Partial Object
```typescript
// ❌ DESTRUCTIVE: "Previously defined default options will be overwritten" — this does not
// merge. Every default not named here is gone, including the staleTime you rely on.
queryClient.setDefaultOptions({ queries: { retry: 1 } });

// ✅ Pass the whole object, or build it from a single shared constant both call sites use
```

---

## Gotchas

**★ 🔴 Most of a typical `defaultOptions` block restates the shipped defaults.** `retry: 3` with exponential backoff, `gcTime` of five minutes, and no mutation retry are all what you get with an empty constructor — Important Defaults says queries are *"silently retried 3 times, with exponential backoff delay"* and inactive queries are *"garbage collected after 5 minutes"*, and the Mutations guide says the library *"will not retry a mutation on error"*. Restating them is not harmful in itself; believing they are the reason the app behaves that way is, because it makes every one of those lines look load-bearing to the next person to read the file.

**★ `staleTime` is the one that actually changes something, and it is usually missing.** The shipped value is 0, meaning *"by default consider cached data as stale"*, and a stale query refetches whenever a new observer mounts. So on a default client every navigation back to a screen refetches everything on it. Teams notice the traffic, reach for `refetchOnWindowFocus: false`, and suppress a symptom of the setting they did not change.

**★ There are three levels of configuration, not two.** Global `defaultOptions`, then per-key `setQueryDefaults`, then the options on the hook itself. The middle layer is the one people do not know exists, so they either push a policy global (and break unrelated screens) or copy it onto twenty call sites (and miss three).

**★ Per-key defaults must be registered generic-first.** The reference is explicit: *"the registration should be made in the following order: from the most generic key to the least generic one. This way, more specific defaults will override more generic defaults."* Get it backwards and the broad rule silently wins over the narrow one — no error, no warning, just a live-price query that caches for five minutes.

**★ `setDefaultOptions` overwrites, it does not merge.** *"Previously defined default options will be overwritten."* Calling it at runtime with only the field you meant to change deletes every other default on the client, and because the surviving values are the library's own shipped ones, the app keeps working — differently — rather than failing.

**★ Defaults are read when a query is created, so a late change does not reach what already exists.** Anything already in the cache with observers attached keeps the options it was created with. This makes "flip a global default from a settings screen" unreliable in a way that shows up only for users who had already visited the screen, which is nobody in testing.

**★ The server's client needs its own defaults.** *"Server: always make a new query client"* — and that per-request client does not inherit whatever you configured for the browser. Its `staleTime` is 0 unless you set it there too, which is exactly how an SSR setup ends up hydrating correctly and refetching immediately anyway.

**★ A global `retry` is a policy about your backend, not about your code.** Three retries with backoff turns a 5xx into several seconds of silence with no error state, because the UI stays in `pending` for the whole ladder. On a slow, flaky endpoint that reads as a hang. `retry` is worth lowering for endpoints where failing fast and showing an error beats waiting.

## Interview questions

**★ What does an empty `new QueryClient()` actually give you?**
More than people expect. Data is *"stale"* immediately, so every new observer mount refetches; failed queries retry *"3 times, with exponential backoff delay"*; inactive entries are *"garbage collected after 5 minutes"*; results are structurally shared so unchanged data keeps its reference; and mutations do not retry at all. Knowing that list is what tells you which lines of a `defaultOptions` block are decisions and which are decoration — and in most codebases, only `staleTime` is a decision.

**★ Where would you put a retry policy that applies to one API's endpoints but not the rest of the app?**
`setQueryDefaults` on that key prefix. Global defaults are too broad — you would be changing behaviour for every unrelated screen to fix one integration — and per-hook options are too narrow, because the policy then has to be remembered at every call site and will be missed at the next one. The per-key layer puts the rule where the data is. The one thing to get right is registration order: generic prefix first, specific prefix after, because *"more specific defaults will override more generic defaults"* only in that order.

**★ Someone adds `mutations: { retry: 0 }` in review and calls it a safety fix. What do you say?**
That it is already the default — *"By default, TanStack Query will not retry a mutation on error"* — so it changes nothing, and that the framing is the problem rather than the line. It implies the danger is automatic retries, when the real decision is the opposite one: whether any given mutation is idempotent enough to opt *in*. Leaving it in as a documented no-op is defensible; leaving the belief in is not, because the next person may "already have" the protection they think they need.

**★ Your app refetches everything on every navigation. Where do you look?**
`staleTime`, before anything else. At the shipped 0 every query is stale the moment it is cached, and mounting a new instance is one of the documented triggers for refetching a stale query — so ordinary navigation looks like a refetch storm. The tempting fix is turning off `refetchOnWindowFocus` and friends, which removes some symptoms and leaves the cause, and also removes the freshness behaviour you actually wanted. Set a real `staleTime` first, then decide whether any trigger still needs disabling.

**★ How do the three configuration levels combine?**
The hook's own options are the most specific and win; per-key defaults from `setQueryDefaults` sit under them, merged in registration order from generic to specific; the constructor's `defaultOptions` are the floor. Each level overrides only the fields it names, so a hook setting `staleTime` alone keeps the retry policy from the layers beneath it. That per-field merge is what makes overrides readable — a call site shows you exactly what it is deviating on, and nothing else.

**★ Can you change global defaults at runtime, and what is the catch?**
Yes, via `setDefaultOptions` — but *"Previously defined default options will be overwritten"*, so it is a replace, not a patch, and a partial object silently discards the rest. The second catch is timing: options are read when a query is created, so already-created queries keep what they had. Between the two, runtime default changes are a poor fit for anything user-facing; per-key defaults or explicit per-hook options are the predictable route.

**★ Why does the SSR client need configuring separately?**
Because it is a different client. *"Server: always make a new query client"* — one per request, so no user's cache can leak into another's HTML — and that new instance starts from the library's defaults, not from your browser configuration. If it has no `staleTime`, everything you dehydrate arrives at the browser already stale, and the client refetches it on mount, which undoes the point of prefetching while still looking correct on screen.
