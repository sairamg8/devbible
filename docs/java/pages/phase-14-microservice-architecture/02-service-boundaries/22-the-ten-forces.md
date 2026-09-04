---
title: "Chris Richardson's ten forces are the only decomposition framework that names the arguments on both sides, and its real contribution is the insistence that five forces always oppose the split — so a design with no cost listed has simply not finished"
sidebar_label: "22 · The ten forces"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *About dark energy and dark matter: forces
> that shape an architecture*
> ([microservices.io](https://microservices.io/post/architecture/2023/03/26/dark-energy-dark-matter-force-descriptions.html))
> and the individual force pages under
> [`/articles/dark-energy-dark-matter/`](https://microservices.io/articles/dark-energy-dark-matter/dark-energy/simple-components.html);
> the *Microservice Architecture* pattern
> ([microservices.io](https://microservices.io/patterns/microservices.html)), which lists both
> sets as forces. Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring
> Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Most decomposition advice is one-sided: here is why to split, now go and split. Richardson's
framing is two-sided by construction — five *dark energy* forces push components apart, five
*dark matter* forces pull them together, and an architecture is where they balance. The
practical value is not the metaphor. It is that the framework gives you a fixed checklist of
five arguments *against* every proposed boundary, which means a design document that lists no
cost has not been finished rather than being unusually good.**

## The five dark energy forces — arguments to split

| Force | The published description |
|---|---|
| **Simple components** | *"simple components consisting of few subdomains are easier to understand and maintain than complex components"* |
| **Team autonomy** | *"a team needs to be able to develop, test and deploy their software independently of other teams"* |
| **Fast deployment pipeline** | *"fast feedback and high deployment frequency are essential and are enabled by a fast deployment pipeline"* |
| **Support multiple technology stacks** | developers need the flexibility to evolve the technology stack, with current versions of languages and frameworks |
| **Segregate by characteristics** | organising by resource requirements, availability needs and security requirements, to improve each |

## The five dark matter forces — arguments not to

| Force | The published description |
|---|---|
| **Simple interactions** | *"an operation that's local to a component or consists of a few simple interactions between components is easier to understand and troubleshoot than a distributed operation"* |
| **Efficient interactions** | *"a distributed operation that involves lots of network round trips and large data transfers can be too inefficient"* |
| **Prefer ACID over BASE** | *"it's easier to implement an operation as an ACID transaction rather than, for example, eventually consistent sagas"* |
| **Minimize runtime coupling** | keeping components independent at runtime, to maximise availability and reduce latency |
| **Minimize design time coupling** | reducing the need to change components simultaneously, to protect productivity |

## What each force is actually asking, in a form you can answer

The published descriptions are compact. Turned into questions a design review can answer:

**Simple components** — *After this split, can one person hold either side in their head?*
Measured in distinct domains, technologies, integrations and failure modes, not in lines.

**Team autonomy** — *Is there a team that is currently blocked by another team's release
cadence, and would this split unblock them?* If nobody is blocked, this force is not
present, whatever the design document asserts.

**Fast deployment pipeline** — *Is the build or test time for the whole currently painful, and
would splitting it materially help?* On a Spring Boot 4.1 codebase the honest answer is often
that the slow part is integration tests with containers, which split with the code and
therefore do not get faster in total.

**Support multiple technology stacks** — *Is a different runtime genuinely required?* A model
server, a native-image low-latency component, a library that exists only in another ecosystem.
Preference is not requirement.

**Segregate by characteristics** — *Does one side have a measured, current difference in
resource profile, availability requirement or security posture?* Card data handling, a
component that must survive when the rest is down, a batch component that needs a lot of
memory for an hour a day.

**Simple interactions** — *After the split, how many components does the most important
operation touch, and can one person debug it at 2am?*

**Efficient interactions** — *How much data crosses the new line per operation, and how many
round trips?* A boundary that requires fetching a list and then fetching each element is a
boundary in the wrong place.

**Prefer ACID over BASE** — *Which currently atomic operations become eventually consistent?*
This is [06 · Invariants are the criterion](06-invariants-are-the-criterion.md) as a force, and
it is the one with a hard floor: if the answer includes a real invariant, the boundary is
rejected rather than scored.

**Minimize runtime coupling** — *Which operations will now require the other side to be up?*
The availability arithmetic belongs to **04 · Sync vs async** *(not written yet)*; here it is
one force among ten.

**Minimize design time coupling** — *What fraction of changes will now need both sides?*
Answerable from the commit history, which makes this the most evidence-backed force in the
list ([19 · Change history as evidence](19-change-history-as-evidence.md)).

## How to use them without turning it into theatre

The framework invites a scoring spreadsheet, and a spreadsheet with ten scores out of five
produces a number that looks objective and is not. Three rules keep it useful:

**1. The invariant force is a gate, not a score.** If *prefer ACID over BASE* is violated by a
real invariant, the boundary is rejected. It does not get averaged against team autonomy.
Nothing else on the list can outvote a consistency guarantee you are not willing to lose.

**2. Every force must be answered with evidence or marked absent.** "Team autonomy: yes" is
worthless; "team autonomy: the pricing team has been blocked behind the sales release train
for three of the last four quarters" is a fact. A force with no evidence is scored zero, not
guessed.

**3. Write the dark matter side first.** The forces for a split are the ones the proposer
already believes. Writing the five costs first is the only reliable way to get them onto the
page at all, and it is why the framework's main contribution is the second list.

## The template

A candidate boundary gets one of these, in the repository, next to the decision record:

```text
Candidate boundary: extract Pricing from Sales

DARK ENERGY (for)
  Simple components        Sales currently holds order capture + pricing + promotions;
                           three domains, one team, cognitive load is the stated
                           reason two engineers left the module alone last quarter.
  Team autonomy            YES — pricing analysts' changes queue behind the sales
                           release train; 3 of last 4 quarters, evidence in ARCH-118.
  Fast pipeline            NO — the slow part is Testcontainers, which splits too.
  Tech stacks              NO — same stack on both sides.
  Segregate by chars       WEAK — pricing is read-heavy and could scale separately,
                           but no current capacity problem.

DARK MATTER (against)
  Simple interactions      Quoting a basket becomes one remote call; acceptable.
  Efficient interactions   One call per basket view, batched by line; acceptable.
  Prefer ACID over BASE    GATE — does any operation write both an Order and a
                           PriceList? Checked: no. The quoted price is copied onto
                           the order at placement and is immutable thereafter. PASS.
  Min. runtime coupling    Sales cannot quote without Pricing. Mitigation: cache the
                           last known price list; degrade to list price on failure.
                           Costs a stale-price window; Pricing accepts it.
  Min. design-time coupling Co-change over the last year: P(pricing | sales) low,
                           P(sales | pricing) low. Evidence supports the split.

DECISION: proceed. Revisit if quote latency exceeds the checkout budget.
```

The line that makes this document worth writing is the gate check, because it is the only one
that can stop the decision, and it is the one that would otherwise be discovered after the
migration.

## Where the framework is weak

Worth saying, because using it as though it were complete leads to specific errors.

- **It has no cost model.** All ten forces are qualitative, so "team autonomy" and "prefer
  ACID" are weighed by judgement. The gate rule above is the patch.
- **It does not include the fixed per-service cost.** Pipelines, dashboards, on-call, upgrades
  — the list in [15 · Too small](15-too-small.md) — appears nowhere in the ten. Add it as an
  eleventh consideration, always against.
- **It says nothing about migration cost.** The forces score the destination, not the journey,
  and the journey is often the deciding factor
  ([42 · The cost of changing a boundary](42-the-cost-of-changing-a-boundary.md)).
- **It is symmetric in appearance and not in practice.** Splitting is easy and merging is
  hard, so an equal balance of forces should resolve toward *not* splitting.

## Gotchas

**★ Symptom: a design document listing only benefits.** Cause: the dark matter side was never
written. Fix: require all five, each answered with evidence or explicitly marked absent. This
single procedural rule catches most bad splits before they are built.

**★ Averaging the ten into a score.** The consistency force is a gate; averaging it away is
how a team discovers after migration that an invariant is gone. Treat it separately and say so
on the form.

**★ Claiming team autonomy with no blocked team.** It is the most frequently asserted and
least frequently evidenced force. The evidence is specific: which team, blocked by what, how
often, with a ticket reference.

**★ Symptom: "we need multiple technology stacks" meaning one team prefers a different
language.** Cause: preference presented as requirement. Fix: ask what cannot be built on the
current stack. Introducing a second stack adds a permanent second set of upgrade, security and
hiring obligations.

**★ Scoring the destination and ignoring the journey.** A boundary that is better in the end
state may still be the wrong decision this year, because the migration costs two quarters of
the team's capacity. The forces cannot see that.

**★ Forgetting the fixed per-service cost entirely.** It is genuinely absent from the ten, it
is real, and it is paid every year. Add it explicitly or the framework will systematically
favour splitting.

**★ Treating an even balance as a coin flip.** It is not symmetric: splitting later is
straightforward, merging later is expensive and politically hard. An even balance should
resolve toward keeping things together.

## Interview questions

**★ What are the dark energy and dark matter forces, and what is the point of framing them
that way?**
Five forces that encourage decomposition — simple components, team autonomy, a fast deployment
pipeline, supporting multiple technology stacks, and segregating by resource, availability or
security characteristics — and five that resist it: simple interactions, efficient
interactions, preferring ACID over BASE, minimising runtime coupling and minimising
design-time coupling. The point is that decomposition arguments are usually one-sided, and the
framework supplies a fixed checklist of five reasons *against* every proposed boundary. A
design that lists no cost is not a good design, it is an unfinished one.

**★ Are all ten forces equal?**
No, and treating them as equal is the main way the framework gets misused. "Prefer ACID over
BASE" is a gate rather than a score: if a real transactional invariant would be split, the
boundary is rejected outright, because nothing on the other list restores a consistency
guarantee. The rest genuinely are trade-offs to be weighed. There is also an eleventh
consideration missing from the ten — the fixed per-service cost of pipelines, dashboards,
on-call and upgrades — which must be added explicitly or the framework tilts toward splitting.

**★ Which of the ten can you answer with data rather than judgement?**
Minimise design-time coupling, directly, from co-change in the commit history. Team autonomy,
from release history and blocked tickets. Segregate by characteristics, from current resource
metrics — provided you insist on "measured now" rather than "expected later". Prefer ACID over
BASE, from the transaction map: which `@Transactional` methods write aggregates that would end
up on opposite sides. The other six are judgement, which is fine as long as the judgement is
recorded with its reasoning rather than as a number.

**★ What does the framework not tell you?**
Three things. It has no cost model, so all ten are weighed by judgement and a "score" is
false precision. It omits the fixed per-service overhead entirely. And it evaluates the
destination rather than the migration, so a boundary that is better in the end state can still
be the wrong decision this year because getting there costs two quarters. It is also
misleadingly symmetric: splitting later is cheap, merging later is expensive, so an even
balance of forces should resolve toward not splitting.

**★ How would you run a boundary decision using it?**
Write the dark matter side first, so the costs get onto the page before the proposer's
enthusiasm fills it. Answer each of the ten with evidence or mark it explicitly absent —
zero, not guessed. Check the consistency gate separately and record the specific check: which
operations write aggregates that would span the new line. Add the fixed per-service cost. Then
decide, record the decision with the evidence, and — the part people skip — record what would
make you revisit it.

---

← [System operations first](21-system-operations-first.md) · [Topic index](README.md) · Next → [Scoring one cut](22b-scoring-one-cut.md)
