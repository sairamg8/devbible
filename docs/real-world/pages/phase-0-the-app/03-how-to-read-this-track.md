---
title: "How to read this track"
sidebar_label: "03 · How to read this track"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. Design page — the track's own conventions.

Ten minutes here saves confusion in every later chapter.

## The chapter shape

Every implementation chapter runs the same arc:

1. **The problem** — what the storefront needs, stated concretely.
2. **The design choices** — the real options and what each costs. Every
   recommendation names its trade-off.
3. **The implementation** — complete, copyable code with realistic names. No
   `...` elisions; where a fragment is genuinely illustrative rather than
   runnable it is labelled `// pseudo-code`.
4. **Using it in the app** — where the code sits in the architecture and who
   calls it.
5. **Gotchas** — symptom → cause → fix, leading with the symptom.
6. **Interview questions** — with answers, the frequent ones starred.

## Links, not duplicates

**No chapter re-teaches a concept.** When the checkout chapter reaches
transaction isolation, it links the PostgreSQL section; when a hook chapter
touches stale closures, it links React. The chapter's own text covers only what
is specific to *this app*.

Two practical consequences:

- A chapter may feel short next to its concept pages. That is the design — the
  chapters are the composition layer, and composition is what they explain.
- If a chapter and a concept page disagree, **the concept page wins** and the
  chapter has a bug worth reporting.

## Reading order

**Phase 0 first, always.** After that, the parts are independent:

| You are | Read |
|---|---|
| Backend-focused | Phases 1 → 2 → 3, stop there if you like |
| Frontend-focused | Phase 0, then 4 → 5 → 6 — treat the API as given |
| Building the whole thing | 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7, with 8 when MERN calls |

Inside a phase, chapters are sequential — later chapters import code from
earlier ones, and say so when they do.

## What "verified" means here

The concept sections carry measured output where a sandbox run actually
happened. This track is **documentation-validated**: implementations are checked
against the concept pages they compose and the official documentation named in
each chapter's `> Verified:` line — and chapters carry **no console output
blocks**, because no output was produced. Where a behaviour could not be
verified from documentation, the chapter says so plainly instead of guessing.

## Gotchas

- **Symptom:** you copied a chapter's code and it references a function the
  page doesn't define. **Cause:** the chapter imports from an earlier chapter —
  they build on each other by design. **Fix:** the "Using it in the app"
  section names every cross-chapter import; follow it backwards.
- **Symptom:** the track seems to skip something fundamental (how promises
  work, what a JOIN is). **Cause:** it is the composition layer on top of the
  concept sections, not a course from zero. **Fix:** each phase README names
  its prerequisites; read those first.

## Interview questions

1. **Why compose an app from one spec instead of studying isolated examples?**
   Isolated examples hide integration, and integration is where production
   difficulty lives — auth touching the cart, transactions touching the queue,
   session expiry touching client state. One shared spec forces every seam
   into the open.
2. **Why does the track pin one stack (raw `pg`, Express, React) instead of
   staying generic?** Generic examples defer every hard decision to the
   reader, which is exactly the work that needs teaching. A pinned stack makes
   every trade-off concrete — and the MongoDB mirror phase shows how much
   survives a stack swap (most of it).

---

← Prev: [Architecture and the data model](02-architecture-and-data-model.md) ·
Phase index: [Phase 0 — The app](README.md)
