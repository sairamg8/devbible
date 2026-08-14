---
title: "Error Handling & Resilience: Boundary Hierarchy, Fallback UI & Retry Patterns"
sidebar_label: "Error Handling & Resilience"
sidebar_position: 1
---

# 🏛️ Error Handling & Resilience: Boundary Hierarchy, Fallback UI & Retry Patterns

## 1. The Decision Framework

Designing for failure means deciding, in advance, exactly how much of the UI a given failure is allowed to take down — a decision made through error boundary placement, not left to chance.

```
ONE root-level error boundary (too coarse):        Section/route-level boundaries (correctly scoped):
  <ErrorBoundary>                                     <ErrorBoundary> {/* route level */}
    <EntireApp />                                        <Header />  {/* NOT wrapped — survives */}
  </ErrorBoundary>                                       <ErrorBoundary> {/* WIDGET level */}
  ── ONE broken widget anywhere                             <RecommendationsWidget />
     takes down the ENTIRE app,                           </ErrorBoundary>
     showing a blank/error screen                          <MainContent /> {/* survives if widget breaks */}
     for a failure that should have                      </ErrorBoundary>
     been contained to one small area              ── a broken widget shows ITS OWN fallback,
                                                        everything else keeps working
```

### Fallback UI Strategy: Matching the Failure to the Right Perceived-Reliability Treatment
- **Skeleton** — for content that's ALMOST CERTAINLY about to arrive successfully (a fast, reliable endpoint) — communicates "this specific shape of content is loading," reducing perceived wait.
- **Spinner** — for genuinely uncertain-duration operations, or when skeleton shape isn't meaningfully predictable.
- **Stale-while-revalidate** — showing the LAST KNOWN GOOD data while a background refresh happens, rather than a loading state at all — appropriate when slightly-stale data is acceptable and a jarring loading flash on every visit would hurt perceived reliability more than briefly-stale content would.

### Retry/Backoff: Automatic vs User-Initiated
Transient network failures (a dropped connection, a brief server hiccup) are reasonable candidates for AUTOMATIC retry with exponential backoff (the same pattern covered in the [TanStack Query global config doc](../../../tanstack-query/pages/13-global-configuration/01-defaultoptions.md)) — but a failure that persists past a few automatic attempts should surface a clear, MANUAL retry action to the user, rather than silently retrying indefinitely (which can mask a genuinely broken feature behind an endlessly-spinning loading state) or failing with no recovery path at all.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Broken Third-Party Recommendations Widget Taking Down an Entire Product Page.
A product page embedded a recommendations widget calling a third-party service — when that service had an outage, the widget's component threw an unhandled error, and because the app had only a single, root-level error boundary, the ENTIRE product page (including the actual product details, add-to-cart button, and everything unrelated to recommendations) went blank, showing a generic error screen for a failure isolated to one non-critical widget. Introducing a dedicated error boundary scoped tightly around JUST the recommendations widget meant a future outage of that same third-party service would show a small "Recommendations unavailable" message in that one widget's place, while the rest of the page — including the actually-critical purchase flow — continued working completely unaffected.

---

## 3. Reference Implementation

```tsx
// Error boundary hierarchy — route-level catches genuinely catastrophic failures,
// section-level boundaries isolate non-critical widgets
function ProductPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}> {/* route-level: last resort */}
      <ProductHeader />
      <ProductDetails /> {/* critical — NOT independently wrapped, failures here ARE page-level */}
      <ErrorBoundary fallback={<WidgetErrorFallback message="Recommendations unavailable" />}>
        <RecommendationsWidget /> {/* non-critical — isolated so ITS failures don't cascade */}
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
```

```tsx
import { useQuery, keepPreviousData } from '@tanstack/react-query';

// Fallback UI strategy matched to the actual reliability characteristics of the data
function ProductPrice({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['price', productId], queryFn: () => fetchPrice(productId) });

  if (isLoading) return <PriceSkeleton />; // fast, reliable endpoint — skeleton communicates the expected shape
  return <span>${data.amount}</span>;
}

function LiveInventoryCount({ productId }: { productId: string }) {
  const { data, isFetching } = useQuery({
    queryKey: ['inventory', productId],
    queryFn: () => fetchInventory(productId),
    placeholderData: keepPreviousData, // stale-while-revalidate — show LAST KNOWN count, not a loading flash
  });
  return <span className={isFetching ? 'opacity-60' : ''}>{data?.count} in stock</span>;
}
```

```typescript
// Retry: automatic for transient failures, manual beyond that threshold
function useResilientFetch(url: string) {
  return useQuery({
    queryKey: [url],
    queryFn: () => fetch(url).then((r) => r.json()),
    retry: 3, // automatic, exponential backoff — absorbs TRANSIENT blips
    // beyond 3 automatic attempts, the UI shows an explicit "Retry" BUTTON, not endless silent retries
  });
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: One Root-Level Error Boundary as the Only Failure Containment
As the scenario shows, a single app-wide boundary means ANY component's failure — however minor or non-critical — takes down the ENTIRE application. Deliberately place boundaries around genuinely independent, non-critical sections (widgets, sidebars, embedded third-party content) so their failure blast radius is scoped to just that section.

### ⚠️ Anti-Pattern 2: Infinite Silent Automatic Retries, Masking a Genuinely Broken Feature
Configuring unlimited (or a very high count of) automatic retries with no eventual fallback to a manual, user-visible retry action can leave a user staring at an endlessly-spinning loading state for a feature that is, in fact, completely broken — indistinguishable from "still loading normally" until the user gives up entirely. Cap automatic retries, then surface a clear, actionable failure state.

### ⚠️ Anti-Pattern 3: Using a Generic Spinner Everywhere, Regardless of the Actual Failure/Reliability Characteristics
Applying the same generic loading spinner to both a near-instant, highly-reliable endpoint AND a slow, occasionally-failing one misses the opportunity to set appropriately different user expectations — a skeleton (implying "content is basically already here, just rendering") is misleading for a genuinely slow/unreliable data source, while a stale-while-revalidate pattern might be a better fit than either, if the specific data tolerates minor staleness.
