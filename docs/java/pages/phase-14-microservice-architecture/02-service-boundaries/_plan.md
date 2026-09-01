# Topic 02 · Service boundaries from bounded contexts — chunk plan

Tier: **Master**. Read `../_PHASE-NOTES.md` first.

## Boundary

Owns **where the line goes** — and nothing that happens after it is drawn.

- **01 Monolith first** owns the argument for not splitting at all, and owns Spring
  Modulith as a *framework*. 02 uses `ApplicationModules.verify()` as a boundary-enforcement
  tool and hands the framework tour back to 01.
- **03 Database-per-service** owns the *data consequence* — the joins you lose, API
  composition, CQRS read models, duplicated reference data. 02 stops at "these two
  aggregates must commit together, therefore they live in one service" and hands over.
  🔴 **02 must not become a database chapter.**
- **04 Sync vs async** owns coupling as a runtime decision (`0.99^n`, latency budgets).
  02 names runtime coupling only as one of the ten decomposition forces.
- **Phase 15** owns sagas and brokers. 02 says "you now need a saga" and stops.
- **05** owns wire evolution; 02 owns only the distinction between a published language
  and an internal aggregate.

## Version spine

JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Cloud train 2025.1.x
"Oakwood" (components 5.0.x) · Spring Modulith 2.1.1.

## Chunks (a PLAN, not a budget)

