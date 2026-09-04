---
title: "Most of the data changes people write as migrations should not be migrations at all, and the test is not how hard the SQL is — it is whether the change needs application logic, an unbounded amount of time, or the ability to be watched, paused and retried, because a migration file offers none of the three"
sidebar_label: "10c · When it should not be a migration"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's *Target* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-target-setting)),
> Flyway's *Migration Transaction Handling*
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)),
> the Flyway *lockRetryCount* reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-lock-retry-count-setting)),
> and Spring Boot 4.1's `FlywayProperties` and `FlywayMigrationInitializer`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**[10](10-data-migrations.md) showed what a data migration costs, [10b](10b-batching-a-backfill.md)
showed how to make one survivable and [10b2](10b2-keeping-each-batch-cheap.md) how to make each batch
cheap. Every one of those techniques works. The question this chunk asks is the one that should have
come first: given how much machinery it took, should the change have been a migration at all? For a
large fraction of real data changes the answer is no — not because the SQL is hard, but because a
Flyway migration is a fixed-shape thing (one file, one attempt, inside deployment, with a boolean
outcome) and the change needs a different shape. This chunk is the test. Where the work goes instead,
what the migration should still own, and how you prove the job ran, is
[10c2](10c2-where-the-work-goes-instead.md).**

## The shape a migration has, stated plainly

Before the test, the constraints — every one of them argued somewhere earlier in this topic.

| Property | Consequence | Argued in |
|---|---|---|
| It runs during application startup | Its duration sits inside the orchestrator's readiness patience | [08b4](08b4-how-long-is-too-long.md) |
| It holds Flyway's advisory lock while it runs | Every other instance polls, then fails to start | [09](09-many-instances-one-database.md), [09b](09b-what-the-lock-actually-covers.md) |
| It is one file, immutable once applied | You cannot change your mind about it | [04](04-checksums-and-immutability.md) |
| It runs exactly once, ever, per database | You cannot re-run it, and neither can anyone else | [03](03-the-history-table.md) |
| Its result is one boolean column | There is no progress, no rate, no partial success | [03c](03c-reading-the-history.md) |
| It cannot be paused, throttled or cancelled | The only stop button is killing the pod | [10b](10b-batching-a-backfill.md) |
| It is SQL, executed by the database | No Java, no beans, no network calls | — |
| It has no undo | Undo migrations are Teams-only and documented as suiting schema rather than data | [10](10-data-migrations.md) |

Nothing on that list is a defect. They are exactly the properties that make a migration a *reliable,
ordered, replayable schema history*, which is the entire argument of
[01 · Why schema is code](01-why-schema-is-code.md). They are simply the wrong properties for a
long-running, logic-bearing, restartable job — and a change that needs those things does not acquire
them by being written into a `V` file.

## The test: seven questions, any one of which is decisive

### 1 · Does it need code you cannot write in SQL?

Re-encrypting a column with the application's key. Re-hashing credentials at the current cost factor.
Normalising addresses through the library the application already uses. Deriving a value from a Java
`enum`'s ordering, a `Locale` rule, a `MessageDigest`, a currency-rounding policy that lives in a
`@Component`.

None of that is a SQL problem, and both workarounds are worse than the thing they avoid: reimplement
the logic in PL/pgSQL and you now have two implementations that will diverge, or install a
PL/Java-style extension and you have taken on an operational dependency to solve a scheduling
problem.

🔴 **The decisive form of this question:** if the SQL in the migration and the Java in the application
have to agree, and they are maintained separately, they will stop agreeing. The migration is the copy
nobody ever re-reads.

### 2 · Does it call anything over a network?

A tokenisation service, a geocoder, an object store, another team's API. A migration that makes a
network call holds Flyway's advisory lock for as long as that call takes, blocks every other
instance's startup behind it, and cannot be retried without a `repair`
([04d](04d-what-repair-actually-does.md)). It also converts a third party's availability into a
precondition for your deployment succeeding — and a timeout on their side into a failed rollout on
yours.

### 3 · Is its duration unbounded, or merely unknown?

This is the sharpest structural argument in the chunk, because it fails in a way nobody predicts.
Flyway takes its advisory lock, applies your backfill, and releases it. Meanwhile the other nine pods
are polling — one attempt per second, `lockRetryCount` attempts, default 50.

