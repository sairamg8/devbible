---
title: "The whole bill on one page, with the topic that owns each line — so a split proposal can be reviewed against an itemised invoice rather than against a feeling about how modern the architecture looks"
sidebar_label: "09b · The bill in full"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)) and
> *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html));
> Chris Richardson, *Pattern: Microservice Architecture* and *Pattern: Monolithic
> Architecture* ([microservices.io](https://microservices.io/patterns/microservices.html));
> Stefan Tilkov, *Don't start with a monolith*
> ([martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox** — every
> figure below is either a count of artefacts or arithmetic you can redo.

**Chunks 10 through 19 each priced one line. This is the invoice. Use it as a review
checklist: for every line, the proposal must say who pays it, what it costs in this specific
system, and which cheaper option was tried first. A proposal that cannot answer for a line
has not priced the split, it has described it.**

## The one-time costs

| # | Line item | What it costs | Chunk / owner |
|---|---|---|---|
| 1 | Service template and scaffolding | Build once, maintain forever | [18](08b-the-prerequisites-and-the-headcount.md) |
| 2 | Provisioning automation | Infrastructure as code, image pipeline | [18](08b-the-prerequisites-and-the-headcount.md) |
| 3 | Deployment pipeline per service | Template plus N instantiations | [14](06-deploy-coordination.md) |
| 4 | Correlation identifier and propagation | HTTP **and** messaging hops | **10 · Correlation** *(not written yet)* |
| 5 | Distributed tracing backend | Cost, retention, sampling policy | phase 12 topic 09 |
| 6 | Log aggregation | Index, retention, cost | phase 12 |
| 7 | Contract testing capability | Consumer expectations, provider gate, stubs | **11 · Contract testing** *(not written yet)* |
| 8 | Local-development story | An owned product, not a `docker-compose.yml` | [17](08-local-development.md) |
| 9 | Data-splitting migration | Per extracted service, irreversible | **03 · Database-per-service** *(not written yet)* |
| 10 | Consistency policy per distributed operation | A **product** decision, in writing | [10](04-the-transaction-you-lose.md) |
| 11 | Idempotency contracts | Receiver-side storage and semantics | [13](05b-the-ambiguous-outcome.md) |
| 12 | Deployment record | Version, timestamp, commit, queryable | [15](06b-the-version-matrix.md) |

## The recurring costs, per service, forever

| # | Line item | Chunk / owner |
|---|---|---|
| 13 | Pipeline maintenance (images, plugins, credentials) | [16](07-the-on-call-surface.md) |
| 14 | Alert set, tuned and re-tuned | [16](07-the-on-call-surface.md) |
| 15 | Dashboard | [16](07-the-on-call-surface.md) |
| 16 | Runbook | [16](07-the-on-call-surface.md) |
| 17 | Dependency and CVE upgrade stream | [19](09-the-organizational-costs.md) |
| 18 | Capacity, limits and cost attribution | [16](07-the-on-call-surface.md) |
| 19 | On-call ownership and escalation path | [16](07-the-on-call-surface.md) |
| 20 | Contract maintenance and deprecation windows | [15](06b-the-version-matrix.md) |

## The costs paid per change, forever

| # | Line item | Chunk / owner |
|---|---|---|
| 21 | Expand/contract for every wire-format change (3 releases, 2 teams) | [14](06-deploy-coordination.md) |
| 22 | Rollback compatibility in both directions | [14](06-deploy-coordination.md) |
| 23 | Saga design per previously-atomic operation (7 artefacts each) | [11](04b-which-operations-need-atomicity.md) |
| 24 | Partial-failure tests, which exceed the happy path in volume | [11](04b-which-operations-need-atomicity.md) |
| 25 | Cross-team coordination for any change spanning a boundary | [19](09-the-organizational-costs.md) |

## The costs with no invoice, which are the ones that decide the outcome

| # | Line item | Why it is invisible | Chunk |
|---|---|---|---|
| 26 | Slower incident diagnosis | Nobody measures MTTD | [12](05-debugging-across-hops.md) |
| 27 | Alert fatigue | Muting is per-alert and silent | [16](07-the-on-call-surface.md) |
| 28 | "Cannot reproduce" as a resolution | Recorded as closed, not as shipped | [17](08-local-development.md) |
| 29 | Slower onboarding | Nobody times a first commit | [17](08-local-development.md) |
| 30 | Standards divergence | Only visible when something must span services | [19](09-the-organizational-costs.md) |
| 31 | Unowned cross-service flows | Every team is individually correct | [16](07-the-on-call-surface.md) |
| 32 | Irreversibility | Merging services back is a project nobody proposes | [03](01c-who-pays-for-them.md) |

## Two numbers to compute before the review, both arithmetic

**Availability across a synchronous chain.** If an operation requires `n` services each
independently available with probability `p`, the operation's availability is `p^n`. For
`p = 0.99` and `n = 4`, that is `0.99^4 ≈ 0.9606`. This is a calculation, not a measurement,
and it assumes independent failures — which is optimistic, because shared infrastructure
correlates them. **04 · Sync vs async** *(not written yet)* owns this properly, including
what async does to the exponent.

**Standing operational commitments.** Recurring items above (rows 13–20) is eight per
service. Twelve services is ninety-six standing commitments, against eight for a monolith.

Neither number decides anything on its own. Both are hard to argue with, which is what you
want in a design review.

## What the monolith's bill looks like

Richardson lists the monolith's drawbacks with equal seriousness, and an honest comparison
must include them:

> *"Simple components - since there's only a single component it is potentially difficult to
> understand and maintain due its size and complexity"*
>
> *"Team autonomy - there's potentially less team autonomy since all teams are contributing
> to the same code base and they need to coordinate their work more often"*
>
> *"Fast deployment pipeline - the deployment pipeline is potentially slow since there's a
> single large application that needs to be built and tested"*
>
> *"Multiple technology stacks - the application uses a single technology stack, which might
> not be ideal for all subdomains. Also, if the application is large upgrading the technology
> stack might be very time consuming"*
>
> *"Segregate by characteristics - there's no possibility of segregating subdomains by their
> characteristics, which might reduce scalability, availability, security etc"*

With the crucial qualifier:

> *"These drawbacks become more severe as the application grows in size and complexity and
> the number of teams developing it increases."*

**That sentence is the actual decision rule.** The monolith's bill grows with size and team
count; the microservice bill is largely fixed per service and starts high. There is a
crossover. The whole argument is about where it is, and the answer is later than most teams
believe. [21 · What genuinely does not work](10-what-genuinely-does-not-work.md) is the
other half of this honest accounting.

## Gotchas

**★ Most proposals price rows 1–3 and nothing else.** Service template, provisioning and
pipelines are the visible, engineering-shaped costs. Rows 4–12 are also one-time and are
larger; rows 13–25 are recurring and dwarf both; rows 26–32 are the ones that determine
whether people are still happy in two years. Review the whole table, in order.

**★ Row 32 — irreversibility — should be the first line read, not the last.** Every other
cost is survivable if the decision can be undone. Merging services back requires a data
migration and a multi-quarter project nobody will propose, so in practice the decision is
permanent. Treat it accordingly.

**★ Row 10 is the only line that requires a signature from outside engineering.** The
consistency policy for each distributed operation — what the customer sees on partial
failure — is business policy. If no product owner has signed it, the line is unpriced no
matter how much engineering detail the proposal contains.

**★ The availability figure is arithmetic and must be labelled as such.** `0.99^4 ≈ 0.9606`
is a calculation anyone can redo, not an observation. Presenting it as measured data is
dishonest, and it also invites the correct objection that real failures are correlated
through shared infrastructure, which makes the true figure worse rather than better.

**★ "We'll do that later" applied to any row means operating without it in the interval, not
avoiding it.** Correlation, contract tests and the deployment record are the three most
commonly deferred, and all three are precisely the things you cannot build during the
incident that needs them.

**★ The monolith's own bill grows and the microservice bill is largely fixed per service —
that is the entire shape of the decision.** Richardson's qualifier is the operative
sentence: the monolith's drawbacks become more severe as size, complexity and team count
increase. Arguing about which architecture is better in the abstract is arguing about a
crossover point without naming the axis.

**★ The cheaper alternative must be named per line, or the comparison is rigged.** For
pipeline speed, that is build caching, merge queues and module-scoped tests. For cognitive
load, enforced module boundaries. For resource segregation, two deployables from one
artefact. A proposal that lists the split's benefits against the *current* monolith rather
than against an *improved* monolith is comparing the wrong two things.

## Interview questions

**★ Itemise the cost of splitting a monolith into six services.**
Four groups. One-time: service template, provisioning automation, six pipelines, correlation
and propagation across HTTP and messaging, a tracing backend, log aggregation, contract
testing, a local-development story, the data-splitting migrations, a written consistency
policy per distributed operation, idempotency contracts, and a deployment record. Recurring
per service: pipeline maintenance, alerts, dashboard, runbook, dependency upgrades, capacity
and cost, on-call ownership, and contract deprecation — eight commitments times six. Per
change: expand/contract across three releases for any wire-format change, rollback
compatibility in both directions, a saga with seven artefacts per previously-atomic
operation, partial-failure tests, and cross-team coordination. And the uninvoiced ones:
slower diagnosis, alert fatigue, unreproducible bugs, slower onboarding, standards
divergence, unowned flows, and irreversibility.

**★ Which single line would you put at the top of the invoice, and why?**
Irreversibility. Every other cost is tolerable if the decision can be reversed, and this one
determines how much scrutiny all the others deserve. Merging two services back into one
requires a data migration and a multi-quarter project that nobody has an incentive to
propose, so in practice a split is permanent. That makes it a different category of decision
from most architecture choices, and it justifies the level of evidence — measured pipeline
times, team counts, a signed consistency policy — that would otherwise look like
bureaucracy.

**★ How do you present the availability cost honestly?**
As arithmetic, labelled as arithmetic. If an operation requires four services each
independently available 99% of the time, its availability is `0.99^4`, about 96.06% — a
calculation the reader can redo, not a measurement from anyone's production system. Then add
the two honest caveats: the independence assumption is optimistic because shared
infrastructure correlates failures, and the figure only applies to synchronous chains, since
converting a hop to asynchronous messaging removes it from the exponent at the cost of
eventual consistency.

**★ Why must a split proposal name a cheaper alternative for each line?**
Because otherwise it compares the split against the monolith as it is today rather than
against the monolith as it could cheaply be. Pipeline slowness has answers in build caching,
merge queues, incremental test tooling and module-scoped tests. Cognitive load has an answer
in enforced module boundaries with a verification test. Resource segregation has an answer
in producing two deployables from one codebase with different profiles and limits. If those
were never tried, the proposal is arguing that a distributed system is better than a
neglected monolith, which is not the question anyone should be answering.

{/* FOOTER */}
