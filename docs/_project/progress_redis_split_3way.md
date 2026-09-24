---
name: devbible-redis-split-3way
description: The THREE-way Redis split (chunks A B C) — per-chunk cursor, worklist, page shape and rules. Open this the moment the user says "redis A" (or B, or C).
metadata:
  type: progress
---

🔴 **This is the live cursor for Redis.** Open it the moment the user says *"redis A"* (or B, or
C) and start writing at the topic that chunk's row names. **No plan, no confirmation, no
clarifying question.**

Created 2026-08-17 by session `3bb1face` on the user's instruction:

> *"Wait we need to split this redis into 3 parts and i will give it to other sessions as well"*

## 🔴🔴 START HERE — "redis" plus a letter is the whole instruction

**All of these mean the same thing:** *"pick redis A"* · *"redis chunk B"* · *"take C"* ·
*"redis a"*. On seeing one:

1. **Open this file**, read your chunk's row, start at the topic it names.
2. **Claim the chunk** — your session id into the chunk table in `docs/redis/pages/README.md`
   **and** into your chunk's row in `docs/README.md`. Naming a chunk **transfers it** to the
   session it was named in; if the row shows an older id, take it over and say so.
3. **Start writing.** No syllabus review, no "shall I begin".

**A phase number settles it too:** 0/1/2/3 → **A** · 4/5/6 → **B** · 7/8/9/10 → **C**.
**Only ask if the user says "Redis" with no letter and no phase.**

| Chunk | Phases | Topics | 🔴 Start at | Held by |
|---|---|---|---|---|
| **A** | **0, 1, 2, 3** | **23** | 🔴 **Phase 0 · topic 02 · Single-threaded command execution** | session `3bb1face`, 2026-08-17 |
| **B** | **4, 5, 6** | **21** | **Phase 4 · topic 01 · Hashes** | — unclaimed |
| **C** | **7, 8, 9, 10** | **30** | **Phase 7 · topic 01 · Cache-aside** | — unclaimed |

**74 topics total, 1 written.** Whole phases only, contiguous — so no two sessions ever write in
the same phase directory or the same phase `README.md`.

### Chunk A per-file log

| Topic | Files | Lines | State |
|---|---|---|---|
| **0 · 01 · What Redis is** | `01-what-redis-is/` — index + 4 chunks | **1,175**, largest **285** | ✅ done, commits `8de5ca27` `8b01779c` `42656d58` `c4068589` |

**What topic 01 covers**, so a later session does not duplicate it:

- `01-the-data-structure-server.md` (261) — the docs' own *"Redis is a data structure server"*;
  the full type inventory split general-purpose (strings, arrays, hashes, JSON, lists, sets,
  sorted sets, streams) vs specialized (geo, probabilistic, time series, vector sets); the
  problem→type table; the docs' *"you could probably emulate any of them using just strings"*
  quote and the **five** things that costs (atomicity, complexity class, partial access,
  server-side computation, memory encodings).
- `02-operations-where-the-data-is.md` (279) — the read-modify-write race in Node; the docs'
  **verbatim `INCR` atomicity paragraph**; the seven-row check-then-act table
  (`SADD`/`RPUSH`/`LPOP`/`ZINCRBY`/`SET … NX`/`GETEX`/`GETDEL`); `SINTER` as
  computation-not-storage; round-trip arithmetic and why `MGET` is a *latency* win (O(N)
  server-side); the per-process-counter × instance-count bug that Phase 8 revisits.
- `03-choosing-the-type.md` (285) — the docs' **three decision trees** (documents, collections,
  sequences) and the two memory orderings they state (strings\<hashes\<JSON;
  strings\<sets\<sorted sets); the **auxiliary-hash pattern** for per-member metadata; the
  bitmap branch for integer ids in a known range; the cost of choosing wrong — no `ALTER TABLE`,
  and `SET` overwrites *any* type silently while type commands raise `WRONGTYPE`.
- `04-what-redis-is-not.md` (281) — not a system of record; not relational (**no secondary
  index without Redis Search — you maintain it by hand on every write path**); not a queue with
  guarantees by default (Pub/Sub connected-only, list at-most-once, streams at-least-once);
  not free of blocking; not a lock service; the five "do not reach for Redis" cases; the
  **accumulation failure mode** — one instance, one eviction policy, three criticalities.

⚠️ **Verification was link-resolution, not a build** — rule 12, the registry row was never
claimed. A Python walker resolved every relative link in `docs/redis`: **0 unresolved.**

