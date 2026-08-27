---
title: "The other half of the detached list is the operations that read like memory access and go to the database instead — including one Hibernate helper whose javadoc says it does not fetch, and one type test that never throws and simply returns the wrong answer"
sidebar_label: "04c · What looks safe and is not"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` javadoc for `size`, `isEmpty`,
> `contains`, `unproxy` and `getClass`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching* on `instanceof` and
> `@ConcreteProxy`
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the `7.4` source of `org.hibernate.Hibernate` and
> `org.hibernate.collection.spi.AbstractPersistentCollection`, whose `getSize()` and
> `withTemporarySessionIfNeeded()` throw `LazyInitializationException` when the collection has
> no live session
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/collection/spi/AbstractPersistentCollection.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The previous chunk's list is the reassuring half. This is the half that costs afternoons.
Every entry here is an operation that reads, at the call site, like a question about an object
already in memory — how big is this collection, what class is this, print this, unwrap this —
and is in fact a request to the database. One of them has a javadoc sentence that says
outright it does not fetch, and is still unusable when detached, because "does not fetch
state" and "does not need a session" are different properties. And one of them does not throw
at all: it silently returns the wrong answer and your code takes the wrong branch.**
Continues **[04b · What still works detached](04b-what-still-works-when-detached.md)**.

## `collection.size()` is a fetch

`order.getLines().size()` on an uninitialised `PersistentCollection` initialises the entire
collection. It is the most common accidental fetch in Java code, because `size()` reads as a
cheap metadata question and every other `Collection` in the language treats it as one.

`isEmpty()`, `iterator()`, `contains()`, `stream()`, `forEach()`, `equals()` and `hashCode()`
on a persistent collection are all the same. Full treatment in
**[01c · A collection is not a proxy](01c-a-collection-is-not-a-proxy.md)**.

Detached, every one of them throws the collection-flavoured message — a different string from
the proxy message, and the reason it matters is
**[02 · The exception](02-the-exception.md)**.

## 🔴 `Hibernate.size()` does not fetch — and still needs an open session

This one catches careful people, because they read the javadoc and stopped one line early:

> *"Obtain the size of a persistent collection, **without fetching its state from the
> database**."*

That is true and useful: it issues a count rather than materialising the elements, which is
exactly what you want for a `lineCount` field. But the very next line of the same javadoc is
the `@param` tag:

> *"`collection` — a persistent collection **associated with an open session**"*

`Hibernate.size` delegates to `PersistentCollection.getSize()`, which begins by throwing
`LazyInitializationException` if the collection is not connected to a session.
`Hibernate.isEmpty` is implemented as `getSize() == 0` and inherits the same requirement;
`Hibernate.contains` delegates to `elementExists`, which routes through the same
session-or-throw check.

**So these three are a fix for loading too much, not a fix for loading too late.** They belong
inside the transaction, in the mapper, next to everything else that reads. Used outside one
they fail exactly like the plain `size()` they were brought in to replace — which produces a
particularly demoralising bug report, because the change was made *for* this problem.

## `toString()` is usually a fetch

A generated or hand-written `toString` that includes associations dereferences them. This is
the cause behind the whole of
**[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)**, and it is why a
`log.debug("failed for {}", order)` inside an exception handler — running after the
transaction has rolled back — throws a second exception on top of the first and buries the
original.

Lombok's `@ToString` and `@Data` include every field by default, associations included. The
mitigations are in
**[Topic 07 · 15b · No natural key and Lombok](../07-relationships-fetch/15b-no-natural-key-and-lombok.md)**.

## `Hibernate.unproxy` throws rather than returning the proxy

The javadoc: *"If the given object is not a proxy, return it. But, if it is a proxy, ensure
that the proxy is initialized, and return a direct reference to its proxied entity object."*

"Ensure that the proxy is initialized", on a detached uninitialised proxy, means
`LazyInitializationException`. The method is named like a null-safe unwrap and is not one —
and the situation people reach for it in (a proxy in hand, outside a session, wanting the real
object) is precisely the situation where it throws.

The two-argument form `unproxy(Object, Class<T>)` behaves the same way and adds a cast.

## `Hibernate.getClass` initialises by side effect

Its own javadoc says so:

> *"Get the true, underlying class of a proxied entity. This operation will initialize a proxy
> by side effect."*

It is most often reached for inside `equals`, where the intent is to compare types safely. The
effect is that comparing two entities becomes a database round trip inside the session and an
exception outside it. The correct entity `equals` does not need it —
**[Topic 06 · 10b · Fixing entity equality](../06-jpa-hibernate-model/10b-fixing-entity-equality.md)**.

Note the asymmetry with plain `obj.getClass()`, which returns the generated proxy class
without initialising anything — and therefore gives you a class that is not the entity class.
One of the two lies and the other fetches. Neither is what the caller wanted.
**[01b · Type questions are fetches](01b-type-questions-are-fetches.md)** works through the
whole family.

## `instanceof` and a cast do not throw — they lie

The introduction's gotcha 2, verbatim:

> *"For a polymorphic association, Hibernate does not know the concrete type of the referenced
> entity when the proxy is instantiated, and so operations like `instanceof` and typecasts do
> not work correctly when applied to a proxy."*

🔴 **This is the only failure in this topic with no exception at all.** A detached proxy for
`Payment` answers `false` to `p instanceof CardPayment` even when the row is a card payment,
your `else` branch runs, and nothing anywhere records that a decision was made on false
information. There is no stack trace to grep for, no failed request, no alert — just a wrong
answer that survives until somebody reconciles a report by hand.

Hibernate's own remedy, and its own reservation about it:

> *"The `@ConcreteProxy` annotation solves gotcha 2, but at the cost of performance (extra
> joins), and so its use is not generally recommended, except in very special circumstances."*

The durable fix is the same one as everywhere else in this topic: do not hand a proxy to code
that needs to know what it is. A DTO carrying a discriminator value cannot be wrong about its
own type.

## A lazy basic attribute throws a differently worded exception

If bytecode enhancement is in play, reading an unfetched `@Basic(fetch = LAZY)` column on a
detached entity throws a `LazyInitializationException` whose message is neither the proxy
message nor the collection message — a third string most people have never seen, which makes
it hard to search for. That is
**[08 · Lazy basic attributes](08-lazy-basic-attributes.md)**.

## Where this leaves you

Read the two chunks together and the shape of the correct fix is already visible: **the safe
operations are all reads of values that are already in memory, and the unsafe ones are all
attempts to reach further into the graph.** A type containing only the first kind cannot fail.
That is **[05 · The DTO boundary](05-the-dto-boundary.md)**.

But first, one more thing has to be cleared out of the way — the assumption that the
transaction boundary is where the `@Transactional` annotation appears to put it. It very often
is not: **[04d · The boundary is not where you think](04d-the-boundary-is-not-where-you-think.md)**.

## Gotchas

**★ `Hibernate.size()` is safe against initialisation and unsafe against detachment.** The
javadoc sentence everyone quotes — "without fetching its state from the database" — is about
materialising elements. The `@param` tag one line later says "associated with an open
session". Using it on a detached collection throws exactly like `size()` does.

**★ `size()` and `Hibernate.size()` are one word apart in a diff and have opposite
trade-offs.** One initialises the collection and then works forever; the other never
initialises and never works detached. Reviewing a change between them requires knowing both
facts, and the change is usually made by someone who knows one.

**★ `instanceof` on a detached proxy does not throw — it returns the wrong answer.** Every
other item in this topic fails loudly. This one takes the `else` branch and ships. It is the
only lazy-loading failure that cannot be found by grepping logs, and the only one that can
corrupt data rather than just fail a request.

**★ `Hibernate.unproxy` is not a safe unwrap.** It is named like one. On a detached
uninitialised proxy it throws `LazyInitializationException`, which is exactly the situation
people call it in.

**★ `Hibernate.getClass` and `obj.getClass()` are both wrong, in opposite directions.** The
first fetches by documented side effect; the second returns the generated subclass without
fetching. An `equals` that uses either is broken for proxies — one by cost, one by result.

**★ A `toString()` in a catch block is the worst place this can happen.** The transaction has
already ended, so the log statement throws while handling the original failure, and the stack
trace you receive is about the logging, not the bug.

**★ "It worked when I called `size()` in the debugger" is not evidence.** The debugger
evaluated it while a session existed, or it initialised the collection, and now the object is
safe forever. See
**[03c · Something initialised it first](03c-something-initialised-it-first.md)**.

**★ These are all one-liners, so they slip through review.** Adding `.size()` to a log
message, adding `getClass()` to an `equals`, adding a field to a Lombok `@ToString` — none of
these reads as a persistence change, and all of them are.

**★ Reaching for `Hibernate.size` after a `LazyInitializationException` on `size()` is the
single most common wasted fix.** It addresses the wrong axis. If the failure is at the
boundary, the answer is to move the read inside it, not to make the read cheaper.

## Interview questions

**★ `Hibernate.size(collection)` says it works "without fetching its state from the database".
Can you call it on a detached collection?**
No, and the two properties are genuinely different. It avoids materialising the elements — it
issues a count instead of loading the rows — but it still needs a session to issue that count.
The javadoc's `@param` says the argument must be "a persistent collection associated with an
open session", and the implementation delegates to `PersistentCollection.getSize()`, which
throws `LazyInitializationException` when the collection is not connected. It is a fix for
loading too much, not for loading too late.

**★ Which lazy-loading failure produces no exception at all?**
`instanceof` and casts against a polymorphic proxy. Hibernate does not know the concrete
subtype when it builds the proxy, so the proxy is an instance of a generated subclass of the
declared type and nothing else. A type test that should match returns `false`, the code takes
the wrong branch, and there is no log line, no stack trace and no failed request — just a
wrong answer. `@ConcreteProxy` solves it by adding joins, which Hibernate documents as not
generally recommended.

**★ Why is `Hibernate.getClass` dangerous in an `equals` implementation?**
Because its javadoc states that it initialises a proxy by side effect. So comparing two
entities — something the JDK calls implicitly from `HashSet.add`, `Map.get` and
`List.contains` — becomes a database round trip when either side is an uninitialised proxy,
and an exception when either side is detached. A correct entity `equals` compares a stable
business key or an assigned identifier and never asks about types at all.

**★ You see `Hibernate.unproxy(order.getCustomer())` in a mapper. What is your first
question?**
Whether the mapper runs inside the transaction. If it does, the call initialises the proxy and
works, and the real question becomes why the customer was not fetched by the query. If it does
not, the call throws — `unproxy` ensures initialisation, and ensuring initialisation without a
session is the exception. Either way the presence of the call is a signal that the fetch plan
and the mapping have been separated.

**★ Someone changes `order.getLines().size()` to `Hibernate.size(order.getLines())` to fix a
`LazyInitializationException`. Will it work?**
No, and it will make the failure harder to explain, because the new call has a javadoc
sentence that appears to promise otherwise. The original error was raised at the boundary — no
session — and the replacement still needs a session. What that change *does* fix is a
different bug: loading ten thousand line rows to compute a number. If both problems are
present, the correct fix is to call `Hibernate.size` inside the transaction, in the mapper,
and put the result in a DTO field.

**★ How would you catch the `instanceof` case, given it never throws?**
Not from logs, because there are none. The two practical routes are to stop the situation
arising — never let a proxy reach code that branches on type, which a DTO carrying an explicit
kind field guarantees — and, where the entity hierarchy really must be navigated in-session, to
compare against `Hibernate.getClass(entity)` or to unproxy explicitly, accepting the fetch.
`@ConcreteProxy` is the mapping-level answer and buys correctness with joins on every load,
which is why Hibernate does not recommend it generally.

{/* FOOTER */}