| # | File | What it argues |
|---|---|---|
| 1 | `01-what-a-boundary-is.md` | A boundary is a claim about what can change alone — design-time coupling is the definition |
| 2 | `02-bounded-context.md` | Evans' context: a model plus a language, valid only inside a line |
| 3 | `02b-the-same-word-two-meanings.md` | Polysemy is the strongest boundary signal there is |
| 4 | `02c-the-language-tells-you.md` | Qualifier creep, 14-value status enums, and the glossary that needs footnotes |
| 5 | `03-subdomain-vs-bounded-context.md` | Problem space vs solution space, and why conflating them costs you |
| 6 | `03b-core-supporting-generic.md` | Where to spend, what to buy, what to leave alone |
| 7 | `04-a-service-is-not-a-context.md` | 🔴 The rule everyone quotes is a heuristic — a service is one *or more* subdomains |
| 8 | `05-one-service-one-capability.md` | What the test actually tests, and the two places it lies |
| 9 | `06-invariants-are-the-criterion.md` | Aggregate = transactional consistency boundary; the primary splitting criterion |
| 10 | `07-finding-the-invariants.md` | Eliciting them from an order system, one rule at a time |
| 11 | `07b-false-invariants.md` | The constraints nobody asked for, and the damage they do to a boundary |
| 12 | `08-whose-job-is-it.md` | Evans' tie-breaker, and why it beats every technical preference |
| 13 | `09-the-transaction-boundary.md` | One aggregate per transaction, and what that forces about co-location |
| 14 | `09b-finding-it-in-the-code.md` | The `@Transactional` method touching two repositories, and an ArchUnit rule for it |
| 15 | `10-who-owns-the-data.md` | The owner is whoever enforces the invariant, not whoever reads it most |
| 16 | `10b-write-ownership-vs-read-access.md` | A field written by two services is not a boundary, it is a bug |
| 17 | `11-reasons-to-break-the-rule.md` | Vernon's four, translated into service-boundary decisions |
| 18 | `12-splitting-by-layer.md` | The UI/logic/DAO split, and why every feature then touches three services |
| 19 | `13-entity-services.md` | Nygard's anti-pattern: operational and semantic coupling for nothing |
| 20 | `13b-crud-is-not-a-capability.md` | The API that is a mirror of a table |
| 21 | `14-conway-and-the-org-chart.md` | The inverse manoeuvre, and when the org chart is the wrong map |
| 22 | `15-too-small.md` | The fixed cost floor per service; service-per-team as the counterweight |
| 23 | `16-the-shared-model-jar.md` | `common-domain` rebuilds the monolith at compile time |
| 24 | `17-the-god-service.md` | The orchestrator that owns no data and cannot fail alone |
| 25 | `18-boundaries-from-a-whiteboard.md` | Greenfield boundaries are guesses; say so and plan for it |
| 26 | `19-change-history-as-evidence.md` | Logical coupling from `git log`, and the Common Closure Principle |
| 27 | `19b-reading-the-co-change-matrix.md` | What each pattern means, and the four false positives |
| 28 | `20-event-storming.md` | What it settles and what it cannot |
| 29 | `21-system-operations-first.md` | Assemblage step 1: start from behaviour, never from tables |
| 30 | `22-the-ten-forces.md` | Dark energy and dark matter as a decomposition scorecard |
| 31 | `22b-scoring-one-cut.md` | The forces applied to a single real candidate boundary |
| 32 | `23-the-monolith-already-told-you.md` | Reading an existing codebase for its natural seams |
| 33 | `24-package-structure-is-the-boundary.md` | Package by feature; the boundary is a package tree before it is a network |
| 34 | `25-verifying-the-boundary.md` | `ApplicationModules.verify()`, the three rules it enforces |
| 35 | `25b-named-interfaces.md` | A module's published API, declared rather than assumed |
| 36 | `26-archunit-rules.md` | Boundary tests without Modulith |
| 37 | `27-build-modules-and-jpms.md` | What Maven, Gradle and `module-info.java` each actually enforce |
| 38 | `28-published-language-vs-aggregate.md` | The DTO is a contract; the aggregate is an implementation detail |
| 39 | `28b-never-publish-the-aggregate.md` | Serialising the entity is how a boundary dies |
| 40 | `29-anticorruption-layer.md` | The translation layer, in full Java |
| 41 | `29b-where-the-acl-lives.md` | Downstream, always — and how to know when to delete it |
| 42 | `30-context-mapping.md` | The map: upstream/downstream, mutually dependent, free |
| 43 | `31-customer-supplier.md` | The relationship that needs a real commitment to work |
| 44 | `32-conformist.md` | Taking their model whole, on purpose |
| 45 | `33-shared-kernel.md` | The most expensive relationship, and the rules that make it survivable |
| 46 | `34-open-host-and-published-language.md` | One protocol for many downstreams |
| 47 | `35-partnership-and-separate-ways.md` | The two extremes, and why both are legitimate |
| 48 | `36-choosing-a-relationship.md` | A decision table for the nine patterns |
| 49 | `37-the-tells-of-a-wrong-boundary.md` | Symptom-first list of everything a bad line does to you |
| 50 | `38-merging-two-services.md` | The path back, step by step |
| 51 | `39-moving-a-capability.md` | Relocating one aggregate from A to B |
| 52 | `40-splitting-a-service.md` | Split in-process first; extract only once it holds |
| 53 | `41-strangler-extraction.md` | Getting the first service out of a monolith |
| 54 | `42-the-cost-of-changing-a-boundary.md` | What a re-draw actually costs, honestly |
| 55 | `43-when-not-to-fix-it.md` | Living with a wrong line |
| 56 | `44-worked-example-operations-and-aggregates.md` | The order system: operations, aggregates, invariants |
| 57 | `44b-worked-example-candidate-cuts.md` | Four candidate boundaries scored against the forces |
| 58 | `44c-worked-example-two-teams-and-twelve.md` | The same system, two honest answers |
| 59 | `45-the-checklist.md` | Reviewing a proposed boundary in a design document |

## Verify, do not assume

- ⚠️ **"One service = one bounded context"** — microservices.io's Assemblage says a service
  is a *grouping* of subdomains, each subdomain in exactly one service. Check before
  repeating the folk rule.
- ⚠️ Vernon's four rules of thumb — quote the wording, not a paraphrase.
- ⚠️ The exact three rules `ApplicationModules.verify()` enforces, and the exact
  annotation names (`@ApplicationModule`, `@NamedInterface`, `@ApplicationModuleTest`).
- ⚠️ The nine context-mapping patterns and which of them are upstream/downstream.
- ⚠️ The ten dark-energy / dark-matter forces by their published names.
- ⚠️ Spring Modulith version and Boot compatibility (2.1.1 / Boot 4.1.x per the spine).
- ⚠️ Never present `git log` analysis output — describe the command and what to look for.
