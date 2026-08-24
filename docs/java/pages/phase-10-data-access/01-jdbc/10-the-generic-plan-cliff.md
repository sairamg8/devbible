---
title: "Fast five times, then slow forever: the generic plan nobody deployed"
sidebar_label: "10 · The generic plan cliff"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the PostgreSQL 18 manual *PREPARE* — Notes, and
> *Server Configuration → Query Planning → `plan_cache_mode`*
> (postgresql.org/docs/18/sql-prepare.html,
> .../runtime-config-query.html), and the pgJDBC documentation *Server Prepared
> Statements* and *Connection Parameters*
> (jdbc.postgresql.org/documentation/server-prepare/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**This is the JDBC failure that looks least like a JDBC failure. A query runs
fast. It keeps running fast. Then, without a deploy, without a schema change and
without the data changing shape, it becomes an order of magnitude slower — and
running it by hand in a console shows it is still fast, because your console
session has its own execution history. What happened is that PostgreSQL replaced
the plan it was building per execution with one generic plan built without
knowledge of your parameter values, and for a predicate whose selectivity varies
wildly by value that generic plan can be catastrophically wrong. The behaviour is
documented, deliberate and usually correct; it is the skewed case that hurts, and
knowing the two counters that lead to it is the difference between a five-minute
fix and a week of blaming the network.**

## What the documentation says, exactly

PostgreSQL's `PREPARE` documentation defines the two plan kinds:

> A prepared statement can be executed with either a *generic plan* or a *custom
> plan*. A generic plan is the same across all executions, while a custom plan is
> generated for a specific execution using the parameter values given in that
> call. Use of a generic plan avoids planning overhead, but in some situations a
> custom plan will be much more efficient to execute because the planner can make
> use of knowledge of the parameter values. (Of course, if the prepared statement
> has no parameters, then this is moot and a generic plan is always used.)

and the heuristic:

> By default (that is, when `plan_cache_mode` is set to `auto`), the server will
> automatically choose whether to use a generic or custom plan for a prepared
> statement that has parameters. The current rule for this is that the first five
> executions are done with custom plans and the average estimated cost of those
> plans is calculated. Then a generic plan is created and its estimated cost is
> compared to the average custom-plan cost. Subsequent executions use the generic
> plan if its cost is not so much higher than the average custom-plan cost as to
> make repeated replanning seem preferable.

🔴 **There are two independent five-counters and people conflate them.** pgJDBC
counts five executions before it creates a *named* server-side statement
([chunk 9](09-server-side-prepared-statements.md)); PostgreSQL then counts five
executions *of that named statement* with custom plans before a generic plan is
even a candidate. They compound: on default settings a statement can run roughly
ten times on a connection before anything changes.

⚠️ **Note the comparison the server makes: estimated cost against estimated
cost.** If the generic plan's *estimate* is close to the custom plans' average
estimate, the generic plan is adopted — regardless of what it actually costs to
run. A generic plan whose estimate is badly wrong is exactly the case that gets
adopted and then hurts, and the documentation says as much when it describes the
override as being "primarily useful if the generic plan's cost estimate is badly
off for some reason".

## The pathological case, concretely

Take `WHERE status = ?` on an orders table where 99.9% of rows are `'completed'`
and a few hundred are `'pending'`.

| Plan | For `'pending'` | For `'completed'` |
|---|---|---|
| custom, planned with the value | index scan on `(status)` — the planner knows from statistics that the value is rare | sequential scan, correctly |
| **generic** | plans for *average* selectivity across values, which the statistics say is "most rows" → **sequential scan** | sequential scan, correctly |

So the dashboard query that polls for pending orders twice a second — the one
that was an index scan — becomes a full table scan, forever, on that connection.

**The shape of the incident:**

- fine for the first several executions of each connection, then permanently slow;
- **not reproducible in a console**, because a fresh session starts its counters
  at zero and you will see the custom plan;
- **intermittent across the fleet**, because each pooled connection crosses the
  threshold at its own pace and `maxLifetime` resets them;
- no deploy, no migration, no data change to correlate against.

That combination — irreproducible, intermittent, uncorrelated — is why this one
eats days.

⚠️ The same shape appears with a soft-delete flag, a boolean `is_active`, a tenant
id in a wildly uneven multi-tenant table, and any `WHERE type = ?` over an
enum-like column. The common factor is **selectivity that depends on the value**.

## The fixes, in order of preference

**1 — Force custom plans for the transaction that needs them.** The documentation
gives the override:

> This heuristic can be overridden, forcing the server to use either generic or
> custom plans, by setting `plan_cache_mode` to `force_generic_plan` or
> `force_custom_plan` respectively.

```java
try (Connection c = ds.getConnection()) {
    c.setAutoCommit(false);
    try (Statement st = c.createStatement()) {
        st.execute("SET LOCAL plan_cache_mode = force_custom_plan");
    }
    // the skewed query, planned per execution
    ...
    c.commit();
}
```

`SET LOCAL` scopes it to the transaction, so it is undone at commit and cannot
leak to the next borrower of a pooled connection — which is exactly the discipline
[chunk 4](04-connection-is-expensive.md) argues for. Setting it via the URL's
`options` property ([chunk 3](03-the-jdbc-url.md)) is right only when the whole
connection serves that workload.

**2 — Disable server-side preparation for that one statement.**

```java
PreparedStatement ps = c.prepareStatement(sql);
ps.unwrap(org.postgresql.PGStatement.class).setPrepareThreshold(0);
```

No named statement, so no generic plan, so per-execution planning forever. Blunter
than `force_custom_plan` and perfectly reasonable for a query you know is skewed.

**3 — Change the query so selectivity stops varying.** A partial index on the rare
value (`CREATE INDEX ... WHERE status = 'pending'`) plus a query that names the
constant is a different statement with a stable plan. This is the most work and
the most durable.

⛔ **What you must not do: concatenate the value into the SQL "to help the
planner".** It works, which is what makes it tempting, and it reintroduces the
entire injection surface of [chunk 5](05-preparedstatement-and-injection.md) to
solve a problem that has three clean solutions above.

## `preferQueryMode`, and the pooler that made people find it

pgJDBC's documented modes are `simple`, `extended` (the default),
`extendedForPrepared` and `extendedCacheEverything`.

| Mode | Behaviour | When it is the answer |
|---|---|---|
| `extended` | default: unnamed then named statements | almost always |
| `extendedForPrepared` | extended protocol only for `PreparedStatement` | narrow |
| `extendedCacheEverything` | caches everything, including `Statement` | narrow |
| **`simple`** | one Query message per statement; **no bind step at the protocol level** | multi-statement scripts; historically, in front of a transaction-mode pooler |

🔴 **`simple` mode has a security implication that deserves its own sentence.**
With no Bind step, the driver has to place values into the SQL text itself before
sending it. pgJDBC does that quoting and does it carefully — but the protection
becomes *the driver's escaping* rather than the protocol separation that
[chunk 5](05-preparedstatement-and-injection.md) argues is what makes
parameterization total. The guarantee is weaker in kind. That is worth knowing
before you set the property because a forum answer said it fixes PgBouncer.

⚠️ **The PgBouncer interaction is why most people meet this setting.** A pooler in
**transaction mode** multiplexes many clients over fewer server connections, so a
named statement prepared on one server connection is not there when your next
transaction lands on another; historically that produced errors about a prepared
statement not existing. Newer PgBouncer versions added tracking of prepared
statements, which changes the answer — ⚠️ **I could not verify the exact version
and configuration required from PgBouncer's own documentation**, so confirm it
against your pooler's release notes rather than treating "use simple mode" as
current advice. In **session mode** the problem does not arise at all.

## The trade-off

Forcing custom plans buys plan quality with planning time on every execution. For
a statement executed thousands of times per second, that planning cost is real —
it is CPU on the database, which is usually the scarcest resource you have. So
`force_custom_plan` is a targeted instrument, applied to the statements whose
selectivity varies, not a global setting. Setting it session-wide because one
query was slow is the mirror-image mistake to the one this chunk is about: you
have traded a rare catastrophic plan for a constant tax on everything else.

## Gotchas

**⚠️ A query that is fast for the first several calls and slow thereafter**
**Symptom:** latency that steps up after a handful of executions per connection,
recovers when the pool cycles, and cannot be reproduced by running the query once
in a console.
**Cause:** the switch to a named statement and then to a generic plan.
**Fix:** `SET LOCAL plan_cache_mode = force_custom_plan` for that transaction, or
`prepareThreshold=0` for that statement.

**⚠️ Trying to reproduce it in psql and concluding the query is fine**
**Symptom:** "it runs in 3ms, the application must be doing something else".
**Cause:** a new session starts the counters at zero, so you are looking at a
custom plan the application stopped using.
**Fix:** reproduce with `PREPARE` and six `EXECUTE`s in one session, or set
`plan_cache_mode = force_generic_plan` and look at the plan you actually get.

**⚠️ Reaching for `preferQueryMode=simple` on a stale internet answer**
**Symptom:** a real pooler error is fixed, and the parameterization guarantee
quietly weakens for the whole application.
**Cause:** simple mode has no Bind step, so values are interpolated into the SQL
by the driver.
**Fix:** check whether your pooler tracks prepared statements, or use session-mode
pooling, before changing the protocol mode application-wide.

**⚠️ Concatenating a value that could have been a parameter, "to help the
planner"**
**Symptom:** an injection risk introduced deliberately, usually with a comment
explaining that it makes the query faster.
**Cause:** someone met the generic plan and fixed it the wrong way.
**Fix:** `force_custom_plan` or `prepareThreshold=0`. Both give per-value planning
without putting the value in the SQL text.

**⚠️ `force_custom_plan` set globally**
**Symptom:** database CPU up across the board after a fix for one slow query.
**Cause:** every prepared statement now re-plans on every execution.
**Fix:** `SET LOCAL` inside the transaction that needs it, or the URL `options`
property on a connection dedicated to that workload.

**⚠️ Assuming the server compares *actual* costs**
**Symptom:** a generic plan adopted even though it is obviously worse.
**Cause:** the comparison is between the generic plan's *estimate* and the custom
plans' average *estimate*. A badly wrong estimate is exactly what gets adopted.
**Fix:** treat bad estimates as the root cause — better statistics, an extended
statistics object, or forcing custom plans for that statement.

## Interview questions

**★ Why might a query get slower after several executions, with no deploy?**
Because two caches engage in sequence. pgJDBC switches to a named server-side
prepared statement after `prepareThreshold` executions, default five. PostgreSQL
then runs the first five executions of that named statement with custom plans,
averages their estimated cost, builds a generic plan, and adopts the generic plan
if its estimated cost is not much higher. A generic plan is built without any
knowledge of the parameter values, so for a predicate whose selectivity depends on
the value — a status column where one value matches almost every row and another
matches a few hundred — it can choose a sequential scan where the custom plan used
an index. The result is a query that is fast for the first several calls on each
connection and slow afterwards.

**★ How would you fix that, and what would you refuse to do?**
The targeted fix is `SET LOCAL plan_cache_mode = force_custom_plan` inside the
transaction running the skewed statement, which tells PostgreSQL to plan per
execution for that statement only and is undone at commit so it cannot leak to the
next borrower of a pooled connection. Alternatively set `prepareThreshold=0` on
that `PreparedStatement`, so no named statement is ever created and the question
never arises. The durable fix is to make the selectivity stop varying — a partial
index on the rare value, with a query that names the constant. What I would refuse
is concatenating the value into the SQL to give the planner a literal: it works,
which is why people do it, and it reintroduces the entire injection surface to
solve a planning problem that has three clean solutions.

**★ Why can't you reproduce this in psql?**
Because the behaviour is a property of the session's execution history, and a
fresh psql session starts with none. You run the query, you get a custom plan
built with your parameter, and it is fast — which tells you nothing about what the
application's long-lived pooled connection is doing on its fiftieth execution. To
reproduce it you have to recreate the history: `PREPARE` the statement, `EXECUTE`
it six or more times, and look at the plan; or set `plan_cache_mode =
force_generic_plan` in the session and inspect the plan directly. Not knowing this
is why the investigation usually goes to the network first.

**★ What does `preferQueryMode=simple` change, and what does it cost?**
It makes the driver use PostgreSQL's simple query protocol, which has no Bind step
— so there is no protocol-level parameter binding, and pgJDBC interpolates the
values into the SQL text with its own quoting. That is a weaker guarantee in kind
than the extended protocol's separation of parsing from values, even though the
driver's quoting is careful, and it is worth knowing because the setting
circulates as a fix for connection-pooler problems. It also disables server-side
prepared statements entirely. If the underlying problem is a transaction-mode
pooler, the better answers are session-mode pooling or a pooler version that
tracks prepared statements.

**★ The server compares the generic plan's cost with the average custom plan's
cost. Why isn't that enough?**
Because both sides of that comparison are *estimates*, not measurements. If the
planner's estimate for the generic plan is badly wrong — which is exactly what
happens when a column's distribution is skewed and the average selectivity is
meaningless — then the comparison says the generic plan is competitive and the
server adopts it, and the plan that actually runs is far more expensive than the
number that justified it. PostgreSQL's own documentation acknowledges this when it
describes the override as being useful when "the generic plan's cost estimate is
badly off for some reason". It is a reminder that the deeper fix is usually better
statistics, and `force_custom_plan` is the workaround while you get them.

---

← Prev: [9 · Server-side prepared statements](09-server-side-prepared-statements.md) · Index: [JDBC](README.md) · Next → [11 · The three statement types](11-statement-types.md)
