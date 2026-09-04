---
title: "The mapping documentation recommends for a lazy column is not `@Lob` — the annotation people reach for selects the JDBC LOB APIs, on PostgreSQL it changes the column type, it has nothing to do with laziness in either direction, and the second lazy column you add cancels the first"
sidebar_label: "08b · The @Lob reflex and the lazy group"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `@Basic` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/basic)),
> the Hibernate ORM 7.4 *User Guide* §3.2.1 `@Basic` and §3.2.47 *Handling LOB data*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the Hibernate ORM 7.4 *Introduction* §4.10 *LOBs* and §9.15 *Using the bytecode
> enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**[08 · Lazy basic attributes](08-lazy-basic-attributes.md)** established that column laziness
is a build-time feature and that without the enhancer the annotation is ignored. This chunk is
about the mapping you write next to it — the one the documentation recommends, the one almost
everybody writes instead, and what that substitution costs on PostgreSQL. It ends with the two
things that decide whether the feature is worth turning on at all: lazy columns come in groups,
so the unit of failure is never the single field you marked, and a projection solves the same
problem with no build step at all.

## The mapping the documentation actually recommends

The introduction's own example, in §9.15:

```java
@Entity
class Book {
    @Id @GeneratedValue
    Long id;

    String title;

    @Basic(optional = false, fetch = FetchType.LAZY)
    @Column(length = Length.LONG32)
    String fullText;
}
```

Three things are deliberate:

- **`fetch = LAZY`** is the request. It is a request, not an instruction.
- **`@Column(length = LONG32)`** is how you get a `text` / `clob` column *without* `@Lob`.
  `org.hibernate.Length` defines the constant; the schema exporter picks the widest type the
  dialect supports. The user guide is blunt about the alternative: *"Please don't (ab)use JPA's
  `@Lob` annotation just because you want a `TEXT` column. The purpose of the `@Lob` annotation
  is not to control DDL generation!"*
- **`optional = false`** asserts the column is `NOT NULL`. On a basic attribute this is mostly
  a schema-generation input, not a fetching one — see below.

## Why `@Lob` is the wrong reflex, especially on PostgreSQL

Almost every article about lazy columns reaches for `@Lob`, because the use case is a large
value and `@Lob` looks like the annotation for large values. The Hibernate 7.4 introduction
disagrees, in §4.10:

> *"In Hibernate, an attribute annotated `@Lob` will be written to JDBC using the `setClob()`
> or `setBlob()` method of `PreparedStatement`, and will be read from JDBC using the
> `getClob()` or `getBlob()` method of `ResultSet`. Now, the use of these JDBC methods is
> usually unnecessary! JDBC drivers are perfectly capable of converting between `String` and
> `CLOB` or between `byte[]` and `BLOB`. So unless you specifically need to use these JDBC LOB
> APIs, you don't need the `@Lob` annotation."*

And, for the database this phase pins:

> *"This is particularly true for PostgreSQL. Unfortunately, the driver for PostgreSQL doesn't
> allow `BYTEA` or `TEXT` columns to be read via the JDBC LOB APIs. … **Conclusion: on
> PostgreSQL, `@Lob` always means the OID type, `@Lob` should never be used to map columns of
> type `BYTEA` or `TEXT`**, and please don't believe everything you read on stackoverflow."*

The annotation table in the same document lists `@Lob` with a skull marker and the gloss *"Use
JDBC LOB APIs to read and write the annotated attribute"*. The user guide agrees from the other
direction, in §3.2.47: *"You don't need to use a `@Lob` mapping for every database column of
type `BLOB` or `CLOB`. The `@Lob` annotation is a special-purpose tool that should only be used
when a default basic mapping to `String` would result in unacceptable performance
characteristics."*

**None of this makes the column load lazily or not.** `@Lob` and `@Basic(fetch = LAZY)` are
orthogonal: laziness comes from enhancement either way. What `@Lob` changes is the JDBC access
path and, on PostgreSQL, the column type you get — which is why adding it "so the lazy fetch
works" is a change that cannot help and can silently move your data into large-object storage.

## The one case where a LOB locator earns its place

