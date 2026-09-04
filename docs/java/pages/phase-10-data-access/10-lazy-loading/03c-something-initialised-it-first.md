---
title: "The third way this exception hides is the most disorienting: the association really was a lazy proxy, and something else in the same transaction — a log line, a validator, a debugger — initialised it before your code reached it"
sidebar_label: "03c · Something initialised it first"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.Hibernate` javadoc for `initialize`, `isInitialized` and `getClass`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> and the `7.4` source of `org.hibernate.proxy.AbstractLazyInitializer`, whose `initialized`
> flag makes initialisation permanent for the life of the object
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The previous chunk's two groups are static: either the session was still open, or the field
never held a proxy in the first place. This group is dynamic, and it is why the same request
against the same data can behave differently on two runs. The proxy was real, the session did
close, and the reason nothing threw is that some other participant in the transaction — a log
statement, a validator, an audit listener, a security expression, a debugger — dereferenced
the association first. `AbstractLazyInitializer` sets its `initialized` flag once and keeps
it, so a single accidental touch makes the object safe forever, and removing that accident
breaks the program.**

## Why one touch is permanent

The initializer holds an `initialized` boolean and a `target` reference. Once the fetch has
happened, `initialized` is `true` and `target` holds the loaded entity, and neither is ever
reset — detaching the proxy clears the `session` field and leaves both of these alone. So:

**An initialised proxy is safe forever, including after detachment.** That is what makes this
group of causes so effective at hiding the bug. It is not that the exception is being caught
or suppressed; it is that by the time the serialiser walks the graph, there is genuinely
nothing left to fetch.

The same fact read from the other direction appears in
**[01 · What a proxy actually is](01-what-a-proxy-actually-is.md)**: the exception can never
fire twice on the same object, because the first successful access removes the condition.

## The participants that touch your objects without being asked

### 1 · A log line warmed it

A `log.debug("loaded {}", book)` earlier in the same transaction calls `toString()`, which
dereferences the association, which initialises it. Every subsequent access — including the
one after the session closes — reads an initialised proxy and works.

🔴 **So turning logging *down* can make a working application start throwing.** This is the
mirror of the case in
**[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)**, and it is the more
confusing of the two, because the change that "caused" it made the application do *less*.

### 2 · A validator, an audit listener or an interceptor touched it

Bean Validation walking an object graph, an `@EntityListener` building an audit record, a
Spring Security expression reading `book.getPublisher().getOwnerId()`, an event listener,
an APM agent. Any of these running inside the transaction initialises whatever it touches,
and every one of them is invisible from the code that later benefits.

### 3 · The debugger did it

Stepping through with an entity expanded in the variables view calls its getters. The run
under the debugger initialises associations that the run without it does not — so the bug
disappears precisely when you go looking for it. Covered from the API side in
**[01b · Type questions are fetches](01b-type-questions-are-fetches.md)**.

### 4 · An `@EntityListener` or `@PostLoad` callback

A JPA entity callback runs inside the persistence context by definition. A `@PostLoad` that
computes a derived field from an association initialises that association on every single
load — which makes the whole application immune to the failure on that one path, silently,
for as long as the callback exists.

### 5 · A method-security expression

`@PreAuthorize("#book.publisher.ownerId == authentication.name")` evaluates a SpEL expression
against your arguments. If the annotation is on a service method, the expression runs inside
the transaction and initialises the association as a side effect.

⚠️ `@PostAuthorize` is the opposite and it is worth knowing the difference: it runs **after**
the method returns, which on a `@Transactional` service method means after the transaction
has committed. So `@PreAuthorize` hides the bug and `@PostAuthorize` causes one.

### 6 · Bean Validation cascading

`@Valid` on an association, or a class-level constraint that reads one, makes the validator
walk into the target object. Validation typically runs on save, inside the transaction, so
anything it visits comes back initialised for the rest of the unit of work.

### 7 · `equals` and `hashCode` in a collection operation

Adding an entity to a `HashSet`, using one as a `Map` key, or calling `contains` invokes
`equals`, and a correctly written entity `equals` reads the other object through its
accessors. If either side is a proxy, that is a fetch. The full argument is
**[01b · Type questions are fetches](01b-type-questions-are-fetches.md)**; here the point is
only that it initialises, and therefore conceals.

### 8 · Caching the object

A `@Cacheable` method whose return value is serialised into a distributed cache forces the
serialiser to walk the graph — inside the transaction, because the cache write happens as the
method returns. Every association it touches is now initialised for the caller too. This is
the serialiser case from
**[02b · Where it fires](02b-where-it-fires.md)** running early enough to succeed, and it
turns a caching decision into a fetch-plan decision nobody wrote down.

### 9 · An outbox write or a domain event

Building an event payload from the entity — serialising it to JSON for an outbox row, or
handing it to an `@EventListener` that runs before commit — dereferences whatever the payload
includes. The event was added for an unrelated reason and now the read path depends on it.

### 10 · An earlier iteration of the same loop

Not another participant at all, but the same code: the first pass through a loop initialises
`Publisher#7`, and every later book with the same publisher finds a managed instance. So a
loop can be correct for the second and subsequent elements and wrong for the first — or
correct in a data set with repeated parents and wrong in one without.

