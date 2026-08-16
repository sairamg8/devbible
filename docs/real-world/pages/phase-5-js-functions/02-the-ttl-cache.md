---
title: "The TTL cache with stale-while-revalidate"
sidebar_label: "02 · The TTL cache"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN and the HTTP `stale-while-revalidate`
> semantics (RFC 5861) this pattern borrows its name from. Concept home:
> [JS — an LRU cache in O(1)](../../../javascript/pages/phase-17-machine-coding/09-lru-cache/README.md)
> builds the eviction structure; the server-side sibling is
> [chapter 2·08](../phase-2-node-services/08-the-cache-layer.md).

## The problem

The client's catalog cache: navigating back to a product should render
*instantly* — even slightly stale — while a background refresh corrects
it. That is stale-while-revalidate: serve what you have if it is not too
old, revalidate behind the render. The server cache (2·08) solved
single-flight for *concurrent* callers; this one adds the freshness
window for *returning* callers, and the two designs are deliberately the
same species so knowing one is knowing both.

## The implementation

```js
// src/lib/swr-cache.js
export function createSwrCache({
  maxEntries = 200,
  freshMs = 30_000,          // younger than this: serve, no refetch
  staleMs = 5 * 60_000,      // younger than this: serve AND refetch behind
} = {}) {
  const entries = new Map(); // key -> {promise, at} — insertion order = LRU base

  function touch(key, entry) {                 // refresh recency (phase-17 LRU idea)
    entries.delete(key);
    entries.set(key, entry);
  }

  function evict() {
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  function start(key, loader) {
    const entry = {
      at: Date.now(),
      promise: Promise.resolve().then(loader).catch((err) => {
        entries.delete(key);                   // never cache a failure (2·08's law)
        throw err;
      }),
    };
    entries.set(key, entry);
    evict();
    return entry;
  }

  return {
    /** Serve-then-revalidate. `onUpdate` fires if a background refresh
     *  produced a NEWER value after a stale serve. */
    async get(key, loader, {onUpdate} = {}) {
      const now = Date.now();
      const hit = entries.get(key);

      if (hit && now - hit.at < freshMs) {     // fresh: serve, done
        touch(key, hit);
        return hit.promise;
      }
      if (hit && now - hit.at < staleMs) {     // stale: serve, refresh behind
        touch(key, hit);
        const refresh = start(key, loader);
        if (onUpdate) {
          refresh.promise.then((v) => onUpdate(v)).catch(() => {});
        }
        return hit.promise;
      }
      return start(key, loader).promise;       // miss or expired: load
    },

    invalidate(key) { entries.delete(key); },
    invalidatePrefix(prefix) {
      for (const k of entries.keys()) if (k.startsWith(prefix)) entries.delete(k);
    },
  };
}
```

Wired under the product page's hook:

```js
// src/lib/catalog-cache.js
import {createSwrCache} from './swr-cache.js';
import {api} from './api.js';

const cache = createSwrCache();

export const getProduct = (slug, {signal, onUpdate} = {}) =>
  cache.get(`product:${slug}`,
    () => api(`/products/${slug}`, {signal}), {onUpdate});

// cart mutations that change availability call:
//   cache.invalidatePrefix('product:');       // coarse and correct (2·08's rule)
```

```jsx
// the consumer — instant back-navigation, silent correction
function ProductPage({slug}) {
  const [fresh, setFresh] = useState(null);
  const {status, data, error, retry} = useAsync(
    (signal) => getProduct(slug, {signal, onUpdate: setFresh}), [slug]);
  const product = fresh ?? data;
  // render as in 4·01 — `product` silently upgrades when the refresh lands
}
```

## The decisions

- **Three ages, three behaviours.** Fresh (serve silently), stale (serve
  *and* revalidate — the window where SWR earns its name), expired
  (block on a load). Collapsing fresh into stale refetches on every
  view — the 4·12 rate-limit gotcha in home-grown form; collapsing
  stale into expired forfeits the instant back-nav that justified the
  cache.
- **Promises in the map, again.** The same single-flight property as
  2·08: a stale serve's background refresh *replaces the entry
  immediately*, so a second caller during the refresh awaits the new
  flight instead of starting a third. One mechanism, both stampede
  cases.
- **`onUpdate` is a callback, not a subscription system.** The consumer
  that triggered the stale serve gets told about the correction; global
  reactivity is exactly the cache-as-store road that ends in
  [TanStack Query](../phase-4-react-ui/12-when-tanstack-query.md), and
  this cache stays deliberately short of it. When more than one
  component needs live corrections of the same key, that is switch
  signal #1.
- **Client freshness ≤ server cache honesty.** `freshMs` (30 s) matches
  the server's `cache-control: max-age` from
  [3·05](../phase-3-express-api/05-catalog-endpoints.md) — the layers
  agree on "about a minute total" staleness, so no layer's tuning
  silently defeats another's. The budget lives in one constants module,
  imported by both.

## Gotchas

- **Symptom:** a user reports prices "changing while they look".
  **Cause:** the silent upgrade repainting mid-read — SWR working, UX
  policy missing. **Fix:** policy, per surface: prices upgrade silently
  (correctness beats stability), but *cart line totals* during checkout
  never SWR — checkout reads bypass the cache entirely (`api` direct),
  because [the locked read](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md)
  is the only price that matters there.
- **Symptom:** memory profile shows the cache pinned at cap with a
  near-zero hit rate. **Cause:** a crawler — same signature as
  [2·08's](../phase-2-node-services/08-the-cache-layer.md), client-side
  edition (rare: crawlers don't run the SPA, but link prefetchers do).
  **Fix:** none needed — the bound made it a shrug; the signature is
  the diagnostic gift.
- **Symptom:** after logout, the next user on a shared device sees the
  previous user's recently-viewed products render instantly. **Cause:**
  the cache outlives the session — catalog data is public, so this is
  cosmetic, but it *demonstrates* the rule: nothing user-scoped may
  enter this cache. **Fix:** the [auth chapter's logout](../phase-4-react-ui/09-auth-in-the-client.md)
  clears user-adjacent stores; the catalog cache may stay, and the
  review of *what may enter it* is the real control.

## Interview questions

1. **★ Where does stale-while-revalidate beat both plain TTL and
   always-revalidate?** Plain TTL blocks at expiry — the user pays the
   refresh latency at the worst moment, on interaction. Always-
   revalidate never blocks but refetches every view — server load and
   rate limits pay instead. SWR splits the difference structurally:
   reads are always instant within the stale window, and freshness
   converges one background flight later. The pattern's home is HTTP
   caching (RFC 5861); the client version is the same law privatized.
2. **★ Why does the background refresh replace the map entry before it
   resolves?** So the refresh itself is single-flight: caller 2
   arriving mid-refresh finds the *new* promise and awaits it. If the
   old entry stayed until resolution, every stale read during the
   refresh would start another refresh — a slow-motion stampede that
   defeats the pattern under exactly the load it exists for.
3. **What separates this cache from the one a server-state library
   maintains?** Scope and reactivity: this one answers "give me a
   value, maybe correct me once"; a query cache answers "keep every
   subscriber of this key consistent forever". The second requires
   subscriptions, structural sharing and invalidation graphs — the
   complexity 4·12 priced. Building the first and *naming* the line to
   the second is the design maturity being tested.

---

← Prev: [The fetch wrapper](01-the-fetch-wrapper.md) ·
Next → **The concurrency-limited task queue** *(not written yet)*
