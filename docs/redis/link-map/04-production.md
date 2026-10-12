---
title: "Link map · Redis · T04-01 to T04-14 (phases 9-10)"
sidebar_label: "04 · Redis · production (phases 9-10)"
sidebar_position: 4
---

# Link map · Redis · T04-01 to T04-14 (phases 9-10)

Covers syllabus part 4 (`docs/redis/syllabus/04-production.md`): phase 9 memory, eviction and persistence (T04-01 to T04-07), phase 10 operations (T04-08 to T04-14).
**All 14 topics are 🔲 not written** — `docs/redis/pages` holds phase 0 only, so each block is a source bank for the day the page is written.
*read* = I read the passage; *headings only* = fetched, headings/size checked. No `#anchors` are given.

🔴 **Version note.** redis.io `docs/latest` is a moving target: the INFO page lists fields up to 8.10 and the site navigation shows 8.8; which is the current release is **not confirmed** here. Pin the version in each page's `> Verified:` line. Licence history read on redis.io: 7.2 and earlier BSD-3-Clause; 7.4 to 7.8 RSALv2 or SSPLv1; 8 and later RSALv2, SSPLv1 or AGPLv3.
Two URL traps: github.com pages for `ioredis` and `node-redis` return HTTP 403 to fetchers, so client docs below are the raw markdown on `raw.githubusercontent.com`; and redis.io answers HTTP 200 even for missing pages, so every link here was checked by reading its content.

---

## Phase 9 — Memory, eviction and persistence

