---
name: devbible-prompt-redis-chunks
description: Paste-ready bootstrap prompts for the three Redis chunks (A, B, C) — hand one to each new session.
metadata:
  type: project
---

# Paste-ready prompts — Redis, three chunks

Created 2026-08-17 by session `3bb1face` on *"we need to split this redis into 3 parts and i
will give it to other sessions as well"*.

Hand **one block** to each new session. Each is self-contained. Cursor of record:
[[devbible-redis-split-3way]].

| Chunk | Phases | Topics | Start at |
|---|---|---|---|
| A | 0, 1, 2, 3 | 23 | Phase 0 · 01 · What Redis is |
| B | 4, 5, 6 | 21 | Phase 4 · 01 · Hashes |
| C | 7, 8, 9, 10 | 30 | Phase 7 · 01 · Cache-aside |

---

## ▶ CHUNK A

```
Work devbible Redis, chunk A — and nothing else. Do not ask whether to continue between
topics; run it to completion.

Read /mnt/Storage/my-learning/claude/devbible/progress_redis_split_3way.md first — it is
your brief, your worklist and your cursor. Then claim chunk A in docs/redis/pages/README.md
and in docs/README.md, and start writing.

YOUR SCOPE: docs/redis/pages/phase-{0,1,2,3}-*/ only. 23 topics. Start at
phase 0 topic 01 · What Redis is. Finish a phase, then take the next in order.
Phases 4-10 belong to chunks B and C — never write in them, not even to fix a link.

THE 300-LINE RULE: it is a FILE-SIZE cap, never a content budget. Write everything the
topic has FIRST — every gotcha, pitfall, worked example and interview question the topic
actually supports — THEN split on concept boundaries into NN-topic/ chunk directories so no
file exceeds 300 lines. A topic running 1000+ lines across four chunks is normal. Never
trim, reword or drop a section to fit. Gotchas and Q&A are exhaustive, not representative:
not two, not three, not five because five looked like enough.

EVIDENCE: no sandbox, and there is no Redis server on this machine. Validate every claim
against redis.io documentation and name the source in a "> Verified:" line. NEVER
reconstruct a redis-cli transcript, latency number, MEMORY USAGE byte count or INFO dump
from memory — no run means no console block. Command syntax is fine to show; server output
is not. Target Redis Open Source 8.x and name the version a behaviour was confirmed on.

PAGE SHAPE: copy docs/mongodb/pages/phase-0-how-mongodb-runs/01-what-mongodb-actually-is.md
— same evidence regime, same structure. Every link ends in .md and keeps every numeric
prefix; never link a directory slug.

CADENCE: per file. Write a file -> update the four boards (progress.js redis row with BOTH
pages and pagesPlanned, the phase README, docs/redis/pages/README.md, docs/README.md) ->
commit -> update the memory file. Never git add -A; stage explicit paths. Never run
yarn build or yarn start without claiming the row in
/mnt/Storage/my-learning/claude/shared/session_build_devserver_registry.md.
```

---

## ▶ CHUNK B