🔴 **A backfill that runs for longer than about fifty seconds fails every instance except the one
running it.** They throw a `FlywayException` naming `lockRetryCount`, it propagates out of
`FlywayMigrationInitializer`, the application context never refreshes and the pod crash-loops
([09](09-many-instances-one-database.md)). Raising `spring.flyway.lock-retry-count` moves the wall;
it does not remove it, and the deployment's own readiness deadline is standing right behind it
([08b4](08b4-how-long-is-too-long.md)).

If you cannot state an upper bound on the runtime — and you cannot, for a backfill whose row count
you learned from `reltuples` on a table that is still growing — the change does not belong in the
startup path.

### 4 · Does anyone need to watch it, pause it, slow it down or stop it?

A migration's entire runtime interface is: it is running, or it finished, or it failed. No progress.
No rate. No way to say "the replicas are lagging, halve the batch size" except by killing the
process — and killing the process kills the pod's startup with it, which under Kubernetes means an
immediate automatic restart that begins the backfill again.

[10b2](10b2-keeping-each-batch-cheap.md) recovered progress by suggesting you count rows from a second
session. That is a real answer, and it is also a confession: the mechanism has no observability of its
own and you are inferring it from outside.

### 5 · Might it need to be retried differently, or run again later?

Once `V44` has a `success = true` row it will never run again on that database. If the backfill turns
out to have been subtly wrong — the wrong default, a locale bug, a `NULL` where an empty string was
meant — the fix is a *new* migration, `V47`, and that is fine. But if the same work needs to happen
again on new rows, periodically, as a legacy importer keeps delivering them, the once-only model is
simply not what you want.

⚠️ The `R__` repeatable form does not rescue this. A repeatable migration re-runs when its checksum
changes ([05](05-repeatable-migrations.md)), not when the data changes, and
[05c](05c-what-does-not-belong.md) already argued that "runs again whenever somebody touches the
file" is the wrong trigger for anything expensive.

### 6 · Is it irreversible in a way that matters?

`ALTER TABLE … ADD COLUMN` is reversible. `UPDATE customers SET name = trim(name)` is not — the
information needed to reverse it was in the rows you overwrote. If the change destroys information
and there is any chance it is wrong, the deployment pipeline is the worst possible place to run it,
because a deployment is designed to proceed automatically and quickly.

### 7 · Is it a one-off correction rather than part of the schema's history?

"Fix the 412 orders that got the wrong tax rate on Tuesday" is incident remediation. Written as
`V44__Fix_tuesday_tax_rates.sql` it becomes a permanent member of your migration history, replayed
against every developer laptop, every CI database and every new environment until you collapse the
history ([06c](06c-baseline-migrations-and-collapsing-history.md)) — matching zero rows every single
time, because those 412 rows only ever existed in production.

That is not harmful, exactly. It is noise in the one file set whose job is to be readable, and it
quietly tells a future reader that the schema history contains facts the schema history cannot
reproduce.

## What the answer is not

The answer to all seven is never "do it outside Flyway and let the schema drift". It is a split:
**the migration owns the catalogue, a job owns the rows, and a later migration owns the
enforcement** — where the enforcing migration is what fails if the job did not finish.
[10c2](10c2-where-the-work-goes-instead.md) is that split in full, including which of the four
plausible homes for the job you actually want.

## Gotchas

**★ "It is SQL, so it is a migration" is the wrong inference.** The migration format is a delivery
mechanism with specific properties, not a category for all SQL. Whether the statement is DDL or DML
is irrelevant; whether the change fits inside a startup transaction with no observability is the
question.

**★ A long backfill in a migration fails the *other* pods, not the one running it.** The instance
holding the advisory lock finishes fine. The nine polling behind it exhaust `lockRetryCount` and
crash-loop, so the symptom is "the rollout is stuck" and the error names the lock rather than the
backfill. Nobody connects the two quickly.

**★ Raising `lock-retry-count` moves the failure, it does not fix it.** Behind Flyway's retry budget
is the orchestrator's readiness deadline, and behind that is whatever the deployment tooling gives up
after. You are buying time from three clocks with one setting, and none of the three was chosen with
a backfill in mind.

**★ A migration that calls a network service makes a third party a dependency of your deploy.** Their
timeout becomes your failed rollout, and your retry is a `repair` plus a redeploy rather than a
retried HTTP request.

**★ Reimplementing Java business logic in PL/pgSQL creates a second source of truth.** It will be
correct the day it is written and wrong the first time the Java changes, and nothing compares them.
This is the most common route from a "simple" data migration to a data-quality incident six months
later.

**★ There is no way to slow a running migration down.** No rate control, no pause, no cancel that is
not a `SIGKILL` — and under Kubernetes a `SIGKILL` during startup is followed immediately by a
restart that begins the work again.

