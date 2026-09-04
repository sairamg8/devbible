---
title: "The counter says 341 statements — now find the line of Java that caused them, which the log will not tell you"
sidebar_label: "7 · From a count to a call site"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §31.2 *Logging* and
> §31.6 *Fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `org.hibernate.stat.Statistics` interface in the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/stat/Statistics.java))
> and the Hibernate ORM 7.4 *A Short Guide to Hibernate 7* §8.4
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**Detection and localisation are different problems and need different tools. A
counter tells you an endpoint is wrong; it does not tell you which of the forty
lines in the service caused it. This chunk is the sequence that gets you from a
number to a line, and it is deliberately ordered cheapest-first.**

## Step 1 · Confirm it is N+1 and not something else

Before hunting, rule out the two things that produce a large statement count
without being N+1.

**A large number that does not grow with the data** is not this bug. Run the same
call against two data sizes. If the count is 341 both times, you have a method
that issues 341 statements — badly, but for some other reason, and the fix is
different. If it is 341 and 1,706, it is N+1.

**A large number of *writes*** is a flush, not a fetch. Compare
`getEntityInsertCount()` and `getEntityUpdateCount()` against the statement
count. A batch job doing N updates has the write-side shape from
[chunk 4b](04b-three-more-shapes.md), which is fixed by a bulk statement, not by
a fetch plan.

## Step 2 · Ask which kind of association

One line, and it eliminates most of the search space:

```java
long collections = stats.getCollectionFetchCount();   // @OneToMany / @ManyToMany
long entities    = stats.getEntityFetchCount();       // @ManyToOne / @OneToOne
```

Because Hibernate counts *fetches* separately from *loads*
([chunk 6](06-count-do-not-read.md)), a non-zero fetch count means "this many
associations needed their own statement". Which counter is large tells you
whether to go looking for a collection dereference or a to-one — and the to-one
case sends you straight to shape 2 in [chunk 4](04-the-shapes-it-hides-in.md),
where the cause may be an eager mapping and no dereference at all.

## Step 3 · Ask which association

Now name it. The per-role accessors do this without a log:

```java
for (String role : List.of("com.example.Order.lines",
                           "com.example.Order.shipments",
                           "com.example.Customer.addresses")) {
    CollectionStatistics cs = stats.getCollectionStatistics(role);
    System.out.printf("%-40s loaded=%d fetched=%d%n",
            role, cs.getLoadCount(), cs.getFetchCount());
}
```

**`fetched` is the number you want.** A role with `loaded = 20, fetched = 20` is
the culprit; a role with `loaded = 20, fetched = 0` arrived in a join and is
fine.

If you would rather not enumerate roles by hand, `stats.logSummary()` dumps
everything at once, and the entity equivalent is
`stats.getEntityStatistics("com.example.Customer")`.

At this point you know the association. In many cases that is enough — there is
one place in the service that touches `Order.shipments`, and you are done.

## Step 4 · Find the line, when the association is touched in many places

This is the hard case: a widely-used association, or one of the
[chunk 4c](04c-serialization-and-logging.md) shapes where nothing in your code
touches it at all.

### The cheapest trick: a breakpoint on initialisation

The most reliable way to find *which Java line* triggers a lazy load is to stop
the program at the moment it happens and look at the stack. Set a breakpoint on
`org.hibernate.collection.spi.AbstractPersistentCollection#initialize`, or on
your entity's getter, and run the failing test. The stack trace above the
breakpoint is the answer, and it is the answer even when the caller is Jackson or
a generated mapper — which is exactly when no amount of reading finds it.

### Make it an exception instead

A variant that scales better than breakpoints, and works in CI: throw when the
budget is exceeded, so the stack trace comes to you.

```java
public class BudgetedInspector implements StatementInspector {

    private static final ThreadLocal<AtomicInteger> COUNT =
            ThreadLocal.withInitial(AtomicInteger::new);
    private static final ThreadLocal<Integer> BUDGET =
            ThreadLocal.withInitial(() -> Integer.MAX_VALUE);

    public static void budget(int max) { BUDGET.set(max); COUNT.get().set(0); }
    public static void clear()         { BUDGET.remove(); COUNT.remove(); }

    @Override
    public String inspect(String sql) {
        if (COUNT.get().incrementAndGet() > BUDGET.get()) {
            throw new IllegalStateException(
                "statement budget of " + BUDGET.get() + " exceeded by: " + sql);
        }
        return sql;
    }
}
```

