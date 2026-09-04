---
title: "A service boundary is not a line on a diagram, it is a claim that everything on this side can change without asking permission from that side — and every boundary you draw is really a bet about which changes arrive together"
sidebar_label: "01 · What a boundary is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io — *Microservice Architecture pattern*
> ([microservices.io](https://microservices.io/patterns/microservices.html)), *Dark matter
> force: minimize design-time coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-design-time-coupling.html))
> and *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. No sandbox — these
> pages carry Java, Maven and YAML, never a captured run.

**A boundary is a promise: a change on one side of it does not require a change, a review,
a release or a conversation on the other side. That promise is either true or it is not,
and nothing about the diagram, the repository layout, the Kubernetes namespace or the word
"microservice" makes it true. It is made true by the code and by the domain, and it is
falsified the first time you cannot ship a one-line change without coordinating two teams.
Everything in this topic is downstream of that single test: if these two things change
together, they belong together — and no amount of network between them will make them
independent.**

## The definition worth memorising

microservices.io calls the thing you are actually managing **design-time coupling**, and
defines it precisely:

> *"the likelihood that they need to change together for the same reason"*

That definition is worth more than any diagram, because it is falsifiable and because it
does not mention technology. It applies to two fields, two classes, two packages, two
subdomains and two services identically. Drawing a boundary is choosing where you are
willing to pay for coordination.

Notice what the definition does **not** say. It does not say "does A call B". Two services
can call each other a thousand times an hour and be loosely coupled at design time, if the
API between them is stable. Two services can never speak and be tightly coupled at design
time, if a new field in a shared enum forces both to release. Call volume is a **runtime**
property; it belongs to **04 · Sync vs async** *(not written yet)* — its argument
about availability, not to this one. Confusing the two is the most common analytical error
in this whole area, and it produces architectures that are chatty *and* rigid.

## The two questions, and only these two

Every boundary decision in this topic reduces to two questions. They are different
questions and they have different sources of evidence.

**1. What must be consistent at the same instant?**
Two pieces of state that must satisfy a rule *atomically* cannot be split across a
transaction boundary without you inventing a compensating mechanism. This is the invariant
question, and it is answered by the domain, not by you. [06 · Invariants are the
criterion](06-invariants-are-the-criterion.md) is the whole argument.

**2. What changes together for the same reason?**
Two pieces of behaviour that a single business decision always modifies together want to
live together, even when no invariant links them. This is the Common Closure question, and
it is answered by history — by what your `git log` actually shows, not by what the domain
model looks like on a whiteboard. [19 · Change history as
evidence](19-change-history-as-evidence.md) is that argument.

A boundary that satisfies both is a good boundary. A boundary that satisfies neither is
the distributed monolith. A boundary that satisfies one and not the other is the normal
case, and the rest of this topic is about which one wins when.

## The promise stated as a test you can actually run

Take any proposed boundary and any realistic change request, and ask the question in this
form:

> To ship this change, how many repositories must merge, how many pipelines must go green,
> and how many of those merges must happen in a specific order?

One repository, one pipeline, no ordering: the boundary held.
Two repositories in any order: the boundary is intact but the change was genuinely
cross-cutting. Acceptable, occasionally.
Two repositories **in a required order**, with a window where neither version works alone:
the boundary is fictional. You have one deployable unit wearing two names, and you are
paying network latency and operational cost for a modularity you do not have.

That third case has a name and it is the closing argument of this phase — the distributed
monolith. It is not a scaling problem or an infrastructure problem. It is a boundary that
was drawn in the wrong place and then made expensive to move.

## Why "loose coupling" is not enough of an instruction

Everyone agrees services should be loosely coupled. The instruction is useless because it
does not say *along which axis*. microservices.io's decomposition patterns list the forces
explicitly, and they pull in opposite directions:

| Force | Pulls toward | Named at |
|---|---|---|
| Team autonomy | more services | dark energy |
| Fast deployment pipeline | more services | dark energy |
| Simple components | more services | dark energy |
| Prefer ACID over BASE | fewer services | dark matter |
| Simple interactions | fewer services | dark matter |
| Minimize design-time coupling | fewer services **or** better APIs | dark matter |

There is no configuration of a real system in which all ten forces are satisfied. A
boundary is a *trade*, and a design document that claims a split with no cost has simply
not identified the cost yet. [22 · The ten forces](22-the-ten-forces.md) works through the
full list; the point here is that "loosely coupled" is the goal, not the method.

## The Common Closure Principle is the load-bearing idea

Both microservices.io decomposition patterns list the same force, in the same words:

> *"Services must conform to the Common Closure Principle - things that change together
> should be packaged together"*

This is Robert C. Martin's package principle applied one level up. It is the reason
splitting by technical layer fails, the reason entity services fail, and the reason a
boundary derived from an org chart sometimes works and sometimes does not. When you are
stuck between two candidate cuts, the tie-breaker is almost always: which cut puts the
things that change together on the same side?

## What a boundary costs, stated once so the rest of the topic can assume it

Drawing a line converts a set of cheap operations into expensive ones. Concretely, and
permanently:

- A method call becomes a network call that can fail, time out, or return stale data.
- A compile error becomes a runtime error, usually in production, usually at 2am.
- A refactor that an IDE could do in one keystroke becomes a multi-release migration with
  a compatibility window.
