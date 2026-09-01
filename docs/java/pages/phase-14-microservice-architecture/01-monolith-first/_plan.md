# Topic 01 · Monolith first — honestly. Chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.

## Boundary

Owns **the argument against splitting**, and **Spring Modulith 2.1.1** as the in-process
answer. Specifically:

- what a microservice architecture actually buys, and **who receives that benefit**;
- **who pays**, and in which budget the cost lands;
- Conway's law as the real driver — the architecture follows the communication structure,
  not the other way round;
- the costs nobody prices in: the transaction you lose, debugging across hops, deploy
  coordination, on-call surface, local development, the ops headcount;
- the **honest list** of what genuinely does not work in a monolith — and the myths that
  are not on it;
- **Spring Modulith**: modules and their conventions, `ApplicationModules` verification,
  the module test slice, documentation generation, application module events, the runtime
  features, and the migration path it gives you *toward* services later.

⛔ **Does not teach any Spring Cloud component.** Boundaries (02), data ownership (03),
sync/async and the availability arithmetic (04), the wire contract (05), the gateway (07),
discovery (08) and correlation (10) belong to other topics. Name them and hand off.
Sagas belong to phase 15 topic 10. Resilience4j belongs to phase 16.

## Chunks (a PLAN, not a budget)

| # | File | What it argues |
|---|---|---|
| 1 | `01-the-question-behind-the-question.md` | "Should we split?" is a question about the org chart wearing a technical costume |
| 2 | `01b-what-microservices-actually-buy.md` | The five things a split genuinely delivers, each named with its beneficiary |
| 3 | `01c-who-pays-for-them.md` | The buyer and the payer are different people; that is why the decision goes wrong |
| 4 | `02-conways-law-is-the-real-driver.md` | Conway's homomorphism, and the n²/2 communication-path arithmetic behind it |
| 5 | `02b-the-inverse-conway-maneuver.md` | Reorganise to get the architecture — and what the manoeuvre cannot fix |
| 6 | `02c-team-topologies-and-the-two-team-shop.md` | One service per team is a ceiling, not a floor; twelve services and two teams is a lie |
| 7 | `03-monolith-first-the-actual-argument.md` | Fowler's two reasons, verbatim: YAGNI, and boundaries you cannot yet see |
| 8 | `03b-the-honest-counterargument.md` | Tilkov's rebuttal, and the case where starting distributed is right |
| 9 | `03c-four-ways-to-execute-monolith-first.md` | Careful modular monolith, peel at the edges, sacrificial architecture, the duolith |
| 10 | `04-the-transaction-you-lose.md` | `@Transactional` was doing more work than anyone budgeted for |
| 11 | `04b-what-you-write-instead.md` | Compensation, idempotency and the outbox — the code the split obliges you to own |
| 12 | `05-debugging-across-hops.md` | The stack trace stops at the socket |
| 13 | `05b-the-ambiguous-outcome.md` | A timeout is not a failure; it is "I do not know", and it is now a state you must model |
| 14 | `06-deploy-coordination.md` | Independent deployability is a property you have to keep earning |
| 15 | `06b-the-version-matrix.md` | Every service you add multiplies the set of combinations you have never run |
| 16 | `07-the-on-call-surface.md` | Alerts, dashboards, runbooks and pager rotations scale with service count, not with users |
| 17 | `08-local-development.md` | "Run the system on a laptop" is a requirement you silently deleted |
| 18 | `08b-the-prerequisites-and-the-headcount.md` | Fowler's three prerequisites are job descriptions, not checkboxes |
| 19 | `09-the-organizational-costs.md` | Shared libraries, ownership gaps, and the platform team you now have to fund |
| 20 | `09b-the-bill-in-full.md` | The whole cost list in one table, each line pointing at the topic that owns it |
| 21 | `10-what-genuinely-does-not-work.md` | The honest list — seven things a monolith cannot do, stated without hedging |
| 22 | `10b-independent-scaling.md` | The one hot subdomain, and when replicating the whole app stops being cheaper |
| 23 | `10c-blast-radius.md` | One `OutOfMemoryError` takes the reporting export and the checkout with it |
| 24 | `10d-technology-heterogeneity.md` | The Python model server and the library you cannot upgrade |
| 25 | `10e-the-build-and-the-pipeline.md` | Build time is a real constraint — and the cheap fixes you must try first |
| 26 | `10f-what-is-not-on-the-list.md` | The four claims about monoliths that the sources contradict |
| 27 | `11-spring-modulith-what-it-is.md` | An opinion about functional structure, verified by a test, on Boot 4.1 |
| 28 | `11b-the-package-arrangement.md` | The main package, its direct sub-packages, and package scope as the first enforcement |
| 29 | `11c-api-and-internal-packages.md` | Sub-packages force types public, and the compiler stops helping |
| 30 | `11d-named-interfaces.md` | Exposing a second package on purpose — `order :: spi` |
| 31 | `11e-explicit-allowed-dependencies.md` | Opting into a whitelist, and what "code not assigned to any module" quietly permits |
| 32 | `11f-nested-modules.md` | Sub-modules and their asymmetric access rules |
| 33 | `11g-open-modules.md` | The legacy on-ramp the docs warn you about in the same breath |
| 34 | `11h-module-detection.md` | `direct-subpackages`, `explicitly-annotated`, custom strategies and `@Modulithic` |
| 35 | `12-verifying-the-arrangement.md` | Three rules, one JUnit test, a red build |
| 36 | `12b-detectviolations-and-adoption.md` | How to turn this on in a codebase that fails it on day one |
| 37 | `12c-verificationoptions-and-jmolecules.md` | Replacing the defaults, and the hexagonal/layered rules underneath |
| 38 | `12d-what-verification-cannot-see.md` | Reflection, bean names, SQL, and the shared table nobody declared |
| 39 | `13-the-module-test-slice.md` | `@ApplicationModuleTest` narrows the context to one module |
| 40 | `13b-bootstrap-modes.md` | STANDALONE, DIRECT_DEPENDENCIES, ALL_DEPENDENCIES and `sharedModules` |
| 41 | `13c-efferent-dependencies-and-mocks.md` | Mock the neighbour; the urge to widen the bootstrap is the diagnosis |
| 42 | `13d-moduleslicing.md` | 2.1: vertical slicing by module × horizontal slicing by layer |
| 43 | `13e-the-scenario-api.md` | Stimulus → wait → verify, and the state the framework will never roll back |
| 44 | `13f-change-aware-test-execution.md` | Running only the modules a commit touched — and every case it backs off |
| 45 | `14-events-instead-of-bean-references.md` | Functional gravity, and the injection point that made the module untestable |
| 46 | `14b-applicationmodulelistener.md` | One annotation, three semantics, and the failure mode each one introduces |
| 47 | `14c-the-event-publication-registry.md` | An outbox inside the monolith, written in the business transaction |
| 48 | `14d-publication-lifecycle-and-failure.md` | 2.0 statuses, the staleness monitor, resubmission and completion modes |
| 49 | `14e-externalization-and-the-seam.md` | `@Externalized`: the event boundary is the one that survives extraction |
| 50 | `15-documenter-and-the-canvas.md` | Architecture documentation generated from the code, so it cannot go stale silently |
| 51 | `15b-actuator-and-observability.md` | The module graph as a runtime resource, and spans per module invocation |
| 52 | `15c-module-aware-flyway.md` | Per-module migration folders — database ownership, rehearsed in one schema |
| 53 | `15d-module-initializers.md` | Startup ordered by the module dependency graph |
| 54 | `16-choosing-what-to-extract-first.md` | The criteria, applied to a real module list |
| 55 | `16b-what-modulith-does-not-give-you.md` | It is not half a microservice; the honest gap list |
| 56 | `17-the-decision-record.md` | Writing down what would have to be true to split |
| 57 | `18-the-checklist.md` | Reading a "let's split it" proposal |

## Verify, do not assume

- ⚠️ Spring Modulith 2.1.1's actual Boot baseline — the reference appendix's compatibility
  matrix is stale (it stops at 2.0-snapshot/Boot 4.0). Check the published POM.
- ⚠️ `@ModuleSlicing` — new in 2.1, confirm against the reference and the GA blog.
- ⚠️ `EventPublication.Status` values and the staleness properties — 2.0 additions.
- ⚠️ `spring.modulith.detection-strategy` default: the appendix says `none`, the prose says
  `direct-subpackages` is the fallback. Quote both.
- ⚠️ Module-aware Flyway: which property, which folder layout, which tracking tables.
- ⚠️ Fowler's MonolithFirst / MicroservicePremium / MicroservicePrerequisites — quote, do
  not paraphrase.
- ⚠️ Conway's own wording of the law, from the 1968 paper, not from a retelling.
