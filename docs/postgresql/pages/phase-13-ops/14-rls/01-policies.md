---
title: "14.1 · Policies, USING and WITH CHECK"
sidebar_label: "01 · Policies"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [row security policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),
> [`CREATE POLICY`](https://www.postgresql.org/docs/18/sql-createpolicy.html).
> **Not sandbox-measured** — no console output on this page.

**Row-level security moves authorization out of your application and into the
database, where it cannot be forgotten.** That is its entire appeal, and the
reason it is the centre of Supabase's model rather than a niche feature.

## Default deny, once you turn it on

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
```

The documentation is unambiguous about what that does:

> When row security is enabled on a table … all normal access to the table for
> selecting rows or modifying rows must be allowed by a row security policy. If
> no policy exists for the table, a default-deny policy is used, meaning that no
> rows are visible or can be modified.

**Enabling RLS with no policies makes the table appear empty.** Not an error — an
empty result set. `SELECT count(*)` returns 0, `UPDATE` reports 0 rows. This is a
good security default and a genuinely confusing first experience, and it is worth
recognising the symptom immediately: *the table has data but every query returns
nothing.*

## A first policy

```sql
CREATE POLICY documents_own ON documents
  FOR ALL
  USING (owner_id = current_setting('app.user_id')::uuid);
```

The `USING` expression is evaluated per row. Rows for which it is true are
visible; the rest do not exist as far as this query is concerned. Importantly,
they are filtered *silently* — you do not get "permission denied", you get fewer
rows. That is what makes RLS composable with ordinary application queries: the
application writes `SELECT * FROM documents` and the database narrows it.

## `USING` versus `WITH CHECK`

This distinction is the one to get right, and it is where RLS bugs live.

| Clause | Applies to | Question it answers |
|---|---|---|
| `USING` | existing rows — `SELECT`, `UPDATE`, `DELETE` | *which rows may I see or touch?* |
| `WITH CHECK` | new or modified row values — `INSERT`, `UPDATE` | *may the result of this write exist?* |

The documentation notes that when only `USING` is given, it "implicitly provides a
`WITH CHECK` clause identical to its `USING` clause". That default is safe but
often not what you want, because the two questions genuinely differ.

The classic bug it prevents:

```sql
CREATE POLICY documents_update ON documents
  FOR UPDATE
  USING      (owner_id = current_setting('app.user_id')::uuid)   -- rows I may edit
  WITH CHECK (owner_id = current_setting('app.user_id')::uuid);  -- and may not give away
```

Without the `WITH CHECK`, a user could `UPDATE documents SET owner_id = <someone
else>` — the row passed `USING` at the moment of the update, and nothing checked
what it became. **`USING` guards the row you started with; `WITH CHECK` guards
the row you end up with.** An `UPDATE` needs both.

`INSERT` has no existing row, so it uses only `WITH CHECK`. `DELETE` produces no
new row, so it uses only `USING`.

## Permissive and restrictive

Multiple policies on one table are combined, and *how* depends on their kind:

| Kind | Combined with | Meaning |
|---|---|---|
| `PERMISSIVE` **(default)** | **OR** | each policy *grants* access; any one suffices |
| `RESTRICTIVE` | **AND** | each policy *constrains*; all must pass |

The mental model: permissive policies are ways in, restrictive policies are
conditions on every way in.

```sql
-- two ways to see a document: you own it, or it is public
CREATE POLICY doc_owner  ON documents FOR SELECT
  USING (owner_id = current_setting('app.user_id')::uuid);
CREATE POLICY doc_public ON documents FOR SELECT
  USING (is_public);

-- …but nobody, by any route, sees a soft-deleted row
CREATE POLICY doc_not_deleted ON documents AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL);
```

Effective predicate: `(owner OR is_public) AND deleted_at IS NULL`.

**A restrictive policy alone grants nothing.** With only restrictive policies, the
permissive set is empty, so the `OR` of nothing is false and the table is empty.
Restrictive policies narrow; they never open. That trips people who reach for
`RESTRICTIVE` first because it sounds more secure.

Tenant isolation is the canonical restrictive policy — it should apply
unconditionally, regardless of which permissive rule let the query in:

```sql
CREATE POLICY tenant_isolation ON documents AS RESTRICTIVE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

## Who bypasses RLS

This is the part that turns a working policy into a false sense of security. From
the documentation:

> Superusers and roles with the `BYPASSRLS` attribute always bypass the row
> security system when accessing a table. Table owners normally bypass row
> security as well.

**The table owner bypasses its own policies by default.** So if your application
connects as the role that owns the schema — which is the common lazy setup — RLS
does nothing at all, and every test you write as that role passes while proving
nothing.

Two things follow, and both are required:

```sql
-- 1. make the owner subject to policies too
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- 2. better: do not connect as the owner in the first place
```

The second is the real fix and it is
[03 · App role should not own schema](../03-app-role-not-owner.md), which exists
independently of RLS and pays off here. `FORCE ROW LEVEL SECURITY` is the safety
net for when ownership and application access have not been separated.

Verify rather than assume:

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class WHERE relname = 'documents';

SELECT * FROM pg_policies WHERE tablename = 'documents';
```

`relrowsecurity` is "RLS enabled"; `relforcerowsecurity` is "the owner is subject
to it too". A table with the first true and the second false, accessed by its
owner, is unprotected.

## Trade-off

RLS trades **flexibility and transparency for a guarantee**. The guarantee is
strong and rare: authorization that cannot be bypassed by forgetting a `WHERE`
clause, and that applies equally to your API, an admin script, a migration and a
`psql` session. For multi-tenant data that is worth a great deal, because the
failure it prevents — one tenant reading another's rows — is the failure that
ends companies.

What you pay: policies are invisible at the call site, so a query returning fewer
rows than expected has a cause that is not in the query; and the whole thing is
silently void if the connecting role owns the table or holds `BYPASSRLS`.

The deciding question is whether authorization is genuinely **data-shaped**. Row
ownership and tenant isolation are — they are properties of rows, and RLS
expresses them exactly. Rules like "editors may publish on Tuesdays" are not.

## Gotchas

**Symptom:** The table has data but every query returns zero rows
**Cause:** RLS enabled with no matching policy — documented default-deny.
**Fix:** Add a policy, or check that the session context is actually set.

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

**Symptom:** `count(*)` no longer matches the real row count
**Cause:** Correct — aggregates are filtered by policies too.
**Fix:** Use a `BYPASSRLS` role for reporting that must see everything.

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

**When is RLS the wrong tool?**
When the authorization rule is not a property of the row. Ownership and tenancy
map cleanly onto predicates; workflow rules, time-based permissions and
role-hierarchy logic usually do not, and expressing them as policies yields
something slower and harder to read than the application code it replaced.

---

← [Phase index](../README.md) · Next → [Carrying the identity](02-carrying-the-identity.md)
