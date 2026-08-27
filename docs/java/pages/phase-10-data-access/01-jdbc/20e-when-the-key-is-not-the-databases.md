---
title: "The cheapest way to find out which id you were given is to have decided it yourself"
sidebar_label: "20e · Client-side keys, and upward"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.util.UUID`
> (docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/UUID.html); the
> PostgreSQL 18 manual — *UUID Functions*
> (postgresql.org/docs/18/functions-uuid.html), *WITH Queries*
> (postgresql.org/docs/18/queries-with.html) and *INSERT*
> (postgresql.org/docs/18/sql-insert.html); and the Spring Framework javadoc for
> `org.springframework.jdbc.support.GeneratedKeyHolder`
> (docs.spring.io/spring-framework/docs/current/javadoc-api/).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**Four chunks of machinery exist to answer one question — which id did the server
assign? — and every one of them costs something: a return payload, a disabled
batch optimisation, a correlation problem, an empty result set from a successful
upsert. There is a design in which none of it applies. If the application decides
the key before the insert, the insert has nothing to tell you: no `RETURNING`
clause, no `getGeneratedKeys()`, no positional correlation, no special case for a
conflicting row, and a retry after a timeout is a retry of the same row rather
than a second row. It is not free, and this chunk is about that trade, the middle
ground where the database still owns the key, and what all of it looks like from
a layer up — where Spring's `KeyHolder` and JPA's `@GeneratedValue` are the same
decision wearing a different name.**

## Insert-or-fetch, when the row may already be there

A middle move first: keep server-assigned keys, but cover both outcomes at once.

```sql
-- insert-or-fetch in one statement, with a caveat
WITH ins AS (
    INSERT INTO customers (email) VALUES (?)
    ON CONFLICT (email) DO NOTHING
    RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM customers WHERE email = ?
LIMIT 1;
```

⚠️ **The caveat is real and it is in the manual.** In a `WITH`, "all the statements
are executed with the same *snapshot* ... so they cannot 'see' one another's
effects on the target tables", which means the `SELECT` branch reads the snapshot
taken before the insert ran. It will not see a row another transaction committed
after that snapshot, so under a genuine insert race this can still return zero
rows and the caller must be able to retry. The manual also warns more generally
that "the sub-statements in `WITH` are executed concurrently with each other and
with the main query", so the order of the modifications is unpredictable and
"`RETURNING` data is the only way to communicate changes between different `WITH`
sub-statements and the main query". It is a good query and it does remove a round
trip; it does not remove the retry.

## Client-generated keys, and what they actually change

The alternative is to decide the key in Java:

```java
record NewOrder(UUID id, long customerId, int totalCents) { }

var order = new NewOrder(UUID.randomUUID(), customerId, totalCents);

try (PreparedStatement ps = c.prepareStatement(
        "INSERT INTO orders (id, customer_id, total_cents) VALUES (?, ?, ?)")) {
    ps.setObject(1, order.id());          // pgJDBC maps java.util.UUID to uuid
    ps.setLong(2, order.customerId());
    ps.setInt(3, order.totalCents());
    ps.executeUpdate();
}
```

No keys API, no `RETURNING`, no result set to read. Five things change, and they
are larger than they look.

- **The object graph can be built before anything is written.** A parent and its
  children all have ids in memory, so foreign keys can be filled in before the
  first statement runs and everything goes out in one batch. With server-assigned
  keys the parent must be inserted and read back before the children can even be
  constructed.
- **Batches stay eligible for insert rewriting**, because there is no `RETURNING`
  clause to disqualify them ([chunk 20d](20d-batches-and-on-conflict.md)).
- **`ON CONFLICT DO NOTHING` stops being a trap.** You do not need the statement to
  tell you the id, so a conflicting row returning nothing is simply a no-op.
- **Retries become safe.** A client that times out mid-insert and retries sends the
  *same* key, so the second attempt conflicts instead of creating a duplicate. That
  is a genuinely hard problem to solve any other way.
- **Testing gets easier**, because a test can assert on an id it chose rather than
  on whatever the sequence happened to be.

And the costs, stated honestly. The key is 16 bytes rather than 8, which is paid
once in the table and again in every index and every foreign key that references
it. The values are opaque — no "order 4471" in a support conversation, and no way
to eyeball insertion order. And a version-4 UUID is random by construction, so
consecutive inserts land in unrelated parts of the primary-key index rather than
at one end of it.

## Version 4, version 7, and what the JDK will actually give you

That last cost is why UUID versions matter. PostgreSQL 18 documents three
generators: `gen_random_uuid()` and `uuidv4()` both "Generate a version 4 (random)
UUID", while `uuidv7()` "Generates a version 7 (time-ordered) UUID. The timestamp
is computed using UNIX timestamp with millisecond precision + sub-millisecond
timestamp + random." Time-ordered is the point: a v7 key sorts approximately by
creation time, so inserts append rather than scatter.

⚠️ **The JDK does not generate version 7.** `java.util.UUID` offers exactly two
factories — `randomUUID()`, "a type 4 (pseudo randomly generated) UUID... generated
using a cryptographically strong pseudo random number generator", and
`nameUUIDFromBytes(byte[])`, "a type 3 (name based) UUID" — plus `fromString`. The
class documentation describes four basic types with "a version value of 1, 2, 3 and
4"; there is no version-7 factory. So a client-generated v7 means a library or your
own bit packing through the `UUID(long, long)` constructor, and a *server*-generated
v7 means a `DEFAULT uuidv7()` — which puts you straight back to needing `RETURNING`
if you want to know it.

🔴 **That is the crux, and it is easy to miss.** "Use UUIDs" does not by itself
remove the read-back; *generating them client-side* does. A `uuid` primary key
with a server-side default is exactly as much of a generated key as a `bigint`
identity column, and needs exactly the same machinery.

The middle option, worth knowing: keep integer keys but fetch them in advance.
`SELECT nextval('orders_id_seq')` — or a range of them — gives the application the
ids before the inserts, with the same "graph first, one batch" benefit and none of
the width cost. It costs a round trip per allocation, which is why the tools that do
this allocate in blocks rather than one at a time.

## The same decision, one layer up

Every framework re-exposes this, and [chunk 20's](20-generated-keys.md) surprise
follows it upward intact.

**Spring's `KeyHolder`.** `GeneratedKeyHolder` is described in its javadoc as "The
standard implementation of the `KeyHolder` interface, to be used for holding
auto-generated keys (as potentially returned by JDBC insert statements)", and its
convenience accessor is explicit about its assumptions:

> "Retrieve the first item from the first map, assuming that there is just one
> item and just one map, and that the item is a number. This is the typical case:
> a single, numeric generated key. Keys are held in a List of Maps, where each
> item in the list represents the keys for each row. If there are multiple
> columns, then the Map will have multiple entries as well. If this method
> encounters multiple entries in either the map or the list meaning that multiple
> keys were returned, then an `InvalidDataAccessApiUsageException` is thrown."

🔴 **Read that against `RETURNING *`.** If the insert was prepared with
`RETURN_GENERATED_KEYS`, pgJDBC returns every column, the map has an entry per
column, and `getKey()` throws — on PostgreSQL, for a perfectly ordinary
single-column key. The fix is the one this whole topic keeps arriving at: name the
key column. `getKeys()` has the row-shaped version of the same rule — it "returns
the first map of keys" and throws if the list holds several — and `getKeyList()` is
the honest accessor "for extracting keys for multiple rows".

**JPA's `@GeneratedValue`.** The strategies are the same three positions in
annotation form: let the database assign the value on insert and read it back; take
a value from a sequence before the insert; or assign it in the application. The
consequence is also the same shape — a strategy that learns the key *from* the
insert must execute that insert to know it, while a strategy that knows the key
first can defer and group its writes. That is why the choice of strategy shows up
as a batching question rather than a naming question. [Topic 06 — The JPA/Hibernate model](../06-jpa-hibernate-model/README.md)
covers it properly; [Topic 05 — SQL-first access](../05-sql-first-access/README.md)
covers `JdbcClient` and `JdbcTemplate`, where the
`KeyHolder` above lives.

## The trade-off

Neither model is the sophisticated choice; the mistake is drifting into one without
noticing. A `uuid` column with a server-side default pays the width and opacity of
client-assigned keys *and* the read-back of server-assigned ones, and
`RETURN_GENERATED_KEYS` against a wide table is the same drift one layer down.
Decide which model you are in, then use only that model's machinery.

## Gotchas

**⚠️ Expecting the CTE insert-or-fetch to be race-proof**
**Symptom:** an occasional empty result under concurrent inserts of the same
natural key.
**Cause:** the `WITH` sub-statements share one snapshot and "cannot 'see' one
another's effects", so the fetch branch cannot see a row committed after that
snapshot.
**Fix:** keep the query, but make the caller retry once. There is no snapshot-free
version of it.

**⚠️ "We use UUIDs, so we don't need generated keys"**
**Symptom:** a `uuid` primary key with `DEFAULT gen_random_uuid()` and code still
reading `getGeneratedKeys()`, or worse, not reading it and having no id.
**Cause:** a server-side default is a server-assigned key regardless of the type.
**Fix:** generate the value in Java if that is the model you want. The column type
is not what makes the difference.

**⚠️ Reaching for `UUID.randomUUID()` and expecting version 7**
**Symptom:** an index that scatters exactly as much as before the "ordered UUID"
migration.
**Cause:** the JDK generates version 4 (random) and version 3 (name-based) only;
there is no version-7 factory in `java.util.UUID`.
**Fix:** use a library, pack the bits yourself through the `UUID(long, long)`
constructor, or accept a server-side `uuidv7()` default — and if you accept it,
accept the read-back that comes with it.

**⚠️ `GeneratedKeyHolder.getKey()` throwing on PostgreSQL**
**Symptom:** `InvalidDataAccessApiUsageException` from an insert with a single,
ordinary numeric key.
**Cause:** the insert was prepared with `RETURN_GENERATED_KEYS`, so pgJDBC returned
every column, so the key map has several entries — and `getKey()` throws when it
"encounters multiple entries in either the map or the list".
**Fix:** name the key column. This is [chunk 20's](20-generated-keys.md)
`RETURNING *` surprise surfacing one layer up, and it is the most common way people
meet it.

**⚠️ Calling `getKeys()` after a multi-row insert**
**Symptom:** the same exception from code that inserted several rows successfully.
**Cause:** `getKeys()` "returns the first map of keys" and throws if the list holds
more than one row's worth.
**Fix:** `getKeyList()`, which exists precisely for that case.

**⚠️ Inventing an "id" before the insert by reading the sequence, then not using it**
**Symptom:** gaps in the sequence far larger than the rollback rate explains.
**Cause:** every `nextval` consumes a value whether or not a row is inserted.
**Fix:** none needed if the gaps are acceptable — they usually are — but do not
build anything that assumes contiguity, and do not fetch ids you may not use.

**⚠️ Assuming a client-generated key removes the need for a constraint**
**Symptom:** duplicate rows after a retry storm or a buggy generator.
**Cause:** the application generating a value is a convention, not an integrity
rule.
**Fix:** the `PRIMARY KEY` constraint is what makes the retry safe. Without it,
the retry inserts a second row and nothing complains.

## Interview questions

**★ How would you write an idempotent "insert this customer and give me the id"?**
Several options, and the choice is about what you are willing to pay. Return a
correlating column so a `DO NOTHING` conflict is visible as an absence rather than
a shifted index — cheapest and always correct. Or make the statement always return
a row with a real upsert, `ON CONFLICT (email) DO UPDATE SET ... RETURNING id`,
which preserves one-row-per-input at the cost of a genuine write on every conflict.
Or use a data-modifying CTE that inserts with `DO NOTHING` and unions the
`RETURNING` against a `SELECT` of the existing row — which avoids the write, but the
manual warns that `WITH` sub-statements share one snapshot and "cannot 'see' one
another's effects", so under a real insert race it can come back empty and the
caller must retry. Best of all, where the domain allows it: generate the key in the
application, and the question stops existing.

**★ What actually changes if the application generates the key?**
The insert has nothing to tell you, so every mechanism built to carry that
information becomes unnecessary: no `RETURNING` clause, no `getGeneratedKeys()`, no
correlation between a batch's inputs and its outputs, and no special handling for a
conflicting row that returned nothing. Two structural benefits follow that are
bigger than the round trip. A whole object graph can be built in memory before
anything is written, because children can reference a parent's id before the parent
exists in the database — with server-assigned keys the parent's insert must complete
first. And a retry after a timeout carries the same key, so it conflicts instead of
creating a duplicate, which is a genuinely hard problem to solve otherwise. The
costs are a wider key in every index and foreign key, opaque values that nobody can
quote in a support ticket, and index scatter if the values are random.

**★ Does using a `uuid` primary key remove the generated-keys problem?**
Only if the application generates the value. A `uuid` column with `DEFAULT
gen_random_uuid()` or `DEFAULT uuidv7()` is a server-assigned key in exactly the way
a `bigint` identity column is, and needs exactly the same read-back machinery — the
column type has nothing to do with it. This trips people up because "switch to
UUIDs" is discussed as though it were one decision when it is two: the type, and who
generates it. The version matters as well. PostgreSQL 18 documents `gen_random_uuid()`
and `uuidv4()` as generating version 4, random, and `uuidv7()` as generating version
7, time-ordered — and `java.util.UUID` can produce only versions 3 and 4, so a
client-generated time-ordered key needs a library or hand-packed bits. Picking the
random variant client-side and then being surprised by index behaviour is the
common outcome of not separating those questions.

**★ Why does `GeneratedKeyHolder.getKey()` throw on PostgreSQL for a normal insert?**
Because the driver returned more than one column and Spring's convenience accessor
refuses to guess. Its javadoc is explicit that keys are "held in a List of Maps,
where each item in the list represents the keys for each row", that "if there are
multiple columns, then the Map will have multiple entries as well", and that
multiple entries in either structure mean an `InvalidDataAccessApiUsageException`.
On PostgreSQL, preparing the insert with `RETURN_GENERATED_KEYS` makes pgJDBC append
`RETURNING *`, so the map has one entry per table column and the accessor throws for
a table with a single, ordinary key. The fix is the same one this topic keeps
returning to — name the key column — and the reason it is worth knowing is that most
developers meet the `RETURNING *` behaviour here, at the framework layer, rather than
in the driver where it originates.

**★ What is the middle ground between server-assigned and client-assigned keys?**
Fetching the key from a sequence *before* the insert: `SELECT nextval('orders_id_seq')`,
or better a block at once. You keep an eight-byte, monotonic, human-quotable integer key, and you gain the property that matters most about client-generated keys —
the application knows the id before it writes, so the object graph can be assembled and
sent as one batch, and the insert needs no `RETURNING` clause. The cost is a round trip
per allocation, which is why the ORMs that use this strategy allocate in blocks and
accept the gaps that leaves in the sequence. Those gaps are the usual objection, and
they are not a real problem: a value consumed by `nextval` is used up whether or not a
row is inserted anyway, so gaps exist under every strategy and nothing should depend on
contiguity.

---
← Prev: [20d · Batches and ON CONFLICT](20d-batches-and-on-conflict.md) · Index: [JDBC](README.md) · Next → [21 · `SQLException`](21-sqlexception.md)
