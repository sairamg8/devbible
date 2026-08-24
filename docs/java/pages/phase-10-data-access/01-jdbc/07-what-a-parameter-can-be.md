---
title: "`ORDER BY ?` does not work, and that is where the remaining injections live"
sidebar_label: "7 · What a parameter can be"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.PreparedStatement`,
> `java.sql.Connection.createArrayOf` and `java.sql.Array`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), the PostgreSQL 18
> manual *SELECT* and *Functions and Operators → Array Functions and Operators*
> (postgresql.org/docs/18/sql-select.html), and the pgJDBC documentation
> *Issuing a Query and Processing the Result*, and the PostgreSQL 18 manual
> *Queries → Sorting Rows* (postgresql.org/docs/18/queries-order.html). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**A parameter is a *value*. It is never an identifier, never an operator, never a
clause, and never a list. That single sentence explains four of the most common
"I had to concatenate, there was no other way" situations in real codebases —
dynamic sort columns, dynamic table names, `IN` lists and `LIKE` patterns — and
three of them have clean answers that most people have not seen. The fourth,
dynamic identifiers, has exactly one correct answer and it is an allow-list. This
is the chunk that matters most for security, because the previous two chunks fix
the injection everyone knows about and this one fixes the injection that survives
the fix.**

## The boundary

Parsing happens before binding. So anything the parser must know to build a parse
tree cannot come from a parameter:

| Can be a parameter | Cannot be a parameter |
|---|---|
| a value in `WHERE col = ?` | a **column name** |
| a value in `VALUES (?, ?)` | a **table** or **schema** name |
| `LIMIT ?` and `OFFSET ?` | `ASC` / `DESC` |
| a value on either side of an operator | the **operator itself** |
| an array, as one parameter | a comma-separated list |
| a `LIKE` pattern, as a whole string | a whole `WHERE` clause |

`SELECT * FROM ? WHERE ?` is not a query with two unknowns; it is not a query at
all, because the parser cannot resolve it into anything. `ORDER BY ?` is more
insidious: it *parses*, because a bare integer in `ORDER BY` is a legal ordinal
reference to an output column. Binding the string `"name"` to it does not sort by
name — it sorts by a constant, which is to say it does not sort at all, and no
error is raised. **A silently unsorted result is worse than a failure.**

## Dynamic sort: the allow-list, in full

The requirement is real — a table UI with clickable column headers — and the
answer is that the *user's* string never reaches the SQL. It selects from a set
you wrote:

```java
// The only sort columns that exist. Nothing else is reachable.
private static final Map<String, String> SORT_COLUMNS = Map.of(
        "name",    "c.display_name",
        "email",   "c.email",
        "created", "c.created_at",
        "spend",   "c.lifetime_spend_cents");

private static final Set<String> DIRECTIONS = Set.of("ASC", "DESC");

String sortSql(String requestedColumn, String requestedDirection) {
    String column = SORT_COLUMNS.get(requestedColumn);
    if (column == null) {
        column = SORT_COLUMNS.get("created");        // a safe default
    }
    String direction = DIRECTIONS.contains(
            requestedDirection == null ? "" : requestedDirection.toUpperCase(Locale.ROOT))
            ? requestedDirection.toUpperCase(Locale.ROOT)
            : "DESC";
    return " ORDER BY " + column + " " + direction;
}

String sql = "SELECT id, display_name, email FROM customers c WHERE c.tenant_id = ?"
           + sortSql(req.sortBy(), req.sortDir())
           + " LIMIT ? OFFSET ?";
