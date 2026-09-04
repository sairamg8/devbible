---
title: "Four honest answers when an entity has no natural key — and why @Data on an entity generates every mistake in the previous chunk at once"
sidebar_label: "15b · No natural key, and Lombok"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.26 *equals() and
> hashCode()*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)),
> the Hibernate ORM 7.4 *User Guide* §3.8.4 *@ManyToMany* (the link-entity example)
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Jakarta Persistence 3.2 specification's requirements on entity classes
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**The previous chunk's answer — base `equals` and `hashCode` on a natural key — assumes
there is one. Often there is not. An order line, an audit row, a link entity: the
identifier is genuinely all there is. There are four defensible responses and one very
common way of getting all of it wrong in a single annotation.**

## Option 1 · Override nothing

Leave `equals` and `hashCode` inherited from `Object`. Identity semantics.

**Why this is more correct than it sounds.** Within one persistence context, the
first-level cache guarantees exactly one instance per row — two `find` calls for the same id
return the same object. So `==` and `equals` agree with "same row" for the entire lifetime
of the context.

**Where it breaks.** Two objects loaded in different contexts for the same row are unequal.
So a `Set` built from entities fetched in two transactions can contain the same row twice,
and `list.contains(detachedEntity)` is false.

**When to take it.** When the entity never leaves a single persistence context in a form
where equality matters — which describes a great many entities in a request-scoped Spring
application. It is the default, it is honest, and it never lies about equality; it only
declines to make a claim it cannot support.

## Option 2 · Assign the identifier yourself

```java
@Entity
public class OrderLine {

    @Id
    private UUID id = UUID.randomUUID();     // assigned by the constructor, never by the DB

    @Override public boolean equals(Object o) {
        return o instanceof OrderLine other && id.equals(other.getId());
    }
    @Override public int hashCode() { return id.hashCode(); }
}
```

This satisfies Hibernate's third principle exactly — *"It's OK to include any immutable,
non-generated field in the hashcode"* — because the id exists from the moment the object
does and never changes. Both failure modes from
**[15](15-equals-hashcode-tostring.md)** disappear.

**The trade is storage and index behaviour.** A `uuid` is 16 bytes against a `bigint`'s 8,
and random UUIDs scatter across a B-tree index rather than appending to it, which costs
write throughput on a large, hot table. A time-ordered UUID (version 7) recovers most of the
locality; whether that matters depends on volume.

**A second trade:** Hibernate must be told the row is new. With a database-generated id,
"id is null" means "not yet inserted". With a client-assigned id there is no such signal, so
a `merge`-based save path can issue a `SELECT` before every insert. A `@Version` field
resolves it, and so does calling `persist` rather than `save` where you know the entity is
new.

## Option 3 · The careful id-based version

Hibernate's *Introduction* permits it with a warning:

> That said, an implementation of `equals()` and `hashCode()` based on the generated
> identifier of the entity can work if you're careful.

The shape that is actually safe is a **constant** `hashCode` with an id-aware `equals`:

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof OrderLine other)) return false;
    return id != null && id.equals(other.getId());
}

@Override
public int hashCode() {
    return getClass().hashCode();     // constant for the type — never changes
}
```

Read what each line buys. The constant hash cannot change when the id is assigned, so the
object never gets lost in a bucket. The `id != null` guard means two *transient* instances
are equal only if they are the same object, which is the correct answer — two unsaved order
lines are not the same line. And `instanceof` plus `other.getId()` handles proxies.

**The cost is real:** every `HashSet` of this type degenerates into a single bucket, so
lookups are linear. Acceptable for entities that live in small collections — an order's
lines — and unpleasant for anything held in bulk.

## Option 4 · A composite key of the associations

For a link entity, the pair of foreign keys *is* the identity. Hibernate's own
`PersonAddress` example in the user guide does this, with `@Id` on each `@ManyToOne` and
`equals`/`hashCode` over both:

```java
@Entity
public class PersonAddress implements Serializable {

    @Id @ManyToOne
    private Person person;

    @Id @ManyToOne
    private Address address;

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof PersonAddress that)) return false;
        return Objects.equals(person, that.getPerson())
            && Objects.equals(address, that.getAddress());
    }

    @Override public int hashCode() { return Objects.hash(person, address); }
}
```

It works because those two associations are set once and never change for the life of the
link row — the immutability requirement, satisfied by the domain rather than by a
constructor. Note the class must be `Serializable`, and note that this recurses into the
associated entities' own `equals`/`hashCode`, so those had better be sound too.

## Choosing between the four

| Situation | Take |
|---|---|
| The entity lives inside one persistence context and equality never crosses it | **1** — override nothing |
| You control the schema and can afford a UUID key | **2** — assign it yourself |
| Existing `bigint` identity key, small collections | **3** — constant hash, id-aware equals |
| A link entity whose two associations are its identity | **4** — composite |
| There *is* a natural key | none of these — **[15](15-equals-hashcode-tostring.md)** |

## The Lombok trap

```java
@Data                 // ⛔ on an entity
@Entity
public class Book { … }
```

`@Data` bundles `@Getter`, `@Setter`, `@ToString`, `@EqualsAndHashCode` and a required-args
constructor. On an entity with associations, that is four problems, and they map one-to-one
onto the previous chunk:

1. **`@ToString` includes every field, associations included** → recursion across a
   bidirectional pair, or a fetch from a log statement.
2. **`@EqualsAndHashCode` includes every field, associations included** → the same
   recursion, plus a hash that depends on a lazy collection's contents, which changes when
   the collection loads.
3. **`@EqualsAndHashCode` uses a class-based check by default** → false for a proxy of the
   same row.
4. **`@Setter` generates a public setter for the collection field** → replacing Hibernate's
   persistent collection and losing change tracking (**[2c](02c-keeping-both-sides-in-step.md)**).

⚠️ **`@EqualsAndHashCode(onlyExplicitlyIncluded = true)` fixes the recursion and not the
proxy problem.** Reducing the included fields to the id still leaves a generated,
class-based comparison and a hash over a value that changes on persist. The recursion is the
loud failure; the other two are quiet.

If Lombok is used, the minimum discipline is to be explicit and to hand-write the two
methods:

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(onlyExplicitlyIncluded = true)
public class Book {

    @Id @GeneratedValue
    private Long id;

    @NaturalId
    @ToString.Include
    private String isbn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "publisher_id")
    private Publisher publisher;              // no @ToString.Include

    @Override public boolean equals(Object o) {
        return o instanceof Book other && isbn.equals(other.getIsbn());
    }
    @Override public int hashCode() { return isbn.hashCode(); }
}
```

