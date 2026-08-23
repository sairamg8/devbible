---
title: "One parameter for a whole list, and the wildcards your users didn't mean to type"
sidebar_label: "8 · `IN` lists and `LIKE`"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.Connection.createArrayOf`,
> `java.sql.Array` and `java.sql.PreparedStatement.setArray`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the PostgreSQL 18
> manual *Row and Array Comparisons*, *Pattern Matching* and *SELECT*
> (postgresql.org/docs/18/functions-comparisons.html,
> .../functions-matching.html). JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**Two everyday requirements have no obvious parameterized form, and both of them
are where otherwise-careful codebases fall back to string building. `WHERE id IN
(?)` binds exactly one value — it does not expand a collection, and no JDBC driver
is obliged to make it. `WHERE name LIKE ?` binds fine but hands your users a
pattern language they did not know they were writing in, so a customer searching
for "50%" gets every record beginning with 50 and a customer searching for "%"
asks your database to return the entire table. PostgreSQL has a clean answer to
the first — `= ANY(?)` with a single array parameter — and standard SQL has a
clean answer to the second, which is an `ESCAPE` clause almost nobody uses. Both
are worth knowing precisely, because the workarounds people invent instead are the
ones that break.**

## `IN (?)` and the PostgreSQL answer

The three approaches, best first:

```java
// ✅ 1 — one parameter, any number of values: PostgreSQL arrays
String sql = "SELECT id, email FROM customers WHERE id = ANY(?)";
try (PreparedStatement ps = c.prepareStatement(sql)) {
    Array ids = c.createArrayOf("bigint", customerIds.toArray(Long[]::new));
    ps.setArray(1, ids);
    try (ResultSet rs = ps.executeQuery()) { ... }
}
```

`= ANY(array)` is PostgreSQL's equivalent of `IN (list)` and takes a *single*
array parameter. One statement text regardless of list length, which also means
one entry in the prepared-statement cache
([chunk 9](09-server-side-prepared-statements.md)) instead of one per distinct
list size — and that second benefit is larger than it sounds on a busy service.

⚠️ `createArrayOf`'s first argument is the **PostgreSQL type name**, not a JDBC
constant: `"bigint"`, `"text"`, `"uuid"`, `"integer"`, `"timestamptz"`. Getting it
wrong produces a type error at execution rather than at the `createArrayOf` call,
so the stack trace points at the wrong line.

⚠️ **`createArrayOf` takes an `Object[]`, not a primitive array.** `long[]` will
not compile against it; `Long[]` will. `list.toArray(Long[]::new)` is the
idiomatic conversion and the boxing is irrelevant next to a network round trip.

```java
// ✅ 2 — generate the right number of placeholders. Portable, still safe.
String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
String sql = "SELECT id, email FROM customers WHERE id IN (" + placeholders + ")";
try (PreparedStatement ps = c.prepareStatement(sql)) {
    int i = 1;
    for (Long id : ids) ps.setLong(i++, id);
    ...
}
```

That concatenation is safe because the only thing concatenated is `?` characters,
and their count comes from `ids.size()` — no user data enters the string. It is
the right answer on a database without array support. Its cost is a **different
SQL text per list size**, which pollutes any statement cache and defeats
server-side preparation; teams that care round the list size up to the next power
of two and pad with a repeated value, which bounds the number of distinct texts to
a handful.

```java
// ❌ 3 — the one everybody writes first
String sql = "SELECT id FROM customers WHERE id IN (" +
        ids.stream().map(String::valueOf).collect(joining(",")) + ")";
