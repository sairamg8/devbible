---
title: "14.2 · Carrying the identity"
sidebar_label: "02 · Carrying the identity"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [row security policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),
> [configuration functions](https://www.postgresql.org/docs/18/functions-admin.html).
> The `SET` vs `SET LOCAL` pooled-connection leak is **sandbox-measured**
> (`sandbox/pg-api/ex54-pgbouncer.mjs` §3). No other console output on this page.

**A policy needs to know who is asking, and getting that wrong is a cross-tenant
data leak rather than a bug.** This chunk is the mechanism that carries user
identity into the database, and the one rule that makes it safe.

## Carrying the identity

RLS policies need to know who is asking. The database knows the *role*, but a web
application connects as one role for all users, so the user identity must be
carried in some other way. The standard mechanism is a custom setting:

```sql
BEGIN;
SET LOCAL app.user_id   = '…';
SET LOCAL app.tenant_id = '…';
-- queries here are filtered by the policies
COMMIT;
```

**`SET LOCAL`, never `SET`.** This is not a style preference here, it is the
difference between a working system and a cross-tenant data leak. On a pooled
connection a plain `SET` persists on the backend after your transaction ends, so
the next request — possibly another tenant's — inherits it. That behaviour was
measured directly (`ex54` §3: `SET` persisted across a pooled connection handoff,
`SET LOCAL` did not) and is recorded in
[07 · Pool modes](../07-pgbouncer/02-pool-modes.md). Under transaction pooling it
is worse still, because the connection is shared much more widely.

Read it back safely with the two-argument form:

```sql
current_setting('app.user_id', true)   -- true = return NULL if unset, do not error
```

The second argument matters: with `false` (the default), an unset setting raises
an error. Which of those you want deserves thought — and the answer is usually
that you want the **error**, since a policy comparing against `NULL` yields NULL,
which is not true, so the row is filtered. That fails closed, which is correct,
but it fails *silently*. An explicit error is easier to debug and harder to
misread than an inexplicably empty table.

The pattern that makes this safe is a helper that sets context and runs the work
in one transaction, so no code path can query without it:

```js
export async function withUser(pool, {userId, tenantId}, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

`set_config(name, value, is_local)` with `is_local = true` is the function form of
`SET LOCAL`, and it takes the value as a **parameter** — which matters because
`SET LOCAL app.user_id = $1` is not valid syntax; `SET` does not accept
parameters. That specific `42601` syntax error is a documented finding in this
corpus's own review notes, and `set_config()` is the fix.

## Trade-off

RLS trades **flexibility and transparency for a guarantee**. The guarantee is
strong and rare: authorization that cannot be bypassed by forgetting a `WHERE`
clause, that applies equally to your API, an admin script, a migration and a
`psql` session. For multi-tenant data that is worth a great deal, because the
failure it prevents — one tenant reading another's rows — is the failure that
ends companies.

What you pay: policies are invisible at the call site, so a query returning
fewer rows than expected has a cause that is not in the query; every policy is a
predicate added to every query, with the performance consequences in
[chunk 03](03-performance-and-practice.md); and the whole thing is silently void
if the connecting role owns the table or holds `BYPASSRLS`.

The deciding question is whether authorization is genuinely **data-shaped**.
Row ownership and tenant isolation are — they are properties of rows, and RLS
expresses them exactly. Rules like "editors may publish on Tuesdays" are not, and
forcing them into policies produces something harder to read and slower than the
application code it replaced.

## Gotchas

**Symptom:** The table has data but every query returns zero rows
**Cause:** RLS enabled with no matching policy — documented default-deny.
**Fix:** Add a policy, or check that `app.user_id` is actually set in this
transaction.

**Symptom:** Policies exist but do nothing
**Cause:** The connecting role **owns the table** (owners bypass RLS by default),
or is a superuser, or has `BYPASSRLS`.
**Fix:** Connect as a non-owner role, and add `FORCE ROW LEVEL SECURITY`. Verify
with `pg_class.relrowsecurity` and `relforcerowsecurity`.

**Symptom:** A user reassigned their row to someone else
**Cause:** An `UPDATE` policy with `USING` but no `WITH CHECK` — the row was
allowed before the change and nothing validated it after.
**Fix:** Give `UPDATE` policies both clauses.

**Symptom:** Adding a `RESTRICTIVE` policy made the table empty
**Cause:** Restrictive policies are `AND`-ed and grant nothing; with no
permissive policy there is nothing to narrow.
**Fix:** Add at least one permissive policy.

**Symptom:** One user sees another user's data intermittently
**Cause:** Plain `SET` instead of `SET LOCAL` — the setting persists on the
pooled connection for the next request. Measured.
**Fix:** `SET LOCAL` or `set_config(..., true)`, always inside a transaction.
This is a security bug, not a hygiene issue.

**Symptom:** `SET LOCAL app.user_id = $1` raises `42601`
**Cause:** `SET` does not accept query parameters.
**Fix:** `SELECT set_config('app.user_id', $1, true)`.

## Interview questions

**★ What happens when you enable RLS with no policies?**
The table appears empty. The documentation specifies a default-deny policy: no
rows visible, none modifiable. It is not an error, which is exactly what makes it
confusing the first time — queries succeed and return nothing.

**★ What is the difference between `USING` and `WITH CHECK`?**
`USING` filters existing rows (`SELECT`, `UPDATE`, `DELETE`); `WITH CHECK`
validates the row *after* a write (`INSERT`, `UPDATE`). An `UPDATE` policy needs
both — with only `USING`, a user can modify a row they legitimately own into one
they should not, such as reassigning `owner_id`. If only `USING` is supplied,
PostgreSQL implicitly copies it into `WITH CHECK`.

**★ Why might correct-looking policies have no effect?**
Because the connecting role bypasses RLS: superusers and `BYPASSRLS` roles always
do, and **table owners do by default**. An application connecting as the schema
owner gets no protection at all. Fix by connecting as a non-owner and adding
`FORCE ROW LEVEL SECURITY`.

**★ How do permissive and restrictive policies combine?**
Permissive (the default) are OR-ed — any one grants access. Restrictive are
AND-ed — all must pass. Restrictive policies only narrow, so a table with
restrictive policies and no permissive ones is empty. Tenant isolation is the
natural restrictive policy; "owner or public" is the natural permissive pair.

**★ How does a web app tell the database who the user is?**
A custom setting carried per transaction — `set_config('app.user_id', $1, true)`
— read in policies via `current_setting('app.user_id', true)`. It must be
transaction-local: a plain `SET` persists on a pooled connection and leaks into
the next request, which was measured and is a cross-tenant exposure rather than a
style issue.

**When is RLS the wrong tool?**
When the authorization rule is not a property of the row. Ownership and tenancy
map cleanly onto predicates; workflow rules, time-based permissions and
role-hierarchy logic usually do not, and expressing them as policies yields
something slower and harder to read than the application code it replaced.

---


---

← [Policies](01-policies.md) · Next → [Performance and practice](03-performance-and-practice.md)
