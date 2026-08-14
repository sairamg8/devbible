---
title: "Core Concepts: The Server-State Model, `QueryClient` & Why Server State Is Different"
sidebar_label: "Core Concepts"
sidebar_position: 1
---

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
Every query/mutation ultimately reads from and writes to one shared `QueryClient` instance — a central, in-memory cache keyed by `queryKey`, holding data, staleness metadata, and in-flight request state for every query the app has ever run. This is what makes two components independently calling `useQuery(['user', 1])` automatically **share** one cached result and one in-flight request, rather than each triggering its own redundant fetch.

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
