---
title: "Composition has two costs and they pull in opposite directions — a dependent chain pays latency in series, a fan-out pays it in parallel until something upstream refuses to serve it"
sidebar_label: "What Composition Costs"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the TanStack Query docs — [Request Waterfalls](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls), [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries), [Prefetching & Router Integration](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient), [`useQueries` reference (v5 path)](https://tanstack.com/query/v5/docs/framework/react/reference/useQueries). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-07 · claims + output provenance · session 352cf446

# ⏱️ What Query Composition Costs: Serial Waterfalls, Client-Side Fan-Out, and Where the Join Belongs

## 1. Under-The-Hood Mechanics

Both composition patterns in this topic buy correctness with round trips, and they fail in
opposite directions. A dependent chain is **serial**: its floor is the sum of the latencies, and
adding a link adds a whole round trip before anything renders. A fan-out is **parallel**: its
floor is one round trip, right up until the number of entries exceeds what the browser, the
server or a rate limiter is willing to run at once. Neither is a bug, and neither is free —
what makes a design senior is knowing which cost you are choosing.

### The waterfall, defined by the guide that names it

> *"A request waterfall is what happens when a request for a resource (code, css, images, data) does not start until _after_ another request for a resource has finished."*

Dependent Queries does not hedge about which category `enabled` chaining falls into:

> *"Dependent queries by definition constitutes a form of request waterfall, which hurts performance."*

And Request Waterfalls attaches the same label to the same code:

> *"When a single component first fetches one query, and then another, that's a request waterfall. This can happen when the second query is a Dependent Query, that is, it depends on data from the first query when fetching."*

### The arithmetic the guide itself works

The guide walks a triple waterfall — four server round trips at 250 ms of latency each, the
figure it gives as typical for 3G — and lands on `4*250=1000ms`, *"only counting latency"*.
Flattening the same page to two round trips halves it. Two things are worth extracting from
that. First, the number is **latency only**: it does not include the server's own processing, the
transfer, or the render, so it is a floor rather than an estimate. Second, latency is the term
you cannot optimise away from the client — a faster query, a smaller payload and a warmer cache
all leave the round-trip count exactly where it was.

### The three fixes, in the order they are worth trying

Request Waterfalls names three, and they are not equally available:

1. **Restructure the API so one request returns what the page needs.** This deletes the waterfall
   rather than hiding it, and it is the only fix that helps every client. It is also the one that
   needs someone else's agreement, which is why it is usually skipped.
2. **Prefetch.** Start the second request earlier — on route match, on hover, on the server —
   so it overlaps rather than follows. 🔴 In v5 this is `queryClient.query()`, not the old
   methods: *"These tips replace the use of the now deprecated `prefetchQuery` and
   `ensureQueryData` methods"*, and *"those methods will be removed in the next major version of
   TanStack Query."* Prefetching only removes the waterfall if the id the second request needs is
   known before the first request finishes — a route param qualifies, a field of the first
   response does not.
3. **Move the waterfall to the server**, where the hops are between machines on the same network
   rather than across the user's connection. The chain still exists; it just costs a fraction of
   what it costs on a phone.

### Fan-out has the opposite shape, and no built-in brake

`useQueries` over sixty rows issues sixty requests as fast as React can render them. The wall
clock stays at roughly one round trip *if* everything is genuinely concurrent — and that is the
assumption that breaks. What limits it lives entirely outside TanStack Query: the browser's own
per-origin connection limit under HTTP/1.1, the server's connection pool, whatever rate limiter
sits in front. I could not find any statement in the TanStack Query documentation about
throttling, batching or a maximum in-flight count, so treat concurrency as unmanaged: the library
will start every request you ask it to start.

### The decision, stated as a question you can actually answer

| Situation | Shape | Why |
|---|---|---|
| The second request's parameter is in the URL | **Parallel** | Nothing to wait for. Gating it is the pitfall in [01](01-query-composition.md) |
| The parameter is a field of the first response | **Chain, or one endpoint** | If the server can join it, one request beats two |
| Small set, per-item cacheable, revisited individually | **`useQueries`** | Per-item staleness and per-item cache hits are the payoff |
| Large set, always loaded together | **One batch endpoint** | Sixty round trips for data that is only ever consumed as one list |

---

## 2. Real-World Engineering Scenario

**Scenario**: A Dashboard That Was Fast on the Office Wi-Fi and Unusable on a Train.
The page fetched the session, then the user's organisation from the session, then that organisation's projects, then a summary row per project through `useQueries`. On a low-latency connection the whole thing felt instant, because the four sequential steps cost almost nothing each. On mobile the same page took the sum of four round trips before the fan-out even *started*, and the fan-out then issued one request per project against an API that limited a client to a handful of concurrent connections — so the last few summaries queued behind the first ones. Nothing was slow in isolation and no single query was worth optimising. The fix was structural: the session response was extended to embed the organisation, removing one link, and the per-project summaries became one batch endpoint, replacing the fan-out with a single request.

---

## 3. Production-Grade Code Example

```typescript
// ❌ THREE serial round trips before the page can render anything
const { data: session } = useQuery({ queryKey: ['session'], queryFn: fetchSession });
const { data: org } = useQuery({
  queryKey: ['org', session?.orgId],
  queryFn: () => fetchOrg(session!.orgId),
  enabled: !!session?.orgId,
});
const { data: projects } = useQuery({
  queryKey: ['projects', org?.id],
  queryFn: () => fetchProjects(org!.id),
  enabled: !!org?.id,
});
```

```typescript
// ✅ ONE round trip: the join happens where the hops are cheap
const { data: bootstrap } = useQuery({
  queryKey: ['bootstrap'],
  queryFn: fetchBootstrap, // returns { session, org, projects } in a single response
});
```

```typescript
// ✅ When the API cannot be changed: prefetch the link whose parameter you ALREADY know.
// v5 uses queryClient.query() — prefetchQuery and ensureQueryData are deprecated.
async function projectRouteLoader({ params }: { params: { projectId: string } }) {
  const queryClient = getQueryClient();
  // the id came from the URL, so this does NOT have to wait for anything
  await queryClient.query({
    queryKey: ['project', params.projectId],
    queryFn: () => fetchProject(params.projectId),
  });
}
```

```tsx
// ✅ Fan-out replaced by a batch: one request, one cache entry, one failure to handle
function ProjectSummaries({ projectIds }: { projectIds: string[] }) {
  const { data, isPending } = useQuery({
    // the key carries the whole input set — a different selection is a different entry
    queryKey: ['project-summaries', [...projectIds].sort()],
    queryFn: () => fetchProjectSummaries(projectIds), // POST /summaries { ids: [...] }
  });

  if (isPending) return <SummarySkeleton />;
  return <SummaryTable rows={data} />;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Prefetching a Link Whose Parameter Does Not Exist Yet
```typescript
// ❌ POINTLESS: the prefetch cannot start until `session` resolves, which is the waterfall
// you were trying to remove — you have moved the same serial wait to a different file
await queryClient.query({ queryKey: ['org', session.orgId], queryFn: () => fetchOrg(session.orgId) });

// ✅ prefetch only what you can name EARLY — route params, props, a stored id
await queryClient.query({ queryKey: ['project', params.projectId], queryFn: () => fetchProject(params.projectId) });
```

### ⚠️ Pitfall 2: A Batch Key That Is Not Stable
```typescript
// ❌ the array's ORDER is part of the key — ['a','b'] and ['b','a'] are two cache entries
// for the same data, so reordering the selection re-fetches and doubles the memory
queryKey: ['project-summaries', projectIds],

// ✅ normalise before it reaches the key
queryKey: ['project-summaries', [...projectIds].sort()],
```

## Gotchas

**★ 🔴 Each extra link in the chain is another full round trip before anything renders.** Two
gated queries is three sequential requests, not two, once the page's own code has loaded. The
docs do not soften this: *"Dependent queries by definition constitutes a form of request
waterfall, which hurts performance."* Past two links, the question stops being how to write the
third `enabled` and becomes whether the join belongs on the server.

**★ The cost is latency, so nothing you do to the queries themselves fixes it.** The guide's own
arithmetic — `4*250=1000ms`, *"only counting latency"* — is a floor that excludes server time,
transfer and render. A faster endpoint, a smaller payload, a longer `staleTime` and a warm cache
all leave the round-trip count unchanged, which is why a chain that is imperceptible in the
office is a different product on a train. Count round trips, not milliseconds, when reviewing a
composition.

**★ Prefetching only flattens a waterfall when the parameter is known early.** Moving
`queryClient.query()` into a route loader helps if the id came from the URL. It does nothing at
all if the id is a field of the first response, because the prefetch then has to wait for exactly
what the dependent query was waiting for — you have relocated the serial wait, not removed it.
The test is mechanical: can you name the key before the first request resolves?

**★ 🔴 `prefetchQuery` and `ensureQueryData` are deprecated; v5 prefetching is
`queryClient.query()`.** *"These tips replace the use of the now deprecated `prefetchQuery` and
`ensureQueryData` methods"* and *"those methods will be removed in the next major version of
TanStack Query."* The replacement is stated just as plainly — *"Prefetching a query uses the
`query` method"* — and it is *"an asynchronous method that can be used to fetch and cache a
query. It will either resolve with the data or throw with an error."* Most waterfall-flattening
snippets you will find predate this rename.

**★ Moving a waterfall to the server makes it cheap, not absent.** Server-side composition
replaces a hop across the user's connection with a hop across a data-centre network, which is a
very large constant-factor win and no change at all to the shape. Four serial database or service
calls on the server still serialise, still add up, and still show up as a slow endpoint under
load. The structural fix — one query that returns what the page needs — is the one that changes
the shape.

**★ `useQueries` does not bound concurrency, and the documentation does not discuss it.** Sixty
entries means sixty query functions invoked as fast as React can render them. What actually
limits them is outside TanStack Query: the browser's own per-origin connection limit under
HTTP/1.1, your server's connection pool, whatever rate limit sits in front of it. I could not
find a statement in the TanStack Query docs about throttling or a maximum in-flight count, so
treat concurrency control as **your** problem — batch server-side, paginate the list, or gate the
tail of it behind visibility.

**★ A long `useQueries` list is an N+1 that you moved to the client.** One request per row is the
same pathology as an N+1 in a data-access layer, except each iteration now costs a full network
round trip on the user's connection rather than a local call. `useQueries` is the right tool when
the set is small and each item is genuinely per-item cacheable — five products the user will
revisit individually — and the wrong tool for "load the details of the sixty rows in this table",
where one batch endpoint returning sixty records is a single request, a single cache entry and a
single failure to handle.

**★ Swapping a fan-out for a batch endpoint changes what the cache can reuse.** Sixty individual
entries mean a detail page for row 14 is already warm and a refetch of one row costs one request.
One batch entry means the detail page fetches again and any change invalidates all sixty. That
trade is usually worth it for a table, and usually not for a list whose rows are the primary
navigation target — so the honest answer to "batch or fan out" is "what does the user do next",
not "which is fewer requests".

**★ A batch key built from an unsorted array is two cache entries for one result.** Query Keys is
explicit that *"Array item order matters!"*, so `['summaries', ['a','b']]` and
`['summaries', ['b','a']]` hash differently and cache separately. A selection the user can
reorder therefore multiplies entries and refetches on every reorder. Normalise the input —
`[...ids].sort()` — before it reaches the key.

**★ 🔴 Under suspense, side-by-side queries are a waterfall, not parallelism.** *"When using
React Query in suspense mode, this pattern of parallelism does not work, since the first query
would throw a promise internally and would suspend the component before the other queries run."*
The code looks identical to the non-suspense version; the network tab does not, and nothing warns
you. Reach for `useSuspenseQueries`, which the guide calls the suggested fix, or split the
queries into sibling components so each suspends on its own.

## Interview questions

**★ Two gated queries in a row. What is the actual cost, and when do you stop adding links?**
Each link is a full network round trip that cannot begin until the previous one has finished, so
the wall-clock floor is the sum of the latencies, not the max — the docs classify it exactly that
way: *"Dependent queries by definition constitutes a form of request waterfall, which hurts
performance."* Two links means three sequential requests before the page is complete, and the
cost is paid on the client's connection, which is the slowest link available. The threshold is
not a number of links, it is whether the join is expressible on the server: if the sequence is
`GET /users/:id` then `GET /users/:id/orders`, one endpoint that returns both removes the
waterfall entirely at the cost of one round trip. Keep the chain when the second fetch is
genuinely conditional on something only the client knows.

**★ You cannot change the API. What can you still do about a waterfall?**
Prefetch whatever link has a parameter you can name early, using `queryClient.query()` — the v5
replacement for the deprecated `prefetchQuery` and `ensureQueryData`. A route loader that fires
the request for `params.projectId` at navigation time overlaps it with the code and data the page
is already loading, so by the time the component mounts, the query is warm and the chain is one
link shorter. The limit is structural and worth stating in the interview: this only works for
parameters that exist before the first response, so it flattens URL-driven links and does nothing
for a link whose id is a field of the previous payload. For those, the remaining options are
moving the composition to the server or accepting the round trip.

**★ Sixty rows, one detail request each. Is `useQueries` the right answer?**
Almost certainly not. It works — nothing in the library stops you — but you have implemented an
N+1 on the client, where each iteration is a full round trip on the user's connection rather than
a local database call, and nothing in TanStack Query bounds the concurrency: the limits you
actually hit are the browser's per-origin connection cap under HTTP/1.1 and whatever your API
puts in front of itself. The right shape is one batch endpoint returning sixty records under one
key. `useQueries` earns its place when the set is small, each item is independently cacheable and
independently revisited, and per-item staleness genuinely differs — a five-product comparison,
not a table body.

**★ When is a request waterfall the correct design?**
When the second request is genuinely unknowable before the first resolves, and the alternative
would be fetching something the user does not need. A permissions check that decides which of
three panels to load, a search whose result ids drive the detail fetch, a resource whose storage
location is returned by a metadata call — in all of those, "flattening" means either a
speculative fetch you throw away or an endpoint that has to know about the client's UI. The
waterfall is also correct when the first response is cheap and cacheable and the second is not:
one warm round trip plus one cold one beats one large uncacheable response on every subsequent
visit. What is *not* a defence is that the chain is easier to write, which is the actual reason
most of them exist.

**★ Your fan-out is fast in development and slow in production against the same data. Why?**
Because concurrency is not a property of your code, it is a property of everything between the
browser and the origin, and development flatters it. Locally there is no meaningful latency, so
sixty serialised requests still finish quickly; in production the per-origin connection limit
under HTTP/1.1, the server's pool and any rate limiter turn sixty concurrent requests into
several waves, and the page's wall clock becomes the number of waves times the round trip. The
library will not tell you this is happening — it does not throttle and the documentation does not
discuss a limit — so the diagnosis is the network panel, and the fix is fewer requests rather
than faster ones.

---

← [Combining `useQueries` results](./01c-combining-usequeries-results.md) · [Topic index](../README.md) · Next → [The gate in full](./01e-the-gate-in-full-skiptoken-and-placeholder-chains.md)
