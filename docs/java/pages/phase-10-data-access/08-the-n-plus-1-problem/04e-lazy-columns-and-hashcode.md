---
title: "A lazy column is not a proxy and needs the bytecode rewritten, and an entity whose hashCode reads an association re-creates N+1 after your fetch join worked"
sidebar_label: "4e · Lazy columns and hashCode"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §6.2.1 *Lazy
> attribute loading* and §6.2 *Bytecode Enhancement*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the `org.hibernate.annotations.LazyGroup` javadoc in the Hibernate 7.4
> source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/annotations/LazyGroup.java)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Two more cases where laziness does not do what the annotation says. The first
is a limitation of proxies that has a real fix. The second is not about mapping
at all — it is an entity that sabotages a fetch join you had already got right,
and it is the reason a correct fix can appear not to work.**

## Case 3 · Lazy `@Basic` columns without enhancement

A large column — a `@Lob`, a document body, an image — can be marked lazy:

```java
@Basic(fetch = FetchType.LAZY)
@Lob
byte[] scan;
```

But the proxy mechanism cannot help here at all. A proxy stands in for a whole
*entity*; it cannot stand in for one *field* of an entity that is otherwise
loaded. Making an individual attribute lazy requires intercepting the field
read, which requires rewriting the class. The user guide describes the feature as
belonging to enhancement, and draws the contrast explicitly:

> *"Think of this as partial loading support. Essentially, you can tell Hibernate
> that only part(s) of an entity should be loaded upon fetching from the database
> and when the other part(s) should be loaded as well. Note that this is very
> much different from the proxy-based idea of lazy loading which is
> entity-centric where the entity's state is loaded at once as needed. With
> bytecode enhancement, individual attributes or groups of attributes are loaded
> as needed."*

Without enhancement, `@Basic(fetch = LAZY)` is a hint the provider may ignore,
and the column comes back with the row. With enhancement it works — and brings a
grouping rule worth knowing, because it decides how many queries you get:

> *"Lazy attributes can be designated to be loaded together, and this is called a
> 'lazy group'. By default, all singular attributes are part of a single group,
> meaning that when one lazy singular attribute is accessed all lazy singular
> attributes are loaded. Lazy plural attributes, by default, are each a lazy
> group by themselves."*

So touching one lazy scalar pulls in all of them unless you separate them with
`@LazyGroup`.

## Case 4 · A `Set` whose `hashCode()` touches a lazy field

This one is not about mapping at all — it is about `java.util.Set`.

```java
@Entity
class Tag {
    @Id @GeneratedValue Long id;
    String name;

    @ManyToOne(fetch = FetchType.LAZY)
    Category category;

    @Override public int hashCode() {
        return Objects.hash(name, category);      // ← initialises the proxy
    }
}
```

Hibernate stores a `Set`-mapped association in a `LinkedHashSet`, and populating
a hash-based set calls `hashCode()` on every element as it is inserted. So the
moment a collection of `Tag` is initialised, each tag's `hashCode()` runs, each
one dereferences `category`, and you get **a query per element of a collection
you fetched in one query**. The fetch join you carefully added does not help,
because the extra queries happen while the fetched rows are being put into the
set.

The same mechanism fires for `equals` when it compares an association, and for
anything else that hashes entities — a `HashMap` keyed by entity, a
`Collectors.toSet()`, a `distinct()` over entities.

**The rule: an entity's `equals` and `hashCode` must use only its own scalar
state — ideally a single immutable business key — and must never dereference an
association or an id that is generated on flush.** Lombok's `@Data` and
`@EqualsAndHashCode` violate this by default, which is the connection back to
[chunk 4c](04c-serialization-and-logging.md).

## Gotchas

**⚠️ Expecting `@Basic(fetch = LAZY)` to work out of the box.**
Without bytecode enhancement it is advisory and generally ignored, so your
half-megabyte blob is on every row of every query that touches that entity. If
you need lazy columns, you need enhancement configured in the build — see
**chunk 13** *(not written yet)*.

**⚠️ Enabling enhancement and finding one lazy column pulls in the others.**
That is the default lazy group at work: all singular lazy attributes load
together on first access to any of them. Separate them with `@LazyGroup` when
they have genuinely different access patterns.

**⚠️ Putting `@Lob` on a field of an entity that is loaded in list endpoints.**
Every row of every list query carries the blob unless enhancement is on. This is
not N+1 — it is a single query that transfers far too much — but it presents the
same way in a latency graph, and it is fixed by the same instinct: load a
projection, not the entity.

**⚠️ Adding a fetch join and still seeing a query per row.**
Strong signal of the `hashCode` case. The fetch join brings the rows back in one
statement, and then the `hashCode()` of each row issues its own query while the
set is being populated. Check `equals`/`hashCode` before you conclude the fetch
join is not working.

