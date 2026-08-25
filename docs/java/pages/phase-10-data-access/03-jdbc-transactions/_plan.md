# Topic 03 · Transactions at the JDBC level — chunk plan (COMPLETE)

Tier: Understand (`t-understand`) on every chunk. Boundary: raw JDBC only —
Spring `@Transactional` belongs to topic 04 and is referenced as bold plain text.
Chunks 01, 02 and `_category_.json` were pre-existing and were NOT touched.

| # | File | Lines | Gotchas | Q | Status |
|---|---|---|---|---|---|
| 01 | 01-autocommit-is-a-transaction-you-did-not-choose.md | 199 | 3 | 3 | pre-existing, not mine |
| 02 | 02-commit-rollback-and-the-shape-that-survives.md | 259 | 5 | 6 | pre-existing, not mine |
| 03 | 03-what-isolation-actually-means.md | 285 | 5 | 6 | ✅ |
| 04 | 04-postgresql-has-three-levels.md | 250 | 4 | 5 | ✅ |
| 05 | 05-read-committed-in-practice.md | 258 | 5 | 5 | ✅ |
| 05b | 05b-when-re-evaluation-surprises-you.md | 275 | 5 | 6 | ✅ split from a 375-line draft |
| 06 | 06-repeatable-read.md | 238 | 4 | 4 | ✅ |
| 06b | 06b-what-repeatable-read-still-cannot-promise.md | 189 | 3 | 4 | ✅ split from a 399-line draft |
| 07 | 07-serializable-and-ssi.md | 255 | 4 | 5 | ✅ |
| 07b | 07b-making-serializable-perform.md | 224 | 4 | 4 | ✅ |
| 07c | 07c-deferrable-and-the-limits.md | 187 | 4 | 5 | ✅ |
| 08 | 08-setting-the-level-from-java.md | 190 | 3 | 3 | ✅ |
| 08b | 08b-the-level-and-the-pool.md | 169 | 3 | 3 | ✅ |
| 09 | 09-savepoints.md | 249 | 4 | 6 | ✅ |
| 09b | 09b-cursors-and-the-cost.md | 180 | 3 | 4 | ✅ |
| 10 | 10-the-aborted-transaction.md | 249 | 6 | 6 | ✅ |
| 10b | 10b-autosave.md | 152 | 4 | 3 | ✅ |
| 11 | 11-read-only-transactions.md | 239 | 5 | 4 | ✅ |
| 11b | 11b-read-only-that-earns-its-keep.md | 173 | 2 | 4 | ✅ |
| 12 | 12-locking-and-select-for-update.md | 290 | 6 | 6 | ✅ |
| 12b | 12b-nowait-skip-locked-and-scope.md | 291 | 6 | 6 | ✅ |
| 13 | 13-deadlocks-and-timeouts.md | 299 | 6 | 6 | ✅ |
| 13b | 13b-the-four-clocks.md | 294 | 7 | 6 | ✅ |
| 14 | 14-retrying-safely.md | 294 | 6 | 5 | ✅ |
| 14b | 14b-when-the-commit-is-in-doubt.md | 248 | 6 | 3 | ✅ |
| 15 | 15-where-the-boundary-belongs.md | 274 | 7 | 6 | ✅ |
| 15b | 15b-a-debugging-order-and-a-checklist.md | 231 | 4 | 6 | ✅ |

**25 files written. 0 over 300 lines. sidebar_position runs 1..27 with no gaps.**
Every link inside my files resolves against the filesystem.

## 🔴 TRAP the coordinator must fix — I may not edit chunks 01/02

Chunks 01 and 02 were written against an earlier chunk plan and contain THREE links
to filenames that do not exist:

| In file | Broken link | Should point at |
|---|---|---|
| `01-autocommit-...md` | `03-one-error-aborts-everything.md` | `10-the-aborted-transaction.md` |
| `01-autocommit-...md` | `08-how-long-to-hold-it-open.md` | `15-where-the-boundary-belongs.md` |
| `02-commit-rollback-...md` | `08-how-long-to-hold-it-open.md` | `15-where-the-boundary-belongs.md` |

These will break the build.