⚠️ **Two commit messages were amended for wrong line counts** before anyone read them (247→279,
975→1,175). Count with `wc -l` *before* writing the message, not from memory — the numbers in a
commit message are claims like any other.

### Why the split falls here

- **A = "how Redis works, and the simplest type."** Part 1 entire (the execution model, the
  keyspace, `redis-cli`) plus phase 3 strings/counters. This is the foundation every other chunk
  cites, so it should move first and fast.
- **B = "the types that make Redis worth running, and how Node talks to them."** The four
  collections, sorted sets as tools, streams, then the client that consumes them.
- **C = "Redis in a real system."** Caching, the four patterns the Node and Express tracks defer
  to, then all of Part 4 (memory/persistence, operations) kept intact so the production story
  reads as one argument.

⚠️ **C is deliberately the heaviest at 30.** Its topics share scaffolding — phase 8's four
patterns reuse one key-shape/TTL/atomicity discussion — so 30 there is not 30 elsewhere.

---

## 🔴 RULE 1 + RULE 13, restated by the user on 2026-08-17 — read before writing a line

> *"make sure your following 300 lines rule per explanation or page but that is not content
> budget you can go as 1000+ lines just chunk them into multiple parts"*

**The 300-line cap is a FILE-SIZE rule. It is never a content budget.**

1. **Write everything the topic has first.** Do not look at the line count while writing.
2. **Then split** on concept boundaries into `NN-topic/` chunk directories so **no file exceeds
   300**.
3. **Then wire the chunks in** — the topic `README.md` indexes them, the prose links to them.

**Content is fixed; file count is the variable.** A topic with thirty gotchas is a topic with more
chunks, never a topic with the best six gotchas.

**Gotchas, pitfalls, worked examples and interview Q&A are exhaustive, not representative.** Not
two, not three, not five because five looked like enough. Redis is a topic area where the gotcha
list is genuinely long — `KEYS` in production, a TTL lost to `SET` without `KEEPTTL`, a lock
released by the wrong owner, `MGET` across cluster slots. List them all.

**Four tells you got it wrong:**

- Every page in the run has about the same number of gotchas and questions → a template.
- The page names the hard thing and demonstrates the easy one.
- *"The correct fix is X"* with no X shown.
- Pages clustering in a narrow band just under the cap.

⚠️ **The measured precedent, from the 2026-08-17 corpus audit:** Docker has **exactly 4 gotchas on
90% of its 225 pages** — a template, and the worst offender in the repo. JavaScript is the healthy
example: 6 median, range 0–10, no clustering. **Write like JavaScript, not like Docker.**

### Chunked-topic layout

```
NN-topic/
├── _category_.json   {"label":"NN · Topic","position":N,"collapsed":true}
├── README.md         topic index: tier badge, Verified line, one-liner, chunk table,
│                     phase gate, "Where this connects"
├── 01-first-chunk.md
└── 02-second-chunk.md
```

Every chunk repeats the tier badge and the `> Verified:` line, and carries **its own** Gotchas and
Interview questions. Chunks link `← Prev` / `Next →`.

🔴 **Do not forget `_category_.json`.** Six topic directories in this repo are missing one and the
sidebar shows `01-daemonless` instead of `01 · Daemonless`.

---

## 🔴 Evidence rule — NO SANDBOX, and there is no Redis server on this machine

Rule 8 closed sandboxing. **Every claim is validated against the official documentation** and the
source is named in the `> Verified:` line.

- **No run means no console block.** Never reconstruct a plausible `redis-cli` transcript, a
  latency figure, a `MEMORY USAGE` byte count or an `INFO` dump from memory. That is invented
  output and it is banned.
- Command *syntax* and *semantics* from `redis.io/docs/latest/commands/<cmd>` are fine to show as
  code. **Command syntax is not output.** Show `SET key val NX PX 30000`; do not show what the
  server printed back unless a real run produced it.
- A claim the docs cannot settle is **stated as uncertain** or left out. *"I could not confirm
  this"* is acceptable; a confident invention is not.

**Primary sources for this track:**

| Area | Source |
|---|---|
| Commands | `https://redis.io/docs/latest/commands/<command>/` |
| Data types | `https://redis.io/docs/latest/develop/data-types/` |
| Eviction | `https://redis.io/docs/latest/develop/reference/eviction/` |
| Persistence | `https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/` |
| Clients | `https://redis.io/docs/latest/develop/clients/` |
| Distributed locks | `https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/` |
| Keyspace notifications | `https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/` |
| What's new | `https://redis.io/docs/latest/develop/whats-new/` |

