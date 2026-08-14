---
title: "Global Configuration: `QueryClient` Defaults & Per-Query Overrides"
sidebar_label: "Global Configuration"
sidebar_position: 1
---

# 🔄 Global Configuration: `QueryClient` Defaults & Per-Query Overrides

## 1. Under-The-Hood Mechanics

`QueryClient`'s `defaultOptions` establish app-wide baseline behavior — every individual `useQuery`/`useMutation` call's own options **merge over** these defaults, overriding only the specific fields they explicitly set, leaving everything else at the global default.

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // APP-WIDE default — every query starts with this unless overridden
      gcTime: 5 * 60_000,
      retry: 3,                       // default retry COUNT on failure
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000), // exponential backoff, capped
    },
    mutations: {
      retry: 0, // mutations typically should NOT auto-retry by default — see the pitfall below
    },
  },
});

// A SPECIFIC query overriding just ONE field — everything else still inherits the global default
useQuery({ queryKey: ['live-price'], queryFn: fetchPrice, staleTime: 0 }); // only staleTime overridden
```

### `retry`/`retryDelay`: Global Resilience Defaults
Setting a sensible default retry count and exponential backoff function **once**, globally, means every query in the app gets reasonable resilience against transient network blips without each individual `useQuery` call needing to configure it manually — while still allowing any specific query with genuinely different retry needs (a mutation that should never auto-retry, a query hitting a rate-limited endpoint needing a longer backoff) to override just that one field.

### Why Query and Mutation Defaults Are Configured Separately
Queries (read operations) are generally safe to retry automatically — re-running a `GET` request has no side effects. Mutations (write operations) are often **not** safe to blindly retry — a `POST /orders` retried automatically after a timeout could create a duplicate order if the original request actually succeeded server-side but the response was merely lost in transit. This is precisely why `defaultOptions.mutations.retry` commonly defaults to `0`, distinct from queries' more liberal default.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Team Standardizing Retry Behavior Once, Eliminating Inconsistent Per-Query Configuration Across the Codebase.
Before centralizing configuration, different engineers had configured `retry`/`staleTime` inconsistently across dozens of individual `useQuery` calls — some queries retried 5 times, others never retried at all, with no clear rationale distinguishing the choices; the inconsistency itself was a maintenance and reasoning burden. Establishing sensible `defaultOptions` once, at the `QueryClient` level, gave every query a consistent, deliberate baseline — individual queries only needed to override the default when they had a **genuinely specific** reason to (a live stock price needing `staleTime: 0`, a rate-limited endpoint needing a longer backoff), making every deviation from the baseline meaningful and intentional rather than arbitrary.

---

## 3. Production-Grade Code Example

```typescript
// queryClient.ts — sensible, centralized app-wide defaults
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute — a reasonable general-purpose default
      gcTime: 10 * 60 * 1000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // exponential backoff, capped at 30s
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0, // writes should NOT auto-retry by default — risk of duplicate side effects
    },
  },
});
```

```typescript
// Per-query overrides — deliberate deviations from the global baseline, for SPECIFIC reasons
function useLiveStockPrice(ticker: string) {
  return useQuery({
    queryKey: ['stock', ticker],
    queryFn: () => fetchStockPrice(ticker),
    staleTime: 0, // OVERRIDE: this data is genuinely always-stale, unlike the 1-minute app default
  });
}

function useRateLimitedReport() {
  return useQuery({
    queryKey: ['report'],
    queryFn: fetchReport,
    retry: 1, // OVERRIDE: this specific endpoint is rate-limited — fewer retries, to avoid making it worse
    retryDelay: 5000, // OVERRIDE: a longer, fixed delay specifically for this rate-limited case
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Enabling Automatic Retries for Mutations Without Considering Idempotency
```typescript
// ❌ DANGEROUS: retrying a non-idempotent mutation (creating an order, charging a payment)
// automatically after a timeout can create DUPLICATE side effects if the original request
// actually succeeded server-side, but the response was simply lost in transit
defaultOptions: { mutations: { retry: 3 } }, // risky default for WRITE operations

// ✅ CORRECT: keep mutation retries at 0 by default, opting in explicitly ONLY for mutations
// verified to be genuinely idempotent (e.g. a PUT that's safe to repeat) on a per-mutation basis
defaultOptions: { mutations: { retry: 0 } },
```

### ⚠️ Pitfall 2: Setting a Global `staleTime` So High It Masks Genuinely Fresh-Data-Needing Queries
```typescript
// ❌ RISKY: a very high global staleTime "for performance" can silently make time-sensitive
// data (live prices, real-time status) feel stale/wrong, if engineers forget to override it
// per-query for data that genuinely needs to be considered ALWAYS fresh
defaultOptions: { queries: { staleTime: 10 * 60 * 1000 } }, // 10 minutes — too high for SOME data

// ✅ CORRECT: choose a REASONABLE general default, and be deliberate/explicit about
// per-query overrides for data with genuinely different freshness requirements
```

### ⚠️ Pitfall 3: Forgetting That `defaultOptions` Only Apply to Queries Created AFTER the Client Is Configured
Changing `defaultOptions` on an ALREADY-created `QueryClient` instance at runtime does not retroactively re-apply to already-cached, already-configured query observers in the way engineers sometimes expect — `defaultOptions` are read at query-creation time. For genuinely dynamic, runtime-changing configuration needs (rare), explicit per-query options (rather than relying on mutating global defaults after the fact) are the more predictable approach.
