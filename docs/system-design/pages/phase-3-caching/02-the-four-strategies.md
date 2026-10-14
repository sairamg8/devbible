---
title: "The four caching strategies differ in exactly two things — who loads the cache on a miss and who keeps it consistent on a write — and cache-aside is the default because it puts both jobs in application code where a cache outage degrades the system instead of stopping it"
sidebar_label: "02 · The four strategies"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. The four strategies are **common practice stated as mechanism** — no
> RFC or vendor document defines "cache-aside" or "write-behind" as a standard, and none is
> cited for the names. The one quoted rule here is Redis's `maxmemory` behaviour from the
> [key-eviction documentation](https://redis.io/docs/latest/develop/reference/eviction/), and the
> HTTP rule in the neighbouring pages is [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html).
> Spring and Node snippets are source, not output. **No sandbox run.**

**Every caching strategy answers two questions — on a read miss, who goes to the database and puts the answer in the cache; on a write, who touches the cache and in what order relative to the database — and the four named strategies are the four combinations people kept reinventing.** Cache-aside and read-through differ on the first question. Write-through and write-behind differ on the second. A real system picks one answer per data type, which is why "we use read-through" is not a design and "price is cache-aside with delete-on-write, the product description is read-through with a one-hour TTL, the view counter is write-behind" is.

What the interviewer is really probing is not the vocabulary. It is the failure analysis: what happens when the cache is empty, when it is down, when it is stale, when the database write succeeds and the cache write does not, and when two requests race. This page is the first two strategies and the shared race analysis; [02b](02b-read-through-and-write-through.md) is the two that move the work into a library or a transaction path; [02c](02c-write-behind-and-choosing-per-data-type.md) is write-behind and the per-data-type decision for the storefront.

## The two questions, as a table

| Strategy | Read miss: who loads? | Write: who touches the cache? | Cache down |
|---|---|---|---|
| **Cache-aside** (lazy loading) | the application | the application, usually by deleting the key | reads fall through to the database; the app decides |
| **Read-through** | the cache layer, via a loader you registered | not defined by read-through alone | depends on the library; the loader is *in* the cache |
| **Write-through** | not defined by write-through alone | the cache layer writes the cache and the database in one synchronous operation | writes fail or bypass, by design choice |
| **Write-behind** (write-back) | not defined | the cache accepts the write and persists to the database later, asynchronously | buffered writes may be lost |

The blank cells are the point. Read-through and write-through are routinely paired (the cache is a proxy for the store in both directions), cache-aside is routinely paired with delete-on-write, and write-behind is usually paired with read-through. But they are independent decisions, and treating the pair as one idea is how a design review ends up unable to say what happens to a read after a write.

## Cache-aside, the mechanism

The cache knows nothing about the database. The application holds both clients and runs a three-step read.

1. Look in the cache. A hit returns.
2. On a miss, read the database.
3. Put the result in the cache with a TTL and return it.

```js
// storefront product detail — Node, ioredis + pg
async function getProduct(id) {
  const key = `product:${id}`;
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  const { rows } = await pg.query(
    'SELECT id, title, price_cents, stock FROM products WHERE id = $1', [id]);
  const product = rows[0] ?? null;
  if (product) await redis.set(key, JSON.stringify(product), 'EX', 300);
  return product;
}

async function updateProduct(id, fields) {
  await pg.query('UPDATE products SET title = $2 WHERE id = $1', [id, fields.title]);
  await redis.del(`product:${id}`);          // invalidate, do not rewrite
}
```

The same shape in Spring is the annotation pair, where the proxy around the bean is the "application code":

```java
@Service
class ProductService {
  @Cacheable(cacheNames = "product", key = "#id")
  public Product get(long id) { return repo.findById(id).orElseThrow(); }

  @CacheEvict(cacheNames = "product", key = "#p.id")
  public void update(Product p) { repo.save(p); }
}
```

Be careful what the annotation is: `@Cacheable` is cache-aside implemented by an AOP proxy. The cache is consulted by the proxy, the method body is the database read, and the eviction is the write path's explicit job. It is not read-through, because the loader is your method rather than something registered inside the cache.

The properties follow from the shape:

- **Only requested data is cached.** A product nobody views never occupies memory. Cold start is slow, because the first request per key pays the database.
- **The cache is optional.** If the cache client throws, the application can catch it and read the database. That single property is why cache-aside is the default: the cache is an optimisation, not a dependency, provided you wrote the `try/catch` — and provided the database can survive the full read load, which is the whole stampede topic (**04 Stampede and thundering herd** *(not written yet)*).
- **The cached value is whatever the application chose to store.** It can be a joined, shaped, serialised view of three tables, not a row. This flexibility is why teams keep choosing it over libraries that cache one row per key.
- **Consistency is the application's job, in two places.** Every code path that writes the underlying data must remember to invalidate. The one that does not is a permanent bug, not a transient one, until the TTL expires.

## Delete on write, not update on write

The write path above deletes the key. The tempting alternative is to write the new value into the cache. Deletion is preferred, for three reasons that are all about concurrency rather than tidiness.

1. **Update-in-place has an ordering race that deletion does not.** Two writers, W1 and W2, update the same row. The database serialises them W1 then W2. Their cache writes arrive W2 then W1. The cache now holds W1's value and the database holds W2's, and nothing repairs it until the TTL. A delete in the same interleaving leaves the cache empty, and the next read loads the database's truth.
2. **The cached value may be derived.** If the cached object is a view of three tables, the writer of one table would have to recompute the whole view to update it. Deleting needs only the key.
3. **Computing the value costs work that may never be read.** A product edited ten times between reads is serialised ten times under update-in-place and zero times under delete.

The price of deletion is one extra miss after every write. For a read-heavy catalogue that is nothing. For a key that is both hot and frequently written, it is a stampede per write — which is the argument for the versioned-key and event-driven techniques in [03](03-invalidation.md).

## The race delete does not fix

Delete-on-write closes the writer-writer race and leaves a reader-writer race wide open. This is the single most important failure in cache-aside, and it is a *timing* bug that needs no failure of any component.

1. Reader R misses the cache and reads the database. It gets the old value `v1`.
2. Writer W updates the database to `v2`.
3. W deletes the key. (Nothing to delete: R has not written yet.)
4. R, slow after its read, writes `v1` to the cache with a TTL.

The cache now serves `v1` for a full TTL while the database holds `v2`. Nothing was down, nothing errored, and both code paths are exactly the textbook version. The window is the time R spends between its database read and its cache write — a garbage-collection pause, a slow network hop to the cache, a descheduled thread. It is narrow per request and certain at volume, because a hot key is read many thousands of times and one of them will be slow.

Mitigations, none of which is free:

- **A short TTL bounds the damage.** The stale value lives at most one TTL. This is why every cache-aside key should have a TTL even when invalidation is event-driven: the TTL is the repair mechanism for the cases invalidation got wrong.
- **Delayed second delete ("double delete").** After the database write, delete, wait longer than the longest plausible reader window, delete again. It shrinks the race and cannot eliminate it; the delay is a guess about the reader's slowness, and the second delete must survive the writer process crashing, which means a queue rather than a `setTimeout`.
- **Versioned writes.** Put the row's version into the cached value and have the cache write be a compare-and-set that refuses to overwrite a newer version. This is the real fix and is worked in [03c](03c-price-versus-description-the-hard-case.md).
- **Do not populate on a read that raced a write.** Some stores expose a lease or a token on the miss (the reader receives a token and the write invalidates it, so the stale `SET` is refused). Redis does not give you this natively; you build it with a version key and a Lua script.

## Read-after-write inside one request

A user edits their review and the page immediately reloads showing the old review. Cause: the write path deleted the key *before* the database commit finished, a concurrent read repopulated the old row, and the commit landed after. The ordering rule is **commit first, then invalidate**, and it matters inside a transaction:

```java
@Transactional
public void update(Review r) {
  repo.save(r);
  cache.evict(r.getId());          // WRONG: the commit has not happened yet
}
```

Between the `evict` and the commit, any reader misses, reads the *uncommitted-invisible* old row (under read committed it cannot see the update), and caches it. The fix is to evict after the transaction commits:

```java
@Transactional
public void update(Review r) {
  repo.save(r);
  TransactionSynchronizationManager.registerSynchronization(
    new TransactionSynchronization() {
      @Override public void afterCommit() { cache.evict(r.getId()); }
    });
}
```

Or publish an application event and handle it with `@TransactionalEventListener(phase = AFTER_COMMIT)`. The Node equivalent is simply awaiting the transaction's `COMMIT` before calling `redis.del`, which is why the delete in `updateProduct` above is after the `await pg.query` and why the same function wrapped in an explicit `BEGIN`/`COMMIT` must put the delete after the commit.

Even after-commit eviction leaves a window — the commit and the evict are two operations and the process can die between them. That window is what a TTL and an outbox-driven invalidation (in [03c](03c-price-versus-description-the-hard-case.md)) are for.

## What happens when the cache disappears

The brief for this topic includes "what breaks when the cache disappears", and for cache-aside the answer has three layers.

- **The cache is down but the app catches the error.** Every request becomes a miss. The database now receives the entire read load the cache was absorbing. Whether the database survives is a capacity-planning fact, not a caching one — a cache that absorbs most reads means the database was sized for the remainder. Losing the cache is then a load test you did not schedule.
- **The cache is restarted empty.** Same as above plus a cold-start stampede: every key is missing at once and every key's first requests go to the database together. Warming and coalescing exist for this.
- **The cache is up but evicting.** Redis states the behaviour at the memory limit: *"Whenever a client runs a new command that adds more data to the cache, Redis checks the memory usage. If it is greater than the limit, Redis evicts keys according to the chosen eviction policy until the total memory used is back below the limit."* A cache that is evicting under pressure has a hit ratio decided by the policy, and its cache-aside code is unchanged — so the symptom is database load creeping up with no deployment. The `noeviction` policy is different: *"Keys are not evicted but the server will return an error when you try to execute commands that cache new data."* A cache-aside `SET` that throws on a full instance must not fail the user's request.

A cache that fails open (read the database) protects availability and exposes the database. A cache that fails closed (return an error) protects the database and loses the page. Which is right is per data type — the product page fails open, the flash-sale inventory counter may need to fail closed because letting every request through to the database is what the cache was there to prevent.

## Gotchas

**★ Symptom: a value is stale for a whole TTL after a write, though the write path deletes the key.** Cause: the reader-writer race — a reader read the old row before the write, and wrote it to the cache after the delete. Fix: keep a TTL on every key as the repair path, write cached values with a version and compare-and-set them, and invalidate after commit. Deleting alone is not a consistency guarantee.

**★ Symptom: the cache and the database disagree after two concurrent updates and stay that way.** Cause: the write path *set* the cache instead of deleting it, so the cache writes landed in the opposite order to the database commits. Fix: delete on write; if you must write the cache, carry the row version and refuse to overwrite a higher one.

**★ Symptom: an edit is invisible for a moment and then appears, or never appears.** Cause: the eviction ran before the transaction committed, so a reader repopulated the cache with the pre-commit row. Fix: evict in `afterCommit` or `AFTER_COMMIT`, or after awaiting the `COMMIT`, never inside the transaction body.

**★ Symptom: after a cache restart the database falls over although steady-state load is fine.** Cause: cache-aside has no concurrency control on a miss; every concurrent reader of an empty key runs the query. Fix: single-flight per key in the process, a short lock across processes, jittered TTLs, and pre-warming — the subject of **04 Stampede and thundering herd** *(not written yet)*.

**Symptom: one code path writes the table and nobody invalidates, and a bug report arrives hours later.** Cause: cache-aside spreads the invalidation duty across every writer, including admin tools, migrations, and import scripts. Fix: one write function per aggregate that owns both the database write and the invalidation; for writes you cannot route through it, drive invalidation from the database's change stream ([03c](03c-price-versus-description-the-hard-case.md)).

**Symptom: `@Cacheable` seems to do nothing on a method that is called from another method of the same class.** Cause: the cache behaviour lives in a proxy, and a self-invocation bypasses the proxy. Fix: call through another bean, or move the cached method to its own service. Also note that `@Cacheable` on a method returning `null` caches the null unless `unless = "#result == null"` is set — a decision you want to make deliberately, not inherit.

**Symptom: the cache stores `"undefined"`, `"null"` or an empty object for a missing row and the product stays missing after it is created.** Cause: the miss path cached the absence. Fix: either do not cache absence or cache it with a deliberately short TTL and invalidate it on create (negative caching, **12 Negative caching and penetration** *(not written yet)*).

**Symptom: the cache client throws and takes the product page with it.** Cause: the code treats the cache as a required dependency; a timeout on `redis.get` is not caught. Fix: a short client timeout, a `try/catch` that falls through to the database, and a circuit breaker so a dead cache is not retried on every request ([phase 2 timeouts and budgets](../phase-2-request-path/08-timeouts-retries-and-budgets.md)).

**Symptom: two services cache the "same" product under different key shapes and a write invalidates only one.** Cause: the key is a convention, not a contract. Fix: the key is built by one function in one library, includes a schema version, and the invalidation lists every derived key (the list page, the detail page, the search document) — or uses a tag, in [03b](03b-versioned-keys-and-tag-purge.md).

## Interview questions

**★ What is the difference between cache-aside and read-through?**
In cache-aside the application owns the miss path: it checks the cache, queries the database itself, and writes the result back. In read-through the application asks the cache and the cache layer owns the miss path through a loader registered with it. The observable differences are where the database credentials and query live (application versus cache component), whether a cache can be a separate network service without code in it (cache-aside can; a read-through loader has to live where the code runs, which is why read-through is mostly seen in in-process libraries such as Caffeine's `LoadingCache`), and what a failure looks like. Both are lazy and both leave the write path undefined. A good answer also says that `@Cacheable` is cache-aside through a proxy, since the loader is the method body and not something registered in the cache.

**★ Why do we delete the cache entry on write instead of updating it?**
Because two concurrent writers can apply their cache writes in the opposite order to their database commits, leaving a permanently wrong value; deleting is order-independent, since every interleaving ends in "empty, reload from truth". Deleting is also cheaper when the cached value is derived or not read between writes. The cost is one miss per write, which a hot, frequently written key may not be able to afford — and that is where versioned keys or compare-and-set updates replace delete.

**★ Walk me through how cache-aside can serve stale data even with delete-on-write.**
A reader misses and reads version one from the database; a writer commits version two and deletes the key, which is already absent; the reader then writes version one into the cache. No component failed. The stale value lives until its TTL. The mitigations are a TTL on every key, a delayed second delete, or a version-checked write; none removes the window with certainty except the version check, and that requires the cached value to carry a version.

**★ In what order should the database write and the cache invalidation happen, and why?**
Commit the database change first and invalidate afterwards. Invalidating first lets a concurrent reader repopulate the cache from the not-yet-visible old row. But "after" is itself two operations that can be separated by a crash, so the design needs a repair: a TTL, or an outbox that retries the invalidation until it is acknowledged.

**★ The cache goes down. What happens, and what should happen?**
With cache-aside every request becomes a database read. What should happen is decided per data type: fail open and read the database (the product page), fail closed and shed load (an expensive aggregate the database cannot answer at full rate), or degrade to a stale local copy. The mechanics are a short client timeout, a catch that routes to the fallback, and a circuit breaker so the dead cache costs one failed call per interval rather than one per request. The capacity question underneath is whether the database was sized for the miss rate it now faces.

**Cache-aside, and the application crashes between the database write and the delete. What now?**
The cache keeps the old value until the TTL, because no one knows the invalidation was owed. The cure is not a better `try/catch`; the process is dead. It is either the TTL as an upper bound on wrongness, or moving the invalidation out of the request path into something that survives a crash — an outbox row written in the same transaction as the data and processed by a relay that retries.

**What does `noeviction` do to a cache-aside application?**
Reads of existing keys still work, but a write that would add data returns an error, so every cache `SET` on a full instance fails. If the application does not catch it, the miss path throws after it has already done the expensive database read. A cache should normally run an eviction policy that fits the access pattern; `noeviction` is for stores that are not caches.

**Is `@Cacheable` read-through?**
No. It is cache-aside implemented by a proxy: the framework checks the cache, calls your method on a miss, and stores the return value. The loader is your method, and the eviction on write is an explicit `@CacheEvict` or `@CachePut` that you put there. Read-through in the strict sense means the cache component itself holds the loader.

{/* FOOTER */}
