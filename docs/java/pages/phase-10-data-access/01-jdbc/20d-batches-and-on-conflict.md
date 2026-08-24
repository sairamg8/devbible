---
title: "A batch returns one key per row it affected, not per row you submitted, and nothing tells you which ones are missing"
sidebar_label: "20d · Batches and ON CONFLICT"
sidebar_position: 20.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html);
> the pgJDBC source at github.com/pgjdbc/pgjdbc — `jdbc/PgStatement.java`,
> `core/SqlCommand.java`; the pgJDBC *Connection Parameters* page
> (jdbc.postgresql.org/documentation/use/); and the PostgreSQL 18 manual —
> *INSERT* (postgresql.org/docs/18/sql-insert.html) and *WITH Queries*
> (postgresql.org/docs/18/queries-with.html).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**Generated keys and batches work together on pgJDBC, and the combination hides
the single worst bug in this whole topic. The keys come back as one result set
containing one row for every row the batch *affected* — and "affected" is not
"submitted". Add `ON CONFLICT DO NOTHING`, which the manual says "simply avoids
inserting a row as its alternative action", and a batch of 500 with twenty
conflicts returns 480 rows, in order, with no gap markers and no exception. Code
that walks the input list and the key result set in lockstep — which is the
obvious way to write it, and what almost everyone writes — then assigns ids to
the wrong objects from the first conflict onward. The update-count array does
encode which entries did nothing, but it is a separate array most code never
looks at, and correlating the two is exactly the work people skip.**

## Generated keys and batches

The javadoc says nothing about `executeBatch` and generated keys, so the answer is
per driver. pgJDBC supports it, and the mechanism is visible in `PgStatement`. The
flag set by the `String[]` overload is documented in the source as "Was this
`PreparedStatement` created to return generated keys for every execution? This is
set at creation time and never cleared by execution" — *every* execution, which is
what makes it survive a batch. The batch path then does:

```java
if (wantsGeneratedKeysAlways) {
  generatedKeys = new ResultWrapper(handler.getGeneratedKeys());
}
```

One result set, assembled after the whole batch has run, containing the returned
rows for every entry, in submission order. So the usage looks ordinary:

```java
try (PreparedStatement ps = c.prepareStatement(
        "INSERT INTO order_lines (order_id, sku, quantity) VALUES (?, ?, ?)",
        new String[] { "id" })) {
    for (Line line : lines) {
        ps.setLong(1, orderId);
        ps.setString(2, line.sku());
        ps.setInt(3, line.quantity());
        ps.addBatch();
    }
    ps.executeBatch();
    try (ResultSet keys = ps.getGeneratedKeys()) {
        while (keys.next()) newIds.add(keys.getLong(1));
    }
}
```

Three consequences follow, and each is worth stating out loud.

**The rows are materialised before you read the first one.** The generated-keys
result set is built once the batch has completed, so the whole set is in the
client's heap. That is fine for a few hundred rows and is a memory decision for a
few hundred thousand — the fetch-size streaming from
[chunk 15](15-fetch-size-and-streaming.md) governs query cursors and does not
apply here. Bound the batch size for this reason as much as for any other, as
[chunk 19](19-batch-updates.md) covers in general.

**Insert rewriting is off.** As [chunk 20](20-generated-keys.md) established,
`SqlCommand` requires `!isReturningPresent` for rewrite compatibility, so a batch
that asks for keys cannot also be merged into multi-row `VALUES` tuples by
`reWriteBatchedInserts`. A bulk load that does not need the ids is a different,
faster statement — keep it as one, rather than parameterising a single helper with
a boolean.

**The correspondence between input and output is positional and fragile.** Which
is the rest of this chunk.

## `ON CONFLICT DO NOTHING` returns nothing, and that is documented

The manual is unambiguous about what a `RETURNING` clause emits:

> "The optional `RETURNING` clause causes `INSERT` to compute and return value(s)
> based on each row actually inserted (or updated, if an `ON CONFLICT DO UPDATE`
> clause was used)."

and, in case that leaves room for doubt:

> "Only rows that were successfully inserted or updated will be returned. For
> example, if a row was locked but not updated because an `ON CONFLICT DO UPDATE
> ... WHERE` clause *condition* was not satisfied, the row will not be returned."

`ON CONFLICT DO NOTHING` "simply avoids inserting a row as its alternative
action" — no insert, no returned row, no key. For a single statement that means
`keys.next()` is `false` on a completely successful execution:

