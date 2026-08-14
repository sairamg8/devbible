---
title: "14.3 · Performance, testing and practice"
sidebar_label: "03 · Performance & practice"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [row security policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),
> [`CREATE POLICY`](https://www.postgresql.org/docs/18/sql-createpolicy.html),
> [function volatility](https://www.postgresql.org/docs/18/xfunc-volatility.html).
> **Not sandbox-measured** — no console output on this page, and **no timing
> claim here is presented as measured**. Where the effect of a technique on plans
> depends on your data, this page says so rather than inventing a number.

**A policy is a predicate silently added to every query against the table.**
Everything about RLS performance follows from that, and so does the main
practical difficulty: the predicate is invisible at the call site.

## Policies are predicates, so index them

```sql
CREATE POLICY tenant_isolation ON documents AS RESTRICTIVE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Every `SELECT`, `UPDATE` and `DELETE` on `documents` now carries
`tenant_id = …`. If `tenant_id` is not indexed, every one of those queries has
gained a filter it cannot use an index for.

The consequence is straightforward and worth stating plainly: **the columns your
policies reference should be indexed, and usually as the leading column of
composite indexes.** A tenant-scoped table wants indexes shaped
`(tenant_id, …)` rather than `(…)`, because in practice *every* query is
tenant-scoped whether or not the application wrote it that way.

Confirm with `EXPLAIN (ANALYZE, BUFFERS)`, which shows the policy predicate in
the plan. That is also the quickest way to see that RLS is active at all —
Phase 10 owns the reading of those plans.

## `current_setting()` and how often it is evaluated

`current_setting()` is **stable**, not immutable: its value can change between
statements but not within one. That is the correct volatility, and it means
PostgreSQL is entitled to evaluate it once per statement rather than per row.

There is a widely used formulation that makes the intent explicit by wrapping the
call in a scalar subquery:

```sql
-- commonly recommended (this is the form Supabase's guidance uses)
USING (tenant_id = (SELECT current_setting('app.tenant_id')::uuid))
```

The reasoning is that a scalar subquery with no correlation is evaluated once and
its result reused, rather than the expression being re-evaluated as part of the
per-row filter. **Whether this changes the plan for your query and your data is
something to verify with `EXPLAIN (ANALYZE, BUFFERS)` rather than assume** — this
page has not measured it, and the effect depends on the plan shape. It is
harmless, so it is a reasonable default; treat claims about its magnitude
sceptically unless you have measured them on your own workload.

The related pattern — wrapping the lookup in a function — deserves a caution:

```sql
CREATE FUNCTION current_tenant() RETURNS uuid
  LANGUAGE sql STABLE
AS $$ SELECT current_setting('app.tenant_id', true)::uuid $$;
```

Marking it `STABLE` is correct and important. A function left at the default
`VOLATILE` cannot be optimised away and may be evaluated per row; marking it
`IMMUTABLE` would be **wrong**, since the value genuinely changes between
transactions, and lying about volatility can produce cached results that are
silently incorrect. This is the same volatility trap that Phase 12 hit with
expression indexes (`42P17`), arriving from a different direction.

## The leakproofness caveat

RLS is a strong guarantee about *rows returned*. It is a weaker guarantee about
*information inferable*.

The mechanism: a query has both the policy predicate and the user's own `WHERE`
conditions, and the planner may order them. If a non-leakproof function in the
user's condition runs against a row that the policy would have excluded, its
behaviour — an error message, a timing difference — can reveal something about
that row. PostgreSQL restricts this: functions known to be **leakproof** may be
pushed below the security barrier, and others may not.

For practical purposes:

- You do not usually need to do anything about it; PostgreSQL's default handling
  is conservative.
- Be aware that a **`SECURITY DEFINER`** function called from a policy runs with
  the definer's privileges, which can defeat the whole arrangement if written
  carelessly.
- If you are building something where inference is part of the threat model, read
  the documentation on `security_barrier` views and leakproofness properly rather
  than relying on a summary — including this one.

That is an honest limit of this page: RLS's row filtering is solid, and the
side-channel surface is subtle enough that a short treatment would mislead.

## Testing RLS

Untested policies are the norm and they are dangerous, because the failure mode
is silent over-exposure rather than an error. Two things make tests real:

**Test as the actual application role, not as the owner.** A test run as the
table owner passes regardless of what the policies say — owners bypass RLS unless
`FORCE ROW LEVEL SECURITY` is set. This is the single most common reason RLS
tests prove nothing.

```sql
BEGIN;
SET LOCAL ROLE app_user;                       -- not the owner
SELECT set_config('app.tenant_id', 'tenant-a', true);

-- must return only tenant-a rows
SELECT count(*) FROM documents;

-- must return zero, not error
SELECT count(*) FROM documents WHERE tenant_id = 'tenant-b';
ROLLBACK;
```

**Test the negative cases explicitly**, because they are the ones that matter:

| Test | Expectation |
|---|---|
| Read another tenant's rows | **0 rows** |
| `INSERT` a row with another tenant's id | rejected by `WITH CHECK` |
| `UPDATE` a row to another tenant's id | rejected by `WITH CHECK` |
| Query with **no** setting configured | 0 rows, or a clear error |
| `count(*)` on the whole table | only your rows counted |

That last row is worth its place: aggregates go through policies too, so a
tenant's `count(*)` is scoped. Any test asserting a global total will fail once
RLS is on, and that failure is correct.

Phase 9's rollback-per-test pattern applies directly — each test sets its context
inside a transaction and rolls back, so no state leaks between tests.

## Jobs, migrations and admin access

Not everything should be filtered. Background jobs, migrations, analytics and
support tooling frequently need to see everything, and the way to arrange that is
explicitly rather than by accident:

```sql
CREATE ROLE batch_worker LOGIN BYPASSRLS;
```

`BYPASSRLS` is a role attribute that skips policies entirely. Granting it
deliberately to a job role is far better than the common alternative — running
jobs as the table owner, which bypasses RLS *implicitly* and makes it impossible
to tell from the code which access is meant to be unrestricted.

The rule: **exactly one role in your system should be unfiltered, it should be
named for that purpose, and the application must not use it.**

## Where this really matters: Supabase and multi-tenancy

On Supabase, clients talk to the database (via PostgREST) carrying the end user's
identity, and RLS policies are what stop one user reading another's rows. There
is no server-side application layer in between to add a `WHERE` clause. That
makes RLS not a defence-in-depth measure but **the** authorization mechanism, and
it promotes everything on these two pages from "good to know" to load-bearing —
particularly the `SET LOCAL` rule, since a leaked setting there is a
cross-account data exposure.

For self-built multi-tenant systems the calculus is different but the conclusion
is similar: RLS as a **backstop** beneath application-level filtering is
excellent, because it converts "someone forgot a `WHERE tenant_id`" from a data
breach into an empty result. The multi-tenancy decision as a whole — shared
schema, schema-per-tenant, or database-per-tenant — is
[Phase 3 · Multi-tenancy](../../phase-3-ddl/20-multi-tenancy/README.md).

## Trade-off

RLS trades **query performance and debuggability for a guarantee that cannot be
forgotten**. The performance cost is a predicate on every query, which is
manageable if the policy columns are indexed and can be significant if they are
not. The debuggability cost is subtler and, in practice, larger: a query returns
fewer rows than expected and the reason is in a policy, in a session setting, and
in the role you connected as — none of which appear in the query.

Against that, the guarantee is genuinely difficult to obtain any other way. A
`WHERE tenant_id = $1` in every query is only as good as the least careful query
anyone ever writes, and it protects nothing when someone runs `psql` against
production. RLS holds for all of it.

The balanced position, and the one worth defending: **filter in the application
because it is clear and fast, and enable RLS underneath because people are
fallible.** Paying for both is usually right for multi-tenant data, and usually
unnecessary for data that is not.

## Gotchas

**Symptom:** Every query on a table got slower after enabling RLS
**Cause:** The policy predicate is added to every query and the column it
references is not usefully indexed.
**Fix:** Index policy columns, typically as the leading column of composite
indexes. Confirm with `EXPLAIN (ANALYZE, BUFFERS)`.

**Symptom:** RLS tests pass but production leaks data
**Cause:** The tests ran as the table owner, which bypasses RLS.
**Fix:** Test as the real application role with `SET LOCAL ROLE`, and set
`FORCE ROW LEVEL SECURITY`.

**Symptom:** A helper function in a policy behaves inconsistently
**Cause:** Wrong volatility — `VOLATILE` prevents optimisation; `IMMUTABLE` is a
lie about a value that changes per transaction and can yield stale results.
**Fix:** Mark such functions `STABLE`.

**Symptom:** `count(*)` no longer matches the real row count
**Cause:** Correct — aggregates are filtered by policies too.
**Fix:** Use a `BYPASSRLS` role for reporting that must see everything.

**Symptom:** A background job stopped seeing rows
**Cause:** It was relying on running as the table owner, and
`FORCE ROW LEVEL SECURITY` was added.
**Fix:** Give the job a dedicated `BYPASSRLS` role, so unrestricted access is
explicit rather than incidental.

**Symptom:** A `SECURITY DEFINER` function appears to bypass policies
**Cause:** It runs with the definer's privileges, which may include ownership or
`BYPASSRLS`.
**Fix:** Audit `SECURITY DEFINER` functions on RLS-protected tables; they are an
intentional hole and must be written as one.

## Interview questions

**★ What is the performance cost of RLS?**
Every policy becomes a predicate on every query against the table, so the cost is
the cost of that predicate. If the policy references an unindexed column, queries
that were index scans can become filtered scans. The mitigation is to index
policy columns — for a tenant-scoped table, `tenant_id` as the leading column of
composite indexes, since in effect every query is tenant-scoped.

**★ How do you test row-level security properly?**
As the actual application role, never as the table owner — owners bypass RLS, so
owner-run tests pass regardless of the policies. Set the session context with
`set_config(..., true)` inside a transaction, and assert the **negative** cases:
another tenant's rows return zero, cross-tenant `INSERT` and `UPDATE` are
rejected by `WITH CHECK`, and a missing context yields no rows.

**★ How do background jobs see all rows under RLS?**
Give them a role with the `BYPASSRLS` attribute. The important part is that it is
*explicit* — the common alternative, running jobs as the table owner, bypasses
policies implicitly and makes unrestricted access indistinguishable from an
oversight in the code.

**★ Should RLS replace application-level authorization?**
Usually it should sit underneath it. Filtering in the application is clearer and
faster; RLS underneath converts a forgotten `WHERE tenant_id` from a data breach
into an empty result, and it also covers `psql` sessions, migrations and scripts
that the application layer never sees. On platforms like Supabase, where clients
reach the database directly, RLS is not a backstop — it is the whole mechanism.

**Why must a helper function used in a policy be `STABLE` rather than `IMMUTABLE`?**
Because its value legitimately changes between transactions — it reads session
state. `IMMUTABLE` asserts the result depends only on the arguments, which lets
PostgreSQL cache or fold it, producing silently wrong results. `STABLE` says
"constant within a statement", which is both true and enough to avoid per-row
re-evaluation.

**What is the limit of RLS as a security guarantee?**
It reliably controls which rows are *returned*. It is a weaker guarantee against
*inference* — the planner can order conditions, and a non-leakproof function in a
user's own predicate could in principle reveal something about excluded rows.
PostgreSQL is conservative here by default, and `SECURITY DEFINER` functions are
the more common practical hole.

---

← [Carrying the identity](02-carrying-the-identity.md) · Next → [Physical backup and PITR](../15-physical-backup/README.md)
