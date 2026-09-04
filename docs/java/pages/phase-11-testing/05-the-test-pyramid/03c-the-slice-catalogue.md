---
title: "Boot 4 split the test slices into per-module artifacts and changed almost every one of their packages, so the import line in every tutorial you will find is now wrong — and the one annotation that did not move is the one the appendix no longer lists"
sidebar_label: "03c · The slice catalogue"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.1 *Test Auto-configuration Annotations*
> appendix ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html)),
> which in 4.x carries a **Module** column, and the Boot 4.1.0 javadoc for `WebMvcTest`,
> `DataJpaTest`, `JdbcTest`, `RestClientTest`, `WebClientTest`, `JsonTest` and
> `AutoConfigureTestDatabase.Replace`; package mapping cross-checked against the javadoc's
> `type-search-index`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — no test run, no build output.

**[03](03-the-slices.md) explained the mechanism and [03b](03b-what-a-slice-excludes.md) the
diagnosis. This chunk is the reference list: which slices exist in Boot 4.1, what each one is
for, and — the part that will actually cost you an afternoon — **where each one now lives**.
Boot 4 broke the monolithic `spring-boot-test-autoconfigure` into per-module artifacts, and the
annotations moved with their modules. The class names did not change. The packages nearly all
did.**

## 🔴 The move, in one example

```java
// Boot 3 — every tutorial, every Stack Overflow answer, every LLM answer
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;

// Boot 4.1
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
```

The symptom is a compile error, not a runtime one, so this costs minutes rather than hours — but
it costs them on **every** slice, and the IDE's auto-import will happily offer the old package if
an older Boot is anywhere on the classpath of another module in the build.

The rule behind the mapping: the annotation moved next to **the module it configures**, and the
segment `test.autoconfigure` moved to the end.

## The catalogue

| Annotation | Module package (Boot 4.1) | Configures a context for |
|---|---|---|
| `@WebMvcTest` | `org.springframework.boot.webmvc.test.autoconfigure` | Servlet MVC controllers, with `MockMvc` |
| `@WebFluxTest` | `…boot.webflux.test.autoconfigure` | Reactive controllers, with `WebTestClient` |
| `@DataJpaTest` | `…boot.data.jpa.test.autoconfigure` | JPA entities and Spring Data JPA repositories |
| `@JdbcTest` | `…boot.jdbc.test.autoconfigure` | `JdbcClient`/`JdbcTemplate` against a `DataSource` |
| `@DataJdbcTest` | `…boot.data.jdbc.test.autoconfigure` | Spring Data JDBC repositories |
| `@DataR2dbcTest` | `…boot.data.r2dbc.test.autoconfigure` | Reactive relational access |
| `@JooqTest` | `…boot.jooq.test.autoconfigure` | jOOQ `DSLContext` against a real database |
| `@DataMongoTest` | `…boot.data.mongodb.test.autoconfigure` | MongoDB repositories and templates |
| `@DataRedisTest` | `…boot.data.redis.test.autoconfigure` | Redis templates and repositories |
| `@DataNeo4jTest` | `…boot.data.neo4j.test.autoconfigure` | Neo4j repositories |
| `@DataCassandraTest` | `…boot.data.cassandra.test.autoconfigure` | Cassandra repositories |
| `@DataCouchbaseTest` | `…boot.data.couchbase.test.autoconfigure` | Couchbase repositories |
| `@DataElasticsearchTest` | `…boot.data.elasticsearch.test.autoconfigure` | Elasticsearch repositories |
| `@DataLdapTest` | `…boot.data.ldap.test.autoconfigure` | LDAP repositories |
| `@RestClientTest` | `…boot.restclient.test.autoconfigure` | Code that *calls* HTTP, with `MockRestServiceServer` |
| 🔴 `@WebClientTest` | `…boot.webclient.test.autoconfigure` | **New in 4.0** — beans that use `WebClient.Builder` |
| `@GraphQlTest` | `…boot.graphql.test.autoconfigure` | GraphQL controllers |
| `@WebServiceClientTest` | `…boot.webservices.test.autoconfigure.client` | SOAP clients |
| `@WebServiceServerTest` | `…boot.webservices.test.autoconfigure.server` | SOAP endpoints |
| ⚠️ `@JsonTest` | `org.springframework.boot.test.autoconfigure.json` | **Did not move** — serialisation round trips |

