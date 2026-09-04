---
title: "A Hibernate.initialize loop is the N+1 written out by hand and given a reassuring name — but the class it comes from also holds the methods that make the loop unnecessary"
sidebar_label: "17 · Initialize loops"
sidebar_position: 57
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` javadoc for `initialize`,
> `isInitialized`, `size`, `isEmpty`, `contains`, `get`, `isPropertyInitialized` and
> `unproxy`
> ([docs.jboss.org/hibernate/orm/7.4/javadocs/](https://docs.jboss.org/hibernate/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> and the Hibernate ORM 7.4 *User Guide* §12.8 *Batch fetching* and §31.6.1 *Fetching
> associations*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**`Hibernate.initialize` is a legitimate API with a documented purpose, and wrapping it in a
loop over a list of parents produces exactly the statement pattern this whole topic is about
— with the added property that it now looks deliberate. The method is not the problem. The
loop is, and only when nothing has been done to make the loads batch. What almost nobody
knows is that the same class carries `size`, `isEmpty`, `contains` and `get`, which answer the
questions the loop was usually asking without fetching anything.**

## The shape

```java
@Transactional(readOnly = true)
public List<OrderDetail> load(List<Long> ids) {
    List<Order> orders = orderRepository.findAllById(ids);
    for (Order order : orders) {
        Hibernate.initialize(order.getLines());     // ← one select per order
    }
    return orders.stream().map(OrderDetail::from).toList();
}
```

This is [1 · 101 queries](01-one-hundred-and-one-queries.md) with an explicit method call in
place of an implicit dereference. One statement for the orders, one per order for the lines.
The count is identical to the version without the loop; the only thing the loop changed is
*where* the queries happen — inside the transaction rather than during rendering.

**That relocation is worth something and it is not a performance fix.** It makes the code work
with open-session-in-view off ([15c · Turning it off](15c-turning-it-off.md)), and it makes the
loads visible to a profiler that spans the service method. Both are real. Neither reduces the
statement count by one.

The reason it survives review is the vocabulary. `Hibernate.initialize` reads like a framework
operation — deliberate, sanctioned, the opposite of an accidental dereference — and the loop
reads like preparation rather than data access. Compare it with the version everyone recognises
as a bug:

```java
for (Order order : orders) {
    order.getLines().size();       // same statements, obviously wrong
}
```

They are the same code. Only one of them looks like it.

## Its variants

Several idioms are this loop with the call hidden:

```java
orders.forEach(o -> o.getLines().size());
orders.forEach(o -> new ArrayList<>(o.getLines()));
orders.forEach(o -> o.getLines().forEach(OrderLine::getProduct));
orders.forEach(o -> log.debug("order {} has {} lines", o.getId(), o.getLines().size()));
```

The last one is the meanest, because it disappears when the log level is raised — so the
endpoint is fast in production and slow in staging, or the other way round after someone edits
a logging config. [4c · Serialisation and logging](04c-serialization-and-logging.md) covers
that shape in general.

## What `initialize` does and does not do

The javadoc is short and every clause matters:

> *"Force initialization of a proxy or persistent collection. In the case of a many-valued
> association, **only the collection itself is initialized. It is not guaranteed that the
> associated entities held within the collection will be initialized.**"*

So `Hibernate.initialize(order.getLines())` loads the lines. It does **not** load each line's
`product`. The deepest and largest term of the report's count in
[14c · Worked: the report](14c-the-report.md) — one statement per line — is untouched by an
initialize loop over the parents, which is why the loop so often halves a problem and leaves
people confused about why it is still slow.

It also throws rather than degrading: `HibernateException` "if the proxy cannot be initialized
at this time, for example, if the `Session` was closed". Calling it on a detached entity is not
a way to reattach anything.

## When the loop is right

There is a real case, and it is the one the user guide itself demonstrates. §12.8's batch
fetching example is **a loop over already-loaded `Department` entities touching
`department.getEmployees()`** — presented not as an anti-pattern but as the way to exercise
`@BatchSize`. The mechanism explains why: batching assembles the batch from proxies that are
already loaded into the current persistence context and still uninitialised, so touching them
in a loop is precisely what lets Hibernate satisfy many of them with one `IN` statement.

**So the loop is only an N+1 when nothing has been done about batching.** With `@BatchSize` on
the association, or `hibernate.default_batch_fetch_size` set, the same loop produces a small
fixed number of statements. The code is unchanged; the mapping decided what it costs.

That is a genuinely useful thing to know in review, and it inverts the usual advice: seeing
`Hibernate.initialize` in a loop is not enough to call it a bug. **Check the mapping before you
call it.** What makes it a bug is the loop plus an unbatched, unfetched association.

The other legitimate use is the one §31.6.1 names, where you deliberately want several
collections loaded by separate statements rather than one cartesian join: *"If you need to
fetch multiple collections, to avoid a Cartesian Product, you should use secondary queries which
are triggered either by navigating the `LAZY` association or by calling
`Hibernate#initialize(Object proxy)` method."* Note what that recommends — secondary queries per
*collection*, for one parent, which is a fixed small number. It is not a recommendation to loop
over parents.

