---
title: "Columns, reads and ownership"
sidebar_label: "03 · Columns and ownership"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex50-privileges.mjs`.

**Three things behave differently from how they read: a column grant does not
restrict, an `UPDATE` privilege does not cover most updates, and revoking a
privilege from an owner does nothing durable.** Each is measured below.

## Column grants are additive, not a ceiling

```console
=== 6. column-level grants ===
SELECT * with column grant on (id,email)             → 42501 permission denied for table customers
SELECT id, email                                     → OK (1 rows)
SELECT ssn (not granted)                             → 42501 permission denied for table customers
WHERE ssn = ... (predicate on ungranted col)         → 42501 permission denied for table customers
count(*) — needs no column privilege                 → OK (1 rows)
```

Four things at once, all useful:

- **`SELECT *` fails** where the explicit column list succeeds. `*` expands to
  every column, including the ungranted one. Any tool that writes `SELECT *` —
  most ORMs, `\d`-driven exploration, a naive admin UI — breaks against a
  column-restricted role.
- **A predicate counts as a read.** `WHERE ssn = …` is denied even though `ssn`
  is not in the output. You cannot filter on what you cannot select, which is
  exactly right: otherwise the column would be readable one comparison at a time.
- **`count(*)` needs no column privilege at all** — it reads no column. Row
  counts are not hidden by column grants.

And then the trap, measured later in the same run:

```console
{ app_select: true, app_truncate: false, analyst_ssn: true }
↑ analyst_ssn is now TRUE, and in section 6 the same read was denied. Nothing about
  the column grant changed — section 7 made p13_analyst a member of p13_ro, which
  holds table-wide SELECT. Re-running the section-6 read to confirm:
SELECT ssn — denied in §6, after group membership    → OK (1 rows)
```

**The same role, the same column, denied and then allowed** — because it joined a
group holding table-wide `SELECT` in between. A column grant does not restrict
anything; it *adds* access to specific columns. Effective privilege is the union
over every role you inherit, so any table-wide grant anywhere in that set makes
the column list irrelevant.

If you need a column genuinely unreadable, a column grant is the wrong tool
whenever the role could gain table access another way. Use a **view** exposing
the safe columns and grant on the view, or keep the sensitive column in a
separate table. Check reality with `has_column_privilege`, not with the `GRANT`
statements you remember writing.

## `UPDATE` alone does not cover a real `UPDATE`

```console
=== 10. REVOKE, and the two things it does not undo ===
SELECT after REVOKE SELECT                           → 42501 permission denied for table customers
UPDATE ... WHERE id = 1 (UPDATE still granted)       → 42501 permission denied for table customers
UPDATE with no WHERE, constant value                 → OK
UPDATE ... SET email = email (reads the column)      → 42501 permission denied for table customers
↑ UPDATE alone only covers writing. A WHERE clause, or a SET that reads any column,
  needs SELECT on those columns too — so revoking SELECT breaks most real UPDATEs.
```

`UPDATE` was never revoked here — only `SELECT`. The unqualified update
succeeded; the one with a `WHERE` clause and the one whose `SET` reads a column
both failed with `42501`.

`UPDATE` covers *writing* a column. Anything that **reads** — a `WHERE`, a
`RETURNING`, `SET x = x + 1`, a subquery — requires `SELECT` on the columns it
reads. The same is true of `DELETE … WHERE`. In practice this means a write-only
role is not a useful thing: grant `SELECT` alongside `UPDATE` or nothing works.

It also explains a confusing failure mode — revoking `SELECT` to "make it
read-only in the other direction" breaks writes that appear to be pure writes.

## Ownership outranks privileges

```console
REVOKE SELECT ... FROM p13_owner (the owner)         → OK
owner SELECT after revoking its own SELECT           → 42501 permission denied for table customers
↑ REVOKE from the owner "succeeds" and changes nothing you can rely on:
  ownership carries the right to GRANT it straight back. Ownership ≠ a privilege.
```

The revoke reported success and the owner's next `SELECT` was denied — so the
ACL entry really did go. It is still not a security boundary: the owner can run
`GRANT SELECT ON app.customers TO p13_owner` and undo it in one statement,
because the right to grant comes from ownership, not from the ACL.

The general rule, which the next chunk's ACL dump makes visible: **an owner's
privileges are implicit.** They are printed in `relacl` for readability, but
removing them removes nothing durable. Anything you want an owner not to do must
be enforced by not making that role the owner — which is
[the next topic](../03-app-role-not-owner.md).

```console
=== 11. why the app role must not own the schema ===
app role: DROP TABLE app.receipts                    → 42501 must be owner of table receipts
app role: ALTER TABLE ... DROP COLUMN                → 42501 must be owner of table customers
app role: CREATE TABLE in app                        → 42501 permission denied for schema app
owner: ALTER TABLE ... ADD COLUMN                    → OK
```

Note the wording difference: **`must be owner of table`** for DDL on an existing
object, against `permission denied for` when a grant is missing. There is no
`GRANT DROP` — DDL is an ownership right, and the only way to give it away is to
transfer ownership or grant membership in the owning role.

## `REVOKE` and `PUBLIC`

`REVOKE` removes an ACL entry; it does not create a denial. There is no `DENY` in
PostgreSQL, so a privilege granted to `PUBLIC` cannot be taken away from one role
— you must revoke it from `PUBLIC` and re-grant to the roles that should keep it.

Two `PUBLIC` grants exist by default and are worth knowing:

- **`CONNECT` on every new database** — measured in chunk 01, a fresh role
  connected with no grant.
- **`EXECUTE` on every new function**, measured in the same run:

```console
{ proacl: null }
EXECUTE a function with NO grant written             → OK (1 rows)
same function after REVOKE ... FROM PUBLIC           → 42501 permission denied for function f_probe
↑ proacl NULL = default ACL = EXECUTE to PUBLIC. Only after an explicit REVOKE
  does the ACL materialise and the call get denied.