⚠️ **The 8.x line ships fast** — four feature releases in under a year. **Name the version a
behaviour was confirmed on** rather than writing "current". Target is **Redis Open Source 8.x**
(8.10 current as of August 2026). Node clients: `node-redis` 6.2.1, `ioredis` 6.0.0 (npm,
2026-08-14 — re-check if you cite a version-specific API).

---

## Page shape — copy MongoDB, it is the closest analogue

`docs/mongodb/pages/phase-0-how-mongodb-runs/01-what-mongodb-actually-is.md` is the model: same
evidence regime (documentation-validated, no console blocks), same structure.

```
---
title: "..."
sidebar_label: "01 · ..."
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the **Redis documentation** — [link](url), [link](url).

**The one-sentence claim the page is downstream of.**

## ...body sections...
## Trade-off
## Gotchas          ← **Symptom: / Cause: / Fix:** per entry, as many as the topic has
## Interview questions  ← ★ marks the ones that actually get asked; as many as the topic has

---
Next: [02 · ...](./02-....md) →
```

**Link rule, no exceptions:** every link ends in `.md` and keeps every numeric prefix.
`../01-inner-join/README.md` for a directory index, `../01-inner-join/02-fan-out.md` for a file in
it. Never the directory slug — it breaks in `README.md` index pages and cost this repo 188 broken
links once already.

---

## The worklists — in syllabus row order

### Chunk A — phases 0, 1, 2, 3 · 23 topics

**Phase 0 · How Redis runs (6)** — `docs/redis/pages/phase-0-how-redis-runs/`

| # | Topic | Tier |
|---|---|---|
| 01 | What Redis is — an in-memory **data-structure server**, not a "key-value cache" | Master |
| 02 | Single-threaded command execution — atomicity is a consequence; I/O threads do not change it | Master |
| 03 | O(N) commands block everyone — `KEYS`, `FLUSHALL`, big `LRANGE`, `SMEMBERS` | Master |
| 04 | The RESP protocol and round trips — the network is usually the latency | Understand |
| 05 | Redis is not durable by default — what "in-memory" costs, and what you may store | Master |
| 06 | Versions and the 8.x line — what Redis 8 absorbed; choosing a target | Know |

**Gate:** you can explain why `KEYS *` on production is an outage, and why `INCR` needs no lock.

**Phase 1 · Keys, expiry and the keyspace (6)** — key naming as a schema · TTL and expiry ·
how expiry actually happens (lazy + active sampling) · `SCAN` instead of `KEYS` · `UNLINK` vs
`DEL` · keyspace notifications.
**Gate:** iterate a million-key keyspace without blocking; say what happens to a key whose TTL
passed while nobody read it.

**Phase 2 · `redis-cli`, mastered (5)** — connecting and numbered databases (a cluster trap) ·
`MONITOR`/`SLOWLOG`/`INFO` · `--bigkeys`/`--memkeys`/`--hotkeys`/`--scan` · `OBJECT ENCODING` and
`MEMORY USAGE` · `--latency`/`--stat`.
**Gate:** name an unfamiliar instance's largest keys, slowest commands and memory ceiling in five
minutes.

**Phase 3 · Strings, numbers and bitmaps (6)** — `SET` and its options (`EX`/`PX`/`NX`/`XX`/
`KEEPTTL`/`GET`) · `INCR`/`DECR`/`INCRBY` · `GETEX`/`GETDEL` · `MGET`/`MSET` and the cluster
caveat · strings hold bytes · bitmaps.

### Chunk B — phases 4, 5, 6 · 21 topics

**Phase 4 · Hashes, lists, sets, sorted sets (8)** — hashes · per-field TTL (`HEXPIRE`, 7.4+) ·
lists · blocking list ops (`BLPOP`, `LMOVE`) and the reliable-queue failure mode · sets and set
algebra · sorted sets · **sorted sets as tools** (leaderboards, sliding windows, delay queues) ·
choosing between them.
**Gate:** given "top 10 players", "has this user seen this post", "process these in order" and
"everything in the last 15 minutes", you pick the type for each without looking anything up.

**Phase 5 · Streams (6)** — `XADD` and the entry id · `XREAD` vs consumer groups · consumer groups
and at-least-once · the pending entries list (`XPENDING`, `XCLAIM`/`XAUTOCLAIM`) · trimming ·
streams vs Pub/Sub vs a list.
**Gate:** a consumer group that survives a consumer killed mid-message, with work reclaimed.

**Phase 6 · The Node client (7)** — `node-redis` vs `ioredis` · connecting once and injecting ·
reconnection and command buffering · errors that must not crash the process · pipelining vs
`MULTI` · timeouts and retries · graceful shutdown.

