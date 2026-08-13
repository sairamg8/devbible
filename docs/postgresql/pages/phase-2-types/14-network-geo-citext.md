---
title: "Network, geometric and citext types"
sidebar_label: "14 · Network, geo, citext"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**Specialised types that validate their input and bring operators you would otherwise write
by hand. The pattern is the same in all three cases: storing them as `text` costs more space,
loses validation, and turns a built-in operator into a `LIKE` you have to get right.**

## inet and cidr

```console
$ node ex34-types-more.mjs
=== 14. inet/cidr, macaddr, point, citext ===
inet vs cidr: {"inet_keeps_host":"192.168.1.10/24","cidr_network":"192.168.1.0/24",
               "masklen":24,"host":"192.168.1.10","is_inside":true,"outside":false,
               "inet_b":10,"text_b":16}
'192.168.1.10/24'::cidr (host bits set)          ->  22P02 invalid cidr value: "192.168.1.10/24"
'999.1.1.1'::inet                                ->  22P02 invalid input syntax for type inet: "999.1.1.1"
```

| Type | Holds | Rejects |
|---|---|---|
| `inet` | a host address, optionally with a netmask | invalid addresses |
| `cidr` | a **network** only | anything with host bits set (`22P02`) |

**`inet` keeps the host part; `cidr` refuses it.** `'192.168.1.10/24'::cidr` fails because
`.10` is a host inside the `/24`, not the network. That distinction is the whole reason both
types exist: `cidr` is a range, `inet` is an address that may know its range.

**10 bytes against 16 for the same address as text**, plus validation you would otherwise
write. The operators are the real win:

```sql
ip << '10.0.0.0/8'::cidr        -- is contained by (network membership)
ip <<= '10.0.0.0/8'::cidr       -- contained by or equal
ip >> other, ip >>= other       -- contains
ip && other                     -- the networks overlap
masklen(ip), host(ip), network(ip), broadcast(ip), abbrev(ip)
set_masklen(ip, 16)
ip + 1, ip - ip                 -- address arithmetic
family(ip)                      -- 4 or 6
```

```sql
-- "is this request from our office network?" — one operator, indexable with GiST
SELECT * FROM requests WHERE ip << '203.0.113.0/24';
```

Doing that with text means parsing octets in SQL, and it is wrong for IPv6.

```console
ipv6 and macaddr: {"v6":"2001:db8::1","v6_b":22,"mac":"08:00:2b:01:02:03","mac8":"08:00:2b:01:02:03:04:05"}
```

`inet` handles IPv6 in the same column (22 bytes), normalising `2001:0db8:0000::0001` to
`2001:db8::1` — so equality works regardless of how the client formatted it. Text storage
would treat those as different strings. `macaddr` (6 bytes) and `macaddr8` (8) do the same
for hardware addresses.

## Geometric types

```console
geometric: {"p":{"x":1,"y":2},"distance":5,"b":"(2,2),(0,0)","box_contains":true}
```

`point`, `line`, `lseg`, `box`, `path`, `polygon`, `circle`, with operators like `<->`
(distance), `@>` (contains) and `&&` (overlaps), all GiST-indexable.

Note **`point` arrives in Node as `{x: 1, y: 2}`** — a parsed object, not a string.

These are built-in and adequate for simple planar geometry. **For anything involving the
Earth, use PostGIS**: the built-in types are Cartesian, so `<->` on latitude/longitude
degrees is not a distance in metres and gets worse the further you are from the equator.
PostGIS brings `geography`, spatial reference systems, real distance functions and a far
richer index story. The built-in types are for diagrams and simple bounding boxes.

## citext

```console
CREATE EXTENSION citext                          ok  {}
citext: {"citext_matches":true,"text_matches":false}
insert a case-variant into a citext UNIQUE       ->  23505 duplicate key value violates unique constraint
the alternative without citext: {"lower_matches":true}
```

