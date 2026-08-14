---
title: "11.2 · Parameters in the log, and auto_explain"
sidebar_label: "02 · Parameters & auto_explain"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. **Mixed provenance, marked inline.**
> The parameter-logging and `ALTER ROLE` results are **sandbox-measured** on
> **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`), **Node 24**,
> `pg` — script `sandbox/pg-api/ex51-secrets.mjs`. Defaults and `auto_explain`
> behaviour are validated against the **PostgreSQL 18 documentation**
> ([logging](https://www.postgresql.org/docs/18/runtime-config-logging.html),
> [auto_explain](https://www.postgresql.org/docs/18/auto-explain.html)).

**Parameterised queries keep secrets out of the statement text. They do not keep
them out of the log.** That is the measured finding on this page, and it
contradicts what most developers believe about `$1`.

## The parameter trap

The reasoning that feels correct: passing values as `$1` rather than
interpolating them means the query text contains no data, so anything that
records query text records only the shape. `ex51` confirmed the first half of
that and disproved the second.

**Confirmed — `pg_stat_activity` shows only the placeholder.** A running
statement's `query` column showed `$1`, not the value. So the live view is safe.

**Disproved — the log records the values.** With `log_statement = 'all'`, the
bound parameters were written to the server log in the measured form:

```
DETAIL:  Parameters: $1 = 'PARAM_…'
```

And the setting that would truncate them is not doing so by default:
**`log_parameter_max_length` is `-1`**, documented as logging parameters **in
full**, with no length limit. Measured and confirmed against the documentation.

So the accurate statement is: **parameters protect the statement text and
`pg_stat_activity`; they do not protect the log.** If a password reset token, an
email address, a national ID or an API key is passed as `$1`, and
`log_statement = 'all'` is enabled, that value is in the log file in plaintext —
and log files are routinely shipped to third-party aggregators with far broader
access than the database itself.

One measured detail cuts the other way and is worth knowing:
**`log_parameter_max_length_on_error` is `0`**, which disables parameter logging
for *failed* statements. So an error does not, by default, log the values that
caused it. That is a sensible default and it is also why people conclude
parameters are never logged — they have only ever seen the error path.

The practical rules:

- Do not run `log_statement = 'all'` in production. `ddl` is the safe continuous
  setting ([chunk 01](01-what-to-log.md)).
- If you must, set `log_parameter_max_length` to a small value (say `0` to
  disable parameter text, or a short truncation) for the duration.
- Treat database logs as **credential-bearing** for access-control purposes:
  same handling as the database itself, not "just logs".

## `ALTER ROLE … PASSWORD` writes plaintext to the log

The second measured result in the same run, and it surprises people who assume
SCRAM protects them:

- `pg_authid` stores only a verifier — measured as `SCRAM-SHA-256$4096:…`. The
  password is genuinely not stored.
- But the **statement** `ALTER ROLE … PASSWORD 'x'` is written to the server log
  **in plaintext**, because the password is a literal in the statement text.

Storage format is not the exposure. The **statement** is. And this one does not
require `log_statement = 'all'` to be dangerous — anything that logs DDL, which
includes the recommended `log_statement = 'ddl'`, captures it.

The fix is to never send a plaintext password in a statement:

```
\password rolename
```

`psql`'s `\password` computes the SCRAM verifier **client-side** and sends only
the verifier, so no plaintext ever reaches the server or its log. This is covered
in full in [02 · Secrets](../02-secrets/README.md), which is where the rest of
the credential-leak results live.

A related measured point from the same script: `pg_stat_activity.query` shows a
running statement's **full text** to any superuser or member of
`pg_read_all_stats`. A password-bearing statement is therefore briefly visible to
your monitoring role too.

## `auto_explain`: the plan for the slow query

`log_min_duration_statement` tells you a query was slow. It does not tell you
*why*, and by the time you run `EXPLAIN` by hand the conditions that made it slow
— a cold cache, a bad plan from skewed parameters, concurrent load — are gone.

`auto_explain` logs the execution plan of statements exceeding a threshold, at
the moment they were slow.

```conf
shared_preload_libraries = 'pg_stat_statements,auto_explain'

