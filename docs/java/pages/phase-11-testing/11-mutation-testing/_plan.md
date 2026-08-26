# Topic 11 · Mutation testing — chunk plan

Tier: **When Needed** — ⚠️ use the class `t-when` to match the phase README. Target: PIT
(pitest) — ⚠️ verify the current version and its JDK 25 support.

## Boundary
Owns testing the tests. 🔴 **This is the honest answer to topic 09's "what the number
cannot say"** — open by picking that up explicitly and link back.
This is the phase's closing topic: end by naming what the whole phase taught.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-testing-the-tests.md` | Coverage says the line ran; mutation testing asks whether anything would have noticed it change |
| 2 | `02-how-it-works.md` | Mutate the bytecode, re-run the covering tests, see what survives |
| 3 | `03-mutators.md` | The default operator set, and what a surviving mutant means for each |
| 4 | `04-reading-a-report.md` | Killed, survived, timed out, no coverage — and which to act on |
| 4b | `04b-equivalent-mutants.md` | The mutant that cannot be killed, and why the score is never 100 |
| 5 | `05-wiring-it-up.md` | Maven and Gradle; scoping to changed classes so it finishes |
| 5b | `05b-incremental-analysis.md` | Making it viable in CI |
| 6 | `06-the-cost.md` | It runs the suite many times over — the honest verdict on when to use it |
| 7 | `07-what-this-phase-taught.md` | The closing argument: level, isolation, real dependencies, and assertions that mean something |

## Verify, do not assume
- ⚠️ **PIT's JDK 25 support** and whether the JUnit 5 plugin is still separate.
- 🔴 No mutation scores from a run; a figure quoted from the pitest docs must be named.
