# Topic 01 · JUnit 5 — chunk plan

Tier: 🔴 **Master**. Read `../_PHASE-NOTES.md` first. Target: the JUnit 5 version Boot
4.1.0 manages, JDK 25.

## Boundary
Owns the engine. **02 owns assertion style** (AssertJ) — 01 teaches JUnit's own assertions
and then says plainly that the rest of the phase uses AssertJ, and why. **03 owns
`@ParameterizedTest`** — 01 names it and hands off. **04 owns Mockito.**

## Chunks (a PLAN, not a budget — Master tier, split at 301 lines)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-test-is-for.md` | A test is a claim about behaviour, readable years later |
| 2 | `02-the-architecture.md` | Platform / Jupiter / Vintage — why the three-part split exists |
| 3 | `03-the-lifecycle.md` | `@Test`, `@BeforeEach`, `@BeforeAll`, and per-method instances |
| 3b | `03b-per-class-lifecycle.md` | `@TestInstance(PER_CLASS)` and what it makes possible |
| 4 | `04-assertions.md` | `assertEquals` and friends; the message argument nobody supplies |
| 4b | `04b-assertall.md` | Why grouped assertions beat five separate ones |
| 5 | `05-assertthrows.md` | The exception assertion, and asserting on the exception itself |
| 5b | `05b-what-not-to-assert.md` | Asserting the message string is a test that breaks on a typo fix |
| 6 | `06-naming-and-display-names.md` | `@DisplayName`, `@Nested`, and the failure report as documentation |
| 7 | `07-disabling-and-conditions.md` | `@Disabled` with a reason; `@EnabledOnOs`, `@EnabledIf…` |
| 8 | `08-assumptions.md` | An assumption is not an assertion — a skipped test is not a passing one |
| 9 | `09-tempdir-and-resources.md` | `@TempDir` — and why a test that writes to a fixed path is a flake |
| 10 | `10-extensions.md` | The extension model; `@ExtendWith`; the lifecycle callbacks |
| 10b | `10b-writing-one.md` | A small, real extension |
| 11 | `11-execution-order.md` | Tests are unordered by design; `@Order` and when it is a smell |
| 12 | `12-parallel-execution.md` | The properties, `@Execution`, `@ResourceLock` — and shared state |
| 13 | `13-timeouts.md` | `@Timeout` vs `assertTimeout` vs `assertTimeoutPreemptively` |
| 14 | `14-flaky-tests.md` | Every cause, and why retry is not the fix |
| 15 | `15-the-checklist.md` | Reviewing a test in a pull request |

## Verify, do not assume
- ⚠️ The JUnit version Boot 4.1 manages, and whether `junit-jupiter` is still the
  aggregate artifact in the Boot test starter.
- ⚠️ JUnit 5.11+ moved several things (`@TempDir` cleanup modes, the `assertInstanceOf`
  family); check the user guide rather than memory.
- 🔴 **No test-run output.** Never paste a green/red run, a stack trace or a timing.

---

## 🔴 SALVAGE STATE — 2026-08-27, after the fork was killed mid-topic

**On disk and QC'd** (all ≤300, MDX clean): `01-what-a-test-is-for` · `02-the-architecture`
· `02b-what-junit-6-changed` · `03-the-lifecycle` · `03b-per-class-lifecycle` ·
`03c-inheritance-and-wrapping` · `04-assertions` · `04b-assertall` · `05-assertthrows` ·
`05b-what-not-to-assert` · `06-naming-and-display-names`. `sidebar_position` runs 1–11.

🔴 **These EXACT filenames are already linked from the chunks above — write them, not
variants**, or the inbound links dangle:

**Also on disk since the salvage commit:** `06b-nested-tests` (pos 12) and
`06c-nesting-lifecycle-and-limits` (pos 13). `sidebar_position` now runs 1–13.

⚠️ While writing 06b/06c, a **stale claim in `03b` was corrected**: "a `@Nested` class
cannot declare `@BeforeAll` because an inner class cannot have `static` members" expired at
**Java SE 16** (JLS SE 25 §8.1.3 — an inner class *may* declare `static` members), and
JUnit 6 baselines Java 17. Do not reintroduce the pre-16 rule anywhere in this topic.

| File | `sidebar_position` | Linked from |
|---|---|---|
| `07-disabling-and-conditions.md` | 14 | `02`, `03`, `04` |
| `08-assumptions.md` | 15 | — |
| `09-tempdir-and-resources.md` | 16 | `02b`, `03c` |
| `10-extensions.md` | 17 | `02`, `03`, `03c` |
| `10b-writing-one.md` | 18 | `02b` |
| `11-execution-order.md` | 19 | `01`, `02b`, `03`, `03b`, `06c` |
| `12-parallel-execution.md` | 20 | `03`, `03b` |
| `13-timeouts.md` | 21 | `04`, `05b` |
| `14-flaky-tests.md` | 22 | `03` |
| `15-the-checklist.md` | 23 | — |
| `README.md` | 0 | `../03-parameterized-tests/01`, `04` |

🔴 **Tagging still has no home.** `_PHASE-NOTES.md` gives topic 01 "nested/tagged tests";
06b/06c cover nesting only. Write `@Tag`, tag expressions and the tag syntax rules as
`06d-tagging.md` (pos 14, shifting 07–15 up by one) or fold them into `07`. Decide, then
say which in this file.

Split further with lettered siblings as needed — the table is the floor, not the ceiling.
