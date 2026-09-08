---
title: "A composite foreign key is enforced by default only when every column is non-null — MATCH SIMPLE exempts the row the moment one column goes NULL"
sidebar_label: "03c · MATCH and column subsets"
sidebar_position: 3.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the **PostgreSQL 18** documentation —
> [CREATE TABLE](https://www.postgresql.org/docs/18/sql-createtable.html) and
> [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).
> Documentation-validated; **no sandbox run**.

**The moment a foreign key spans two columns, two clauses that did nothing before start
deciding correctness: `MATCH`, whose default lets rows through, and the optional column
list on `SET NULL` / `SET DEFAULT`, which works on deletes and not updates.** Neither
exists in any meaningful sense for a single-column key, which is why both arrive
unannounced the first time you write
[`FOREIGN KEY (a, b)`](03b-references-and-foreign-key.md).

## `MATCH SIMPLE` is the default, and it is a hole

> *"There are three match types: `MATCH FULL`, `MATCH PARTIAL`, and `MATCH SIMPLE`
> (which is the default). `MATCH FULL` will not allow one column of a multicolumn
> foreign key to be null unless all foreign key columns are null; if they are all null,
> the row is not required to have a match in the referenced table. `MATCH SIMPLE` allows
> any of the foreign key columns to be null; if any of them are null, the row is not
> required to have a match in the referenced table. `MATCH PARTIAL` is not yet
> implemented."*

Read that against a nullable composite key:

```sql
CREATE TABLE memberships (
  tenant_id bigint,
  user_id   bigint,
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_users (tenant_id, user_id)
);

INSERT INTO memberships (tenant_id, user_id) VALUES (NULL, 42);
```

Under the default `MATCH SIMPLE` that insert **succeeds** even if user 42 belongs to no
tenant at all. One referencing column is null, so the row is exempt from the check
entirely — not checked leniently, not checked against nulls: skipped. The constraint is
present, reads as enforced, is reported by `\d` like any other, and is not enforcing
this row.

Two fixes, and the second is the better one:

```sql
-- all-or-nothing: either both columns are null, or both must match
FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_users (tenant_id, user_id) MATCH FULL

-- better where the relationship is mandatory: remove the null case
tenant_id bigint NOT NULL,
user_id   bigint NOT NULL,
```

`MATCH FULL` still exempts the all-null row, so it is not a substitute for `NOT NULL` —
it converts "any column null ⇒ skip" into "all columns null ⇒ skip", which is a much
smaller hole but still a hole. Where the relationship is genuinely optional, that
remaining hole is exactly the semantics you want: the row simply has no parent yet.
Where it is mandatory, `NOT NULL` is the clause that says so, and then `MATCH` becomes
irrelevant because no exempt case can arise.

Do not reach for `MATCH PARTIAL` on the strength of its name. It is in the SQL standard,
it would mean "the non-null columns must match some parent row", and PostgreSQL 18 still
does not implement it.

Single-column keys are unaffected: with one column, "any null" and "all null" are the
same statement, which is why this never comes up until a key goes composite — and why it
tends to arrive with a schema change rather than with new code.

## Where this actually bites

The pattern is almost always a tenant or partition column added to an existing key:

```sql
-- was: memberships.user_id REFERENCES users (id) NOT NULL — airtight
-- becomes, when the schema goes multi-tenant:
FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_users (tenant_id, user_id)
```

If the new `tenant_id` is added nullable — the safe-looking choice, because a backfill
has not run yet — every row with a null `tenant_id` is now outside the constraint, and
the migration that was supposed to *tighten* integrity has loosened it. See
[Multi-tenancy as a decision](20-multi-tenancy/README.md) for the model choice behind
this, and [Adding NOT NULL safely](09-add-not-null.md) for the sequence that closes the
column afterwards.

The order that keeps the guarantee: add the column, backfill, `SET NOT NULL`, *then* add
the composite foreign key. Adding the key first buys a constraint that does not apply to
the rows you were worried about.

## `SET NULL` and `SET DEFAULT` can name a subset

Composite keys also change what the referential actions can do. Both actions take an
optional column list:

```text
SET NULL [ ( column_name [, ... ] ) ]
SET DEFAULT [ ( column_name [, ... ] ) ]
```

> *"Set all of the referencing columns, or a specified subset of the referencing
> columns, to null."*

> *"Set all of the referencing columns, or a specified subset of the referencing
> columns, to their default values."*

So a parent delete can null just the part of the key that has become meaningless and
leave the rest of the row intact:

```sql
FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_users (tenant_id, user_id)
  ON DELETE SET NULL (user_id)
```

The membership keeps its `tenant_id` — still true, still useful for reporting — and
loses only the user it pointed at. Without the column list, `ON DELETE SET NULL` nulls
both columns and the row forgets which tenant it belonged to.

Note the interaction with the section above: after that action fires, `user_id` is null,
so under `MATCH SIMPLE` the row is now exempt from the very constraint that just
modified it. That is intended — it is how the row is allowed to survive — but it means
"rows with a null half" is a state your queries have to handle, not an anomaly.

One restriction, and it is easy to trip over:

> *"A subset of columns can only be specified for `ON DELETE` actions."*

`ON UPDATE SET NULL (user_id)` is a syntax error. `ON UPDATE SET NULL` — the whole key —
is accepted. In practice this costs nothing, because a well-chosen primary key never
changes and `ON UPDATE` rarely earns an action at all
([Foreign keys](03-foreign-keys.md)).

Every column named in the subset must be nullable for `SET NULL`, and must have a
default that exists in the parent for `SET DEFAULT` — the same two traps the
single-column actions have, now applying to a subset you chose rather than to the whole
key.

## Trade-off

`MATCH FULL` costs nothing at write time and removes a class of silent gap, so the
argument against it is not performance — it is that it changes what your schema accepts,
and an existing table may already hold rows that only pass under `MATCH SIMPLE`. Adding
`MATCH FULL` to a live composite key is therefore a validating change that can fail on
data, in the same class as adding `NOT NULL`. Plan it the same way.

## Gotchas

**Symptom:** A composite foreign key accepts a row with no matching parent
**Cause:** `MATCH SIMPLE`, the default, exempts any row where *any* referencing column
is null.
**Fix:** `MATCH FULL`, or `NOT NULL` on every column of the key — the second is stronger,
because `MATCH FULL` still exempts the all-null row.

**Symptom:** A migration that added a tenant column *reduced* referential integrity
**Cause:** The new column was nullable at the time the composite foreign key was added,
so every un-backfilled row fell outside it.
**Fix:** Add the column, backfill, `SET NOT NULL`, then add the foreign key — in that
order.

**Symptom:** `MATCH PARTIAL` is rejected
**Cause:** It is in the SQL standard but not implemented in PostgreSQL, 18 included.
**Fix:** `MATCH FULL` plus `NOT NULL`, or a `CHECK` expressing the rule you wanted.

**Symptom:** `ON UPDATE SET NULL (user_id)` is a syntax error while the `ON DELETE`
version compiles
**Cause:** A column subset is permitted on `ON DELETE` actions only.
**Fix:** Drop the column list on the `ON UPDATE` side, or handle the update case in the
application. Usually the right answer is that `ON UPDATE` should not have an action.

**Symptom:** `ON DELETE SET NULL (col)` fails at constraint-creation time
**Cause:** A column named in the subset is `NOT NULL`.
**Fix:** Make that column nullable, or pick a different action — the check happens when
the constraint is defined, not when a delete first fires.

**Symptom:** `ON DELETE SET DEFAULT (col)` fails with a fresh foreign key violation
**Cause:** The column's default value does not exist in the parent table.
**Fix:** Ensure the sentinel parent row exists, and that nothing deletes it. On a
composite key remember the *whole* resulting key must resolve, not just the column you
reset.

**Symptom:** Half-null rows accumulate and reports under-count
**Cause:** `ON DELETE SET NULL` on a subset is working exactly as written — the row
survives with one half of its key gone.
**Fix:** Decide deliberately between that and `CASCADE`. If half a key is meaningless to
your queries, the row was not worth keeping.

**Symptom:** Adding `MATCH FULL` to an existing constraint fails on production data
**Cause:** Rows already exist that pass under `MATCH SIMPLE` — one column null, the other
pointing nowhere.
**Fix:** Find them first (`WHERE a IS NULL <> b IS NULL`), decide what they should be,
then tighten.

## Interview questions

**★ What is `MATCH SIMPLE` and why does it matter?**
It is the default match type, and it says a row is exempt from the foreign key check if
*any* of its referencing columns is null. On a composite key with a nullable column that
means rows pointing at nothing are accepted by a constraint that appears to be enforcing
them. `MATCH FULL` requires all-or-nothing nullity instead; `MATCH PARTIAL` is in the
standard but unimplemented. On a single-column key the distinction does not exist, which
is why it surprises people the first time a key goes composite.

**★ Does `MATCH FULL` remove the need for `NOT NULL`?**
No. It still exempts the row where every referencing column is null — it converts "any
column null skips the check" into "all columns null skips the check". If the
relationship is mandatory, `NOT NULL` is the clause that says so, and it also makes
`MATCH` moot.

**★ You add a `tenant_id` to an existing key to make it composite. What breaks?**
Nothing loudly, which is the problem. If `tenant_id` is nullable while the backfill is
pending, every row with a null `tenant_id` is outside the new composite foreign key
under the default `MATCH SIMPLE`. The migration reads as tightening integrity and
actually loosens it. Backfill and `SET NOT NULL` before adding the key.

**★ What does `ON DELETE SET NULL (user_id)` do that `ON DELETE SET NULL` does not?**
It nulls only the named subset of the referencing columns instead of all of them, so the
row keeps the rest of its key. A column subset is legal on `ON DELETE` actions only —
the `ON UPDATE` equivalent is a syntax error.

**Why can a subset be specified on `ON DELETE` but not `ON UPDATE`?**
The documentation states the restriction without a rationale. In practice it costs
little: `ON UPDATE` actions matter only when a referenced key value changes, which a
well-chosen surrogate key never does.

**When is a half-null composite key the behaviour you actually want?**
When the relationship is genuinely optional and the remaining columns still carry
meaning — a membership that keeps its tenant after the user is deleted. If half a key is
meaningless to every query you write, `CASCADE` is the honest action instead.

---

← [`REFERENCES` vs `FOREIGN KEY`](03b-references-and-foreign-key.md) · Next → [`NOT NULL`, `DEFAULT`, `UNIQUE`, `CHECK`](04-constraints.md)
