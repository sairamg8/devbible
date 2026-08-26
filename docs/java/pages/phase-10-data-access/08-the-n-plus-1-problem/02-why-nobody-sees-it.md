---
title: "Every query is fast, every query is correct, the code passes review — which is exactly why this bug reaches production"
sidebar_label: "2 · Why nobody sees it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.4 *Association fetching* and its *avoiding quagmires* guidance
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Hibernate ORM 7.4 user guide §31.2 *Logging*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**Most bugs announce themselves. This one has no exception, no wrong answer, no
slow query, no failing test and no suspicious line of code. It is visible in
exactly one place — the SQL the application actually emitted — and that is a
place most teams never look. This chunk is about why the usual defences all miss
it, because knowing which defence failed tells you which one to add.**

## The defences, and why each one lets it through

### Correctness testing does not see it

The summary is right. Every total is correct, every line count is correct, every
order appears. N+1 is not a correctness bug at all — it produces exactly the
answer the eager version would produce, by a more expensive route. Assertions
compare values, and the values are fine.

### Code review does not see it

Here is the reviewed line, in isolation:

```java
o.lines.size()
```

There is nothing to object to. A reviewer looking for a database call looks for
something that resembles one: a repository method, a `@Query`, a
`createQuery(...)`. A field access resembles reading a field, because in every
other Java program that is what it is. To catch this in review a reader must
hold three facts in their head simultaneously — that `lines` is mapped
`@OneToMany`, that `@OneToMany` defaults to `LAZY`, and that this expression sits
inside an iteration over an unbounded list — and only one of those three is
visible on the line being reviewed. The other two are in a different file and in
the specification.

### Profiling usually does not see it

A profiler samples stacks and attributes time. The time here is spread evenly
over a hundred identical frames, none of which is individually notable, and all
of it is recorded as **waiting on I/O**, which is what healthy database code also
looks like. There is no hot method. There is no allocation spike. The flame graph
shows a wide, shallow, boring plateau.

### Slow-query logging does not see it

This is the cruellest one. A database's slow query log exists to catch
statements that take a long time. Every one of these statements is a primary-key
lookup on an indexed foreign key returning a handful of rows — it is among the
fastest things the database will do all day. **The database is not slow. It is
being asked a fast question one hundred times.** Configure the slow-query
threshold as low as you dare and this bug will not appear in it.

### The APM dashboard half sees it

A distributed trace with JDBC instrumentation *will* show the hundred spans, and
this is the one mainstream tool that surfaces the shape without being asked. But
it surfaces it only where the instrumentation is switched on, only for sampled
requests, and only if somebody opens the trace for a request that is not
currently failing. The endpoint's p50 looks acceptable. Nobody opens the trace.

## The one place it is visible

Everything above fails for the same reason: N+1 is not a property of any single
statement, or of any single line of Java. It is a property of the **count** of
statements, and only one artefact records that.

The Hibernate guide puts this near the top of its list of ways to avoid trouble,
and the phrasing is worth quoting in full because it names the exact failure mode
of every defence above:

> *"Log the SQL executed by Hibernate. You cannot know that your persistence
> logic is correct until you've actually inspected the SQL that's being executed.
> Even when everything seems to be 'working', there might be a lurking N+1
> selects monster."*

**"Even when everything seems to be working."** That is the sentence. The
absence of symptoms is not evidence, because this bug does not have symptoms
until the data is large enough for the arithmetic to hurt — and by then the code
is a year old and nobody remembers writing it.

[Chunk 5](05-turning-the-sql-on.md) is how to turn that log on properly, and
[chunk 6](06-count-do-not-read.md) argues that even reading the log is the wrong
habit: you want to *count*, not read.

## Why the abstraction is doing its job

It is tempting to conclude that lazy loading was a mistake. It was not, and
understanding why keeps you from over-correcting into the two non-fixes in
[15 · Open session in view](15-open-in-view.md) and
[16 · `EAGER` is not a fix](16-eager-is-not-a-fix.md).

An object graph in a database is, in the general case, connected: follow enough
associations from any row and you reach most of the schema. The guide makes the
consequence explicit — if `find()` returned a fully materialised graph, a single
`find()` would load the database. So associations must be lazy by default, and
"lazy" means *resolved at the moment of access rather than at the moment of
query*. That is the design, and it is right.

The cost of that design is precisely this bug. **Making a database round trip
look like a field access is the feature; making a database round trip look like
a field access is also the bug.** They are the same mechanism seen from two
sides, and no amount of care with the mapping removes the tension — it can only
be resolved at the call site, by deciding in advance what this particular unit of
work needs.

That is why this topic is not "configure your entities correctly". It is "know
what your caller needs, and say so".

## Why it survives a rewrite

Teams that have been bitten often rewrite the offending service and the bug comes
straight back somewhere else within months. Three reasons, all structural:

**The fix is local but the cause is global.** Adding a fetch join to
`summarise()` fixes `summarise()`. It does nothing for the six other call sites
that will touch `o.lines` next quarter, because the mapping still says lazy and
lazy still means "silently fetch on access".

**The correct fix depends on the caller, so it cannot be applied once.** A method
that needs the lines wants a fetch join; a method that needs only the reference
wants a projection; a method that needs three different collections wants
something else again. There is no single edit to the entity that serves all of
them — attempting one is exactly how `EAGER` gets added.

**Nothing fails when the fix is omitted.** A missing fetch join has no compiler
error, no runtime exception and no failing test. In a codebase where forgetting
something produces no signal, it will be forgotten. That is the argument for the
statement-count assertion in [chunk 6b](06b-asserting-the-count-in-a-test.md) —
it manufactures the missing signal.