```
Work devbible Redis, chunk B — and nothing else. Do not ask whether to continue between
topics; run it to completion.

Read /mnt/Storage/my-learning/claude/devbible/progress_redis_split_3way.md first — it is
your brief, your worklist and your cursor. Then claim chunk B in docs/redis/pages/README.md
and in docs/README.md, and start writing.

YOUR SCOPE: docs/redis/pages/phase-{4,5,6}-*/ only. 21 topics — the collection types,
streams, and the Node client. Start at phase 4 topic 01 · Hashes. Finish a phase, then take
the next in order. Phases 0-3 belong to chunk A and 7-10 to chunk C — never write in them,
not even to fix a link.

THE 300-LINE RULE: it is a FILE-SIZE cap, never a content budget. Write everything the
topic has FIRST — every gotcha, pitfall, worked example and interview question the topic
actually supports — THEN split on concept boundaries into NN-topic/ chunk directories so no
file exceeds 300 lines. A topic running 1000+ lines across four chunks is normal. Never
trim, reword or drop a section to fit. Gotchas and Q&A are exhaustive, not representative:
not two, not three, not five because five looked like enough. Sorted sets alone earns
several chunks — it is the type that makes Redis worth running.

EVIDENCE: no sandbox, and there is no Redis server on this machine. Validate every claim
against redis.io documentation and name the source in a "> Verified:" line. NEVER
reconstruct a redis-cli transcript, latency number, MEMORY USAGE byte count or INFO dump
from memory — no run means no console block. Command syntax is fine to show; server output
is not. Target Redis Open Source 8.x and name the version a behaviour was confirmed on —
HEXPIRE is 7.4+, so version claims here matter. node-redis 6.2.1 / ioredis 6.0.0 were the
npm versions on 2026-08-14; re-check before citing a version-specific API.

PAGE SHAPE: copy docs/mongodb/pages/phase-0-how-mongodb-runs/01-what-mongodb-actually-is.md
— same evidence regime, same structure. Every link ends in .md and keeps every numeric
prefix; never link a directory slug.

CADENCE: per file. Write a file -> update the four boards (progress.js redis row with BOTH
pages and pagesPlanned, the phase README, docs/redis/pages/README.md, docs/README.md) ->
commit -> update the memory file. Never git add -A; stage explicit paths. Never run
yarn build or yarn start without claiming the row in
/mnt/Storage/my-learning/claude/shared/session_build_devserver_registry.md.

Where your page needs a topic chunk A or C owns, write it as bold plain text with
"(not written yet)" — never a link. A cross-chunk link breaks the build.
```

---

## ▶ CHUNK C

```
Work devbible Redis, chunk C — and nothing else. Do not ask whether to continue between
topics; run it to completion.

Read /mnt/Storage/my-learning/claude/devbible/progress_redis_split_3way.md first — it is
your brief, your worklist and your cursor. Then claim chunk C in docs/redis/pages/README.md
and in docs/README.md, and start writing.

YOUR SCOPE: docs/redis/pages/phase-{7,8,9,10}-*/ only. 30 topics — caching, the four
patterns (sessions, rate limits, locks, queues), memory/persistence, and operations. Start
at phase 7 topic 01 · Cache-aside. Finish a phase, then take the next in order. Phases 0-6
belong to chunks A and B — never write in them, not even to fix a link.

YOURS IS THE CHUNK THE REST OF THE BIBLE POINTS AT. Node Phase 6 defers here for the
client, Node Phase 7 for queues and idempotency, Express Phase 8 for session stores,
Express Phase 9 for a rate limiter that survives more than one process, Express Phase 6 for
the idempotency-key claim. 92 published pages mention Redis. Read the page that defers
before writing the page it defers to, and cross-link back.

THE 300-LINE RULE: it is a FILE-SIZE cap, never a content budget. Write everything the
topic has FIRST — every gotcha, pitfall, worked example and interview question the topic
actually supports — THEN split on concept boundaries into NN-topic/ chunk directories so no
file exceeds 300 lines. A topic running 1000+ lines across four chunks is normal. Never
trim, reword or drop a section to fit. Gotchas and Q&A are exhaustive, not representative:
not two, not three, not five because five looked like enough. Distributed locks and cache
invalidation each have a long, genuinely important failure list — write all of it.

EVIDENCE: no sandbox, and there is no Redis server on this machine. Validate every claim
against redis.io documentation and name the source in a "> Verified:" line. NEVER
reconstruct a redis-cli transcript, latency number, MEMORY USAGE byte count or INFO dump
from memory — no run means no console block. Command syntax is fine to show; server output
is not. For Redlock, present the claim AND the published criticism, and say plainly when
Redis is the wrong tool — do not resolve the debate by picking a side the docs do not.

PAGE SHAPE: copy docs/mongodb/pages/phase-0-how-mongodb-runs/01-what-mongodb-actually-is.md
— same evidence regime, same structure. Every link ends in .md and keeps every numeric
prefix; never link a directory slug.

CADENCE: per file. Write a file -> update the four boards (progress.js redis row with BOTH
pages and pagesPlanned, the phase README, docs/redis/pages/README.md, docs/README.md) ->
commit -> update the memory file. Never git add -A; stage explicit paths. Never run
yarn build or yarn start without claiming the row in
/mnt/Storage/my-learning/claude/shared/session_build_devserver_registry.md.

Where your page needs a topic chunk A or B owns, write it as bold plain text with
"(not written yet)" — never a link. A cross-chunk link breaks the build.
```