`@Getter` only — no class-level `@Setter`. `toString` opt-in. `equals`/`hashCode` written by
hand. The no-args constructor `protected`, because JPA requires one and nothing in your code
should use it.

## Why an entity cannot be a `record`

Three independent reasons, each fatal:

- **Records are `final`.** A provider cannot generate a proxy subclass, so no lazy singular
  association to that type can exist.
- **Records have no no-argument constructor.** JPA requires one so the provider can create
  an instance before populating it.
- **Record components are `final`.** The provider cannot set fields on a constructed
  instance, and dirty checking has nothing to observe.

Records are an excellent fit for `@Embeddable` value types (**[11](11-element-collection.md)**)
and for DTOs, where immutability and generated `equals`/`hashCode` are precisely what you
want.

## Gotchas

**Option 3's constant `hashCode` is correct and slow, and that is a deliberate trade.** It
satisfies the `equals`/`hashCode` contract — equal objects have equal hashes — while
guaranteeing the hash never changes. It just makes every hash bucket the same one.

**A client-assigned id removes Hibernate's "is this new?" signal.** With no `@Version` and a
`merge`-based save, you can get a `SELECT` before every insert. Use `persist` for new
entities, or add `@Version`.

**Option 4 recurses into the associated entities' `equals`.** A link entity keyed on two
associations is only as sound as their equality implementations, and if either is a proxy
you are back to the accessor-versus-field rule.

**Lombok's `@EqualsAndHashCode` on a subclass warns about `callSuper` and the default is
usually wrong for entities.** Whichever way you set it, you are configuring a generated
implementation of something that needed thought.

**`@Data` also generates a required-args constructor, which is not the no-arg constructor
JPA needs.** You will get a runtime failure from the provider, or Lombok will add nothing
and the class will fail for a different reason.

**An IDE-generated `equals`/`hashCode` has the same defects as Lombok's.** They use
`getClass()` and read fields directly. Generated code is not a shortcut past this decision.

## Interview questions

**★ What do you do for an entity with no natural key?**
Four options, and the choice is contextual. Override nothing and rely on identity semantics
— correct within a persistence context, because the first-level cache guarantees one
instance per row. Assign the identifier yourself, typically a UUID created in the
constructor, which makes it immutable and present from the start, exactly the case
Hibernate's guidance blesses. Use a constant `hashCode` with an id-aware `equals`, which is
safe but degrades hash performance. Or, for a link entity, key on the two associations,
which is what Hibernate's own example does.

**★ Why is a constant `hashCode` sometimes the right answer?**
Because the `equals`/`hashCode` contract only requires that equal objects have equal hashes,
not that unequal objects differ. A constant satisfies it trivially and — crucially — can
never change when the identifier is assigned, which is the failure mode of an id-based hash.
The price is that every hash-based collection of that type degenerates to linear lookup, so
it is fine for entities held in small collections and poor for anything held in bulk.

**★ What is the downside of a client-assigned UUID key?**
Two. Storage and index behaviour: 16 bytes rather than 8, and random UUIDs scatter across a
B-tree rather than appending, which costs write throughput on large hot tables — a
time-ordered UUID recovers most of that. And Hibernate loses its "id is null means new"
signal, so a `merge`-based save path may issue a `SELECT` before each insert; a `@Version`
field or using `persist` directly resolves it.

**★ Why is `@Data` on a JPA entity a problem?**
It generates four things that are each wrong here. `toString` over every field recurses
across a bidirectional pair or fetches a lazy collection from a log line. `equals` and
`hashCode` over every field do the same and additionally make the hash depend on a
collection's contents. The generated equality check is class-based rather than
`instanceof`-based, so it fails for proxies. And the class-level `@Setter` produces a public
setter for the collection field, which lets code replace Hibernate's persistent collection
and lose change tracking.

**★ Does `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` make Lombok safe on an entity?**
It fixes the loudest problem — the recursion — and leaves two quiet ones. The generated
comparison is still class-based, so it returns false for a proxy of the same row, and if the
included field is a database-generated id the hash still changes when the entity is
persisted. Since the decision needs thought either way, writing the two methods by hand is
both safer and clearer about what identity means for that entity.

**★ Can a JPA entity be a Java `record`?**
No, for three independent reasons. Records are final, so a provider cannot subclass them to
build a proxy, which rules out lazy singular associations to that type. They have no
no-argument constructor, which JPA requires so the provider can create an instance before
populating it. And their components are final, so the provider cannot set fields and dirty
checking has nothing to observe. Records are the right shape for `@Embeddable` value types
and for DTOs, where immutability and generated equality are exactly what you want.

---

← Prev: [15 · equals, hashCode, toString](15-equals-hashcode-tostring.md) · Index: [Relationships and fetch types](README.md) · Next → [16 · Serialising an entity graph](16-serialising-an-entity-graph.md)
