---
title: "11.1 · What to log, and what it costs"
sidebar_label: "01 · What to log"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [error reporting and logging](https://www.postgresql.org/docs/18/runtime-config-logging.html).
> **Not sandbox-measured** — no console output on this page. The measured
> logging results (parameters, `ALTER ROLE` plaintext) are in
> [chunk 02](02-parameters-and-auto-explain.md), from
> `sandbox/pg-api/ex51-secrets.mjs`.

**PostgreSQL logs almost nothing useful by default.** `log_min_duration_statement`
is `-1`, `log_statement` is `none`, `log_lock_waits` is `off`,
`log_temp_files` is `-1`. A default installation will not tell you that a query
took nine seconds, that a session waited on a lock, or that a sort spilled to
disk. Every one of those is a one-line change.

## The setting that matters most

```conf
log_min_duration_statement = 1000    # ms; log any statement slower than 1s
```

Default **-1** (disabled). Set to a duration and every statement taking at least
that long is logged with its text and its actual duration. `0` logs everything,
which is a useful thing to do for ten minutes and a bad thing to leave on.

This is the third leg of the monitoring stool from
[09 · Monitoring](../09-monitoring/README.md), and it answers a question neither
of the others can:

| Tool | Answers | Blind to |
|---|---|---|
| `pg_stat_activity` | what is running **now** | anything that already finished |
| `pg_stat_statements` | what costs most **in aggregate** | which individual execution was slow |
| **slow-query log** | **which specific statements were slow, and when** | the cheap query run a million times |

The distinction between the second and third rows is the practically important
one. `pg_stat_statements` will tell you a query's mean is 4 ms; the log will tell
you that at 03:14 one execution of it took 30 seconds. Those are different
investigations, and an incident usually needs the second.

### Choosing the threshold

Start high and lower it. A threshold that logs 5% of your traffic is a threshold
that will fill a disk and, worse, make the log unreadable. Reasonable starting
points: **1000 ms** for a web application, **200 ms** if latency is a product
concern and volume is moderate.

If even that is too much volume, PG has a sampling pair built for exactly this:

```conf
log_min_duration_sample  = 100     # consider statements slower than 100ms
log_statement_sample_rate = 0.01   # …and log 1% of them
```

`log_min_duration_sample` defaults to `-1` and `log_statement_sample_rate` to
`1.0`. Together they let you see the shape of the 100 ms–1 s band without logging
all of it. Statements over `log_min_duration_statement` are still logged
unconditionally, so the pattern is "log everything genuinely slow, sample the
merely slow".

## A prefix that makes the log usable

The default `log_line_prefix` is `'%m [%p] '` — timestamp and process ID. That is
not enough to act on: you get a slow query with no idea which user, database or
service produced it.

```conf
log_line_prefix = '%m [%p] %u@%d %a %e '
```

| Escape | Meaning |
|---|---|
| `%m` | timestamp **with milliseconds** |
| `%p` | process ID — ties log lines to a `pg_stat_activity` row |
| `%u` | user name |
| `%d` | database name |
| `%a` | **application name** |
| `%e` | SQLSTATE |

**`%a` is the highest-value addition**, and it only works if your services
actually set `application_name` in their connection strings
(`?application_name=orders-api`). Doing so turns "some query was slow" into
"the orders API had a slow query", which is the difference between a log you
search and a log you act on. The same argument applies to
`pg_stat_activity` in [09 · Monitoring](../09-monitoring/01-whats-happening-now.md)
— set it once, benefit in both places.

`%e` (SQLSTATE) is what lets you count error classes — `23505` unique violations,
`40001` serialisation failures, `40P01` deadlocks — instead of grepping English
error text that changes between versions.

If you ship logs to syslog, omit `%m` and `%p`: syslog adds its own timestamp and
PID, and duplicating them just makes lines longer.

## The settings worth turning on

```conf
log_min_duration_statement = 1000
log_line_prefix       = '%m [%p] %u@%d %a %e '
log_lock_waits        = on        # default off
log_temp_files        = 0         # default -1; 0 = log every spill
log_checkpoints       = on        # already on by default in modern PG
log_autovacuum_min_duration = 0   # default 10min
log_connections       = 'all'     # default '' — see the caution below
log_disconnections    = on        # default off
```

Why each earns its place:

**`log_lock_waits`** (default **off**) logs a session that waited longer than
`deadlock_timeout` for a lock, including what it was waiting for. This is the
single best diagnostic for "the application froze for ten seconds and then
recovered" — an event that leaves no trace anywhere else once it is over. Turn it
on.

**`log_temp_files = 0`** (default **-1**) logs every temporary file created,
which means every sort or hash that exceeded `work_mem`. It gives you the
specific statements behind the rising `temp_bytes` from
[09 · Monitoring](../09-monitoring/05-database-health.md), which is what
you need before changing `work_mem`
([10 · Config](../10-config-keys/01-memory.md)).

**`log_autovacuum_min_duration = 0`** (default **10min**) logs every autovacuum
rather than only long ones. The output shows pages removed, tuples remaining and
elapsed time — the evidence for whether autovacuum is keeping up, and cheap
because autovacuum is not high-frequency.

**`log_checkpoints`** is **on** by default in modern PostgreSQL. Checkpoints
logged as "too frequent" is the direct signal for the `max_wal_size` problem in
[10 · Config](../10-config-keys/02-planner-wal-and-changing.md).

**`log_connections` / `log_disconnections`** are useful for connection-churn
problems and for audit, and they are also the highest-volume settings here — on a
system without a pooler, a connect-per-request pattern produces two log lines per
request. Turn them on when investigating churn; think before leaving them on.

## What *not* to turn on

**`log_statement = 'all'`.** It logs every statement regardless of duration, and
it is the most common way to destroy a production system's disk and its log
signal at once. Its legitimate values:

| Value | Logs |
|---|---|
| `none` **(default)** | nothing |
| `ddl` | `CREATE`, `ALTER`, `DROP` — **a reasonable production choice** |
| `mod` | DDL plus `INSERT`/`UPDATE`/`DELETE` |
| `all` | everything |

`ddl` is genuinely worth considering: schema changes are rare, and knowing
exactly when one happened is valuable during an incident. `all` belongs in
development, or in production for a few minutes with a plan to turn it off.

There is a second, sharper reason to avoid `log_statement = 'all'` that has
nothing to do with volume: **it logs bound parameter values**, which is measured
and explained in [chunk 02](02-parameters-and-auto-explain.md). Statements you
believed were safe because they use `$1` placeholders are not safe from the log.

## Where the log goes

```conf
logging_collector = on
log_destination   = 'stderr'      # or 'csvlog', 'jsonlog', 'syslog'
log_directory     = 'log'
log_filename      = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age  = '1d'
log_rotation_size = '100MB'
```

`log_destination` defaults to `stderr`, and `logging_collector` must be enabled
for PostgreSQL to capture that into rotating files. Without the collector,
stderr goes wherever the process's stderr goes — which in a container is the
container log, and that is often exactly what you want.

**`jsonlog` is worth knowing about.** It emits structured JSON per line, which
any log aggregator can parse without a fragile regex over `log_line_prefix`. If
you are shipping logs anywhere central, prefer it to inventing a parser.

`log_rotation_size` and `log_rotation_age` bound disk usage — and note that
PostgreSQL's own rotation *overwrites* on filename collision rather than growing
forever, so a filename pattern without enough granularity can silently lose
history.

## Trade-off

Logging trades **disk, I/O and signal-to-noise for retrospective visibility.**
The cost is real but is usually overestimated for duration-triggered logging: a
1-second threshold on a healthy system logs very few lines, and the write happens
after a query that already took a second.

The genuine risk is the failure mode where logging makes an incident worse.
`log_statement = 'all'` under load can fill a disk — and a full disk is a
PostgreSQL outage with no graceful degradation. That asymmetry is the argument
for duration thresholds and sampling over blanket logging: you want the log to be
most detailed about the rare slow thing and nearly silent about the common fast
thing.

The opposite failure is more common though, and cheaper to fix: **defaults that
log nothing**, so a problem that has already ended cannot be investigated at all.
Between the two, err toward turning on `log_min_duration_statement`,
`log_lock_waits` and `log_temp_files` — none of them are high volume on a healthy
system, and each answers a question nothing else can.

## Gotchas

**Symptom:** Nothing useful in the log after a slow-query incident
**Cause:** `log_min_duration_statement` defaults to `-1` — disabled.
**Fix:** Set it to 1000 ms and add `log_lock_waits = on`. Do this before you need
it; it is a reload, not a restart.

**Symptom:** The log shows slow queries but not who ran them
**Cause:** Default `log_line_prefix` is only `'%m [%p] '`.
**Fix:** Add `%u@%d %a %e`, and set `application_name` per service so `%a` is
meaningful.

**Symptom:** The disk filled and the database went down
**Cause:** Almost always `log_statement = 'all'` or a 0 ms duration threshold
left on.
**Fix:** Use duration thresholds and sampling. Cap with `log_rotation_size`, and
alert on disk before it matters.

**Symptom:** "The app froze for ten seconds" with nothing in any view
**Cause:** A lock wait that has since resolved — invisible to `pg_stat_activity`
after the fact.
**Fix:** `log_lock_waits = on`, which records waits exceeding `deadlock_timeout`
along with the blocking detail.

**Symptom:** `logging_collector` is on but no files appear
**Cause:** It requires a **restart**, and `log_directory` is relative to the data
directory.
**Fix:** Restart, and check `pg_settings.pending_restart`.

**Symptom:** Log parsing breaks whenever the prefix changes
**Cause:** Regex over a human-formatted prefix.
**Fix:** `log_destination = 'jsonlog'` and let the aggregator parse structured
fields.

## Interview questions

**★ What does PostgreSQL log by default, and what would you change?**
Very little: `log_min_duration_statement` is `-1`, `log_statement` is `none`,
`log_lock_waits` and `log_temp_files` are off. The high-value changes are
`log_min_duration_statement = 1000`, `log_lock_waits = on`, `log_temp_files = 0`,
and a `log_line_prefix` including user, database, application name and SQLSTATE.
All are reloads.

**★ How does the slow-query log differ from `pg_stat_statements`?**
`pg_stat_statements` aggregates by normalised query and tells you what costs the
most in total; it cannot tell you that one particular execution at 03:14 took 30
seconds. The log records individual statements over a threshold with their
timing. The aggregate view misses individual outliers; the log misses the cheap
query executed a million times. Production wants both.

**★ Why is `log_statement = 'all'` dangerous in production?**
Volume — it can fill the disk, and a full disk is an outage — and it destroys
signal by burying rare important lines. It also logs **bound parameter values**,
so parameterised queries stop protecting secrets from the log.
`log_statement = 'ddl'` is the version worth running continuously.

**★ Which single logging setting best explains an unexplained freeze?**
`log_lock_waits = on`. A session that waited on a lock and then proceeded leaves
no trace in `pg_stat_activity` once it is over; this setting records the wait and
what was blocking it.

**What is `log_line_prefix` and what should be in it?**
The text prefixed to each log line. The default `'%m [%p] '` is timestamp and
PID. Add `%u@%d` (user and database), `%a` (application name — only useful if
services set it) and `%e` (SQLSTATE, so error classes can be counted rather than
grepped).

**How do you log slow queries without excessive volume?**
`log_min_duration_statement` for the genuinely slow, plus
`log_min_duration_sample` with `log_statement_sample_rate` to sample the merely
slow band. That keeps full fidelity where it matters and a representative sample
where it does not.

---

← [Phase index](../README.md) · Next → [Parameters and auto_explain](02-parameters-and-auto-explain.md)