```

`proacl` is **`NULL`** — no ACL at all — and the call succeeded for a role with
no grant. A `NULL` ACL means *the built-in default*, which for a function is
`EXECUTE` to `PUBLIC`; the column only fills in once you change something. So a
function is callable by every role the moment it is created, and an empty
privilege listing is not evidence that nothing is granted.

Combined with `SECURITY DEFINER`, that is the classic privilege-escalation shape:
the function runs as its owner and anyone can call it. Revoke `EXECUTE` from
`PUBLIC` on any `SECURITY DEFINER` function and grant it explicitly.

The `public` **schema** is a third, separate thing — same word, different object,
covered in the next chunk.


## Trade-off

Column grants are cheap to write and are the wrong tool for hiding data, because
they can only widen access, never narrow it. A **view** is the boundary that
holds: it exposes exactly the columns you name, cannot be widened by an unrelated
group membership, and works with `SELECT *`.

What the view costs is a second object to keep in step with the table, and the
indirection covered in [Views](../../phase-12-beyond-tables/07-views.md). For a
handful of sensitive columns that is the right trade. For a role that simply
should not see one table, grant nothing on that table — the simplest boundary of
all.

## Gotchas

**Symptom:** `SELECT *` fails but `SELECT id, email` works
**Cause:** A column-level grant — `*` expands to every column, including
ungranted ones.
**Fix:** List columns explicitly, or grant the table. An ORM that generates
`SELECT *` cannot work against a column-restricted role.

**Symptom:** A role restricted to two columns can read a sensitive one
**Cause:** Column grants are additive. Membership in any role holding table-wide
`SELECT` supersedes the column list. Measured: the same `SELECT ssn` was `42501`,
then `OK` after a group grant, with the column grant untouched.
**Fix:** Verify with `has_column_privilege`, and use a view as the boundary.

**Symptom:** `UPDATE … WHERE` fails with `42501` although `UPDATE` is granted
**Cause:** The `WHERE` clause reads a column, which requires `SELECT`. Measured:
the unqualified `UPDATE` on the same connection succeeded.
**Fix:** Grant `SELECT` on the columns read. A write-only role cannot run a
qualified update, a `RETURNING`, or `SET x = x + 1`.

**Symptom:** Revoking a privilege from the table owner appears to work, then the
owner has it again
**Cause:** Ownership carries the right to grant. Owner ACL entries are not a
boundary.
**Fix:** Do not use the same role for the application and for ownership — see
[App role should not own the schema](../03-app-role-not-owner.md).

**Symptom:** `42501 must be owner of table …` on an `ALTER`/`DROP`
**Cause:** DDL is an ownership right; there is no `GRANT DROP`.
**Fix:** Transfer ownership, or grant membership in the owning role and
`SET ROLE` to it in the migration.

**Symptom:** A function is callable by a role you never granted it to
**Cause:** New functions carry `EXECUTE` to `PUBLIC`, and `proacl` is `NULL`
until you change something — an empty ACL means the default, not "no access".
**Fix:** `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC`, then grant explicitly.
Essential for `SECURITY DEFINER` functions.

## Interview questions

**★ Is a column-level grant a restriction?**
No — it is additive. Measured: the same role was denied `SELECT ssn`, then
allowed after joining a group with table-wide `SELECT`, with the column grant
unchanged. Effective privilege is the union over every inherited role, so for a
real boundary grant on a view instead.

**★ Why does `UPDATE … WHERE id = 1` fail for a role that has `UPDATE`?**
Because the `WHERE` reads a column and reading needs `SELECT`. Measured: the
unqualified `UPDATE` succeeded on the same connection. `RETURNING` and
`SET x = x + 1` are the same case, which is why a write-only role is not useful.

**★ Can you revoke a privilege from the owner of a table?**
The statement succeeds and the next read is denied, but it is not a boundary: the
owner can grant it straight back, because the right to grant comes from ownership
rather than the ACL. Ownership is not a privilege.

**Does a column grant hide the row count?**
No. Measured: `count(*)` succeeded for a role granted only two columns, because
it reads no column. Column grants hide values, not the existence of rows.

**Can you take a privilege away from one role that `PUBLIC` holds?**
No — there is no `DENY`. Revoke from `PUBLIC` and grant back to the roles that
should keep it. The two defaults that matter are `CONNECT` on a new database and
`EXECUTE` on a new function.

**What is the difference between `permission denied for table` and `must be owner
of table`?**
The first is a missing grant, fixable with `GRANT`. The second is DDL, which is
an ownership right with no `GRANT` form at all — fix it by transferring ownership
or granting membership in the owning role.

---

← [GRANT and REVOKE](02-grant-and-revoke.md) · Next → [Defaults and auditing](04-defaults-and-auditing.md)
