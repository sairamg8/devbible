---
title: "Core Concepts: The Server-State Model, `QueryClient` & Why Server State Is Different"
sidebar_label: "Core Concepts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the TanStack Query docs — [Queries](https://tanstack.com/query/latest/docs/framework/react/guides/queries), [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Migrating to v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🔄 Core Concepts: The Server-State Model, `QueryClient` & Why Server State Is Different

## 1. Under-The-Hood Mechanics

TanStack Query's entire design rests on a specific premise: **server state is fundamentally different from client state**, and treating it the same way (plain `useState`/Redux) is what produces most hand-rolled data-fetching bugs.

```
Client state (useState, Redux):        Server state (TanStack Query):
  - you OWN it completely                  - owned by a REMOTE source, you only hold a CACHED COPY
  - synchronous, always "current"            - can be STALE the instant it's fetched — someone else
  - no concept of staleness                    may have changed it server-side afterward
                                              - potentially SHARED across many components needing
                                                the SAME data — should be fetched/cached ONCE, not per-component
                                              - async by nature — loading/error states are INTRINSIC,
                                                not something to bolt on afterward
```

### `QueryClient`: The Central Cache
Every query/mutation ultimately reads from and writes to one shared `QueryClient` instance — a central, in-memory cache keyed by `queryKey`, holding data, staleness metadata, and in-flight request state for every query the app has ever run. This is what makes two components independently calling `useQuery({ queryKey: ['user', 1] })` automatically **share** one cached result and one in-flight request, rather than each triggering its own redundant fetch.

### `QueryClientProvider`: Making the Client Available via Context
A single `QueryClient` instance is created once (typically at the app root) and made available to the whole component tree via `QueryClientProvider` — every `useQuery`/`useMutation` call anywhere in that tree reads from this same shared cache, without needing to be passed the client explicitly.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team Migrating From Manual `useEffect`+`useState` Data Fetching, Eliminating an Entire Category of Bugs.
Before adopting TanStack Query, a team's data-fetching code was hand-rolled: every component needing server data had its own `useEffect` triggering a fetch, its own `useState` for loading/error/data, and no coordination between components that happened to need the **same** data — resulting in redundant duplicate fetches, no automatic background refreshing, and manually-written (and inconsistently correct) cache-invalidation logic scattered across the codebase. Migrating to TanStack Query's `useQuery` collapsed all of that hand-rolled logic into a declarative `useQuery({ queryKey, queryFn })` call per data need — automatic request deduplication, automatic background refetching, and a consistent, centrally-configured cache invalidation story, all without each component reinventing its own data-fetching lifecycle.

---

## 3. Production-Grade Code Example

```tsx
// app/queryClient.ts — ONE QueryClient instance, shared across the whole app
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 }, // sensible app-wide default — see the global config doc
  },
});
```

```tsx
// app/main.tsx — making the client available via context
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
```

