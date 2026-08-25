---
title: "Some associations issue a query per row no matter what you annotate them, and the bidirectional one-to-one is the one that will catch you"
sidebar_label: "4d · The ones you cannot make lazy"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §3.9 *Bidirectional
> `@OneToOne` lazy association*, §3.4.2 *Prefer non-final classes* and §6.2
> *Bytecode Enhancement*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *A Short Guide to Hibernate 7* §9 on bytecode
> enhancement
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Everything so far assumed that `fetch = LAZY` does what it says. For most
associations it does. For a small set of them the annotation is accepted,
ignored, and a query is issued per row anyway — and because the mapping *looks*
correct, this is the hardest N+1 to diagnose. Knowing which four cases these are
is worth more than any single fix in this topic.**

## Case 1 · The inverse side of a bidirectional `@OneToOne`

This is the important one. The mapping looks entirely correct:

```java
@Entity
class Person {
    @Id @GeneratedValue Long id;

    @OneToOne(mappedBy = "person", fetch = FetchType.LAZY)   // ← ignored
    Passport passport;
}

@Entity
class Passport {
    @Id @GeneratedValue Long id;

    @OneToOne                                                // owning side, holds the FK
    Person person;
}
```

Query a hundred `Person` rows and Hibernate issues a hundred extra selects
against `passport`, despite the `fetch = LAZY`.

### Why

A lazy association is implemented as a **proxy** — a stand-in object that holds
the foreign key and fetches the row on first use. That only works if Hibernate
knows the foreign key value, and on the *owning* side it does: the FK is a column
on the row it just read.

On the inverse side there is no such column. `Person` has no `passport_id`; the
FK lives on `passport.person_id`. So Hibernate does not know whether a passport
exists for this person, and it cannot decide between installing a proxy and
setting the field to `null` without asking the database. The user guide says
exactly this:

> *"Although you might annotate the parent-side association to be fetched
> lazily, Hibernate cannot honor this request since it cannot know whether the
> association is `null` or not. The only way to figure out whether there is an
> associated record on the child side is to fetch the child association using a
> secondary query. Because this can lead to N+1 query issues, it's much more
> efficient to use unidirectional `@OneToOne` associations with the `@MapsId`
> annotation in place."*

**The nullability is the whole problem.** A proxy can stand in for a row that
exists; nothing can stand in for "possibly nothing". Hibernate must resolve it
eagerly to know which.

### The three ways out, in order of preference

**Drop the inverse side.** Map the one-to-one unidirectionally from the child,
which is the guide's own recommendation. If you also want the two rows to share
a primary key, `@MapsId` on the owning side gives you that and makes the
association a straight primary-key lookup:

```java
@Entity
class Passport {
    @Id Long id;                    // same value as person.id

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id")
    Person person;
}
```

Navigation now goes child → parent, which is the direction that *can* be lazy.

**Enable bytecode enhancement.** The guide names this as the remedy if you must
keep the bidirectional mapping: *"if you really need to use a bidirectional
association and want to make sure that this is always going to be fetched
lazily, then you need to enable lazy state initialization bytecode
enhancement."* Enhancement rewrites the field access itself, so Hibernate
intercepts the read rather than relying on a proxy object standing in the field —
which means it no longer needs to decide anything at load time. Detail in
**chunk 13** *(not written yet)*.

**Fetch it explicitly.** If the shape must stay and enhancement is not available,
treat it like any other association you know you will need and join it —
[chunk 8](08-join-fetch.md) — or batch it so the N becomes N/K —
**chunk 10** *(not written yet)*.

## Case 2 · A `final` entity class or `final` accessors

Proxies are generated subclasses. A `final` class cannot be subclassed, and a
`final` getter cannot be overridden, so there is nowhere to put the
initialisation hook. The user guide is explicit about the consequence:

> *"A central feature of Hibernate is the ability to load lazily certain entity
> instance variables (attributes) via runtime proxies. This feature depends upon
> the entity class being non-final or else implementing an interface that
> declares all the attribute getters/setters. You can still persist final classes
> that do not implement such an interface with Hibernate, but you will not be
> able to use proxies for fetching lazy associations, therefore limiting your
> options for performance tuning. For the very same reason, you should also avoid
> declaring persistent attribute getters and setters as final."*

This is a live trap in Kotlin, where classes and members are `final` by default —
which is why the `all-open`/`kotlin-jpa` compiler plugin exists. It is also why
a Java `record` cannot be an entity.

⚠️ Note what the quote does *not* say: it does not say lazy loading silently
becomes eager here. Hibernate's exact behaviour when it cannot proxy a particular
association varies by mapping, and I could not confirm a single documented
outcome for every case against a primary source. What the documentation does
state is the mechanism and the loss of capability — proxies are unavailable, and
your performance-tuning options are reduced accordingly. Treat "this entity is
`final`" as a reason to check the emitted statement count rather than as a
predictable behaviour.

Two further cases — the lazy `@Basic` column, and the `Set` whose `hashCode()`
dereferences an association — are in [chunk 4e](04e-lazy-columns-and-hashcode.md).

## Gotchas

**⚠️ Reading `fetch = LAZY` on a `mappedBy` `@OneToOne` and believing it.**
The annotation is accepted and the behaviour is eager. There is no warning at
startup and no error at runtime — only extra statements. If a page is issuing one
mysterious extra query per row, look for an inverse-side one-to-one first.