### T04-01 · `maxmemory` and eviction policies — Master · 🔲 not written
- **Read this:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · redis.io · ≈3k words, updated 2026-09-11; lists `noeviction`, `allkeys-lru/lrm/lfu/random`, `volatile-lru/lrm/lfu/random/ttl`; `maxmemory 0` is the default on 64-bit (32-bit has an implicit 3GB limit); "`allkeys-lru` is a good default option" if no reason to prefer another; the `volatile-*` policies act like `noeviction` when no key has a TTL; approximated LRU and LFU tuning sections (*read*) · covers our angle: **partial** — this page does not state the shipped default policy · fetched 2026-10-12
- **Also good:** [redis.conf (unstable branch)](https://raw.githubusercontent.com/redis/redis/unstable/redis.conf) · raw.githubusercontent.com · the `maxmemory-policy` comment block says "The default is: maxmemory-policy noeviction" (*read*) · the primary statement of the default · fetched 2026-10-12
- **Our delta:** "the default is not what you want" — the page must say `maxmemory` defaults to unlimited and the policy to `noeviction`, and that managed services may ship a different default (not confirmed per provider).

### T04-02 · `noeviction` means writes start failing — Master · 🔲 not written
- **Read this:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · redis.io · `noeviction`: keys are not evicted but the server returns an error when a command would cache new data; with replication this applies to the primary only; read commands still work (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Redis FAQ](https://redis.io/docs/latest/develop/get-started/faq/) · redis.io · section "What happens if Redis runs out of memory?": at the `maxmemory` limit Redis starts to reply with an error (*read* the opening) · fetched 2026-10-12
- **Our delta:** the symptom a Node app sees (the client surfaces an OOM error reply on writes) — exact error text **not confirmed** on these pages.

### T04-03 · Eviction is not expiry — Understand · 🔲 not written
- **Read this (1/2):** [EXPIRE](https://redis.io/docs/latest/commands/expire/) · redis.io · section "How Redis expires keys": expiry is passive (on access) plus active (periodic random sampling of keys with TTLs) (*read*) · covers our angle: full for expiry · fetched 2026-10-12
- **Read this (2/2):** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · redis.io · eviction is triggered by the memory limit when a command adds data; `allkeys-*` policies consider every key, `volatile-*` only keys with a TTL (*read*) · covers our angle: full for "a key with no TTL can vanish under `allkeys-*`" (follows from the policy list) · fetched 2026-10-12

### T04-04 · Where the memory actually goes — Understand · 🔲 not written
- **Read this (1/2):** [Memory optimization](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/memory-optimization/) · redis.io · ≈2.6k words, updated 2026-09-21; special encoding of small aggregate types, with the `hash-max-listpack-entries 512` / `hash-max-listpack-value 64` style thresholds (listpack in 7.0+; ziplist names before), "use hashes when possible", fragmentation ratio caveats (*read*) · covers our angle: **partial** — no per-key overhead figure on this page
- **Read this (2/2):** [MEMORY USAGE](https://redis.io/docs/latest/commands/memory-usage/) · redis.io · the total includes administrative overhead; the example on Redis 7.2.0 64-bit with jemalloc measures an empty-string key and empty value at 56 bytes of pure overhead (*read*) · covers our angle: full for "a tiny key is mostly overhead" · fetched 2026-10-12
- **Our delta:** the "million tiny keys" arithmetic is ours; the 56-byte figure is version- and allocator-specific, label it so.

### T04-05 · RDB vs AOF — Understand · 🔲 not written
- **Read this:** [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) · redis.io · RDB advantages and disadvantages, AOF advantages and disadvantages, "Ok, so what should I use?"; `appendfsync always` (every append, very slow, very safe), `everysec` (may lose 1 second on disaster), `no` (OS decides); RDB loses the latest minutes if Redis stops uncleanly (*read*) · covers our angle: full · fetched 2026-10-12

### T04-06 · What Redis may hold, given that guarantee — Master · 🔲 not written
- **Read this:** [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) · redis.io · "Ok, so what should I use?": both methods together for safety "comparable to what PostgreSQL can provide"; RDB alone if a few minutes of loss is tolerable; persistence can be disabled entirely for a cache (*read*) · covers our angle: **partial** — the page tells you how to persist, not what to keep out; the "never the only copy" rule is ours · fetched 2026-10-12
- **Also good:** [Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/) · redis.io · states plainly that Sentinel plus Redis does not guarantee acknowledged writes are kept, because replication is asynchronous (*read*) · fetched 2026-10-12
- **Our delta:** a table of data kinds (cache, sessions, rate limits, queues, locks) against loss tolerance.

### T04-07 · Fork, copy-on-write and the memory spike — Know · 🔲 not written
- **Read this:** [Redis FAQ](https://redis.io/docs/latest/develop/get-started/faq/) · redis.io · section "Background saving fails with a fork() error on Linux?": background saving relies on copy-on-write of `fork`; parent and child share pages, a page is duplicated only when it changes; short answer `overcommit_memory` set to 1 (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/) · redis.io · sections "Latency generated by fork" and transparent huge pages: with THP a few event-loop runs can copy almost the whole process memory, giving big latency and memory use (*read*) · [Redis administration](https://redis.io/docs/latest/operate/oss_and_stack/management/admin/) · the `vm.overcommit_memory = 1` and THP-off instructions (*read*) · fetched 2026-10-12
- **Our delta:** a headroom rule of thumb is ours, not on these pages; `rdb_last_cow_size` in INFO is the field that measures it (*read* on the INFO page).

## Phase 10 — Operations

### T04-08 · Replication — Understand · 🔲 not written
- **Read this:** [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/) · redis.io · ≈4.6k words; "Redis uses asynchronous replication"; replicas are read-only by default (`replica-read-only`); `min-replicas-to-write` / `min-replicas-max-lag` refuse writes when too few replicas are close; expiry propagates as `DEL` from the master (*read*) · covers our angle: **partial** — the word "stale" does not appear in the passages searched; the stale-read consequence is ours · fetched 2026-10-12
- **Also good:** [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) · redis.io · `READONLY` tells a replica the client accepts "possibly stale data" (*read*) · fetched 2026-10-12

### T04-09 · Sentinel and failover — Know · 🔲 not written
- **Read this (1/2):** [High availability with Redis Sentinel](https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/) · redis.io · ≈12k words; monitoring, notification, automatic failover and acting as a configuration provider for clients; "You need Sentinel support in your clients"; no guarantee of retained acknowledged writes (*read* the opening and the client section) · covers our angle: full for what promotes a replica · fetched 2026-10-12
- **Read this (2/2):** [ioredis README → Sentinel](https://raw.githubusercontent.com/redis/ioredis/main/README.md) · raw.githubusercontent.com · after a failover ioredis asks the sentinels for the new master and connects to it; commands sent during the failover are queued; `sentinelRetryStrategy` applies when all sentinels are unreachable (*read*) · covers our angle: full for ioredis · fetched 2026-10-12
- **Also good:** [node-redis Sentinel guide](https://raw.githubusercontent.com/redis/node-redis/master/docs/sentinel.md) · raw.githubusercontent.com · `createSentinel` with `name` and `sentinelRootNodes`; reconfigures itself for failover and topology changes (*read* the opening) · fetched 2026-10-12

### T04-10 · Cluster mode and hash slots — Understand · 🔲 not written
- **Read this:** [Scale with Redis Cluster](https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/) · redis.io · ≈8.7k words; 16384 slots, slot is CRC16 of the key modulo 16384; multi-key commands (and a transaction, or a Lua script) need all keys in the same slot; hash tags: the substring inside braces is what is hashed, for example `user:{123}:profile` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [node-redis clustering](https://raw.githubusercontent.com/redis/node-redis/master/docs/clustering.md) · raw.githubusercontent.com · `createCluster` with `rootNodes`, `useReplicas` default false, `maxCommandRedirections` 16 on `MOVED`/`ASK` (*read* the table) · fetched 2026-10-12

### T04-11 · What breaks in cluster mode — Understand · 🔲 not written
- **Read this (1/2):** [Multi-key operations](https://redis.io/docs/latest/develop/using-commands/multi-key-operations/) · redis.io · per-configuration behaviour table (single-slot versus cross-slot); a clustered `MSET user:1 ... user:2 ...` may fail, `MSET {users}:1 ...` is the fix, `CLUSTER KEYSLOT` checks a key (*read*) · covers our angle: full for `MGET`/`MSET`-style commands · fetched 2026-10-12
- **Read this (2/2):** [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/) · redis.io · "Redis Cluster does not support multiple databases": only database 0, `SELECT` not allowed; during resharding multi-key operations may be briefly unavailable (*read*) · covers our angle: **partial** — `KEYS` in cluster mode is **not confirmed** on either page · fetched 2026-10-12

### T04-12 · Security — Master · 🔲 not written
- **Read this (1/2):** [Redis security](https://redis.io/docs/latest/operate/oss_and_stack/management/security/) · redis.io · ≈1.8k words; network security, protected mode ("many users fail to protect Redis instances", left exposed on public IPs), a single `FLUSHALL` can wipe the dataset, legacy `requirepass`, TLS support, `rename-command` (marked deprecated in favour of ACL rules) (*read*) · covers our angle: full · fetched 2026-10-12
- **Read this (2/2):** [ACL](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/) · redis.io · ≈6k words; a fresh instance has `user default on nopass ~* &* +@all`; `requirepass` sets the default user's password; `ACL SETUSER` rules, categories, key permissions (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Encryption (TLS)](https://redis.io/docs/latest/operate/oss_and_stack/management/security/encryption/) · redis.io · TLS setup page; fetched (HTTP 200) but its text was not opened (*not opened*) · fetched 2026-10-12

### T04-13 · Observability — Understand · 🔲 not written
- **Read this:** [INFO](https://redis.io/docs/latest/commands/info/) · redis.io · the field reference: `used_memory`, `maxmemory_policy`, `mem_fragmentation_ratio` (not pure fragmentation; `allocator_frag_ratio` is), `evicted_keys`, `keyspace_hits`/`keyspace_misses`, `blocked_clients`, `master_last_io_seconds_ago`, `slave_repl_offset`, `rdb_last_bgsave_status`, `latest_fork_usec` (*read*) · covers our angle: **partial** — a ready-made "alert on these" list does not exist here; the hit-rate formula is ours · fetched 2026-10-12
- **Also good:** [Diagnosing latency issues](https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/) · redis.io · tells you to check the Slow Log for slow commands and to disable THP (*read*) · fetched 2026-10-12

### T04-14 · Managed Redis and the licence question — Know · 🔲 not written
- **Read this (1/2):** [Redis licences](https://redis.io/legal/licenses/) · redis.io · versions 7.2 and earlier BSD-3-Clause; 7.4 to 7.8 RSALv2 or SSPLv1; 8+ RSALv2, SSPLv1 or AGPLv3 (*read*) · covers our angle: full for the licence timeline · fetched 2026-10-12
- **Read this (2/2):** [Compare Redis OSS and Valkey](https://aws.amazon.com/elasticache/redis/) · aws.amazon.com · vendor page, dated by fetch only; "fully managed removes ... hardware provisioning, software patching, setup, configuration, and failure recovery"; Valkey is BSD-licensed and Linux Foundation stewarded (*read*) · covers our angle: **partial** — a vendor's own account; what the provider does **not** take over (schema, eviction choice, client behaviour on failover) is not listed and is ours · fetched 2026-10-12
- **Also good:** [Redis is now available under the AGPLv3 open source license](https://redis.io/blog/agplv3/) · redis.io · blog post dated May 01, 2025 by Rowan Trollope (a vendor's statement of its own reasons) (*read* the opening) · [Valkey](https://valkey.io/) · valkey.io · the fork's home page; backed by the Linux Foundation (*read*) · fetched 2026-10-12
- **Our delta:** keep the licence facts dated and attributed; the forks' relationship to 7.2 is stated by AWS, not on the Redis pages read.