```

Vulnerable the moment `ids` is a list of strings from a request rather than parsed
longs — and "they're integers" is an assumption about a request body, not a
guarantee the compiler checked.

🔴 **An unbounded `IN` list is a denial-of-service surface** whichever form you
use. PostgreSQL's protocol caps the number of bound parameters per statement, and
long before that limit the planner is doing real work per element. Cap the list
size at the API boundary — a fixed maximum with a 400 response is better than a
query that succeeds slowly.

## `NOT IN` has a null trap that has nothing to do with JDBC

Worth stating here because it bites in exactly the same code:

```sql
-- ❌ returns NO rows if the subquery yields even one NULL
SELECT * FROM customers WHERE id NOT IN (SELECT owner_id FROM accounts);
```

`x NOT IN (a, b, NULL)` is `x <> a AND x <> b AND x <> NULL`, and the last
conjunct is unknown, so the whole expression can never be true. With a bound array
the same applies: `id <> ALL(?)` where the array contains a null returns nothing.
Use `NOT EXISTS`, or filter nulls out of the array before binding. This is a
correctness bug that produces an empty result rather than an error, which is the
worst failure shape there is.

## `LIKE`: the pattern is a value, the wildcards are data

```java
// ✅ the whole pattern is one bound value
String sql = "SELECT id, display_name FROM customers WHERE display_name ILIKE ?";
ps.setString(1, "%" + term + "%");
```

The wildcards are added in Java and the bound string is a value like any other —
there is no injection here. But there are two real problems people miss.

🔴 **The user's own `%` and `_` are still wildcards.** Searching for `100%`
matches `100`, `1000` and everything else beginning with `100`. Searching for `_`
matches every single character. Searching for `%` matches everything. That is a
correctness bug and, at scale, a resource one. Escape them:

```java
private static String escapeLike(String raw) {
    return raw.replace("!", "!!")     // the escape char itself, FIRST
              .replace("%", "!%")
              .replace("_", "!_");
}
// ... WHERE display_name ILIKE ? ESCAPE '!'
ps.setString(1, "%" + escapeLike(term) + "%");
```

⚠️ **The order of those three `replace` calls is load-bearing.** Escaping the
escape character last would double the escapes you just inserted. `!` is a
conventional choice because it rarely appears in search terms; any character works
provided you escape it in the input, which is what the first `replace` does. The
`ESCAPE` clause is standard SQL and PostgreSQL honours it.

⚠️ **`LIKE` is case-sensitive; `ILIKE` is PostgreSQL's case-insensitive form.**
It is not standard SQL — the portable equivalent is `LOWER(col) LIKE LOWER(?)`,
which needs a functional index on `LOWER(col)` to be fast. `ILIKE` is the better
choice on PostgreSQL and one more reason "portable SQL" costs more than it returns.

## Why a leading `%` is a table scan, and what to use instead

`ILIKE '%term%'` cannot use a B-tree index, because a B-tree can only seek on a
known prefix. On any table large enough to care about, that predicate is a
sequential scan, and the JDBC code looks identical whether it is fast or not —
which is exactly what makes it easy to ship.

| Requirement | The PostgreSQL answer |
|---|---|
| prefix match (`term%`) | an ordinary B-tree index works — with `text_pattern_ops` if the collation is not C |
| substring match (`%term%`) | a **GIN index over `pg_trgm` trigrams** |
| fuzzy / similarity | `pg_trgm`'s `similarity()` and the `%` operator |
| word-based search over prose | full-text search: `tsvector`, `tsquery`, a GIN index |

Those belong to the PostgreSQL half of this bible rather than the Java half, but
the decision is made in the same code review, so it belongs in the same
conversation. The wrong answer is to keep the query and add hardware.

## The trade-off

The array form is better in every way except one: it is PostgreSQL-specific. `=
ANY(?)` and `createArrayOf` will not move to a database without array support, and
neither will `ILIKE`. This bible targets PostgreSQL and takes that trade
deliberately — the alternative is a distinct SQL text per list size, a polluted
statement cache, and a case-insensitive search that needs a functional index to
work at all. If you genuinely need database portability, the generated-placeholder
form is the fallback and you should cap and pad it.

## Gotchas

**⚠️ `IN (?)` expecting expansion**
**Symptom:** the query matches only the first id, or throws a type error when a
collection is bound to one placeholder.
**Cause:** one placeholder is one value. Nothing expands it.
**Fix:** `= ANY(?)` with `createArrayOf`, or generated placeholders.

**⚠️ `createArrayOf` with a JDBC type name**
**Symptom:** a type error at `executeQuery`, pointing at the execution rather than
at the array construction.
**Cause:** the first argument is a *PostgreSQL* type name — `"bigint"`, not
`"BIGINT"` from `Types`.
**Fix:** use the database's type names, and keep them in constants next to the SQL.

**⚠️ A generated-placeholder `IN` list with no size cap**
**Symptom:** planning time and memory growing with request size; eventually a
protocol-level parameter limit, hit in production and never in tests.
**Cause:** the list came straight from a request body.
**Fix:** cap it at the API boundary, and prefer the array form, which is one
parameter regardless of length.

**⚠️ A distinct prepared statement per `IN` list size**
**Symptom:** a statement cache that never hits, and server-side preparation that
never engages, on the hottest query in the service.
**Cause:** the SQL text differs for two ids and three ids.
**Fix:** the array form. Or pad to power-of-two sizes so there are six texts
instead of a thousand.

**⚠️ `NOT IN` over a set containing null**
**Symptom:** a query that returns zero rows and no error, in a report everyone
believed was working.
**Cause:** `x <> NULL` is unknown, so the conjunction can never be true.
**Fix:** `NOT EXISTS`, or strip nulls before binding the array.

**⚠️ Unescaped `%` or `_` in a user's search term**
**Symptom:** searching for `50%` returns everything starting with `50`; searching
for `%` returns the entire table and the request times out.
**Cause:** the user's characters are pattern syntax.
**Fix:** escape `%`, `_` and the escape character itself — in that order — and
declare `ESCAPE`.

**⚠️ Escaping the escape character last**
**Symptom:** search terms containing `!` behave strangely.
**Cause:** the later `replace` calls inserted `!` characters that the earlier one
would have escaped.
**Fix:** escape the escape character first. This is a two-line function that is
wrong more often than it is right.

**⚠️ `%term%` on a growing table**
**Symptom:** search latency that is fine for a year and then is not, with no code
change.
**Cause:** a leading wildcard cannot use a B-tree; the plan was always a
sequential scan and the table finally got big.
**Fix:** a `pg_trgm` GIN index, or full-text search. Decide it before the table
grows, because the JDBC looks the same either way.

## Interview questions

**★ How do you parameterize an `IN` list?**
On PostgreSQL, rewrite it as `= ANY(?)` and bind a single array built with
`connection.createArrayOf("bigint", ids)`. That is one parameter for any number of
values, one SQL text regardless of list length, and therefore one entry in the
statement cache. The portable alternative is to generate the right number of `?`
characters from `ids.size()` and bind each element — safe, because only question
marks are concatenated, but it produces a distinct SQL text per list size, which
defeats server-side preparation and pollutes any cache. Either way, cap the list
size at the API boundary; a very large `IN` list is a planning-cost denial of
service before it is anything else.

**★ Is `LIKE '%' + userInput + '%'` an injection risk?**
Not if the whole pattern is bound as one parameter — the concatenation happens in
Java and what reaches the database is a value. The real problems are different.
The user's own `%` and `_` are wildcards, so a search for `50%` matches everything
starting with `50` and a search for `%` matches the entire table, which is both a
correctness bug and a resource one; the fix is to escape those characters and
declare an `ESCAPE` clause. And a leading `%` makes the predicate unindexable by a
B-tree, so the query is a sequential scan — on PostgreSQL the answer is a trigram
GIN index or full-text search, and the JDBC code looks identical either way, which
is what makes it easy to miss.

**★ Why does an `IN` list built from generated placeholders hurt a statement
cache?**
Because the cache is keyed on the SQL text, and `IN (?, ?)` and `IN (?, ?, ?)` are
different texts. A service whose list sizes range from one to a hundred produces a
hundred distinct statements, each of which has to be parsed and — if a server-side
prepared statement is being used — prepared separately, and each of which occupies
a cache slot that evicts something useful. The array form collapses all of them
into a single text. Where the array form is unavailable, padding the list up to
the next power of two with a repeated value reduces a hundred texts to seven,
which is usually enough.

**★ Why can `NOT IN` return no rows at all?**
Because of SQL's three-valued logic. `x NOT IN (a, b, c)` expands to `x <> a AND x
<> b AND x <> c`, and if any element is null that comparison is unknown rather
than true, so the conjunction can never evaluate to true and the predicate filters
everything out. It is particularly nasty because it produces an empty result set
rather than an error, so nothing alerts and the report simply says there is
nothing to report. `NOT EXISTS` does not have the problem because it is testing
row existence rather than comparing values, which is why it is the better default
for this shape regardless.

**★ A search endpoint using `ILIKE '%term%'` has been fine for a year and is now
timing out. What happened and what do you do?**
Nothing changed in the code; the table got big enough that the sequential scan
started to matter. A leading wildcard cannot be satisfied by a B-tree index,
because a B-tree can only seek on a known prefix, so that predicate was always
going to be a full scan — it was just cheap while the table was small. The fix is
an index that supports substring matching: a GIN index over `pg_trgm` trigrams,
which handles `%term%` and gives you similarity search as a bonus, or full-text
search with a `tsvector` column if the data is prose and users expect word-based
matching. Adding hardware buys months, not a fix.

---

← Prev: [What a parameter can be](07-what-a-parameter-can-be.md) · Index: [JDBC](README.md) · Next → [Server-side prepared statements](09-server-side-prepared-statements.md)