If the value is genuinely too large to hold in memory, the alternative is not a lazy column but
a locator type — `java.sql.Blob` or `java.sql.Clob` — obtained through `LobHelper`:

```java
LobHelper helper = session.getLobHelper();
book.text = helper.createClob(text);
```

The user guide's description of the trade, §3.2.47:

> *"These types represent references to off-table LOB data. In principle, they allow JDBC
> drivers to support more efficient access to the LOB data. Some drivers stream parts of the
> LOB data as needed, potentially consuming less memory. However, `java.sql.Blob` and
> `java.sql.Clob` can be unnatural to deal with and suffer certain limitations. For example,
> **it's not portable to access a LOB locator after the end of the transaction in which it was
> obtained.**"*

That last sentence puts a locator squarely inside this topic's subject matter, and it is worth
being precise about the difference: a detached entity holding a `Clob` field will not throw
`LazyInitializationException`, because nothing about it is a Hibernate proxy. It will fail —
or not — according to your JDBC driver, with a driver-specific exception, at a point that has
nothing to do with Hibernate's session. **It is the same lifetime bug with none of the same
diagnostics**, which is a good reason to prefer a materialized `String` plus a query that does
not select it.

## `optional` on a basic attribute is not `optional` on an association

Both spellings exist and they do different jobs. The Jakarta javadoc for `@Basic#optional`:

> *"(Optional) Specifies whether the value of the field or property may be null. This is a hint
> and is disregarded for primitive types; it may be used in schema generation to infer that the
> mapped column is not null."*

Default `true`. Hibernate's §3.2.1 adds where it stands: *"As long as the type is not
primitive, Hibernate will honor this value. Works in conjunction with `@Column#nullable`."*

So on a **basic attribute**, `optional = false` is a nullability assertion that feeds DDL and
Hibernate's own null checking. It does **not** unlock laziness, and it does not make an
unenhanced build lazy.

On an **association**, `optional = false` can be load-bearing for fetching — specifically on
the unowned side of a `@OneToOne`, where it is the difference between a mapping Hibernate can
serve lazily and one it cannot. That case belongs to
**[09b · Symptoms that are not this exception](09b-symptom-to-chunk.md)** and to
**[Topic 08 · 4d · The ones you cannot make lazy](../08-the-n-plus-1-problem/04d-the-ones-you-cannot-make-lazy.md)**.
Do not carry intuition from one to the other; the annotation element has the same name and a
different consequence.

## One lazy column is never one lazy column

The introduction, same section:

> *"By default, Hibernate fetches all lazy fields of a given entity at once, in a single
> `select`, when any one of them is accessed. Using the `@LazyGroup` annotation, it's possible
> to assign fields to distinct 'fetch groups', so that different lazy fields may be fetched
> independently."*

The practical effect is that the second `@Basic(fetch = LAZY)` you add to an entity can undo the
first. Mark a 200 kB body lazy, then mark a small audit note lazy as well, and every request
that reads the note also loads the body — one extra statement, and the entire payload you were
trying to avoid.

The grouping rules, the asymmetry between singular and plural attributes, `@LazyGroup` itself
and what interception-based dirty tracking costs on the write side are argued in full in
**[Topic 08 · 13d · Lazy groups and the cost](../08-the-n-plus-1-problem/13d-lazy-groups.md)**.
This topic needs only the consequence: **the unit of failure is the group, not the field.**

## Turning it on belongs to Topic 08

Enabling enhancement — the Gradle plugin and the two braces that decide whether it runs at all,
the Maven plugin, the runtime `ClassTransformer` route and why it is not yours, the four
options and their defaults, and how to verify that the class files were actually rewritten — is
**[Topic 08 · 13c · Bytecode enhancement](../08-the-n-plus-1-problem/13c-bytecode-enhancement.md)**.
The over-fetching argument for wanting it, and the entity whose `hashCode` re-creates the
problem, are
**[Topic 08 · 4e · Lazy columns and hashCode](../08-the-n-plus-1-problem/04e-lazy-columns-and-hashcode.md)**.

What this topic owns is the other side of that switch: **what new failures exist the day
enhancement starts working**, which is **[08c](08c-when-enhancement-is-on.md)**.

