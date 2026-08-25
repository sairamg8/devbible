---
title: "Almost every field maps itself — the annotations exist for the handful that cannot, and for telling the logical layer apart from the mapping layer"
sidebar_label: "3 · Fields, columns, access"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.2.1 *@Basic*, §3.2.2
> *@Column* and §3.6 *Access strategies*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §3.10 *Basic attributes*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Jakarta Persistence 3.2 specification §2.2 *Persistent Fields and Properties*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Every non-`transient`, non-`static` field of an entity is persistent unless you say
otherwise. That default is the reason JPA mappings are usually short, and it is also
the reason people are surprised by columns they never asked for. This chunk covers the
opt-out (`@Transient`), the two annotations that describe a persistent attribute
(`@Basic` and `@Column`), and the fact — which almost nothing on the web explains
clearly — that those two live in *different layers* and therefore do different jobs.**

## The default is "persist everything"

```java
@Entity
public class Customer {

    @Id @GeneratedValue
    private Long id;

    private String email;          // mapped, column "email"
    private String displayName;    // mapped, column "display_name" under Boot
    private Instant createdAt;     // mapped, column "created_at"
    private int loginCount;        // mapped, NOT NULL because it is primitive

    private transient String cachedGreeting;   // NOT mapped — Java transient
}
```

Nothing here says "persist this". The mapping is implied. The one field that is *not*
mapped opted out with the Java keyword `transient`, which JPA honours.

Two opt-outs exist and they are not interchangeable:

| Opt-out | What it means |
|---|---|
| `transient` (Java keyword) | Excluded from Java serialization **and** from JPA mapping. |
| `@Transient` (`jakarta.persistence`) | Excluded from JPA mapping only; still serialized. |

`@Transient` is usually the one you want, because most entities are never Java-
serialized and you do not want to entangle the two concerns.

```java
@Transient
private String cachedGreeting;   // still serializable, just not persisted
```

## `@Basic` and `@Column` are not two ways to say the same thing

This is the distinction the Hibernate Introduction §3.10 draws, and it is worth
quoting because it explains a lot of otherwise-arbitrary behaviour:

> annotations like `@Entity`, `@Id`, and `@Basic` belong to the **logical layer** […]
> they specify the semantics of your Java domain model, whereas annotations like
> `@Table` and `@Column` belong to the **mapping layer** […] they specify how elements
> of the domain model map to objects in the relational database.
>
> Information may be inferred from the logical layer down to the mapping layer, but is
> never inferred in the opposite direction.

The worked consequence:

```java
@Basic(optional = false)  String firstName;   // logical: Hibernate checks before writing
@Column(nullable = false) String lastName;    // mapping: affects generated DDL only
```

The Introduction spells out the asymmetry: "`optional=false` implies
`nullable=false`, but `nullable=false` does not imply `optional=false`." So
`@Basic(optional = false)` gives you both a not-null constraint in generated DDL *and*
a check inside Hibernate. `@Column(nullable = false)` gives you only the DDL — and if
your DDL comes from Flyway rather than Hibernate, it gives you nothing at all.

Hence the Introduction's recommendation, which is worth adopting: "we prefer
`@Basic(optional=false)` to `@Column(nullable=false)`" — and, better still, Bean
Validation's `@NotNull`, which is checked on lifecycle events and produces a proper
validation error rather than a constraint violation from the database.

**`@Basic` also carries `fetch`.** `@Basic(fetch = FetchType.LAZY)` asks for a
*basic* attribute — a single column, not an association — to be loaded on demand. The
User Guide is careful here: "Jakarta Persistence requires providers to support EAGER,
while support for LAZY is optional […] Hibernate supports lazy loading of basic values
as long as you are using its bytecode enhancement support." Without the bytecode
enhancer the annotation is silently ignored, which is exactly the kind of quiet no-op
worth knowing about before you rely on it for a large `text` column.

**`@Column` carries everything about the database object**: `name`, `nullable`,
`length`, `precision`, `scale`, `unique`, `insertable`, `updatable`,
`columnDefinition`. All of them except `insertable` and `updatable` are schema-
generation concerns.

## `insertable` and `updatable` are the two `@Column` members that act at runtime

These two are the exception to "@Column is DDL only", and they are genuinely useful:

```java
@Column(name = "created_at", nullable = false, updatable = false)
private Instant createdAt;
```

