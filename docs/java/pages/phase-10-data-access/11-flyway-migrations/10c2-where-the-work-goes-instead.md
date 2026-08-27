---
title: "There are four plausible homes for a backfill that has left Flyway, and they differ in exactly one respect that matters — whether the work still sits between the pod starting and the pod becoming ready — which is why the obvious refactor into an ApplicationRunner is the one that makes things worse"
sidebar_label: "10c2 · Where the work goes instead"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Spring Boot 4.1's *SpringApplication* reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/spring-application.html)),
> Spring Boot 4.1's `FlywayProperties` and `FlywayAutoConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway)),
> Spring Batch 6's *The Domain Language of Batch*
> ([docs.spring.io](https://docs.spring.io/spring-batch/reference/domain.html))
> and Kubernetes *Jobs*
> ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/controllers/job/)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[10c](10c-when-it-should-not-be-a-migration.md) argued that a row-touching change with any of seven
properties does not belong in a `V` file. That is only half an answer, because "not a migration" is
not a place to put the work. Only the loop moves: the column, the index and the constraint stay in
Flyway, and [10c3](10c3-what-the-migration-keeps.md) is that half. This chunk is the moved part — four
candidate homes, the single question that separates them, and the reason the most natural-looking of
the four is a downgrade rather than a fix.**

## What moves, and what does not

The split is always the same: **a migration adds the column, a job fills the rows, a later migration
enforces the result.** Deploy one ships the `ALTER TABLE … ADD COLUMN` *and* the application change
that starts writing the new column, because [10](10-data-migrations.md)'s ordering rule does not care
where the backfill runs. Deploy three adds the constraint that fails if the job did not finish. The
middle step — the loop, the batching, the throttle — is what this chunk is about.

⚠️ **Moving the work does not change its physics.** The batch size, the partial index on the backfill
predicate, the `WHERE … IS NULL` resumability contract, the sleep between batches and the replica-lag
argument from [10b2](10b2-keeping-each-batch-cheap.md) all still apply, unchanged. What changes is who
holds the lock, what happens when it fails, and who can watch it.

## The four homes, and the one question that separates them

| Home | Still inside readiness? | Resumable by | Observable via | Reviewed as code |
|---|---|---|---|---|
| A hand-run script | No | Its predicate | The operator watching | Only if it lives in the repo |
| `ApplicationRunner` in the serving deployment | 🔴 **Yes** | Its predicate | Application logs and metrics | Yes |
| A one-shot pod from the same image | No | Its predicate | Application logs and metrics | Yes |
| Spring Batch | No | Its `JobRepository` | Batch metadata tables | Yes |

Column two decides most arguments. Everything [10c](10c-when-it-should-not-be-a-migration.md) said
about a migration's duration — the lock retry budget, the readiness deadline, the pipeline timeout —
applies to *anything* that runs before a pod reports ready, whether or not Flyway is involved.

### 1 · A hand-run script

A `.sql` file or a small program, committed to the repository next to a runbook, executed once by a
named human against production with somebody watching the row count.

This is the right answer more often than its reputation suggests, and it is clearly right for
[10c](10c-when-it-should-not-be-a-migration.md)'s seventh case — the one-off correction of rows that
only production ever had. The whole point there is that a person looks at the count before and after,
and that the work does *not* replay itself on every future environment.

What it costs is that it is not automatic. It has to be written down, and it will not run itself on
the next environment you create. For a correction of production-only rows that is not a cost, it is
the correct behaviour. For anything that must also happen in every other environment, it is
disqualifying.

### 2 · An `ApplicationRunner` in the deployable — and why this one is a trap

The obvious refactor is to move the loop into Java and run it at startup behind a feature flag. Read
what a runner actually is before you do:

> *"Both interfaces work in the same way and offer a single `run` method, which is called just before
> `SpringApplication.run(…)` completes. This contract is well suited for tasks that should run after
> application startup but before it starts accepting traffic."*

and:

> *"An application is considered ready as soon as application and command-line runners have been
> called."*

🔴 **So a backfill in an `ApplicationRunner` in your serving deployment occupies exactly the position
the migration occupied.** It runs before readiness. It delays every pod. And it now runs in *all* of
them concurrently rather than one, because you have simultaneously thrown away the advisory lock that
was making the migration safe ([09](09-many-instances-one-database.md)). Ten pods each running the
same batched `UPDATE` against the same rows is a strictly worse arrangement than the thing you were
trying to fix, and it looks like an improvement in the diff.

Wrapping the runner's body in a thread to "make it not block startup" trades the readiness problem
for an unsupervised background thread in every replica with no coordination and no shutdown story.
That is not better; it is the same problem with the alarm switched off.

An `ApplicationRunner` is a perfectly good mechanism in a deployable whose *entire job* is the
backfill. It is not one in the deployable serving traffic.

### 3 · A one-shot pod from the same image

The shape most teams converge on. The same container image, started with a profile or an argument
that makes it run the backfill and exit, scheduled as a Kubernetes `Job`:

> *"Jobs represent one-off tasks that run to completion and then stop. A Job creates one or more Pods
> and will continue to retry execution of the Pods until a specified number of them successfully
> terminate."*

You keep the application's own code, configuration, secrets, connection handling, metrics and
logging. Kubernetes gives you bounded retry through `backoffLimit`, and the pod's exit status is a
real signal something can alert on. Crucially the work is outside the Deployment's rollout entirely,
so nothing it does can delay a readiness probe or crash-loop a serving pod.

⚠️ **That pod is your application, so it runs Flyway on startup like everything else.** It acquires
the advisory lock, finds nothing pending, releases it and continues. Harmless in isolation — but if
the job pod starts *during* a rollout it is one more competitor for that lock, and if you would rather
it never touched the history table:

```yaml
spring:
  flyway:
    enabled: false     # default: true
```

`FlywayAutoConfiguration` is annotated `@ConditionalOnBooleanProperty(name = "spring.flyway.enabled",
matchIfMissing = true)`, so setting it to `false` removes the Flyway beans from that process
altogether.

⚠️ **Size its connection pool for a batch process, not for a web process.** The image is shared, so
the pool configuration is too, and a backfill pod that opens twenty connections to run one loop is
twenty connections the serving pods cannot have ([02 · Connection
pooling](../02-connection-pooling/README.md)).

### 4 · Spring Batch

When resumption needs to be a property of the framework rather than of your `WHERE` clause. Batch's
model is built around exactly that:

> *"A `JobInstance` refers to the concept of a logical job run."* … *"Using a new `JobInstance` means
> 'start from the beginning,' and using an existing instance generally means 'start from where you
> left off'."*

with the state persisted rather than re-derived from the data:

> *"A `JobExecution` refers to the technical concept of a single attempt to run a `Job`. An execution
> may end in failure or success, but the `JobInstance` corresponding to a given execution is not
> considered to be complete unless the execution completes successfully."*

What you buy is restart from the last committed chunk, a queryable record of every attempt, and
`ItemReader`/`ItemWriter` plumbing that already does the chunking and the transaction boundaries.
What you pay is a second set of metadata tables living in your database — which is schema, which means
they arrive through Flyway before the job can run at all — plus a framework's worth of concepts.

Reach for it when the work has genuine steps, genuine failure semantics, or has to survive being
restarted a dozen times. Not because the row count is large: a large row count with one rule is still
one loop.

## The exception: data changes that should stay migrations

The line is not "data versus schema". It is whether the change has a migration's shape — fast, once,
atomic, silent, no undo needed, part of what the schema means. Seeding a twenty-row `countries` table
has that shape. Backfilling a new column on a four-thousand-row table has that shape. Converting a
status column's four values has that shape.

Leave them where they are. Moving a two-millisecond `UPDATE` into a Kubernetes `Job` is ceremony, and
a codebase full of ceremony teaches people that the rules are arbitrary — which is eventually how the
ninety-million-row `UPDATE` gets written as a migration too.

## Gotchas

**★ Moving the work out of Flyway does not change what the database has to do.** Batching, the partial
index, the predicate, the throttle and the replica-lag argument are all unchanged. Only the ownership
of the failure changes.

**★ An `ApplicationRunner` in the serving deployment is worse than the migration was.** Boot's own
words are that an application *"is considered ready as soon as application and command-line runners
have been called"*, so it still blocks readiness — and it now runs in every replica at once, because
the advisory lock is gone.

**★ Backgrounding the runner into a thread does not fix it, it hides it.** You get an unsupervised
loop in every pod, no coordination between them, and no defined behaviour when the pod is terminated
mid-batch.

**★ A backfill pod built from the application image runs Flyway too.** It takes the advisory lock at
startup, finds nothing pending and releases it. Usually harmless; during a rollout it is one more
competitor for the lock. `spring.flyway.enabled: false` on that process removes the Flyway beans.

**★ A Kubernetes `Job` retries by starting the pod again from the beginning.** `backoffLimit` gives you
attempts, not resumption. The retry is only safe because the predicate makes the work idempotent —
the same property that made the batched migration safe to re-run.

**★ The job pod inherits the web pod's connection pool settings.** One process doing one loop does not
need a web-sized pool, and taking one is a direct subtraction from what the serving pods can open.

**★ Spring Batch puts its own tables in your database.** The `JobRepository` is schema, so it is
migrations, so adopting Batch for one backfill means shipping Batch's tables through Flyway first.
A reasonable price for a real batch workload; a silly one for a single loop.

**★ Spring Batch's resumability is per `JobInstance`, and the instance is identified by its
parameters.** Re-running with a new parameter value means "start from the beginning" — so a job
parameterised with, say, a timestamp restarts from zero every time, which is precisely the opposite
of what you wanted from it.

**★ A hand-run script that is not in the repository did not happen.** The audit trail for work outside
Flyway is the pull request that added the script plus the runbook recording who ran it and when.
Without both, the objection that leaving Flyway costs you reviewability is simply correct.

**★ A hand-run script does not propagate to new environments.** That is right for a production-only
incident fix and disqualifying for anything a fresh database also needs. Deciding which of the two you
have is the whole choice.

**★ None of these removes the ordering rule from [08](08-migrating-a-live-service.md).** The
application must already be writing the new column before the backfill starts. Moving the backfill out
of the deploy actually *widens* the window in which that mistake is possible, because the two steps
are no longer in the same pipeline and no longer fail together.

**★ Ceremony has a cost too.** Routing a trivial data change through a separate job, a runbook and
three deploys is not free — it is review time, it is a second place to look, and it makes the rule
look like bureaucracy rather than physics. Keep small bounded changes in migrations so that the
exceptions stay legible.

## Interview questions

**★ Why not just move the loop into an `ApplicationRunner`?**
Because a runner is called just before `SpringApplication.run` completes, and Boot considers the
application ready only once the runners have been called. The backfill is therefore still between the
pod starting and the pod serving traffic — the exact position it had as a migration — except that it
now runs in every replica simultaneously, because the Flyway advisory lock that was serialising it is
gone. It looks like a fix and is strictly worse.

**★ What if you run it on a background thread so it does not block startup?**
Then you have an unsupervised loop in every pod, ten of them writing the same rows, no coordination,
no progress reporting anyone owns, and no defined behaviour when a pod is rolled mid-batch. It removes
the symptom — slow startup — and keeps every underlying problem, which makes it harder to diagnose
rather than easier.

**★ What is the right shape, then?**
A separate one-shot process: the same container image, started with a profile or argument that makes
it run the backfill and exit, scheduled as a Kubernetes `Job`. It has the application's code,
configuration and credentials, its logs and metrics land where the application's do, its exit status
is a real signal, and it is entirely outside the Deployment's rollout, so nothing it does can delay
readiness or crash-loop a serving pod.

**★ That pod is your application. Does it run the migrations too?**
Yes, unless you stop it. It starts, Flyway takes the advisory lock, finds nothing pending, releases it
and the process carries on. Usually harmless. If the job might start during a rollout, or you would
rather it never touched the history table, `spring.flyway.enabled: false` is checked by
`FlywayAutoConfiguration` with `matchIfMissing = true` and removes the Flyway beans from that process.

**★ When is Spring Batch worth it over a loop in a one-shot pod?**
When resumption has to be the framework's job rather than your `WHERE` clause's. Batch persists
execution state — a `JobInstance` is the logical run, a `JobExecution` is one attempt, and re-running
an existing instance means starting from where you left off. You get restart from the last committed
chunk and a queryable record of attempts. You pay with metadata tables that themselves have to be
migrated, so it is right for a job with real steps and real failure semantics and wrong for one big
`UPDATE`.

**★ When is a hand-run script the correct answer?**
When the change is a one-off correction of rows that only exist in production, and when a human
looking at the before-and-after count is part of the value. It is exactly wrong for anything a fresh
environment also needs, because it will not run itself there. The reviewable version of it is a script
committed to the repository with a runbook naming who ran it and when — not a command somebody typed
into `psql` and described in a chat message.

**★ Does moving the backfill out change how you write it?**
No. The batch size, the partial index on the backfill predicate, the `WHERE … IS NULL` that makes it
resumable and the sleep that keeps replicas from lagging are all properties of what the database has
to do, and the database does not know where the loop is running. What changes is that a failure now
fails a job rather than a rollout, and that you can watch it, throttle it and stop it.

**★ What is the strongest argument *against* this whole approach?**
That a migration is reviewed, ordered, recorded and applied automatically everywhere, and a job is
none of those by default — so moving work out of Flyway trades a guarantee for flexibility. It is a
fair objection, and the answer is to rebuild each property deliberately: the job's code goes through
a pull request, its runbook records who ran it, its completion is checkable in one SQL query, and a
downstream migration fails the deployment if it did not complete. Skip that last part and the
objection stands.

{/* FOOTER */}
