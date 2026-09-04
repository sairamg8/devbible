---
title: "Reviewing a service method for a lazy leak is four questions asked in a fixed order — what leaves, where the boundary actually is, what the body touched, and what the caller will do with the reference — and the first one finds most of them"
sidebar_label: "09 · The checklist"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — this chunk collects rules established and cited in chunks 01–08c5 of this
> topic; each item links to the chunk carrying the primary source. Spine sources: the Hibernate
> ORM 7.4 *User Guide*, *Introduction* and javadocs
> ([docs.hibernate.org/orm/7.4/](https://docs.hibernate.org/orm/7.4/)), Jakarta Persistence 3.2
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/))
> and the Spring Boot 4.1 reference
> ([docs.spring.io/spring-boot/reference/](https://docs.spring.io/spring-boot/reference/)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2,
> PostgreSQL 18.

**A lazy leak is not a bug inside a method. It is a mismatch between what a method returns and
what the caller is allowed to do with it, and that mismatch is visible in the signature before you
read a line of the body. This is the order to review in, and it is deliberately front-loaded: the
first section catches the majority, and every section after it is for the cases where the
signature was fine and something else moved.**

## 1 · The signature, before anything else

**Does an entity type appear anywhere in the return type?** `Order`, `List<Order>`,
`Page<Order>`, `Optional<Order>`, `Map<Long, Order>`, `Order[]` — all the same answer. The method
is promising the caller a graph whose loaded extent the signature cannot express, the caller cannot
check, and the method cannot guarantee ([04](04-the-detached-entity.md)). Everything else on this
page is a consequence of this line being wrong.

**Does a DTO on the boundary contain an entity field?** Then it is not a DTO; it is an entity
with a wrapper, and the wrapper serialises the entity ([05](05-the-dto-boundary.md)).

**Is the return type an *interface* projection?** A closed one is a value; an open one — anything
with a `@Value` on it — is a proxy that forwards to a target on method invocation, which is a
different promise entirely ([05c](05c-projections-and-generated-mappers.md)).

**Is it `Stream<Order>`?** The stream must be closed and consumed inside the transaction. A
repository method returning one invites exactly the wrong usage
([04e](04e-references-that-outlive-the-method.md)).

**Is it `CompletableFuture<…>`, or is the method `@Async`?** The reference is going to another
thread, which is never safe for a managed or freshly-detached entity
([04e](04e-references-that-outlive-the-method.md)).

**Is it `void`, with the work done by a listener you cannot see from here?** Then the review moves
to the listener, and section 4 applies to whatever it was handed.

**Is it `ResponseEntity<…>` or a `StreamingResponseBody`?** The response body is written after the
handler returns, which is after the transaction ended — and for a streaming body it is written
after the open-session-in-view interceptor has already unbound
([04e](04e-references-that-outlive-the-method.md)).

## 2 · Where the transaction boundary actually is

The annotation tells you where somebody *intended* the boundary to be. Four things move it.

**Is the method called from inside the same class?** Self-invocation goes through `this`, not
through the proxy, so `@Transactional` does not apply — and neither do `readOnly`, `timeout`,
`isolation` or the rollback rules. Open-session-in-view hides this completely in development
([04d](04d-the-boundary-is-not-where-you-think.md)).

**Does anything on the path declare `REQUIRES_NEW`?** Then the inner transaction commits and
detaches its entities while the caller is still inside a transaction — a detached object in the
middle of what looks like an open unit of work
([04d](04d-the-boundary-is-not-where-you-think.md)).

**Is `readOnly = true` being read as "this is safe"?** It changes flush behaviour and gives the
driver a hint. It has no effect on when the session closes or on what is loaded
([04d](04d-the-boundary-is-not-where-you-think.md)).

**Is `merge` being used to repair a detached object you are holding?** It returns a *different*
object; the one you passed is unchanged and still detached
([Topic 06 · 13b](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md)).

**Is there a transaction at all?** A read method with no annotation and no enclosing boundary runs
each repository call in its own transaction, so each entity is detached by the time the next line
runs ([Topic 09 · 9c](../09-spring-data-jpa/09c-the-service-boundary.md)).

## 3 · What the body actually loaded

**Does every association the caller will read appear in the query?** A fetch join, an
`@EntityGraph`, or a second query — the fix is a *fetching* decision made where the query is, and
the fetching mechanisms belong to
[Topic 08 · 14 · Choosing a fix](../08-the-n-plus-1-problem/14-choosing-a-fix.md).

**Is there a `Hibernate.initialize(…)` before the return?** It works, it is one level deep, and it
is a statement that the method knows the caller's fetch plan and is maintaining it by hand
([06](06-fixes-that-are-not-fixes.md)). Treat it as a marker for "this should have been a DTO",
not as a defect on its own.

**Is there a getter call whose only purpose is to warm something up?** `order.getItems().size();`
with the result discarded. Same marker, worse — an optimiser cannot remove it but a reader will
([06](06-fixes-that-are-not-fixes.md)).

**Is the mapping to a DTO inside the transactional method?** It has to be. `page.map(this::toDto)`
applied to the returned `Page` after the method has ended runs the mapper outside the boundary and
throws exactly where the DTO was supposed to help ([05](05-the-dto-boundary.md)).

**Is a reflective copier doing the mapping?** `BeanUtils.copyProperties`, ModelMapper, a generic
`ObjectMapper.convertValue` — each walks the whole graph and initialises everything it finds
([02c](02c-the-mapper-and-the-logger.md), [05c](05c-projections-and-generated-mappers.md)).

**Is there a `log.debug` or a `log.trace` interpolating an entity?** Logging is data access. The
behaviour of the method now depends on the log level of the environment it runs in
([02c](02c-the-mapper-and-the-logger.md)) — and after enhancement that is true for plain columns
too ([08c3](08c3-the-entitys-own-methods.md)).

**Does anything put entities into a `Set` or a `Map`, or call `distinct()` or
`Collectors.toSet()`?** All of them hash every element, and hashing calls `hashCode`
([Topic 08 · 4e](../08-the-n-plus-1-problem/04e-lazy-columns-and-hashcode.md)).

## 4 · What escapes, and where it goes

Section 1 asked what the signature returns. This asks what else leaves by a side door.

**Is an entity being put into the HTTP session, a `@SessionScope` bean, or any conversational
state?** The longest-lived version of this bug: an object detached minutes or hours ago, read on a
later request ([04f](04f-references-that-get-stored.md)).

**Is an entity being cached?** A reference cache hands the same detached object to every future
caller, with whatever was loaded on the one request that populated it
([04f](04f-references-that-get-stored.md)).

**Is an entity the payload of an application event?** The listener is now coupled to the
publisher's fetch plan, and an `AFTER_COMMIT` listener that lazily loads *probably works today*,
which is the problem ([04f](04f-references-that-get-stored.md)).

**Is an entity going to a message broker, a webhook or any outbound integration?** Then the ORM
mapping is the wire contract ([04f](04f-references-that-get-stored.md)).

**Is an entity being stored in a field — of a singleton bean, or a static?** That pins the object
and, through it, everything it references ([04f](04f-references-that-get-stored.md)).

The single question that covers this whole section: **can this reference still be read after the
method that produced it has returned?** If yes, it must be a value, not an entity.

## 5 · The entity classes this method touches

**Do `equals`, `hashCode` or `toString` read anything but the identifier and an immutable business
key?** An association is the classic case
([Topic 08 · 4e](../08-the-n-plus-1-problem/04e-lazy-columns-and-hashcode.md)); a lazy column is
the same failure once enhancement is on ([08c3](08c3-the-entitys-own-methods.md)); a generated id
is a correctness bug independent of laziness
([Topic 06 · 10b](../06-jpa-hibernate-model/10b-fixing-entity-equality.md)).

**Is the class annotated `@Data`, `@EqualsAndHashCode` or `@ToString`?** Lombok covers every field
by default, including every association and every lazy column
([Topic 07 · 15b](../07-relationships-fetch/15b-no-natural-key-and-lombok.md)).

**Is there a `@PostLoad`, `@PreUpdate` or entity-listener callback that reads a lazy attribute?**
Under enhancement that fetches on every load or every flush and never raises an error — the one
failure in this whole topic with no symptom except the SQL ([08c3](08c3-the-entitys-own-methods.md)).

**Is any association `EAGER`, and did anyone choose that?** `@ManyToOne` and `@OneToOne` default to
eager. An eager mapping cannot be undone per query and is invisible at the call site
([06b](06b-more-fixes-that-are-not-fixes.md),
[Topic 07 · 12](../07-relationships-fetch/12-fetch-type-defaults.md)).

**Is there a `@Basic(fetch = LAZY)` anywhere in the mapping?** Then the review has a build question
in it: does the enhancer run in the module where this entity is compiled
([08](08-lazy-basic-attributes.md))? Without it the annotation is ignored; with it, section 3 and
the `toString` item above apply to a `String` field.

**Is `@Lob` present because somebody wanted laziness?** It does not provide it, and on PostgreSQL
it changes the column type ([08b](08b-the-lob-reflex-and-the-group.md)).

## 6 · The test that would have caught this

**Is the test method annotated `@Transactional`, or does it extend a base class that is?** Then it
runs inside a session that outlives every assertion, and it cannot fail the way production fails
([03](03-why-it-never-fires-in-dev.md)).

**Does the test assert on the DTO, or on the entity?** Asserting on the entity means the assertion
itself is a fetch, so the test passes because the test is doing the loading
([01b](01b-type-questions-are-fetches.md)).

**Does the fixture have more than one row per collection, and at least one row with a null foreign
key and one with an empty collection?** A single-row fixture with no nulls exercises none of the
paths where this exception hides ([03b](03b-it-was-never-a-proxy.md)).

**Is `spring.jpa.open-in-view` set to `false` in the test profile?** If not, the test environment
has the same amnesty as the development one ([03](03-why-it-never-fires-in-dev.md),
[07](07-turning-open-in-view-off.md)).

## The one-line version

Everything above collapses into a single question you can ask about any method in any codebase:
**does anything that needs a session leave this method?** A session-bound object is a proxy, a
persistent collection, an enhanced entity with an unloaded attribute, an open interface
projection, a `Stream`, or a `Clob`. If none of those cross the boundary, no configuration in the
application can produce this exception, and none of the sections above have anything to find.

## Gotchas

**★ A clean review of the body proves nothing if the signature returns an entity.** The failure
happens in the caller, in code the reviewer of this method never opens. Reviewing service methods
in isolation is precisely how this bug survives review.

**★ The checklist finds nothing on a codebase with open-in-view on.** Every item above describes a
failure that is currently suppressed. The list is a prediction of what will break when the
property is turned off ([07](07-turning-open-in-view-off.md)), not a list of live incidents — which
is an argument for running it *before* the migration rather than during it.

**★ "It has a DTO" is not the same as "the boundary is correct".** A DTO with an entity field, an
open interface projection, or a mapping performed after the transactional method returned all fail
in exactly the way a DTO was supposed to prevent.

**★ Section 5 is about classes, not methods, so it has to be run once per entity, not once per
review.** An `equals` over all fields is a property of the class; it will keep producing findings
in every method that touches it until somebody fixes the class.

**★ Items in section 4 have no compiler-visible signature at all.** Nothing in a method's type
tells you it stashed an entity in a cache or published it in an event. This is the section that
needs a grep across the codebase rather than a read of one file.

**★ A reviewer who has only ever seen `Could not initialize proxy` will not recognise the
enhancement failures.** After the plugin, the message, the class that throws and the thing that is
unloaded are all different ([08c](08c-when-enhancement-is-on.md)). Add the second string to
whatever the team greps for.

## Interview questions

**★ You have five minutes to review a service class you have never seen for lazy-loading problems.
What do you read?**
The method signatures, and nothing else at first. Every lazy-loading failure in a Spring
application comes from a session-bound object outliving its session, so the question that finds
them fastest is which methods hand one to a caller — an entity, a collection of entities, a
`Page` of them, a `Stream`, an open interface projection, or a DTO with an entity inside it. That
one pass identifies the methods worth reading properly. Only after that would I look at where the
transaction boundary really is, because propagation and self-invocation move it, and then at the
body for a `Hibernate.initialize` or a warm-up getter, which are markers that somebody already met
this problem here and patched it.

**★ Why is the return type a better place to look than the body?**
Because the body is usually correct. Inside the transaction, every lazy access works; the code
reads fine and does what it says. The defect is a promise made across the boundary — that whatever
the caller reads will be loaded — which the signature cannot express and the caller cannot verify.
The body can only tell you what happened to be loaded on the day it was written; the signature
tells you what the method is claiming forever. That is also why the fix is a type change rather
than a configuration change.

**★ Your team runs this checklist and finds nothing, and production still throws the exception.
What did you miss?**
Almost certainly section 4 — a reference that escaped by a side door rather than through a return
value. An entity put in the HTTP session, cached by reference, published as an event payload, or
handed to an async method. None of those appear in a signature, so a read of the service class
finds them only by accident, and the grep for them is across the whole codebase rather than in one
file. The other candidate is that the failing path is not the one reviewed: response serialisation
happens after every handler returns, so an endpoint whose service is perfect can still fail in
Jackson if the controller returns the entity.

**★ Does this checklist change if `spring.jpa.open-in-view` is `true`?**
Its meaning changes completely. With the property on, every finding is dormant — the session is
still bound while the view renders, so nothing throws, and running the list produces a page of
issues nobody can reproduce. That is exactly why it is worth running then: the output is the work
list for the migration, gathered before the failures arrive all at once. With the property off,
the same list is a review gate that stops new instances being added.

**★ Which single item on this list would you keep if you could keep only one?**
"Does an entity type appear in the return type." It subsumes most of the others — a method that
returns values cannot leak a proxy, cannot have its mapping run at the wrong time, cannot hand a
graph to a serialiser and cannot be broken by somebody adding a lazy column to the entity later.
It does not cover the side-door escapes in section 4, and it does not fix an `equals` that
dereferences an association, but it is the one rule that turns the whole class of failure from
"something to review for" into "something that cannot happen here".

{/* FOOTER */}
