---
title: "Every structural rule the spec places on an entity class exists because of one specific thing the runtime has to do to it"
sidebar_label: "1b · The rules the spec imposes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §2.1 *The Entity
> Class*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 *User Guide* §3.4.1–§3.4.5 *POJO Models*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *Introduction* §3.1 *Entity classes* and §3.2 *Access types*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The spec's list of entity-class requirements reads like arbitrary ceremony until you
ask, for each rule, "what would break?" Every one of them protects a specific runtime
capability: instantiating your class without knowing your constructors, subclassing it
to build a lazy proxy, or keying an identity map. Two of the rules are stricter in the
spec than in Hibernate, and knowing which two is the difference between portable code
and code that works only here.**

## The spec's list, verbatim

Jakarta Persistence 3.2 §2.1 says an entity class:

- must be annotated `@Entity` (or declared as an entity in the XML descriptor),
- must be a **top-level class or a static inner class** — "an enum, record, or
  interface may not be designated as an entity",
- must have a **public or protected constructor with no parameters**, "which is called
  by the persistence provider runtime to instantiate the entity",
- must be **non-final**, and "every method and persistent instance variable of the
  entity class must be non-final",
- may be abstract or concrete, and may extend an entity or a non-entity class.

The spec also says an instance variable "may be directly accessed only within the
methods of the entity, by the entity instance itself" — state reaches clients through
accessors. That one is a design rule rather than something a provider enforces.

## Rule 1 · a no-argument constructor, because the runtime has to build one blind

When Hibernate reads a row it has to produce an instance of your class. It does not
know what your constructors mean. It cannot guess that `new Customer(email, name)`
wants the email first. So it does the only universally safe thing: it calls the
no-argument constructor and then sets state.

This is why the constructor may be `protected`. You do not want application code
calling it — an empty `Customer` is meaningless in your domain — but the runtime does.

```java
@Entity
public class Customer {

    @Id @GeneratedValue
    private Long id;

    private String email;

    protected Customer() {}                 // for the runtime, not for you

    public Customer(String email) {         // for you
        this.email = email;
    }
}
```

**Java gives you a public no-arg constructor for free only if you declare no other
constructor.** The moment you add `Customer(String)`, the free one vanishes and the
class stops being a valid entity. This is the single most common "it worked until I
added a constructor" failure in JPA.

**Hibernate is looser than the spec here, in two ways.** The User Guide says the
constructor "may be public, protected or package visibility. It may define additional
constructors as well" — so package-private works on Hibernate but is not portable.
And the Introduction notes that "the requirement for a default constructor is relaxed
when the bytecode enhancer is used." Neither relaxation is worth relying on: write
`protected Customer() {}` and stop thinking about it.

## Rule 2 · non-final, because lazy loading is implemented by subclassing

Hibernate's default mechanism for *"give me a reference to row 7 without reading row
7"* is a runtime proxy: a generated subclass of your entity that overrides every
accessor to load the real state on first use. You cannot subclass a `final` class, and
you cannot override a `final` method.

The User Guide is direct about the consequence: "You can still persist final classes
that do not implement such an interface with Hibernate, but you will not be able to
use proxies for fetching lazy associations, therefore limiting your options for
performance tuning. For the very same reason, you should also avoid declaring
persistent attribute getters and setters as final."

So `final` on an entity does not usually produce an error. It produces a quieter
outcome: your lazy associations stop being lazy, and you find out from a query count
rather than an exception. The general shape of that failure is
**Topic 08 · The N+1 problem** *(not written yet)*.

Two knock-on rules follow from the same mechanism, and both bite in real code:

- `equals()` on an entity should use `instanceof`, **not** `getClass()`, because the
  object handed to it may be a proxy subclass. The Introduction says so explicitly:
  "check type with `instanceof`, not `getClass()`". More in
  [10 · equals and hashCode](10-equals-and-hashcode.md).
- `equals()` should read the other object's fields **through its getters**, not
  directly, because reading a proxy's field bypasses the interception that would have
  loaded it. Direct field access on a proxy sees `null`.

## Rule 3 · an identifier, because the persistence context is keyed by it

The persistence context is an identity map from identifier to instance. No identifier,
no key, no map. The User Guide adds that Hibernate and JPA both assume the identifier
column(s) are **unique**, **not null**, and **immutable**: "the values, once inserted,
can never be changed. In cases where the values for the PK you have chosen will be
updated, Hibernate recommends mapping the mutable value as a natural id, and use a
surrogate id for the PK."

It also gives a recommendation people ignore and then regret: "we recommend that you
declare consistently-named identifier attributes on persistent classes and that you
use a wrapper (i.e., non-primitive) type (e.g. `Long` or `Integer`)." A `long id`
cannot be null, so a brand-new unsaved entity has `id == 0`, which Hibernate's
transient-vs-detached heuristic reads ambiguously. `Long id` has `null` for "not yet
assigned", which is unambiguous. See [12 · The four
states](12-the-four-states.md).

## Rule 4 · top-level or *static* inner

A non-static inner class holds an implicit reference to an enclosing instance and has
no usable no-arg constructor, so it fails rule 1 anyway. A `static` nested class is
fine, and is exactly how Hibernate's own documentation examples are written. In
production code, put entities in their own files.

## Where the annotations go decides the access type