### 11 · The one that does NOT do it — the second-level cache

Worth stating explicitly because it is a common wrong belief: **a second-level cache does
not save you.** Initialising a proxy requires a session, and the session is what is missing.
Where the data would have come from is irrelevant — a cache hit still needs a persistence
context to load into. An application with a fully warm L2 cache throws exactly as often as
one with a cold cache.

## What actually differs between your machine and production

Collecting the above, the honest list of differences that turn a working endpoint into a
failing one:

| Difference | Which reason it is |
|---|---|
| Config hardened, `open-in-view: false` | the famous one |
| The same service called from a job or a listener | the famous one, by caller |
| Real records have their foreign keys populated | B2 |
| Thousands of distinct parents instead of three | B3 |
| Log level lowered from `DEBUG` to `INFO` | C1 |
| A test suite that wraps everything in a transaction | A1 |
| A `dev` profile carrying `enable_lazy_load_no_trans` | A3 |
| An endpoint reached for the first time with non-empty collections | B6 |

**Not one of these is a code change.** Which is the single most useful thing to know about
this exception: when it appears "out of nowhere", the correct first question is not "what
changed in the code" but "what changed about the data, the configuration or the caller".


## The deliberate version of this is the fix

Every entry above is the *right* operation happening at the *right* time by accident. That
observation is worth turning around, because it is the whole design of the solution:

**Reading everything you need while the session is open is not a hack — it is the correct
shape.** The difference between a `@PostLoad` that accidentally initialises an association
and a mapper that deliberately reads it is not the mechanism; it is whether anyone wrote it
down and whether anyone can change it without knowing.

So the fix is not to remove these touches. It is to make the reading explicit, complete and
located in one place — a mapping step that runs inside the transaction and produces a value
object. That is **[05 · The DTO boundary](05-the-dto-boundary.md)**, and it is why this
chunk is not a list of things to delete.

## Gotchas

**★ Initialisation is permanent and detachment does not undo it.** `unsetSession()` clears
the session reference and leaves `initialized` and `target` alone, so a proxy touched once
inside the transaction is safe for the rest of its life. That is the mechanism behind every
entry on this page.

**★ Removing a log statement can break production.** The statement was initialising the
association. Deleting it, or raising the level above it, is a change that touches no
persistence code and breaks the read path. This is the same fact as the `DEBUG`-only failure
in **[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)**, running the other
way round.

**★ `@PreAuthorize` conceals and `@PostAuthorize` causes.** One evaluates before the method
runs, inside the transaction; the other after it returns, outside. Swapping one for the other
during a security review is a persistence change that nobody will describe as one.

**★ A `@PostLoad` callback that reads an association makes the whole application immune on
that path.** And it does so at the cost of an unconditional extra fetch on every load, which
is a performance problem the exception would have warned you about.

**★ Caching a return value serialises it.** A `@Cacheable` annotation added for speed
performs a full graph walk inside the transaction. It hides the boundary bug and adds an
unbounded fetch, in one line, with no mention of either.

**★ The first element of a loop behaves differently from the rest.** The identity map makes
subsequent iterations hit an already-managed target. A bug reproducible only on the first
record of a batch is very often this.

**★ Debugging changes the result, so "I cannot reproduce it in the debugger" is expected.**
Expanding an entity in the variables view initialises it. The act of looking removes the
condition you were looking for.

**★ A second-level cache does not prevent the exception.** Initialising a proxy needs an open
persistence context to load into; where the row comes from once you have one is irrelevant. A
fully warm cache throws exactly as often as a cold one, and this is believed otherwise often
enough to be worth checking whenever caching is proposed as the fix.

