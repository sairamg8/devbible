---
title: "String functions"
sidebar_label: "16 · String functions"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `ex5-filter-sort.mjs`.

**The everyday set is small: case, trim, substring, split, pad, replace, and `format`.
Two things trip people up — SQL strings are 1-indexed, and `length` counts characters
while `octet_length` counts bytes.**

```console
$ node ex14-crud.mjs
=== 10. string functions ===
┌─────────┬─────────┬───────┬────────┬───────┬───────────────────────┬───────┬───────┬─────┬───────┐
│ (index) │ lower   │ btrim │ substr │ split │ fmt                   │ l     │ r     │ len │ bytes │
├─────────┼─────────┼───────┼────────┼───────┼───────────────────────┼───────┼───────┼─────┼───────┤
│ 0       │ 'mixed' │ 'pad' │ 'bcd'  │ 'b'   │ "row has col = 'val'" │ 'abc' │ 'def' │ 5   │ 6     │
└─────────┴─────────┴───────┴────────┴───────┴───────────────────────┴───────┴───────┴─────┴───────┘
```

```sql
SELECT
  lower('MiXeD')                    AS lower,   -- 'mixed'
  btrim('  pad  ')                  AS btrim,   -- 'pad'
  substring('abcdef' FROM 2 FOR 3)  AS substr,  -- 'bcd'
  split_part('a-b-c', '-', 2)       AS split,   -- 'b'
  format('%s has %I = %L', 'row', 'col', 'val') AS fmt,
  left('abcdef', 3)                 AS l,       -- 'abc'
  right('abcdef', 3)                AS r,       -- 'def'
  length('héllo')                   AS len,     -- 5
  octet_length('héllo')             AS bytes;   -- 6
```

## Everything is 1-indexed

`substring('abcdef' FROM 2 FOR 3)` returned **`'bcd'`** — position 2 is `b`, and `FOR 3`
is a *length*, not an end position. `split_part('a-b-c', '-', 2)` returned **`'b'`**, the
second field.

Both differ from JavaScript, where `'abcdef'.substring(2, 3)` is `'c'` and array indexes
start at zero. Every off-by-one between a SQL expression and its JavaScript equivalent
comes from this.

`left`/`right` take a count rather than a position and are the simplest choice for
prefixes and suffixes. Negative arguments work too: `left('abcdef', -1)` drops the last
character.

## Characters versus bytes

```console
│ len │ bytes │
│ 5   │ 6     │
```

`'héllo'` is 5 characters and 6 bytes — `é` takes two bytes in UTF-8. Which one you want
depends on the question:

- **`length()`** — what a user sees. Use for validation limits and truncation.
- **`octet_length()`** — storage and transfer size. Use for byte-oriented limits.
- `char_length()` is a synonym for `length()`.

A `varchar(10)` limit counts **characters**, so it holds ten emoji even though those are
far more than ten bytes. Meanwhile a B-tree index entry has a byte limit, which is why a
long multi-byte string can fail to index while a same-length ASCII one succeeds.

## `format` is the safe way to build SQL

`format('%s has %I = %L', 'row', 'col', 'val')` produced:

```console
"row has col = 'val'"
```

Three placeholders, three behaviours:

| Spec | Does | Use for |
|---|---|---|
| `%I` | Quotes as an **identifier** — double quotes when needed | table/column names |
| `%L` | Quotes as a **literal** — single quotes, escaped, `NULL` for null | values in dynamic SQL |
| `%s` | Plain substitution, no quoting | never with untrusted input |

`%I` is what makes genuinely dynamic identifiers safe, because parameters cannot fill an
identifier slot:

```console
$ node ex5-filter-sort.mjs
=== 7. format/quote_ident for a genuinely dynamic identifier ===
{
  a: 'name',
  b: '"name; DROP TABLE fs_items; --"',
  c: 'ORDER BY "name; DROP TABLE fs_items; --"'
}
```

The payload became a quoted (nonexistent) column name rather than executable syntax — an
error instead of a dropped table. `quote_ident()` and `quote_literal()` are the
standalone equivalents. For ordinary values in application code you still want `$1`
parameters, not `%L` — see [Parameterized queries](08-parameters.md).

## Trimming

`btrim('  pad  ')` gave `'pad'` — **b**oth ends. The family:

```sql
btrim(s)            -- both ends        ( = trim(both from s) )
ltrim(s), rtrim(s)  -- one end
btrim(s, 'xy')      -- strips any of the *characters* x and y, not the string 'xy'
trim(both '-' from '--abc--')   -- 'abc'
```

That second argument being a character *set* rather than a substring is the common
surprise: `btrim('xyzabcxyz', 'xyz')` strips any leading or trailing `x`, `y` or `z`.

## Case, search and replace

```sql
lower(s), upper(s), initcap('hello world')   -- 'Hello World'
position('cd' in 'abcdef')                   -- 4, or 0 when absent
strpos('abcdef', 'cd')                       -- same, argument order reversed
replace('a-b-c', '-', '+')                   -- 'a+b+c'
repeat('ab', 3)                              -- 'ababab'
lpad('7', 3, '0')                            -- '007'
reverse(s), md5(s)
```

`position` returning **0** rather than `NULL` for "not found" is worth remembering — the
existence test is `position(x in y) > 0`.

For splitting into rows rather than one field, `string_to_array` plus `unnest`, or
`regexp_split_to_table`:

```sql
SELECT unnest(string_to_array('a,b,c', ',')) AS part;   -- three rows
```

## Case-insensitive matching

Three ways, with different index consequences:

```sql
WHERE lower(email) = lower($1)   -- needs an index on lower(email)
WHERE email ILIKE $1             -- needs a trigram index to be fast
WHERE email = $1                 -- with a citext column, or a case-insensitive collation
```

**`lower(email) = $1` will not use a plain index on `email`.** It needs an expression
index ([Expression indexes](../phase-10-indexes/10-expression.md)); `ILIKE` with a
leading wildcard needs `pg_trgm` ([GIN and trigram](../phase-10-indexes/11-gin-trgm.md)).

Sorting is a separate question from matching, and depends on collation:

```console
$ node ex5-filter-sort.mjs
=== 9. case sensitivity in ORDER BY ===
database collation: { datcollate: 'en_US.utf8', datctype: 'en_US.utf8' }
ORDER BY name        → Banana, Elderberry, apple, cherry, date, fig
ORDER BY lower(name) → apple, Banana, cherry, date, Elderberry, fig
```

Uppercase sorted first under this database's collation. `ORDER BY lower(name)` is the fix
when you want dictionary order — see [`ORDER BY`](10-order-by.md).

## Nulls

Every function here returns `NULL` for a `NULL` input. Combined with `||` propagating
null ([Expressions and `CASE`](15-expressions.md)), a single null column can empty a
whole computed string. `concat`/`concat_ws` are the null-tolerant alternatives.

## Trade-off

Doing this work in SQL means one definition every consumer shares, and values the planner
can filter and sort on. It costs index-friendliness — wrapping a column in a function
disables a plain index unless you build a matching expression index — and it moves logic
into strings that are harder to test.

The usual split: normalization the database must match or constrain on (`lower(email)`
for a unique index) belongs in SQL, ideally as a generated column
([Generated columns](../phase-3-ddl/15-generated-columns.md)); display formatting belongs
in the application.

## Gotchas

**Symptom:** `substring` returns one character off from the JavaScript equivalent
**Cause:** SQL strings are 1-indexed, and the second argument is a length, not an end
index. Measured, `substring('abcdef' FROM 2 FOR 3)` → `'bcd'`.
**Fix:** Translate carefully; `left`/`right` avoid the question.

**Symptom:** A length check passes in SQL and fails elsewhere
**Cause:** `length()` counts characters, `octet_length()` counts bytes — measured 5 and 6
for `'héllo'`.
**Fix:** Decide which limit you mean. `varchar(n)` counts characters.

**Symptom:** `btrim(s, 'abc')` removed more than expected
**Cause:** The second argument is a set of characters, not a substring.
**Fix:** Use `replace` or a regex for whole-substring removal.

**Symptom:** An index on `email` is unused by `WHERE lower(email) = $1`
**Cause:** The function makes the predicate non-sargable against a plain index.
**Fix:** `CREATE INDEX ON t (lower(email))`, or store a normalized generated column.

**Symptom:** A computed label is `NULL` for some rows
**Cause:** `||` with a null operand.
**Fix:** `concat_ws` or `COALESCE`.

**Symptom:** Dynamic SQL built with `%s` is injectable
**Cause:** `%s` performs no quoting.
**Fix:** `%I` for identifiers, `%L` for literals — and `$1` parameters wherever a value
can be a parameter.

**Symptom:** `position()` returned 0 and a null check missed it
**Cause:** Not-found is `0`, not `NULL`.
**Fix:** Test `> 0`.

## Interview questions

**★ What is the difference between `length()` and `octet_length()`?**
Characters against bytes — measured, `'héllo'` is `length` 5 and `octet_length` 6,
because `é` is two bytes in UTF-8. Use `length` for user-visible limits and
`octet_length` for storage or transfer limits. `varchar(n)` counts characters.

**★ Are SQL string positions 0-based or 1-based?**
1-based, unlike JavaScript. Measured, `substring('abcdef' FROM 2 FOR 3)` returned `'bcd'`
and `split_part('a-b-c', '-', 2)` returned `'b'`. The second argument to `substring` is a
length, not an end position.

**★ How do you safely interpolate a column name into dynamic SQL?**
`format('… %I …', col)`, which quotes it as an identifier. Measured, an injection payload
became the quoted column name `"name; DROP TABLE fs_items; --"` — a "column does not
exist" error rather than executed SQL. `%L` does the same for literals; `%s` quotes
nothing and must not receive untrusted input. Values in application code should still be
`$1` parameters.

**★ Why doesn't `WHERE lower(email) = $1` use the index on `email`?**
Because the index stores `email`, not `lower(email)`, so the predicate cannot be matched
against it. Create an expression index on `lower(email)`, or store a normalized generated
column and index that.

**How do you do a case-insensitive comparison?**
`lower()` on both sides with a matching expression index, `ILIKE` (needing a trigram index
to be fast with leading wildcards), or a `citext` column / case-insensitive collation.
Matching and *sorting* are separate concerns — measured, the default `en_US.utf8`
collation sorted uppercase names before lowercase ones.

**How do you split a delimited string into rows?**
`unnest(string_to_array(s, ','))`, or `regexp_split_to_table` for a pattern.
`split_part` extracts a single field by 1-based position.

---

← [Expressions and `CASE`](15-expressions.md) · Next → [Date/time functions](17-datetime-functions.md)