- A single ACID transaction becomes either a distributed workflow with compensation, or an
  invariant you have quietly stopped enforcing.
- A `JOIN` becomes an API call, a cache, or a replicated table. That cost belongs to
  **03 · Database-per-service** *(not written yet)* — this topic hands it
  over there deliberately and does not re-litigate it.
- A new repository, a new pipeline, a new dashboard, a new alert route, a new on-call
  rotation entry, and a new place for dependency upgrades to rot.

Every one of those costs is paid **per boundary, forever**. That is why a boundary should
be justified by something structural — an invariant, a language difference, a genuinely
independent rate of change — and not by a preference for small files.

## The thing a boundary is *not*

It is not a Kubernetes Deployment. It is not a Git repository. It is not a team. It is not
a database. All four of those things usually *follow* a boundary, and all four of them are
routinely mistaken for one. You can have four repositories inside one boundary (bad, but
survivable) and you can have two boundaries inside one repository (a modular monolith —
often excellent). The boundary is the **contract about what may change independently**;
the deployment topology is an implementation of it.

This distinction is why the modular monolith is a legitimate destination and not a
consolation prize. [24 · Package structure is the boundary](24-package-structure-is-the-boundary.md) and
[25 · Verifying the boundary](25-verifying-the-boundary.md) show a boundary that is
enforced by the compiler and a test, with no network anywhere. That boundary is more real
than a REST API between two services that share a database.

## Gotchas

**★ "We already split it, so the boundary exists."** Deployment is not encapsulation. If
service A reads service B's tables, or if both import `common-domain-1.4.jar` and a change
to that jar forces both to release, the boundary does not exist regardless of how many
Deployments there are. The test is the change test above, not the topology.

**★ Treating call frequency as the coupling metric.** A dashboard showing 40,000
calls/minute between two services proves runtime coupling, which is a real problem, but it
proves nothing about whether the *boundary* is right. A boundary is wrong when changes
correlate, not when calls do. Check the commit history before you check the traffic graph.

**★ Drawing the boundary and then never re-testing it.** Boundaries are hypotheses about
a domain you understood less well a year ago. The change test is cheap to re-run and
almost nobody re-runs it. Put it in the quarterly architecture review with actual numbers
from `git log`, not from memory.

**★ Confusing "independent deployability" with "independently deployed".** A service that
*could* be deployed alone but in practice always ships in the same release train as three
others has the cost of a boundary and none of the benefit. Measure how often it actually
deploys alone.

**★ Assuming the boundary is where the API is.** Teams frequently put a REST API between
two components that share an entity model, then discover every API change is a
simultaneous change on both sides. The API is where the boundary *shows*; it is not what
makes it real. What makes it real is that the two sides model the thing differently and
neither needs the other's model.

## Interview questions

**★ What is a service boundary, in one sentence, without using the word "microservice"?**
A commitment that everything inside it can change without requiring a coordinated change
outside it. That commitment is testable: take a realistic change request and count the
repositories that must merge and whether they must merge in a particular order. If a
one-line business change forces an ordered two-repository release, there is no boundary
there — there is a monolith with a network in the middle.

**★ Two services call each other constantly. Is that a boundary problem?**
Not necessarily, and the distinction matters. Frequent calls are *runtime* coupling: it
costs latency and it multiplies failure probability, which is topic 04's argument. A
boundary problem is *design-time* coupling — the likelihood that the two need to change
together for the same reason. A chatty pair with a stable contract may be perfectly well
bounded and merely badly shaped for performance; a silent pair that both release whenever
a shared enum gains a value is badly bounded. Diagnose them separately, because the fixes
are different: batching and caching for one, moving the line for the other.

**★ Why is the Common Closure Principle the tie-breaker rather than cohesion in general?**
Because "cohesion" is a judgement about how related things *feel*, and Common Closure is a
statement about how they *behave over time* — and behaviour over time is recorded in
version control, so it can be checked instead of argued about. Two classes can feel deeply
related and never change together, which means separating them costs nothing. Two classes
can feel unrelated and change together every sprint, which means separating them costs
every sprint.

**★ Your team wants to split a component because the file is 4,000 lines long. Is that a
boundary argument?**
No. That is an argument for extracting classes or packages, which is free and reversible.
A service boundary costs a network hop, a lost transaction, a lost join, an extra
pipeline, an extra on-call surface and a permanent versioning obligation. File size is not
evidence about the domain and not evidence about coordination cost. If the 4,000 lines
change for four unrelated reasons on four different schedules, *that* is the boundary
argument — and you should be able to demonstrate it from the commit history rather than
from the line count.

**★ Can one team own two services? Can two teams own one service?**
One team owning two services is normal and microservices.io's *Service per team* pattern
allows it explicitly — but it advises that *"A team should have exactly one service unless
there is a proven need"*, because each extra service is fixed overhead the team pays
forever. Two teams owning one service is the arrangement that reliably fails: every change
needs cross-team review, the codebase drifts into two half-consistent styles, and nobody
is accountable when it breaks. If two teams must own one service, that is evidence you
have found either one boundary too few or one team too many.

---

[Topic index](README.md) · Next → [Bounded context](02-bounded-context.md)
