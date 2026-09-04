---
title: "A repository test that passes on H2 has proved that your SQL works on H2, and H2 is not the database you deploy — the substitution happens silently, and it fails in both directions"
sidebar_label: "01 · Passed on H2 proves nothing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the H2 2.x documentation — *Features → Compatibility →
> PostgreSQL Compatibility Mode* and *Advanced → Transaction Isolation*
> ([h2database.com/html/features.html](https://www.h2database.com/html/features.html),
> [h2database.com/html/advanced.html](https://www.h2database.com/html/advanced.html)) —
> the Testcontainers 2.0.5 *Database containers* module documentation
> ([java.testcontainers.org/modules/databases](https://java.testcontainers.org/modules/databases/))
> and the Spring Boot 4.1.1 `AutoConfigureTestDatabase` source
> ([`module/spring-boot-jdbc-test/.../AutoConfigureTestDatabase.java` @ v4.1.0](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-jdbc-test/src/main/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.java)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, **Testcontainers 2.0.5**, **H2 2.4.240**, PostgreSQL JDBC
> 42.7.11, JUnit Jupiter 6.0.3. **There is no Docker and no sandbox on this machine** —
> every page in this topic carries Java source and documented configuration, and never a
> container log, a startup timing or a test run.

**The argument of this whole topic is one sentence: a test is only evidence about the
thing it actually ran against. If your repository test ran against H2 and your service
runs against PostgreSQL 18, the test is evidence about H2. That would be a pedantic
point if the two were the same database with different logos. They are not — they
disagree about identifier case, about whether DDL is transactional, about what
`REPEATABLE READ` prevents, about half the type system and about most of the interesting
SQL — and the sibling chunk names those disagreements one at a time. What makes this
worth a topic rather than a footnote is that nobody chooses H2. Spring Boot substitutes
it for you, quietly, and the test goes green.**

## Nobody types "use H2". Boot swaps it in

The reason this trap is worth a page is that the substitution is a *default*, not a
decision. Two mechanisms do it, and neither of them prints anything you would read as a
warning.

**The first is auto-configuration.** If `com.h2database:h2` is on the test classpath and
no `spring.datasource.url` is set, Boot's `DataSource` auto-configuration builds an
embedded in-memory database. In most projects H2 is on the test classpath because a
tutorial put it there in week one and nobody removed it.

**The second is the JDBC test slices**, and this one operates even when you *did*
configure a real URL. `@DataJpaTest` and `@JdbcTest` are meta-annotated with
`@AutoConfigureTestDatabase`, whose `replace()` attribute in Boot 4.1.0 defaults to
`Replace.NON_TEST`:

```java
@PropertyMapping(skip = Skip.ON_DEFAULT_VALUE)
Replace replace() default Replace.NON_TEST;
```

and the javadoc on that enum constant spells out exactly what survives the swap:

> *"Replace the DataSource bean unless it is auto-configured and connecting to a test
> database. The following types of connections are considered test databases:*
> *— Any bean definition that includes `ContainerImageMetadata` (including
> `@ServiceConnection` annotated Testcontainers databases, and connections created using
> Docker Compose)*
> *— Any connection configured using a `spring.datasource.url` backed by a
> `@DynamicPropertySource`*
> *— Any connection configured using a `spring.datasource.url` with the Testcontainers
> JDBC syntax"*

Read that list from the other end: **anything that is not one of those three is replaced
by an embedded database.** A plain `spring.datasource.url` pointing at a PostgreSQL you
started by hand is not on the list, so your slice test silently runs on H2 instead. This
is a good default — it is what stops a slice test from writing to a colleague's database
— but it means "I configured PostgreSQL in `application-test.yml`" is not an answer to
"what did this test run against".

`Replace` has four values and the other three matter when you are diagnosing this:

| Value | What it replaces |
|---|---|
| `NON_TEST` (default) | Everything except a container-backed or Testcontainers-URL `DataSource` |
| `ANY` | *"Replace the DataSource bean whether it was auto-configured or manually defined."* |
| `AUTO_CONFIGURED` | *"Only replace the DataSource if it was auto-configured."* |
| `NONE` | *"Don't replace the application default DataSource."* |

The reason chunks 04 and 05 of this topic spend so long on `@ServiceConnection` is
visible right here: a container wired through `@ServiceConnection` carries
`ContainerImageMetadata` on its bean definition, which is the token that makes
`Replace.NON_TEST` leave it alone. You do not have to write `@AutoConfigureTestDatabase(replace = NONE)`
and remember why.

## It fails in both directions, and the false green is the expensive one

There are two ways an impostor database misleads you, and they are not symmetrical.

**A false red** is when the test fails on H2 for a reason that does not exist in
production — an unsupported function, a type H2 does not have, an `ON CONFLICT DO UPDATE`
it will not parse. This costs an afternoon and is self-announcing. Somebody eventually
rewrites the query into the intersection dialect that both databases accept, and now the
production query is worse than it needed to be because a test framework voted on it.
That is a real cost, but it is a *visible* one.

**A false green** is when the test passes on H2 and the same code is broken against
PostgreSQL. Nothing announces it. The suite is green, the pull request is approved, and
the defect is discovered by a user. Every entry in the sibling chunk's divergence list is
a false-green generator: an isolation level that prevents a phenomenon on one engine and
not the other, an identifier that folds up on one and down on the other, a sequence whose
gap behaviour differs, a DDL statement that rolls back on one and commits on the other.

The asymmetry is the whole argument. You can live with false reds. A test suite that
produces false greens is not a safety net; it is a *belief* about a safety net, and the
belief is worse than nothing because it stops you looking.

## "But H2 has a PostgreSQL mode"

It does, and it is worth knowing precisely what it promises, because the name oversells
it by a wide margin. H2's own documentation frames the whole compatibility feature
modestly:

> *"All database engines behave a little bit different. Where possible, H2 supports the
> ANSI SQL standard, and tries to be compatible to other databases."*

The PostgreSQL mode is switched on by a URL:

```
jdbc:h2:mem:testdb;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH
```

and H2 immediately adds a constraint you cannot undo later:

> *"Do not change value of `DATABASE_TO_LOWER` after creation of database."*

What the mode then does is documented as a **finite list of twenty behaviours** — things
like `LOG(x)` becoming base 10, `EXTRACT(DOW)` returning 0–6 with Sunday as 0, `MONEY`
being treated as `NUMERIC(19, 2)`, and `ctid`/`oid` being accepted as system columns.
That list is quoted item by item in **01c · What H2 gets wrong** *(not written yet)*,
which also sets each item against what PostgreSQL 18 actually does.

The important property of that list is **that it is a list**. It is an enumerated set of
twenty compatibility patches, not a claim of dialect equivalence. `MODE=PostgreSQL` is
H2 declaring which specific incompatibilities it has chosen to file down. Everything not
on the list is unchanged H2 behaviour wearing a PostgreSQL label, which is strictly more
dangerous than unlabelled H2 — a mode called "PostgreSQL" invites you to stop checking.

## Testcontainers' own documentation makes the same argument, and does not overclaim

The Testcontainers 2.0.5 *Database containers* page opens by naming H2 explicitly as the
thing it replaces, and it is candid about the trade:

> *"Instead of H2 database for DAO unit tests that depend on database features that H2
> doesn't emulate. Testcontainers is not as performant as H2, but does give you the
> benefit of 100% database compatibility (since it runs a real DB inside of a
> container)."*

Two halves, and both are load-bearing. "**100% database compatibility**" is not marketing
hyperbole here — it is a tautology, because the thing in the container *is* PostgreSQL,
built by the PostgreSQL project, running the same executable as production. There is no
emulation layer to be incomplete. And "**not as performant as H2**" is conceded in the
same breath, which is the honest half that chunk 09 of this topic is built on.

The same page then adds a caveat that this topic takes seriously rather than skipping:

> *"Of course, it's still important to have as few tests that hit the database as
> possible, and make good use of mocks for components higher up the stack."*

That is Testcontainers telling you not to put everything on a container. The argument of
this topic is not "run every test against a real database". It is "when a test's subject
**is** the database interaction, run it against the database you deploy" — and the corollary
is that most tests should not be about database interaction at all.

## Gotchas

**★ H2 arrives on the test classpath through `spring-boot-starter-data-jpa` tutorials, not through a decision, and then never leaves.**
Grep your build for `com.h2database:h2` before you argue about test strategy. If it is
there in `test` scope and no test declares `@AutoConfigureTestDatabase(replace = Replace.NONE)`,
assume every slice test in the project is running on H2 regardless of what
`application-test.yml` says. Removing the dependency is the fastest way to find out how
many tests were relying on it — they will fail to start rather than fail an assertion,
which is exactly the signal you want.

**★ Configuring `spring.datasource.url` to a real PostgreSQL does not stop a slice test using H2.**
`Replace.NON_TEST` only exempts container-backed connections, `@DynamicPropertySource`-backed
URLs, and Testcontainers `jdbc:tc:` URLs. A plain URL in a properties file is none of
those, so it is replaced. The fix is not to fight the default — it is to make the
connection one of the three the default already recognises, which is what
`@ServiceConnection` does.

**★ `MODE=PostgreSQL` is twenty specific behaviours, and the name invites you to assume it is all of them.**
An engineer who sees `MODE=PostgreSQL` in a JDBC URL reasonably concludes the dialect gap
has been handled. It has been handled for twenty enumerated items. Read the list once —
it is short, and it is reproduced in **01c · What H2 gets wrong** *(not written yet)* —
and you will never make that inference again.

**★ `DATABASE_TO_LOWER` cannot be changed after the database is created.**
H2's documentation says so flatly. Because an in-memory H2 is created fresh per JVM this
rarely bites in tests, but it bites hard on a file-backed H2 that a team has been using
for local development: switching a long-lived local database into PostgreSQL mode is not
a URL edit.

## Interview questions

**★ Your team says "our repository tests pass on H2, so the SQL is fine." What is wrong with that sentence?**
The tests establish that the SQL is fine *on H2*. H2 and PostgreSQL are different
implementations that disagree about identifier case folding, whether DDL participates in
the surrounding transaction, what `REPEATABLE READ` prevents, the type system, and most
non-trivial SQL. So the statement is only true to the extent that the query lives in the
intersection dialect, and nothing in the build enforces that it does. The specific danger
is the false green: a query that H2 accepts and PostgreSQL rejects or answers differently
produces a passing test and a broken service, with no signal anywhere in between.

**★ How does a Spring Boot slice test end up on H2 when the project has a configured PostgreSQL URL?**
`@DataJpaTest` and `@JdbcTest` are meta-annotated with `@AutoConfigureTestDatabase`, whose
`replace` attribute defaults to `Replace.NON_TEST` in Boot 4.1. `NON_TEST` replaces the
`DataSource` unless the connection is recognised as a test database, and the javadoc lists
exactly three recognised forms: a bean definition carrying `ContainerImageMetadata`
(which is what `@ServiceConnection` and Docker Compose support produce), a
`spring.datasource.url` backed by `@DynamicPropertySource`, and a `spring.datasource.url`
using the Testcontainers `jdbc:tc:` syntax. A plain URL in a properties file is none of
those, so it is replaced by an embedded database — H2, if H2 is on the classpath.

**★ Is `MODE=PostgreSQL` enough to make H2 a fair stand-in?**
No, and the shape of the answer matters more than the verdict. `MODE=PostgreSQL` is a
documented list of twenty specific behavioural adjustments — result-set metadata for
aliased columns, rounding instead of truncation on float-to-integer conversion, `ctid` and
`oid` as system columns, base-10 `LOG`, legacy `SERIAL`, `ON CONFLICT DO NOTHING`, and so
on. It is an enumeration, not an equivalence claim. Anything outside the list is ordinary
H2 behaviour, and the mode's name makes you less likely to check.

**★ What is the difference between a false red and a false green here, and why does it change what you do?**
A false red is a test failing for a reason that does not exist in production; it is loud,
it costs an afternoon, and it usually ends with the production query being degraded into
the intersection dialect. A false green is a test passing while production is broken; it
is silent and it is discovered by a user. Because the failure modes are asymmetric, the
mitigation is asymmetric too: you can tolerate an environment that produces false reds,
but an environment that can produce false greens has to be replaced rather than worked
around, because there is no amount of discipline that makes a silent failure visible.
{/* FOOTER */}