Supporting annotations moved the same way: `@AutoConfigureMockMvc` is now in
`…boot.webmvc.test.autoconfigure`, `@AutoConfigureTestDatabase` in
`…boot.jdbc.test.autoconfigure`, and `TestEntityManager` in `…boot.jpa.test.autoconfigure`.

## ⚠️ `@JsonTest` — absent from the appendix table, still very much alive

`@JsonTest` is **not** in the 4.1 appendix's per-module table, and it is easy to read that as a
removal. It is not one. `@JsonTest` stayed in the core `spring-boot-test-autoconfigure` artifact
at its original address, `org.springframework.boot.test.autoconfigure.json.JsonTest`, precisely
because it does not belong to any one module — JSON is not a module the way WebMvc or Data JPA
are. The appendix table is organised by module, so an annotation with no module has no row.

Both the plan you had in your head and the appendix are correct; they are answering different
questions. If you take one thing from this section: **an annotation's absence from that table is
not evidence it was removed.** Check the javadoc.

## 🔴 `@AutoConfigureTestDatabase` no longer swaps your real database by default

This is the change that invalidates the single most-repeated piece of Spring testing advice, and
it matters far beyond this chunk.

`@DataJpaTest`, `@JdbcTest`, `@DataJdbcTest` and `@JooqTest` all carry
`@AutoConfigureTestDatabase`. Its `replace` attribute defaults to **`Replace.NON_TEST`**, which
the javadoc defines as:

> *"Replace the `DataSource` bean unless it is auto-configured and connecting to a test
> database"*

and a "test database" here explicitly includes a datasource that came from a Testcontainers
`@ServiceConnection`, from a Docker Compose connection, or from a `@DynamicPropertySource`-backed
`spring.datasource.url`.

The consequence: **`@DataJpaTest` does not blindly swap your Testcontainers PostgreSQL for an
embedded H2 any more.** It recognises it as a test database and leaves it alone.

Two pieces of received wisdom die here:

1. *"You must write `@AutoConfigureTestDatabase(replace = NONE)` to use Testcontainers with
   `@DataJpaTest`."* — no longer true, and worse than unnecessary: `NONE` disables the
   replacement **unconditionally**, so if the Testcontainers wiring ever silently stops applying,
   `NONE` will run your test against whatever `spring.datasource.url` resolves to. `NON_TEST`
   would have caught it. The stricter-looking option is the less safe one.
2. *"`@DataJpaTest` means H2."* — it means H2 only if nothing else has provided a test database.
   With `@ServiceConnection` present, it means PostgreSQL.

[07 · Passed on H2 proves nothing](../07-testcontainers/01-passed-on-h2-proves-nothing.md) is where the "it passed on
H2" argument lives, and it has to agree with this: the divergence argument is about *choosing* an
in-memory database, not about Boot forcing one on you.

## Choosing among them

The catalogue is long but the decision is short, because the slices divide by **what the test is
about**, not by what your class touches:

- Asserting on **HTTP shape** — status, headers, JSON body, validation errors → `@WebMvcTest`
  (`@WebFluxTest` reactive). Topic 06 owns the detail.
- Asserting on **a query** — a derived method name, a `@Query`, a mapping → `@DataJpaTest`,
  `@JdbcTest`, `@JooqTest`, whichever matches the access technology.
- Asserting on **serialisation** — that a field renders as `orderTotal`, that a date is ISO →
  `@JsonTest`. Far cheaper than a `@WebMvcTest` for the same assertion.
- Asserting on **an outbound call** — the URL you build, the retry, the error mapping →
  `@RestClientTest` or `@WebClientTest`, with `MockRestServiceServer`.
- Asserting on **your own logic** → no slice at all. That was
  [02](02-a-unit-test-needs-no-spring.md), and it is still the right answer more often than this
  page's length suggests.

## Gotchas and pitfalls

