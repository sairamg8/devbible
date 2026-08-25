# Plan — repair pass B (interview-Q&A depth re-judge), chunks 10–14b

Ownership: `10`, `10b`, `11`, `11b`, `12`, `12b`, `13`, `13b`, `13c`, `14`, `14b`
(+ any new letter-suffixed split I create in that range).
NOT mine: 01–09b, 15–22b, 20d, README.md, _plan-c.md, _plan-d.md.

Task: re-judge interview Q&A per file. All 11 currently carry 6 (11 carries 5) —
a template tell. Add only questions the chunk can genuinely answer from sources it
cites or a primary source verified now. Leave exhaustive files alone.

Footer rule: existing `← Prev … Next →` footers stay exactly where they are; new
content goes BEFORE them. New split files get a bare `<!--FOOTER-->`.

| File | Before lines | Before Q | Status |
|---|---|---|---|
| 10-requires-new.md | 263 | 6 | ✅ 287 lines, 7 Q (+JPA persistence-context Q); split off 10c |
| 10b-when-requires-new-is-right.md | 258 | 6 | ✅ 277 lines, 7 Q (+foreign-key / self-contained-data Q) |
| **10c-what-suspension-costs.md (NEW)** | — | — | ✅ 293 lines, 6 gotchas, 7 Q |
| 11-nested-and-savepoints.md | 243 | 5 | ✅ 291 lines, 8 Q (+rollback-only-at-entry, resetRollbackOnly, driver support) |
| 11b-choosing-nested.md | 230 | 6 | ✅ 274 lines, 8 Q (+JPA flag reality, three exception messages); corrected 'JPA does not support savepoints' |
| 12-the-other-propagations.md | 265 | 6 | ✅ 284 lines, 7 Q (+participating settings discarded) |
| 12b-supports-and-not-supported.md | 263 | 6 | ✅ 271 lines, 6 Q (removed a Q duplicated verbatim from 12; +NOT_SUPPORTED connection count) |
| **12c-the-empty-transaction.md (NEW)** | — | — | ✅ 291 lines, 6 gotchas, 7 Q |
| 13-rollback-rules.md | 281 | 6 | ✅ 289 lines, 6 Q — 🔴 CORRECTED the wrong 'rollbackFor = RuntimeException.class is narrower' claim (gotcha + Q) |
| 13b-changing-the-rule.md | 298 | 6 | ✅ 299 lines, 6 Q — at the cap; corrected the same wrong claim in its gotcha; no room, and its argument is covered |
| 13c-how-a-rule-is-matched.md | 285 | 6 | ✅ 291 lines, 6 Q — exhaustive on matching; the algorithm split out to 13d/13e |
| **13d-the-matching-algorithm.md (NEW)** | — | — | ✅ 267 lines, 4 gotchas, 7 Q |
| **13e-when-rules-collide.md (NEW)** | — | — | ✅ 209 lines, 4 gotchas, 5 Q |
| 14-the-caught-exception.md | 294 | 6 | ✅ 297 lines, 6 Q — exhaustive on the Spring half; the database half split out to 14c |
| **14c-what-the-database-did.md (NEW)** | — | — | ✅ 267 lines, 6 gotchas, 6 Q |
| 14b-three-honest-options.md | 287 | 6 | ✅ 300 lines, 7 Q (+setRollbackOnly while participating; noted NESTED as a fourth shape) |

## DONE — 2026-08-25

11 owned files re-judged; 5 new letter-suffixed splits created (10c, 12c, 13d,
13e, 14c). Final: 16 files, no file over 300, Q counts 5–8 (was uniformly 6),
gotchas 4–9, 0 broken links, 0 duplicate questions.

🔴 **Two defects fixed, not just depth added:**
1. `rollbackFor = RuntimeException.class` is NOT narrower than the default —
   `RuleBasedTransactionAttribute.rollbackOn` falls back to
   `DefaultTransactionAttribute.rollbackOn` when no rule matches, so an `Error`
   still rolls back. 13 (gotcha + Q) and 13b (gotcha) asserted the wrong thing.
2. 12 and 12b carried the same interview question verbatim. Removed from 12b.