### Chunk C — phases 7, 8, 9, 10 · 30 topics

**Phase 7 · Caching, properly (8)** — cache-aside · invalidation · what must never be cached ·
stampede/thundering herd · cache penetration · key design and versioning · measuring hit rate ·
when not to cache.
**Gate:** explain what happens to your database the moment a popular cached key expires.

**Phase 8 · Sessions, rate limits, locks, queues (8)** — session store (`connect-redis`) ·
revocation and denylists · rate limiting (fixed window, sliding window, token bucket) · why the
limiter must be shared · distributed locks and the unlock-with-Lua requirement · Redlock honestly ·
idempotency-key storage · queues and BullMQ.
**Gate:** a rate limiter correct across three instances, and a lock whose failure modes you can
state without hand-waving.

**Phase 9 · Memory, eviction, persistence (7)** — `maxmemory` and eviction policies · `noeviction`
means writes fail · eviction is not expiry · where the memory actually goes (encodings) · RDB vs
AOF · what Redis may hold · fork/copy-on-write and the save spike.

**Phase 10 · Operations (7)** — replication and stale reads · Sentinel and failover · cluster mode
and hash slots (`{user:1}` hash tags) · what breaks in cluster mode · security · observability ·
managed Redis.

---

## Cadence — 🔴 PER FILE, and the UI after every topic

Write a file → update the boards → commit → update this memory. A session that dies must lose at
most one file.

**After every topic, update all four boards:**

1. `src/data/progress.js` — the **redis** row only. Mid-phase needs **both** `pages: N` **and**
   `pagesPlanned: <total>`, or `phaseStatus()` reports the phase complete. Drop `pagesPlanned`
   only at phase close.
2. That phase's `README.md` — the count, the topic row, the Coverage block.
3. `docs/redis/pages/README.md` — the phase table row and your chunk's row.
4. `docs/README.md` — your chunk's claim row; the Redis technology row at a phase close.

## Shared-checkout rules

- ⛔ **Never `git add -A`.** Stage explicit paths. A dozen sessions write here at once.
- `src/data/progress.js` has **one** redis row that all three chunks increment — **re-read it
  before editing and take the higher number if it moved.**
- ⛔ **Cross-chunk links break the build.** Where your page needs a topic another chunk owns,
  write it as **bold plain text with *(not written yet)***, never a link. Convert to a real link
  only once the target exists on disk.
- 🔴 **Rule 12 — never run `yarn build` or `yarn start` without claiming the row** in
  `shared/session_build_devserver_registry.md`. `yarn build` compiles every language and is as
  heavy as the dev server. Verify links by resolving each target against the filesystem
  (`shared/scripts/fixlinks.py`, dry-run by default) and check the cap with `wc -l`. If you did
  not build, **say "link-checked, not built"** rather than implying a build passed.

## Findings

- ⚠️ **The syllabus tier table may be miscounted.** `docs/redis/README.md` and
  `syllabus/04-production.md` both claim **Master 24 / Understand 34 / Know 16**. Counting one
  badge per syllabus row gives **Master 27** (A 10 · B 8 · C 9). Not corrected — flagged here so
  whoever closes the track recounts before quoting a distribution. Do not "fix" it on a guess;
  see [[devbible-feedback-count-by-first-tier-badge]].
- **92 published pages mention Redis, but only 6 are actual links** into `docs/redis`. The
  earlier "39 pages defer to it and point at nothing" claim overstated the link breakage — the
  debt is real, but it is prose promises, not dangling links. Chunk C's phases 7 and 8 are where
  those promises get paid.

## Where this connects

| From | To |
|---|---|
| Phase 6 — the client | **Node Phase 6** — connection lifecycle, injection, pooling |
| Phase 8 — queues | **Node Phase 7** — jobs, outbox, idempotency, worker shutdown |
| Phase 8 — sessions, denylists | **Express Phase 8** — cookie/session wire-up, revocation |
| Phase 8 — rate limiting | **Express Phase 9** — why per-process counters are wrong |
| Phase 8 — idempotency keys | **Express Phase 6** — the atomic claim and the race it closes |
| Phase 9 — durability | **PostgreSQL** — the system of record Redis is *not* |

Related: [[devbible-full-corpus-audit-20260817]] · [[devbible-docker-split-4way]] ·
[[devbible-javascript-split-4way]] · [[devbible-feedback-never-compress-to-fit-cap]] ·
[[devbible-mongodb-pages-progress]]
