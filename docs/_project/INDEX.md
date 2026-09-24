---
name: devbible-index
description: devbible's router — the five index shards, the handful of files worth reading before anything else, and how to reach the cold tier without loading it
metadata:
  type: reference
---

# devbible — index

**Load the board, then ONE shard.** Not this file and everything under it.

| Read first | When |
|---|---|
| 🔴 **[LOCKS.md](LOCKS.md)** | **always** — your track, its exact resume file, the rules every lock carries |
| [CURSOR-AUDIT.md](CURSOR-AUDIT.md) | *"what is pending"*, *"what do you suggest"*, *"is it up to date"* — takes no lock |
| [progress_corpus_audit_20260905.md](progress_corpus_audit_20260905.md) | any question about counts. **Distrust every page/topic/link number written before 2026-09-05** |
| [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md) | before dispatching an authoring agent — 4 of 4 without this line were killed by the 600s watchdog |

## The shards

Sharded by **track**, because a session already knows its track — that is the lock. Open
the one that matches, plus `meta` when the question is about the site rather than a track.

| Shard | Entries | Covers |
|---|---|---|
| **[INDEX-meta.md](INDEX-meta.md)** | 105 | gates, hooks, audits, dashboards, currency, house rules, **and every piece of feedback from the user** |
| **[INDEX-web.md](INDEX-web.md)** | 93 | JavaScript, TypeScript, React, CSS, Angular, Storybook, vite, vitest, tanstack, redux, framer-motion, webpack, babel |
| **[INDEX-backend.md](INDEX-backend.md)** | 74 | PostgreSQL, Node, Express, Docker & Podman, Redis, MongoDB, Nginx, Git, Python, DSA, system-design |
| **[INDEX-java.md](INDEX-java.md)** | 67 | the Java track — phases, boards, JPA/Spring Data depth passes, the P11 audit |
| **[INDEX-nextjs.md](INDEX-nextjs.md)** | 52 | the Next.js track — chapter research, the import, the quote sweep, the 2026-09-05 close |

**Cross-track questions go to `meta`.** Anything about how we work — a rule, a gate, a
trap, a measurement — is there regardless of which track it was learned on.

## When the index does not have it

The index routes what is on the **hot path**, by design. Everything else — closed lanes,
the pre-shard long-form entries, research behind pages that already shipped — is **cold,
not gone**, and is searched rather than loaded:

```bash
shared/scripts/recall.sh flyway major          # rank every memory, live and cold
shared/scripts/recall.sh --cold worktree       # archives and history only
shared/scripts/recall.sh --body 'add -A'       # a phrase you half-remember
```

| Cold file | Holds |
|---|---|
| [INDEX-ARCHIVE.md](INDEX-ARCHIVE.md) | the pre-2026-09-08 index — 291 long-form entries, some carrying findings never written into their target file |
| [LOCKS-ARCHIVE.md](LOCKS-ARCHIVE.md) | every closed lane, the verbatim user instructions, the chunk-split mechanics (§11b, §11b-common, §11b-scope) |
| `CURSOR-*-HISTORY.md` | prior wind-downs of a track whose cursor was rotated |

🔴 **Search before concluding the store does not know something.** Three of the traps in
`meta` were re-learned from scratch by a session that assumed a silent index meant a silent
store.

## Writing a memory here

1. **One fact per file**, prefix from the closed vocabulary — `feedback_` `project_`
   `reference_` `memory_` `gap_` `research_` `progress_` `plan_`. The prefix is a routing
   key: it lets `ls` narrow a search before the index is even opened.
2. **Frontmatter is mandatory** — `name`, `description`, `metadata.type`. `description` is
   what `recall.sh` prints, so write it as the claim, not the topic.
3. **Add the index line to the matching shard in the same commit.** An unindexed memory is
   an unwritten one. `memcheck.sh` fails on any file no shard links.
4. **The entry is a pointer, ≤240 bytes** — the claim plus the terms someone would search
   on, including the wrong-but-likely ones. If it tells you the answer, the answer now
   lives in a file every session loads, and the two copies will drift.
5. **300 lines per memory file.** Past that it splits — by *how often the material is
   needed*, never by date.
6. **When a lane closes, rotate its sections** into the `-ARCHIVE` sibling in the same
   commit, and leave a one-line breadcrumb naming where they went.

```bash
shared/scripts/memcheck.sh devbible    # run before committing a memory edit
```

Contract and budgets: [../shared/MEMORY-ARCHITECTURE.md](../shared/MEMORY-ARCHITECTURE.md)
