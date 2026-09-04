---
title: "A monolith that has been running for five years has already discovered most of its own seams, and they are recorded in package structure, schema clustering, deployment fear and the shape of the on-call rota — reading them is faster and more honest than modelling from scratch"
sidebar_label: "23 · The monolith already told you"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html));
> *Dark matter force: minimize design-time coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-design-time-coupling.html));
> the Spring Modulith 2.1.1 reference, *Documenting Application Modules*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/documentation.html)), for
> the module canvas and C4 component diagram generation.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. **No sandbox** — commands
> are shown for you to run; no output of any run appears anywhere in this topic.

**A long-lived monolith is an unusually well-instrumented experiment. Every day someone tried
to make a change and either found it easy or found it hard, and the record of which is which
is spread across the codebase, the schema, the deploy history and the incident log. Reading
that record is faster than a modelling exercise, it is grounded in what happened rather than
what people believe, and it produces boundary candidates nobody would have proposed — which
is precisely their value.**

## Signal 1 — the packages that already stopped talking

Most monoliths contain two or three regions that quietly became independent years ago. The
import graph finds them.

```bash
# Cross-package references between top-level modules of our own root package.
grep -rho '^import com\.retailer\.[a-z]*\.' src/main/java \
  | sed 's/^import //; s/\.$//' | sort | uniq -c | sort -rn
```

Read it as a graph. A package that imports few others and is imported by few is already
isolated, and extracting it is close to free. On a Spring Modulith codebase you get this
better: `Documenter` will produce *"a C4 component diagram containing all modules within the
system"* from `writeModulesAsPlantUml()`, and per-module diagrams from
`writeIndividualModulesAsPlantUml()` — generated from the code rather than drawn.

The **module canvas** is more useful still for boundary work, because of what it lists: base
package, Spring components by stereotype, aggregate roots, published events and events
listened to. A module whose canvas shows aggregate roots, its own events and few listeners is
a boundary candidate. A module whose canvas shows no aggregate roots at all is either
infrastructure or a god module.

## Signal 2 — the schema's connected components

The schema is misleading about aggregates ([07 · Finding the
invariants](07-finding-the-invariants.md)) and informative about *clusters*.

```sql
-- Foreign key edges between tables: the shape, not the aggregates.
SELECT c.conrelid::regclass AS from_table,
       c.confrelid::regclass AS to_table
FROM   pg_constraint c
WHERE  c.contype = 'f'
ORDER  BY 1, 2;
```

What you are looking for is not the aggregates; it is where the graph is *sparse*. Tables that
connect to the rest through one or two foreign keys are a cluster with a narrow interface, and
that narrow interface is the candidate boundary. A cluster connected by twenty foreign keys is
not separable without a great deal of work, whatever the domain model says.

Cross-check with actual query patterns, because a foreign key nobody joins on is a boundary
that already exists in practice:

```sql
-- If pg_stat_statements is enabled: which tables are joined together in practice.
SELECT query, calls
FROM   pg_stat_statements
WHERE  query ILIKE '%join%'
ORDER  BY calls DESC
LIMIT  50;
```

A declared foreign key that never appears in a join is a reference-by-identity relationship
that has already emerged; a pair of tables joined constantly is one that has not.

## Signal 3 — deployment fear

Ask the team which parts of the system they are nervous about deploying, and which they change
without thinking. The answers correlate with boundaries more strongly than anything in the
code.

Fear tracks blast radius. A region people change casually has few consequences elsewhere,
which is the operational definition of a boundary. A region people will not touch on a Friday
is coupled to something they cannot see, and that invisible coupling is the thing to find
before drawing any line near it.

This is qualitative and it is not soft: it is the team's accumulated experience of what breaks
what, which no static analysis reproduces.

## Signal 4 — the incident log

Group the last year's incidents by which part of the system was implicated and which part
caused it.

- **Incidents that stay inside one region** — a boundary is working there.
- **Incidents that start in one region and surface in another** — an invisible dependency. Go
  and find it; it is usually a shared table, a shared cache key, a shared thread pool or a
  shared queue.
- **Incidents that require several teams to diagnose** — the boundary does not match the
  ownership.

Shared *infrastructure* coupling deserves special attention here, because it never appears in
an import graph. Two modules sharing a connection pool are coupled in production and
independent in the code, and the first you learn of it is when one exhausts the pool.

## Signal 5 — the parts nobody has changed

```bash
# Least recently modified packages.
git log -1 --format='%ad %h' --date=short -- src/main/java/com/retailer/loyalty
```

A region untouched for two years is either finished or dead. Both are useful: a finished
region is a clean extraction candidate with almost no ongoing coupling, and a dead one should
be deleted, which is the cheapest architectural improvement available and is almost never
prioritised.

## Signal 6 — the on-call rota and the escalation paths

Who gets paged for what, and who they escalate to. This is the communication structure as it
actually operates under pressure, which is what Conway's law is about
([14 · Conway and the org chart](14-conway-and-the-org-chart.md)) — and it is frequently
different from the org chart, because escalation follows knowledge rather than reporting
lines.

If one person is escalated to for four unrelated regions, those four regions have one de facto
owner, and any split that assumes four owners is fiction.

## Signal 7 — the workarounds

Every long-lived system has them, and each is a boundary problem with a receipt:

| Workaround | What it says |
|---|---|
| A nightly reconciliation job | An invariant already surrendered; the two sides are already effectively separate |
| A cache with a manual invalidation endpoint | A read dependency somebody wanted to break |
| A feature flag that has been on for two years | A change that could not be made safely at once |
| A "sync" job between two tables | Two owners for one fact ([10b · The ownership register](10b-the-ownership-register.md)) |
| A support runbook for fixing data | An unenforced rule with a known failure rate |
| A retry loop with a comment about a race | A check-then-act that should be one operation |

## Putting it together

Each signal produces candidates. The ones that appear in several are the ones to act on:

| Region | Import isolation | Schema cluster | Low deploy fear | Incident isolation | Own owner | Verdict |
|---|---|---|---|---|---|---|
| Loyalty | Yes | Yes | Yes | Yes | Yes | Extract first — everything agrees |
| Notifications | Yes | N/A | Yes | Yes | No | Extract, but assign an owner |
| Pricing | Partly | Yes | No | No | Yes | Investigate the deploy fear before acting |
| Orders | No | No | No | No | Yes | Not a candidate; it is the core and it is entangled |

The first row is where to start, and it is usually not where anyone wanted to start — the
interesting part of the system is the entangled part, and the extractable part is the boring
one. Extracting the boring one first is nonetheless right: it builds the migration machinery,
proves the operational model, and costs little if it goes wrong.

## Gotchas

**★ Symptom: the analysis recommends extracting the least interesting part of the system.**
Cause: it is the part that is actually separable. Fix: do it anyway. The first extraction's
purpose is to build and prove the migration path — data migration, contract, deployment,
observability — on something whose failure does not matter.

**★ Reading the foreign-key graph as the aggregate graph.** It is neither, and the useful
signal is different: look for where the graph is *sparse*, because a cluster attached by one
or two keys has a narrow interface and is extractable.

**★ Symptom: two modules that never import each other and still break together.** Cause:
shared infrastructure — a connection pool, a cache, a thread pool, a queue, a database
instance. Fix: this coupling is invisible to every code-level tool and shows up only in the
incident log. Enumerate the shared infrastructure explicitly.

**★ Ignoring deployment fear because it is subjective.** It is the team's accumulated
experience of what breaks what, and it is the closest thing to a measurement of blast radius
that you can obtain in an afternoon. Ask, write it down, and then go and find out *why* they
are afraid.

**★ Symptom: a region untouched for two years.** Cause: finished or dead. Fix: find out which
before anything else. Deleting dead code is the cheapest architectural improvement available,
and extracting it instead is the most expensive way to keep it.

**★ Treating the workaround list as a maintenance backlog.** Each workaround is a design
finding with evidence attached — a surrendered invariant, a contested owner, an unbreakable
read dependency. Read them as architecture before scheduling them as chores.

**★ Assuming the current package structure reflects intent.** It reflects a sequence of
decisions under deadline. Where the import graph and the domain model disagree, the import
graph is evidence about the current system and the domain model is an aspiration; both are
useful and they are not the same kind of thing.

## Interview questions

**★ You are asked to decompose a five-year-old monolith. What do you read first?**
The evidence the system has already produced. The import graph, to find regions that have
quietly become independent. The foreign-key graph, looking for where it is sparse rather than
for aggregates. The commit history, for co-change. The incident log, grouped by which region
caused what. The team's deployment fear, which tracks blast radius better than anything
static. And the workarounds — reconciliation jobs, sync jobs, long-lived feature flags,
support runbooks — each of which is a boundary problem with a receipt. That takes days and
produces candidates grounded in what happened, rather than weeks producing candidates grounded
in what people believe.

**★ Why is "which parts are you afraid to deploy" a legitimate architectural question?**
Because fear tracks blast radius, and blast radius is the operational definition of a
boundary. A region people change casually on a Friday has few consequences elsewhere; a region
nobody will touch before a weekend is coupled to something they cannot see. That invisible
coupling is usually shared infrastructure or an implicit protocol, neither of which appears in
an import graph, and finding it before drawing a line near it saves a very expensive
discovery later.

**★ What can Spring Modulith tell you about an existing codebase's boundaries?**
If the code is already organised into modules, `Documenter` generates C4 component diagrams
for the whole system and per module, from the code rather than from a drawing — so the diagram
cannot be out of date. The module canvas is more useful for boundary work: it lists each
module's base package, Spring components by stereotype, aggregate roots, published events and
events listened to. A module with its own aggregate roots and its own events is a boundary
candidate; a module with no aggregate roots is infrastructure or a god module. And
`ApplicationModules.of(...).verify()` will tell you immediately whether the boundaries you
think exist are actually being respected.

**★ Why does the analysis usually point at the least interesting part of the system?**
Because the interesting part is interesting precisely because everything touches it — that is
what makes it the core domain. The extractable part is the one that has drifted into isolation,
which usually means nobody has needed to change it, which usually means it is boring.
Extracting it first is still correct: the first extraction's real product is the migration
machinery and the operational model, and you want to build those on something whose failure is
survivable.

**★ Two modules never reference each other but always break together. What is going on?**
Shared infrastructure or an implicit protocol. The candidates are a connection pool, a cache,
a thread pool, a message queue, a database instance, a shared configuration key, or a schema
convention nobody documented. None of them appears in an import graph or in a dependency
analysis, which is why the incident log is the tool that finds them. It is also why a service
split along a boundary like that fails: the coupling migrates with the code and reappears as
two services that go down together.

---

← [Scoring one cut](22b-scoring-one-cut.md) · [Topic index](README.md) · Next → [Package structure is the boundary](24-package-structure-is-the-boundary.md)