`updatable = false` removes the column from every generated `UPDATE`. That is how you
make a column write-once without a database trigger. `insertable = false, updatable =
false` makes an attribute read-only from Java's point of view — the right mapping for a
column filled in by a database default or trigger, where you want to *read* the value
but never write it.

⚠️ Read-only in this sense means "never written". It does **not** mean "refreshed after
the database changes it". If a trigger computes the value on insert, your in-memory
entity still holds whatever it had. Getting the computed value back requires
`refresh()` — see [13c · remove, refresh, detach,
clear](13c-remove-refresh-detach-clear.md) — or Hibernate's `@Generated`, which tells
Hibernate to read the value back after the write.

## Access strategy decides *how* Hibernate reads and writes those fields

[1b · The rules the spec imposes](01b-the-rules-the-spec-imposes.md) established that
the placement of `@Id` picks field access or property access. The consequence for this
chunk is that **the access strategy decides where your other annotations must go**:

```java
@Entity
public class Customer {

    @Id                                   // on a FIELD → field access
    private Long id;

    @Column(name = "email_address")       // read: on a field, consistent ✅
    private String email;

    // @Column here would be IGNORED, because access is field-based
    public String getEmail() { return email; }
}
```

Put `@Column` on the getter in a field-access entity and it is not read at all. No
warning, no error — the attribute is simply mapped with defaults and your intended
column name never appears. This is the highest-frequency silent mapping bug in JPA and
it survives code review easily, because both placements look correct in isolation.

The User Guide §3.6 covers this under "Access strategies", and the Introduction's
advice bears repeating: put `@Id` on a field, put everything else on fields, and never
reach for `@Access`.

## `@Formula` — a read-only column that is really an expression

Hibernate offers a mapping with no column behind it at all:

```java
import org.hibernate.annotations.Formula;

@Formula("(select count(*) from orders o where o.customer_id = id)")
private long orderCount;
```

The User Guide: "`@Formula` allows mapping any database computed value as a virtual
read-only column," and warns that it "takes a native SQL clause which may affect
database portability."

Two things to be clear about, because `@Formula` looks like a free lunch. It is
**Hibernate-specific**, not JPA. And the subquery runs as part of loading the entity —
every time you load the entity, including when you load a hundred of them. That makes
it a query-count concern, and query counts on collections are
**Topic 08 · The N+1 problem** *(not written yet)*.

## Gotchas

**A field you forgot to annotate is still a column.**
Add a `private String internalNote` for debugging and `ddl-auto: validate` fails,
because the schema has no such column. Under `ddl-auto: update` it silently adds one,
which is one of several reasons `update` is not for production —
**17 · `ddl-auto`** *(not written yet)*.

**Primitive types are inferred `NOT NULL`.**
The Introduction: "primitively-typed attributes are inferred NOT NULL by default." So
`int loginCount` generates a not-null column and cannot represent "unknown". If the
column is genuinely nullable, use `Integer`. This is the same wrapper-versus-primitive
decision as the identifier, for a related reason.

**`@Column(nullable = false)` on a Flyway-managed schema does nothing.**
It is not a runtime check. The entity happily holds `null`, the INSERT goes to the
database, and the database's own constraint rejects it — as a
`DataIntegrityViolationException` at flush time, from somewhere far away from the code
that set the field. `@Basic(optional = false)` or `@NotNull` fails earlier and with a
better message.

**`@Column(length = 255)` is only ever DDL.**
Nothing truncates or validates the string at runtime. On a migration-managed schema,
an over-long value reaches the database and comes back as a constraint error. Bean
Validation's `@Size` is the runtime check.

**`updatable = false` does not stop you changing the field in Java.**
The setter works, the in-memory object changes, dirty checking may still consider the
entity modified — the column is simply omitted from the UPDATE. So the object and the
row silently disagree until the next load. If the value must not change, do not expose
a setter.

**`@Transient` and `transient` are different, and mixing them up hurts in opposite
directions.**
`@Transient` on a field you also needed excluded from serialization leaves it in your
serialized form. Java `transient` on a field you wanted persisted quietly drops a
column. Neither produces an error.

**A `static` field is never mapped, and neither is a `final` one usefully.**
`static` is excluded by definition. `final` is excluded in practice under field access,
because Hibernate cannot write it — which means an entity populated from a row will
still hold the constructor's value. Immutability in an entity comes from not exposing a
setter, not from `final`.

