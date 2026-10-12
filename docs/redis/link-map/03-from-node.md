---
title: "Link map · Redis · Part 3 (phases 6–8)"
sidebar_label: "03 · Redis · From Node"
sidebar_position: 3
---

# Link map · Redis · Part 3 (phases 6–8)

Covers all 23 topic rows of `docs/redis/syllabus/03-from-node.md`: T03-01 to T03-07 phase 6 (the Node client), T03-08 to T03-15 phase 7 (caching), T03-16 to T03-23 phase 8 (sessions, rate limits, locks, queues).
**All 23 are 🔲 not written** (no page of ours exists under `docs/redis/pages` for this part), so each block is a source bank. *read* = I read the passage; *headings only* = fetched, headings/size checked. No `#anchors` are given.

🔴 **Version note.** Redis docs are served under `/docs/latest/` (newest Open Source release per our README: 8.10). npm on 2026-10-12: `redis` (node-redis) 6.3.0, `ioredis` 6.0.0, `connect-redis` 10.0.0, `bullmq` 6.3.13, `rate-limiter-flexible` 11.2.1. Pin versions in each page's `> Verified:` line. Docs pages carry no date, so only the fetch date is given; third-party links carry theirs.

🔴 **Source note.** `github.com` and `npmjs.com` return 403 to our fetcher, so the node-redis, ioredis and connect-redis READMEs cannot be Read-this at their normal URLs. Where a README mattered I read the `raw.githubusercontent.com` copy of the same file (stated per block). The connect-redis README was **not reachable** by any route tried.

---

## Phase 6 — The Node client, end to end

