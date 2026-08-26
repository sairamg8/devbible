---
title: "Running the migrations against a real PostgreSQL and generating from the result is the only route whose output reflects what the database actually did, and jOOQ's own tutorial hangs the whole thing on the order two plugins appear in your POM"
sidebar_label: "02e · Generating from a real database"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *jOOQ with Flyway*
> ([jooq-with-flyway](http://www.jooq.org/doc/latest/manual/getting-started/tutorials/jooq-with-flyway/))
> and *Configuration and setup of the generator*
> ([codegen-configuration](http://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**`DDLDatabase` proves your DDL parses. It does not prove PostgreSQL would accept it, and it
cannot show the generator anything PostgreSQL derived on its own — a domain's underlying type, a
generated column's expression, the identity behind a `serial`. The routes that can are the ones
that put a real PostgreSQL in the middle: apply the migrations to it, generate from the result,
throw it away. This page is the shape of that pipeline and the version of it jOOQ documents
itself; the container-per-build version is the next one.**

## The shape is always the same three steps

Every variant is the same pipeline, and it helps to hold the shape rather than the plugin names:

1. **Get an empty PostgreSQL**, from anywhere.
2. **Apply the migrations to it**, with the same tool production uses.
3. **Point the generator at the migrated schema**, then discard the database.

The variants differ only in *who provides step 1*. The migration tool itself — its file naming,
its checksums, its ordering — belongs to **Topic 11 · Migrations with Flyway** *(not written
yet)*; this page assumes it works and cares only about the handoff into codegen.

## What a real database shows the generator that a parser cannot

It is worth being exact, because "use a real database" is usually argued as a vague appeal to
realism and the concrete wins are far better than the vague one. Against a live PostgreSQL the
generator sees **PostgreSQL's own resolution of the schema**, not an approximation of it:

- **Domains** resolve to their underlying type, with the constraint attached in the catalogue
  rather than lost.
- **Generated columns** appear with the expression PostgreSQL stored, and their nullability is
  whatever PostgreSQL concluded.
- **`serial` and `identity`** have already collapsed into a column plus a sequence plus a
  default, and the generator reads the result rather than re-deriving it.
- **`jsonb` versus `json`** is settled by the catalogue, not by which one the parser mapped to.
- **Enum types and array types** exist as real PostgreSQL types with real names, which is what
  forced types and custom bindings match against — see
  **[02c · Shaping the generated API](02c-shaping-the-generated-api.md)**.
- **Nullability after every `ALTER`** is the final answer, not the sum of statements a parser
  read in sequence.

None of that is exotic. It is the ordinary content of a schema that has been altered a few dozen
times, which is every schema over a year old.

## Route 2 · Migrate, then generate, in one Maven build

This is the route jOOQ documents itself, and its tutorial is worth reading for one sentence:
*"the jOOQ code generator relies on such migrations having been done prior to code
generation"*. Everything about the setup follows from that ordering requirement.

Both plugins bind to the same lifecycle phase, `generate-sources`:

```xml
<build>
  <plugins>
    <!-- FIRST: bring the schema up to date -->
    <plugin>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-maven-plugin</artifactId>
      <executions>
        <execution>
          <phase>generate-sources</phase>
          <goals><goal>migrate</goal></goals>
        </execution>
      </executions>
      <configuration>
        <url>${db.url}</url>
        <user>${db.user}</user>
        <password>${db.password}</password>
        <locations>
          <location>filesystem:src/main/resources/db/migration</location>
        </locations>
      </configuration>
    </plugin>

    <!-- SECOND: read the schema that now exists -->
    <plugin>
      <groupId>org.jooq</groupId>
      <artifactId>jooq-codegen-maven</artifactId>
      <executions>
        <execution>
          <phase>generate-sources</phase>
          <goals><goal>generate</goal></goals>
        </execution>
      </executions>
      <configuration>
        <jdbc>
          <url>${db.url}</url>
          <user>${db.user}</user>
          <password>${db.password}</password>
        </jdbc>
        <generator>
          <database>
            <inputSchema>public</inputSchema>
            <excludes>flyway_schema_history</excludes>
          </database>
          <target>
            <packageName>com.example.shop.db</packageName>
            <directory>target/generated-sources/jooq</directory>
          </target>
        </generator>
      </configuration>
    </plugin>
  </plugins>
</build>
```

🔴 **The ordering is not expressed anywhere except the order the two `<plugin>` elements appear
in.** Maven runs executions bound to the same phase in the order they are declared in the POM,
and nothing in either plugin's configuration states the dependency. Swap the two blocks and the
build still runs — it generates against the previous schema state, silently, and the compile
error lands somewhere unrelated.

⚠️ **jOOQ's own tutorial for this route uses H2**, and that is the detail people skip. The route
is not "run it against production-shaped PostgreSQL" by default; it is "run it against whatever
`${db.url}` points at". If that URL is a shared server, you have re-acquired every problem
**[02d · Generating from migrations](02d-generating-from-migrations.md)** opened with — the build
is not reproducible, CI needs credentials, and someone's manual `CREATE INDEX` becomes a
dependency of your code.

## So route 2 is only as good as the database it targets

That is the honest summary, and it splits the route in two:

- **Against a per-branch ephemeral database you already own** — a provisioned schema per
  pipeline, a database-per-PR setup, anything created empty and destroyed after — route 2 is
  excellent. You are paying for the infrastructure anyway, and generating from it is free.
- **Against a long-lived shared development server** — it is `DDLDatabase`'s problems with extra
  steps. Having a Flyway execution in the build does not make the target ephemeral.

If you do not already own ephemeral databases, the route that provides one per build is
**[02f · The throwaway container](02f-the-throwaway-container.md)**.

## Gotchas

**★ Plugin declaration order in the POM is load-bearing and looks like formatting.** Maven runs
same-phase executions in declaration order. Nothing warns you when Flyway is declared second, and
the symptom is generated code that matches the *previous* migration state — which compiles fine
until someone uses the new column.

**★ `flyway_schema_history` becomes a generated table if you do not exclude it.** Every one of
these routes runs Flyway, so every one of them creates that table before the generator looks.
`<excludes>flyway_schema_history</excludes>` is not optional, in any route.

**★ Route 2 against a shared database is route 1's problem wearing a costume.** Having a Flyway
execution in the build does not make the target ephemeral. If `${db.url}` names a server other
people use, the build is not reproducible and generating from migrations bought you nothing.

**★ A missing `mvn clean` leaves stale generated classes on the compile classpath.** Generated
sources under `target/` disappear on `clean`, so a clean build regenerates from scratch. A build
without one can compile against classes describing a schema that no longer exists, and the error
you eventually get names a symbol, not a stale build.

**★ The Flyway plugin's `<locations>` and the application's Flyway configuration are two separate
settings, and they drift.** The build migrates from
`filesystem:src/main/resources/db/migration`; the running application migrates from the
classpath. Move the directory and only one of them follows.

**★ Credentials now live in the POM or in the build environment.** Route 2 puts a JDBC URL, a
user and a password into the build, twice. That is a secrets-management problem the previous
route did not have, and `${db.url}` in a committed POM with a default value is how it goes wrong.

**★ Generated sources under `target/` are not indexed by every IDE until the generate phase has
run at least once.** A fresh clone opened in an IDE before the first `mvn generate-sources` shows
a project full of unresolved symbols, and it looks like a broken checkout rather than a build
step that has not happened.

**★ Running the build twice against the same non-ephemeral database is not idempotent in the way
you assume.** Flyway will skip already-applied migrations, so the second run generates the same
code — until someone adds a migration on another branch and applies it to the same server. Then
your branch's build generates *their* schema.

**★ `<inputSchema>public</inputSchema>` silently hides everything you put elsewhere.** A
migration that creates an `audit` schema produces nothing in the generated API and no warning,
because the generator was told to look at one schema and did exactly that.

**★ Two profiles configuring two different routes is a promise of divergence.** It looks like
flexibility — `DDLDatabase` locally, a real database in CI — and it means two people can compile
against two different generated APIs from the same commit. Choose one route and let everyone pay
its cost.

## Interview questions

**★ What can generating from a real database see that `DDLDatabase` cannot?** Everything
PostgreSQL derives rather than reads: domain underlying types, generated column expressions,
identity/serial resolution, `jsonb` versus `json`, enum and array types, and the nullability that
survived every `ALTER`. `DDLDatabase` sees what jOOQ's parser understood and what an in-memory H2
could hold.

**★ jOOQ's Flyway tutorial binds both plugins to `generate-sources`. What guarantees Flyway runs
first?** Nothing except the order the plugins are declared in the POM — Maven runs same-phase
executions in declaration order. It is real, documented Maven behaviour, and it is invisible in a
diff that merely reorders the plugins.

**★ What does jOOQ's tutorial actually use as the database, and why does that matter?** H2. The
tutorial demonstrates the *ordering*, not production fidelity. Reading it as an endorsement of
"point it at your dev server" is how teams end up with a non-reproducible build.

**★ Why is "we generate against the dev database, and Flyway runs in the build" not a
reproducible build?** Because the target is shared and long-lived. The migrations having run at
some point is not the same as their running from empty on this commit, and a shared database can
have been altered by hand or by someone else's branch.

**★ When is route 2 the right answer?** When you already own ephemeral, per-branch or per-pipeline
databases. The infrastructure cost is already paid, the target is created empty, and generating
from it adds nothing to the bill.

**★ Why must `flyway_schema_history` be excluded, in every route?** Because Flyway creates it
before the generator reads the schema, so without an exclusion you get a generated table class
for your migration bookkeeping — visible in autocomplete, part of your public generated API, and
meaningless to your domain.

**★ Your build generates code for a table that no migration creates. What happened?** Almost
certainly a non-ephemeral target that someone changed by hand, or a leftover object from a
migration that was later rewritten. Both are arguments for a database created empty per build.

**★ Does generating from a real database guarantee your code matches production?** No. It
guarantees the generated code matches your migration scripts as applied to *that* database.
Whether production ran those same scripts is a deployment-discipline question, and no code
generator can answer it.

**★ Where do the credentials go in route 2, and what is the risk?** Into the build — a JDBC URL,
user and password, configured twice, in the POM or the build environment. It is a secrets problem
`DDLDatabase` does not have, and a committed default value is the usual way it leaks.

**★ You add a migration, run the build, and the generated API does not change. Two things you
check.** Whether Flyway is declared before the codegen plugin in the POM, and whether the
migration was applied at all — a shared target may already have had a same-versioned script
applied, in which case Flyway skipped yours.

{/* FOOTER */}
