---
title: "A throwaway PostgreSQL container per build gives the generator a schema that was created empty and migrated for real, and charges you a container runtime on every machine that compiles the project"
sidebar_label: "02f · The throwaway container"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Testcontainers jOOQ codegen Maven plugin's own documentation
> ([testcontainers/testcontainers-jooq-codegen-maven-plugin](https://github.com/testcontainers/testcontainers-jooq-codegen-maven-plugin))
> and the jOOQ 3.21 manual — *jOOQ with Flyway*
> ([jooq-with-flyway](http://www.jooq.org/doc/latest/manual/getting-started/tutorials/jooq-with-flyway/)),
> which names Testcontainers as a third-party tool and links a separate article
> ([blog.jooq.org](https://blog.jooq.org/using-testcontainers-to-generate-jooq-code/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**The previous route needed you to supply an empty PostgreSQL. This one supplies its own: start a
container, run the migrations into it, generate, stop the container — one Maven execution, no
shared state, and a schema that provably came from applying every migration in order to nothing.
It is the highest-fidelity route jOOQ has, and it is the only one that makes compiling the
project impossible without a container runtime.**

## One plugin, three configuration blocks, three steps

⚠️ **This is the Testcontainers project's plugin, not jOOQ's.** jOOQ's manual names Testcontainers
as a *third party* tool and points at a separate blog article rather than documenting it as a
first-class route. That matters for support expectations and for who fixes it when a jOOQ release
changes the codegen configuration schema.

```xml
<plugin>
  <groupId>org.testcontainers</groupId>
  <artifactId>testcontainers-jooq-codegen-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>generate-jooq-sources</id>
      <phase>generate-sources</phase>
      <goals><goal>generate</goal></goals>
      <configuration>
        <database>
          <type>POSTGRES</type>
          <containerImage>postgres:18-alpine</containerImage>
          <username>shop</username>
          <password>shop</password>
          <databaseName>shop</databaseName>
        </database>
        <flyway>
          <locations>filesystem:src/main/resources/db/migration</locations>
        </flyway>
        <jooq>
          <generator>
            <database>
              <includes>.*</includes>
              <excludes>flyway_schema_history</excludes>
            </database>
            <target>
              <packageName>com.example.shop.db</packageName>
              <directory>target/generated-sources/jooq</directory>
            </target>
          </generator>
        </jooq>
      </configuration>
    </execution>
  </executions>
</plugin>
```

The three blocks map exactly onto the three steps of the pipeline: `<database>` is *where the
schema will live*, `<flyway>` is *how it gets there*, `<jooq>` is *what to make of it*.

**The `<jooq><generator>` block is the ordinary jOOQ generator configuration.** Everything in
**[02b · Configuring the generator](02b-configuring-the-generator.md)** and
**[02c · Shaping the generated API](02c-shaping-the-generated-api.md)** applies unchanged — the
plugin is a wrapper around the same generator, not a different one. That is worth knowing because
it means adopting this route later is a move of configuration, not a rewrite of it.

Two constraints from the plugin's documentation, worth knowing before you plan around it:

- **Supported database types are `POSTGRES`, `MYSQL` and `MARIADB`.** If your production database
  is not one of those three, this route is closed and you are back to
  **[02e · Generating from a real database](02e-generating-from-a-real-database.md)** against a
  server you provision yourself.
- **Migration engines are Flyway and Liquibase**, with Flyway's documented properties supported in
  full and Liquibase's essential ones supported.

## What the container adds over route 2

Route 2 already gave you PostgreSQL's own view of the schema. The container adds three things,
all of which come from *empty and per-build* rather than from *real*:

- **The migrations are proven to run, in order, from nothing**, on the engine production uses.
  That is a correctness check on the migrations themselves, arriving at build time rather than at
  deploy time.
- **A migration that only works against an already-populated schema fails here.** It cannot hide,
  because there is no prior state for it to lean on.
- **No shared state at all.** Two branches with two different schemas cannot interfere, and there
  is nothing anyone could have altered by hand.

## What it costs

- **A container runtime on every machine that compiles the project** — developer laptops, CI
  runners, and the build box someone forgot about. There is no "just compile it" fallback.
- **Build time**, on the first build and after any image-cache eviction: pulling an image and
  starting PostgreSQL is not free, and it happens before a single line of your code is compiled.
- **A restricted-network CI has to mirror the image**, which is a registry and a policy decision
  rather than a technical one.
- **The failure modes become infrastructure failure modes.** "The build is broken" can now mean
  the registry is down, and diagnosing that is nobody's favourite afternoon.

The honest summary: this route moves work from *deploy time* to *build time*, and moves a
dependency from *nowhere* to *every build*. Whether that trade is good depends almost entirely on
how much PostgreSQL-specific schema you have. The full accounting of what jOOQ costs a team is
**[09 · The cost](09-the-cost.md)**.

## Choosing between the three routes

| | Route 1 · `DDLDatabase` | Route 2 · Migrate then generate | Route 3 · Testcontainers plugin |
|---|---|---|---|
| Needs a server | no | yes, you provide it | no, it provides one |
| Needs a container runtime | no | no | **yes** |
| Schema fidelity | jOOQ's parser + H2 | real, whatever you targeted | **real PostgreSQL** |
| Reproducible from a clean clone | yes | only if the target is ephemeral | yes |
| Proves the migrations run | no | yes, against that target | **yes, from empty** |
| Offline build | yes | no | no |
| Speed | fastest | depends on the server | slowest |
| Fails on exotic PostgreSQL DDL | often | no | no |

**A reasonable default:** start at route 1, and move to route 3 the first time the parser refuses
something you are not willing to hide behind `[jooq ignore start]`. Route 2 is the right answer
when you already own per-branch ephemeral databases — you are paying for the infrastructure
anyway.

⚠️ **Whichever you choose, choose one.** Two routes configured in two profiles is a promise that
the two will diverge, and the divergence will be discovered by a compile error on a machine that
was using the other one.

## Gotchas

**★ This is not Testcontainers-the-test-library doing this.** It is a build plugin that happens to
use the same container machinery. Adding the Testcontainers *test* dependency does nothing for
code generation, and the two are configured completely separately — different coordinates,
different lifecycle, different configuration.

**★ The plugin supports PostgreSQL, but your production version may not be the image tag you
pinned.** Generating against `postgres:14` while running PostgreSQL 18 reintroduces exactly the
fidelity gap the route exists to close, only more subtly. Pin the image to the major version you
deploy, and change it when you upgrade.

**★ A container that fails to start produces an error about the generator, not about Docker.** The
failure usually surfaces where the plugin tries to connect, and the message is often a connection
refused rather than the image pull that failed thirty seconds earlier. Read upward in the log, not
at the last line.

**★ Seed data in your migrations now runs in every build.** The container starts empty each time,
so a `V…__seed.sql` with a hundred thousand rows is a per-build cost paid by every developer. Keep
seed data in a directory the codegen `<locations>` does not include, or in a callback the build
skips.

**★ Migrations that are not idempotent from empty will fail here, and are supposed to.** A
migration written against a schema that already had a column — because someone had run it by hand
— passes forever in production and fails on the first empty-container build. That is the route
doing its job; "fixing the build" by pinning an older container is the wrong fix.

**★ Offline builds stop working, including on a train and including in a locked-down CI.** This is
the cost people discover last and complain about most. If offline builds matter to your team, that
is an argument for route 1 that no amount of schema fidelity outweighs.

**★ The generator connecting to a container it did not start is a configuration smell.** If you
find yourself passing a fixed port to both a container and a `<jdbc>` block, two plugins are
fighting over one responsibility. Let this plugin own the whole pipeline, or run route 2 properly.

**★ Three supported database types is a hard boundary, not a default.** Oracle, SQL Server, DB2
and the rest are not merely unconfigured here — they are unsupported by this plugin. On those
engines the fidelity conversation is a route 2 conversation, and it collides with the licence
question in **[01b · The licence question](01b-the-licence-question.md)** as well.

**★ The image is pulled by the build, so an image tag that moves changes your generated code.**
`postgres:18` is a moving target within the major version. That is usually harmless and
occasionally not — a minor release that changes a catalogue detail changes what the generator
reads, and the diff appears with no commit that explains it.

**★ CI caching does not help as much as you expect.** The image layers cache well; the container
*start* does not, and neither does applying every migration from empty. On a schema with two
hundred migrations that is a real per-build cost, and it grows with the project.

**★ Two Maven modules each running this plugin start two containers.** In a multi-module build
where several modules generate from the same schema, the naive setup pays the whole cost per
module. Generate once in a dedicated module and depend on its artifact.

**★ Developers will disable it locally, and that is the failure mode to watch for.** A profile
that swaps in `DDLDatabase` "just for laptops" recreates the two-routes divergence, and it will be
discovered by a compile error nobody can reproduce.

## Interview questions

**★ Whose plugin is `testcontainers-jooq-codegen-maven-plugin`?** The Testcontainers project's.
jOOQ's manual explicitly calls Testcontainers a third-party tool and links to a separate blog
article rather than documenting it as a first-class route. Support and compatibility follow from
that, not from jOOQ's release cadence.

**★ Which databases does that plugin support?** `POSTGRES`, `MYSQL` and `MARIADB`. If your
production engine is not one of those, the route is unavailable and you provision the database
yourself.

**★ Which migration engines does it support?** Flyway, with its documented properties supported in
full, and Liquibase, with its essential properties supported.

**★ What do the three configuration blocks correspond to?** `<database>` is where the schema will
live — the image and the credentials; `<flyway>` is how the schema gets there; `<jooq>` is the
ordinary generator configuration deciding what Java to make of it.

**★ Your CI has no Docker. Which route do you take, and what do you lose?** Route 1,
`DDLDatabase`. You lose fidelity to PostgreSQL's own type resolution and you lose the proof that
the migrations run from empty — so you gain an obligation to prove that separately, in tests or in
a staging deploy.

**★ A migration passes in production and fails in the containerised build. Who is wrong?** The
migration, almost always. The container starts empty; production did not. A migration that only
works against an already-modified schema is a latent failure this route surfaced early, and
disabling the route to make the build green buries it again.

**★ What does the container add that route 2 against a real PostgreSQL does not?** Not fidelity —
route 2 already had that. It adds *from empty* and *per build*: proof the migrations run in order
from nothing, no shared state, and no possibility of a hand-made change leaking into the generated
API.

**★ What is the real cost of this route, stated honestly?** A container runtime on every machine
that compiles the project, image-pull and container-start time in every build, a registry
dependency in restricted networks, and infrastructure failures presenting as build failures. In
exchange, the generated API cannot disagree with what PostgreSQL would do.

**★ How do you decide between the three routes for a new project?** By how PostgreSQL-specific the
schema is. Tables, columns, keys and indexes → route 1, and keep the offline build. Extensions,
partitioning, domains, exclusion constraints, heavy `jsonb` → route 3, and accept the container
runtime. Route 2 only if you already own per-branch ephemeral databases.

**★ Why is configuring two routes behind two Maven profiles a bad idea?** Because two people can
then compile against two different generated APIs from the same commit. The divergence surfaces as
a compile error that only reproduces on one machine, and the time it costs dwarfs whatever the
profile was meant to save.

**★ You pin `postgres:18-alpine` and the generated code changes with no schema commit. What
happened?** The tag moved. Minor releases within a major version can change what the catalogue
reports, and the generator reads the catalogue. Pinning a more specific tag makes the input as
reproducible as the migrations are.

**★ In a multi-module build, how do you avoid starting a container per module?** Generate once, in
a module dedicated to it, and let the other modules depend on the resulting artifact. Running the
plugin in every module that touches the database pays the full pipeline cost each time.

{/* FOOTER */}
