---
title: "The infinite product list"
sidebar_label: "03 · The infinite list"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN (`IntersectionObserver`) and react.dev
> (refs, effects). Concept home: the platform mechanics are
> [JavaScript phase 18's infinite-scroll pages](../../../javascript/pages/README.md);
> the pagination contract is [chapter 3·05's](../phase-3-express-api/05-catalog-endpoints.md).

## The problem

The catalog browses as an endless grid: scroll near the bottom, the next
keyset page loads, items append. Three pieces have to agree — an
`IntersectionObserver` watching a sentinel, an accumulating list state
whose **cursor resets whenever any filter changes**, and append-vs-replace
semantics that never flash the grid empty. The vanilla observer mechanics
live in the JS section; this chapter is the React state design around
them.

## The implementation

```jsx
// src/hooks/useIntersection.js — the observer, React-shaped
import {useEffect, useRef, useState} from 'react';

export function useIntersection({rootMargin = '600px'} = {}) {
  const ref = useRef(null);
  const [intersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting),
      {rootMargin},
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return [ref, intersecting];
}
```

```jsx
// src/hooks/useProductList.js — accumulation + cursor discipline
import {useCallback, useEffect, useRef, useState} from 'react';
import {api} from '../lib/api.js';

export function useProductList(filters) {
  // filters: {category, minCents, maxCents, sort} — primitives only
  const [pages, setPages] = useState([]);        // array of API pages
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState('loading');
  const filterKey = JSON.stringify(filters);
  const generation = useRef(0);                  // stamps in-flight requests

  const load = useCallback(async (cur, gen) => {
    setStatus('loading');
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v != null) params.set(k, String(v));
      }
      if (cur) params.set('cursor', cur);
      const page = await api(`/products?${params}`);
      if (gen !== generation.current) return;    // superseded by a filter change
      setPages((p) => cur ? [...p, page] : [page]);
      setCursor(page.next_cursor);
      setStatus('idle');
    } catch (err) {
      if (gen === generation.current) setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // any filter change: new generation, cursor reset, fresh first page
  useEffect(() => {
    generation.current += 1;
    setCursor(null);
    load(null, generation.current);
  }, [filterKey, load]);

  const loadMore = useCallback(() => {
    if (status === 'loading' || !cursor) return; // no double-fire, no past-end
    load(cursor, generation.current);
  }, [status, cursor, load]);

  return {
    items: pages.flatMap((p) => p.items),
    hasMore: cursor != null,
    status, loadMore,
  };
}
```

```jsx
// src/components/ProductGrid.jsx
export function ProductGrid({filters}) {
  const {items, hasMore, status, loadMore} = useProductList(filters);
  const [sentinelRef, nearEnd] = useIntersection();

  useEffect(() => { if (nearEnd) loadMore(); }, [nearEnd, loadMore]);

  return (
    <>
      <ul className="product-grid">
        {items.map((p) => <ProductCard key={p.slug} product={p} />)}
      </ul>
      {status === 'error' && <ErrorPanel onRetry={loadMore} />}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" />}
      {status === 'loading' && items.length === 0 && <GridSkeleton />}
    </>
  );
}
```

## The design points

- **The generation counter is the filter-change race guard.** A filter
  change mid-flight would otherwise append page 2 of the *old* filter to
  page 1 of the new. Every request carries the generation it was born in;
  responses from dead generations are dropped. This is the same
  supersession idea as `useAsync`'s abort, chosen here as a stamp because
  the accumulating state machine needs to distinguish "stale" from
  "failed" — an abort conflates them.
- **Cursor reset is the contract, enforced where the state lives.**
  [Chapter 3·05](../phase-3-express-api/05-catalog-endpoints.md) declared
  cursors valid only for the filter+sort that minted them, and its 400
  `BAD_CURSOR` catches violators. This hook is the client honoring the
  contract structurally — the reset lives in the same effect that
  refetches, so no code path can change filters without it.
- **`rootMargin: '600px'` prefetches** — the sentinel "intersects" a
  viewport-height early, so the next page is usually ready before the
  user reaches the edge. The trade (some never-seen pages fetched) is
  bounded by page size.
- **The sentinel renders only while `hasMore`** — when the catalog is
  exhausted the observer target unmounts, the observer disconnects, and
  scrolling the footer costs nothing. End-of-list is a state, not an
  ignored event.
- **What this chapter deliberately does not do: windowing.** A hundred
  product cards is fine DOM; ten thousand is not. The point where
  accumulation needs virtualization — and what it breaks — is
  [JavaScript phase 18's long-lists topic](../../../javascript/pages/README.md);
  this grid stays honest by capping browse depth well below it.

## Gotchas

- **Symptom:** page 2 loads instantly and repeatedly on mount — the
  observer "fires immediately". **Cause:** the sentinel is visible before
  the first page renders (empty grid, sentinel at top). The `loadMore`
  guard (`status === 'loading'`) absorbs the double-fire, and the
  skeleton keeps the sentinel below the fold; remove either and the
  symptom returns.
- **Symptom:** after changing category, the grid shows both categories
  mixed. **Cause:** append-on-response without the generation check —
  the classic. **Fix:** the stamp; and the test for it is a slow-network
  filter switch (devtools throttling), which QA scripts rarely include
  and this design makes boring.
- **Symptom:** "load more" stops working after one network error.
  **Cause:** `status` stuck on `'error'` and `loadMore` early-returns
  only on `'loading'` — actually correct here: the error panel's retry
  calls `loadMore`, which re-attempts the same cursor. If retry *also*
  dead-ends, the cursor was consumed server-side — impossible with
  keysets (stateless), which is one more reason 1·04 chose them.
- **Symptom:** back-navigation loses scroll position and reloads page 1.
  **Cause:** list state lives in the unmounted component. **Fix:** out of
  scope here and named: state lifts to the router layer (or sessionStorage
  via [chapter 05's hook](05-uselocalstorage-and-cart.md)) — the honest
  price of infinite scroll, budgeted when the router chapter of the
  React section applies.

## Interview questions

1. **★ Why a generation counter here when `useAsync` solved staleness with
   abort?** Abort answers "this response no longer matters — drop it".
   Accumulating lists need a finer question: "does this response belong
   to the list I am currently building?" A failed request should show an
   error; a superseded one should vanish silently; an append must match
   its generation. The stamp encodes list identity; abort only encodes
   cancellation. Choosing per-problem is the skill.
2. **★ Why does the cursor reset live inside the data hook rather than in
   the filter UI's onChange?** Because correctness rules attached to
   event handlers die in refactors — the next filter control (URL params,
   a "clear all" button) won't know the rule. In the hook, the reset is
   *structural*: it is the effect that responds to filter identity, so
   every present and future filter source inherits it.
3. **Why observe a sentinel element instead of listening to scroll
   events?** Scroll handlers fire constantly on the main thread and
   require geometry math (`scrollHeight - scrollTop`) that layout
   thrashes; `IntersectionObserver` is push-based, off-thread, and
   expresses the actual question ("is the end near the viewport?")
   declaratively. The JS-section pages measure the difference; React
   adds only the ref-and-state wrapper.

---

← Prev: [`useDebounce` and the search box](02-usedebounce-and-search.md) ·
Next → **`useForm` and the checkout form** *(not written yet)*
