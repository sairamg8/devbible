---
title: "Domains and composite types"
sidebar_label: "15 · Domains and composites"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**A domain is a base type plus a reusable constraint — genuinely useful. A composite type is
a row shape used as a column — almost always the wrong tool, and the measured Node output
below shows why.**

## Domains: a constraint you declare once

```sql
CREATE DOMAIN email AS citext
  CHECK (VALUE ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

CREATE TABLE users (id bigint PRIMARY KEY, email email NOT NULL);
CREATE TABLE contacts (id bigint PRIMARY KEY, email email);
```

```console
$ node ex34-types-more.mjs
=== 15. domains and composite types ===
a value failing the domain CHECK                 ->  23514 value for domain ty_email violates check constraint "ty_email_check"
the domain still inherits citext case-insensitivity ok  {"eq":true}
NOT NULL on a domain vs on a column              ->  23502 null value in column "email" of relation "ty_dom" violates not-null constraint
```

Three behaviours worth noting:

- **Violations raise `23514`** with the domain's constraint name — so the error identifies
  the rule, not just the column. Useful in an error handler across many tables.
- **The domain inherits everything from its base type.** Built on `citext`, comparisons stay
  case-insensitive. A domain is a *refinement*, not a wrapper.
- **`NOT NULL` on the column still works normally** (`23502`). You can also put `NOT NULL` in
  the domain itself, though that is usually too strong — it prevents the type being used for
  an optional column anywhere.

Domains are checked everywhere the type appears: inserts, updates, casts and function
arguments. That is the value — the rule lives with the type instead of being copy-pasted into
every table that uses it.

```console
adding a CHECK to a domain in use                ok  {}
```

**Adding a constraint to a domain already in use succeeded**, validating existing rows in the
process. Like any validating constraint, that is a scan of every table using the domain, so on
large tables use `NOT VALID` and validate separately.

Good candidates: `email`, `url`, `positive_int`, `percentage`, `iso_country_code`,
`non_empty_text`. The test is whether the same `CHECK` would otherwise be repeated on several
tables.

**The limitation:** a domain cannot reference other tables (no foreign keys), and its
constraint cannot be deferred. It is a value-shape rule, not a relationship.

## Composite types: usually the wrong tool

```sql
CREATE TYPE address AS (street text, city text, postcode text);
CREATE TABLE customers (id bigint PRIMARY KEY, addr address);
```

```console
composite access: {"email":"a@b.com","city":"London","postcode":"E1 6AN","whole":"(\"1 High St\",London,\"E1 6AN\")"}
composite in JS: {"addr":"(\"1 High St\",London,\"E1 6AN\")"}
```

It works, and the SQL side is tolerable — `(addr).city`, with the parentheses being mandatory
and easy to forget. But look at the second line: **`pg` returns the composite as the raw
string `("1 High St",London,"E1 6AN")`.** Not an object, not parsed. You get PostgreSQL's
composite literal syntax and have to parse it yourself, including its quoting rules for
values containing commas, quotes or NULLs.

That alone rules composites out for most application use. The rest of the case against:

| Problem | Detail |
|---|---|
| No per-field constraints | you cannot `CHECK` or `NOT NULL` an individual field |
| No per-field indexes without expressions | you need an index on `((addr).city)` |
| No foreign keys from fields | same limitation as arrays |
| Adding a field | `ALTER TYPE … ADD ATTRIBUTE` rewrites every table using it |
| Driver support | raw string in `pg`; poor in most ORMs |

**Use plain columns**, with a naming prefix if grouping matters:

```sql
CREATE TABLE customers (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  billing_street   text NOT NULL,
  billing_city     text NOT NULL,
  billing_postcode text NOT NULL CHECK (postcode ~ '^[A-Z0-9 ]{5,8}$')
);
```

Or a child table when addresses are genuinely one-to-many, or `jsonb` when the shape is
unknown. Composites earn their place in one situation: **as the return type of a function**,
where they describe a result row rather than storage.

