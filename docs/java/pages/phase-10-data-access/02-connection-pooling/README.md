---
title: "02 · Connection pooling with HikariCP"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**27 chunks.**

<!--CHUNKS-->

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · What the pool hands you](01-what-the-pool-hands-you.md)** | The pool does not make connections cheap — it makes you stop opening them, and the object it hands back is a proxy |
| 2 | **[2 · Why a small pool is faster](02-why-a-small-pool-is-faster.md)** | A connection is not a worker — it is permission to make the database work, and handing out more of it makes everything slower |
| 3 | **[3 · The deadlock floor](03-the-connection-budget.md)** | There is a size below which the pool deadlocks, and it depends on how many connections one thread holds at once |
| 4 | **[3b · Reducing Cm](03b-reducing-cm.md)** | Almost every deadlock floor is fixed by making one thread hold one connection, not by buying a bigger pool |
| 5 | **[3c · The server-side ceiling](03c-the-server-side-ceiling.md)** | The database sets a hard ceiling at boot, only part of it is yours, and it cannot be raised during the incident it causes |
| 6 | **[3d · The fleet budget](03d-the-fleet-budget.md)** | The autoscaler multiplies your pool size, and the sum is what hits the database — at the exact moment you are under load |
| 7 | **[3e · Two pools, not one bigger](03e-two-pools-not-one-bigger.md)** | When one pool serves both a 3-millisecond query and a 30-second report, the answer is two pools, not a bigger one |
| 8 | **[3f · Wiring a second DataSource](03f-wiring-a-second-datasource.md)** | A second DataSource in Boot 4.1 is declared with defaultCandidate = false, and every tutorial that says @Primary is out of date |
| 9 | **[4 · The six clocks](04-the-six-clocks.md)** | Six of HikariCP's settings are measured in milliseconds and none of them measure the same thing |
| 10 | **[4b · maxLifetime](04b-maxlifetime-and-keepalive.md)** | Something else will kill your connections, so retire them yourself first — on a schedule with jitter in it |
| 11 | **[4c · keepaliveTime and the reapers](04c-keepalive-and-the-reapers.md)** | maxLifetime cannot save a connection that is young and untouched — keepaliveTime is the heartbeat that can |
| 12 | **[4d · idleTimeout and minimumIdle](04d-idletimeout-and-minimumidle.md)** | minimumIdle is not a duration — it is the switch that decides whether your pool is fixed-size or elastic, and idleTimeout does nothing until you flip it |
| 13 | **[4e · When a clock is silently disabled](04e-when-a-clock-is-silently-disabled.md)** | HikariCP corrects your configuration at startup instead of rejecting it, so a setting in your YAML is not evidence that it is in force |
| 14 | **[5 · Connection is not available](05-connection-is-not-available.md)** | The timeout exception carries a four-number snapshot of the pool, and those four numbers tell you which of five different problems you have |
| 15 | **[5b · The exception underneath](05b-the-exception-underneath.md)** | HikariCP chains the driver's real error onto its timeout exception, and neither getMessage() nor a stack trace will show it to you |
| 16 | **[6 · Leak detection](06-leak-detection.md)** | leakDetectionThreshold never reclaims a connection — it prints the stack trace of the code that borrowed it, and that is the whole point |
| 17 | **[6b · Finding and preventing leaks](06b-finding-and-preventing-leaks.md)** | A leaked connection makes the service fail on a schedule rather than under load, and in Spring it comes from a short list of places |
| 18 | **[7 · Session state](07-session-state.md)** | The pool resets exactly six things when you close a connection, and it tracks them with six bits so it can usually reset nothing at all |
| 19 | **[7b · What SQL leaves behind](07b-what-sql-leaves-behind.md)** | Nothing you set with SQL is ever reset, so one request's session settings become another request's environment |
| 20 | **[7c · Scoping state correctly](07c-scoping-state-correctly.md)** | Every session-state leak has a fix, and they are all the same fix — put the state somewhere narrower than the session |
| 21 | **[7d · Connection-level defaults](07d-connection-level-defaults.md)** | Anything that should be true for every query is set once when the connection is made — and the strongest place to set it is the database, not the application |
| 22 | **[8 · Starting up, or failing fast](08-starting-up-or-failing-fast.md)** | One setting decides whether your service refuses to start when the database is down, or starts and serves errors — and both answers are defensible |
| 23 | **[8b · Readiness, liveness and shutdown](08b-readiness-liveness-and-shutdown.md)** | A pod that started without a database is marked ready by default, and that turns a startup failure into a traffic-serving failure |
| 24 | **[8c · Watching the pool](08c-watching-the-pool.md)** | Ten metrics come out of the pool and three of them answer the only question you will ever ask it in an incident |
| 25 | **[8d · The database side](08d-the-database-side.md)** | The pool's own numbers and pg_stat_activity should agree, and the two ways they can disagree are both diagnoses |
| 26 | **[8e · PgBouncer in front](08e-pgbouncer-in-front.md)** | Putting PgBouncer in front dissolves the connection budget and changes what a connection is — transaction mode is a different contract, not a faster one |
| 27 | **[8f · Operating two layers](08f-operating-two-layers.md)** | Behind a pooler, half your HikariCP settings stop meaning what they meant, and the queue you need to watch is the one your metrics cannot see |