**★ These causes are invisible to code review of the failing file.** The line that saves you
is in a listener, an annotation, a security expression or a logger — usually in a different
class, often written by a different team, always for a different reason.

**★ They interact with each other.** A validator initialises the association, which makes an
`equals` call cheap, which makes a `HashSet` insertion safe. Remove the validator and three
apparently unrelated things fail. The dependency graph between these touches is not written
down anywhere.

**★ None of them is stable across versions.** Whether a framework touches your entity is an
implementation detail of that framework. An upgrade that changes when validation runs, or
what a security expression evaluates, can turn a working endpoint into a failing one with no
change on your side.

## Interview questions

**★ Why can an application work for months and then throw this exception after a change that
had nothing to do with persistence?**
Because something in the transaction was initialising the association as a side effect and
that something was removed or reordered. A log statement whose level was raised, a validator
that stopped cascading, a `@Cacheable` that was dropped, a security expression rewritten from
`@PreAuthorize` to `@PostAuthorize`. Initialisation is permanent for the life of the object,
so a single accidental touch was making the whole read path safe. The change did not
introduce the bug; it removed the accident that was covering it.

**★ Why does a proxy that has been initialised keep working after detachment?**
Because detaching clears the initializer's `session` reference and nothing else. The
`initialized` flag stays `true` and the `target` field still holds the loaded entity, so
subsequent method calls are delegated to a real object with no fetch involved. Detachment
removes the *ability* to fetch, not the *result* of a fetch that already happened.

**★ What is the difference between `@PreAuthorize` and `@PostAuthorize` for this exception?**
`@PreAuthorize` evaluates before the method body, so on a `@Transactional` service method it
runs inside the transaction — any association its expression reads is initialised, and the
bug is hidden. `@PostAuthorize` evaluates after the method returns, which on the same method
is after commit, so its expression is dereferencing detached objects and it *causes* the
exception rather than concealing it. Two annotations one word apart with opposite effects on
persistence.

**★ A bug reproduces on the first record of a batch and not the rest. Explain.**
The identity map. The first iteration loads the association target and puts it in the
persistence context; every later record that points at the same target gets the managed
instance rather than a proxy. So only the first pass is exercising the proxy path. The same
thing appears in reverse in data sets where every parent is distinct, where every record is
the "first" one.

**★ A colleague says the fix is to add `Hibernate.initialize` calls where these accidents
used to be. What is wrong with that?**
Nothing about the mechanism and everything about the design. It reproduces the accident
deliberately, one association at a time, with no statement anywhere of what a given operation
needs loaded — so the next association added to the entity is a new bug, and the next caller
that needs a different subset is unserved. It also puts fetch decisions in the service body
rather than in the query. The performance side of that argument is
**[Topic 08 · 17 · Initialize loops](../08-the-n-plus-1-problem/17-initialize-loops.md)**; the
correctness side is **[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md)**.

**★ You add `@Cacheable` to a service method and an unrelated endpoint starts working. Why?**
Because the cache serialises the return value inside the transaction, walking the whole object
graph and initialising every association it reaches. The objects handed to the caller are now
fully loaded, so downstream code that used to throw does not. You have bought correctness with
an unbounded fetch on every cache miss, and you will lose it again the day someone configures
the cache to store a reference rather than a serialised copy.

**★ Is any of this a reason to leave the accidental touches in place?**
No, but the conclusion is not "delete them" either. Each one is the right operation at the
right time happening for the wrong reason. The fix is to make the reading deliberate: one
mapping step, inside the transaction, that reads everything the operation needs and produces
a value object. Then the touches can be removed on their own merits, because nothing depends
on them any more.

**★ Why does this group make bisecting so unreliable?**
Because the commit that "introduced" the failure is the one that removed a concealer, and it
can be arbitrarily far from the commit that introduced the real fetch-plan gap. Bisect lands
you on a logging change or a validation tweak, which reads as a false positive and is not —
it is a true positive for the wrong bug.

**★ How would you find these before they bite you?**
Not by reading the failing code, because the concealer is elsewhere. Run the path with the
persistence context closed — open-in-view off, tests non-transactional — and see what fails.
That removes every concealer in this group at once, because none of them survives the object
being detached before the read. Anything still passing is passing on its own merits.

{/* FOOTER */}
