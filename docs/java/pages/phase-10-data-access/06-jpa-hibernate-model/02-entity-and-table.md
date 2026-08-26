---
title: "@Entity names a thing in your query language; @Table names a thing in your database — confusing the two is the first mapping bug everyone writes"
sidebar_label: "2 · @Entity and @Table"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §3.4.6 *Mapping the
> entity* and §3.5 *Naming strategies*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §4.3 *Mapping entities to tables*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Spring Boot 4.1 reference *Data → SQL databases*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**There are two names in play and they belong to two different worlds. The **entity
name** is what you write in JPQL. The **table name** is what appears in SQL. They
default to the same string, which is why most people never notice they are separate —
until a second class with the same simple name breaks startup, or a `@Table(name=...)`
fails to change a query. This chunk pulls them apart and then explains the naming
strategy that sits between your Java identifiers and your actual column names.**

## Two names, two worlds

```java
@Entity                       // entity name defaults to "Customer"
@Table(name = "customers")    // table name is "customers"
public class Customer {
    @Id @GeneratedValue
    private Long id;
    private String email;
}
```

Now JPQL uses the *entity* name:

```java
entityManager.createQuery("select c from Customer c where c.email = :e", Customer.class);
```

and the SQL Hibernate builds uses the *table* name — it selects from `customers`,
not from `Customer`:

```sql
select ... from customers where email = ?
```

Change `@Table(name = ...)` and the JPQL is unaffected. Change
`@Entity(name = ...)` and the JPQL must change with it. They are independent knobs.

The User Guide states the default: "if the `name` attribute of the `@Entity` annotation
is missing, the unqualified name of the entity class itself will be used as the entity
name," and "by default, the name of the table is assumed to be the same as the name of
the entity."

## The collision that stops your application starting

Because the entity name defaults to the *unqualified* class name, two entities with the
same simple name collide even in different packages. The User Guide explains why this
is a rule and not a bug:

> Hibernate does not allow registering multiple entities with the same name even if the
> entity classes reside in different packages. Without imposing this restriction,
> Hibernate would not know which entity class is referenced in a JPQL query if the
> unqualified entity name is associated with more than one entity class.

So `billing.Address` and `shipping.Address` cannot coexist as written. The fix is to
rename one *entity*:

```java
package com.example.billing;

@Entity(name = "BillingAddress")
@Table(name = "billing_address")
public class Address { ... }
```

JPQL now says `from BillingAddress`. The Java class is still `Address`. The table is
`billing_address`. Three names, all deliberate.

## `@Table` also carries the schema and the catalog

```java
@Entity
@Table(
    name = "customers",
    schema = "sales",
    uniqueConstraints = @UniqueConstraint(name = "uk_customers_email", columnNames = "email"),
    indexes = @Index(name = "ix_customers_created", columnList = "created_at")
)
public class Customer { ... }
```

Two things to know about the extras.

**`schema` and `catalog` are not the same thing, and PostgreSQL only really has one of
them.** In PostgreSQL a *database* is the catalog and a *schema* is a namespace inside
it, and you cannot query across catalogs in one connection. So on PostgreSQL you use
`schema` and leave `catalog` alone. The User Guide's catalog example is a MySQL one for
exactly this reason. Hibernate also lets you set defaults globally with
`hibernate.default_schema`, which is usually better than repeating it on every entity.

**`uniqueConstraints` and `indexes` only affect generated DDL.** They are instructions
to the schema exporter. If your schema comes from Flyway — and in production it should;
see **17 · `ddl-auto`** *(not written yet)* and **Topic 11 · Migrations with Flyway** *(not
written yet)* — these annotations do nothing at runtime. They are documentation at
that point, which is not worthless, but do not mistake them for enforcement.

## The naming strategy is why `createdAt` becomes `created_at`

You will notice that a Spring Boot application maps `private String displayName` to a
column called `display_name` without you asking. That is not JPA's default. JPA's
default, per the User Guide, is that "the column name is the same as the attribute
name" — so plain `displayName`.

Two pluggable strategies sit between your Java identifiers and the final SQL
identifiers:

| Strategy | Job |
|---|---|
| `ImplicitNamingStrategy` | Supplies a *logical* name when your mapping did not give one. "This attribute has no `@Column(name=...)`, so call it `displayName`." |
| `PhysicalNamingStrategy` | Converts a logical name into the *physical* SQL identifier. "Take `displayName` and emit `display_name`." |

🔴 **What Spring Boot installs here changed in Boot 4, and most of the web still
describes the old arrangement.** Boot's `HibernateProperties` applies two defaults:

- implicit → `org.springframework.boot.hibernate.SpringImplicitNamingStrategy`
- physical → `org.hibernate.boot.model.naming.PhysicalNamingStrategySnakeCaseImpl`

The physical one is now **Hibernate's own class**, added in Hibernate ORM 7.0, not
Boot's old `SpringPhysicalNamingStrategy`. Its own javadoc records the lineage:
"Originally copied from Spring's SpringPhysicalNamingStrategy as this strategy is
popular there." Both are overridable through
`spring.jpa.hibernate.naming.physical-strategy` and
`spring.jpa.hibernate.naming.implicit-strategy`, which are listed in the Boot 4
properties appendix.

Reading that class settles three questions people usually guess at:

**It applies to every kind of identifier**, not just columns — catalog, schema, table,
sequence and column names all go through the same conversion. That is why a
`@GeneratedValue(strategy = SEQUENCE)` on an entity called `OrderLine` looks for
`order_line_seq` rather than `OrderLine_seq`.

**It lowercases as well as splitting.** An unquoted identifier comes out
`camelCaseToSnakeCase(...).toLowerCase(Locale.ROOT)`, so `OrderID` becomes `order_id`
and `URL` stays `url`. The underscore is inserted only between a lowercase-or-digit, an
uppercase, and a lowercase-or-digit — so consecutive capitals are not split.

**It leaves quoted identifiers alone.** The javadoc is explicit: "This strategy leaves
quoted identifiers alone." That is your escape hatch for a legacy camelCase column —
`@Column(name = "\"createdAt\"")` passes through untouched, where an unquoted
`@Column(name = "createdAt")` would still be converted to `created_at`, because the
*physical* strategy runs on names you supplied as well as names the implicit strategy
invented.

That last point is the one that catches people, so state it as a rule:

- No `@Column` → the implicit strategy supplies `displayName`, the physical strategy
  converts it to `display_name`.
- `@Column(name = "displayName")` → the implicit strategy is skipped, but the physical
  strategy still converts it to `display_name`.
- `@Column(name = "\"displayName\"")` → quoted, so it survives as `displayName`.

## Gotchas

**`@Table(name = "...")` does not change your JPQL, and people assume it does.**
Renaming the table and then wondering why `select from customers` fails is the single
most common early confusion. JPQL is written against the *domain model*. `customers` is
not an entity name; `Customer` is.

**Boot's snake_case conversion applies to explicit `@Column` names too.**
`@Column(name = "createdAt")` becomes `created_at`, because
`PhysicalNamingStrategySnakeCaseImpl` runs on every logical name regardless of where it
came from. On a legacy schema whose columns really are camelCase you have two exits:
quote the name so the strategy skips it, or set
`spring.jpa.hibernate.naming.physical-strategy` to
`org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl`, which passes
identifiers through unchanged.

**Quoting an identifier makes it case-sensitive forever, in PostgreSQL especially.**
PostgreSQL folds unquoted identifiers to lower case; a quoted `"createdAt"` is a
genuinely different column from `createdat`. Quote only when you have to, and then be
consistent across your DDL, your migrations, and your mappings.

**A missing `@Table` on a class whose name is a reserved word breaks the SQL.**
`@Entity class Order` maps to a table called `order`, and `order` is a SQL keyword.
Hibernate offers `hibernate.globally_quoted_identifiers=true` to quote everything —
Boot documents setting it via
`spring.jpa.properties.hibernate.globally_quoted_identifiers=true` — but the global
switch is a big hammer with the case-sensitivity consequence above. Naming the table
`orders` is usually the better answer.

**`schema` on `@Table` is baked into the mapping, which makes multi-tenant setups
harder.**
Once every entity says `schema = "sales"`, switching schemas per tenant means changing
mappings. Prefer `hibernate.default_schema`, or set the connection's search path in the
pool — see [Topic 02 · Connection pooling](../02-connection-pooling/README.md).

