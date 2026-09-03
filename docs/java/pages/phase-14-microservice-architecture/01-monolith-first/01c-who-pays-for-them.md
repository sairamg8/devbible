---
title: "The team that proposes the split receives the benefit and the team that runs production receives the bill, and that mismatch — not any technical misjudgement — is why so many splits look correct on the whiteboard and wrong eighteen months later"
sidebar_label: "01c · Who pays for them"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html)) and
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)); Chris
> Richardson, *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox.**

**Splitting a system is a transaction with an unusual property: the benefits arrive
immediately and land on the development team, while the costs arrive gradually and land
somewhere else — on operations, on the on-call rotation, on the person who joins in a year
and has to reproduce a bug locally. Nobody in the room when the decision is made is holding
the invoice. That is the structural reason bad splits happen even in rooms full of
competent people.**

## The five payers

### Payer 1 — operations, on day one

Fowler's *Microservice Prerequisites* is the clearest statement of this anywhere, and it is
worth reading as a list of **roles you must be able to staff**, not a checklist you tick:

> *"As I talk to people about using a microservices architectural style I hear a lot of
> optimism. Developers enjoy working with smaller units and have expectations of better
> modularity than with monoliths. But as with any architectural decision there are
> trade-offs. In particular with microservices there are serious consequences for
> operations, who now have to handle an ecosystem of small services rather than a single,
> well-defined monolith. Consequently if you don't have certain baseline competencies, you
> shouldn't consider using the microservice style."*

