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

---

## 🔴 SALVAGE STATE — 2026-08-27, after the fork was killed mid-topic

**On disk and QC'd** (all ≤300, MDX clean): `01-why-fluent-assertions` ·
`02-assertthat-basics` · `02b-assertions-that-assert-nothing` ·
`02c-equality-identity-and-comparators` · `02d-numbers-and-offsets` · `03-collections` ·
`03b-element-comparison-and-streams` · `03c-extracting` · `03d-extracting-by-name`.
`sidebar_position` runs 1–9.

⚠️ `03c-extracting.md` came off the fork at **314 lines** and was split on the
String-overload boundary into `03c` + `03d-extracting-by-name.md` (position 9). The two
inbound links that said `03d-filtering-and-navigating.md` were repointed to **`03e`** —
that chunk is now **03e**, not 03d.

🔴 **These EXACT filenames are already linked from the chunks above — write them, not
variants**, or the inbound links dangle:

| File | `sidebar_position` | Linked from |
|---|---|---|
**Also on disk since the salvage commit:** `03e-filtering-and-navigating` (pos 10, filtering
only) and `03f-navigating-to-elements` (pos 11). `sidebar_position` now runs 1–11. The `03e`
FILENAME keeps "and-navigating" because two committed chunks link to it; its `sidebar_label`
and content are filtering, and it forward-links to `03f`. Do not rename it.

| File | `sidebar_position` | Linked from |
|---|---|---|
| `04-recursive-comparison.md` | 12 | `02c`, `02d`, `03b` |
| `04b-ignoring-fields.md` | 13 | `02c` |
| ~~`05-exceptions.md`~~ ✅ written @ 14, plus `05b-causes-and-messages.md` @ 15 | — | — |
| ~~`06-soft-assertions.md`~~ ✅ @ 16, plus `06b-composing-soft-assertions` @ 17 and `06c-soft-assertions-extension` @ 18 | — | — |
| ~~`07-custom-assertions.md`~~ ✅ @ 19, plus `07b-adopting-custom-assertions` @ 20 | — | — |
| `08-optional-assertions.md` | 21 | `02b` |
| `08b-dates-and-times.md` | 22 | `02c` |
| `09-describedas-and-messages.md` | 23 | `01`, `02b`, `06` |
| `10-the-checklist.md` | 24 | `01` |
| `README.md` | 0 | `../03-parameterized-tests/01` |

Note the drift from the original table above: the fork chose `04-recursive-comparison`
(not `04-objects-and-recursive-comparison`) and `08-optional-assertions` +
`08b-dates-and-times` (not `08-optional-and-time`). **The links win.**
