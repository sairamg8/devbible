---
title: "Phase 10 — Data access"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Hibernate ORM
> 7.4.1 (Jakarta Persistence 3.2) · Spring Data JPA 4.1.0 · HikariCP 7.0.2 ·
> Flyway 12.4.0 · PostgreSQL 18.**
> ⚠️ Boot 4.1's baseline is **JDK 17** — 25 is the recommended LTS, not the floor.
> Documentation-validated — every page names its sources on a `> Verified:`
> line (the JDBC specification and JDK API docs, HikariCP's documentation, the
> Spring Framework transaction docs, the Hibernate ORM 7.4 user guide, the
> Jakarta Persistence 3.2 specification, Flyway and PostgreSQL 18 docs). No
> sandbox: pages carry Java/SQL code, never fabricated query logs.

The layer where Java meets PostgreSQL — and where the worst performance bugs
in typical services live. JPA is taught *after* JDBC on purpose: you cannot
debug an abstraction you've never seen under.

🚧 **3 of 14 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[JDBC](01-jdbc/README.md)** | <span className="db-tier t-master">Master</span> | `PreparedStatement` always — SQL injection dies here |
| 02 | **[Connection pooling with HikariCP](02-connection-pooling/README.md)** | <span className="db-tier t-understand">Understand</span> | Small pools, leak detection, "connection is not available" |
| 03 | **[Transactions at the JDBC level](03-jdbc-transactions/README.md)** | <span className="db-tier t-understand">Understand</span> | Isolation levels mapped to real anomalies |
| 04 | **Spring `@Transactional`** *(not written yet)* | <span className="db-tier t-master">Master</span> | Proxy mechanics, rollback rules, the self-invocation trap |
| 05 | **SQL-first access** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `JdbcTemplate`/`JdbcClient` — when typed SQL beats entities |
| 06 | **The JPA/Hibernate model** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The persistence context — the UPDATE you never wrote |
| 07 | **Relationships and fetch types** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Owning side, `mappedBy` — `EAGER` on a collection is a time bomb |
| 08 | **The N+1 problem** *(not written yet)* | <span className="db-tier t-master">Master</span> | Seeing it in the SQL log; fetch joins, `@EntityGraph`, batch size |
| 09 | **Spring Data JPA** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Derived queries, `@Query`, pagination, projections |
| 10 | **Lazy-loading pitfalls** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `LazyInitializationException`; open-session-in-view, off |
| 11 | **Migrations with Flyway** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Versioned SQL in the repo — never `ddl-auto: update` in prod |
| 12 | **Caching** *(not written yet)* | <span className="db-tier t-know">Know</span> | Second-level, `@Cacheable` with Redis — invalidation is the cost |
| 13 | **jOOQ** *(not written yet)* | <span className="db-tier t-know">Know</span> | Typed SQL as the JPA alternative — reporting, complex joins |
| 14 | **Spring Data for MongoDB / Redis** *(not written yet)* | <span className="db-tier t-know">Know</span> | The same repository idiom over the other stores in this bible |

## Phase gate

Move on when: with SQL logging on, you can point at the N+1 a naive `findAll`
+ getter loop produces, fix it with a fetch join, and explain why
`@Transactional` on a private method never worked.

## Where this connects

- **[Phase 5](../phase-5-exceptions/README.md)** — try-with-resources and
  exception translation are JDBC's daily discipline.
- The **[PostgreSQL section](../../../postgresql/README.md)** of this bible
  owns SQL itself; these pages own the Java side of the boundary.
- **Phase 15 — Messaging** builds the transactional outbox on topic 04's
  transaction semantics.