```tsx
// TWO components independently requesting the SAME data — automatically deduplicated
// and served from ONE shared cache entry, not two redundant fetches
function UserAvatar({ userId }: { userId: string }) {
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
  return <img src={user?.avatarUrl} alt={user?.name} />;
}

function UserGreeting({ userId }: { userId: string }) {
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
  return <p>Welcome, {user?.name}!</p>;
}
// If both render simultaneously with the SAME userId, only ONE actual network request fires —
// both components share the same cache entry, automatically
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Treating Server State Like Client State, Reinventing What TanStack Query Already Solves
```tsx
// ❌ REINVENTS THE WHEEL: hand-rolled fetching loses automatic deduplication, background
// refetching, and cache sharing — every component pays its own redundant fetch cost
function UserAvatar({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => { fetchUser(userId).then(setUser); }, [userId]); // no dedup, no cache sharing, no staleness handling

// ✅ CORRECT: useQuery provides all of this automatically, for free, from ONE central cache
function UserAvatar({ userId }) {
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
}
```

### ⚠️ Pitfall 2: Creating Multiple `QueryClient` Instances Accidentally
```tsx
// ❌ WRONG: creating a NEW QueryClient inside a component body means a fresh, EMPTY cache
// on every render — defeats caching entirely, and different subtrees end up with SEPARATE,
// non-sharing caches if this pattern is repeated in multiple places
function App() {
  const queryClient = new QueryClient(); // ❌ recreated on EVERY render!
  return <QueryClientProvider client={queryClient}>...</QueryClientProvider>;
}

// ✅ CORRECT: create the QueryClient ONCE, outside the component (or via useState's lazy
// initializer, for SSR-safe per-request instances) — never recreated on re-render
const queryClient = new QueryClient(); // module scope — created ONCE
function App() { return <QueryClientProvider client={queryClient}>...</QueryClientProvider>; }
```

### ⚠️ Pitfall 3: Assuming Cached Server Data Is Always Current
Server state being cached does NOT mean it's guaranteed fresh — the whole premise of the server-state model is that cached data can be stale the moment external changes happen server-side. Understanding `staleTime`/`gcTime` (covered in the [useQuery deep dive](../02-usequery-deep-dive/01-core-options.md)) is essential to reasoning correctly about exactly how stale a given piece of cached data might be at any moment, rather than assuming "it's in the cache" means "it's definitely current."

---

## Gotchas

**★ `useQuery` takes exactly one argument in v5, and it is an object.** Every v4 tutorial, every
StackOverflow answer written before late 2023, and a large share of the generated code you will be
handed still uses the positional form. The migration guide states it flatly — *"useQuery and friends
used to have many overloads in TypeScript"* but *"now we only support the object format"*:

```tsx
useQuery(key, fn, options)              // v4 — removed
useQuery({ queryKey, queryFn, ...options }) // v5 — the only form
```

There is no deprecation shim. The positional call is a type error, and in plain JS it produces a
query whose key is your *function*.

**★ Sharing is by the hashed key, not by the variable you passed.** Two components "asking for the
same thing" share a cache entry only if their keys hash identically. The docs are precise about what
that means: *"Query Keys are hashed deterministically!"*, *"no matter the order of keys in objects,
all of the following queries are considered equal"*, and — the trap — *"Array item order matters!"*.
So `['user', userId]` and `['user', userId]` share. `['user', 1]` and `['user', '1']` do **not**: a
number and a string serialize differently, and a route param arriving as a string while an internal
call passes a number is the single most common way one entity ends up cached twice.

**★ A module-scope `QueryClient` is correct in the browser and a data leak on the server.** In an
SPA the module-level singleton is exactly right — one cache, one process, one user. Under SSR the
same module is shared across every concurrent request, so one user's cached profile is served into
another user's HTML. The Advanced Server Rendering guide's rule is one line: *"Server: always make a
new query client"*. On the client side of an app that also renders on the server, create it inside a
lazy `useState` initialiser so it survives re-renders but is not shared across requests.

**★ "It is in the cache" never means "it is current".** This is the whole premise of the model, and
the library's own default agrees with the pessimistic reading: *"Query instances via `useQuery` or
`useInfiniteQuery` by default consider cached data as stale."* A cache entry is a copy of something
another process owns. TanStack Query assumes it is out of date and re-checks on mount, focus and
reconnect precisely because it cannot know.

**★ Cached data you stop using disappears — by default after five minutes.** *"By default, 'inactive'
queries are garbage collected after 5 minutes."* Unmounting the last component observing a key starts
that clock. A user who navigates away from a dashboard and comes back six minutes later gets a cold
fetch, not a cache hit, and no amount of `staleTime` changes that — `staleTime` governs freshness,
`gcTime` governs existence. See [`useQuery` deep dive](../02-usequery-deep-dive/01-core-options.md).

**★ A refetch is not automatically a re-render.** *"Query results by default are structurally shared
to detect if data has actually changed and if not, the data reference remains unchanged."* A poll
that returns a byte-identical payload every ten seconds costs you a network request and nothing else:
consumers keep the same object reference and React bails out. This is also why you must not mutate
data you got out of a query — you are mutating the shared, structurally-preserved object.

**★ The client reaches your hooks through React context and nothing else.** `QueryClientProvider` is
not a convenience wrapper over a global; there is no module-level fallback for a hook to fall back
to. Anything rendered outside that provider — a component mounted through a second `createRoot`, a
portal rendered from a different tree root, a unit test whose wrapper was forgotten — has no client
at all, and it fails at the hook that needed one, not at the provider that was missing. In tests,
build the wrapper once and make it mandatory.

## Interview questions

**★ Why does TanStack Query insist that server state is a different category from client state, and
what concretely follows from that?**
Client state is state you own: it is synchronous, it is authoritative, and "current" is not a
question you can meaningfully ask about it. Server state is a *copy* of state a remote process owns,
which means three properties fall out immediately and none of them apply to `useState`. It can be
wrong the instant you receive it, because the owner can change it without telling you — so staleness
has to be a first-class concept, not an afterthought. It is usually wanted by more than one component
at once — so identity has to live outside the component tree, in a keyed cache, or you pay for the
same fetch several times. And acquiring it is asynchronous and fallible — so loading and error are
intrinsic states of the data, not extra `useState` calls you remember to write. Every API in the
library is downstream of those three: `queryKey` for identity, `staleTime` for staleness, and
`status`/`fetchStatus` for the async lifecycle.

**★ Two components call `useQuery` with the same key in the same render pass. What actually happens,
and what would have to be true for them NOT to dedupe?**
They resolve to one cache entry and one in-flight request; both observe the same `Query` instance and
both re-render when it settles. The identity is the *hashed* key, so deduplication fails exactly when
the hashes differ despite the intent matching: one passes `['user', 1]` and the other `['user', '1']`;
one passes `['user', id]` and the other `['user', id, {}]`; one array is ordered `['todos', status,
page]` and the other `['todos', page, status]`, which the docs call out directly — *"Array item order
matters!"*. Note the two cases that do **not** break it: recreating the object literal on every
render is harmless because keys are compared by value, and reordering the *properties inside* an
object in the key is harmless because *"no matter the order of keys in objects, all of the following
queries are considered equal"*.

**★ Where do you create the `QueryClient` in a browser-only SPA, and where in an app that renders on
the server? Why is the answer different?**
In an SPA, at module scope — created once, outside any component, so it is never recreated by a
re-render and every part of the tree shares one cache. In a server-rendered app, per request. The
process is shared across users there, so a module-level client would accumulate one user's data and
hand it to the next; *"Server: always make a new query client"*. The client-side half of such an app
uses a lazy `useState` initialiser (`useState(() => new QueryClient())`), which gives you
stability across re-renders without a module-scope singleton that the server build would also
evaluate.

**★ You are handed v4 code: `useQuery(['user', 1], fetchUser, { staleTime: 5000 })`. Write the v5
form, and say why the overload was removed.**
`useQuery({ queryKey: ['user', 1], queryFn: fetchUser, staleTime: 5000 })`. The overloads existed so
the common call could be short, and the cost was paid in TypeScript: every extra overload multiplies
the inference paths, degrades error messages when one argument is subtly wrong, and makes generic
wrapper functions around `useQuery` painful to type. Collapsing to a single object argument gives one
inference path, one place to add options, and error messages that point at the property rather than
at an argument position.

**★ A colleague edits a user record in another browser tab. Your app has that user cached. What does
TanStack Query do, and when?**
Nothing, until something triggers a refetch — the library has no channel to the server and cannot be
told. What it does have is a pessimistic default: cached data is considered stale immediately, and
*"Stale queries are refetched automatically in the background when: New instances of the query mount,
The window is refocused, The network is reconnected"*. So in practice the user sees the new value the
moment they switch back to the tab. If you have raised `staleTime` to reduce traffic, you have
deliberately widened that window, and that is the trade you are making. When you need it faster than
a focus event, you need a push channel or a poll (`refetchInterval`) — not a cache setting.

**★ Does putting server data in the `QueryClient` make it global shared state? How is that different
from putting it in Redux?**
It is shared and it is global, but it is not *state* in the Redux sense, and the difference is
ownership. A Redux store holds values your application is the source of truth for; you write them,
you reduce them, and they are correct by construction. The `QueryClient` holds a cache of values a
server is the source of truth for; you never author them, you only record what the server last said
and when. That is why the API has no reducers and no dispatch, and instead has staleness, garbage
collection, retries, refetch triggers and request deduplication — every one of which is a
cache-coherence concern that a client-state container has no reason to have. The practical rule that
follows: anything the server owns goes in the query cache, anything the user is currently doing but
has not sent anywhere (a half-filled form, a selected tab, a sort order) stays in component or client
state.