```java
// ⛔ throws on the second run, when the email already exists
ps.executeUpdate();
try (ResultSet keys = ps.getGeneratedKeys()) {
    keys.next();
    return keys.getLong(1);
}
```

🔴 **In a batch it is worse, because it fails quietly.** Submit 500 rows of which
20 conflict and `getGeneratedKeys()` yields 480 rows, in order, with nothing
marking the gaps. Code that walks the input list and the key result set together
assigns row 21's id to input 21 when it belongs to input 22, and every assignment
after that is wrong by one — an off-by-N that grows with each conflict and throws
nothing at all. The bug surfaces days later as objects pointing at each other's
rows.

Two options keep every input row returning; a third avoids the question
altogether and is [chunk 20e's](20e-when-the-key-is-not-the-databases.md)
subject.

```sql
-- 1 · return a correlating value, not just the key
INSERT INTO customers (email, display_name) VALUES (?, ?)
ON CONFLICT DO NOTHING
RETURNING id, email;
```

✅ **This is the fix that always works.** Returning the natural key alongside the
generated one turns the correlation from positional into a lookup: build a
`Map<String, Long>` from the result and match by value. Rows that did nothing are
simply absent from the map, which is information rather than corruption. It costs
one extra column and removes the entire class of bug.

```sql
-- 2 · make every row return, with a real upsert
INSERT INTO customers (email, display_name) VALUES (?, ?)
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
RETURNING id;
```

Every input row is now either inserted or updated, so every input row comes back
and the positional correspondence holds. It is not free: a `DO UPDATE` is a
genuine write with the row-version and index-maintenance cost of one, even when
the values are identical.

⚠️ **The batch side of this is [chunk 19d](19d-generated-keys-from-a-batch.md)** —
what the JDBC specification does and does not promise about keys after
`executeBatch`, why the driver collects a row only when its update count is
positive, and what happens to keys already collected when an entry fails.

## Reading the update counts instead

The information you need is not actually missing — it is in the other return
value. `executeBatch()` gives you an `int[]` with one entry per submitted
statement, and a `DO NOTHING` that did nothing reports zero rows. So a correct
positional walk is possible:

```java
int[] counts = ps.executeBatch();
try (ResultSet keys = ps.getGeneratedKeys()) {
    for (int i = 0; i < counts.length; i++) {
        if (counts[i] == 0) {           // this input inserted nothing
            results.add(null);
            continue;
        }
        keys.next();
        results.add(keys.getLong(1));
    }
}
```

⚠️ **Prefer option 1 anyway.** This version is correct and it is also a piece of
index arithmetic that nobody will re-derive during a code review, and that quietly
breaks if a trigger or a rule ever makes one input affect more than one row.
Returning a correlating column is correct *and* obvious, and obviousness is what
you want in the code that decides which customer owns which id.

## Gotchas

**⚠️ Zipping batch keys against the input list by position**
**Symptom:** ids assigned to the wrong objects, off by the number of conflicts,
with no exception anywhere.
**Cause:** the keys result set has one row per row *affected*, and a conflicting
`DO NOTHING` entry affects none.
**Fix:** return a correlating column and match by value, or use the update-count
array to skip the entries that did nothing.

**⚠️ `keys.next()` returning `false` after a successful upsert**
**Symptom:** an `IllegalStateException` or a `SQLException` on the second run of
an operation that worked the first time.
**Cause:** `ON CONFLICT DO NOTHING` inserted nothing, so there is no row to
return. The manual: "Only rows that were successfully inserted or updated will be
returned."
**Fix:** treat empty as a valid outcome and decide what it means — usually "fetch
the existing row" or "return `Optional.empty()`".

**⚠️ A "no-op" `DO UPDATE` assumed to be free**
**Symptom:** unexpected write amplification, table bloat or replication volume
from an import that was supposed to be idempotent.
**Cause:** `DO UPDATE SET col = EXCLUDED.col` is a genuine update whether or not
the value changed.
**Fix:** add a `WHERE` to the `DO UPDATE` so it only fires on real changes — and
then remember that the manual says a row excluded by that `WHERE` "will not be
returned", which puts you back in the missing-rows case, but deliberately.

**⚠️ Streaming a very large batch's keys**
**Symptom:** heap pressure proportional to batch size on an operation that felt
like it should stream.
**Cause:** the generated-keys result set is assembled after the batch completes;
`setFetchSize` governs query cursors, not this.
**Fix:** bound the batch. Batch size is a memory decision on both sides, not only
a round-trip one.

**⚠️ Enabling `reWriteBatchedInserts` on a batch that wants keys**
**Symptom:** a configuration change that is measured, shows nothing, and is
retained anyway because it "should" help.
**Cause:** any `RETURNING` clause — including the one the driver appended for you
— disqualifies the statement from rewriting.
**Fix:** split the bulk path from the read-back path. One statement can be fast;
the other can return ids; no statement does both.

**⚠️ Assuming one input row means one returned row**
**Symptom:** correlation logic that is correct today and wrong after a rule or a
trigger is added.
**Cause:** the invariant is "one row per row affected", and a rule can make one
statement affect several.
**Fix:** correlate by value. It is the only formulation that does not depend on
the invariant holding.

**⚠️ Treating a zero update count as a failure**
**Symptom:** a batch import that throws on rows which merely already existed.
**Cause:** `DO NOTHING` succeeding is indistinguishable from doing nothing,
because it *is* doing nothing.
**Fix:** decide what "already present" means for the operation before writing the
error handling, not after the first support ticket.

## Interview questions

**★ Do generated keys work with `executeBatch()`?**
On pgJDBC, yes, and the JDBC specification is silent about it, which is why the
question is worth asking rather than assuming. The `String[]` overload sets a flag
the driver's own source describes as being for "every execution" and which is
"never cleared by execution", so it survives a batch; after the batch completes
the driver assembles a single result set containing the returned rows for every
entry, in submission order. Three things follow. The whole set is materialised in
the client's heap before you read the first row, so batch size is a memory
decision and not only a round-trip one. Insert rewriting —
`reWriteBatchedInserts`, the 2–3× optimisation — is disabled, because any
`RETURNING` clause disqualifies a statement from it. And the correspondence
between the inputs you submitted and the rows you get back is positional, which is
only safe while every input produces exactly one row.

**★ What happens to generated keys when you use `ON CONFLICT DO NOTHING`?**
Nothing comes back for the conflicting rows, and this is documented rather than
surprising: `RETURNING` returns "value(s) based on each row actually inserted (or
updated, if an `ON CONFLICT DO UPDATE` clause was used)", and "only rows that were
successfully inserted or updated will be returned". For a single statement that
means `getGeneratedKeys()` yields the documented empty result set and `next()`
returns `false` on a completely successful execution — so code that assumes a row
throws on the second run of an idempotent operation. In a batch it is worse
because it is quiet: 500 submitted rows with 20 conflicts give 480 key rows in
order with no gap markers, and anything zipping keys against inputs by index is
now assigning ids to the wrong objects, wrong by a margin that grows with each
conflict.

