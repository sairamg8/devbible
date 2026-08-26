# Topic 02 · AssertJ — chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns assertion *style* and *failure messages*. Does not re-teach JUnit's lifecycle (01) or
Mockito (04). ⚠️ `MockMvcTester`'s AssertJ integration belongs to **06**, not here.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-why-fluent-assertions.md` | The failure message is the product; a good one debugs for you |
| 2 | `02-assertthat-basics.md` | `assertThat(x).isEqualTo(y)` and the type-specific API |
| 3 | `03-collections.md` | `contains`, `containsExactly`, `containsExactlyInAnyOrder` — the distinction that matters |
| 3b | `03b-extracting.md` | `extracting`, `flatExtracting`, tuples |
| 4 | `04-objects-and-recursive-comparison.md` | `usingRecursiveComparison`, ignoring fields, and when it hides a bug |
| 5 | `05-exceptions.md` | `assertThatThrownBy`, `assertThatExceptionOfType`, `hasRootCauseInstanceOf` |
| 6 | `06-soft-assertions.md` | Collecting failures instead of stopping at the first |
| 7 | `07-custom-assertions.md` | A domain assertion class, and when it earns its keep |
| 8 | `08-optional-and-time.md` | The `Optional`, `LocalDate` and `Duration` assertions |
| 9 | `09-describedas-and-messages.md` | `as(...)`, and the failure that names the case |
| 10 | `10-the-checklist.md` | Reading an assertion and asking what it would say when it fails |

## Verify, do not assume
- ⚠️ The AssertJ version Boot 4.1 manages; `assertj-core` vs the guava/db modules.
- 🔴 **No console blocks.** A failure message quoted **from the AssertJ documentation** is
  fine and should be named as such; a failure message you imagined is not.