auto_explain.log_min_duration = 3000     # ms; default -1 (disabled)
auto_explain.log_analyze      = on       # default off — real row counts
auto_explain.log_buffers      = on       # default off
auto_explain.log_format       = json     # default text
auto_explain.log_nested_statements = on  # default off — inside functions
auto_explain.sample_rate      = 0.1      # default 1 (all)
```

It can also be loaded per session with `LOAD 'auto_explain';` (superuser) or via
`session_preload_libraries`, which is the right way to try it without a restart.

### The warning that matters

`auto_explain.log_analyze` is what makes the output genuinely useful — it gives
**actual** row counts beside the estimates, which is how you find the bad
estimate causing a bad plan. It also carries a cost the documentation states in
unusually strong terms:

> When this parameter is on, per-plan-node timing occurs for **all** statements
> executed, whether or not they run long enough to actually get logged. This can
> have an **extremely negative impact on performance**.

Read that carefully: the overhead applies to **every statement**, not only the
slow ones that get logged, because PostgreSQL cannot know in advance which will
be slow. A 3000 ms threshold does not limit the cost to slow queries.

Two documented mitigations:

- **`auto_explain.log_timing = off`** (it defaults to **on**) removes the
  per-node clock reads, which is where most of the overhead lives. You lose
  per-node timings and keep the actual row counts — often the better trade,
  since bad *estimates* are the more common root cause.
- **`auto_explain.sample_rate`** (default **1**) applies the instrumentation to
  only a fraction of sessions.

The honest recommendation: `auto_explain` with `log_analyze` is an
**investigation tool**, enabled deliberately while chasing a specific problem and
turned off afterwards — not a permanent production setting. Without
`log_analyze` it is much cheaper and still shows the chosen plan, which is
sometimes enough.

## Reading the log you have collected

Three things worth extracting regularly, whatever your tooling:

**Error classes by SQLSTATE**, which is why `%e` is in the prefix from chunk 01.
`23505` unique violations rising after a deploy, `40001` serialisation failures,
`40P01` deadlocks, `53300` too-many-connections and `57014` statement timeouts
each point somewhere specific.

**Lock waits** from `log_lock_waits` — these correlate with latency spikes that
have no slow query behind them.

**Temp file lines** from `log_temp_files`, which name the statement and the size
spilled. This is the concrete evidence behind a `work_mem` change
([10 · Config](../10-config-keys/01-memory.md)).

If you are shipping logs anywhere, `log_destination = 'jsonlog'` makes all three
of these fields rather than regex captures.

## Trade-off

Logging plans and parameters trades **privacy and performance for
diagnosability**, and the two costs pull in different directions.

Parameters make the log dramatically more useful — you can reproduce the exact
slow execution — and simultaneously turn a log file into a store of user data
with weaker access controls than the database. Given that measured default of
`log_parameter_max_length = -1` (full, untruncated), the safe posture is to keep
parameter logging off in production and accept slightly harder debugging.

`auto_explain.log_analyze` trades similarly but in performance: it is the most
informative thing you can log and the documentation warns it can be *extremely*
costly, because instrumentation applies to every statement rather than only the
logged ones. Enable it to answer a question, then turn it off.

Neither is a setting to switch on permanently because it "might be useful".

## Gotchas

**Symptom:** Secrets appear in the database log despite parameterised queries
**Cause:** `log_statement = 'all'` logs bound parameters —
measured as `DETAIL: Parameters: $1 = '…'` — and
`log_parameter_max_length` defaults to `-1`, meaning **full length**.
**Fix:** Do not run `log_statement = 'all'` in production; if temporarily
necessary, set `log_parameter_max_length` low. Treat logs as credential-bearing.

**Symptom:** A password appears in plaintext in the server log
**Cause:** `ALTER ROLE … PASSWORD 'x'` puts it in the statement text; SCRAM
protects storage (`pg_authid` holds only a verifier), not the statement.
Measured.
**Fix:** Use `\password`, which computes the verifier client-side.

**Symptom:** Everything got slower after enabling `auto_explain`
**Cause:** `log_analyze` instruments **every** statement, not only those over the
threshold — documented as potentially an extremely negative performance impact.
**Fix:** Set `auto_explain.log_timing = off`, reduce `sample_rate`, or enable it
only while investigating.

**Symptom:** Parameters are logged for successful statements but not failed ones
**Cause:** Correct and documented — `log_parameter_max_length_on_error` defaults
to `0`, disabling parameter logging on errors. Measured.
**Fix:** None needed; be aware it is why parameter logging is often overlooked.

**Symptom:** `auto_explain` settings have no effect
**Cause:** The module is not loaded — it needs `shared_preload_libraries` (a
restart), `session_preload_libraries`, or `LOAD` in the session.
**Fix:** Load it; try `LOAD 'auto_explain'` in one session first.

**Symptom:** Plans logged but the row counts are only estimates
**Cause:** `auto_explain.log_analyze` defaults to **off**.
**Fix:** Turn it on while investigating — and read the overhead warning first.

## Interview questions

**★ Do parameterised queries keep secrets out of the logs?**
No. Measured: parameters keep values out of the *statement text* and out of
`pg_stat_activity` (which showed `$1`), but with `log_statement = 'all'` the
bound values are written to the server log as
`DETAIL: Parameters: $1 = '…'`, and `log_parameter_max_length` defaults to `-1`
— full length, untruncated. Database logs should be treated as
credential-bearing.

**★ Why should you never run `ALTER ROLE … PASSWORD 'literal'`?**
Because the statement text — including the plaintext password — is written to the
server log, even though `pg_authid` stores only a SCRAM verifier. Measured.
`\password` computes the verifier client-side so no plaintext reaches the server.
Storage format is not the exposure; the statement is.

**★ What is `auto_explain` and what is the catch?**
It logs execution plans for statements over a duration threshold, capturing the
plan at the moment the query was actually slow. The catch is
`auto_explain.log_analyze`: per-node instrumentation applies to **every**
statement, not just the logged ones, which the docs warn can be extremely costly.
Mitigate with `log_timing = off` or `sample_rate`, and prefer enabling it only
during an investigation.

**★ You have a slow query in the log but cannot reproduce it. What now?**
`auto_explain` with `log_analyze`, enabled temporarily, to capture the plan and
actual row counts under real conditions. The usual cause of a query that is
sometimes slow is a plan chosen from skewed parameters or a bad estimate, and
neither is visible from the duration alone or from running `EXPLAIN` later on an
idle system.

**Why does `log_parameter_max_length_on_error` default to 0?**
So that failed statements do not log their parameter values by default — a
sensible privacy default, and the reason many developers have never seen
parameters in a log and conclude they are never recorded.

**What is the safe continuous value of `log_statement` in production?**
`ddl`. Schema changes are rare, and knowing exactly when one happened is valuable
during an incident. `all` risks filling the disk and logs parameter values;
`mod` sits between the two and is rarely worth its volume.

---

← [What to log](01-what-to-log.md) · Next → [Zero-downtime schema changes](../12-zero-downtime-ddl/README.md)
