---
name: devbible-topic-cadence-and-handoff
description: The per-topic working loop — UI after every topic, memory every 3 topics, and on language completion update docs/README.md then pick the next idle or parked language
metadata:
  type: feedback
---

Set by the user **2026-08-14**, mid-session, while JavaScript phase 7 was being written:

> *"Save current progress to memory when you complete at least 3 topic from now on, and
> make sure after completing current topic you have to update the UI so it would be proof
> untill where we are sitting and then once complete update readme.md file its status and
> pick next idle sitting or parked languages to work."*

## The loop, per topic

1. **Write the topic** — full depth first, then split on concept boundaries
   ([[devbible-never-compress-to-fit-cap]]).
2. **Cap check** — `find … -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'`.
3. **Full clean rebuild** — including `node_modules/.cache`, then tally broken links by
   language.
4. 🔴 **Update the UI — every single topic, no batching.** `src/data/progress.js` (that
   language's rows only), the phase README status row, the claim notice, and the coverage
   table in `docs/README.md`.
5. **Commit** — explicit paths, never `git add -A`.
6. **Memory — every 3 topics** (relaxed from every 3 *files*): the progress cursor and the
   per-phase concept record, committed and pushed.

**Why the UI matters to the user:** it is the *proof* of where the work has reached. A
correct corpus with a stale progress bar reads as no progress at all. This is why it is
per-topic and not per-phase — the user checks the site, not the git log.

## On completing a language

1. **Update `docs/README.md`** — the claims table row to ✅ COMPLETE / RELEASED, and the
   coverage table row with the final page count.
2. **Update that language's `pages/README.md`** claim notice to released.
3. **Pick the next language to work on — an *idle* or *parked* one — from the claims table**,
   claim it there and in its own `pages/README.md`, and continue without asking.

**Idle/parked as of 2026-08-14:** PostgreSQL (complete, released, review-only), Express
(78 draft pages awaiting depth), Git (phase 0 only), CSS (phases 0–1), TypeScript
(phases 0–2), and **MongoDB / Docker / Redis / Nginx with zero pages**. Read the table
before choosing — other sessions move fast ([[devbible-parallel-sessions]]).

Related: [[devbible-javascript-build-progress]] · [[devbible-memory-update-cadence]] ·
[[devbible-incremental-scope]]
