---
name: progress-nextjs-ch15-t01g
description: Next.js ch15 topic 01 chunks 01g/01ga — Prisma 7 generated client, driver adapters, instance lifecycle. The split proof, the 01ga naming precedent, and the two stale seams found and fixed.
metadata:
  type: project
---

# Next.js ch15 · 01g + 01ga — Prisma 7 client and adapters

**Session `7784ba23`, 2026-09-05. Commit `e77b0276`.** Resumed from [[cursor-nextjs]], which named
`01g` by exact filename because `01f`'s footer already promised it in prose.

## What shipped

| File | Lines | Gotchas | Questions | Position |
|---|---:|---:|---:|---:|
| `01g-prisma-the-generated-client-and-driver-adapters.md` | 218 | 10 | 7 | 106 |
| `01ga-where-the-prisma-instance-lives.md` | 212 | 12 | 9 | 107 |

## 🔴 The split, proven

Drafted as one file at **318 lines / 25 ★**, 18 over cap. Split on the concept boundary between
*what Prisma generates and what an adapter is* (01g) and *where the instance lives* (01ga).

**318 → 430 lines · 25 → 38 ★ · gotchas 14 → 22 · questions 11 → 16.** Both totals UP, nothing
trimmed. See [[feedback-never-compress-to-fit-cap]].

## 🔴 The naming precedent — `01ga`, not `01h`

The cursor listed **eight files the corpus already promises by name**, `01h` and `01i` among them.
A split that consumed `01h` would have silently broken a promise made in prose elsewhere. The
two-letter sibling form (`01g` → `01ga`) keeps the promised chain intact, and it has corpus
precedent: `java/pages/phase-12-jvm-production/11-graalvm-native-image/07ca-profile-guided-optimization.md`.
**Rule for this topic: if `01h` overruns, it becomes `01ha` — never `01i`.**

## Two stale seams, found and fixed in the same commit

1. `01f`'s footer carried `**01g …** *(not written yet)*` — now a link.
2. 🔴 The `01` hub (line ~146) pointed the "ORM choice" aside at **`01f`**, which exists and is
   about WebSockets. The intended target was the ORM comparison, i.e. `01h`. A wrong-but-existing
   chunk reference is invisible to the link checker (the file resolves) **and** to the
   not-written-yet convention (it is bold text, not a link). Repointed at `01h`.

## Sources

Wrote from the banked [[research-nextjs-ch15-databases-and-api-design]] sections D/E/F/G/H plus
**four** primary-doc fetches it did not cover: Prisma v7 `generating-prisma-client`,
`database-drivers`, the Neon guide, and the `prisma-config-reference`.

Load-bearing findings worth not re-deriving:
- v7 requires `output` on the generator; the client is a **build artifact**, gitignored, needing
  `prisma generate` in both `postinstall` and `build`.
- v7 reads **no** pooling parameters from the connection URL. They are adapter fields now.
- Two defaults changed dangerously: acquire and connect timeouts went from 10s/5s to **0 (none)**,
  which converts pool exhaustion from a logged error into unbounded latency. Idle timeout fell
  300s → 10s.
- Prisma's own docs import the generated client from **two different paths** on two pages
  (`../generated/prisma/client` vs `../prisma/generated/client`) — both are illustrations of a
  user-chosen `output`, neither is canonical.
- `prisma.config.ts` does **not** auto-load `.env`; `adapter` was **removed** as a config field in v7.

## Not confirmed

The `generating-prisma-client` page does not state whether the generated directory should be
committed or gitignored. The page argues gitignore from the artifact's lifecycle rather than
citing a doc sentence, and says so in its own words rather than quoting.

Pin: `prisma` was already at **7.10.0** with the `nextjs` track in `src/data/pins.js` — no pin
change was owed. `drizzle-orm` / `drizzle-kit` pins are still owed and land with `01h`/`01i`.