### T03-01 · `node-redis` vs `ioredis` — Understand · 🔲 not written
- **Read this:** [Migrate from ioredis](https://redis.io/docs/latest/develop/clients/nodejs/migration/) · redis.io · side-by-side tables (connection, command handling, pipelining, scan, pub/sub, `SETNX`, `CONFIG`); ioredis connects on construction, node-redis needs `connect()`; node-redis is promise-only, ioredis also takes callbacks (*read*) · covers our angle: **partial** — it is written as a migration guide, so "how to choose" is implied, not argued · fetched 2026-10-12
- **Also good:** [ioredis guide](https://redis.io/docs/latest/develop/clients/ioredis/) · redis.io · says Redis "actively maintains and supports" ioredis but recommends node-redis for new projects (*read*) · [ioredis README (raw)](https://raw.githubusercontent.com/redis/ioredis/main/README.md) · github (raw copy) · version table: 6.x needs Node 20 or newer and Redis 6.2 to latest (*read* the table) · fetched 2026-10-12
- **Our delta:** 🔴 the two Redis pages disagree on wording. The migration page says ioredis "is now deprecated"; the ioredis page says it is actively maintained. Our page must say both libraries are current and name the official recommendation (node-redis for new projects) without repeating "deprecated" as fact.

### T03-02 · Connecting once, injecting the client — Master · 🔲 not written
- **Read this:** [Connect to the server](https://redis.io/docs/latest/develop/clients/nodejs/connect/) · redis.io · `createClient()`, an `error` listener, then `await client.connect()`; `client.isReady` and `client.isOpen` for state; `createCluster` for clusters (*read*) · covers our angle: **partial** — nothing on module-level connection or injection; the import-time trap is our argument · fetched 2026-10-12
- **Also good:** [Connection pools and multiplexing](https://redis.io/docs/latest/develop/clients/pools-and-muxing/) · redis.io · two sections, pooling and multiplexing; page modified 2026-09-29 per its metadata (*headings only*) · fetched 2026-10-12
- **Our delta:** the injection pattern (build once in the composition root, pass in) and the import-time failure mode; the Express Phase 7 pool parallel.

### T03-03 · Reconnection and command buffering — Master · 🔲 not written
- **Read this (1/2):** [Production usage](https://redis.io/docs/latest/develop/clients/nodejs/produsage/) · redis.io · while down, commands are queued and sent on reconnect; a non-idempotent command in flight can be replayed; `disableOfflineQueue: true` discards instead (*read*) · covers our angle: full for node-redis · fetched 2026-10-12
- **Read this (2/2):** [Connect → Reconnect after disconnection](https://redis.io/docs/latest/develop/clients/nodejs/connect/) · redis.io · default exponential backoff with jitter; `socket.reconnectStrategy` accepts `false`, a number or a function `(retries, cause)` (*read*) · fetched 2026-10-12
- **Also good:** [ioredis README (raw): Auto-reconnect and Offline Queue](https://raw.githubusercontent.com/redis/ioredis/main/README.md) · github (raw) · `retryStrategy`; pending commands flushed with an error every 20 attempts by default; `maxRetriesPerRequest: null` waits forever; `enableOfflineQueue: false` (*read*) · [node-redis FAQ (raw)](https://raw.githubusercontent.com/redis/node-redis/master/docs/FAQ.md) · github (raw) · commands already sent reject when the socket closes (*read*) · fetched 2026-10-12
- **Our delta:** why a buffered queue hides an outage (latency climbs instead of errors). Note the Production usage page says in-flight commands may be re-sent, while the FAQ says already-sent commands reject; our page must not state either as the whole story.

### T03-04 · Errors that must not crash the process — Master · 🔲 not written
- **Read this:** [Error handling (node-redis)](https://redis.io/docs/latest/develop/clients/nodejs/error-handling/) · redis.io · "It is crucial to listen for error events"; without a listener the error is thrown and the process may exit; table of `ECONNREFUSED`, `ETIMEDOUT`, `ReplyError`; four patterns (fail fast, degrade, retry, log) (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [ioredis README (raw): Connection Events](https://raw.githubusercontent.com/redis/ioredis/main/README.md) · github (raw) · ioredis emits `error` silently when no listener is attached, so it does **not** crash — the opposite default (*read*) · fetched 2026-10-12
- **Our delta:** the contrast between the two libraries' defaults, and `error` firing on every disconnect even while retrying (node-redis `client-configuration.md`, raw, *read*), so it is not a "gave up" signal.

### T03-05 · Pipelining and `MULTI` — Understand · 🔲 not written
- **Read this (1/2):** [Pipelines and transactions (node-redis)](https://redis.io/docs/latest/develop/clients/nodejs/transpipe/) · redis.io · same-tick auto-pipelining, `Promise.all()`, `multi().execAsPipeline()` versus `multi().exec()`; `WATCH` needs an isolated connection from a pool (*read*) · covers our angle: full for the client side · fetched 2026-10-12
- **Read this (2/2):** [Transactions](https://redis.io/docs/latest/develop/using-commands/transactions/) · redis.io · no rollback; a command can fail after `EXEC` while the rest still run; `WATCH` check-and-set (*read*) · fetched 2026-10-12
- **Also good:** [Redis pipelining](https://redis.io/docs/latest/develop/using-commands/pipelining/) · redis.io · round-trip time explained; reply queueing costs server memory, so batch (*read*) · fetched 2026-10-12
- **Our delta:** "pipeline = fewer round trips, `MULTI` = no interleaving" as one contrast table; the transpipe page notes a `multi()` pipeline discards remaining commands on a lost connection.

### T03-06 · Timeouts and retries — Understand · 🔲 not written
- **Read this:** [Production usage](https://redis.io/docs/latest/develop/clients/nodejs/produsage/) · redis.io · `connectTimeout` (default 5 s), per-command abort via `AbortController`, and why a replayed non-idempotent command corrupts data (*read*) · covers our angle: **partial** — the page's `commandOptions` snippet was not checked against the current client API, so treat its signature as **not confirmed** · fetched 2026-10-12
- **Also good:** [Error handling → Pattern 3](https://redis.io/docs/latest/develop/clients/nodejs/error-handling/) · redis.io · bounded retry with doubling delay on `ETIMEDOUT`, `ECONNRESET`, `BUSY`, `LOADING` (*read*) · [node-redis `client-configuration.md` (raw)](https://raw.githubusercontent.com/redis/node-redis/master/docs/client-configuration.md) · github (raw) · lists `commandOptions.timeout` (default 5000 ms) and `socket.socketTimeout` (*read* the table) · fetched 2026-10-12
- **Our delta:** which commands are safe to retry (`GET` yes, `INCR` no) — no page states it as a rule.

### T03-07 · Graceful shutdown — `quit` versus `disconnect` — Know · 🔲 not written
- **Read this:** [node-redis README (raw): Disconnecting and Events](https://raw.githubusercontent.com/redis/node-redis/master/README.md) · github (raw) · `QUIT` deprecated since Redis 7.2; `quit()` replaced by `close()`, `disconnect()` renamed `destroy()`; the `end` event fires on `.close()` or `.destroy()` (*read*) · covers our angle: **partial** — nothing on draining in-flight work before closing · fetched 2026-10-12
- **Also good:** [Connect to the server](https://redis.io/docs/latest/develop/clients/nodejs/connect/) · redis.io · its TLS example ends with `client.destroy()`, while its event list still says `end` follows `client.quit()` (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the Redis docs mix old and new names (Production usage still says `quit()` or `disconnect()`). Pin to the version in the `> Verified:` line; closing after in-flight work and the Express Phase 10 hook are ours.

---

## Phase 7 — Caching, properly

### T03-08 · Cache-aside — Master · 🔲 not written
- **Read this:** [Cache-Aside pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) · learn.microsoft.com · three-step flow (read cache, miss, load and add); on update, write the store then invalidate; lifetime, eviction, consistency trade-offs. Page `ms.date` 2025-09-11, updated 2025-12-09 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Redis cache-aside with node-redis](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/) · redis.io · runnable helper: `HGETALL`, miss, load, `HSET` plus `EXPIRE` (*read*) · [Redis cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) · redis.io · when to use it and the `cache:{entity}:{id}` key shape (*read*) · fetched 2026-10-12
- **Our delta:** why it is the default over read-through (the application owns the loader); the MS example is C#, so our Node snippet must carry the code.

### T03-09 · Invalidation — Master · 🔲 not written
- **Read this:** [Redis cache-aside with node-redis → Production usage](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/) · redis.io · "Invalidate, don't try to keep the cache in sync"; TTL is the upper bound on staleness, combined with explicit `DEL` on write where no staleness is tolerable (*read*) · covers our angle: full for delete-on-write; **partial** for write-through · fetched 2026-10-12
- **Also good:** [Cache-Aside pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) · learn.microsoft.com · update the store before deleting the cache entry, with the stale-repopulate race explained; names write-through as the read-after-write option (*read*, 2025-09-11) · fetched 2026-10-12
- **Our delta:** "TTL alone is a bet" is our sentence; the write-through contrast needs our own short example.

### T03-10 · What must never be cached — Master · 🔲 not written
- **Read this:** [Cache-Aside pattern → When to use](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) · learn.microsoft.com · may not suit data that is "sensitive or security related"; always retrieve it from the primary source (*read*, 2025-09-11) · covers our angle: **partial** — says nothing about authorisation decisions specifically · fetched 2026-10-12
- **Also good:** [Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) · builder.aws.com · caches add security risks such as poisoning and timing side channels; the fit is poor when clients cannot tolerate stale data. Jas Chhabra, 2026-10-02 (*read*) · fetched 2026-10-12
- **Our delta:** the authorisation-decision case (a revoked permission still served from cache) is ours; no page found states it.

### T03-11 · Stampede / thundering herd — Understand · 🔲 not written
- **Read this:** [Redis cache-aside with node-redis → Stampede protection with a Lua lock](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/) · redis.io · `SET NX PX` single-flight lock with a per-caller token and Lua release; waiters poll the cache (*read*) · covers our angle: **partial** — locks only; early recompute and jitter are not shown · fetched 2026-10-12
- **Also good:** [Cache stampede](https://en.wikipedia.org/wiki/Cache_stampede) · wikipedia.org (undated) · three mitigations: locking, external recomputation, probabilistic early expiration with the x-fetch rule (*read*) · [Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) · builder.aws.com · request coalescing for the thundering herd; jitter is not mentioned (2026-10-02, *read*) · fetched 2026-10-12
- **Our delta:** TTL jitter is not confirmed on any page I read; the worked "what hits the database when a hot key expires" gate answer is ours.

### T03-12 · Cache penetration — Understand · 🔲 not written
- **Read this:** [Redis cache-aside with node-redis → Handle missing records explicitly](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/) · redis.io · cache "not found" sentinels with a short TTL, shorter than the positive entry so a new record shows quickly (*read*) · covers our angle: **partial** — the term "penetration" and Bloom filters are not used · fetched 2026-10-12
- **Our delta:** the name, the attack framing (random ids) and the Bloom-filter alternative; a search returned only blog posts (besthub.dev, bytebytego), none opened, so none is chosen.
- *Not opened:* a ByteByteGo post titled "Cache miss attack" (search hit only; URL not fetched, so not linked).

### T03-13 · Key design and versioning — Understand · 🔲 not written
- **Read this:** [Keys and values](https://redis.io/docs/latest/develop/using-commands/keyspace/) · redis.io · colon convention `object-type:id`; very long keys are bad, very short keys rarely worth it; Redis has no namespaces so avoid collisions (*read*) · covers our angle: **partial** — nothing on versioning a cached shape · fetched 2026-10-12
- **Also good:** [Redis cache-aside with node-redis → namespace keys](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/) · redis.io · prefix with the application name in a shared deployment (*read*) · [Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) · builder.aws.com · warns of mass refresh when a cache is flushed or its format changes (2026-10-02, *read*) · fetched 2026-10-12
- **Our delta:** the version-in-the-key trick (`user:v2:42`) for changing a shape without a flush — no page found states it.

### T03-14 · Measuring — hit rate — Understand · 🔲 not written
- **Read this:** [Key eviction → Using the INFO command](https://redis.io/docs/latest/develop/reference/eviction/) · redis.io · `keyspace_hits / (keyspace_hits + keyspace_misses)`; read it with `evicted_keys` and `expired_keys`; `EXISTS` on an absent key counts as a miss (*read*) · covers our angle: **partial** — a number, not why 99% can still be bad · fetched 2026-10-12
- **Also good:** [Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) · builder.aws.com · emit hit, miss, size and downstream-request metrics; the "modal behavior" a cache introduces (2026-10-02, *read*) · [Redis cache-aside with node-redis → Hit/miss accounting](https://redis.io/docs/latest/develop/use-cases/cache-aside/nodejs/) · redis.io · in-process counters, to be exported as metrics in production (*read*) · fetched 2026-10-12
- **Our delta:** why 99% can still be a bad cache (the 1% is the expensive or hot path; hits on cheap queries) — ours.

### T03-15 · When not to cache — Know · 🔲 not written
- **Read this:** [Cache-Aside pattern → When to use](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) · learn.microsoft.com · not suitable when most requests miss, since checking and loading may outweigh the benefit; also for sensitive data (*read*, 2025-09-11) · covers our angle: **partial** — "the query that was fast" is ours · fetched 2026-10-12
- **Also good:** [Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) · builder.aws.com · when results are not reused the hit rate is negligible; test with caching disabled (2026-10-02, *read*) · fetched 2026-10-12

---

## Phase 8 — Sessions, rate limits, locks and queues

### T03-16 · Session store — Understand · 🔲 not written
- **Read this:** [Redis session store with node-redis](https://redis.io/docs/latest/develop/use-cases/session-store/nodejs/) · redis.io · explicit store with cookie handling; production notes on securing the cookie, sliding expiry defining how long a stolen cookie works, ID rotation after login (*read* the production notes) · covers our angle: **partial** — hand-rolled store, not `connect-redis` wire-up · fetched 2026-10-12
- **Also good:** [express-session](https://expressjs.com/en/resources/middleware/session/) · expressjs.com · lists `connect-redis` as a compatible store; `rolling` defaults to false; `store.touch` resets idle timers; `MemoryStore` is not for production (*read*) · [Redis session store](https://redis.io/docs/latest/develop/use-cases/session-store/) · redis.io · one hash per session ID with a sliding `EXPIRE` (*read*) · fetched 2026-10-12
- **Our delta:** the `connect-redis` option list (`client`, `prefix`, `ttl`) and its default key shape are **not confirmed** — its README returned 403 (github, npmjs) or 404 (raw). Read it at writing time.

### T03-17 · Revocation and denylists — Understand · 🔲 not written
- **Read this:** [JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html) · owasp.org · the JWT denylist section: key on `jti` and `iss` with `exp`, not on the raw token or its hash; it recommends Token Status Lists for revocation (*read* those sections) · covers our angle: **partial** — no Redis, no TTL advice · fetched 2026-10-12
- **Also good:** [How Do You Log Someone Out of a Stateless System?](https://dev.to/tharindukn/how-do-you-log-someone-out-of-a-stateless-system-jwt-invalidation-on-logout-bbp) · dev.to, 2026-07-04 · blocklist by `jti` with each entry's TTL set to the token's remaining validity, plus the valid-after timestamp method; blog, not primary (*read* Method 2) · fetched 2026-10-12
- **Our delta:** the state a denylist reintroduces, and Redis persistence settings deciding whether a revocation survives a restart — ours.

### T03-18 · Rate limiting — Master · 🔲 not written
- **Read this:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · redis.io, William Johnston, published 2026-02-26, updated 2026-03-20 · fixed window (`INCR` + `EXPIRE`), sliding log (sorted set), sliding counter, token bucket, leaky bucket, each as a Lua script, with a comparison table and the boundary-burst flaw of fixed windows (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Redis rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/) · redis.io · overview; lists `rate-limiter-flexible` and `express-rate-limit` as Node options (*read*) · fetched 2026-10-12
- **Our delta:** the tutorial runs on bun and uses Lua for all five; our page must show the plain `INCR` + `EXPIRE` race (a crash between the two leaves no expiry) before introducing a script.

### T03-19 · Why the limiter must be shared — Master · 🔲 not written
- **Read this:** [Redis rate limiter → Why the problem is hard](https://redis.io/docs/latest/develop/use-cases/rate-limiter/) · redis.io · local counters break behind load balancers: the same client bypasses limits by hitting different instances (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the arithmetic (limit times instance count) and the three-instance gate demo — ours.

### T03-20 · Distributed locks — Understand · 🔲 not written
- **Read this (1/2):** [Distributed Locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) · redis.io · `SET resource_name my_random_value NX PX 30000`; release only if the value matches (Lua, or `DELEX` from Redis 8.4); fencing tokens advised in its consistency disclaimer (*read*) · covers our angle: full for the single-instance lock · fetched 2026-10-12
- **Read this (2/2):** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · martin.kleppmann.com, 2016-02-08 · a fencing token is a number that rises on each acquisition; storage rejects lower ones; a lease check cannot replace it (*read*) · fetched 2026-10-12
- **Also good:** [Redis Transactions → compare-and-set](https://redis.io/docs/latest/develop/using-commands/transactions/) · redis.io · Redis 8.4 `SET` with `IFEQ` and `DELEX` for atomic compare-and-delete (*read*) · fetched 2026-10-12
- **Our delta:** a Node example with a fencing check enforced by the protected resource; the Redis page names Node Redlock libraries but gives no single-instance Node code.

### T03-21 · Redlock, honestly — Know · 🔲 not written
- **Read this (1/2):** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · martin.kleppmann.com, 2016-02-08 · Redlock rests on timing assumptions and has no fencing tokens; "neither fish nor fowl"; use a single instance for efficiency locks, consensus for correctness (*read*) · covers our angle: full for the criticism · fetched 2026-10-12
- **Read this (2/2):** [Is Redlock safe?](https://antirez.com/news/101) · antirez.com, the reply; Kleppmann's page dates it 2016-02-09 (page itself shows no date) · disputes the need for fencing and the system model, concedes monotonic clocks (*read*) · fetched 2026-10-12
- **Also good:** [Distributed Locks with Redis → Redlock algorithm](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) · redis.io · the claim itself: N=5 independent masters, majority within the validity time; no monotonic clock for TTL (*read*) · fetched 2026-10-12
- **Our delta:** "when you should not use Redis for this at all" — the consensus-system recommendation is Kleppmann's; we state it as one side of a dispute.

### T03-22 · Idempotency-key storage — Understand · 🔲 not written
- **Read this:** [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) · stripe.com, Brandur Leach, 2017-02-22 · client-generated `Idempotency-Key`; the server stores the first result and returns it on retry; backoff with jitter (*read*) · covers our angle: **partial** — no Redis, and no atomic claim for concurrent first requests · fetched 2026-10-12
- **Also good:** [SET](https://redis.io/docs/latest/commands/set/) · redis.io · the command reference lists the `NX` option used for the atomic claim (*read* the argument list only) · [The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) · ietf.org · draft 07, 2025-10-15, expired Internet-Draft; concurrent-key and expiry rules **not confirmed** on the page fetched (*headings only*) · fetched 2026-10-12
- **Our delta:** the Redis claim itself (`SET key in-progress NX EX`, then store the response, release or keep on 5xx) and the TTL choice — a search returned only third-party tutorials, none opened, none chosen.

### T03-23 · Queues — BullMQ and what it does underneath — Know · 🔲 not written
- **Read this (1/2):** [BullMQ: Going to production](https://docs.bullmq.io/guide/going-to-production) · docs.bullmq.io · `maxmemory-policy` must be `noeviction`; enable AOF persistence; Workers need `maxRetriesPerRequest: null`; disable the offline queue on `Queue` instances (*read*) · covers our angle: full for the Redis settings · fetched 2026-10-12
- **Read this (2/2):** [BullMQ: Architecture](https://docs.bullmq.io/guide/architecture) · docs.bullmq.io · job states described as a waiting list, prioritized set, delayed set, and an active set (*read*) · covers our angle: **partial** — no mention of Lua scripts or atomic transitions on this page · fetched 2026-10-12
- **Also good:** [Deduplication](https://docs.bullmq.io/guide/jobs/deduplication) · docs.bullmq.io · Simple mode ignores later jobs with the same ID until the first completes or fails (*read*) · [Job IDs](https://docs.bullmq.io/guide/jobs/job-ids) · docs.bullmq.io · ids are unique per queue and build the Redis key (*read*) · fetched 2026-10-12
- **Our delta:** the internals claim ("lists and sorted sets moved by Lua") is **not confirmed** by any page read; check BullMQ's source or changelog before our page states it.
