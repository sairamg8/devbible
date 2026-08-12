---
title: "Version policy"
sidebar_label: "10 · Version policy"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

**PostgreSQL ships a new major roughly once a year and supports each major for
about five years.** Minors are bugfix and security releases — upgrade minors
promptly; treat majors as a project.

## Majors vs minors

| | Example | Compatibility |
|---|---|---|
| **Major** | 17 → 18 | New features; requires planned upgrade (`pg_upgrade`, dump/restore, or logical replication) |
| **Minor** | 18.3 → 18.4 | Same on-disk major; install and restart |

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show server_version;"
 server_version
----------------
 18.4

$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c "show server_version_num;"
 server_version_num
--------------------
 180004
```

> Verified: 2026-08. `server_version_num` is useful in scripts:
> `180004` = 18.4.

## From Node

```js
// version-num.mjs
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

const {rows} = await pool.query(`
  select
    current_setting('server_version') as version,
    current_setting('server_version_num')::int as version_num
`);
console.log(rows[0]);
await pool.end();
```

```console
$ node version-num.mjs
{ version: '18.4', version_num: 180004 }
```

Gate features in app code with `version_num` when you must support multiple
majors — rare for a single product database.

## This bible’s target

| | |
|---|---|
| **Target major** | **18** (measured on **18.4**) |
| **Node** | **24** Active LTS + `pg` |
| **Older notes** | Node Phase 6 pages measured on **17.10** — re-check before citing version-sensitive behavior |

## What major 18 is for (orientation, not a changelog)

Majors add planner, vacuum, I/O, and SQL features. Do not memorize the full
release notes here — pin the image tag (`postgres:18-alpine`), read release notes
when you upgrade, and verify claims with `select version()`.

UUIDv7 helpers and other 18-era features appear in later phases when the type or
API is taught.

## Trade-off

Staying on an old major is comfortable until support ends. Jumping majors needs
a dump/restore or `pg_upgrade` plan — Phase 13.

## Gotchas

**Symptom:** Extension missing after image bump  
**Cause:** Major change or alpine package set  
**Fix:** Reinstall extensions; pin versions in compose

**Symptom:** “It works on my laptop (PG 16)”  
**Cause:** Unpinned local major  
**Fix:** Same major in dev, CI, and prod

## Interview questions

**★ How long is a PostgreSQL major supported?**  
On the order of **five years** from release (check current policy when you plan).

**Should you skip minor upgrades?**  
No — minors carry security and bug fixes with low upgrade risk.

**How do you read `180004`?**  
Major 18, minor 4 (`server_version_num`).

---

← [Process model](09-process-model.md) · Next → [vs other databases](11-vs-other-databases.md)
