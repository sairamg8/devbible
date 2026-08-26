# Topic 09 · Coverage with JaCoCo — chunk plan

Tier: **Know**. Read `../_PHASE-NOTES.md` first.

## Boundary
Owns coverage measurement and what the number means. **11 · Mutation testing is the honest
answer to what coverage cannot say** — 09 sets that up and hands off explicitly.
Phase 8 owns Maven/Gradle themselves — `ls ../../phase-8-build-dependencies/` and link.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-coverage-measures.md` | Lines executed. Not lines *tested*, and the difference is the whole topic |
| 2 | `02-wiring-it-up.md` | The Maven plugin and the Gradle plugin; the agent and the report goal |
| 3 | `03-line-branch-and-the-rest.md` | Instruction, branch, line, complexity, method, class — what each counter is |
| 3b | `03b-branch-coverage-is-the-useful-one.md` | The `if` whose else nobody ran |
| 4 | `04-thresholds.md` | `check` rules — a floor that stops regression, not a target to hit |
| 4b | `04b-the-eighty-percent-ritual.md` | What gaming the number looks like in a diff |
| 5 | `05-exclusions.md` | Generated code, DTOs, configuration — excluding honestly |
| 6 | `06-what-the-number-cannot-say.md` | A test with no assertions covers everything |
| 7 | `07-coverage-in-ci.md` | The report nobody opens; making it show up in the pull request |
| 8 | `08-the-checklist.md` | Reading a coverage report usefully |

## Verify, do not assume
- ⚠️ **JaCoCo's JDK 25 support** — the agent has historically lagged new class-file
  versions. Verify the current state and say plainly if you cannot confirm it.
- 🔴 **No coverage percentages from a run.** A number quoted from the JaCoCo docs is fine
  and must be named as such.
