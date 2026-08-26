---
title: "Configuring the generator decides which parts of your database become Java and where that Java lives, and both answers have consequences you cannot easily reverse"
sidebar_label: "02b · Configuring the generator"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Configuration and setup of the generator*
> ([codegen-configuration](http://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/)),
> *The Gradle plugin*
> ([codegen-gradle](https://www.jooq.org/doc/latest/manual/code-generation/codegen-gradle/))
> and *Custom generator strategies*
> ([codegen-generatorstrategy](https://www.jooq.org/doc/latest/manual/code-generation/codegen-generatorstrategy/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**The generator has one job and about forty knobs, and two of them decide whether you get a
usable API or a source tree nobody can navigate: which database objects it reads, and where the
Java it writes ends up. Both are one-line settings with architectural consequences — the first
determines whether your `Tables` class has twelve entries or four thousand, and the second
determines whether a stale generated tree can ever silently lie to your compiler.**

## Three ways to run it, one configuration format

The configuration is the same XML regardless of how it is invoked — the plugins are wrappers
around `org.jooq.codegen.GenerationTool`.

```xml
<plugin>
  <groupId>org.jooq</groupId>
  <artifactId>jooq-codegen-maven</artifactId>
  <version>3.21.7</version>
  <executions>
    <execution>
      <goals><goal>generate</goal></goals>
    </execution>
  </executions>
  <configuration>
    <!-- the <jdbc> and <generator> blocks below go here -->
  </configuration>
</plugin>
```

Gradle has had a first-party plugin since **jOOQ 3.19** — the manual's words are *"Starting
with jOOQ 3.19, there's out of the box gradle support for jOOQ's code generator"* — with the
plugin id `org.jooq.jooq-codegen-gradle` and a `jooq { configuration { … } }` block mirroring
the same element names:

```kotlin
plugins {
    id("org.jooq.jooq-codegen-gradle") version "3.21.7"
}
```

⚠️ Before 3.19 the community `nu.studer.jooq` plugin was the standard answer, and most Gradle
examples on the internet still use it. It still works; it is not jOOQ's, and its configuration
DSL is not identical.

The third route is the standalone `GenerationTool` driven by an XML file, which is what you
reach for when generation is a pipeline step in its own right rather than part of a module's
build — a shared schema generating a shared artifact several services depend on, for instance.

## The skeleton

Four top-level elements exist — `<jdbc>`, `<generator>`, `<logging>` and `<onError>` — and
almost everything lives under `<generator>`:

```xml
<jdbc>
  <driver>org.postgresql.Driver</driver>
  <url>jdbc:postgresql://localhost:5432/shop</url>
  <user>shop</user>
  <password>shop</password>
</jdbc>

<generator>
  <name>org.jooq.codegen.JavaGenerator</name>

  <database>
    <name>org.jooq.meta.postgres.PostgresDatabase</name>
    <inputSchema>public</inputSchema>
    <includes>.*</includes>
    <excludes>flyway_schema_history</excludes>
  </database>

  <generate>
    <!-- see 02c -->
  </generate>

  <target>
    <packageName>com.example.db</packageName>
    <directory>target/generated-sources/jooq</directory>
  </target>
</generator>
```

`<generator><name>` selects the language. `JavaGenerator` is the default; Kotlin and Scala
generators exist alongside it, and they emit idiomatic output for those languages rather than
Java with a wrapper.

`<logging>` and `<onError>` are small but occasionally decisive: the first controls how loud
generation is, and the second decides whether a problem with one object fails the whole run or
is logged and skipped. On a large legacy schema with a handful of objects jOOQ cannot read,
that distinction is the difference between a build that works and one that does not.

## `<database>` — how much of the database becomes Java

Four elements carry the weight.

**`<name>`** picks the dialect's metadata reader. The manual describes them as classes "named
`org.jooq.meta.[database].[database]Database"`, so PostgreSQL is
`org.jooq.meta.postgres.PostgresDatabase`.

**`<inputSchema>`** is "the schema that is used locally as a source for meta information".
Setting it is not optional in practice. Without it, a PostgreSQL connection will happily offer
`information_schema` and `pg_catalog` alongside `public`, and you will generate Java for the
system catalogue. For a multi-schema database, `<schemata>` takes a list instead.

**`<includes>` and `<excludes>`** are Java regular expressions, pipe-separated for alternatives,
matched against object names. The rule people get backwards is stated flatly in the manual:
*"Excludes match before includes, i.e. excludes have a higher priority."* A table matched by
both is excluded, and no amount of widening `<includes>` wins it back.

```xml
<includes>.*</includes>
<excludes>
    flyway_schema_history
  | .*_audit
  | temp_.*
</excludes>
```

Excluding your migration tool's history table is the near-universal first entry, because
nothing in your application should ever query it and a generated `FlywaySchemaHistory` class in
your source tree is pure noise.

These patterns match more than tables — sequences, routines, packages, UDTs and enums all pass
through the same filter. On a database with hundreds of stored procedures, an `<includes>` that
only names your tables is the difference between a fast build and a slow one.

**`<forcedTypes>`** is the fourth, and it is substantial enough to have its own page:
**[02c · Shaping the generated API](02c-shaping-the-generated-api.md)**.

## `<target>` — and the question of where generated code lives

`<packageName>` is "the destination package of your generated classes"; `<directory>` is where
the files land; `<encoding>` sets the charset.

`<directory>` encodes a real architectural choice, and it is worth making deliberately rather
than inheriting from whichever tutorial you copied:

| | `target/generated-sources/jooq` | `src/main/java` |
|---|---|---|
| In version control | no | yes |
| Build needs a schema source | **every build** | only when regenerating |
| Stale-code risk | none | **the main risk** |
| Diff noise on a migration | none | large, but visible |
| A fresh clone builds offline | no | yes |
| Code review sees the schema change | in the migration only | in the migration and the Java |
| IDE needs source-root configuration | usually | no |

There is no universally right answer, but there is a wrong combination: **checked in, plus
regeneration as a manual step nobody enforces.** That gives you a compiler confidently
validating queries against a schema that no longer exists — the worst of both, because it looks
like safety. If you check the tree in, make CI regenerate and fail on a dirty working tree.

The checked-in argument is stronger than its reputation, mind. It makes the generated API
reviewable: a pull request that renames a column shows the migration *and* the twelve Java
files that changed shape, in one diff, to a reviewer who may not read SQL carefully.

## `<strategy>` — naming

By default the generator applies `DefaultGeneratorStrategy`: `snake_case` table and column names
become `UPPER_SNAKE` static fields and `PascalCase` class names. A custom strategy class, or the
XML `<matchers>` form, lets you change that — strip a `tbl_` prefix, suffix records differently,
or map a naming convention nobody can change to one Java can live with.

Reach for it only when the schema's convention is genuinely hostile. A custom strategy is code
that has to be on the generator's classpath, and it makes the generated names one more thing a
new joiner has to learn rather than read straight off the schema. The default's virtue is that
`ORDERS.PLACED_AT` needs no explanation to anyone who has seen the table.

## Gotchas

**★ Omitting `<inputSchema>` on PostgreSQL generates the system catalogue.** Thousands of
classes, a slow compile, and a `Tables` class you cannot navigate. It is the most common
first-run mistake and the fix is one element.

**★ `excludes` beats `includes`, always.** A broad exclude plus a narrow include does not
re-include anything. If you want most of a pattern except a few members, write the exclusion
precisely rather than trying to override it afterwards.

**★ Forgetting to exclude the migration history table.** `flyway_schema_history` or
`databasechangelog` generates a table class, a record and possibly a POJO, every one of them
noise your application must never touch — and a tempting thing for someone to query directly.

**★ The include/exclude patterns apply to routines and sequences too, not just tables.** A
schema with 300 stored procedures generates 300 procedure bindings unless you say otherwise,
which is a lot of build time spent on code nobody calls.

**★ Credentials in `<jdbc>` end up in `pom.xml`.** For a local development database that is
fine and normal; for anything else it is a secret in version control. Property placeholders, a
build profile, or generating from DDL scripts instead all solve it.

**★ The generator connects as *some* user, and that user's privileges decide what it sees.** A
role that cannot see certain tables generates a schema missing them, with no error at all — the
output is simply smaller than expected, which is easy to misdiagnose as a bad `<includes>`.

**★ Changing `<packageName>` renames every import in the codebase.** Obvious in hindsight,
painful in practice. Choose it once, at the start, and make it a package nothing else lives in
so the generated tree can be deleted wholesale without touching hand-written code.

**★ The Gradle plugin most examples show is not the official one.** `nu.studer.jooq` predates
jOOQ's own `org.jooq.jooq-codegen-gradle`, which arrived in 3.19. Both work; mixing
documentation between them produces configuration that does not resolve, with error messages
that do not hint at the cause.

**★ Regeneration does not delete classes for dropped tables when the target is `src/main/java`.**
The new run writes what exists now; the stale class for a table you dropped sits there and
still compiles, so code referencing a table that no longer exists passes the build. Generating
into a cleaned build directory makes the problem structurally impossible.

**★ `onError` defaults to failing, and on a legacy schema that can block the whole run for one
unreadable object.** Knowing the element exists turns a hard stop into a logged warning while
you deal with the offending object properly.

**★ A custom generator strategy is a compile-time dependency of your build, not your
application.** It must be on the generator's classpath, which for Maven means a plugin
`<dependency>` — a circularity people hit when they put the strategy class in the same module
it generates code for.

## Interview questions

**★ Your generated source tree has 4,000 files and the build takes four minutes. What went
wrong?** Almost certainly no `<inputSchema>` or `<includes>`, so the generator walked system
catalogues as well as your schema — quite possibly with routines included and several optional
artefact types enabled as well.

**★ `includes` says `.*` and `excludes` says `audit_.*`, but you also want `audit_config`
generated. What do you do?** Narrow the exclude — `audit_(?!config).*`, or an explicit
alternation of the ones you really want gone. You cannot win it back through `includes`,
because excludes are evaluated first and have higher priority.

**★ Should generated code be checked into version control?** Both are defensible. Checked in
buys offline builds, no schema dependency, and a diff that shows the API change next to the
migration. Generated buys the guarantee that the code always matches the schema. The
unacceptable combination is checked in with regeneration left to whoever remembers.

**★ How do you make CI catch someone changing the schema but not the generated code?**
Regenerate in CI and fail if the working tree is dirty afterwards. That is the only reliable
enforcement when the tree is checked in; when it is not checked in, the problem cannot arise
because generation is a build step.

**★ Where do the database credentials in the codegen configuration go in a real project?** Not
into `pom.xml` literally. Either they point at a disposable local or container database whose
credentials are not secret, or they are property placeholders resolved from a profile or the
environment. Generating from DDL scripts removes the question entirely.

**★ How would you handle a schema whose naming convention is `tbl_order_hdr`?** A custom
`GeneratorStrategy`, or the `<matchers>` XML form, to strip the prefix and produce readable Java
names. It is worth it when the convention is pervasive and unchangeable, and not worth it for
two tables — the default strategy's virtue is that the Java name is obviously the SQL name.

**★ The generated schema is missing three tables you can see in `psql`. Where do you look?**
Three places, in order: `<excludes>`, which wins over `<includes>`; `<inputSchema>`, if the
tables are in a different schema; and the privileges of the user in `<jdbc>`, because a role
that cannot see a table produces a smaller schema with no error.

**★ Does the choice of `<directory>` affect the runtime at all?** No. It affects the build, the
repository, code review and staleness risk. The generated classes are identical either way, and
the running application has no idea where their source lived.

**★ Why does jOOQ ship a Kotlin generator rather than expecting Kotlin users to consume the
Java output?** Because generated Java is consumable but not idiomatic from Kotlin —
nullability, data classes and property access all differ. The generator emitting the target
language directly is the same reasoning that makes generation worthwhile in the first place.

**★ You need one generated artifact shared by four services. How do you run the generator?**
As a standalone `GenerationTool` step producing a published library, rather than as a plugin in
each service's build. Four services each generating from the same schema is four opportunities
to be out of step, and a shared versioned artifact makes the schema's version explicit in each
service's dependency list.

{/* FOOTER */}