## The methods that make the loop unnecessary

The `Hibernate` class carries a set of operations most people never meet, and each one answers a
question that is otherwise answered by loading everything:

| Method | Since | What the javadoc says |
|---|---|---|
| `Hibernate.size(Collection)` | 6.1.1 | obtain the size "without fetching its state from the database" |
| `Hibernate.isEmpty(Collection)` | 7.0 | determine emptiness "without fetching its state from the database" |
| `Hibernate.contains(Collection, T)` | 6.1.1 | membership "without fetching its state from the database" |
| `Hibernate.get(Map, K)` | 6.1.1 | one value by key, without fetching the map |
| `Hibernate.get(List, int)` | 6.1.1 | one element by index, without fetching the list |

```java
int lineCount = Hibernate.size(order.getLines());        // not order.getLines().size()
boolean any    = !Hibernate.isEmpty(order.getPayments());
```

**`order.getLines().size()` materialises every `OrderLine`. `Hibernate.size(order.getLines())`
does not.** That is the difference between fetching a page of orders' worth of line entities and
asking the database a question — and it is the single most useful thing on this page for the
list-page shape in [14b · Worked: the list page](14b-the-list-page.md), where the entire N+1 on
`lines` existed to produce a count.

Two honest caveats. These still issue a statement per call, so they are a fix for *volume*, not
for *count* — a loop over a page of parents calling `Hibernate.size` is still one statement per
parent, and a projection that counts in SQL remains the better answer when you control the query.
And they require "a persistent collection associated with an open session"; on a detached entity
they are not applicable.

There are two more worth knowing for the defensive case:

- **`Hibernate.isInitialized(proxy)`** — "determines if the given proxy or persistent collection
  is initialized", equivalent to `PersistenceUtil.isLoaded`. This is how a serialiser or a mapper
  asks "was this fetched?" instead of fetching it. A DTO mapper that writes
  `Hibernate.isInitialized(o.getLines()) ? map(o.getLines()) : null` cannot cause an N+1, which
  makes it a reasonable safety net on a shared mapper — and a poor substitute for deciding the
  fetch plan.
- **`Hibernate.isPropertyInitialized(entity, attribute)`** — the same question for a single
  attribute, which is what you need under bytecode enhancement where laziness is per-field
  ([13d · Lazy groups and the cost](13d-lazy-groups.md)).

And a related trap the same javadoc documents: with a proxy and no bytecode enhancement, the
proxy "does not have the same concrete type as the proxied delegate, and so `getClass(Object)`
must be used in place of `Object.getClass()`, **and this method fetches the entity by side
effect**". `Hibernate.getClassLazy` exists since 6.3 to avoid that where the type has no
subclasses. An `instanceof` check or a `getClass()` comparison inside a loop over proxies is
therefore another N+1 with no data access anywhere in sight.

## Gotchas

**★ `Hibernate.initialize(collection)` does not initialise the entities inside the
collection.** The javadoc says so explicitly. The nested level — line to product — is untouched,
which is usually the largest term.

**★ The loop is not a bug on its own; the loop plus no batching is.** The user guide's own batch
fetching example is this loop. Read the mapping before writing the review comment.

**★ It makes the queries happen inside the transaction, which is an improvement, and people
mistake that for the fix.** Working with OSIV off is a correctness property. The count is
unchanged.

**★ `getLines().size()` and `Hibernate.size(getLines())` look equivalent and are not.** One
materialises the collection; the other is documented to obtain the size without fetching its
state.

**★ The logging variant changes behaviour with log level.** A `log.debug` that dereferences a
collection is an N+1 that exists only when debug is on — or, worse, only when it is off, if
someone "optimised" by moving work out of the guard.

**★ `Hibernate.getClass(proxy)` fetches by side effect.** So does `isInstance`. Type checks in a
loop over proxies are silent loads; `getClassLazy` avoids it where it can.

**★ `initialize` throws on a closed session rather than doing nothing.** It is not a repair
mechanism for a detached graph, and using it as one produces a `HibernateException` rather than
the lazy-loading exception you were trying to avoid.

**★ An `isInitialized` guard in a mapper hides missing fetch plans.** It genuinely prevents
N+1s, and it does so by silently returning less data than the caller expected — a response with
`lines: null` because nobody fetched them is a correctness bug wearing a performance fix.