`citext` is text that compares case-insensitively. The same value matched
`'user@example.com'` as `citext` and did **not** as `text` — and crucially, **a `UNIQUE`
constraint on a `citext` column rejected the upper-case variant with `23505`.** That is the
feature: case-insensitive uniqueness without remembering to normalise at every insert.

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE users (email citext NOT NULL UNIQUE);
```

The alternative, with no extension:

```sql
CREATE TABLE users (email text NOT NULL);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));
-- and every query must say: WHERE lower(email) = lower($1)
```

| | `citext` | `lower()` index |
|---|---|---|
| Extension required | yes | no |
| Queries need `lower()` | no | **yes, every time** |
| Unique enforcement | automatic | via the unique expression index |
| Works with an ORM's generated SQL | yes | often not |
| Available on managed providers | usually | always |

**`citext` wins on the thing that actually breaks**: a single query that forgets `lower()`
silently misses rows, and nothing catches it. Its costs are the extension dependency and that
it is slightly slower than plain text comparison. For email addresses and usernames it is
usually the right call; the `lower()` expression index is the fallback where extensions are
not available — see [expression indexes](../phase-10-indexes/10-expression.md).

Note that case-insensitivity is not the same as Unicode normalisation: `citext` folds case
using the collation but does not make `é` and `e` + combining accent equal. Normalise those
in the application (`normalize()` in PostgreSQL 13+ can help).

## From Node

All of these arrive as the obvious JavaScript value: `inet`/`cidr`/`macaddr` and `citext` as
strings, `point` as `{x, y}`. Sending a string for an `inet` column works and is validated
server-side — an invalid address gives `22P02` rather than being stored.

```js
await pool.query('INSERT INTO requests (ip) VALUES ($1)', [req.ip]);          // validated
await pool.query('SELECT * FROM requests WHERE ip << $1', ['10.0.0.0/8']);    // network match
```

## Trade-off

**Specialised types buy validation, normalisation, compact storage and operators, and cost
portability.** `inet` and `point` are core types with no dependency; `citext` needs an
extension, which some managed environments or strict migration policies make awkward. The
generic alternative — `text` plus application-side discipline — always works and always
degrades the same way: the validation is only as good as the code path that remembers it, and
a single forgotten `lower()` or a mis-parsed netmask is a silent wrong answer rather than an
error.

## Gotchas

**Symptom:** `22P02 invalid cidr value`
**Cause:** Host bits are set — `cidr` holds networks only
**Fix:** Use `inet` for an address with a mask, `cidr` only for the network

**Symptom:** Two IPv6 addresses that are the same do not compare equal
**Cause:** Stored as `text`, so `2001:0db8::0001` and `2001:db8::1` are different strings
**Fix:** Use `inet`, which normalises

**Symptom:** A case-variant email created a duplicate account
**Cause:** `text` comparison is case-sensitive
**Fix:** `citext`, or a `UNIQUE` index on `lower(email)` plus `lower()` in every query

**Symptom:** A query using `lower(email)` does not use the index
**Cause:** The index must be on the same expression, and the query must match it exactly
**Fix:** `CREATE UNIQUE INDEX … ON t (lower(email))`, or switch to `citext`

**Symptom:** Distances from the built-in `point` type are wrong
**Cause:** The geometric types are Cartesian; degrees are not metres
**Fix:** PostGIS `geography`

**Symptom:** `citext` is unavailable
**Cause:** The extension is not installed or not permitted
**Fix:** `CREATE EXTENSION citext`, or fall back to the `lower()` index

**Symptom:** Accented characters still compare as different in `citext`
**Cause:** It folds case, not Unicode composition
**Fix:** Normalise in the application, or with `normalize()`

## Interview questions

**★ What is the difference between `inet` and `cidr`?**
`inet` holds an address, optionally with a netmask; `cidr` holds a network only and rejects
host bits — measured `22P02` for `192.168.1.10/24`.

**★ Why use `inet` rather than `text`?**
Validation (`999.1.1.1` is rejected), normalisation (IPv6 forms compare equal), 10 bytes
instead of 16, and containment operators like `ip << '10.0.0.0/8'` that are indexable with
GiST.

**★ What does `citext` give you?**
Case-insensitive comparison and, importantly, case-insensitive `UNIQUE` — measured, the
upper-case variant was rejected with `23505`. No `lower()` needed in queries.

**★ `citext` or a `lower()` unique index?**
`citext` when the extension is available: a forgotten `lower()` in one query silently misses
rows and nothing catches it. The expression index is the no-extension fallback.

**★ Are the built-in geometric types enough for maps?**
No. They are Cartesian, so distances on latitude/longitude are not metres. Use PostGIS for
anything geographic.

**How do these types map to Node?**
`inet`, `cidr`, `macaddr` and `citext` as strings; `point` as `{x, y}`. Invalid values fail
server-side with `22P02` rather than being stored.

**Does `citext` handle accents?**
No — it folds case only. Unicode normalisation is a separate concern.

---

← [bytea](13-bytea.md) · Next → [Domains and composites](15-domains-composites.md)
