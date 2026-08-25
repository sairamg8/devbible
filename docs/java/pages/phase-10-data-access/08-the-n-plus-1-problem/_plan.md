# Topic 08 · The N+1 problem — chunk plan

Tier: Master. Owner fork: java-p10-t08. Boundary: I own the query explosion AND every
fix. 06 owns persistence context/dirty checking/flush. 07 owns mappings + fetch-type
defaults and hands the fix here.

## Parts 1 and 2 — the problem, and seeing it — ✅ COMPLETE

| File | Status |
|---|---|
| 01-one-hundred-and-one-queries.md | ✅ written 220 lines · 6 gotchas · 5 Qs |
| 01b-the-general-rule.md | ✅ written 196 lines · 5 gotchas · 6 Qs |
| 02-why-nobody-sees-it.md | ✅ written 247 lines · 6 gotchas · 5 Qs |
| 03-why-production-is-worse.md | ✅ written 267 lines · 7 gotchas · 6 Qs |
| 04-the-shapes-it-hides-in.md | ✅ written 245 lines · 6 gotchas · 5 Qs |
| 04b-three-more-shapes.md | ✅ written 209 lines · 7 gotchas · 5 Qs |
| 04c-serialization-and-logging.md | ✅ written 287 lines · 7 gotchas · 7 Qs |
| 04d-the-ones-you-cannot-make-lazy.md | ✅ written 246 lines · 6 gotchas · 5 Qs |
| 04e-lazy-columns-and-hashcode.md | ✅ written 207 lines · 7 gotchas · 5 Qs |
| 05-turning-the-sql-on.md | ✅ written 264 lines · 7 gotchas · 5 Qs |
| 05b-show-sql-is-not-the-answer.md | ✅ written 227 lines · 6 gotchas · 4 Qs |
| 06-count-do-not-read.md | ✅ written 293 lines · 7 gotchas · 6 Qs |
| 06b-asserting-the-count-in-a-test.md | ✅ written 240 lines · 8 gotchas · 6 Qs |
| 06c-making-it-reusable.md | ✅ written 214 lines · 7 gotchas · 4 Qs |
| 06d-proxies-and-agents.md | ✅ written 280 lines · 7 gotchas · 5 Qs |
| 07-from-a-count-to-a-call-site.md | ✅ written 283 lines · 7 gotchas · 6 Qs |
| README.md | ✅ written 13 lines · 0 gotchas · 0 Qs |

## Part 3 — The fixes

| File | Status |
|---|---|
| 08-join-fetch.md | ⏳ planned |
| 08b-duplicate-parents-and-distinct.md | ⏳ planned |
| 08c-pagination-and-hhh000104.md | ⏳ planned |
| 08d-multiplebagfetchexception.md | ⏳ planned |
| 09-entity-graph.md | ⏳ planned |
| 09b-subgraphs.md | ⏳ planned |
| 09c-fetchgraph-vs-loadgraph.md | ⏳ planned |
| 09d-spring-data-entitygraph.md | ⏳ planned |
| 10-batch-size.md | ⏳ planned |
| 10b-choosing-a-batch-size.md | ⏳ planned |
| 11-subselect.md | ⏳ planned |
| 12-projections-and-dtos.md | ⏳ planned |
| 12b-spring-data-projections.md | ⏳ planned |
| 12c-the-entity-was-never-the-model.md | ⏳ planned |
| 13-fetch-profiles-and-enhancement.md | ⏳ planned |
| 14-choosing-a-fix.md | ⏳ planned |
| 14b-three-services-worked-through.md | ⏳ planned |

## Part 4 — What is not a fix

| File | Status |
|---|---|
| 15-open-in-view.md | ⏳ planned |
| 16-eager-is-not-a-fix.md | ⏳ planned |
| 17-initialize-loops-and-caches.md | ⏳ planned |

## Part 5 — Prevention

| File | Status |
|---|---|
| 18-fetching-belongs-to-the-call-site.md | ⏳ planned |
| 19-the-checklist.md | ⏳ planned |


## 🔴 RESUME HERE (session stopped 2026-08-25 by user order)

**23 of ~42 chunks written, 5,454 lines, all wired.** Parts 1 and 2 are COMPLETE.
Part 3 is written through `JOIN FETCH` and its three failure modes; the fork
renamed as it split, so the Part 3 table above is stale. What is actually on disk:

| File | State |
|---|---|
| `08-join-fetch.md` | ✅ 257 |
| `08b-what-a-fetch-join-breaks.md` | ✅ 192 |
| `08c-duplicate-parents-and-distinct.md` | ✅ 257 |
| `08d-pagination.md` | ✅ 264 |
| `08d2-paginating-on-older-versions.md` | ✅ 156 |
| `08e-multiplebagfetchexception.md` | ✅ 206 |
| `08e2-the-three-ways-out.md` | 🔴 **INCOMPLETE — 120 lines, prose finished but NO Gotchas and NO Interview questions section.** Finish this file FIRST. |

Then `09-entity-graph.md` onward: 09/09b/09c/09d, 10/10b, 11, 12/12b/12c, 13,
14/14b, 15, 16, 17, 18, 19.

⚠️ **37 forward references were converted from links to bold plain text**
*(not written yet)* so the build stays clean. Repoint each as its target lands, and
read each one **in its own sentence** first — several are bare labels like
"chunk 10" that will read badly until repointed.