The three baseline competencies, verbatim: **rapid provisioning** (*"you should be able to
fire up a new server in a matter of hours"*), **basic monitoring** (*"it's essential that a
monitoring regime is in place to detect serious problems quickly"*), and **rapid
application deployment** (*"you need to be able to quickly deploy them, both to test
environments and to production"*). [18 · The prerequisites and the headcount](08b-the-prerequisites-and-the-headcount.md)
turns those three into the staffing question they really are.

### Payer 2 — whoever is on call

A monolith has one deployable, one log stream, one set of dashboards, one restart
procedure, one runbook. Twelve services have twelve of each, and — the part people miss —
**the interactions between them are a thirteenth thing with no owner**. When checkout is
slow, the monolith gives you one thread dump. Twelve services give you a question: which
hop. [12 · Debugging across hops](05-debugging-across-hops.md) and
[16 · The on-call surface](07-the-on-call-surface.md) are the full accounting.

### Payer 3 — the person who joins in a year

"Clone the repository, run `docker compose up`, run the tests" is a monolith sentence. In a
twelve-service system it becomes an infrastructure project with its own maintainer, and the
day it stops working is the day new-hire productivity halves.
[17 · Local development](08-local-development.md) is that cost in full.

### Payer 4 — the business, in the form of consistency it did not agree to

The moment inventory and orders are separate services with separate databases, the sentence
"reserve stock and create the order, both or neither" stops being expressible. Richardson
is blunt about it:

> *"Some operations might need to be implemented using complex, eventually consistent
> (non-ACID) transaction management since loose coupling requires each service to have its
> own database."*

That is not a technical detail delegated to engineering. It is a **product decision** —
someone has to specify what the customer sees when the card is charged and the reservation
fails. Almost nobody asks the business before making it.
[10 · The transaction you lose](04-the-transaction-you-lose.md) covers it, and
**03 · Database-per-service** *(not written yet)* owns the data half.

### Payer 5 — future you, when the boundary turns out to be wrong

Refactoring across a service boundary requires coordinating two teams, two deploy
pipelines and usually a data migration. Fowler's footnote is the honest version:

> *"You cannot assume that you can take an arbitrary system and break it into microservices.
> Most systems acquire too many dependencies between their modules, and thus can't be
> sensibly broken apart. I've heard of plenty of cases where an attempt to decompose a
> monolith has quickly ended up in a mess."*

And Stefan Tilkov, arguing the *opposite* side of the monolith-first debate, agrees
completely on this specific point:

> *"Refactoring in the small becomes easier, refactoring in the large becomes much harder."*

When the two most prominent opponents in the argument agree on a cost, treat it as settled.

## The asymmetry that makes this a structural problem, not a competence problem

Write the two columns out:

| | Benefit | Cost |
|---|---|---|
| **Arrives** | Immediately, at the first independent deploy | Gradually, over 6–24 months |
| **Lands on** | The proposing team | Operations, on-call, new joiners, the business |
| **Is measured by** | Deploy frequency, pipeline duration — visible, dashboards exist | Incident duration, onboarding time, "we can't reproduce it" — rarely instrumented |
| **Is reversible** | n/a | Barely. Merging services back is a project |

Every row favours the split, and none of the rows is about whether the split is correct.
This is why a technically strong team can make a bad call: the feedback loop is broken, not
the reasoning.

## The counter-move: make the payer sign

The practical fix is procedural and it works. Before a split is approved, the proposal must
carry a written answer, from the party who will pay, to each of these:

1. **Operations:** name the person who will own the deployment pipeline for service N+1,
   and say what they will stop doing to make room.
2. **On-call:** state the current alert count and pages per week, and the projected count
   after the split. If nobody can project it, that is the answer.
3. **New joiners:** state how a developer will run the system locally, in one paragraph,
   today. If the paragraph mentions a tool that does not exist yet, that tool is part of
   the split's cost.
4. **The business:** for the three highest-value operations that will become distributed,
   state what the customer sees on partial failure. In writing. Signed by a product owner.
5. **Reversibility:** state what it would take to merge these two services back together.
   If the answer is "we wouldn't", you have made an irreversible decision, which is a
   different category of decision and deserves a different level of scrutiny.

**56 · The decision record** *(not written yet)* turns this into an ADR template you
can paste.

## Why this chunk sits before the Conway's law chunks

Because the honest version of "who pays" is nearly always "a team that is not in the
meeting", and *which teams are in which meetings* is exactly what Conway's law is about.
The payer analysis and the org chart analysis are the same analysis seen from two angles —
[04 · Conway's law is the real driver](02-conways-law-is-the-real-driver.md) takes the
other angle.

## Gotchas

**★ The split's cost is paid in a budget that has no line item for it.** Operational load,
onboarding friction and incident duration are rarely tracked, so the cost is genuinely
invisible rather than merely ignored. If you want a decision that survives contact with
reality, instrument those three *before* the split, so there is a baseline to compare
against. A split that cannot be evaluated afterwards will never be reversed no matter how
badly it goes.

**★ "We'll build the platform capabilities as we go" is how you get the premium without the
benefit.** Fowler's prerequisites are prerequisites: *"if you don't have these capabilities
now, you should ensure you develop them so they are ready by the time you put a
microservice system into production."* A team that splits first and builds observability
later spends the intervening period operating a distributed system blind, which is the
single most expensive state a system can be in.

**★ The reversibility question is the one that gets skipped, and it is the one that
matters most.** Almost every other cost on this page is survivable if you can undo the
decision. Merging two services back into one is a multi-quarter project involving a data
migration, so in practice the decision is permanent. Treat "can we undo this?" as a
first-class question, and note that the modular-monolith path is fully reversible in both
directions — extracting a module is work, but re-absorbing one is a package move.

**★ Consistency semantics get decided by whoever writes the code, at 4pm on a Thursday.**
When nobody specifies what happens if the payment succeeds and the reservation fails, an
engineer picks something. Usually a retry, sometimes a log line. The business finds out
from a customer. Force the specification before the split, not after the incident.

**★ The proposing team often pays nothing at all, because they leave.** Median tenure at
many companies is under three years, and the costs on this page mature over one to two.
This is not cynicism, it is the actual shape of the incentive, and it is why the decision
should be made against written criteria rather than against a room's enthusiasm.

## Interview questions

**★ Who pays for a microservice architecture?**
Five parties, none of whom is usually in the room. Operations, who now run an ecosystem
rather than an application and need rapid provisioning, monitoring and rapid deployment as
baseline competencies. The on-call rotation, whose alert surface, dashboard count and
runbook count scale with service count. New joiners, for whom "run it locally" becomes an
infrastructure project. The business, which now owns consistency decisions it was never
asked about — what the customer sees when one half of an operation succeeds. And the future
team that discovers the boundary was wrong and finds that refactoring across a service
boundary is an order of magnitude harder than refactoring inside a codebase.

**★ Why do smart teams make bad split decisions?**
Because the feedback loop is asymmetric rather than because the reasoning is bad. Benefits
are immediate, visible, measured by dashboards that already exist, and land on the
proposing team. Costs are gradual, land on other people, and are measured by things nobody
instruments — incident duration, onboarding time, the number of bugs that cannot be
reproduced locally. Add that the decision is effectively irreversible and you have a
structure that produces bad calls from good engineers. The fix is procedural: require the
payers to sign, and instrument the cost metrics before the split so the decision can be
evaluated later.

**★ What are Fowler's microservice prerequisites, and why does he call them
prerequisites rather than good practices?**
Rapid provisioning — being able to stand up a new server in hours, which implies substantial
automation. Basic monitoring — detecting technical failures and business anomalies quickly,
because in a distributed system things fail in ways test environments do not reproduce.
Rapid application deployment — a deployment pipeline that runs in no more than a couple of
hours, to both test and production. Plus the organisational shift that makes those
possible: close developer/operations collaboration, including joint incident management. He
calls them prerequisites because without them you are not running a microservice
architecture badly, you are running one blind — and he notes they are capabilities you
ought to have for monoliths too, which is exactly why building them first costs you nothing
if you never split.

**★ Your team wants to split. What do you require before approving it?**
A written answer from each payer: operations names who owns pipeline N+1 and what they will
stop doing; on-call states current and projected pages per week; someone writes the
one-paragraph local-development story as it will exist after the split; a product owner
signs off, in writing, on what the customer sees when each of the three highest-value
distributed operations partially fails; and the proposal states what merging the services
back would cost. Any of those that cannot be answered is not a blocker to be argued around
— it is the answer.

{/* FOOTER */}