**★ Killing a pod to stop a backfill restarts the backfill.** The container restarts, Flyway runs, and
the migration is still pending because it never wrote a history row. Stopping the work means changing
the deployment, not stopping the process.

**★ A once-only migration cannot become a recurring job later.** The history row makes it permanently
inert on every database that ran it. If the data change may need to happen again — new rows from a
legacy feed, a periodic normalisation — it was never a migration.

**★ `R__` is not the escape hatch.** A repeatable migration is triggered by its own checksum changing,
not by the data changing. "Make it repeatable" converts a once-only job into one that runs on every
deployment where somebody reformatted the file, which is the worst of both models.

**★ An incident fix in a `V` file is replayed forever against databases where it can match nothing.**
Permanent noise in the history, and an advertisement that the history depends on facts only production
ever had.

**★ The seven questions are a disjunction, not a score.** One "yes" is enough. A change can be a
single, elegant, well-indexed `UPDATE` and still belong outside the deployment because it takes four
hours.

**★ "It was fine in staging" is the specific evidence this test exists to override.** Every one of the
seven failure modes is invisible on a thousand-row database: the lock is held for milliseconds, the
runtime is bounded, nobody needs progress, and the incident-fix migration matches its rows because
somebody seeded them.

## Interview questions

**★ How do you decide whether a data change belongs in a migration?**
By whether the change has the shape a migration has, not by whether it is written in SQL. A migration
is one file, applied once, during application startup, holding Flyway's lock, with no progress
reporting, no rate control, no pause and no undo. A change that is fast, bounded and self-contained
fits that shape. A change that needs application logic, a network call, an unbounded amount of time,
or the ability to be watched and throttled does not — and writing it as a `V` file does not give it
any of those things.

**★ Why is a long backfill in a migration a rollout failure rather than just a slow deployment?**
Because Flyway serialises instances with an advisory lock and gives the losers a finite retry budget —
one attempt per second, fifty by default. The instance holding the lock completes normally; every
other instance exhausts its retries, throws, fails its application context and crash-loops. The alert
says the rollout is stuck and the exception names `lockRetryCount`, so the backfill is usually the
last thing anyone suspects.

**★ Can't you just raise `lock-retry-count`?**
It buys time from one of three clocks. Behind Flyway's retry budget is the orchestrator's readiness
and startup deadline, and behind that is whatever the deployment pipeline gives up after. Raising the
Flyway setting moves the first wall and leaves the other two — and all three were sized for
application startup, not for a data job.

**★ Somebody wants to fix 412 rows that a bug corrupted. Migration or not?**
Not a migration. It is incident remediation about rows that only ever existed in production, and as a
`V` file it becomes a permanent entry in a history that replays it against every developer database
and every CI run, matching nothing each time. Run it as a reviewed, logged one-off against production.
What *does* belong in a migration is anything structural the incident revealed — the constraint that
would have prevented it.

**★ Is a repeatable migration a good home for a backfill that may need to run again?**
No. A repeatable migration re-runs when its own checksum changes, which is a trigger about the file
rather than about the data. It does nothing when new rows arrive needing the same treatment, and it
runs unnecessarily on every deployment after somebody reformats it. If the work genuinely recurs, it
is a scheduled job, not a migration of either kind.

**★ The backfill has to call the application's encryption code. Why not port that logic into the
database?**
Because you would then have two implementations of one rule, in two languages, maintained by two
different review paths, with no test comparing them. It will be correct on the day it ships. The
first time the Java changes — a new key version, a different padding, an extra field in the plaintext
— the PL/pgSQL copy silently stops matching, and the rows written by the migration diverge from the
rows written by the application. Nothing detects that until somebody cannot decrypt a record.

**★ Where is the line, then? Give an example on each side.**
Seeding a twenty-row `countries` lookup table is a migration: fast, bounded, part of what the schema
means, and nothing about it needs watching. Backfilling `region` on ninety million customer rows is
not: it is measured in hours, it has to be throttled against replica lag, it needs to be resumable
and observable, and it will hold the lock through the entire rollout. Same statement keyword,
completely different shape.

**★ How would you argue this in a review where the migration is already written and works?**
By asking for the numbers rather than the SQL. What is the production row count, what is the measured
rate per thousand rows, and therefore what is the runtime — then compare that number against
`lockRetryCount` times one second, against the readiness deadline, and against the pipeline timeout.
The review question is never "is this SQL correct"; it is "how long does this hold the lock, and what
happens to the other nine pods while it does".

{/* FOOTER */}
