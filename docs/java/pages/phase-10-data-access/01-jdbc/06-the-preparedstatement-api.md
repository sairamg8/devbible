---
title: "Binding parameters: numbering from 1, nulls that need a type, and a `?` that isn't one"
sidebar_label: "6 · The `PreparedStatement` API"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.PreparedStatement`,
> `java.sql.Types`, `java.sql.SQLType` and `java.sql.ParameterMetaData`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC
> documentation *Issuing a Query and Processing the Result*
> (jdbc.postgresql.org/documentation/query/). JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**The previous chunk argued *why* to parameterize. This one is the mechanics, and
they contain three things that reliably catch people: parameters are numbered
from 1 rather than 0, a null needs a *type* and not just a null, and PostgreSQL
has an operator spelled `?` which the driver cannot distinguish from a
placeholder. None of those is deep, but each produces an error message that
points somewhere other than the cause — "The column index is out of range", "could
not determine data type of parameter $1", a parameter count mismatch on a query
you can see has the right number of question marks. Knowing all three takes ten
minutes and saves an afternoon each.**

## The shape

```java
static final String INSERT = """
        INSERT INTO orders (customer_id, total_cents, currency, placed_at)
        VALUES (?, ?, ?, ?)
        """;

try (PreparedStatement ps = c.prepareStatement(INSERT)) {
    ps.setLong(1, customerId);
    ps.setLong(2, totalCents);
    ps.setString(3, currency);
    ps.setObject(4, OffsetDateTime.now(clock));
    ps.executeUpdate();
}
```

Text blocks are the right way to write SQL in Java now — they preserve the shape
of the statement, which is the thing that makes a query readable, and they remove
the string concatenation that was previously both ugly and, in the wrong hands,
the injection vector.

## The rules the javadoc actually states

**Parameters are numbered from 1.** Same as `ResultSet` columns, same historical
reason (SQL is 1-indexed and JDBC followed it). Getting it wrong throws rather
than silently corrupting, which is a small mercy: `setLong(0, ...)` fails
immediately.

**Setter types must be compatible with the column's SQL type.** The javadoc:
*"if the IN parameter has SQL type `INTEGER`, then the method `setInt` should be
used. If arbitrary parameter type conversions are required, the method
`setObject` should be used with a target SQL type."*

**Every parameter must be set before execution.** A conditional that sets a
parameter in only one branch throws at execute time, not at compile time, and the
message names an index rather than a variable.

```java
// ❌ parameter 2 is unset when status is null
ps.setLong(1, customerId);
if (status != null) ps.setString(2, status);
ps.executeQuery();          // throws
```

**A `PreparedStatement` is reusable.** The javadoc's framing is *"This object can
then be used to efficiently execute this statement multiple times."* Set,
execute, set again, execute again. That reuse is what makes
[batching](19-batch-updates.md) natural and what makes
[server-side preparation](09-server-side-prepared-statements.md) pay off.

```java
try (PreparedStatement ps = c.prepareStatement(
        "UPDATE inventory SET on_hand = on_hand - ? WHERE sku = ?")) {
    for (Line line : lines) {
        ps.setInt(1, line.quantity());
        ps.setString(2, line.sku());
        ps.executeUpdate();          // one round trip each — see chunk 16
    }
}
```

⚠️ **Re-executing a statement closes its previous `ResultSet`.** One `Statement`
holds one open result at a time. A loop that re-executes while still reading rows
from the earlier execution gets "This ResultSet is closed" pointing at code that
closed nothing.

## Nulls need a type

```java
ps.setNull(3, Types.VARCHAR);          // ✅ explicit
ps.setObject(3, null);                 // ⚠️ works often; fails sometimes
```

The javadoc is blunt: *"Sets the designated parameter to SQL `NULL`. **Note:** You
must specify the parameter's SQL type."* The reason is that the server needs to
know the parameter's type to plan the statement, and an untyped null tells it
nothing.

PostgreSQL infers parameter types from context and usually gets it right, so
`setObject(n, null)` works most of the time — which is precisely why the failure
is confusing when it comes. The characteristic message is *"could not determine
data type of parameter $1"*, and it appears where context gives no type: a bare
`WHERE col = ?` on a polymorphic operator, a `?` fed straight into a function with
overloads, a `CASE` arm. Two fixes, both fine:

```java
ps.setNull(1, Types.VARCHAR);                  // tell JDBC
// or tell PostgreSQL, in the SQL:
// "WHERE email = CAST(? AS text)"
```

🔴 **And remember the SQL semantics separately from the JDBC ones.** `WHERE email
= ?` with a null bound matches **nothing**, because `= NULL` is unknown, not
false-or-true. If you want "match rows where email is null", the SQL must say `IS
NULL` — no parameter value can produce that. The idiom for an optional filter is
therefore:

```sql
WHERE (? IS NULL OR email = ?)
```

with the same value bound twice — or, better, build the two query variants and
pick one, because that form defeats index usage.

## `setObject`, `Types`, and when to be explicit

`setObject(int, Object)` lets the driver infer. `setObject(int, Object, int
targetSqlType)` tells it. JDBC 4.2 added `setObject(int, Object, SQLType)` taking
`JDBCType.VARCHAR` instead of the untyped `Types.VARCHAR` int constant — the
enum version is type-safe and worth preferring in new code.

| Situation | Use |
|---|---|
| an ordinary column of an obvious type | the typed setter — `setLong`, `setString` |
| `java.time` values | `setObject(n, value)` — [chunk 12](14-dates-times-and-timestamptz.md) |
| a null | `setNull(n, Types.X)` |
| an enum stored as text | `setString(n, e.name())`, deliberately, not `setObject` |
| a PostgreSQL-specific type (`jsonb`, `inet`, a composite) | `setObject` with a `PGobject`, or `CAST(? AS jsonb)` in the SQL |
| an array | `setArray` with `c.createArrayOf(...)` — [chunk 7](07-what-a-parameter-can-be.md) |

⚠️ **Storing an enum with `setObject(n, someEnum)` is a trap** — what the driver
does with an arbitrary `Enum` is not something the JDBC contract pins down, and
the result depends on driver behaviour. Convert explicitly with `.name()` and you
have decided the storage format yourself, which is what you want for something
that will outlive the code.

⚠️ **`jsonb` needs a cast.** Binding a `String` to a `jsonb` column typically
fails with a type mismatch, because the driver sends it as text and PostgreSQL
will not implicitly cast text to jsonb in that position. Either
`CAST(? AS jsonb)` in the SQL, or a `PGobject` with its type set — the SQL cast
is the portable-looking option and the one that survives a driver upgrade.

## `?` is JDBC's placeholder; `$1` is PostgreSQL's

PostgreSQL's native parameter syntax is `$1`, `$2`; JDBC's is `?`. pgJDBC
translates when it prepares the statement. Two consequences:

- **Server-side errors name `$n`.** A message about `$2` refers to your second
  `?`. That mapping is not obvious the first time you see it.
- **Hand-written `PREPARE` statements and function bodies use `$n`**, JDBC uses
  `?`, and mixing them is a syntax error rather than a subtle bug.

🔴 **PostgreSQL's JSONB existence operator is also `?`.** So this:

```sql
SELECT * FROM events WHERE payload ? 'user_id'      -- ❌ inside JDBC
```

is read by the driver as a placeholder, and your parameter indexes shift.
The `?|` and `?&` operators have the same problem. Use the function forms, which
mean exactly the same thing and contain no question mark:

```sql
SELECT * FROM events WHERE jsonb_exists(payload, 'user_id')        -- ✅
SELECT * FROM events WHERE jsonb_exists_any(payload, ARRAY['a','b'])
```

## The trade-off

Typed setters are more code than `setObject` everywhere, and the payoff is that a
type mismatch fails at the setter rather than as a planner error. The cost is
real when you are writing a generic mapper, where reflection hands you an
`Object` and the typed setters are unreachable. That is the one legitimate home
for `setObject` used uniformly — and if you write that mapper, write the null
handling first, because it is the case reflection will hand you most often.

## Gotchas

**⚠️ Parameter indexes off by one**
**Symptom:** "The column index is out of range: 0" or a value landing in the
wrong column.
**Cause:** habits from zero-indexed APIs.
**Fix:** remember that both parameters and result columns start at 1. Sequential
`setX` calls right after the SQL literal make the mismatch visible.

**⚠️ `WHERE col = ?` with a null bound, expecting it to match nulls**
**Symptom:** an optional filter silently returns zero rows instead of "no filter".
**Cause:** SQL three-valued logic. `= NULL` is never true.
**Fix:** `IS NULL` in the SQL, or two query variants. No parameter value can turn
`=` into `IS`.

**⚠️ A JSONB `?` operator in a JDBC statement**
**Symptom:** a parameter-count mismatch, or values landing in the wrong
placeholders, on a query whose visible `?` count is correct.
**Cause:** `?`, `?|` and `?&` are PostgreSQL operators and the driver sees
placeholders.
**Fix:** `jsonb_exists`, `jsonb_exists_any`, `jsonb_exists_all`.

**⚠️ Binding a JSON `String` to a `jsonb` column**
**Symptom:** "column is of type jsonb but expression is of type character
varying".
**Cause:** no implicit cast from text to jsonb in that position.
**Fix:** `CAST(? AS jsonb)` in the SQL, or a `PGobject`.

**⚠️ `setObject` on an enum**
**Symptom:** a column containing something other than what you expected, or a
type error, and behaviour that changes on a driver upgrade.
**Cause:** the contract does not pin down what an arbitrary `Enum` becomes.
**Fix:** `setString(n, e.name())`. Decide your own storage format for anything
persisted.

## Interview questions

**★ Why does `setNull` require an SQL type?**
Because the server has to know the parameter's type to plan the statement, and a
null carries no type information of its own. In PostgreSQL's extended protocol the
Parse step wants the parameter types before any value arrives, and while the
planner can often infer a type from the surrounding expression, there are
positions where it genuinely cannot — a comparison against a polymorphic operator,
an overloaded function argument, a `CASE` arm — and there you get "could not
determine data type of parameter". `setNull(n, Types.VARCHAR)` supplies the
answer. The confusing part is that `setObject(n, null)` works most of the time,
so the failure looks random rather than systematic.

**★ You bind `null` to `WHERE email = ?`. Which rows come back?**
None. SQL's comparison operators are three-valued, and `anything = NULL` evaluates
to unknown rather than true, so the `WHERE` clause filters everything out —
including the rows whose email really is null, which is usually what the person
asking was hoping to find. There is no parameter value that makes `=` behave like
`IS NULL`, because the difference is in the SQL text, not in the value. The
practical answers are a `(? IS NULL OR email = ?)` form, which works but tends to
defeat index usage, or building the two statements separately and choosing one —
which is what a query builder should do.

**★ What goes wrong with `WHERE payload ? 'key'` in JDBC?**
The driver reads the `?` as a parameter placeholder, because it has no way to
distinguish PostgreSQL's JSONB existence operator from a JDBC marker. The query
then has one more parameter than you think, so either you get a count mismatch or
— worse — your values shift by one and bind to the wrong positions. The same
applies to `?|` and `?&`. The fix is the function form: `jsonb_exists`,
`jsonb_exists_any`, `jsonb_exists_all`, which are semantically identical and
contain no question mark. It is worth knowing because the symptom points at your
parameter numbering rather than at the operator.

**★ When would you use `setObject` rather than a typed setter?**
For `java.time` values, where `setObject` with an `OffsetDateTime` or `LocalDate`
is the JDBC 4.2 idiom and there is no typed setter; for driver-specific types
carried in a `PGobject`; and in generic mapping code where reflection hands you an
`Object` and the typed setters are simply unreachable. Everywhere else the typed
setter is better because a mismatch fails at the call site with a clear message
rather than as a planner error naming `$3`. The one case to avoid deliberately is
enums — convert with `.name()` so that the on-disk representation is your decision
rather than the driver's.

---

← Prev: [`PreparedStatement` and injection](05-preparedstatement-and-injection.md) · Index: [JDBC](README.md) · Next → [What a parameter can and cannot be](07-what-a-parameter-can-be.md)
