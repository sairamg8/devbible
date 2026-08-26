---
title: "State it generally and the fix becomes obvious: decide what the unit of work needs before you start navigating, not one parent at a time"
sidebar_label: "1b · The general rule"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.4 *Association fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the `org.hibernate.annotations.FetchMode` javadoc in the Hibernate 7.4
> source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/annotations/FetchMode.java)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**[Chunk 1](01-one-hundred-and-one-queries.md) was one shape. This is the rule
behind it, the reason Hibernate cannot fix it for you, and the single sentence
from the documentation that every fix in this topic is a way of obeying.**

## Say it generally

**N+1 is what happens when a single logical operation on a collection of
objects is executed as one query for the collection and one more query for each
object in it.**

Three things are worth pulling out of that sentence:

**It needs a collection.** Fetch one order and touch its lines and you have
issued two queries, which is fine. The pathology only appears when the number of
parents is unbounded.

**It needs the association to be resolved one parent at a time.** Whatever
mechanism resolves it — a lazy proxy, an eager secondary select, a mapper, a
serialiser — the defining property is that it is called once per parent and each
call is its own round trip.

**It does not need Hibernate.** This is the part people get wrong. Hibernate did
not invent the problem and does not have a monopoly on it; the guide is blunt
about this:

> *"This isn't a bug or limitation of Hibernate; this problem even affects
> typical handwritten JDBC code behind DAOs."*

Any DAO with a `findOrder(id)` and a `findLinesForOrder(orderId)`, called from a
loop, has the same shape and the same arithmetic. What Hibernate changes is the
**visibility**: with hand-written JDBC the second call is a method you can see
in the source. With a lazy proxy it is a field access. That is why the ORM
version of this bug is the one that survives to production, and why the next
chunk is about invisibility rather than about arithmetic.

## Whose fault it is

The guide answers this directly, and the answer is not comfortable:

> *"Only you, the developer, can solve this problem, because only you know
> ahead of time what data you're going to need in a given unit of work."*

Hibernate cannot fix it for you because fixing it means deciding what the unit
of work needs — and the framework, standing behind a field access, has no way to
know whether `o.lines` is about to be read for every order or for none of them.
It has one rule of thumb to offer, and it is worth memorising because every fix
in this topic is a way of obeying it:

> *"explicitly specify all the data you're going to need right at the start of a
> session/transaction, and fetch it immediately in one or two queries, and only
> then start navigating associations between persistent entities."*

**Decide first, navigate second.** Every fix in [chunks 8 through 13](08-join-fetch.md)
is a mechanism for saying "this call needs the lines" *before* the loop starts,
rather than discovering it one order at a time.

## The name in the source

Hibernate names the problem in its own annotations. `FetchMode.SELECT` — the
default for anything lazy — carries this warning in its javadoc:

> *"This fetching strategy is vulnerable to the 'N+1 selects' bugbear, though
> the impact may be alleviated somewhat via: enabling batch fetching using
> `BatchSize`, or ensuring that the associated entity or collection may be
> retrieved from the second-level cache."*

Note the word **alleviated**. Not solved. That distinction is the whole argument
of [10 · `@BatchSize`](10-batch-size.md), and it is the most commonly misunderstood
sentence in Hibernate's documentation.

## Gotchas

**⚠️ Treating "N+1" as a name for a Hibernate feature.**
It is a name for an arithmetic shape. Once you hear it as *one query per element
of a collection*, you start seeing it in `JdbcClient` code, in REST calls to
another service, in file reads, and in cache lookups. The remedies differ; the
shape does not.

**⚠️ Reading "alleviated" in the `FetchMode.SELECT` javadoc as "solved".**
Hibernate's own wording for what `@BatchSize` and the second-level cache do is
*alleviate*. They reduce the multiplier. Only a join removes it, and
[10 · `@BatchSize`](10-batch-size.md) argues why the reduced version is nevertheless
sometimes the right answer.

**⚠️ Hearing "only you can solve this" as a criticism of the framework.**
It is a statement about where the information lives. The framework cannot know
whether this call will touch `o.lines`, because at the moment the decision has to
be made — before the first query runs — nothing has touched it yet. The
information exists only in the developer's intent.

**⚠️ Applying the rule to the mapping instead of the call site.**
"Specify all the data you're going to need" is advice about a *unit of work*, not
about an entity. Implementing it by editing the entity's fetch types is exactly
how `EAGER` gets added, which is [16 · `EAGER` is not a fix](16-eager-is-not-a-fix.md).

