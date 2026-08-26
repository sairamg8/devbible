---
title: "The larger group of reasons this exception hides is not that the session stayed open — it is that the field never held a proxy at all, and a null foreign key, an eager default, a small data set or a projection each arrange that independently"
sidebar_label: "03b · It was never a proxy"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 *Common Application Properties* appendix
> entry for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Jakarta Persistence 3.2 specification's `FetchType` defaults and persistence-context
> identity guarantee
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)),
> and `org.hibernate.cfg.TransactionSettings.ENABLE_LAZY_LOAD_NO_TRANS`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Nothing throws unless the field holds an uninitialised proxy. Group A kept the session
open; this group arranges for there to be no proxy in the first place — and it is bigger,
less visible, and completely unaffected by the open-session-in-view setting everybody
reaches for.** Continues **[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**.

## Group B · It was never a proxy

This group is the one people miss, and it is bigger than group A. If the field does not hold
an uninitialised proxy, there is nothing to throw.

### B1 · The association is `EAGER` and nobody chose it

Jakarta Persistence defines `@ManyToOne` and `@OneToOne` as defaulting to
`FetchType.EAGER`. So an association with no `fetch` attribute is already loaded by the time
you get the entity, and it can never produce this exception. That means:

**The exception only ever appears on the associations someone explicitly made lazy.** A
codebase where nobody has thought about fetching is a codebase where this exception is rare
and the query counts are terrible — and the first `LAZY` added as a performance fix is what
"introduces" the exception. It did not introduce it; it removed the thing that was hiding it.
See **[Topic 07 · 12 · Fetch type defaults](../07-relationships-fetch/12-fetch-type-defaults.md)**.

### B2 · The foreign key is null

🔴 **This one is quietly responsible for an enormous share of "works on my machine".**

If `book.publisher_id` is `NULL`, Hibernate does not build a proxy — there is nothing to
build one from. The field is set to `null`, and `book.getPublisher()` returns `null`. A
serialiser writes `"publisher": null` and moves on. No exception, ever, on that row.

Development fixtures are full of half-populated rows. Production data is not. So an endpoint
can be exercised a hundred times against seed data and fail on the first real record — and
the difference between the two runs is not code, environment or configuration. It is one
column being populated.

The mirror image is just as bad: a bug reproduces only for *some* records, which reads as a
data-corruption problem and is actually a fetch-plan problem that only manifests where the
data is complete.

### B3 · The target entity is already managed

The persistence context guarantees at most one managed instance per identity. So if
`Publisher#7` was already loaded in this session — by an earlier query, by a previous
iteration of a loop, by a validator, by anything — then a `Book` whose `publisher_id` is 7
gets **the managed instance in the field, not a proxy**. Reading it afterwards is a plain
field read, detached or not. The identity map and what it guarantees are
**[Topic 06 · 11 · The persistence context](../06-jpa-hibernate-model/11-the-persistence-context.md)**.

This is why the failure is often **order-dependent within a single request**. Load the
publisher first and the book's association is real; load the book first and it is a proxy.
Nothing about the code changed — only the sequence.

It is also why the failure is **cardinality-dependent**. A dev fixture with one publisher and
five books produces four proxies out of five and one real instance; a production data set
with ten thousand publishers produces proxies almost every time. The endpoint that "worked in
staging" was working by coincidence.

### B4 · A different code path fetched it

The same entity is loaded by two repository methods, one of which has a `join fetch` or an
`@EntityGraph` and one of which does not. Exercise the first and everything is initialised;
exercise the second and it is not. The two call sites can be in different controllers,
different service methods, or the same method under a different branch.

⚠️ This makes the failure look like it depends on the *endpoint*, which sends people to read
the controller — where there is nothing to find, because the difference is in a repository
method two layers down.

### B5 · There was no proxy because there was no entity

A projection, a DTO query, an interface projection or a `Tuple` has no associations and no
proxies at all. If part of your application reads through projections and part reads
entities, the projected half is immune and the entity half is not. The projection route is
**[Topic 08 · 12 · Projections and DTOs](../08-the-n-plus-1-problem/12-projections-and-dtos.md)**.

### B6 · The collection is empty

An empty `@OneToMany` still needs initialising to *know* it is empty, so this one is
narrower than it looks — but a serialiser that has already initialised a collection and
found it empty writes `[]` and does not recurse, so **nothing below it is ever visited.**
A dev fixture where every order has zero lines exercises none of the graph beneath the
lines. The first order with a line reaches an entirely unvisited subtree.


A third group remains — the cases where the association really was a lazy proxy and
something else in the request initialised it before your code got there. Those are
**[03c · Something initialised it first](03c-something-initialised-it-first.md)**.

## Gotchas

**★ Null foreign keys make whole rows immune.** An association whose FK is null is a plain
`null` field, never a proxy. Fixtures full of nulls will never reproduce the failure, and the
first complete record will.

**★ The failure is order-dependent within one request.** Whether an association is a proxy
depends on whether its target was already loaded into the persistence context. Reordering two
lines of a service method can create or destroy the bug, with no other change.

**★ It is cardinality-dependent, so staging lies.** A small data set produces many
already-managed instances and few proxies. Scaling the data up scales the number of proxies
up with it, which is why an endpoint that passed load testing on seed data fails on real data
at lower throughput.

**★ `EAGER` associations never throw, which is why adding `LAZY` looks like it broke
something.** The performance fix did not introduce the exception; it removed the thing that
was concealing an unbounded fetch. The mapping was always wrong, and now it says so.

**★ An empty collection ends the walk.** A serialiser that finds `[]` never visits the
subtree below it. Test data where every collection is empty exercises one level of the graph
and no more, so the failure waits for the first non-empty one.

**★ A projection cannot throw this, so a partially projected codebase has a partial
immunity.** Which reads as "the reporting endpoints are fine and the CRUD endpoints are
flaky", and sends people looking for a difference between the two teams rather than a
difference between two access styles.

**★ "It works in staging" is usually a statement about staging's data.** Staging typically
carries a subset restored months ago with the fully populated records scrubbed. That is
precisely the data profile that maximally hides this failure.

**★ Turning open-in-view off does not remove any of group A2, A3 or group B.** Those reasons
are independent of it. A team that flips the property and finds only three failures has not
learned that there are only three; it has learned that only three were reachable with the
data and configuration it tested against.

## Interview questions

**★ An endpoint works for most records and throws for a few. Where do you look?**
At the data, not the code. The overwhelmingly likely cause is that the failing rows have a
populated foreign key and the working ones have `NULL`. A null FK is never a proxy — the
field is plain `null` — so those rows can never throw. The same shape appears with
collections: a row with an empty collection ends the serialiser's walk before it reaches the
subtree that fails.

**★ Why can the same code fail or succeed depending on the order of two lines?**
Because the persistence context holds at most one managed instance per identity. If the
association's target was already loaded — by an earlier query, an earlier loop iteration, a
validator — the field holds that managed instance rather than a proxy, and reading it after
detachment is a plain field read. Load the target first and the code works; load the parent
first and the same code throws.

**★ Why does adding `fetch = LAZY` to fix an N+1 appear to introduce this exception?**
Because `@ManyToOne` and `@OneToOne` default to `EAGER`, and an eager association is loaded
before you ever see the entity, so it cannot throw. The application was already loading data
outside any plan; it just was not failing about it. Making the association lazy converts an
unbounded silent fetch into a loud one, which is an improvement that arrives looking like a
regression — and the correct response is to write the fetch plan, not to revert the `LAZY`.

**★ How would you deliberately construct a data set that maximises your chance of catching
these bugs?**
Every nullable foreign key populated, every collection non-empty, and every parent distinct —
so no association target is already in the persistence context by coincidence. That inverts
each of the three group-B reasons at once. Then run the suite with open-in-view off, and
without wrapping test methods in a transaction. What is left failing is the real fetch-plan
debt.

**★ Is the small dev data set a *cause* of the bug or a *concealer* of it?**
A concealer, and it is worth being precise about why. With three publishers, the second book
you load finds `Publisher#1` already managed, so its association field holds a real instance.
With ten thousand publishers, almost every book gets a proxy. Nothing about the code differs;
the identity map is just hitting far less often. Scaling the data up does not introduce the
proxy, it stops hiding it.

**★ Which of these reasons survive turning open-in-view off?**
All of them except the first. A long-lived `EntityManager`, `enable_lazy_load_no_trans`, an
eager mapping, a null foreign key, an already-managed target, a fetch join on the path you
happened to exercise, a projection, an empty collection — none of those has anything to do
with the interceptor. Flipping the property makes the boundary real; it does not make the
remaining concealers go away, which is why the migration finds failures in waves rather than
all at once.

{/* FOOTER */}
