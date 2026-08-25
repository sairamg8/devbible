---
title: "A lazy association is not your class — it is a generated subclass or a collection wrapper, and that changes what getClass, instanceof and equals mean"
sidebar_label: "14 · What a lazy association is"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching* and §3.26 *equals() and hashCode()*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)),
> the Hibernate ORM 7.4 *User Guide* §3.4.9 *Create proxies that resolve their inheritance
> subtype*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the `org.hibernate.Hibernate` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Everything about fetch types assumes something is standing in for the data that has not
arrived. For a singular association that stand-in is a **proxy** — a generated subclass of
your entity carrying only an id. For a collection it is a **persistent collection** — an
implementation of `Set` or `List` that fetches its contents on first access. Neither is
the object you declared, and the difference shows up in `getClass()`, in `instanceof`,
in `equals`, and in a debugger.**

## What a proxy is

The 7.4 *Introduction* defines it:

> A proxy is an object that masquerades as a real entity or collection, but doesn't
> actually hold any state, because that state has not yet been fetched from the database.
> When you call a method of the proxy, Hibernate will detect the call and fetch the state
> from the database before allowing the invocation to proceed to the real entity object or
> collection.

So `book.getPublisher()` on a lazy `@ManyToOne` returns an object that:

- is assignable to `Publisher`, because it is a generated **subclass** of it;
- carries the identifier and nothing else;
- runs a `SELECT` the first time you call any other method on it.

The proxy exists because Hibernate had to put *something* in the field. It could not put
`null` — the association is not absent — and it could not put the real object without
querying. So it puts a shell.

## What a persistent collection is

For `@OneToMany` and `@ManyToMany`, the field is replaced with a Hibernate implementation
of the declared interface. That is why **[5](05-one-to-many-bidirectional.md)** insisted
the field be declared as `Set` and not `HashSet`, and why you must never assign a new
collection over it.

An uninitialised persistent collection is a real, non-null object that knows which entity
and which attribute it belongs to. Touch it — `size()`, `iterator()`, `contains()`,
`isEmpty()` — and it loads.

⚠️ **`isEmpty()` and `size()` both initialise the collection in the general case.** They
look like metadata questions and they are content questions. If you only need a count, run
a `SELECT count(*)` query.

## The four things this changes

### 1 · `getClass()` does not return your class

A proxy's `getClass()` returns Hibernate's generated subclass, not `Publisher.class`. So:

```java
if (book.getPublisher().getClass() == Publisher.class) { … }   // false for a proxy
```

Anything switching on `getClass()` — a type registry, a serialiser configured by class, a
hand-written `equals` — sees a class name you did not write.

### 2 · `instanceof` and casts are unreliable for polymorphic associations

The 7.4 *User Guide* states the problem precisely:

> When working with lazy associations or entity references for types that define an
> inheritance hierarchy Hibernate often creates proxies starting from the root class, with
> no information about the actual subtype that's referenced by the lazy instance. This can
> be a problem when using `instanceof` to check the type of said lazy entity references or
> when trying to cast to the concrete subtype.

So if `Payment` has subclasses `CardPayment` and `BankTransfer`, a lazy `Payment` proxy is
built from `Payment` and `payment instanceof CardPayment` is `false` even when the row is a
card payment. Hibernate's *Introduction* lists this among its three gotchas about proxies.

**The fix Hibernate provides, with its cost stated:** `@ConcreteProxy` on the hierarchy
root, which *"can be used on an entity hierarchy root mapping to specify that Hibernate
should always try to resolve the actual subtype corresponding to the proxy instance
created. This effectively means that proxies for that entity hierarchy will always be
created from the correct subclass, allowing to preserve laziness and enable using type
checks and casts."* The *Introduction* adds that it costs extra joins and *"its use is not
generally recommended, except in very special circumstances."*

The everyday answer is to avoid `instanceof` on associations, and to model behaviour that
varies by subtype as a method on the entity rather than as a type check outside it.

### 3 · `equals` must be written for proxies

The *Introduction*'s rule, from its `equals`/`hashCode` section:

> Your implementation of `equals()` must be written to accommodate the possibility that the
> object passed to the `equals()` might be a proxy. Therefore, you should use `instanceof`,
> not `getClass()` to check the type of the argument, and should access fields of the
> passed entity via its accessor methods.

Both halves matter and the second is easy to miss. `other.isbn` reads the *field* of the
proxy, which is empty — the proxy holds no state. `other.getIsbn()` goes through the
accessor, which triggers initialisation and returns the real value. Full treatment in
**[15](15-equals-hashcode-tostring.md)**.

### 4 · The debugger lies, in both directions

Expanding a lazy field in a debugger shows a proxy object with null fields, which looks
like data loss. And on some IDE settings, expanding it *initialises* it — so inspecting a
variable changes the program's query behaviour and can make a bug disappear while you look
at it.

## What you can do to a proxy without initialising it

Two operations are documented as free, and both are genuinely useful.

**Read its identifier.**

```java
var pubId = entityManager.find(Book.class, bookId).getPublisher().getId(); // does not fetch publisher
```

The proxy was built from the id, so the id is already there. This is why mapping the
association rather than a plain `Long` costs you nothing when all you need is the key —
the point raised in **[3 · @ManyToOne](03-many-to-one.md)**.

