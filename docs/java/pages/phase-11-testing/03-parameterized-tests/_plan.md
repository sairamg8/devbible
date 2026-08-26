# Topic 03 · Parameterized tests — chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns `@ParameterizedTest` and every argument source. 01 owns the lifecycle; 08 owns test
*data patterns* (builders, object mothers) — 03 owns the *table of cases*.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-one-test-many-cases.md` | The copy-pasted test method is the problem this solves |
| 2 | `02-valuesource.md` | The simplest source, and its type limits |
| 3 | `03-csvsource.md` | A readable table of cases; delimiters, nulls, empty strings |
| 3b | `03b-csvfilesource.md` | When the table outgrows the annotation |
| 4 | `04-methodsource.md` | Arbitrary objects; the static factory and its signature rules |
| 5 | `05-enumsource.md` | `names`, `mode` — and the test that fails when someone adds a constant |
| 6 | `06-argumentssource.md` | A custom `ArgumentsProvider` |
| 7 | `07-display-names.md` | The `name` attribute and its placeholders — the report is the point |
| 8 | `08-conversion-and-aggregation.md` | Implicit conversion, `@ConvertWith`, `@AggregateWith`, `ArgumentsAccessor` |
| 9 | `09-when-not-to-parameterize.md` | Five cases that are really five different tests |
| 10 | `10-the-checklist.md` | Reviewing a parameterized test |

## Verify, do not assume
- ⚠️ JUnit 5.13 added `@ParameterizedClass` — check whether the managed version has it
  before mentioning it, and say plainly if you cannot confirm.
- ⚠️ Null/empty handling (`@NullSource`, `@EmptySource`, `@NullAndEmptySource`) and the
  `nullValues` attribute on `@CsvSource` — quote the user guide.
