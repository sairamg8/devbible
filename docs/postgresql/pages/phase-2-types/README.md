---
title: "Phase 2 — Data types and the relational model"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.** Examples measured on the sandbox where noted.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Integer types](01-integers.md)** | <span className="db-tier t-master">Master</span> | smallint/int/bigint as ids |
| 02 | **[numeric vs float](02-numeric-vs-float.md)** | <span className="db-tier t-master">Master</span> | Money never in float |
| 03 | **[text vs varchar vs char](03-text.md)** | <span className="db-tier t-master">Master</span> | text is the default answer |
| 04 | **[timestamptz vs timestamp](04-timestamptz.md)** | <span className="db-tier t-master">Master</span> | Always timestamptz for events |
| 05 | **[Time zones](05-time-zones.md)** | <span className="db-tier t-master">Master</span> | What timestamptz stores |
| 06 | **[NULL semantics](06-null.md)** | <span className="db-tier t-master">Master</span> | IS NULL, three-valued logic |
| 07 | **[uuid](07-uuid.md)** | <span className="db-tier t-understand">Understand</span> | gen_random_uuid and PK trade-offs |
| 08 | **[jsonb vs json](08-jsonb.md)** | <span className="db-tier t-understand">Understand</span> | Prefer jsonb |
| 09 | **[boolean, date, interval](09-boolean-dates.md)** | <span className="db-tier t-understand">Understand</span> | boolean and date arithmetic |
| 10 | **[Arrays](10-arrays.md)** | <span className="db-tier t-understand">Understand</span> | When arrays beat child tables |
| 11 | **[enum vs CHECK vs lookup](11-enum-check-lookup.md)** | <span className="db-tier t-understand">Understand</span> | Evolving statuses prefer lookup/CHECK |
| 12 | **[Casting](12-casting.md)** | <span className="db-tier t-understand">Understand</span> | Casts that kill indexes |
| 13 | **[bytea](13-bytea.md)** | <span className="db-tier t-know">Know</span> | Binary in DB rarely |
| 14 | **[Network, geometric, citext](14-network-geo-citext.md)** | <span className="db-tier t-know">Know</span> | inet/cidr and friends |
| 15 | **[Domains and composites](15-domains-composites.md)** | <span className="db-tier t-know">Know</span> | Reusable constraints |
| 16 | **[Range types](16-ranges.md)** | <span className="db-tier t-when">When Needed</span> | tstzrange and exclusion |
| 17 | **[Modelling money](./17-modelling-money/README.md)** | <span className="db-tier t-master">Master</span> | currency, rounding, allocation |

## Phase gate

Move on when you default to bigint + text + timestamptz + numeric for money, and you never write `= NULL`.

---

← Syllabus: [Part 1](../../syllabus/01-foundations.md) · Start → [Integer types](01-integers.md)