**Lombok `@Data` on an entity generates `equals`/`hashCode` over every field.**
Including the generated id and every mutable column. That is precisely the failure in
[10 · equals and hashCode](10-equals-and-hashcode.md). It also generates a `toString`
that touches every attribute, which will initialise lazy associations just by logging
the object.

**`@Basic(fetch = LAZY)` without bytecode enhancement is a no-op.**
The annotation compiles, the mapping is accepted, and the column is fetched eagerly
anyway. If you are mapping a large `text` or `bytea` column and need it lazy, either
enable the enhancer or — usually simpler and always effective — move the column to its
own entity, which is **Topic 07 · Relationships and fetch types** *(not written yet)*.

## Interview questions

**★ Which fields of an entity are persistent by default?**
All of them, except `static` fields, Java `transient` fields, and fields annotated
`@Transient`. There is no opt-in step. That default is why simple entities need almost
no annotations, and why adding a field to an entity is a schema change whether you
meant it to be or not.

**★ What is the difference between `@Transient` and the `transient` keyword?**
The keyword excludes a field from Java serialization, and JPA also honours it as an
exclusion from mapping. The annotation excludes it from mapping only, leaving
serialization alone. Since most entities are never Java-serialized, `@Transient` is
usually the right one — it says exactly what you mean and nothing more.

**★ Why is `@Basic(optional = false)` preferred over `@Column(nullable = false)`?**
Because they act in different layers. `@Basic` is logical-layer: it describes the
domain model, so Hibernate checks it before writing the entity out, and it *infers*
`nullable = false` down into the mapping layer for DDL generation. `@Column` is
mapping-layer: `nullable = false` only shapes generated DDL and is inferred in no
direction at all. On a project where migrations own the schema, the `@Column` form is
inert while the `@Basic` form still catches the bug.

**★ Someone puts `@Column(name = "email_address")` on a getter in an entity whose `@Id` is on a field. What happens?**
Nothing — and that is the problem. The access strategy is field-based because `@Id` is
on a field, so Hibernate reads mapping annotations from fields and never looks at the
getter. The attribute is mapped with its default name, `email` (or `email` converted by
the physical naming strategy). There is no warning. The symptom is a schema validation
failure or a missing column at runtime, a long way from the annotation.

**★ Which parts of `@Column` actually do something at runtime?**
`insertable` and `updatable`. Everything else — `nullable`, `length`, `precision`,
`scale`, `unique`, `columnDefinition` — is input to schema generation and is inert once
the schema exists. `updatable = false` omits the column from generated UPDATE
statements, and `insertable = false` omits it from INSERTs, which together give you a
read-only attribute for a database-computed column.

**★ You want a large `text` column loaded only on demand. What are your options and which works?**
`@Basic(fetch = FetchType.LAZY)` is the direct expression of the intent, but JPA makes
LAZY optional for basic attributes and Hibernate only honours it with bytecode
enhancement enabled — without it the annotation is silently ignored, which is worse
than an error because you believe you fixed it. The reliable structural fix is to move
the column into a separate entity with a one-to-one association, which makes the
laziness a property of the association rather than of the column.

**★ What does `@Formula` do, and what is its cost?**
It maps an attribute to a SQL expression instead of a column — a virtual, read-only
value computed by the database as part of loading the entity. It is a Hibernate
extension, not JPA, and because the expression is raw SQL it ties the mapping to a
dialect. The cost is that the expression is evaluated every time the entity is loaded;
if it contains a correlated subquery and you load a page of entities, you have bought a
subquery per row.

**★ Why does `int` behave differently from `Integer` in a mapping?**
Two ways. A primitive cannot be null, so Hibernate infers a not-null column for it and
you lose the ability to represent "unknown". And `@Basic(optional = false)` is
explicitly documented as ignored for primitive types, since the constraint is already
implied. For an identifier the same reasoning has an extra consequence: the
transient-versus-detached heuristic reads a primitive `0` as ambiguous, where a `null`
wrapper is not.

---

← Prev: [2 · @Entity and @Table](02-entity-and-table.md) · Index: [The JPA/Hibernate model](README.md) · Next → [4 · Enums and the ORDINAL trap](04-enums-ordinal-corruption.md)
