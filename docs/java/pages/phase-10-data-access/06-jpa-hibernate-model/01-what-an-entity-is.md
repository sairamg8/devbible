---
title: "An entity is not a class with annotations on it — it is a class you have handed to a runtime that promises to watch it"
sidebar_label: "1 · What an entity is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3 *Entities*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §3.4 *Entity types* and §6 *Persistence Context*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification §2.1 *The Entity Class*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Most people meet JPA as a pile of annotations and learn the annotations one at a
time. That is backwards, and it is why the surprises later feel like magic. Start
here instead: an entity is an ordinary Java object that you have deliberately given
to a runtime, and that runtime now watches it. Everything strange in this topic —
the UPDATE nobody wrote, the `find` that runs no SQL, the `merge` that hands you a
different object — is a consequence of *being watched*. Learn the watching first
and the annotations become boring.**

## Start with a class nobody is watching

Here is a plain Java class. Nothing in this file knows a database exists.

```java
public class Customer {
    private Long id;
    private String email;
    private String displayName;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    // ...
}
```

If you load a row into one of these with JDBC — see
[Topic 01 · JDBC](../01-jdbc/README.md), which is the layer underneath everything on
this page — and then call `setEmail(...)`, exactly nothing happens to the database.
You changed a field in memory. To make the change stick you write an `UPDATE`
yourself, bind the parameters yourself, and execute it yourself.

That is the baseline. Hold on to it, because the whole point of this topic is what
changes when it stops being true.

## An entity is that same class, plus a promise

Add two annotations:

```java
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class Customer {

    @Id
    private Long id;

    private String email;
    private String displayName;

    protected Customer() {}   // required — see chunk 1b

    // getters and setters
}
```

The class did not gain any behaviour. What it gained is *eligibility*. At startup,
Hibernate scans for `@Entity`, builds a model of this class, works out which table
and which columns it corresponds to, and from then on is willing to take
responsibility for instances of it.

The Hibernate Introduction states the mapping in one sentence:

> An entity is a Java class which represents data in a relational database table.

And it adds the part people skip:

> every entity must have an identifier or `id`, which maps to the primary key of the
> table. The id allows us to uniquely associate a row of the table with an instance
> of the Java class, at least within a given persistence context.

That last clause — *within a given persistence context* — is the whole topic in
embryo. We will unpack it properly in
[11 · The persistence context](11-the-persistence-context.md).

## "Managed" is the word for being watched

An entity instance is not permanently special. It is special *while it is associated
with a persistence context*. The spec's word for that association is **managed**.

The Hibernate User Guide §6 lists the four states an instance can be in relative to a
persistence context — transient, managed, detached, removed — and we cover all four
and every transition in [12 · The four entity states](12-the-four-states.md).

For now, only the middle one matters. A **managed** instance is one the runtime is
actively holding on to. Concretely, being managed buys you four things:

**One instance per row.** Ask for the same row twice in the same persistence context
and you get back the same Java object — not two objects with equal fields, the *same
reference*. The User Guide is explicit: "Hibernate guarantees equivalence of
persistent identity (database row) and Java identity inside a particular session
scope."

**Automatic change detection.** Call a setter on a managed instance and the change is
noticed and written out, with no repository call anywhere. The Introduction calls this
"automatic dirty checking": "after modifying an entity, we don't need to perform any
explicit operation to ask Hibernate to propagate that change back to the database."
This is the syllabus's *"UPDATE you never wrote"*, and it gets its own chunk at
[14 · Dirty checking](14-dirty-checking.md).

**A lifecycle that outlives the object.** `persist()` and `remove()` mark the
beginning and end of an entity's persistent life. The Java object dies when the JVM
does; the entity, identified by its id, can be re-materialised in a new persistence
context tomorrow.

**Deferred, batched writes.** Nothing is written when you call a setter. Nothing is
even written when you call `persist()`. Work is queued and executed at *flush* —
see [15 · Flush](15-flush.md).

## The promise runs in both directions

Handing a class to Hibernate is a trade. You get the four things above. In exchange
the class has to hold still and let itself be watched, which means it must satisfy a
short list of structural requirements — a no-argument constructor, a non-final class,
an identifier. Those are not arbitrary bureaucracy; each one exists because of a
specific thing the runtime needs to do. That is [1b · The rules the spec
imposes](01b-the-rules-the-spec-imposes.md).

One consequence is worth flagging immediately because it trips up every Java
developer who has enjoyed records: **a JPA entity cannot be a record.** The spec says
so in as many words, and the reason is exactly this trade. See
[1c · Why an entity cannot be a record](01c-why-not-a-record.md).

## What an entity is *not*

**Not a DTO.** An entity is bound to a persistence context and, through it, to a
transaction and a database connection. Serialising one straight out of a controller
drags that binding into places it does not belong. The consequences of doing this in
a web request are [Topic 10 · Lazy-loading pitfalls](../10-lazy-loading/README.md).

**Not a validation object.** `@Column(nullable = false)` affects generated DDL and
nothing else. `@Basic(optional = false)` is checked by Hibernate before writing. Bean
Validation's `@NotNull` is checked on lifecycle events. They are three different
mechanisms at three different layers, and we separate them in
[3 · Fields, columns and access](03-fields-columns-access.md).

**Not a table.** Usually one entity is one table, but the identifier only has to map
to columns that "uniquely identify each row" — the User Guide says the identifier
"does not necessarily need to be mapped to the column(s) that physically define the
primary key."