```sql
CREATE FUNCTION split_name(full text) RETURNS TABLE (first text, last text) AS $$
  SELECT split_part(full,' ',1), split_part(full,' ',2)
$$ LANGUAGE sql;
```

Every table also has an implicit composite type of the same name, which is what makes
`SELECT (t.*)::text` and `ROW(...)` comparisons work — you use composites more often than you
declare them.

## From Node

Domains are transparent: a `citext`-based domain arrives as a string, an `int`-based domain as
a number. Nothing to configure — which is another point in their favour.

Composites need a parser you write, or a query that unpacks them:

```sql
-- unpack in SQL rather than parsing in JavaScript
SELECT (addr).street, (addr).city, (addr).postcode FROM customers WHERE id = $1;

-- or return jsonb, which pg does parse
SELECT to_jsonb(addr) AS addr FROM customers WHERE id = $1;
```

`to_jsonb()` is the pragmatic bridge if you have inherited composite columns.

## Trade-off

**Domains centralise a rule at the cost of an object your migrations must manage**, and of
indirection — someone reading `email email NOT NULL` has to look up what `email` permits.
That is a small price for a rule applied consistently across every table. Composites trade
schema tidiness for real capability: no per-field constraints, no per-field foreign keys, a
type rewrite to add a field, and a raw string at the driver boundary. The tidiness is not
worth it; group with column prefixes instead.

## Gotchas

**Symptom:** `23514 value for domain … violates check constraint`
**Cause:** The domain's `CHECK` rejected the value
**Fix:** Correct behaviour — the constraint name identifies which rule

**Symptom:** Adding a `CHECK` to a domain took a long time
**Cause:** It validates existing rows in every table using the domain
**Fix:** `ADD CONSTRAINT … NOT VALID`, then `VALIDATE CONSTRAINT`

**Symptom:** A composite column arrives in Node as `("a",b,"c")`
**Cause:** `pg` does not parse composite types — measured
**Fix:** Unpack the fields in SQL, or return `to_jsonb(col)`

**Symptom:** `(addr).city` gives a syntax error
**Cause:** The parentheses around the column are mandatory
**Fix:** `(addr).city`, never `addr.city` — the latter reads as table.column

**Symptom:** Cannot add a `NOT NULL` to one field of a composite
**Cause:** Composite fields cannot carry constraints
**Fix:** Use separate columns

**Symptom:** `ALTER TYPE … ADD ATTRIBUTE` locked several tables
**Cause:** Every table using the type is rewritten
**Fix:** Avoid composites for storage

**Symptom:** A domain cannot express the rule you need
**Cause:** Domains cannot reference other tables
**Fix:** A foreign key to a lookup table

## Interview questions

**★ What is a domain?**
A base type plus reusable constraints — `CREATE DOMAIN email AS citext CHECK (…)`. The rule
is enforced everywhere the type is used, and violations raise `23514` naming the domain's
constraint.

**★ Does a domain inherit its base type's behaviour?**
Yes. Measured: a domain over `citext` still compared case-insensitively. It refines rather
than wraps.

**★ What can a domain not do?**
Reference other tables — no foreign keys — and its constraints cannot be deferred. Use a
lookup table for relationships.

**★ Why avoid composite types for columns?**
No per-field constraints or foreign keys, indexes need expressions, adding a field rewrites
every table using the type, and `pg` returns the value as an unparsed string — measured
`("1 High St",London,"E1 6AN")`.

**★ When is a composite type appropriate?**
As a function return type describing a result row. Every table also has an implicit composite
type, which is what makes `ROW(...)` comparisons and `t.*` work.

**How do you get a composite into JavaScript usefully?**
Unpack the fields in SQL, or `SELECT to_jsonb(col)` — `pg` does parse `jsonb`.

**How would you model an address instead?**
Prefixed columns (`billing_street`, `billing_city`) with real constraints, a child table if
there can be several, or `jsonb` if the shape is genuinely unknown.

---

← [Network, geometric, citext](14-network-geo-citext.md) · Next → [Range types](16-ranges.md)