## Interview questions

**★ Is `Hibernate.initialize` in a loop an N+1?**
It produces the same statements, yes — one per parent — so by count it is identical to the
implicit dereference. Whether it is a *bug* depends on the mapping: if the association carries a
`@BatchSize`, that loop is exactly how batching is triggered, and it is the shape the Hibernate
user guide itself uses to demonstrate batch fetching. Without batching it is the textbook N+1
with a reassuring method name on it. The thing that makes it dangerous is that it reads as
deliberate, so it survives review in a way that `getLines().size()` in a loop does not.

**★ What does `Hibernate.initialize` actually guarantee?**
That the proxy or collection you passed is initialised, and nothing beyond that. The javadoc is
explicit that for a many-valued association "only the collection itself is initialized. It is not
guaranteed that the associated entities held within the collection will be initialized" — so
initialising an order's lines leaves every line's product a proxy. That is why an initialize loop
frequently removes one level of an N+1 and leaves a larger one underneath, and why the fix
appears not to have worked.

**★ You need the number of lines on each of 25 orders. What do you write?**
A projection with `count` in the query, because the database can answer it in the same statement
that fetches the page. If the entities are already loaded and I only need the number,
`Hibernate.size(order.getLines())` is the right call rather than `getLines().size()` — it is
documented to obtain the size without fetching the collection's state, so it costs a statement
instead of a materialised collection. What I would not write is `getLines().size()`, which loads
every line of every order to produce twenty-five integers.

**★ When is `Hibernate.isInitialized` the right tool?**
In generic code that must not trigger loading — a shared DTO mapper, a custom serialiser, a
diagnostic. It lets that code ask whether the data is present rather than demanding it, which is
the difference between a mapper that is safe at every call site and one that N+1s at some of
them. It is not a substitute for a fetch plan: a mapper that quietly emits null for an
uninitialised association turns a missing fetch plan into missing data in the response, which is
harder to notice than an exception and worse than either.

**★ Why does the user guide recommend `Hibernate.initialize` in one place and this topic warn
about it in another?**
Because the guide recommends it for a different shape. Its advice is that when you need several
collections for a parent, secondary queries — triggered by navigation or by
`Hibernate#initialize` — are better than one fetch join producing a cartesian product. That is a
fixed, small number of statements for one parent. The anti-pattern is looping over *parents*,
where the same call multiplies by the row count. Per-parent, initialize is a tool for choosing
several small statements over one huge one; per-row, it is the bug.

**★ Someone shows you a service that calls `Hibernate.initialize` on every association before
returning. Good or bad?**
Bad, but for a subtler reason than the statement count. It is an attempt to make an entity safe
to hand to an unknown consumer, which means the boundary is wrong — something outside the service
is deciding what data it needs by navigating an object graph. The fix is to return a DTO whose
shape *is* the contract, at which point there is nothing to initialise and nothing to guess.
Eagerly initialising everything is the same instinct as mapping everything `EAGER`
([16 · EAGER is not a fix](16-eager-is-not-a-fix.md)), expressed at the service layer instead of
the mapping.

**★ What is the difference between `Hibernate.isInitialized` and
`Hibernate.isPropertyInitialized`?**
Granularity, and which era of laziness you are in. `isInitialized` asks whether a proxy or a
persistent collection has been loaded, which is the proxy-based model — the unit is a whole entity
or a whole collection, and the javadoc notes it is equivalent to `PersistenceUtil.isLoaded`.
`isPropertyInitialized` asks whether one attribute of an entity instance has been loaded, which is
the question that only makes sense under bytecode enhancement, where a fully-materialised entity
can still have unfetched fields. If your model uses lazy basic columns, the coarse check will tell
you the entity is initialised while the column you care about is not.

**★ A code review shows `Hibernate.initialize` inside a stream. What do you check before
commenting?**
The mapping, and then the parent count. If the association has a `@BatchSize` — or the application
sets `hibernate.default_batch_fetch_size` — the loop is how batching gets exercised, and the user
guide's own batch fetching example has exactly this shape, so a comment calling it an N+1 would be
wrong. Without batching, and with the loop running over a page or an unbounded set of parents, it
is the textbook case. And in either case I would check whether the initialisation goes deep enough,
because the javadoc is explicit that initialising a collection does not initialise the entities
inside it — which is usually where the largest term is hiding.

---

← Prev: [16 · EAGER is not a fix](16-eager-is-not-a-fix.md) · Index: [08 · The N+1 problem](README.md) · Next → [17b · The second-level cache](17b-the-second-level-cache.md)
