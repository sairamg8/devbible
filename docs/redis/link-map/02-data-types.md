---
title: "Link map · Redis · T02-01 to T02-20 (phases 3-5)"
sidebar_label: "02 · Redis · data types (phases 3-5)"
sidebar_position: 2
---

# Link map · Redis · T02-01 to T02-20 (phases 3-5)

Covers syllabus part 2 (`docs/redis/syllabus/02-data-types.md`): phase 3 strings and bitmaps (T02-01 to T02-06), phase 4 hashes, lists, sets and sorted sets (T02-07 to T02-14), phase 5 streams (T02-15 to T02-20).
**All 20 topics are 🔲 not written** — `docs/redis/pages` holds phase 0 only, so each block is a source bank for the day the page is written.
*read* = I read the passage; *headings only* = fetched, headings/size checked. No `#anchors` are given.

🔴 **Version note.** redis.io `docs/latest` is a moving target and lists commands up to 8.10 (for example `SUNIONCARD`, `HIMPORT`). Pin the version in each page's `> Verified:` line.
Version gates read on these pages: `HEXPIRE` family 7.4.0, `HGETEX`/`HSETEX` 8.0.0, `XAUTOCLAIM` 6.2, `SET ... IFEQ/IFNE/IFDEQ/IFDNE` 8.4.0, stream idempotent production 8.6, `XTRIM ... KEEPREF/DELREF/ACKED` 8.2.
Two URL traps: the bitmaps page now lives at `strings/bitmaps/` (the old path redirects by script), and Pub/Sub lives at `develop/pubsub/` (`develop/interact/pubsub/` is a 404 page that still answers HTTP 200).

---

## Phase 3 — Strings, numbers and bitmaps

