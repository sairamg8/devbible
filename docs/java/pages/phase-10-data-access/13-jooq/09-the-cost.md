---
title: "jOOQ's compile-time guarantee is bought with a build step that needs a schema, a generated source tree somebody has to own, and a regeneration discipline that nothing enforces — and all three are permanent"
sidebar_label: "09 · The cost"
sidebar_position: 31
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Code generation*
> ([code-generation](https://www.jooq.org/doc/latest/manual/code-generation/)),
> *Code generation and version control*
> ([codegen-version-control](https://www.jooq.org/doc/latest/manual/code-generation/codegen-version-control/)),
> *Code generation for large schemas*
> ([codegen-large-schemas](https://www.jooq.org/doc/latest/manual/code-generation/codegen-large-schemas/))
> and *Generated records*
> ([codegen-records](https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-records/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**Every argument for jOOQ in this topic has been about what the compiler can check. This is the
invoice. It has six lines, they arrive monthly rather than once, and the first three are structural:
your build now needs a database schema before it can compile a single class, the schema arrives as
a generated source tree somebody must own, and keeping that tree honest is a discipline no tool
enforces. The other three — the people, the licence, the way out — are
[09b](09b-the-people-and-the-exit.md).**

## The invoice

| # | Cost | Falls on | Where this topic covers it |
|---|---|---|---|
| 1 | The build needs a schema | every machine that compiles | [02d](02d-generating-from-migrations.md) · [02e](02e-generating-from-a-real-database.md) · [02f](02f-the-throwaway-container.md) |
| 2 | A generated source tree | the repository and the IDE | [02](02-code-generation.md) · [02c](02c-shaping-the-generated-api.md) |
| 3 | Regeneration discipline | every schema change, forever | this page |
| 4 | A team that knows SQL | hiring, review, onboarding | [09b](09b-the-people-and-the-exit.md) |
| 5 | The licence | procurement, the JDK floor, the build files | [01b](01b-the-licence-question.md) · [09b](09b-the-people-and-the-exit.md) |
| 6 | The exit | whenever you want to leave | [09b](09b-the-people-and-the-exit.md) |

**Lines 1 to 3 are the ones people underestimate**, because at adoption time they look like setup
and they are actually operations.

## Cost 1 — the build cannot compile without a schema

jOOQ's own summary of what the generator buys is the sentence the entire cost hangs from:

> *"When your database schema changes, your generated code will change as well. Removing columns
> will lead to compilation errors, which you can detect early."*

To get that, the generator has to see a schema **before `javac` runs on your own sources**, on
every machine that builds the project. There are three ways to give it one and they charge
differently:

| Route | What every builder needs | What it costs |
|---|---|---|
| `DDLDatabase` from migration scripts ([02d](02d-generating-from-migrations.md)) | nothing but the scripts | only what jOOQ's parser and an in-memory H2 can represent |
| A real database you provide ([02e](02e-generating-from-a-real-database.md)) | a reachable, correctly-migrated database | a shared server on the build's critical path |
| A throwaway container ([02f](02f-the-throwaway-container.md)) | a working container runtime | a container start on every clean build |

⚠️ **There is no fourth route where the build needs nothing.** That is the trade. `JdbcClient` needs
no schema at build time because it checks nothing; JPA needs no schema at build time because it
checks at startup or at first execution. jOOQ moves the check earlier, and "earlier" means "into
the build".

### The consequences people meet later

- **A new laptop cannot build the project until it can run the generator.** For the container route
  that means Docker before the first successful `mvn compile` — a real onboarding step.
- **Offline and air-gapped builds need the schema route that has no server**, which pushes you back
  to `DDLDatabase` and its parser limits.
- **The generator is on the critical path of every clean build.** A failure there is not a failing
  test; it is a repository where nothing compiles for anyone.
- **CI images grow.** A container runtime inside CI, or a database service container, is
  infrastructure your build now depends on.
- **Build time grows** by whatever migrating and reverse-engineering costs, on every clean build.
  Incremental builds usually skip it; the CI build usually does not.

🔴 **The failure mode to design against is a shared build database** ([02e](02e-generating-from-a-real-database.md)):
one wrong migration on it and every developer's build breaks at once, with an error that points at
generated code rather than at the person who changed the schema.

## Cost 2 — the generated source tree

The generator emits a schema class, a class per table, a record class per table, and — depending on
your flags ([02c](02c-shaping-the-generated-api.md)) — POJOs, interfaces and DAOs on top. The
volume scales with **tables × columns × the artefact types you enabled**, which is why the flags
are a cost decision and not only an API decision.

Two documented facts that bite on large schemas:

> *"Methods (including static / instance initialisers) are allowed to contain only 64kb of
> bytecode."*

> *"Classes are allowed to contain at most 64k of constant literals"*

These are JVM limits, not jOOQ limits, and jOOQ's own page on large schemas offers four
mitigations: distribute objects across several schemas — *"That is probably a good idea anyway for
such large databases"* — exclude excess objects from generation, switch off global object
references with `<globalObjectReferences/>`, or delete the uncompilable classes after generation.

And on compile speed, from the records page:

> *"Starting from jOOQ 3.19, the default for this flag is `false`"*

— referring to `recordsImplementingRecordN`, which the manual warns *"may impact compilation
speeds"*. **The default was changed to protect your build.** Turning it back on to get typed
degree-N records is a deliberate purchase.

### The IDE bill

Nobody mentions this at adoption and everybody notices it in week two: the generated package is
indexed, autocompleted and searched like any other source. On a large schema that shows up as
slower indexing, a symbol search full of generated names, and — if you `import static
your.pkg.Tables.*` — an autocomplete list containing every table in the database.

## Check it in, or generate it?

jOOQ documents both and picks neither. **Checked in** — *"Check in generated sources in your
version control system"* — is useful when

> *"Java developers are not in full control of or do not have full access to your database schema"*

because it lets you track *"side-effects of database changes"* and the *"change of behaviour in the
jOOQ code generator, e.g. when upgrading jOOQ"*. Its drawback, in the manual's words:

> *"It is more error-prone as the actual schema may go out of sync with the generated schema."*

**Derived** — *"Regenerate jOOQ code every time the schema changes"* — buys the *"increased quality
of being able to regenerate all derived artefacts in every step"*, and its drawback is:

> *"The build may break in perfectly acceptable situations, when parts of your database are
> temporarily unavailable."*

The manual also allows a pragmatic mixture, for instance versioning POJOs while excluding table and
record definitions.

**How to actually decide:**

- **Generate, do not check in, when the schema route needs no server** — `DDLDatabase` or a
  throwaway container. The manual's stated drawback ("parts of your database temporarily
  unavailable") does not apply to a schema that is built from scratch on every build.
- **Check in when generation depends on something you do not control** — a shared database, a
  DBA-owned schema, a licence-gated generator on a machine not every developer has.
- **Never check in *and* generate into the same package.** That is the configuration where a stale
  committed file quietly shadows or conflicts with a fresh one, and the compiler cannot tell you
  which one you meant.

## Cost 3 — the regeneration discipline nothing enforces

🔴 **A stale generated tree compiles perfectly.** It type-checks yesterday's schema with complete
confidence, which is worse than no check at all, because the check is the reason you adopted the
library. jOOQ names this itself as the checked-in option's drawback: *"the actual schema may go out
of sync with the generated schema"*.

The discipline is three rules:

1. **Generation is part of the build, not a script somebody runs.** Bound to `generate-sources`,
   after the migrations, in the same lifecycle — the ordering trap in
   [02e](02e-generating-from-a-real-database.md).
2. **The build's schema comes from the migrations**, so there is exactly one source of truth
   ([Topic 11 · Why schema is code](../11-flyway-migrations/01-why-schema-is-code.md)).
3. **If the tree is committed, regenerating it is part of the migration's pull request** — not a
   follow-up, not a nightly job. A migration and its regeneration belong in one diff or the window
   between them is a window where the compiler is lying.

⚠️ **Upgrading jOOQ regenerates everything.** The version-control page recommends checking the tree
in precisely so you can see this — but seeing it means a pull request with a diff touching every
generated file, which nobody reviews line by line. Diff the *generator configuration* and the
release notes; skim the tree for shape changes rather than reading it.

## Gotchas

**★ The generator failing means nothing compiles, for everyone.** It is not a failing test that one
team can route around. Treat the generation step's inputs — the container image, the migration
scripts, the shared database — with the care you would give a compiler.

**★ A stale generated tree is more dangerous than no generated tree.** It reports a compile-time
guarantee it no longer has. Every schema change without a regeneration widens that gap silently.

**★ "It builds on my machine" acquires a new cause.** A developer with a stale `target/generated-sources`
compiles against a schema nobody else has. `mvn clean` is not optional advice in a jOOQ project.

**★ Checking in the tree *and* generating it produces the worst of both.** Two copies, one stale,
and a compiler that cannot warn you. Pick one and make the other impossible.

**★ Large schemas hit JVM limits, not jOOQ limits.** The 64kb method and 64k constant-pool ceilings
are the JVM's. If you meet them the answers are structural — split schemas, exclude objects, or
turn off `<globalObjectReferences/>`.

**★ The `<generate/>` flags are a build-time cost as well as an API decision.** POJOs, DAOs,
interfaces and `recordsImplementingRecordN` all add source to compile; jOOQ turned the last of these
off by default from 3.19 because it *"may impact compilation speeds"*.

**★ The IDE indexes everything you generate.** Excluding tables you never query is not a purity
exercise; it is what keeps symbol search and autocomplete usable on a large database.

**★ The container route makes Docker a compile-time dependency.** That is fine on CI and awkward on
a locked-down laptop, and it is a question to ask before adoption rather than after.

**★ Offline builds force the `DDLDatabase` route, with its parser limits.** PostgreSQL-specific DDL
that jOOQ's parser cannot represent silently produces a schema replica that does not match
production — [02d](02d-generating-from-migrations.md).

**★ Build time is paid by CI on every commit.** An extra container start and a full migration run
per build is small per build and large per month, and it lands on the queue everyone waits in.

**★ Regeneration after a jOOQ upgrade produces a diff nobody can review.** Review the generator
configuration and the release notes instead, and make the regeneration its own commit so the next
real change is readable.

**★ A shared build database couples every developer's compile to one server.** One bad migration
there breaks everybody, and the error surfaces as compilation failures in generated code rather
than as a schema problem.

**★ Nothing tells you the tree is stale.** There is no timestamp check, no build warning. The
protection is structural: generate in the build from the migrations, every time.

## Interview questions

**★ What does jOOQ's compile-time guarantee actually cost?** A build that cannot compile without a
schema. The generator must run before `javac`, on every machine, which means every builder needs
one of: the migration scripts and jOOQ's parser, a reachable migrated database, or a container
runtime.

**★ Why can't the build just skip generation?** Because the generated classes *are* the API your
queries are written against. Without them nothing referencing a table compiles. Generation is not a
pre-processing nicety; it is part of compilation.

**★ Compare the three schema routes by what they demand of a builder.** `DDLDatabase` demands
nothing but the scripts and pays in parser fidelity. A provided database demands a reachable,
correctly-migrated server and puts it on the critical path. A throwaway container demands a
container runtime and pays a start-up on every clean build.

**★ Should the generated code be checked into version control?** jOOQ documents both and endorses
neither. Check it in when generation depends on something you do not control, accepting that
*"the actual schema may go out of sync with the generated schema"*. Generate it when the schema can
be built from scratch each time, accepting that *"the build may break … when parts of your database
are temporarily unavailable"*. Never do both into the same package.

**★ What is the single most dangerous state a jOOQ project can be in?** A stale generated tree. It
compiles, it type-checks, and it is checking a schema that no longer exists — a confident lie in
place of the guarantee you adopted the library for.

**★ How do you make regeneration reliable?** Bind it to the build after the migrations, source the
schema from the migrations so there is one truth, and if the tree is committed, regenerate it in the
same pull request as the migration that changed the schema.

**★ What happens to a jOOQ project on a very large schema?** You can meet JVM limits — *"Methods …
are allowed to contain only 64kb of bytecode"* and *"Classes are allowed to contain at most 64k of
constant literals"*. The documented answers are splitting schemas, excluding objects, disabling
`<globalObjectReferences/>`, or deleting uncompilable classes after generation.

**★ Why did jOOQ change `recordsImplementingRecordN` to default `false` in 3.19?** Because generating
`RecordN` implementations for every table *"may impact compilation speeds"*. It is a reminder that
the generation flags are build-time costs, not just API preferences.

**★ What does adopting jOOQ change about onboarding a new developer?** They cannot build until the
generation route works on their machine — which may mean installing a container runtime, or getting
credentials to a build database, before their first successful compile.

**★ Your CI build got two minutes slower after adopting jOOQ. Is that expected?** Yes: a clean build
now migrates a schema and reverse-engineers it before compiling. The levers are the route (scripts
rather than a container), the scope (`<excludes>`), and caching, not removing the step.

**★ How do you review a pull request that regenerates the whole tree?** You do not read it. Review
the generator configuration diff and the jOOQ release notes, check the shape of the change — files
added, files removed — and keep the regeneration in its own commit so the next functional change is
legible.

**★ A colleague says "it builds on my machine". What is the jOOQ-specific cause?** A stale
`target/generated-sources` from before the last migration. They are compiling against a schema
nobody else has. `mvn clean` is the first question, not the last.

{/* FOOTER */}
