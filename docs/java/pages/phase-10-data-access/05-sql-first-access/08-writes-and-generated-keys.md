---
title: "`update()` hands back a row count nobody reads, and the convenient way to get a generated key throws on PostgreSQL"
sidebar_label: "8 · Writes and keys"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access → JDBC
> Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> the `KeyHolder`, `JdbcOperations` and `JdbcClient.StatementSpec` javadoc
> ([docs.spring.io/.../support/KeyHolder.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/support/KeyHolder.html)),
> and the PostgreSQL 18 manual *INSERT → RETURNING*
> ([postgresql.org/docs/18/sql-insert.html](https://www.postgresql.org/docs/18/sql-insert.html)).
> JDK 25, Spring Framework 7.0.9, PostgreSQL 18, pgJDBC 42.7.x.

**Two things about writes are worth more attention than they usually get. The `int`
that `update()` returns is the only confirmation you will ever receive that your
statement matched anything, and most code assigns it to nothing. And the
one-constant way to ask for a generated key — `Statement.RETURN_GENERATED_KEYS` —
becomes `RETURNING *` on pgJDBC, which makes `KeyHolder.getKey()` throw. Both have
clean fixes; neither is the default.**

## The row count is information

```java
int updated = jdbcClient
        .sql("update account set balance = balance - :amount where id = :id")
        .param("amount", amount)
        .param("id", accountId)
        .update();
```

`updated` is `0` if no row matched. That is not an error at the JDBC level, at the
Spring level, or at the SQL level — the statement did exactly what it was asked. But
in almost every application it means something went wrong, and the row count is your
only chance to notice.

The most valuable use is **optimistic concurrency**, which you can implement in one
statement with no framework at all:

```java
public void save(Account account) {
    int updated = jdbcClient.sql("""
            update account
               set balance = :balance, version = version + 1
             where id = :id and version = :version
            """)
            .paramSource(account)
            .update();

    if (updated == 0) {
        throw new OptimisticLockingFailureException(
                "account " + account.id() + " was modified concurrently");
    }
}
```

Zero rows means either the row is gone or its `version` moved — somebody else wrote
first. Throwing `OptimisticLockingFailureException` puts that on the same
`ConcurrencyFailureException` branch that a database-detected conflict lands on, so
a retry policy keyed on `TransientDataAccessException`
([chunk 6](06-the-exception-hierarchy.md)) treats them alike.

`DELETE` deserves the same treatment: `delete … where id = ?` returning `0` is how
you learn the entity was already gone, which is usually a 404 rather than a 204.

## Generated keys: the trap first

The reference's own example uses a `PreparedStatementCreator`:

```java
final String INSERT_SQL = "insert into my_test (name) values(?)";

KeyHolder keyHolder = new GeneratedKeyHolder();
jdbcTemplate.update(connection -> {
    PreparedStatement ps = connection.prepareStatement(INSERT_SQL, new String[] { "id" });
    ps.setString(1, name);
    return ps;
}, keyHolder);

Number id = keyHolder.getKey();
```

Look closely at `new String[] { "id" }`. That is the **column-name** form of
`prepareStatement`, and choosing it rather than
`Statement.RETURN_GENERATED_KEYS` is the whole difference on PostgreSQL.

🔴 **`RETURN_GENERATED_KEYS` on pgJDBC appends `RETURNING *`** — established in
**[Generated keys](../01-jdbc/20-generated-keys.md)**. The driver then hands back
every column of the inserted row, so the `KeyHolder`'s map has one entry per column.
And `KeyHolder.getKey()` is documented to reject exactly that:

> "If there are multiple columns, then the Map will have multiple entries as
> well. If this method encounters multiple entries in either the map or the list
> meaning that multiple keys were returned, then an
> `InvalidDataAccessApiUsageException` is thrown."

So the convenient constant produces a working insert and a failing key retrieval,
and the exception says "multiple keys" for a table with one primary key — which is
not an obvious clue. Naming the column produces `RETURNING id`, one entry, and
`getKey()` works.

## The `KeyHolder` surface

| Method | Returns | Throws |
|---|---|---|
| `getKey()` | `Number` — "the first item from the first map" | `InvalidDataAccessApiUsageException` if multiple |
| `getKeyAs(Class<T>)` | `T` — @since 5.3, for a `UUID` or `String` key | same |
| `getKeys()` | `Map<String, Object>` — the first row's keys | if keys for multiple rows |
| `getKeyList()` | `List<Map<String, Object>>` — everything | — |

`getKeyAs` is the one to know if your key is not a number. A `uuid` primary key
through `getKey()` fails on the cast, not on the count, and the message is about
`Number` rather than about your key.

## `JdbcClient`: two overloads, and use the second

```java
KeyHolder keys = new GeneratedKeyHolder();

jdbcClient.sql("insert into actor (first_name, last_name) values (:firstName, :lastName)")
          .paramSource(newActor)
          .update(keys, "id");        // ← name the key column

long id = keys.getKeyAs(Long.class);
```

`update(KeyHolder)` and `update(KeyHolder, String... keyColumnNames)` are both on
`StatementSpec`, and both are documented as requiring "support for generated keys in
the JDBC driver". **Prefer the second one on PostgreSQL**, for the reason above: the
one-argument form has no column names to pass down, so it takes the
`RETURN_GENERATED_KEYS` path and you are back to `RETURNING *`.

## The PostgreSQL-native way, which is simpler than all of it

`RETURNING` is not a driver feature. It is SQL, and you are allowed to write it:

```java
long id = jdbcClient.sql("""
        insert into actor (first_name, last_name)
        values (:firstName, :lastName)
        returning id
        """)
        .paramSource(newActor)
        .query(Long.class)
        .single();
```

No `KeyHolder`, no `PreparedStatementCreator`, no reliance on what the driver
appends. The insert *is* a query, because that is what `RETURNING` makes it, and the
result comes back through the same result-shape machinery as everything else. It
also generalises for free — `returning id, created_at` into a record gives you the
database-assigned defaults as well, which is
**[`RETURNING` beyond insert](../01-jdbc/20c-returning-beyond-insert.md)**.

The trade-off is portability: `RETURNING` is PostgreSQL (and a few others), whereas
`KeyHolder` is the portable abstraction. If the code will only ever run on
PostgreSQL, write the SQL.

## Gotchas

**Discarding the return value of `update()` throws away your only feedback.** An
`UPDATE` that matches nothing is not an error anywhere in the stack. If the row
count matters — and for a targeted update by id it always does — check it. A
repository method returning `void` for a single-row update is nearly always missing
a check.

**`RETURN_GENERATED_KEYS` and `KeyHolder.getKey()` are incompatible on
PostgreSQL.** The driver appends `RETURNING *`, the key holder receives every
column, and `getKey()` throws `InvalidDataAccessApiUsageException` complaining about
multiple keys on a table with one key. Always pass the key column names —
`new String[]{"id"}` to `prepareStatement`, or `update(keyHolder, "id")` on
`JdbcClient`.

**`getKey()` returns `Number`, which is wrong for a `uuid` or text key.** Use
`getKeyAs(UUID.class)`. The failure with `getKey()` is a class cast rather than
anything informative, and UUID primary keys are common enough that this is worth
knowing before you meet it.

**A generated key is `null` when the insert did nothing.** `insert … on conflict do
nothing` that conflicts inserts no row, so there is no key. `getKey()` is annotated
`@Nullable` for this reason, and the case is easy to miss because it only occurs
when the conflict actually happens. Check the row count from `update()` alongside
the key.

**`RETURNING` silently disables `reWriteBatchedInserts`.** If you have turned that
on for a bulk import and then add a `RETURNING` clause — or ask for generated keys,
which appends one — the rewrite stops applying and nothing tells you. That is
**[Insert rewriting](../01-jdbc/19c-insert-rewriting.md)**, and it is the single
most expensive silent interaction in this area.

**The optimistic-locking check must include the version in the `WHERE`, not just
increment it.** `set version = version + 1 where id = :id` always matches and always
succeeds, so the row count is always 1 and the check never fires. The predicate has
to be `where id = :id and version = :version`. It is an easy line to write wrong and
impossible to notice without a concurrent test.

**A row count of 1 does not mean the row changed.** PostgreSQL reports a matched row
as updated even when every column is set to the value it already had. If "did
anything actually change" matters — for an audit trail, or to decide whether to
publish an event — compare explicitly in the `WHERE`, or use `RETURNING` and look at
what came back.

## Interview questions

**★ What does `update()` return and why should you care?**
The number of rows the statement affected, as reported by the driver. It matters
because for a targeted write it is the only confirmation that the statement matched
anything — a zero-row `UPDATE` or `DELETE` is a completely successful statement at
every layer, so nothing throws. The most valuable use is optimistic concurrency:
`update … set version = version + 1 where id = :id and version = :version` returns
`0` exactly when someone else has written first, at which point you throw
`OptimisticLockingFailureException` and let a retry policy outside the transaction
deal with it. Discarding the count is how a lost update becomes invisible.

**★ How do you get the id the database assigned to a new row?**
Three ways, and on PostgreSQL the third is best. A `KeyHolder` with a
`PreparedStatementCreator` that names the key column —
`connection.prepareStatement(sql, new String[]{"id"})` — then `keyHolder.getKey()`.
Or `JdbcClient`'s `update(keyHolder, "id")`, which is the same thing without the
creator. Or simply write `returning id` in the SQL and treat the insert as a query:
`.query(Long.class).single()`. The last needs no key holder at all and generalises
to returning other database-assigned columns, at the cost of being PostgreSQL
syntax.

**★ Why does `KeyHolder.getKey()` sometimes throw on PostgreSQL?**
Because the key holder ended up with more than one column. `getKey()` is documented
to retrieve "the first item from the first map, assuming that there is just one item
and just one map", and to throw `InvalidDataAccessApiUsageException` if it finds
multiple entries. On pgJDBC, asking for keys with `Statement.RETURN_GENERATED_KEYS`
causes the driver to append `RETURNING *`, so every column of the inserted row comes
back and the map has an entry per column. The fix is to name the key columns
explicitly, which makes the driver append `RETURNING id` instead.

**★ Your primary key is a `UUID`. What changes?**
`getKey()` stops being usable — it returns `Number`, which is documented as "the
usual type for auto-generated keys" and is not what you have. Use `getKeyAs(UUID
.class)`, added in 5.3, or sidestep the key holder entirely with `returning id` and
`.query(UUID.class).single()`. Worth adding: with a UUID key you often do not need
the database to generate it at all — deciding the id in Java before the insert
removes this whole problem, which is the argument in
**[When the key is not the database's](../01-jdbc/20e-when-the-key-is-not-the-databases.md)**.

**★ Is `RETURNING` better than `KeyHolder`?**
On PostgreSQL, yes, for three reasons. It is explicit — the SQL says what comes
back, rather than depending on what the driver appends. It gives you more than the
key: `returning id, created_at, updated_at` hands back every database-assigned
value in the same round trip. And it goes through the ordinary result mapping, so
the answer arrives as a record rather than as an `Object` in a map. The reason to
keep `KeyHolder` is portability: it is the abstraction that works the same way on
databases without `RETURNING`.

**★ What is the interaction between generated keys and batch inserts?**
A bad one, and it is not obvious. pgJDBC implements generated-key retrieval by
appending a `RETURNING` clause, and `reWriteBatchedInserts` — the setting that
collapses many single-row inserts into multi-row ones — refuses to apply to any
statement containing `RETURNING`. So switching on key retrieval silently switches
off the rewrite, and your bulk insert loses most of its speed with no error and no
log line. If you need both, the usual answer is to generate the ids in the
application so that no `RETURNING` is required.

**★ How would you detect a lost update without a version column?**
You largely cannot, which is the point of the version column. The alternatives are
worse: comparing every column in the `WHERE` clause works but makes the statement
fragile and cannot distinguish "changed back" from "never changed"; taking a
pessimistic lock with `SELECT … FOR UPDATE` prevents the race instead of detecting
it, at the cost of holding a lock for the duration
(**[Locking and `SELECT FOR UPDATE`](../03-jdbc-transactions/12-locking-and-select-for-update.md)**).
A monotonically increasing `version` integer, checked in the `WHERE` and incremented
in the `SET`, is one column and one comparison and it is why every ORM has one.

---

← Prev: [7 · Empty results](07-queryforobject-and-empty.md) · Index: [05 · SQL-first access](README.md) · Next → [8b · Batches and bulk](08b-batches-and-bulk-writes.md)