**★ Copying an import from anything written before 2025.**
Nearly every slice package changed in Boot 4. The class names did not, so search-and-replace on
the annotation name will not find the problem and the IDE will offer you the old package if any
module in the build still resolves Boot 3.

**★ Concluding `@JsonTest` was removed because it is not in the appendix table.**
The table is per-module and `@JsonTest` has no module. It is alive, at its original package.

**★ Writing `@AutoConfigureTestDatabase(replace = NONE)` out of habit.**
It is unnecessary on Boot 4 with `@ServiceConnection`, and it is *less* safe than the default: it
switches off the replacement unconditionally instead of "unless this is already a test database",
so a broken Testcontainers wiring fails open. This exact defect was found and repaired in Phase
10 topic 04.

**★ Using `@SpringBootTest` for a serialisation assertion.**
`@JsonTest` configures an `ObjectMapper` and the `JacksonTester` helpers and nothing else. If
the assertion is "does this DTO render correctly", a full context is two orders of magnitude of
startup for the same answer.

**★ Reaching for `@DataJpaTest` to test a repository method that is really SQL.**
It works, and it also starts Hibernate, builds an `EntityManagerFactory` and wraps everything in
a rolled-back transaction. If the thing under test is a hand-written query, `@JdbcTest` or
`@JooqTest` is a smaller context that answers the same question.

**★ Assuming a slice implies an embedded database.**
Only the four persistence slices carry `@AutoConfigureTestDatabase` at all, and what it does now
depends on what else configured the datasource.

**★ Expecting `@WebClientTest` in older material.**
It is new in Boot 4.0. Anything older will tell you to use `@RestClientTest` or a raw
`@SpringBootTest` for `WebClient` code.

## Interview questions

**★ Why did all the slice annotations change package in Boot 4?**
Because `spring-boot-test-autoconfigure`, previously one artifact containing every slice, was
split into per-module test-autoconfigure artifacts. Each annotation moved next to the module it
configures, with `test.autoconfigure` moving to the end of the package — so
`org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest` became
`org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`. The class names are unchanged,
which is why the failure is a compile error on the import rather than anything subtler.

**★ `@JsonTest` is missing from the Boot 4.1 appendix. Was it removed?**
No. The appendix table is organised by module and `@JsonTest` does not belong to a module — it
stayed in the core `spring-boot-test-autoconfigure` artifact at
`org.springframework.boot.test.autoconfigure.json.JsonTest`. Absence from a per-module table is
not evidence of removal.

**★ Do you still need `@AutoConfigureTestDatabase(replace = NONE)` with Testcontainers?**
No. The default is `Replace.NON_TEST` — replace the `DataSource` *unless* it is auto-configured
and already connecting to a test database, and a `@ServiceConnection` datasource counts as one.
`NONE` is not just unnecessary, it is weaker: it disables replacement unconditionally, so if the
container wiring stops applying, the test silently runs against whatever URL resolves instead of
being swapped to a safe embedded database.

**★ Which slice for "the JSON we return names this field `orderTotal`"?**
`@JsonTest`. It configures the `ObjectMapper` and `JacksonTester` and nothing else. A
`@WebMvcTest` would answer the same question through an entire MVC stack, and a
`@SpringBootTest` would start the application to do it.

**★ Which slice for "we call the pricing API with the right URL and handle its 503"?**
`@RestClientTest`, or `@WebClientTest` if the bean uses `WebClient.Builder`. Both give you
`MockRestServiceServer`, so you assert on the request you *sent* — which is the actual contract —
rather than mocking your own client class and asserting nothing about the HTTP.

**★ How do you decide between `@DataJpaTest` and `@JdbcTest`?**
By what the test is about. If the claim involves JPA — entity mapping, a derived query name,
lazy loading, the persistence context — you need JPA, so `@DataJpaTest`. If the claim is about a
SQL statement you wrote by hand, `@JdbcTest` is a smaller context that starts no Hibernate and
answers exactly the same question.

**★ Can you use two persistence slices in one test to compare them?**
No — combining slices is explicitly unsupported ([03](03-the-slices.md)). Write two test classes.
They will also be cached as two contexts, which is the honest cost of asking two questions.

{/* FOOTER */}