### T02-01 · `SET` and its options — Master · 🔲 not written
- **Read this:** [SET](https://redis.io/docs/latest/commands/set/) · redis.io · the full option list (`NX`, `XX`, `GET`, `EX`/`PX`/`EXAT`/`PXAT`, `KEEPTTL`); a successful `SET` discards any previous TTL; the options replace `SETNX`/`SETEX`/`PSETEX`; the pattern `SET resource-name anystring NX EX max-lock-time` is shown as a simple lock (*read*) · covers our angle: **partial** — the page does not narrate why one `SET` replaces a check-then-set race · fetched 2026-10-12
- **Also good:** [Redis Strings](https://redis.io/docs/latest/develop/data-types/strings/) · redis.io · its conditional-`SET` example is described as atomic compare-and-set behaviour with `NX`/`XX` (*read*) · fetched 2026-10-12
- **Our delta:** the check-then-set race (`GET` then `SET` from two clients) and how `NX EX` closes it; note the 8.4 `IFEQ`-style conditions are new and absent from older servers.

### T02-02 · `INCR` / `DECR` / `INCRBY` — Master · 🔲 not written
- **Read this:** [INCR](https://redis.io/docs/latest/commands/incr/) · redis.io · string must parse as a base-10 64-bit signed integer; the counter pattern is built on atomic increment; two rate-limiter patterns follow, the second warning about race conditions (*read*) · covers our angle: **partial** — the "why no transaction" argument is on the Strings page, not here · fetched 2026-10-12
- **Also good:** [Redis Strings → Strings as counters](https://redis.io/docs/latest/develop/data-types/strings/) · redis.io · the walk-through: clients 1 and 2 both read 10, both increment, final value is 12 because the read-increment-set runs while no other client executes a command (*read*) · fetched 2026-10-12
- **Our delta:** why an unprotected `GET` then `SET` loses updates and `INCR` does not; the 64-bit limit.

### T02-03 · `GETEX`, `GETDEL` — Understand · 🔲 not written
- **Read this (1/2):** [GETEX](https://redis.io/docs/latest/commands/getex/) · redis.io · like `GET` but a write command; options `EX`/`PX`/`EXAT`/`PXAT`/`PERSIST`, mutually exclusive (*read*) · covers our angle: full for read-and-expire · fetched 2026-10-12
- **Read this (2/2):** [GETDEL](https://redis.io/docs/latest/commands/getdel/) · redis.io · gets the value and deletes the key, only if the value is a string (*read*) · covers our angle: full for read-and-remove · fetched 2026-10-12

### T02-04 · `MGET` / `MSET` — Understand · 🔲 not written
- **Read this (1/2):** [MGET](https://redis.io/docs/latest/commands/mget/) · redis.io · returns `nil` for missing or non-string keys so it never fails; a note says behaviour differs in clustered setups (*read*) · covers our angle: **partial** — the cluster rule is only pointed at · fetched 2026-10-12
- **Read this (2/2):** [Multi-key operations](https://redis.io/docs/latest/develop/using-commands/multi-key-operations/) · redis.io · per-configuration table; with Open Source clustering enabled `MGET`/`EXISTS` are single-slot, while `SINTER`, `SUNION`, `XREAD` and similar are single-slot in every cluster mode listed (*read* the read-only table) · covers our angle: full for the caveat · fetched 2026-10-12
- **Also good:** [MSET](https://redis.io/docs/latest/commands/mset/) · redis.io · short; "atomically creates or modifies" plus the same cluster note (*read*) · fetched 2026-10-12

### T02-05 · Strings hold **bytes** — JSON, binary, size limit — Understand · 🔲 not written
- **Read this:** [Redis Strings](https://redis.io/docs/latest/develop/data-types/strings/) · redis.io · strings store bytes including serialized objects and binary data; a value cannot exceed 512 MB; `SUBSTR`/`GETRANGE`/`SETRANGE` can be O(n); suggests hashes or JSON for structured data (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Compare data types](https://redis.io/docs/latest/develop/data-types/compare-data-types/) · redis.io · when a string is the right document container versus hash or JSON (*read* the Strings, Hashes and JSON sections) · fetched 2026-10-12
- **Our delta:** a Node example storing JSON and a `Buffer`, and the round-trip type (string versus buffer) per client.

### T02-06 · Bitmaps and `SETBIT`/`BITCOUNT` — Know · 🔲 not written
- **Read this:** [Redis bitmaps](https://redis.io/docs/latest/develop/data-types/strings/bitmaps/) · redis.io · bitmaps are strings, so up to 512 MB; the space-savings example is 4 billion users' yes/no flags in 512 MB (*read* the intro and savings passage) · covers our angle: **partial** — a daily-active-users walkthrough is **not confirmed** on this page · fetched 2026-10-12
- **Also good:** [Bitmap Patterns](https://redis.antirez.com/community/bitmap-patterns.md) · redis.antirez.com · one key per day (`dau:2024-01-30` in its example), `SETBIT` per user, `BITCOUNT` for the total (*read*); undated, owner of the site **not confirmed**, so not chosen as primary · [SETBIT](https://redis.io/docs/latest/commands/setbit/) · [BITCOUNT](https://redis.io/docs/latest/commands/bitcount/) · redis.io · reference (*headings only*) · fetched 2026-10-12
- **Our delta:** the DAU recipe and the offset-size trap (a huge user id allocates a huge string).

---

## Phase 4 — Hashes, lists, sets and sorted sets

### T02-07 · Hashes — Master · 🔲 not written
- **Read this:** [Redis hashes](https://redis.io/docs/latest/develop/data-types/hashes/) · redis.io · command table (`HDEL`, `HGETALL` and more), limit of 2^32 - 1 field-value pairs, field expiration and compact-hash sections (*read* headings, summary and limits) · covers our angle: **partial** — the "hash beats a serialised JSON string" argument is **not stated** here · fetched 2026-10-12
- **Also good:** [Compare data types → Hashes](https://redis.io/docs/latest/develop/data-types/compare-data-types/) · redis.io · hashes suit objects with a small number of non-nested fields; values can be treated as numbers; per-field expiry; JSON for nested data (*read*) · [HSET](https://redis.io/docs/latest/commands/hset/) · reference (*headings only*) · fetched 2026-10-12
- **Our delta:** partial update (`HSET` one field) versus read-modify-write of a JSON string, with the race it avoids.

### T02-08 · Per-field TTL on hashes (`HEXPIRE`, 7.4+) — Know · 🔲 not written
- **Read this:** [Redis hashes → Field expiration](https://redis.io/docs/latest/develop/data-types/hashes/) · redis.io · "Redis 7.4 introduced" per-field TTL; lists the `H*EXPIRE*`, `HTTL`, `HPERSIST` commands, 8.0's `HGETEX`/`HSETEX`, and four use cases (event tracking, fraud detection, customer sessions, active-session tracking) (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [HEXPIRE](https://redis.io/docs/latest/commands/hexpire/) · redis.io · `NX`/`XX`/`GT`/`LT` conditions, `HPERSIST` clears the TTL, a section on Redis Search interaction (*read* the intro and options) · fetched 2026-10-12

### T02-09 · Lists — Master · 🔲 not written
- **Read this:** [Redis lists](https://redis.io/docs/latest/develop/data-types/lists/) · redis.io · what lists are, first steps, use cases (latest updates, producer/consumer; resque and sidekiq named as users), capped lists, 2^32 - 1 element limit, automatic key removal (*read* headings and the use-case passage) · covers our angle: full · fetched 2026-10-12

### T02-10 · Blocking list ops — `BLPOP`, `BRPOPLPUSH`/`LMOVE` — Understand · 🔲 not written
- **Read this (1/2):** [LMOVE → Pattern: reliable queue](https://redis.io/docs/latest/commands/lmove/) · redis.io · a plain list queue loses messages if the consumer crashes after the pop; `LMOVE`/`BLMOVE` moves the item to a processing list, `LREM` acks, a watcher requeues stale items (*read*) · covers our angle: full for pattern and failure mode · fetched 2026-10-12
- **Read this (2/2):** [BLPOP](https://redis.io/docs/latest/commands/blpop/) · redis.io · "Reliable queues" section: the popped element is gone if the client crashes (*read*) — but it points to `BRPOPLPUSH`, which its own command page marks deprecated as of 6.2.0 (*read*); use `BLMOVE` in our page · fetched 2026-10-12
- **Also good:** [Redis lists → Blocking operations](https://redis.io/docs/latest/develop/data-types/lists/) · redis.io · why polling with `RPOP` is a poor idea and how blocking pops replace it (*read* the opening) · fetched 2026-10-12

### T02-11 · Sets — membership and set algebra — Master · 🔲 not written
- **Read this:** [Redis sets](https://redis.io/docs/latest/develop/data-types/sets/) · redis.io · command table with `SADD`, `SISMEMBER` (O(1)), `SINTER`, `SUNION`, `SDIFF` and the `*STORE`/`*CARD` variants, a tutorial section, 2^32 - 1 member limit (*read* the table and limits; tutorial *headings only*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [SINTER](https://redis.io/docs/latest/commands/sinter/) · redis.io · short reference; remember the cluster single-slot rule from T02-04 (*headings only*) · fetched 2026-10-12

### T02-12 · Sorted sets — `ZADD`, `ZRANGE`, `ZRANGEBYSCORE`, `ZRANK` — Master · 🔲 not written
- **Read this:** [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) · redis.io · scores, ranges by score, rank lookups (`ZRANK`/`ZREVRANK`), lexicographical scores, updating a score (leaderboards named as the use) (*read* the overview and range sections) · covers our angle: full · fetched 2026-10-12
- **Also good:** [ZADD](https://redis.io/docs/latest/commands/zadd/) · [ZRANGE](https://redis.io/docs/latest/commands/zrange/) · redis.io · reference (*headings only*); `ZRANGEBYSCORE` is marked deprecated as of 6.2.0 in favour of `ZRANGE ... BYSCORE` (*read* that note on its page) · fetched 2026-10-12
- **Our delta:** show `ZRANGE ... BYSCORE` as the current form and `ZRANGEBYSCORE` as the legacy name the syllabus row still uses.

### T02-13 · Sorted sets as tools — leaderboards, rate limits, delay queues, time indexes — Master · 🔲 not written
- **Read this (1/2):** [Build a Real-Time Leaderboard with Redis Sorted Sets](https://redis.io/tutorials/howtos/leaderboard/) · redis.io · Ajeet Raina, 2026-02-25; `ZADD`/`ZINCRBY` for scores, `ZREVRANGE`/`ZREVRANK`/`ZCOUNT` for top-N and rank (*read*) · covers our angle: full for leaderboards · fetched 2026-10-12
- **Read this (2/2):** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · redis.io · William Johnston, 2026-03-20; sliding-window log on a sorted set: `ZREMRANGEBYSCORE` prune, `ZCARD` count, `ZADD`, wrapped in one Lua `EVAL` because two concurrent requests could both pass the count; comparison table of five algorithms (*read*) · covers our angle: full for rate limits · fetched 2026-10-12
- **Also good:** [How to Build a Scheduled Queue in Redis](https://www.svix.com/resources/redis/scheduled-queue/) · svix.com · "Last updated on Aug 19, 2026"; score = run time, `ZRANGEBYSCORE` for due jobs, crash window between fetch and `ZREM`, atomic Lua claim (*read*) — vendor blog · [Delayed Queue Pattern](https://redis.antirez.com/fundamental/delayed-queue.md) · redis.antirez.com · same model, undated, site owner **not confirmed** (*read*) · fetched 2026-10-12
- **Our delta:** the time-ordered index (score = epoch ms, `ZRANGE ... BYSCORE` for "last 15 minutes") has no dedicated page found; the delay-queue claim step stays ours to test.

### T02-14 · Choosing between them — Understand · 🔲 not written
- **Read this:** [Compare data types](https://redis.io/docs/latest/develop/data-types/compare-data-types/) · redis.io · per-type structure, operations and "suitable for"; a "Choose a data type" part with decision trees for documents, collections and sequences, called rules of thumb (*read* the features and the documents tree; the other trees *headings only*) · covers our angle: **partial** — "the cost of choosing wrong" is not narrated · fetched 2026-10-12
- **Also good:** [Redis data types](https://redis.io/docs/latest/develop/data-types/) · redis.io · the index of types (*headings only*) · fetched 2026-10-12
- **Our delta:** the four-question gate from the syllabus (top 10, seen post, ordered jobs, last 15 minutes) as a worked table.

---

## Phase 5 — Streams

All stream blocks share one long page: [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) (≈25k words with code tabs; sections read are named per topic).

### T02-15 · `XADD` and the entry id — Understand · 🔲 not written
- **Read this:** [Redis Streams → Entry IDs](https://redis.io/docs/latest/develop/data-types/streams/) · redis.io · id is `millisecondsTime-sequenceNumber`; if the clock goes backward the previous time is reused so ids stay monotonic; time-in-id gives range queries by time (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [XADD](https://redis.io/docs/latest/commands/xadd/) · redis.io · arguments, `*`, specifying an id, capped streams; idempotent-message examples (*headings only*) · fetched 2026-10-12

### T02-16 · `XREAD` vs consumer groups — Understand · 🔲 not written
- **Read this (1/2):** [Redis Streams → Listening for new items with XREAD](https://redis.io/docs/latest/develop/data-types/streams/) · redis.io · by default every new item goes to every waiting consumer, unlike blocking lists (*read*) · covers our angle: full for fan-out · fetched 2026-10-12
- **Read this (2/2):** [XREADGROUP → Differences between XREAD and XREADGROUP](https://redis.io/docs/latest/commands/xreadgroup/) · redis.io · without groups all clients get all entries; with groups each gets a different subset; `GROUP name consumer` is mandatory; consumers are auto-created (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [XREAD](https://redis.io/docs/latest/commands/xread/) · redis.io · blocking, `$`, `+` ids (*headings only*) · fetched 2026-10-12

### T02-17 · Consumer groups — `XGROUP`, `XREADGROUP`, `XACK`; at-least-once — Understand · 🔲 not written
- **Read this:** [Redis Streams → Consumer groups](https://redis.io/docs/latest/develop/data-types/streams/) · redis.io · why groups exist (slow messages spread over workers), then creating a group and acking; includes "Differences with Kafka partitions" (partitions are only logical, one key) (*read* the opening and Kafka passages) · covers our angle: **partial** — "what you must make idempotent" is not framed that way · fetched 2026-10-12
- **Also good:** [XACK](https://redis.io/docs/latest/commands/xack/) · redis.io · removes messages from the PEL (*read*) · [XGROUP CREATE](https://redis.io/docs/latest/commands/xgroup-create/) · reference (*headings only*) · [XADD](https://redis.io/docs/latest/commands/xadd/) · from 8.6 supports idempotent production, which de-duplicates producer retries (*read* one paragraph on the Streams page) · fetched 2026-10-12
- **Our delta:** at-least-once means a redelivered entry; the consumer's handler must be idempotent.

### T02-18 · The pending entries list — `XPENDING`, `XCLAIM`/`XAUTOCLAIM` — Understand · 🔲 not written
- **Read this:** [Redis Streams → Recovering from permanent failures](https://redis.io/docs/latest/develop/data-types/streams/) · redis.io · a dead consumer's pending messages are claimed by another; explicit, inspect-then-claim; followed by automatic claiming (`XAUTOCLAIM`, added 6.2) and the delivery counter (*read* the failure and auto-claim passages) · covers our angle: full · fetched 2026-10-12
- **Also good:** [XAUTOCLAIM](https://redis.io/docs/latest/commands/xautoclaim/) · redis.io · equals `XPENDING` + `XCLAIM`, scans from a cursor, scans at most count x 10 entries (*read*) · [XPENDING](https://redis.io/docs/latest/commands/xpending/) · summary and extended forms, idle filter (*headings only*) · fetched 2026-10-12
- **Our delta:** the phase gate — kill a consumer mid-message and reclaim — as a runnable Node script.

### T02-19 · Trimming — `MAXLEN`/`MINID`, approximate — Understand · 🔲 not written
- **Read this:** [XTRIM](https://redis.io/docs/latest/commands/xtrim/) · redis.io · `=` exact versus `~` approximate (trims to at least the threshold, may keep slightly more, cheaper); `LIMIT`; 8.2 options `KEEPREF`/`DELREF`/`ACKED` for consumer-group references (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Redis Streams → Capped Streams](https://redis.io/docs/latest/develop/data-types/streams/) · redis.io · `MAXLEN` on `XADD` for constant memory, with a "trimming with consumer group awareness" subsection (*read* the opening) · fetched 2026-10-12
- **Our delta:** "an untrimmed stream is a memory leak" is our framing; no page states it that bluntly (not confirmed).

### T02-20 · Streams vs Pub/Sub vs a list — Know · 🔲 not written
- **Read this:** [Redis Pub/sub → Delivery semantics](https://redis.io/docs/latest/develop/pubsub/) · redis.io · Pub/Sub is at-most-once; a failed subscriber loses the message forever; streams persist and offer at-most-once and at-least-once (*read*) · covers our angle: **partial** — no three-way comparison with lists · fetched 2026-10-12
- **Also good:** [Redis Is Three Messaging Systems Pretending to Be One](https://codemia.io/archive/redis-as-message-bus-pubsub-vs-list-vs-streams) · codemia.io · 2026-01-06; Pub/Sub at-most-once fan-out, list push/pop as a simple queue, and streams (*read*, ≈0.5k words) · [LMOVE](https://redis.io/docs/latest/commands/lmove/) · the list failure mode, see T02-10 (*read*) · fetched 2026-10-12
- **Our delta:** "when none of them should be your queue" — no page found says it; keep our own argument.