## Gotchas

**⚠️ Concluding it is fine because the endpoint's p99 is acceptable today.**
p99 measures the request as it is currently shaped, against the data volume that
currently exists. The property that makes N+1 dangerous is its *growth rate*, and
a latency percentile has no derivative in it. The right check is not "how slow is
it" but "how many statements does it issue, and is that number a constant".

**⚠️ Trusting a load test that uses a seeded fixture.**
Load tests usually run against a small, hand-built dataset, so N stays tiny while
concurrency goes up. That combination stresses the connection pool and the
application, not the arithmetic. A load test only exposes N+1 if its dataset has
production-like *fan-out* — realistic numbers of children per parent — which
seeded fixtures almost never do.

**⚠️ Reading the SQL log and seeing nothing wrong.**
A hundred identical statements scrolling past look, at a glance, exactly like a
healthy application under load. The eye normalises repetition. This is why
[chunk 6](06-count-do-not-read.md) argues for counting rather than reading: the
signal is the count, and the count is the one thing reading does not give you.

**⚠️ Assuming a code-review checklist will catch it.**
It will not, for the reason above — the offending expression carries none of the
information needed to judge it. What a checklist *can* catch is the enclosing
shape: "does this method iterate a collection of entities and dereference an
association inside the loop?" That question is answerable from one screen, and it
is the one worth asking.

**⚠️ Believing that because your team is experienced, this does not apply.**
The Hibernate guide describes N+1 as "without question, the most common cause of
poorly-performing data access code in Java programs". It is not an
inexperience bug. It is an invisibility bug, and experience does not confer the
ability to see a field access make a network call.

**⚠️ Only checking the endpoint you were told about.**
The person who reports the slow page found the one where N happened to grow
fastest. The same pattern is usually present in a dozen other places written by
the same hands with the same defaults. Diagnose the reported endpoint, then run
the same count assertion across the others before declaring it solved.

## Interview questions

**★ Why does N+1 so often reach production when other performance bugs don't?**
Because it defeats every routine defence at once, and it defeats each of them for
a different and individually reasonable reason. Correctness tests pass because
the results are correct — it is not a correctness bug. Code review passes because
the offending expression is a field access, which is indistinguishable from
reading memory unless the reviewer also knows the mapping and the enclosing loop.
Profilers show a wide flat plateau of I/O wait rather than a hot spot. The
database's slow query log never fires, because each individual statement is a
fast indexed lookup — the database is not slow, it is being asked a fast question
a hundred times. And unit tests use two rows, where 101 statements and 3
statements are indistinguishable. The one artefact that shows it is the count of
statements the application actually emitted, and that is the one artefact most
teams do not routinely inspect.

**★ Where is N+1 actually visible?**
Only in the emitted SQL — and more precisely in its *count*, not its content.
Each individual statement is unremarkable and correct; what is wrong is that
there are N of them. In practice there are three places to look: the Hibernate
SQL log (`org.hibernate.SQL` at DEBUG), the Hibernate `Statistics` object's query
and statement counters, or a JDBC proxy such as datasource-proxy or p6spy that
can count statements per unit of work. The Hibernate guide is emphatic that
inspection is not optional: "You cannot know that your persistence logic is
correct until you've actually inspected the SQL that's being executed. Even when
everything seems to be 'working', there might be a lurking N+1 selects monster."

**★ Should we just turn lazy loading off to prevent this?**
No — that trades a performance bug you can fix per call site for a worse one you
cannot fix at all. Associations are lazy by default because the object graph in a
database is effectively connected: if every association were eager, a single
`find()` would drag in most of the schema, which the Hibernate guide calls a
terrible idea that results in "simple session operations that fetch almost the
entire database". Worse, eager is not overridable per query — Hibernate's own
performance chapter notes that an EAGER association "cannot be overwritten on a
per query basis", so you lose the ability to say "not this time", and you gain a
*new* N+1 when a JPQL query forgets to join the eager association and Hibernate
resolves it with a secondary select anyway. The lazy default is correct; the fix
belongs at the call site. [16 · `EAGER` is not a fix](16-eager-is-not-a-fix.md) is the
long form.

**★ If lazy loading is what causes this, isn't lazy loading badly designed?**
It is designed with a known and accepted trade-off, and it is worth being able to
state both sides. The benefit is that navigating an object graph is written as
ordinary Java, so a domain model reads as a domain model rather than as a query
plan. The cost is that a network round trip is disguised as a field access, which
removes the visual cue that would let a reader spot the cost. Those are the same
mechanism seen from two directions — you cannot keep the transparency and remove
the invisibility. What the design does give you is a *place* to resolve the
tension: the call site, where the developer actually knows what the unit of work
needs. That is why Hibernate's headline rule is to specify all the data you need
at the start of the transaction and only then navigate.

**★ A teammate argues the fix is to add a code-review rule. Is that enough?**
It helps, but on its own it will not hold, for a reason that is structural rather
than cultural: omitting a fetch join produces no signal at all — no compiler
error, no exception, no failing test, no log line. Anything a codebase can forget
silently, it will eventually forget. A review rule also has to be phrased at the
right altitude to be checkable: "does this method dereference an association
inside an iteration over entities?" is answerable from one screen, whereas
"is this line lazy?" is not. The durable version of the rule is mechanical — an
assertion on the statement count in an integration test, so that a regression
fails the build rather than relying on a human noticing. That is
[chunk 6b](06b-asserting-the-count-in-a-test.md).

---

← Prev: [1b · The general rule](01b-the-general-rule.md) · Index: [08 · The N+1 problem](README.md) · Next → [3 · Why production is worse](03-why-production-is-worse.md)