**Not free.** A managed instance costs memory: the persistence context holds a hard
reference to it *and* a snapshot of its loaded state, so it can tell later whether
anything changed. The Introduction is blunt about the consequence — "a persistence
context holds a hard reference to all its entities, preventing them from being
garbage collected. Thus, the session must be discarded once a unit of work is
complete." The cost side is [14e · What dirty checking
costs](14e-what-dirty-checking-costs.md).

## Gotchas

**An `@Entity` class that Hibernate never scanned is just a class.**
Spring Boot finds entities by scanning the package of your `@SpringBootApplication`
class and its subpackages. Put an entity outside that tree and you get no error at
startup — you get a runtime failure the first time you use it, usually complaining
that the class is not an entity. Adding `@EntityScan` fixes it; moving the class is
usually better.

**Two entity classes cannot share a simple name, even in different packages.**
The User Guide: "Hibernate does not allow registering multiple entities with the same
name even if the entity classes reside in different packages," because the entity name
defaults to the unqualified class name and JPQL refers to entities by that name. Two
`Address` classes in `billing` and `shipping` collide. Fix it with
`@Entity(name = "BillingAddress")` — and note this renames the *entity*, not the
table.

**Adding `@Entity` to an existing DTO is the most expensive refactor in this topic.**
The class stops being inert. Every setter call anywhere in the codebase becomes a
potential UPDATE. Code that used a DTO as a scratch object now mutates database rows.
If you need a flat object for an API response, make a separate class.

**The annotations are on `jakarta.persistence`, not `javax.persistence`.**
Jakarta Persistence 3.x completed the namespace move. An import of
`javax.persistence.Entity` in a Boot 4 project is a stale dependency or a stale
tutorial; it will not be scanned and the class will not be an entity.

**`@Entity` on an abstract class is legal and often right.**
Both the spec and Hibernate allow abstract entities — they are how you model an
inheritance hierarchy. What you cannot do is give a subclass its own `@Id`: "a
subclass entity always inherits the identifier attribute of the root entity. It may
not declare its own `@Id` attribute."

**An entity with no identifier is on its way out.**
Historically Hibernate tolerated it. The 7.4 User Guide now says plainly: "not
defining identifier attributes on the entity should be considered a deprecated
feature that will be removed in an upcoming release." Give every entity an `@Id`.

## Interview questions

**★ What is a JPA entity, in one sentence, without using the word "annotation"?**
A Java class whose instances a persistence provider will manage: it will guarantee at
most one in-memory instance per database row within a persistence context, detect
changes to those instances automatically, and translate them into SQL at flush time.
The annotations are just how you tell it which classes those are.

**★ What does it mean for an entity instance to be "managed"?**
It means the instance is currently associated with a persistence context, and that
context holds a mapping from its identifier to the instance. Because the context holds
it, three things follow: looking up the same id again returns that same instance; the
context also holds a snapshot of the instance's loaded state, so it can compare and
detect modifications at flush; and any modification is written to the database without
you calling a save method. An instance that is not managed — transient, detached, or
belonging to another context — has none of those properties.

**★ Why does an entity need an identifier at all? The database already has a primary key.**
Because the persistence context is an identity map keyed by identifier. Without an id
Hibernate has no key to store the instance under, so it cannot answer "have I already
loaded this row?", which is what makes one-instance-per-row possible. The id also gives
the entity a persistent identity that outlives any particular JVM instantiation — you
can drop the object, open a new context tomorrow, and re-materialise the same entity
from the same id. The database primary key is where that identity is *stored*; the
`@Id` attribute is how the runtime *uses* it.

**★ You add `@Entity` to a class that was previously a plain DTO passed around your service layer. What breaks?**
Any code that mutated the object for its own convenience now issues UPDATEs. A method
that normalised an email to lowercase before returning it in a response silently
rewrites the row. Code that constructed one of these as a scratch value and passed it
to `merge` or `persist` now inserts. And the object can no longer be freely handed to
another thread, because a managed instance belongs to a persistence context and a
persistence context is not thread-safe. The safe move is a separate class, not a
shared one.

**★ Is an entity thread-safe?**
The entity class itself is as thread-safe as you wrote it, but a *managed instance*
must not cross threads, because the persistence context that manages it must not. The
Introduction states it as hard as documentation ever states anything: a persistence
context "absolutely positively must not be shared between multiple threads or between
concurrent transactions. If you accidentally leak a session across threads, you will
suffer."

**★ Why is `@Column(nullable = false)` not the same as `@Basic(optional = false)`?**
They live in different layers. `@Column` is mapping-layer: it describes the database
object, so `nullable = false` only affects the DDL Hibernate would generate. `@Basic`
is logical-layer: it describes the domain model, so `optional = false` is checked by
Hibernate before it writes the entity out. The Introduction spells out the asymmetry —
"`optional=false` implies `nullable=false`, but `nullable=false` does not imply
`optional=false`" — and recommends `@Basic(optional=false)`, or better, Bean
Validation's `@NotNull`.

**★ Where does the entity model sit relative to plain JDBC?**
Directly on top. Hibernate obtains a `java.sql.Connection` from the same `DataSource`
your JDBC code would use, builds `PreparedStatement`s, and reads `ResultSet`s. Nothing
in this topic replaces JDBC; it decides *which* statements to build and *when* to
execute them. That is why the JDBC-level concerns in
[Topic 01 · JDBC](../01-jdbc/README.md) and the transaction semantics in
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md) remain
exactly as relevant once JPA is in the picture.

---

Index: [06 · The JPA/Hibernate model](README.md) · Next → [1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md)