This one is not on the spec's list but belongs with it, because getting it wrong
produces behaviour nobody expects.

Hibernate infers the **access type** from where you put `@Id`. The Introduction:

> if a field is annotated `@Id`, field access is used, or
> if a getter method is annotated `@Id`, property access is used.

Field access means Hibernate reads and writes your fields directly, ignoring your
accessors. Property access means it calls your getters and setters.

The rule that follows is: **be consistent.** If `@Id` is on a field, put every other
mapping annotation on fields too. If `@Id` is on a getter, put them all on getters.
An annotation placed on the wrong side of that line is simply not read — the attribute
is mapped with defaults and your `@Column(name = "...")` is silently ignored.

The Introduction's own preference is worth adopting: "Back when Hibernate was just a
baby, property access was quite popular in the Hibernate community. Today, however,
field access is much more common." And on forcing it with `@Access`: "we strongly
discourage this, since it's ugly and never necessary."

## Gotchas

**Adding a convenience constructor removes the free default one.**
No compile error, no startup error in some setups — just an instantiation failure the
first time Hibernate loads that entity. Always declare `protected X() {}` explicitly,
even when it is currently redundant, so a later constructor cannot break it.

**Kotlin data classes and Lombok `@Value` produce final classes with no no-arg constructor.**
Both are the record problem wearing a different hat — see
[1c · Why an entity cannot be a record](01c-why-not-a-record.md). For Kotlin the
standard answer is the `all-open` and `no-arg` compiler plugins; for Lombok, do not use
`@Value` on entities and be very careful with `@Data`, whose generated `equals`/
`hashCode` include every field, which is precisely the mutable-field trap of
[10 · equals and hashCode](10-equals-and-hashcode.md).

**A `final` getter quietly disables lazy loading for that attribute.**
It is easy to write `public final String getEmail()` on a class you intended to be
tamper-proof. Nothing fails; the proxy just cannot intercept it.

**Property access makes your setter part of the persistence contract.**
With property access Hibernate calls `setEmail(...)` while *loading* a row. A setter
that normalises, validates, or throws will run against database data, not user input.
A setter that lazily initialises a collection field will do it during load. Field
access has none of these hazards, which is a large part of why it won.

**Mixing field and property annotations is legal and almost always a bug.**
Hibernate lets you mix with explicit `@Access` at attribute level. The Introduction:
"We don't recommend doing this." In practice the mix is accidental — one annotation
drifted onto a getter — and the symptom is a mapping that reverts to defaults.

**"Non-final persistent instance variables" includes `final` fields you thought were safe.**
A `private final Instant createdAt` cannot be written by field access after
construction, so the entity cannot be populated from a row. Immutability inside an
entity has to be enforced by not exposing a setter, not by `final`.

## Interview questions

**★ Why does JPA require a no-argument constructor?**
Because the provider has to instantiate your class from a result set and has no way to
interpret any other constructor's parameters. It creates an empty instance through the
no-arg constructor and then populates state — via fields or setters, depending on the
access type. The constructor may be `protected` precisely so that application code is
not tempted to use it.

**★ Why must an entity class be non-final?**
Because Hibernate implements lazy loading of associations by generating a runtime
proxy that subclasses the entity and overrides its accessors. A `final` class cannot
be subclassed and a `final` method cannot be overridden. The class will still persist;
you simply lose proxy-based lazy fetching, which is a performance capability rather
than a correctness one — so the failure shows up as extra queries, not an exception.

**★ What decides whether Hibernate uses field access or property access, and why does it matter?**
The placement of `@Id`. On a field, field access; on a getter, property access. It
matters for three reasons. First, every other mapping annotation must go on the same
side or it is ignored. Second, with property access your setters are invoked during
loading, so any logic in them runs against database state. Third, `equals()`
implementations that read fields directly break against proxies, which is more likely
to surface under property access.

**★ Can an entity extend another class?**
Yes, in two different ways. It can extend another `@Entity`, in which case it inherits
the root entity's identifier and cannot declare its own `@Id`. Or it can extend a
plain class annotated `@MappedSuperclass`, which contributes its mapped attributes —
this is the usual way to share an `@Id`, a `@Version`, and audit timestamps across
entities. A root entity must declare an `@Id` or inherit one from a
`@MappedSuperclass`.

**★ Should the identifier field be `long` or `Long`?**
`Long`. Hibernate distinguishes a brand-new transient instance from a detached one
partly by inspecting the id: if it holds the default value for its type, the instance
is treated as transient. With `long` the default is `0`, which is also a legitimate
id, so the heuristic is ambiguous. With `Long` the default is `null`, which no row can
have. The Hibernate User Guide recommends the wrapper type for exactly this reason.

**★ The spec says entity state should be reached through accessors, not by touching fields. Is that enforced?**
No — Hibernate explicitly does not enforce it. The User Guide notes that "Hibernate
does not restrict the application developer from exposing instance variables and
referencing them from outside the entity class itself," and then adds, drily, that
"the validity of such a paradigm, however, is debatable at best." It is a design rule
with one hard exception where it really does matter: reading a *proxy's* field
directly bypasses initialisation and yields `null`.

---

← Prev: [1 · What an entity is](01-what-an-entity-is.md) · Index: [The JPA/Hibernate model](README.md) · Next → [1c · Why not a record](01c-why-not-a-record.md)
