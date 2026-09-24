---
name: progress-java-p14-t02-headband-pass
description: 🔴 LIVE CURSOR — the depth pass on Java phase-14 topic 02 chunks 12-23 (the head band's identical-count run). Records the exact 15-file band, the per-file method, and the next file by exact name. Open this to resume.
metadata:
  type: project
---

# Java p14 t02 · the head-band depth pass — chunks 12–23

**Started 2026-09-04**, on the user's instruction *"now do the same depth pass on chunks 12-23"*,
immediately after the 34–60 pass closed ([[progress-java-p14-t02-gemini-review]]).

**Directory:** `docs/java/pages/phase-14-microservice-architecture/02-service-boundaries/`

## 🔴 START HERE — the band, measured off disk

The band is **filename prefixes 12 → 23**, fifteen files. It contains the unbroken **13-file run at
exactly 7 gotchas / 5 questions** (sidebar positions 19–31) that the 34–60 pass left open and the
topic README discloses.

| # | File | Before | Status |
|---|---|---|---|
| 1 | `12-splitting-by-layer.md` | 252 / 12★ / 7/5 | ✅ **287 + new `12b` 214 — 519 lines, 22★** (`32475606`) |
| 2 | `13-entity-services.md` | 253 / 12★ / 7/5 | ✅ **237 + new `13c` 130 — 367 lines, 16★** |
| 3 | `13b-crud-is-not-a-capability.md` | 275 / 12★ / 7/5 | ✅ **270 + new `13d` 174, +35 into `13c` — 546 lines, 22★** |
| 4 | `14-conway-and-the-org-chart.md` | 219 / 12★ / 7/5 | ✅ **237 + new `14b` 180 — 424 lines, 21★** |
| 5 | `15-too-small.md` | 256 / 12★ / 7/5 | ✅ **222 + new `15b` 123 — 345 lines, 15★** |
| 6 | `16-the-shared-model-jar.md` | 254 / 12★ / 7/5 | ✅ **240 + new `16b` 103 — 343 lines, 15★** |
| 7 | `17-the-god-service.md` | 265 / 12★ / 7/5 | ✅ **256 + new `17b` 137 — 393 lines, 16★** |
| 8 | `18-boundaries-from-a-whiteboard.md` | 237 / 12★ / 7/5 | ✅ **295 lines, 15★, 9/6** (no split) |
| 9 | `19-change-history-as-evidence.md` | 232 / 12★ / 7/5 | ✅ **297 lines, 15★, 9/6** (no split) |
| 10 | `19b-reading-the-co-change-matrix.md` | 245 / 12★ / 7/5 | ✅ **215 + new `19c` 124 — 339 lines, 15★** |
| 11 | `20-event-storming.md` | 242 / 12★ / 7/5 | ✅ **297 lines, 16★, 10/6** (no split) |
| 12 | `21-system-operations-first.md` | 233 / 12★ / 7/5 | ✅ **291 lines, 15★, 9/6** |
| 13 | `22-the-ten-forces.md` | 238 / 12★ / 7/5 | ✅ **294 lines, 15★, 9/6** |
| 14 | `22b-scoring-one-cut.md` | 251 / 11★ / 6/5 | ✅ **231 + new `22c` 161 — 392 lines, 16★** |
| 15 | `23-the-monolith-already-told-you.md` | 248 / 12★ / 7/5 | ✅ **300 lines, 15★, 9/6** |

🔴 **BAND COMPLETE 2026-09-04. Nothing left in this cursor.**

## 🔴 What is different about this band, and it changes the method

The 34–60 band was **thin** — ~150 lines, so deepening meant adding and most files stayed under the
cap. **This band is already 219–275 lines.** Almost every file will cross 300 the moment it is
deepened, so this pass is mostly **splits**, not additions.

- Expect the topic to grow from 67 chunks toward ~80.
- Every split proven: `wc -l` and `grep -c '^\*\*★'` **before**, both totals **UP** after.
- `renumber.py` in the session scratchpad recomputes every `sidebar_position` from filename order
  after each split. Filenames and `sidebar_label` numbers never change, so no inbound link or prose
  cross-reference moves.
- The identical 7/5 counts are the **symptom**, not the target. Do not "vary the counts" — exhaust
  each topic and let the counts fall where the subject puts them.

## Per-file cadence (unchanged)

deepen from the bank → split if over 300 and prove both totals up → `renumber.py` → `mdxcheck.py` +
`devbible-linkcheck.py` → `git add` explicit paths → commit → tick the row above.

## At the end of the pass

🔴 **Rebuild the topic README** — every new sibling needs a `## Chunks` row, and the
*"What this topic stands on"* section's ⚠️ paragraph about chunks 12–23 must be **removed**, because
it will no longer be true.

## Research

Banked for 34–60 at [[research-java-p14-t02-depth-pass]] — **reusable, do not re-fetch.** This band
needs its own additions (Conway's 1968 paper, Nygard's *Entity Service Antipattern*, the
microservices.io dark energy / dark matter force pages, Assemblage system operations, the ddd-crew
EventStorming glossary); append them to that same file rather than starting a second bank.


---

# 🔴 HEAD-BAND PASS COMPLETE — 2026-09-04

All fifteen files done. **Topic 02 is 67 → 76 chunks, 15,906 → 17,598 lines, 732 → 797 ★.**
Index rebuilt; the README's open item about this band is removed because it is closed.

| | Before this pass | After |
|---|---:|---:|
| Chunks + index | 67 + 1 | **76 + 1** |
| Lines | 15,906 | **17,598** |
| ★ | 732 | **797** |
| 🔴 Longest identical gotcha/question run **anywhere in the topic** | 13 (head) / 3 (tail) | **3** |

**Nine new lettered siblings:** `12b` Why the layering comes back · `13c` What to build instead ·
`13d` Migrating a public CRUD API · `14b` One team per service · `15b` The module is the alternative ·
`16b` What version skew does at runtime · `17b` Composing is not deciding · `19c` When a cell means
nothing · `22c` Proposal C, do nothing. Every split proven up on both totals.

## What was different about this band, confirmed

The prediction in the cursor held: these files were **already well-sourced**, unlike the 34–60 band.
The head band had genuinely fetched microservices.io, Vernon, Conway and the force descriptions and
quoted them verbatim — so this pass found **no fabricated quotations and no invented figures at all**,
in contrast to the tail band's six defects. The identical 7/5 counts were a *depth ceiling*, not a
sourcing failure: each page made its argument and stopped one layer short of the objection a reader
would actually raise.

**The additions were therefore mostly "the fair objection, answered":**
- 12b — teams who know the argument still ship layered services (Conway, and the plan when the org
  change is not available)
- 13c/13d — Nygard proposes no cure, and the CRUD migration for an API you cannot break
- 17b — *every* system calls several services, so what is the actual diagnostic
- 19c — a ratio is meaningless without support, and co-change has four causes
- 22 — two of the ten forces are hard constraints in disguise; legality precedes scoring
- 22c — the option that requires no work never gets written up, and it is the baseline

## Two facts worth carrying to the next topic

1. 🔴 **A well-sourced page can still be shallow.** The head band passed every sourcing check and had
   a uniform depth ceiling. The identical-count run was the only visible symptom, which is why the
   count check earns its place in the Definition of Done.
2. 🔴 **RFC 9110 settles the CRUD argument** (`PUT` replaces state, `POST` lets the resource decide),
   and Conway's *homomorphism* sentence is sharper than the quoted law. Both were sitting in
   fetchable sources the pages already cited.