**★ How do you correlate batch keys with the inputs correctly?**
Two ways, and one of them is much better. The good one is to stop correlating by
position: return a value that identifies the input — the natural key you inserted
— alongside the generated one, then build a map and match by value. Rows that did
nothing are simply absent from the map, which is information rather than
corruption, and the code stays correct if a rule or trigger ever makes one input
affect more than one row. The other way is to use the `int[]` that
`executeBatch()` already returned: an entry that inserted nothing reports zero, so
you can walk the counts and advance the key cursor only for non-zero entries. That
is correct, and it is index arithmetic nobody will re-derive in review. Prefer the
extra column.

**★ Why does asking for keys make a batch slower, and what would you do about it?**
Two reasons, and they compound. The statement is disqualified from
`reWriteBatchedInserts` — the driver's own configuration documentation describes
that option as turning many single-row inserts into one multi-row `VALUES` list
for a "2-3x performance improvement", and `SqlCommand` requires
`!isReturningPresent` to apply it, so a `RETURNING` clause of any origin turns it
off. And every affected row now sends data back, which on `RETURN_GENERATED_KEYS`
means every column of every row, materialised client-side before you read the
first one. What I would do is stop treating "insert many rows" as one operation:
a bulk load that only needs to have happened is a different statement from an
insert whose ids the caller needs, and trying to serve both from one
parameterised helper guarantees the slow path for everyone. Where the ids really
are needed for every row, name the key column so the return payload is one value
per row rather than a whole row, and bound the batch so the materialised result
set is bounded too.

---
<!--FOOTER-->
