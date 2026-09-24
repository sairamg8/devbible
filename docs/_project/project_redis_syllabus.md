---
name: devbible-redis-syllabus
description: Redis syllabus — the scope decision, the 74-topic inventory, version facts, and why this track was picked up
metadata:
  type: project
---

# Redis syllabus — written 2026-08-14, session `8679dc8c`

**Status: syllabus complete, no explanation pages yet. Next unit is Phase 0 · How
Redis runs (6 topics).** Claimed in `docs/README.md` and `docs/redis/pages/README.md`.

Picked up immediately on finishing [[progress_expressjs_completion]], per the
pick-the-next-idle-language rule.

## Why Redis, and not Docker or Nginx

**Node and Express reference Redis on 39 pages** and defer the mechanism to a track
that did not exist — session stores (`connect-redis`), shared rate-limiter state,
JWT denylists, idempotency-key storage, job queues. Those cross-links were written
by this same session while completing Node and Express, so the gap was self-created
and the most concrete of the three unclaimed options.

## Shape

**11 phases, 74 topics, 4 parts** — deliberately comparable to CSS's re-scoped 74
rather than to Node's 248.

| Part | Phases | Topics |
|---|---|---|
| 1 · How Redis works | 0 runs · 1 keys/expiry · 2 redis-cli | 6 + 6 + 5 |
| 2 · The data types | 3 strings · 4 collections · 5 streams | 6 + 8 + 6 |
| 3 · From Node | 6 client · 7 caching · 8 patterns | 7 + 8 + 8 |
| 4 · Production | 9 memory/persistence · 10 operations | 7 + 7 |

Tiers: **Master 24 · Understand 34 · Know 16.** **No `When Needed` tier at all** —
instead of parking topics in the lowest tier, they were cut from scope and listed
under "Deliberately not here".

## Scope decisions — the part worth remembering

**Cut, deliberately:** Redis Search, JSON, time series, vector sets (all absorbed
into Redis 8 and all real — but out of a fullstack brief); Lua scripting as a
subject (the unlock script earns its place, nothing else); cluster administration,
resharding and migration (infrastructure, not application development); building a
queue by hand (Node Phase 7 uses BullMQ).

**Kept, because the rest of the bible needs it:** sorted sets as *tools*
(leaderboards, sliding windows, delay queues) is a Master row on its own; the
cluster row is kept but narrowed to the one thing that bites daily — **multi-key
commands need the same hash slot**, and hash tags are how you get it.

## Version facts (checked 2026-08-14)

- **Redis Open Source 8.10** is current (Q3 2026), after **8.8** (Q2), **8.6** and
  **8.4** (Q1 2026), **8.2** and **8.0** (2025) — confirmed from
  [redis.io "What's new"](https://redis.io/docs/latest/develop/whats-new/).
  ⚠️ A web search gave three different "current" answers (8.6.2, 8.8, 8.10); the
  redis.io release index settled it. **Do not trust a search result for this.**
- **Redis 8 absorbed** Search, JSON, time series and the probabilistic types — the
  standalone modules are no longer needed.
- **npm, checked today:** `node-redis` **6.2.1**, `ioredis` **6.0.0**.
- **The 8.x line ships fast** — four feature releases in under a year — so pages in
  this track must name the version a behaviour was confirmed on.

## Rules that bind this track

Same as Express: **no sandbox at all**, documentation-validated with the source named
in each `> Verified:` line, **no console block unless a run produced it**, UI updated
after every topic, memory every three. The syllabus README already carries the
no-sandbox notice so a later session does not have to infer it.

Related: [[progress_expressjs_completion]] · [[progress_nodejs_completeness_audit]] ·
[[feedback_no_new_sandbox_scripts]] · [[feedback_ui_progress_and_build_cadence]]
