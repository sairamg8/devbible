# Topic 10 · Property-based testing — chunk plan

Tier: **When Needed** — ⚠️ use the class `t-when` to match the phase README (see
`../_PHASE-NOTES.md` §3). Target: jqwik (⚠️ verify the current version and its JUnit
platform requirement).

## Boundary
Owns generating inputs. **03 owns the hand-written table of cases** — 10 argues for the
cases you did not think of. **11 owns mutation testing.**

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-case-you-did-not-think-of.md` | Example-based tests only ever test your imagination |
| 2 | `02-a-property.md` | `@Property`, `@ForAll`, and what makes a good invariant |
| 2b | `02b-finding-properties.md` | Round-trip, idempotence, invariants, comparison to a simple model |
| 3 | `03-generators.md` | Built-in arbitraries; `@Provide`; composing and filtering |
| 4 | `04-shrinking.md` | 🔴 The feature that makes it usable — the minimal failing case |
| 5 | `05-reproducibility.md` | Seeds, and the failure that must be reproducible in CI |
| 6 | `06-where-it-pays.md` | Parsers, serializers, money, date arithmetic, sorting, caches |
| 6b | `06b-where-it-does-not.md` | Business rules with no invariant worth stating |
| 7 | `07-the-cost.md` | Slower tests, and a property that restates the implementation proves nothing |

## Verify, do not assume
- ⚠️ jqwik's JUnit 5 platform compatibility and JDK support. If it is not compatible with
  the Boot-4.1-managed JUnit, **say so on the page** — that is the load-bearing fact.
- 🔴 No run output, no seeds from an actual failure.