```

🔴 **Read what makes that safe.** The concatenated text is a value from a map
literal in the source file. The request string is only ever a *key*. There is no
input that produces SQL text, because there is no path from input to output except
through the map. Note also the fallback: an unknown key silently becomes the
default rather than throwing, which is a UX decision — throwing a 400 is equally
defensible, and both are safe. What is *not* safe is `SORT_COLUMNS.getOrDefault(k,
k)`, which reintroduces the whole vulnerability in one method call.

⚠️ **Sanitising with a regex is the tempting near-miss.** `if
(!col.matches("[a-zA-Z_]+"))` blocks the classic payloads and still lets a user
sort by any column in the table — including one your API never meant to expose,
which is an information-disclosure bug even when it is not an injection. The
allow-list bounds *what exists*, not just *what is punctuation-free*, and that is
the stronger property.

⚠️ **If you genuinely must quote an identifier** — a multi-tenant schema name
chosen at runtime — the tool is `Connection.getMetaData().getIdentifierQuoteString()`
plus doubling any embedded quote character. Even then, validate against a list of
schemas you know exist first. Quoting an arbitrary identifier is a last resort,
not a design.

## The other things that cannot be parameters

- **A whole `WHERE` clause.** Build the clause from a fixed set of predicates and
  bind their values; never accept a clause.
- **An operator.** `WHERE age ? 18` is not a thing. A "comparison type" from a
  request maps through a small `Map<String,String>` to `">="`, `"<="`, `"="` —
  the same allow-list shape as sorting.
- **A `LIMIT` expression that is not a number.** `LIMIT ?` *is* parameterizable
  and you should use it; what you should not do is concatenate a "page size"
  string.
- **An `INTERVAL` literal.** `now() - INTERVAL ?` fails; the working forms are
  `now() - (? || ' days')::interval` or, better, `now() - make_interval(days =>
  ?)`, which keeps the value typed.

## Why `ORDER BY ?` parses at all

The PostgreSQL manual explains the trap in one sentence:

> *A `sort_expression` can also be the column label or number of an output
> column.*

So `ORDER BY 1` is legal and means "the first output column". Bind an integer and
you have silently asked for a real, wrong ordering. Bind a string and you have
asked to sort by a constant, which orders nothing — every row ties, and the
server is free to return them in any order it likes. Neither raises an error, and
the second is the one that reaches production, because a developer testing with
20 rows on a freshly loaded table sees them come back in insertion order and
concludes the sort works.

⚠️ **The same page also settles `NULLS FIRST` / `NULLS LAST`**, which people
routinely try to parameterize: *"By default, null values sort as if larger than
any non-null value; that is, `NULLS FIRST` is the default for `DESC` order, and
`NULLS LAST` otherwise."* It is syntax, so it belongs in the allow-list beside
the direction — and if your API exposes a nulls-position control, note that the
default flips with the direction, so "unchanged" is not a constant.

## The trade-off

An allow-list is a piece of duplication: the set of sortable columns exists in the
map and again in the SQL and again in the API documentation. It goes stale, and a
newly added column silently is not sortable until someone updates the map. That is
a genuine maintenance cost, and it is the correct cost to pay — the alternative
prices your whole schema as a public API and hands the ordering of arbitrary
expressions to a request parameter. Generating the map from the same metadata that
generates the API's schema is the way to make the duplication cheap.

## Gotchas

**⚠️ `ORDER BY ?` that runs and does not sort**
**Symptom:** the sort control in the UI does nothing, on some pages, and there is
no error anywhere.
**Cause:** a bound value in `ORDER BY` is a constant, and a constant sorts
nothing. A bound *integer* is worse — it is an ordinal reference to an output
column, so it may sort by an unrelated column.
**Fix:** an allow-list producing the column name as SQL text.

**⚠️ `getOrDefault(userKey, userKey)`**
**Symptom:** an allow-list that a code review approved and that is not one.
**Cause:** falling back to the user's own string.
**Fix:** fall back to a fixed default, or reject.

**⚠️ A regex-validated column name**
**Symptom:** no injection, but a user sorting by `password_hash` or by an internal
column and inferring its contents from the ordering.
**Cause:** validating the *shape* of the identifier instead of its *membership* in
a set.
**Fix:** the map. It bounds what exists.

**⚠️ `INTERVAL ?`**
**Symptom:** a syntax error on a query that looks obviously correct.
**Cause:** an interval literal is parsed, not bound.
**Fix:** `make_interval(days => ?)` — typed, readable, and parameterized.

**⚠️ Parameterizing `NULLS LAST`**
**Symptom:** a syntax error, or an allow-list that forgot it.
**Cause:** it is syntax, like `ASC`.
**Fix:** put it in the same map as the direction — and remember the default flips
with the direction, so an explicit choice is not a no-op.

## Interview questions

**★ Why can't a column name be a parameter?**
Because parameters are bound after the statement is parsed and planned, and the
parser needs to resolve identifiers to build a parse tree at all. In PostgreSQL's
extended protocol the Parse message carries the SQL and the Bind message carries
the values, in that order; by the time a value arrives, the server has already
decided which table and which column the query refers to. There is no re-parse.
So an identifier has to be in the SQL text, which is exactly why dynamic sorting
and dynamic table selection are where injection bugs survive after everyone has
switched to `PreparedStatement`.

**★ How do you implement a sortable table column safely?**
Map the request's sort key through a fixed `Map<String,String>` whose values are
the SQL column expressions you wrote, and validate the direction against a
two-element set. The user's string is only ever a lookup key; the text that is
concatenated into the SQL always comes from your source file. An unknown key falls
back to a default or produces a 400 — never to the user's own string, because
`getOrDefault(key, key)` reintroduces the entire vulnerability. And use an
allow-list rather than a regex, because a regex only proves the identifier is
punctuation-free, not that it is a column you meant to expose; sorting by an
internal column leaks its ordering even when nothing is injected.

**★ Someone shows you a query builder that parameterizes every value and
concatenates the column names from a request map. How bad is it?**
It is a full injection vulnerability with a very convincing disguise, and it is
the most common surviving instance in codebases that "fixed injection years ago".
The values being parameterized is what makes it pass review; the keys becoming
identifiers is what makes it exploitable, because a key can carry a subquery, a
`UNION`, or a comment that discards the rest of the statement. It also defeats
most taint analysis, because the dangerous data arrives as a map key rather than
as a string parameter with an obvious name. The fix is the same allow-list as
sorting: request keys map to column expressions you wrote, and an unrecognised key
is rejected rather than passed through.

**★ What would you do if you genuinely had to use a runtime-chosen schema name?**
Validate it against a list of schemas that actually exist — queried from
`information_schema` at startup and cached, or a tenant registry — before it goes
anywhere near a statement, and only then quote it using the identifier quote
character from `DatabaseMetaData.getIdentifierQuoteString()`, doubling any
embedded quote. The validation is the security control; the quoting is defence in
depth for characters that are legal in an identifier but would otherwise break the
statement. An alternative worth preferring where it fits is to set `search_path`
per connection to a validated schema and leave the SQL free of schema
qualification entirely — the value then travels as a session setting rather than
as statement text.

**★ Why is a silently unsorted result worse than an exception?**
Because nothing fails, so nothing gets fixed. `ORDER BY ?` with a bound string
sorts by a constant: every row compares equal, the server may return them in any
order, and on a small development table that order is usually insertion order —
which looks exactly like a working sort. It surfaces later as "the list is
sometimes in a different order", reported by users, on data nobody can reproduce
locally, after a plan change or a vacuum reshuffled the heap. An exception would
have been caught by the first test. This is the general shape of the worst class
of bug in this layer: the thing that is wrong is not the thing that errors.

---

← Prev: [The `PreparedStatement` API](06-the-preparedstatement-api.md) · Index: [JDBC](README.md) · Next → [`IN` lists, arrays and `LIKE`](08-in-lists-and-like-patterns.md)
