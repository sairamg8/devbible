---
title: "The other half of the differential produces no Hibernate exception at all — an empty JSON object, a null association, a driver error from a LOB locator — which is why these arrive as frontend bugs, data bugs and database bugs and never as persistence tickets"
sidebar_label: "09b2 · Symptoms with no exception"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.2.47 *Handling LOB data*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `2.19` source of `com.fasterxml.jackson.databind.ser.impl.UnknownSerializer`
> ([github.com/FasterXML/jackson-databind](https://github.com/FasterXML/jackson-databind/blob/2.19/src/main/java/com/fasterxml/jackson/databind/ser/impl/UnknownSerializer.java)),
> and the Jakarta Persistence 3.2 `FetchType` and `OneToOne` javadocs
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2,
> PostgreSQL 18.

**[09b](09b-symptom-to-chunk.md) covered the symptoms that at least announce themselves as
persistence failures — a Hibernate or Jakarta exception type, with an entity name in the message.
These three do not. They produce a wrong response, a null, or an error whose text contains no
persistence vocabulary whatsoever, so they get filed against the frontend, against the data, or
against the database driver. All three are the same lifetime mistake as the rest of this topic,
and none of them will be found by grepping for `LazyInitializationException`.**

## A serialiser that produces `{}`, or recurses forever

Two different failures that both look like "Jackson broke".

**`{}` — no properties discovered.** Jackson's fallback for a type it can build no bean serialiser
for is `UnknownSerializer`, which extends `ToEmptyObjectSerializer`. With
`SerializationFeature.FAIL_ON_EMPTY_BEANS` enabled it reports:

> *"No serializer found for class %s and no properties discovered to create BeanSerializer (to
> avoid exception, disable `SerializationFeature.FAIL_ON_EMPTY_BEANS`)"*

and with it disabled it writes `{}`. In a lazy-loading context there are two ways to arrive here:
a class whose every property was suppressed — usually because `@JsonIgnore` was applied to each
association in turn as a fix ([06c](06c-jackson-and-the-hibernate-module.md)) — and a value object
with no accessible getters at all. **Neither is a laziness failure**; the second is a Jackson
configuration issue and the first is the end state of using `@JsonIgnore` as the answer.

**Infinite recursion.** A bidirectional association serialised in both directions; the serialiser
walks parent → child → parent until the stack ends. This has nothing to do with fetching — an
entirely eager graph does it just as reliably — and it is
**[Topic 07 · 16 · Serialising an entity graph](../07-relationships-fetch/16-serialising-an-entity-graph.md)**,
which also covers why each annotation that patches it is a worse answer than a DTO.

The reason both land in lazy-loading tickets is that all three failures — the recursion, the empty
object and `LazyInitializationException` — are produced by the same decision: serialising an entity.

## A null where a proxy was expected

"The association is null, so lazy loading must have failed." It did not; there was never a proxy.
Two independent causes:

- **The foreign key is null.** Hibernate cannot hand you a proxy for a row that is not referenced,
  so the field is plain `null` and always was. Rows like this are immune to
  `LazyInitializationException` entirely, which is one of the ways this bug hides in a small data
  set ([03b · It was never a proxy](03b-it-was-never-a-proxy.md)).
- **It is the inverse side of a `@OneToOne`.** Hibernate has to query to find out whether the
  reference is null, so it cannot return a proxy and does not try — the association is fetched
  eagerly whatever the mapping says
  ([Topic 07 · 6b](../07-relationships-fetch/06b-why-lazy-one-to-one-fails.md),
  [Topic 08 · 4d](../08-the-n-plus-1-problem/04d-the-ones-you-cannot-make-lazy.md)).

The tell that separates them from a real lazy failure: a real one **throws**. A `null` is a
statement about the data or the mapping, never about the session.

## A LOB locator used after commit

The symptom is a driver-specific exception — not `LazyInitializationException`, not any Hibernate
type — raised when reading a `java.sql.Clob` or `java.sql.Blob` field of an entity after its
transaction ended. The user guide states the constraint:

> *"These types represent references to off-table LOB data. In principle, they allow JDBC drivers
> to support more efficient access to the LOB data. … However, `java.sql.Blob` and `java.sql.Clob`
> can be unnatural to deal with and suffer certain limitations. For example, **it's not portable to
> access a LOB locator after the end of the transaction in which it was obtained.**"*

**It is the same lifetime bug with none of the same diagnostics.** Nothing about a `Clob` is a
Hibernate proxy, so no Hibernate machinery notices, no Hibernate exception is raised, and the
failure text is whatever your driver says. Route it to
[08b · The `@Lob` reflex and the lazy group](08b-the-lob-reflex-and-the-group.md), and treat the
presence of a locator type on an entity that leaves a transaction as the defect.

## An empty collection where the database has rows

No exception, no null, no log line — just a `[]` in a response or an `isEmpty()` that returns
`true` while `select count(*)` says otherwise. Three separate mechanisms produce it, and only one
of them is about fetching:

- **The field was reassigned.** `order.setItems(new ArrayList<>(newItems))` replaces Hibernate's
  persistent collection with a plain one, and with it goes the change tracking the persistent
  wrapper provided ([01c](01c-a-collection-is-not-a-proxy.md)). Subsequent reads are of your list,
  not of the database's rows.
- **It really is empty, and that ended the walk.** A serialiser that finds `[]` never visits the
  elements, which is one of the ways this topic's exception hides in a small data set
  ([03b](03b-it-was-never-a-proxy.md)).
- **The query filtered it.** An inner join in a derived query name drops rows whose association is
  null ([Topic 09 · 2d](../09-spring-data-jpa/02d-property-paths-and-ambiguity.md)); a fetch join
  with a `where` clause on the child restricts the collection to the matching children
  ([Topic 08 · 8b](../08-the-n-plus-1-problem/08b-what-a-fetch-join-breaks.md)).

The one thing an empty collection is **not** is an uninitialised one. An uninitialised persistent
collection is never `null` and never reports itself as empty without fetching first — calling
`isEmpty()` or `size()` on it issues the `select` ([01c](01c-a-collection-is-not-a-proxy.md)). If
you are looking at an empty collection with the session closed, the fetch already happened and it
came back with nothing.

## A lazy column that reads as `null` rather than throwing

Under bytecode enhancement, a lazy basic attribute on a detached entity throws
([08c](08c-when-enhancement-is-on.md)). If it returns `null` instead, the entity has been through
a Java-serialisation round trip: the interceptor field the enhancer added is `transient`, so it is
gone, and the generated reader's null check falls through to the raw field
([08c5](08c5-serialising-an-enhanced-instance.md)).

**This is the only symptom in the whole topic where the loud failure has been replaced by a quiet
wrong answer by accident rather than by configuration.** Anything that puts entities into an HTTP
session, a distributed cache or a message payload is on the path
([04f](04f-references-that-get-stored.md)).

## Everything works and the SQL is enormous

The mirror image of this topic, and the reason it never arrives as a lazy-loading ticket: nothing
fails. The response is correct, the tests pass, and six weeks later somebody reports that an
endpoint is slow.

- **One statement per row of a result** — N+1, which is
  [Topic 08](../08-the-n-plus-1-problem/README.md) in its entirety.
- **One wide statement** — an eager mapping, or a lazy column that was never enhanced
  ([08](08-lazy-basic-attributes.md)), or one that shares a lazy group with something read on every
  path ([08b](08b-the-lob-reflex-and-the-group.md)).

The connection worth stating: **over-fetching and this topic's exception have the same root and
opposite symptoms.** Both come from the fetch decision being made in the mapping rather than at the
call site. Making everything eager removes the exception and produces the over-fetch; making
everything lazy removes the over-fetch and produces the exception. Only moving the decision to the
query — a projection, a fetch join, a graph — removes both
([Topic 08 · 18](../08-the-n-plus-1-problem/18-fetching-belongs-to-the-call-site.md)).

## Gotchas

**★ A `null` association never means a failed fetch.** Every real lazy failure throws. A null is a
null foreign key or an inverse `@OneToOne`, and both are decided before your code runs.

**★ A LOB locator failure carries no Hibernate vocabulary at all.** No proxy, no
`LazyInitializationException`, no entity name — just a driver exception in a stack trace that
happens to run through a getter. It is easy to spend a long time not connecting it to the
transaction boundary.

**★ Jackson's `{}` is usually the end state of a series of `@JsonIgnore` fixes.** Each one removed
the property that was throwing; enough of them removes every property. The response then contains
no error and no data, which is the worst combination for a client.

**★ Infinite recursion is not a fetching problem, so a fetch plan cannot make it worse or
better.** An eagerly loaded bidirectional graph recurses exactly as fast as a lazily loaded one. If
somebody proposes changing fetch types to fix a `StackOverflowError`, the diagnosis has gone wrong.

**★ Over-fetching produces no exception, so it never arrives as a lazy-loading ticket at all.** It
arrives as "the endpoint is slow", weeks later, from a different person. That is
[Topic 08](../08-the-n-plus-1-problem/README.md), and the connection back to this topic is that
the two problems have the same root and opposite symptoms.

**★ An empty collection is never an uninitialised one.** An uninitialised persistent collection
fetches before it will answer `isEmpty()` or `size()`. If you are holding one that says it is empty
with the session closed, the query ran and returned nothing — so the question is about the data or
the join, not about laziness ([01c](01c-a-collection-is-not-a-proxy.md)).

**★ Reassigning a collection field is a silent, permanent change-tracking failure.** It produces
neither an exception nor a warning, and the symptom appears later as "my edits are not saved" —
which nobody files against lazy loading ([01c](01c-a-collection-is-not-a-proxy.md)).

**★ These three symptoms get filed against three different teams.** `{}` goes to the frontend, a
null goes to whoever owns the data, and a LOB driver error goes to whoever owns the database. None
of them are routed to the person who moved an entity across a transaction boundary, which is why
they persist for so long.

## Interview questions

**★ Jackson is producing `{}` for an association. Is that a lazy-loading failure?**
Not directly. Jackson's fallback serialiser for a type with no discoverable properties extends
`ToEmptyObjectSerializer` and writes `{}` — or, with `FAIL_ON_EMPTY_BEANS` enabled, reports "no
properties discovered to create BeanSerializer". So the object had nothing to serialise. The usual
route there in a lazy-loading context is a series of `@JsonIgnore` annotations added one at a time
to stop the exception, until the type has no exposed properties left. That makes it a lazy-loading
*consequence* rather than a lazy-loading cause, and the honest fix is the same as it was three
annotations earlier: stop serialising entities and return a DTO whose fields are all read inside
the transaction.

**★ Why does an entity holding a `java.sql.Clob` fail differently from one holding a lazy `String`
column?**
Because nothing about a `Clob` is Hibernate's. A lazy `String` under enhancement is intercepted by
Hibernate, which knows the session is gone and raises `LazyInitializationException` with the entity
and attribute names in it. A `Clob` is a JDBC locator — a reference to off-table data that the
driver manages — and the user guide notes that it is not portable to access one after the end of
the transaction in which it was obtained. So the failure is whatever the driver decides, with no
entity name, no attribute name and no Hibernate frame to recognise. Same lifetime mistake, no
diagnostics, which is a good reason to prefer a materialised `String` and a query that does not
select it.

**★ You are handed a bug report saying a collection is empty in the API response but the rows
exist. Where do you start?**
By establishing whether the collection was ever fetched, because that decides which of three
unrelated investigations to run. An uninitialised persistent collection cannot report itself empty
without querying first, so if you are looking at an empty one the query already ran — which means
either the data genuinely has no children for that parent, or the query restricted them. The
restriction case is the interesting one: a fetch join with a `where` clause on the child side
returns a parent whose collection contains only the matching children, and Hibernate will happily
cache that truncated collection in the persistence context. The third possibility has nothing to do
with querying at all: somebody reassigned the field with a new `ArrayList`, which replaces the
persistent collection and silently ends change tracking, so what you are reading is a plain Java
list that was never connected to the database.

**★ Everything on these two pages has one root cause. What is it?**
Treating an entity as if it were a value. An entity is a handle on a row inside a unit of work; it
carries a session, an identity within a persistence context and a partially-loaded graph. Every
symptom here is what happens when one of those three properties is relied on outside the unit of
work that established it — the session for lazy loading, the identity for
`NonUniqueObjectException` and the two-sessions error, the loaded extent for the serialiser
failures, and the JDBC transaction for the LOB locator. That is why the topic's answer to all of
them is the same one, and why it is a type change rather than a configuration change
([05](05-the-dto-boundary.md)).

{/* FOOTER */}