**`@Entity(name = ...)` and `@Table(name = ...)` set independently is fine; setting only
`@Entity(name = ...)` moves the table too.**
Because the table name defaults to the *entity* name, renaming just the entity
retargets the SQL as well. If you rename an entity to resolve a collision, set the
table name explicitly in the same commit.

**Two entities may legitimately share a table.**
Hibernate does not forbid it, and inheritance strategies rely on it. But two
independent entity classes mapped to one table both dirty-checking their own view of a
row is a well-known way to lose writes. If you find yourself doing it for "a lightweight
read view", use a projection instead — see
[1c · Why not a record](01c-why-not-a-record.md).

## Interview questions

**★ What is the difference between the entity name and the table name?**
The entity name is the identifier your query language uses; it defaults to the
unqualified class name and is set with `@Entity(name = ...)`. The table name is the SQL
identifier; it defaults to the entity name and is set with `@Table(name = ...)`. They
are independent, and the default chain — class name → entity name → table name — is why
they usually look the same. Changing the table name has no effect on JPQL; changing the
entity name changes every JPQL query that referenced it.

**★ Why can't two entity classes in different packages share a simple name?**
Because JPQL refers to entities by their unqualified name, and Hibernate resolves that
name to a class. If `Address` were registered twice, `from Address` would be ambiguous
and Hibernate would have no way to pick. The User Guide states this restriction
explicitly. The fix is to give at least one of them an explicit `@Entity(name = ...)`.

**★ What does Spring Boot change about naming, and why is that a trap?**
Boot sets Hibernate's `PhysicalNamingStrategy` to
`PhysicalNamingStrategySnakeCaseImpl` and its `ImplicitNamingStrategy` to
`SpringImplicitNamingStrategy`, so `displayName` maps to `display_name`. Plain
Hibernate configured by hand does not do this — JPA's own default is that the column
name equals the attribute name. The trap is twofold: the same entity classes map to
different columns inside and outside Boot, and because it is a *physical* strategy it
rewrites names you gave explicitly in `@Column` as well as ones it invented. Note also
that the snake-case class now lives in Hibernate itself (since ORM 7.0), not in Boot —
older answers that name `SpringPhysicalNamingStrategy` are describing Boot 3.

**★ What is the difference between an implicit and a physical naming strategy?**
The implicit strategy invents a *logical* name when your mapping did not supply one —
it answers "what should this unnamed attribute be called?". The physical strategy
converts a logical name, whether you supplied it or the implicit strategy did, into the
actual SQL identifier. That ordering is why an explicit `@Column(name = ...)` skips the
implicit strategy but is still subject to the physical one.

**★ Do `uniqueConstraints` and `indexes` on `@Table` do anything at runtime?**
No. They are inputs to schema generation. If your schema is created by Hibernate they
become DDL; if it is created by Flyway or by a DBA they are inert, and Hibernate will
not check that the constraints exist unless you run `ddl-auto: validate`, which
validates tables and columns rather than every index. Treat them as documentation of
intent in a migration-managed project.

**★ You map an entity called `Order`. What goes wrong and how do you fix it?**
Its default table name is `order`, which is a reserved word in SQL, so the generated
statements are syntax errors. Three fixes, in descending order of preference: name the
table `orders` with `@Table(name = "orders")`; quote the single identifier with
`@Table(name = "\"order\"")`, accepting that it becomes case-sensitive; or set
`hibernate.globally_quoted_identifiers=true`, which quotes every identifier in the
application and makes them all case-sensitive — rarely worth it.

**★ Should the schema go in `@Table(schema = ...)`?**
Usually not. Putting it there hard-codes the schema into the compiled mapping, which
makes schema-per-tenant, per-environment schemas, and test isolation all more awkward.
`hibernate.default_schema` moves it into configuration; setting the connection's
`search_path` in the pool moves it further out still, and keeps the entity classes
ignorant of deployment topology.

---

← Prev: [1c · Why not a record](01c-why-not-a-record.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [3 · Fields, columns, access](03-fields-columns-access.md)
