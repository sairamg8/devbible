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

| File | `sidebar_position` | Linked from |
|---|---|---|
| `06b-nested-tests.md` | 12 | `03b` |
| `07-disabling-and-conditions.md` | 13 | `02`, `03`, `04` |
| `08-assumptions.md` | 14 | — |
| `09-tempdir-and-resources.md` | 15 | `02b`, `03c` |
| `10-extensions.md` | 16 | `02`, `03`, `03c` |
| `10b-writing-one.md` | 17 | `02b` |
| `11-execution-order.md` | 18 | `01`, `02b`, `03`, `03b` |
| `12-parallel-execution.md` | 19 | `03`, `03b` |
| `13-timeouts.md` | 20 | `04`, `05b` |
| `14-flaky-tests.md` | 21 | `03` |
| `15-the-checklist.md` | 22 | — |
| `README.md` | 0 | `../03-parameterized-tests/01`, `04` |

Split further with lettered siblings as needed — the table is the floor, not the ceiling.
