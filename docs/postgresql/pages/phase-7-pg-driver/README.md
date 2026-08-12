---
title: "Phase 7 — The pg driver, end to end"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Installing and wiring pg](01-install-wire.md)** | <span className="db-tier t-master">Master</span> | Pool at module scope |
| 02 | **[Pool vs Client](02-pool-vs-client.md)** | <span className="db-tier t-master">Master</span> | default Pool |
| 03 | **[Connection configuration](03-connection-config.md)** | <span className="db-tier t-master">Master</span> | URI vs object SSL |
| 04 | **[pool.query and placeholders](04-query-placeholders.md)** | <span className="db-tier t-master">Master</span> | safe path including ANY |
| 05 | **[Errors from PostgreSQL in Node](05-errors.md)** | <span className="db-tier t-master">Master</span> | SQLSTATE to HTTP |
| 06 | **[The result object](06-result-object.md)** | <span className="db-tier t-understand">Understand</span> | rows rowCount fields |
| 07 | **[pool.connect and release](07-connect-release.md)** | <span className="db-tier t-understand">Understand</span> | finally release |
| 08 | **[Type parsing](08-type-parsing.md)** | <span className="db-tier t-understand">Understand</span> | bigint numeric strings |
| 09 | **[Overriding type parsers](09-pg-types.md)** | <span className="db-tier t-understand">Understand</span> | bigint decision |
| 10 | **[Prepared statements](10-prepared.md)** | <span className="db-tier t-understand">Understand</span> | name field |
| 11 | **[Query timeouts](11-timeouts.md)** | <span className="db-tier t-understand">Understand</span> | which timeout saves you |
| 12 | **[One query one statement](12-one-statement.md)** | <span className="db-tier t-understand">Understand</span> | multi-statement feature |
| 13 | **[pool.end](13-pool-end.md)** | <span className="db-tier t-understand">Understand</span> | graceful shutdown |
| 14 | **[LISTEN NOTIFY from Node](14-listen-notify.md)** | <span className="db-tier t-know">Know</span> | dedicated Client |
| 15 | **[pg-cursor streaming](15-cursors.md)** | <span className="db-tier t-know">Know</span> | large results |
| 16 | **[pg vs postgres.js](16-postgres-js.md)** | <span className="db-tier t-know">Know</span> | when to switch |

## Phase gate

Move on when you can open a pool, parameterize queries, map 23505, and never leak clients.

---

← Syllabus: [Part 3](../../syllabus/03-node-and-pg.md) · Start → [Installing and wiring pg](01-install-wire.md)
