# Topic 08 · Test data patterns — chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns **how a test gets its data**: builders, object mothers, fixtures, `@Sql`, and cleanup.
**03 owns the table of cases** (`@ParameterizedTest`); 08 owns the *objects*. **07 owns the
container**; 08 owns what goes into it.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-forty-line-setup.md` | Setup that hides which field the test is actually about |
| 2 | `02-the-builder.md` | A test builder with sensible defaults; only the relevant field is named |
| 2b | `02b-builders-and-records.md` | What changes when the domain type is a record |
| 3 | `03-object-mothers.md` | Named scenarios (`aCustomerWithNoOrders`) and when they beat builders |
| 3b | `03b-when-a-mother-becomes-a-god-object.md` | The failure mode, and how to see it coming |
| 4 | `04-fixtures-in-the-database.md` | `@Sql`, `@SqlGroup`, execution phases, and script ordering |
| 5 | `05-cleanup.md` | Rollback, truncate, or a fresh container — each with its cost |
| 5b | `05b-tests-that-depend-on-each-other.md` | The shared row that makes the suite order-dependent |
| 6 | `06-random-and-time.md` | A test that uses `now()` or a random id is a future flake; `Clock` injection |
| 7 | `07-faker-and-generated-data.md` | Where generated data helps and where it destroys reproducibility |
| 8 | `08-the-checklist.md` | Reading a test's setup and asking what it is really saying |

## Verify, do not assume
- ⚠️ `@Sql` phases and the default script-detection convention — quote the reference.
- ⚠️ Whether the transactional-rollback default applies in each slice.