Set the budget to the number you expect plus one, run the endpoint, and the stack
trace of the exception points at the exact line that issued the statement over
budget. **This is the single most effective localisation technique in the topic**,
because it converts an invisible bug into a stack trace — the one artefact Java
developers are already expert at reading.

⚠️ It is a diagnostic, not a production guard. A budget that throws in production
turns a slow page into a broken one.

### Correlate the log by request

If you must use the log, make it usable first. `org.hibernate.SQL` at `DEBUG`
carries the MDC ([chunk 5](05-turning-the-sql-on.md)), so with a request id in
the MDC you can extract one request's statements from a concurrent stream. Add
`org.hibernate.orm.jdbc.bind` at `TRACE` and the bind values tell you *which*
parent each statement was for — which usually identifies the loop.

## Step 5 · Decide what the call actually needs

You have the line. Do not reach for a fetch join yet — the choice of fix depends
on what the caller does with the data, and that question is what
[14 · Choosing a fix](14-choosing-a-fix.md) is entirely about.

Ask, in this order:

1. **Does the caller need entities at all,** or does it build a DTO? If a DTO,
   the answer is a projection ([12 · Projections and DTOs](12-projections-and-dtos.md)) and the
   fetch join is the wrong fix.
2. **One collection or several?** One takes a fetch join
   ([chunk 8](08-join-fetch.md)); several will Cartesian-product and want
   subselect or batch fetching ([11 · `@Fetch(SUBSELECT)`](11-subselect.md),
   [10 · `@BatchSize`](10-batch-size.md)).
3. **Is the query paginated?** That used to disqualify the fetch join and no
   longer does on Hibernate 7.4 — see [chunk 8d](08d-pagination.md), which is one
   of the most out-of-date pieces of received wisdom in the ecosystem.
4. **Is this one call site or the general case?** A single call takes an entity
   graph on that method ([9 · Entity graphs](09-entity-graph.md)); a general pattern across
   many call sites may want batch fetching, which composes without a query
   rewrite.

## Step 6 · Lock the number in

Once fixed, write the assertion from
[chunk 6b](06b-asserting-the-count-in-a-test.md) with the new count. Without it
you have fixed one instance of a bug that has no signal, and the next change will
reintroduce it.

## Gotchas

**⚠️ Skipping step 1 and optimising a method that was never N+1.**
A constant 341 statements is a different bug with a different fix. Two runs at
two data sizes cost a minute and save an afternoon.

**⚠️ Assuming the endpoint you were told about is the endpoint with the bug.**
[Chunk 3](03-why-production-is-worse.md): connection starvation makes unrelated
endpoints time out. Measure each candidate rather than trusting the report.

**⚠️ Getting the collection role wrong.**
`getCollectionStatistics` wants owning entity FQN plus dot plus field name. A
wrong role returns zeros rather than an error, which reads as "this association
is fine".

**⚠️ Reading `loaded` instead of `fetched`.**
`loaded` counts materialisation and is high for correctly-fetched associations
too. `fetched` counts the ones that needed their own statement — that is the
number that names the bug.

**⚠️ Leaving a statement budget enabled outside diagnosis.**
It throws. In production it converts a performance problem into an outage, and it
does so on exactly the requests that return the most data, which are usually the
most important ones.

**⚠️ Breakpointing the getter and finding nothing.**
If the association is eager, no getter runs — Hibernate resolved it during query
processing, before your code saw the entity. That is the tell for shape 2 in
[chunk 4](04-the-shapes-it-hides-in.md), and it is why step 2 matters: a high
`entityFetchCount` with no dereference in the code means eager.

**⚠️ Fixing it and not measuring again.**
Some fixes trade one N for another — a `List`-to-`Set` change can introduce the
`hashCode` problem in [chunk 4e](04e-lazy-columns-and-hashcode.md). Re-run the
count.

## Interview questions