## The boundary answer, which needs no plugin at all

Before reaching for a build-time class rewrite, notice that the problem it solves — "do not
read this column on this code path" — is solved completely by not selecting it:

```java
public record BookSummary(Long id, String title, String author) {}

@Query("select new com.acme.BookSummary(b.id, b.title, b.author.name) from Book b")
List<BookSummary> summaries();
```

The column is absent from the SQL, absent from the result set and absent from the returned
object. No enhancement, no group, no interceptor, and nothing that can fail after the
transaction ends — which is the same argument **[05 · The DTO boundary](05-the-dto-boundary.md)**
makes about associations, applied one level down.

**Enhancement earns its keep when the *entity* is the thing you need** — a write path that
loads a `Book`, changes its title and flushes, and should not drag 200 kB through the network
to do it. On a read path that already knows what it wants, a projection is smaller, safer and
visible in the source.

## Gotchas

**★ Adding `@Lob` does not make a column lazy.** The two annotations are unrelated
mechanisms. `@Lob` selects the JDBC LOB APIs; laziness comes from enhancement. On PostgreSQL,
adding it also changes what the column *is*: the introduction states `@Lob` always means the
OID type there, and should never be used for `BYTEA` or `TEXT`.


**★ A `@Lob` added for laziness on an existing PostgreSQL table is a schema change, not an
annotation change.** If the column is `text` or `bytea` and the mapping now says `@Lob`, the
read path goes through `getClob()`/`getBlob()` against a column type the driver will not serve
that way. This tends to surface as a driver error nobody connects to the lazy-loading ticket
that caused it.


**★ `optional = false` on a `@Basic` does not enable anything.** It is a nullability hint used
for schema generation and null checking, and the specification says it is *"disregarded for
primitive types"*. People carry it over from the `@OneToOne` case, where it genuinely does
affect fetching, and conclude their column mapping is now correct.


**★ The second lazy column silently cancels the first.** All singular lazy attributes share
one group by default, so touching any of them fetches all of them. An entity with one
carefully lazy blob and one convenient lazy note has, in effect, no lazy blob on any path that
reads the note.


**★ `@Lob` on a `byte[]` plus enhancement gives you a field whose in-place mutations are not
tracked.** The introduction warns about interception-based dirty tracking generally:
*"Interception is able to detect writes to the `image` field, that is, replacement of the whole
array. It's not able to detect modifications made directly to the elements of the array, and so
such modifications may be lost."* Mutating a byte in place and flushing writes nothing.


## Interview questions

**★ Should a large text column be mapped `@Lob`?**
Usually not. The Hibernate documentation's position is that `@Lob` selects the JDBC LOB APIs —
`setClob`/`getClob`, `setBlob`/`getBlob` — and that drivers are perfectly capable of converting
between `String` and `CLOB` without them, so unless you specifically need those APIs you do not
need the annotation. `@Column(length = LONG32)` gets you the wide column type. On PostgreSQL
this is stronger than a preference: the documentation says `@Lob` there always means the OID
type and should never be used for `BYTEA` or `TEXT` columns. And crucially, `@Lob` has nothing
to do with laziness in either direction.


**★ What is the difference between `optional = false` on a `@Basic` and on a `@OneToOne`?**
On a basic attribute it is a nullability assertion — a hint, disregarded for primitives, used
for schema generation and null checking, with no effect on fetching. On the unowned side of a
`@OneToOne` it is a statement Hibernate can use to decide whether it needs to query in order to
know whether the reference is null, which is the thing that decides whether that side can be
lazy at all. Same element name, different machinery, and assuming the association behaviour on
a column is a common way to conclude a mapping is fixed when nothing changed.


**★ When would you choose a projection over enhancement for a large column?**
Whenever the call site is a read that already knows the shape it wants, which is most of them.
A projection removes the column from the SQL, from the result set and from the object, with no
build step, no interceptor, nothing that can be silently switched off by a build change, and
nothing that can fail after the transaction closes. Enhancement is the right answer when the
managed entity itself is what you need — a write path that loads, mutates and flushes — because
there a projection cannot help: you need the real entity, just not all of it.


{/* FOOTER */}