**⚠️ Using a generated id in `hashCode()`.**
Different failure, same method. A `@GeneratedValue` id is `null` until flush, so
an entity hashed before it is persisted lands in one bucket and then changes
hash, which makes it unfindable in the very set it was added to. This is a
correctness bug rather than a performance one, and it is why the recommendation
is a stable business key rather than the id.

**⚠️ `Collectors.toSet()` or `distinct()` over entities.**
Both hash every element, so both trigger whatever `hashCode()` does — including
its queries. If you need distinct entities, prefer letting the query do it
(Hibernate 6 and later de-duplicate fetch-join results itself, see
[chunk 8c](08c-duplicate-parents-and-distinct.md)) over hashing them in Java.

**⚠️ Changing `List` to `Set` to avoid `MultipleBagFetchException` and
inheriting this.**
It is a common and reasonable move — see
[chunk 8e](08e-multiplebagfetchexception.md) — but it switches the collection to
hash-based storage, so a `hashCode()` that dereferences an association starts
firing where it previously did not. Fix `equals`/`hashCode` in the same commit.

## Interview questions

**★ Does `@Basic(fetch = LAZY)` work?**
Only with bytecode enhancement. Proxy-based laziness is entity-centric: a proxy
stands in for a whole entity, and there is no way for it to stand in for a single
column of an entity that has otherwise been loaded. Making one attribute lazy
means intercepting the field read, which means rewriting the class — which is what
enhancement does. Without it the annotation is advisory and generally ignored, so
a `@Lob` marked lazy still arrives with every row. With enhancement it works, but
inherits a grouping rule: by default all singular lazy attributes form one lazy
group and load together on first access to any of them, while each lazy plural
attribute is its own group. If two lazy columns have genuinely different access
patterns, separate them with `@LazyGroup`.

**★ What is a lazy group and why would you configure one?**
It is the unit in which enhancement loads lazy attributes. The user guide defines
the default: all singular lazy attributes belong to a single group, so touching
any one of them loads all of them, while each lazy plural attribute is a group of
its own. That default is usually what you want, because it means one extra query
rather than one per attribute. You configure a group explicitly with
`@LazyGroup("name")` when two lazy columns have genuinely different access
patterns — the canonical example in the documentation is an entity with a lazy
scalar and a lazy `@Lob` image, where reading the scalar should not drag in the
blob. The trade-off is the usual one: more groups means finer control and
potentially more round trips.

**★ You added a fetch join and the query count barely changed. What would you
check?**
Whether the entity's `hashCode()` or `equals()` dereferences an association.
Hibernate materialises a `Set`-mapped collection into a hash-based set, which
calls `hashCode()` on every element as it inserts it — so if `hashCode()` reads a
lazy `@ManyToOne`, each element issues its own query while the collection you
just fetched in one statement is being populated. The fetch join worked
perfectly; the extra statements come afterwards, from set construction. The same
thing happens with `Collectors.toSet()`, a `HashMap` keyed by entities, or a
`distinct()` over entities. The rule that prevents it is that an entity's
`equals`/`hashCode` must use only its own scalar state, ideally one immutable
business key — never an association, and never a generated id that is null before
flush.

**★ What should an entity's `equals` and `hashCode` actually be based on?**
A stable, immutable business key — a natural identifier such as an ISBN, an
order reference, or an externally-assigned UUID that is set in the constructor.
That satisfies the two properties the collections framework requires and JPA
makes hard: the hash must not change over the object's lifetime, and equality
must be consistent across the transient, managed and detached states of the same
row. A generated id fails the first requirement, because it is null before flush
and non-null afterwards. Field-by-field equality fails both, because the fields
change and because dereferencing an association to compare it issues a query. If
there is genuinely no business key, a UUID assigned by the application at
construction time gives you one, and is preferable to hashing on a
database-generated value.

**★ Why does the choice between `List` and `Set` for a collection interact with
this?**
Because it changes when `hashCode()` is called. A `List`-mapped collection is
materialised into a list, which never hashes its elements, so a `hashCode()` that
dereferences an association simply never runs during loading. Switch the mapping
to `Set` — a very common move, because it is the standard escape from
`MultipleBagFetchException` when you need to fetch two collections — and Hibernate
now populates a hash-based set, calling `hashCode()` on every element. So a change
made to fix one N+1 can silently introduce another, in a class nobody edited.
That is a good argument for fixing `equals`/`hashCode` in the same commit as any
`List`-to-`Set` migration, and a good illustration that these fixes interact
rather than composing cleanly.

---

← Prev: [4d · The ones you cannot make lazy](04d-the-ones-you-cannot-make-lazy.md) · Index: [The N+1 problem](README.md) · Next → [5 · Turning the SQL on](05-turning-the-sql-on.md)
