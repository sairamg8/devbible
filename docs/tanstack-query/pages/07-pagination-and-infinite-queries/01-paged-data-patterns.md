---
title: "Pagination & Infinite Queries: `useInfiniteQuery` & `keepPreviousData`"
sidebar_label: "Pagination & Infinite Queries"
sidebar_position: 1
---

# 🔄 Pagination & Infinite Queries: `useInfiniteQuery` & `keepPreviousData`

## 1. Under-The-Hood Mechanics

Paginated data has two genuinely different UI patterns — "load more, accumulating pages" (infinite scroll) and "jump between discrete pages" (traditional pagination) — each with its own dedicated TanStack Query mechanism.

```
useInfiniteQuery — ACCUMULATES pages into one growing array
        │
        ├── getNextPageParam(lastPage, allPages)   ──► derives the NEXT cursor/page number from the
        │                                                 last response — e.g. lastPage.nextCursor
        ├── fetchNextPage()                            ──► fetches and APPENDS the next page to `data.pages`
        └── hasNextPage                                   ──► derived boolean: was getNextPageParam's
                                                               return value undefined (no more pages)?

useQuery + placeholderData: keepPreviousData — DISCRETE page jumps, no accumulation
        │
        ▼
Changing the page-number queryKey normally shows a LOADING state for the new page —
keepPreviousData instead shows the PREVIOUS page's data (marked isPlaceholderData: true)
WHILE the new page loads, avoiding a jarring loading-flicker between page clicks
```

### `getNextPageParam`: Deriving the Next Request From the Last Response
Rather than the consuming code manually tracking "what page am I on," `getNextPageParam` receives the **last fetched page's data** (and all pages so far) and returns whatever value the next `queryFn` call should use as its cursor/page parameter — returning `undefined` signals "there is no next page," which is exactly what `hasNextPage` derives its value from.

### `keepPreviousData`: Eliminating Loading Flicker Between Pages
Without it, clicking "next page" on a traditional paginated table would briefly show a loading spinner (since the new page number's query key has no cached data yet) even though the user just wants to see the next set of rows — `placeholderData: keepPreviousData` keeps the **previous** page's data visible (clearly marked via `isPlaceholderData: true` so the UI can dim it or show a subtle loading indicator) until the new page's real data arrives, producing a much smoother pagination experience.

---

## 2. Real-World Engineering Scenario

**Scenario**: An Infinite-Scrolling Comment Feed Correctly Stopping "Load More" Once All Comments Are Loaded.
A comment feed needed infinite-scroll behavior — loading more comments as the user scrolls, accumulating them into one continuous list. `useInfiniteQuery` with `getNextPageParam` reading the API response's `nextCursor` field (returning `undefined` once the API indicated no more comments existed) meant `hasNextPage` automatically became `false` at exactly the right moment — the "Load More" button correctly disabled/hid itself once every comment had been loaded, without any manual tracking of "how many comments are there total" needed anywhere in the component.

---

## 3. Production-Grade Code Example

```typescript
// useInfiniteQuery — accumulating pages, with automatic hasNextPage derivation
function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({ pageParam }) => fetchComments(postId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined, // undefined ⇒ no more pages
  });
}
```

```tsx
// CommentFeed.tsx — consuming the infinite query
function CommentFeed({ postId }: { postId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useComments(postId);

  return (
    <div>
      {data?.pages.flatMap((page) => page.comments).map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading…' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

```typescript
// keepPreviousData — smooth, flicker-free traditional pagination
import { keepPreviousData } from '@tanstack/react-query';

function useProductPage(pageNumber: number) {
  return useQuery({
    queryKey: ['products', 'page', pageNumber],
    queryFn: () => fetchProductsPage(pageNumber),
    placeholderData: keepPreviousData, // shows the PREVIOUS page while the new one loads
  });
}
```

```tsx
// ProductTable.tsx — using isPlaceholderData to subtly indicate the transitional state
function ProductTable() {
  const [page, setPage] = useState(1);
  const { data, isPlaceholderData } = useProductPage(page);

  return (
    <div style={{ opacity: isPlaceholderData ? 0.6 : 1 }}> {/* subtle dim, not a jarring spinner */}
      <ProductList products={data?.products} />
      <button onClick={() => setPage((p) => p + 1)} disabled={isPlaceholderData}>Next Page</button>
    </div>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `getNextPageParam` Must Return `undefined` to Stop Pagination
```typescript
// ❌ WRONG: returning null, 0, or any other "falsy-ish but not undefined" value doesn't
// correctly signal "no more pages" — hasNextPage may incorrectly stay true, or behave inconsistently
getNextPageParam: (lastPage) => lastPage.nextCursor || null, // ❌ null ≠ undefined for this specific check

// ✅ CORRECT: explicitly return undefined when there's genuinely no next page
getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
```

### ⚠️ Pitfall 2: Not Checking `isPlaceholderData` Before Treating Displayed Data as Final/Real
```tsx
// ❌ RISKY: acting on displayed data as if it's the CURRENT page's real, confirmed data,
// when it might still be the PREVIOUS page's placeholder data shown during a transition
function handleExport() {
  exportToCSV(data.products); // might export the WRONG (previous) page's data if still a placeholder
}

// ✅ CORRECT: check isPlaceholderData before treating data as genuinely current/final
function handleExport() {
  if (isPlaceholderData) return; // wait for the REAL data before allowing an export action
  exportToCSV(data.products);
}
```

### ⚠️ Pitfall 3: Using `useInfiniteQuery` for Simple, Discrete Pagination (or Vice Versa)
```typescript
// ❌ MISMATCHED TOOL: useInfiniteQuery ACCUMULATES pages into one growing array — using it
// for a traditional "jump to page 5" pagination UI means unnecessarily managing an
// ever-growing pages array when only ONE page's data should ever be shown at a time
useInfiniteQuery({ queryKey: ['products'], queryFn: fetchPage, getNextPageParam: ... }); // for a page-number UI

// ✅ CORRECT: use plain useQuery + keepPreviousData for discrete, jump-to-any-page pagination;
// reserve useInfiniteQuery specifically for genuinely ACCUMULATING, scroll-based feeds
useQuery({ queryKey: ['products', 'page', pageNumber], queryFn: fetchPage, placeholderData: keepPreviousData });
```
