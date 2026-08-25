---
title: "The owning side is the side that maps the foreign-key column — not the side that feels more important, and not the side you happened to write first"
sidebar_label: "2 · The owning side"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §3.17 *Many-to-one*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)),
> the Hibernate ORM 7.4 *User Guide* §3.8.2 *@OneToMany*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> and the Jakarta Persistence 3.2 javadocs for `@OneToMany`
> ([.../onetomany](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/onetomany))
> and `@OneToOne`
> ([.../onetoone](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/onetoone)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**There is one foreign-key column and there may be two Java fields describing it. The
owning side is whichever field maps that column for real. Everything else — `mappedBy`,
the collection that silently saves nothing, the helper method every codebase ends up
writing — is a consequence of that single definition. If you can point at the column and
then point at the field that writes it, you understand the owning side.**

## Say it as a rule, then check it against the schema

> **The owning side is the side whose table holds the foreign key.**

That is the whole rule. It is decided by the database, not by you, and not by which
entity is conceptually the "parent". Apply it:

| Relationship | Which table has the FK column | Owning side |
|---|---|---|
| `Book` ↔ `Publisher` (many books, one publisher) | `book.publisher_id` | `Book.publisher` — the `@ManyToOne` |
| `Order` ↔ `OrderLine` | `order_line.order_id` | `OrderLine.order` — the `@ManyToOne` |
| `Person` ↔ `Passport` (one-to-one) | wherever you put the column | the side you put it on |
| `Book` ↔ `Author` (many-to-many) | neither — a join table has both | you choose; see **[7 · Many-to-many](07-many-to-many.md)** |

Notice row two. `Order` is obviously the parent in business terms — it owns the lines,
it is the aggregate root, it is the thing you delete. And it is **not** the owning side.
Ownership here is a mapping term about a column, not a domain term about lifecycle. The
two words collide, unhelpfully, and the collision is why this gets misremembered.

⚠️ **"Owning" ≠ "parent" ≠ "cascades from".** `Order` cascades to `OrderLine` (see
**[8 · Cascade](08-cascade.md)**) while `OrderLine` owns the association. Both are normal
and they point in opposite directions.

## `mappedBy` marks the other side, and it names a field

Here is the pair, complete:

```java
@Entity
public class Book {

    @Id @GeneratedValue
    private Long id;

    private String isbn;
    private String title;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "publisher_id")
    private Publisher publisher;          // ← OWNING. Maps book.publisher_id.

    // getters and setters omitted
}

@Entity
public class Publisher {

    @Id @GeneratedValue
    private Long id;

    private String name;

    @OneToMany(mappedBy = "publisher")    // ← INVERSE. Maps nothing.
    private Set<Book> books = new HashSet<>();

    // getters and setters omitted
}
```

Read `mappedBy = "publisher"` out loud as a sentence and it stops being cryptic:

> *This collection is already mapped by the `publisher` field over on `Book`. I do not
> map a column of my own. Go look there.*

Two details people get wrong on sight:

- **The value is a Java field name on the other entity, not a column name.** It is
  `"publisher"` (the field `Book.publisher`), never `"publisher_id"` (the column). The
  Jakarta Persistence `@OneToMany` javadoc says the element is "the field that owns the
  relationship."
- **It is a string, so the compiler cannot check it.** Rename `Book.publisher` with an
  IDE refactor that misses annotation values and you get a startup failure, not a
  compile error. Hibernate's *Introduction* is candid about disliking this — *"we
  passionately hate the stringly-typed `mappedBy` reference"* — and offers the generated
  metamodel as a fix:

  ```java
  @OneToMany(mappedBy = Book_.PUBLISHER)   // Hibernate Processor / JPA metamodel
  private Set<Book> books = new HashSet<>();
  ```

  `Book_` is generated at build time from `Book`, so a rename that breaks the reference
  breaks the build instead of the application.

## `mappedBy` appears on exactly one side, and it is never the `@ManyToOne`

The annotations that accept `mappedBy` are `@OneToMany`, `@OneToOne` and `@ManyToMany`.
`@ManyToOne` does not have the element at all — and that is not an oversight. The many
side *always* holds the foreign key, so it is *always* the owning side, so it can never
be the one deferring to somebody else.

The practical consequence: in a one-to-many pair there is exactly one legal place to put
`mappedBy`, on the `@OneToMany`. There is no decision to make. For `@OneToOne` and
`@ManyToMany` there genuinely is a choice, and those chunks cover it.

## What `mappedBy` actually turns off

It is tempting to read `mappedBy` as "this is the other end of that". It is more precise
and more useful to read it as **"do not generate a column or a table for me, and ignore
my contents when writing."**

Concretely, on the inverse side Hibernate will not:

- create a foreign-key column or a join table for the field during schema export;
- issue an `INSERT`, `UPDATE` or `DELETE` because the collection's contents changed;
- notice or care that the collection is empty when the database has matching rows,
  until it actually loads it.

And it will still:

- load the collection when you touch it, by querying the owning side's column;
- apply `cascade` and `orphanRemoval` from the inverse side — those are *entity
  lifecycle* operations, not column writes, which is exactly why a `@OneToMany(mappedBy
  = …, cascade = ALL)` works even though the same annotation writes no column.

That last pair of bullets is the source of the most confusing behaviour in JPA: an
inverse-side collection can create and delete **rows in another table** through cascade,
while being unable to change **one column** in that same table. Both statements are
true simultaneously. Keeping them apart in your head is most of the battle.

## Why the mapping is decided once, not per operation

Hibernate does not compare the two fields at flush time and try to work out which one
you meant. It reads the annotations once at startup, builds an internal model of the
mapping, and from then on there is exactly one field that maps `book.publisher_id`.

This is worth stating because the alternative sounds reasonable — "surely it could see
the collection changed and write the column?" — and it is exactly what people
subconsciously expect. It cannot, for two reasons. It would be ambiguous the moment the
two sides disagree, and it would require scanning every loaded collection on every flush
to find changes, in a framework whose central performance claim is that flushing is
cheap. So the decision is static, and it is yours.

## Gotchas

**`mappedBy` on the wrong side produces a startup failure, not a subtle bug — be glad.**
Putting `mappedBy` on both sides, or naming a field that does not exist, or naming a
field whose type does not match, fails when the `EntityManagerFactory` is built. This is
one of the few mistakes in this topic that cannot reach production.

**`mappedBy` with `@JoinColumn` on the same field is contradictory.**
One says "I do not map a column", the other says "here is the column I map". Do not
write both on one field. If you find yourself wanting to, you have the owning side
backwards — put `@JoinColumn` on the other entity's `@ManyToOne`.

**The metamodel reference (`Book_.PUBLISHER`) needs the annotation processor on the
build path.** With Hibernate Processor (or the Jakarta Persistence static metamodel
generator) configured, `Book_` is generated into `target/generated-sources`. Without it,
`Book_` does not exist and the code does not compile. That is a build configuration you
have to add deliberately; a plain Spring Boot starter does not bring it in.

**Do not put `@OrderColumn` or `@MapKeyColumn` on the inverse side.** They specify
columns, and the inverse side does not map columns. The Hibernate 7.4 *Introduction*
states the rule directly: use `@OrderColumn`/`@MapKeyColumn` with `@ElementCollection`,
an owned `@ManyToMany` or an owned `@OneToMany`; use `@OrderBy`/`@MapKey` on the unowned
side. For `@ManyToMany(mappedBy = …)` an explicit `@OrderColumn` is documented as
**illegal**, not merely ineffective.

**A field named `publisher` on both entities makes `mappedBy` look self-referential.**
It reads as `mappedBy = "publisher"` inside a class that has no `publisher` field, and
people "fix" it by pointing it at the wrong thing. The string always names a field on
the **target** entity of the association.

## Interview questions

**★ Define the owning side without using the word "owning".**
It is the entity attribute that maps the foreign-key column. When the persistence
provider needs to write the relationship to the database, it writes the value it finds
in that attribute, and it consults no other attribute. The other side of a bidirectional
pair — the one carrying `mappedBy` — maps no column and contributes nothing to the
`INSERT` or `UPDATE`.

**★ What does the string inside `mappedBy` refer to?**
The name of the attribute on the *other* entity that owns the association. Not a column
name, not a table name, not the name of this attribute. In
`@OneToMany(mappedBy = "publisher") Set<Book> books`, the association target is `Book`,
so `"publisher"` must be an attribute of `Book`, and it must be the `@ManyToOne` back to
this entity. Because it is a plain string it is not checked by the compiler; the JPA
static metamodel (`Book_.PUBLISHER`) makes it checked at build time.

**★ Why can `@ManyToOne` never take `mappedBy`?**
Because the many side always holds the foreign key. In a one-to-many relationship the
key must live on the many table — the one table would need a variable number of columns
otherwise. The owning side is by definition the side with the key, so `@ManyToOne` is
unconditionally the owner and has nothing to defer to. The annotation does not declare
the element, so it is a compile error rather than a design decision.

**★ Can the inverse side ever change the database?**
Not the foreign-key column, no. But it can absolutely cause `INSERT`s and `DELETE`s
against the target table through `cascade` and `orphanRemoval`, because those are entity
lifecycle operations rather than column writes. So a `@OneToMany(mappedBy = "order",
cascade = ALL, orphanRemoval = true)` collection will persist and delete `OrderLine`
rows, while still being unable to set `order_line.order_id`. The rows appear with a
`NULL` foreign key — or fail a `NOT NULL` constraint — unless you also set the owning
side. That is chunk **[2b](02b-mappedby-and-the-silent-nothing.md)**.

**★ In an `Order` / `OrderLine` model, which side owns the association, and does that
match which side is the aggregate root?**
`OrderLine.order` owns it, because `order_line.order_id` is the column. `Order` is the
aggregate root and the cascade source. They are opposite, and that is normal. The word
"owning" in JPA is about column mapping and carries no implication about lifecycle,
deletion order, or which class you load first.

**★ How would you find the owning side of an unfamiliar association in code you did not
write?**
Look for `mappedBy`. Whichever side has it is the inverse side; the other is the owner.
If neither has it, the association is unidirectional and the single mapped side is the
owner by default — the Hibernate 7.4 *Introduction* lists the default for `mappedBy` as
"the association is assumed unidirectional". If both have it, the application will not
start.

---

← Prev: [1 · Two models, one key](01-two-models-one-foreign-key.md) · Index: [Relationships and fetch types](README.md) · Next → [2b · The silent nothing](02b-mappedby-and-the-silent-nothing.md)