**★ Your monitoring says an endpoint issues 341 statements. Walk through finding
the cause.**
First confirm it is actually N+1 by running against two data sizes — a count that
is 341 both times is a different bug, and a count that doubles with the data is
this one. Then ask which kind of association, with `getCollectionFetchCount()`
and `getEntityFetchCount()`: a high collection count sends you to a `@OneToMany`
dereference, a high entity count to a to-one that is either lazy-and-unfetched or
eager-and-unjoined. Then name the specific association with
`getCollectionStatistics(role)`, reading the *fetch* count rather than the load
count, since only fetches needed their own statement. If that still leaves
several candidate call sites, set a breakpoint on collection initialisation or
install a statement-budget inspector that throws when the count is exceeded — the
stack trace names the line, including when the caller is Jackson or a generated
mapper. Only then choose a fix, and finally lock the new count into a test.

**★ Why does the SQL log not tell you which line of Java caused a statement?**
Because by the time the statement is logged, the Java call stack that triggered
it is gone from the log's point of view — the logger records the SQL and whatever
the MDC holds, not a stack. That is fine for the shapes where a grep finds the
dereference, and useless for the shapes where the traversal happens inside a
library: a Jackson serialiser, a Bean Validation walker, a generated mapper. For
those the only thing that names the caller is a live stack, which is why the
breakpoint on collection initialisation and the throwing statement-budget
inspector are the two techniques that always work. The inspector is the more
practical of the two because it works unattended, in CI, and delivers the answer
as an exception rather than requiring somebody to be sitting at a debugger.

**★ What is a statement budget and why is it so effective?**
It is a `StatementInspector` that counts statements per thread against a limit
and throws when the limit is exceeded. Its effectiveness is entirely about the
artefact it produces: it converts a bug with no signal into a Java stack trace,
and a stack trace is the one diagnostic every Java developer is already expert at
reading. Set the budget to the expected count plus one, exercise the endpoint,
and the exception's stack points at the exact line that issued the extra
statement — no log correlation, no guessing, and it works even when the offending
code is inside a framework. The important caveat is that it is a diagnostic and
never a production guard: throwing on statement count in production converts a
slow endpoint into a broken one, and it does so preferentially on the requests
that return the most data.

**★ Why check the count against two different data sizes before doing anything
else?**
Because it distinguishes N+1 from every other reason a method might issue a lot
of statements, and the fixes are completely different. If the count is the same
at both sizes, the method issues a fixed large number — perhaps it runs a query
per field, or calls six repositories — and the remedy is restructuring, not
fetching. If the count scales with the data, it is this bug, and the remedy is a
fetch plan. It takes one minute and it prevents the common failure of adding
fetch joins to a method whose problem was never fetching. It also gives you the
before-number for the test assertion you will write at the end.

**★ Once you have found it, why not immediately add a fetch join?**
Because the fetch join is only right for some of the shapes, and reaching for it
reflexively produces the next problem. If the caller is building a DTO with three
fields, the correct fix is a projection — fetch-joining the graph so a mapper
keeps working means you are still loading entities you do not need. If the caller
needs two collections, a fetch join for both produces a Cartesian product or a
`MultipleBagFetchException`, and the right answer is subselect or batch fetching.
If the pattern recurs across many call sites, batch fetching composes without
rewriting every query. The question that decides it is not "how do I remove this
N+1" but "what does this call actually need", which is why the decision belongs
in its own chunk.

**★ You fixed it, the count dropped, and a week later it is back. What went
wrong?**
Almost certainly that nobody wrote the assertion. The structural property of this
bug is that omitting a fetch plan produces no signal — no error, no exception, no
failing test — so a fix is a one-time correction to code that will keep being
edited by people who have no way to know the fetch plan matters. Locking the
count into an integration test converts the next regression into a build failure
at the moment it is introduced, when it is one commit to look at, rather than
into an incident three months later. The second possibility is that the fix
itself traded one problem for another — changing a `List` to a `Set` to allow two
fetch joins can activate a `hashCode()` that dereferences an association — which
is a good reason to re-measure after any fix rather than assuming it worked.

---

← Prev: [6d · Proxies and agents](06d-proxies-and-agents.md) · Index: [08 · The N+1 problem](README.md) · Next → [8 · join fetch](08-join-fetch.md)