**⚠️ Assuming migrating off JPA fixes it.**
Some shapes go with you. A DAO with `findLinesForOrder(orderId)` called in a loop
is the same arithmetic with the second query written by hand, and the Hibernate
guide says so explicitly. What migrating changes is the visibility, not the
existence.

## Interview questions

**★ State the N+1 problem generally, without reference to Hibernate.**
It is what happens when a single logical operation over a collection of objects
is executed as one query for the collection plus one more query for each object
in it. Three properties make it pathological. It needs an unbounded collection —
fetching one parent and one child is two queries, which is fine. It needs the
association to be resolved one parent at a time, whatever the mechanism: a lazy
proxy, an eager secondary select, a hand-written DAO method, or a call to another
service. And its cost is a function of the data rather than of the code, so it
grows on its own. Stated that way it is obviously not an ORM problem — it is a
consequence of resolving a relationship element-by-element instead of set-at-a-
time, and it appears anywhere that mistake is available.

**★ Why can't Hibernate detect and fix this automatically?**
Because fixing it requires knowing, at the moment the first query runs, whether
the association will be needed — and Hibernate cannot know that. When `findAll()`
executes, nothing has yet touched `o.lines`, and eagerly joining it just in case
would be catastrophic in the many cases where the caller never looks at it: the
guide calls default eager fetching a terrible idea that results in "simple
session operations that fetch almost the entire database". By the time Hibernate
*does* have the information — the first field access — the initial query has
already returned and it is too late to have joined it. The information lives only
in the developer's head, which is exactly why the guide's rule is to specify the
data you need at the start of the unit of work and only then start navigating.

**★ What is Hibernate's own stated rule of thumb, and how does each fix relate to
it?**
The guide states it as: "explicitly specify all the data you're going to need
right at the start of a session/transaction, and fetch it immediately in one or
two queries, and only then start navigating associations between persistent
entities." Every fix in this topic is a mechanism for the first half of that
sentence. A fetch join says it in the query text. An entity graph says it as a
declarative fetch plan attached to the call. A fetch profile says it as a named
plan enabled for a session. A projection says it by not loading the graph at all.
Batch and subselect fetching are the partial exception — they do not let you
specify anything in advance, they just make the late discovery cheaper, which is
why the same guide is careful to say they mitigate rather than solve.

**★ Is N+1 the same thing as a Cartesian product problem?**
No — they are opposite failure modes, and the fix for one causes the other, which
is why they are worth keeping distinct. N+1 is *too many statements*: one per
parent, each returning a small correct result, with the cost paid in round trips.
A Cartesian product is *too many rows in one statement*: joining two collections
in a single query multiplies their sizes together, so a parent with 10 lines and
8 shipments produces 80 result rows for that one parent, with the cost paid in
bytes over the wire and in memory. They matter together because the standard cure
for N+1 — a fetch join — is exactly what produces a Cartesian product when
applied to two collections at once. That tension is why Hibernate offers batch
and subselect fetching at all, and it is the subject of
[11 · `@Fetch(SUBSELECT)`](11-subselect.md).

**★ What does it mean that batch fetching "alleviates" rather than solves?**
It means the multiplier is reduced but the shape is unchanged. Batch fetching
still resolves the association *after* the parents have been loaded, in a
separate round trip; what it changes is that one round trip now carries a batch
of K identifiers instead of one, so the count falls from `1 + N` to roughly
`1 + N/K`. That is a genuine and often sufficient improvement, but the count is
still a function of the number of rows returned, so it still grows with the data
— just more slowly. A join fetch is categorically different because it resolves
the association in the *same* statement, making the count a constant 1. Hibernate
is careful about this distinction in its own prose, calling join fetching "the
truly correct solution" and reserving batch fetching for the case where a join
would produce a Cartesian product.

**★ If you could add only one thing to a codebase to stop this recurring, what
would it be?**
An assertion on the number of SQL statements a unit of work issues, running in
the integration test suite. Not a lint rule, not a review checklist, not
documentation — a test that fails the build. The reason is structural: forgetting
to specify a fetch plan produces no signal at all — no compiler error, no
exception, no failing test — and anything a codebase can forget silently it will
eventually forget. A count assertion manufactures the missing signal, and it has
the useful property of being written in terms of the thing that actually defines
the bug, the statement count, rather than in terms of any particular syntax that
might have caused it. [Chunk 6b](06b-asserting-the-count-in-a-test.md) is how to
write one.

---

← Prev: [1 · 101 queries](01-one-hundred-and-one-queries.md) · Index: [08 · The N+1 problem](README.md) · Next → [2 · Why nobody sees it](02-why-nobody-sees-it.md)
