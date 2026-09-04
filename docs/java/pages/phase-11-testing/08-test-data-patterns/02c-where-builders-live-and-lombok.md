---
title: "Where the builder class lives once three modules want it — and the one thing Lombok's `@Builder` does to your field initializers that turns a fixture with sensible defaults into a fixture full of nulls"
sidebar_label: "02c · Where builders live, and Lombok"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Project Lombok** `@Builder` feature documentation
> ([projectlombok.org/features/Builder](https://projectlombok.org/features/Builder)) for
> `@Builder.Default`, field-initializer behaviour, explicit constructors and `toBuilder`; and
> the **Gradle** user manual *Testing in Java projects* page, section *Java test fixtures*
> ([docs.gradle.org/current/userguide/java_testing.html](https://docs.gradle.org/current/userguide/java_testing.html)),
> for the `java-test-fixtures` plugin, its source set and its visibility rules. Maven's
> `test-jar` route is the **Maven JAR plugin**'s documented goal.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no builds run on this machine** — build files and Java source are shown
> as documented, never as command output.

**Two questions that look like housekeeping and are not. The first — where does the builder
class live once a second module wants it — has three real answers with different costs, and the
wrong one puts test scaffolding on the production classpath permanently. The second is a single
documented behaviour of Lombok's `@Builder` that inverts the property a test data builder exists
for: unspecified fields come out `null`, not defaulted.**

## Where the class lives

Test builders belong in **test sources** (`src/test/java`), not `src/main/java`. Shipping them
in the main artifact puts test scaffolding on the production classpath and — worse — lets
production code start calling `withPersistedId`.

That is easy in one module and a real question in a multi-module build, because test code is not
visible across module boundaries by default.

### Gradle · the `java-test-fixtures` plugin

Gradle has a first-class answer. Applying the `java-test-fixtures` plugin creates a
`testFixtures` source set, published as its own variant, which a downstream project consumes
through the `testFixtures()` notation:

```kotlin
plugins {
    id("java-library")
    id("java-test-fixtures")
}
```

```kotlin
dependencies {
    implementation(project(":lib"))
    testImplementation(testFixtures(project(":lib")))
}
```

The visibility rules are the ones you want, and the manual states them plainly: test fixtures
can see the **main** source set's classes, and a project's **test** sources can see its test
fixtures. So a builder in `src/testFixtures/java` can call `Customer.register(...)`, every
module's tests can call the builder, and nothing on the production classpath can see either.

### Maven · the JAR plugin's `test-jar` goal

Maven has no fixtures source set. The conventional route is to attach the module's test classes
as a second artifact and depend on it downstream:

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>domain</artifactId>
  <version>${project.version}</version>
  <type>test-jar</type>
  <scope>test</scope>
</dependency>
```

It works and it is widely used. Its cost is that `test-jar` packages the module's **entire**
test-class output, so downstream modules receive every test class in that module, not only the
fixtures — and anything those classes reference must resolve for the downstream module to
compile.

### The third option · a small `testkit` module

Often the best answer in either build tool: a dedicated module — `domain-testkit` — holding
builders and object mothers as ordinary **main**-source classes, which other modules depend on
with `test` scope.

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>domain-testkit</artifactId>
  <version>${project.version}</version>
  <scope>test</scope>
</dependency>
```

It costs one module and buys ordinary visibility rules with no plugin-specific machinery, no
attached artifacts, and a dependency direction that is obvious from the module graph. The
scaffolding still never reaches production, because every dependency on it is test-scoped.

⚠️ Whichever you choose, the constraint is one-directional: **fixtures may depend on the domain;
the domain may never depend on fixtures.** The moment a production class imports a builder, the
scaffolding has become part of the shipped system.

## Lombok's `@Builder`, and the one thing it does to defaults

Generating the builder removes boilerplate but changes one behaviour that matters here. Lombok's
documentation is explicit: with `@Builder`, a field the builder does not set gets the **default
value for its type — `0` / `null` / `false`** — and a field *initializer* is not used unless the
field is annotated `@Builder.Default`.

```java
@Builder
public class Customer {
    private LoyaltyTier tier = LoyaltyTier.BRONZE;     // ⚠️ ignored by the builder → null
}
```

```java
@Builder
public class Customer {
    @Builder.Default private LoyaltyTier tier = LoyaltyTier.BRONZE;   // ✅ honoured
}
```

This is precisely the opposite of what a *test data* builder wants. The whole value of the
pattern is that a test names three fields and the rest come out sensible; a Lombok `@Builder` on
the domain class hands back `null` for everything the test did not name, which is how a suite
ends up with `NullPointerException`s in exactly the tests that were trying to be minimal.

There is a second trap in the same area, and Lombok states it: with an **explicit** constructor
rather than a Lombok-generated one, the defaults do not apply automatically — you must set them
yourself or chain to a Lombok-generated constructor. A class that gains a hand-written
constructor months later therefore starts producing differently-defaulted objects with no change
to any builder call and no compiler complaint.

The practical conclusion: `@Builder` on a *domain* class is a production API, and a poor
substitute for a hand-written test builder. If you want generated code, put `@Builder` on a
test-side value holder, or accept that every defaulted field must carry `@Builder.Default` and
that the annotation is now load-bearing for your test suite.

## Where this connects

- The pattern itself and its readability rules are in [02 · The builder](02-the-builder.md);
  the correctness rules — production doors, composition, copy-with-changes — are in
  [02b · Builder design rules](02b-builder-design-rules.md).
- What changes when the domain type is a `record` is in
  [02d · Builders and records](02d-builders-and-records.md).
- Build-tool mechanics in general — source sets, module layout, attached artifacts, scopes —
  belong to [Phase 8 · Build & dependencies](../../phase-8-build-dependencies/README.md).

## Gotchas

**★ Putting builders in `src/main/java` ships test scaffolding to production.**
It also lets production code start depending on them, which is how a builder ends up with a
`persistedId` method that someone calls at runtime. Builders belong in test sources; if two
modules need them, use Gradle's `java-test-fixtures`, Maven's `test-jar`, or a dedicated
`testkit` module — not a promotion into `main`.

**★ 🔴 Lombok's `@Builder` ignores your field initializers unless you write `@Builder.Default`.**
The documentation is explicit that an unset field gets `0` / `null` / `false`. A domain class
with `private LoyaltyTier tier = BRONZE;` and a plain `@Builder` hands your tests `null` for
every field they did not name — the exact opposite of what a test data builder is for. Either
annotate every defaulted field or do not use `@Builder` for fixtures.

**★ With an explicit constructor, Lombok's defaults stop applying by themselves.**
Lombok notes that when you write your own constructor rather than letting it generate one, the
`@Builder.Default` values are not applied automatically — you must assign them or chain to a
Lombok-generated constructor. A class that gains a hand-written constructor months later will
start producing differently-defaulted objects with no change to any builder call.

**★ A `test-jar` dependency drags the whole module's test classes, not just the fixtures.**
Maven's `test-jar` packages `target/test-classes` wholesale, so downstream modules get every
test class — and every one of that module's test-only dependencies has to resolve for them to
compile. Gradle's `java-test-fixtures` source set or a dedicated testkit module avoids this by
separating fixtures from tests in the first place.

**★ Fixtures depending on the domain is fine; the domain depending on fixtures is a one-way door.**
Once a production class imports a builder, the scaffolding is part of the shipped system and
cannot be changed freely any more. This usually starts with something innocuous — a demo data
loader, a `@Profile("dev")` seeder — and it is worth catching in review, because unwinding it
later means rewriting whatever grew on top.

**★ `java-test-fixtures` publishes a variant, which means it is consumable — and therefore public.**
The fixtures source set becomes part of what the project exposes, so anything you put there is
API for every consumer, including consumers outside your team if the artifact is published. That
is usually desirable for a library, and occasionally a surprise: a builder with a
`withPersistedId` escape hatch is now a documented capability rather than an internal shortcut.

**★ A `testkit` module depending on the domain creates a cycle the moment the domain's own tests want it.**
`domain-testkit` depends on `domain`, so `domain`'s own test sources cannot depend on
`domain-testkit` without a cycle in most build setups. Either keep the domain module's builders
in its own `src/test/java` and duplicate the few that other modules need, or use Gradle's
fixtures source set, which exists precisely because this cycle is awkward to avoid otherwise.

**★ Test-scoped does not mean invisible at runtime if something re-declares it.**
A `test`-scoped dependency keeps fixtures off the production classpath for *that* module only.
A downstream module that declares the testkit at compile scope — by accident, by an IDE
"add dependency" quick fix, or via a dependency-management block that omits the scope — puts it
back. If it matters, enforce it: the Maven Enforcer plugin's banned-dependencies rule and
Gradle's configuration model can both fail the build on the wrong scope.

## Interview questions

**★ Three modules need the same builders. Where do you put them?**
Not in `src/main/java` — that ships scaffolding and invites production code to depend on it. In
Gradle, the direct answer is the `java-test-fixtures` plugin: it creates a `testFixtures` source
set published as its own variant, consumed as `testImplementation(testFixtures(project(":lib")))`,
with fixtures able to see the main source set and tests able to see the fixtures. In Maven, the
conventional route is the JAR plugin's `test-jar` goal, consumed with `<type>test-jar</type>` and
test scope, at the cost of dragging the module's entire test-class output. The option I would
usually argue for is a small `domain-testkit` module holding fixtures as ordinary main classes,
depended on with test scope — one extra module, ordinary visibility rules, no plugin machinery,
and an obvious dependency direction.

**★ Can you just put Lombok's `@Builder` on the entity and use that as your test builder?**
You can, and you will get `null` where you expected defaults. Lombok's documentation states that
a field the builder does not set takes its type's default — `0`, `null`, `false` — and that a
field initializer is only honoured if the field carries `@Builder.Default`. Since the entire
point of a test data builder is that unspecified fields come out sensible, a plain `@Builder`
inverts the property you wanted. There is a second edge: with a hand-written constructor rather
than a Lombok-generated one, the defaults stop applying by themselves. And there is a design
objection underneath the mechanics — `@Builder` on a domain class is a production API, so you
are shaping production code around test convenience.

**★ What is the actual risk of a builder in `src/main/java`? It is only a few classes.**
Two risks, and the second is the expensive one. First, the classes ship: they are on the
production classpath, in the artifact, and in anything that scans it. Second, and irreversibly,
production code can now call them — a dev-profile data seeder, a demo endpoint, a migration
helper. At that point the builder's escape hatches (fabricated ids, bypassed validation, if you
have any) are reachable at runtime, and the class can no longer be changed freely because
production depends on its behaviour. The direction has to stay one-way: fixtures know about the
domain, the domain knows nothing about fixtures.

**★ Your team uses Maven and the `test-jar` approach has become painful. What do you propose?**
Name the specific pain first, because the fix differs. If the pain is that downstream modules
inherit hundreds of unrelated test classes and their dependencies, move the fixtures into a
`domain-testkit` module where they are ordinary main classes — the downstream dependency then
carries fixtures only. If the pain is build ordering or reactor complexity, that is the same
answer. If the pain is that fixtures and tests keep drifting apart because they live in
different modules, that is an argument for Gradle's fixtures source set, which keeps them in one
project with enforced one-way visibility — but switching build tools to fix a fixture-sharing
problem is not a trade most teams should make.

{/* FOOTER */}