**Create an association to one.**

```java
book.setPublisher(entityManager.getReference(Publisher.class, pubId)); // does not fetch publisher
```

`getReference` returns a proxy without querying. Assigning it sets the foreign key, and
nothing is loaded. That is the efficient way to point a child at a parent you know the id
of — no `find`, no round trip.

⚠️ **Everything else initialises.** The *Introduction* notes that except for
`getReference()`, the operations in that part of the API result in immediate database
access.

## What happens when the session is gone

A proxy is only useful while its persistence context is alive. The *Introduction*'s first
gotcha:

> Hibernate will only do this for an entity which is currently associated with a
> persistence context. Once the session ends, and the persistence context is cleaned up,
> the proxy is no longer fetchable, and instead its methods throw the hated
> `LazyInitializationException`.

🔴 **That exception, open-session-in-view, and every strategy for dealing with them belong
to Topic 10 · Lazy-loading pitfalls** *(not written yet)*. This chunk names the object;
that topic owns what happens when it outlives its session.

## Gotchas

**A proxy is never `null`, so a null check tells you nothing about whether data exists.**
For a lazy `@ManyToOne` with a `NULL` foreign key you do get `null` — the column was read
with the row. For anything else, a non-null field may still be an empty shell.

**`Publisher.class.isInstance(proxy)` is `true`, `proxy.getClass() == Publisher.class` is
`false`.** Two ways of asking almost the same question with different answers. Prefer the
first.

**An uninitialised collection is not the same as an empty one.** `getBooks()` returns a
non-null collection object either way; asking whether it is empty is what tells you, and
asking is what loads it.

**A proxy's fields are empty even after initialisation, when accessed directly.** The
initialised state lives on the delegate the proxy wraps. Direct field access from inside
another instance's method — the classic `other.isbn` in `equals` — reads the proxy's own
(empty) fields. Always use the accessor.

**Lombok's generated `equals`, `hashCode` and `toString` read fields directly and use
`getClass()`.** Both proxy rules broken. See **[15](15-equals-hashcode-tostring.md)**.

**`Hibernate.unproxy(x)` returns the real instance, and is a smell more often than a fix.**
If you need it to make an `instanceof` work, the design is asking a type question of
something that should answer a behaviour question.

**Serialising an entity with an uninitialised proxy fails or triggers a fetch, depending on
the serialiser.** Jackson walking a proxy either initialises it or throws. That is
**[16](16-serialising-an-entity-graph.md)**.

**`@ConcreteProxy` costs extra joins.** It is documented as not generally recommended
outside special circumstances. It is a real tool, not a default.

## Interview questions

**★ What does Hibernate put in a lazy `@ManyToOne` field before you touch it?**
A proxy: a generated subclass of the target entity carrying only the identifier and no
other state. Hibernate's documentation describes it as an object that masquerades as the
real entity but holds no state, and that fetches from the database when a method is called
on it. It has to put something there — `null` would be wrong, since the association exists
— so it puts a shell built from the foreign-key value it read with the parent's row.

**★ Why does `instanceof` misbehave with a lazy association?**
Because for an entity hierarchy Hibernate typically builds the proxy from the root class,
with no knowledge of the actual subtype, so a lazy reference to a `CardPayment` is a proxy
of `Payment` and `instanceof CardPayment` is false. The user guide documents this and
offers `@ConcreteProxy` on the hierarchy root to make proxies resolve the concrete subtype
— at the cost of extra joins, and the introduction says its use is not generally
recommended. In everyday code the better answer is to put the varying behaviour on the
entity as a method rather than to ask type questions from outside.

**★ How must `equals` be written on an entity, given proxies exist?**
With `instanceof` rather than `getClass()`, because the argument may be a proxy whose class
is a generated subclass, and reading the other object's state through its accessor methods
rather than its fields, because a proxy's own fields are empty. Hibernate's documentation
states both requirements explicitly. Getting either wrong produces an `equals` that returns
false for two references to the same row.

**★ What can you do with a proxy without initialising it?**
Read its identifier, and use it as the target of an association. Hibernate's documentation
shows both: `getPublisher().getId()` does not fetch the publisher, and
`setPublisher(em.getReference(Publisher.class, id))` sets the foreign key without loading
anything. `getReference` is specifically the operation that does not hit the database —
almost everything else does. That pair is why mapping the association instead of a raw id
costs nothing when the id is all you need.

**★ Is an uninitialised collection null?**
No. Hibernate installs its own implementation of the declared interface, so the field holds
a real, non-null collection object that has not yet loaded its contents. Calling `size()`,
`isEmpty()`, `iterator()` or `contains()` initialises it, which is why a `size()` call that
looks like a cheap metadata question is actually a full load of every child row.

**★ Why must the collection field be declared as `Set` or `List` rather than `HashSet` or
`ArrayList`?**
Because Hibernate substitutes its own persistent-collection implementation for whatever you
assigned, and it can only do that if the declared type is an interface it can implement.
The same fact explains why you must never assign a new collection instance over a mapped
field: Hibernate tracks changes through the instance it installed, and replacing it throws
that tracking away.

---

← Prev: [13b · How it multiplies](13b-how-it-multiplies.md) · Index: [Relationships and fetch types](README.md) · Next → [14b · Inspecting initialization](14b-inspecting-initialization.md)