**⚠️ Assuming `optional = false` fixes the one-to-one.**
`@OneToOne(mappedBy = "person", fetch = LAZY, optional = false)` asserts the
association is never null, which sounds like it removes the ambiguity. Hibernate's
handling of `optional` on the inverse side is subtler than that, and I could not
confirm against a primary source that it makes the inverse side lazy in 7.4. Do
not rely on it. The remedies the documentation actually names are the
unidirectional `@MapsId` mapping and bytecode enhancement.

**⚠️ Adding the inverse side "for convenience" late in a project.**
The owning side was fine. Adding `mappedBy` to the parent so that navigation
reads nicely introduces an eager fetch on every query that returns parents, and
the commit that does it looks like a pure readability change.

**⚠️ Using Kotlin data classes as entities.**
Kotlin classes and members are `final` by default, so proxies cannot be
generated, and `data class` additionally generates `equals`, `hashCode` and
`toString` over every property — this case and the `hashCode` case in
[chunk 4e](04e-lazy-columns-and-hashcode.md) at the same time. The
`kotlin-allopen` plugin with the JPA preset addresses the finality half; the
generated methods still have to be replaced by hand.

**⚠️ Making a getter `final` to stop subclasses overriding it.**
The guide asks you not to, for exactly this reason: a final accessor cannot carry
the proxy's initialisation hook. Whatever the design argument for sealing the
method, it costs you the ability to tune fetching on that association.

**⚠️ Expecting a startup check to catch either case.**
Neither produces a validation error. A `final` entity boots and works; an inverse
one-to-one boots and works. Both are only visible as statements, which is the
argument for [chunk 6](06-count-do-not-read.md) restated for mappings.

## Interview questions

**★ Why can't the inverse side of a bidirectional `@OneToOne` be lazy?**
Because lazy loading of a to-one association is implemented with a proxy, and a
proxy can only be installed if Hibernate already knows there is a row to stand in
for. On the owning side that is true — the foreign key is a column on the row
just read, so Hibernate can construct a proxy holding that key without another
query. On the inverse side the foreign key lives on the *other* table, so
Hibernate has no way to tell whether an associated row exists. It must choose
between installing a proxy and setting the field to `null`, and it cannot make
that choice without asking the database. The user guide states it directly:
Hibernate "cannot honor this request since it cannot know whether the association
is null or not", and "the only way to figure out whether there is an associated
record on the child side is to fetch the child association using a secondary
query". Hence one extra select per row.

**★ How do you fix it?**
Three options, in the order the documentation prefers them. Best is to remove the
inverse side and map the one-to-one unidirectionally from the child, ideally with
`@MapsId` so the two rows share a primary key — the guide says this explicitly,
that it is "much more efficient to use unidirectional `@OneToOne` associations
with the `@MapsId` annotation in place". Navigation then runs child → parent,
which is the owning direction and can be lazy. If the bidirectional mapping must
stay, enable lazy state initialization bytecode enhancement, which the guide
names as the remedy: enhancement intercepts the field read itself, so Hibernate
no longer has to install a stand-in object at load time and no longer has to
decide anything about nullability. Failing both, treat it as an association you
know you need and fetch it explicitly with a join or batch it.

**★ Why does making an entity class `final` matter?**
Because Hibernate's lazy loading for to-one associations is proxy-based, and its
proxies are generated subclasses. A `final` class cannot be subclassed and a
`final` getter cannot be overridden, so there is nowhere to attach the
initialisation hook. The user guide says the capability "depends upon the entity
class being non-final or else implementing an interface that declares all the
attribute getters/setters", and that a final class can still be persisted but you
"will not be able to use proxies for fetching lazy associations, therefore
limiting your options for performance tuning". This is the practical reason a
Java `record` cannot be an entity, and the reason Kotlin projects need the
`all-open`/`kotlin-jpa` compiler plugin, since Kotlin makes everything final by
default.

**★ What is the difference between the owning side and the inverse side, and why
does it decide this?**
The owning side is the one whose table holds the foreign key column; the inverse
side is the one that declares `mappedBy` and owns no column at all. That
distinction is normally discussed as a *write* concern — Hibernate only persists
changes made to the owning side — but it decides fetching too, and for a
mechanical reason. Laziness needs a key to defer on. The owning side has the key
in hand as a column of the row it just read, so it can hand you a proxy for
nothing. The inverse side has no column, so the only way to populate the field at
all is a query. That is why the same `fetch = LAZY` annotation is honoured on one
side and quietly ignored on the other, and it is a good example of a JPA rule
that only makes sense once you look at which table holds which column. The
mapping mechanics themselves belong to **Topic 07 · Relationships and fetch
types** *(not written yet)*.

**★ Would you ever accept the eager inverse one-to-one rather than fix it?**
Yes, in one situation: when the parent is only ever loaded one at a time. The
cost is a single extra select on a `find()`, which is negligible, and the
bidirectional navigation may genuinely make the domain model read better. What
makes it unacceptable is any query that returns *many* parents, because then the
single extra select becomes one per row and you have a textbook N+1 with a
mapping that looks correct. So the honest rule is that the mapping is tolerable
in an aggregate that is always fetched by id and dangerous the moment somebody
writes a list endpoint over it — and since nobody can promise that never happens,
the unidirectional `@MapsId` form is the safer default.

---

← Prev: [4c · Serialisation and logging](04c-serialization-and-logging.md) · Index: [The N+1 problem](README.md) · Next → [4e · Lazy columns and hashCode](04e-lazy-columns-and-hashcode.md)
