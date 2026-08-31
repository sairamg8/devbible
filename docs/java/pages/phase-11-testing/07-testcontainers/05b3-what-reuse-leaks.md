---
title: "A reusable container is never registered with Ryuk, which is both why it can outlive your JVM and why nothing will ever remove it — and what it hands the next run is yesterday's database, with yesterday's rows, yesterday's sequences and yesterday's migration history"
sidebar_label: "05b3 · What reuse leaks"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) —
> `docs/features/reuse.md` (also at
> [java.testcontainers.org/features/reuse](https://java.testcontainers.org/features/reuse/)), from
> which both warnings are quoted verbatim, plus
> `core/src/main/java/org/testcontainers/containers/GenericContainer.java` and
> `modules/jdbc/src/main/java/org/testcontainers/containers/JdbcDatabaseContainer.java`, read
> directly.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**[05b](05b-reuse.md) and [05b2](05b2-the-contract-and-the-hash.md) covered how to make reuse
happen. This chunk is why you might not want to. The feature's own documentation carries two
warnings, and the second half of the page is the concrete version of them: what a reused container
contains on the second run, what that does to a migration test and to an init script, and the
local-passes/CI-fails failure that costs more time than the startup reuse saved.**

## The two warnings, quoted in full

These are the feature's own scoping, and they are not boilerplate:

> *"Reusable Containers is still an experimental feature and the behavior can change. Those
> containers won't stop after all tests are finished."*

> *"Reusable containers are not suited for CI usage and as an experimental feature not all
> Testcontainers features are fully working (e.g., resource cleanup or networking)."*

"Those containers won't stop after all tests are finished" is not a warning about tidiness — it is
the mechanism. In `GenericContainer.tryStart()`:

```java
if (!reusable) {
    createCommand = ResourceReaper.instance().register(this, createCommand);
}
```

**A reusable container is never registered with Ryuk**, so it never receives the
`org.testcontainers.sessionId` label, so no Ryuk session's filters will ever match it
([05a2](05a2-ryuk-and-cleanup.md)). Nothing will ever remove it but you. That is not a bug; it is
the only way a container can outlive the JVM that created it. But it does mean the honest summary of
reuse is: **you have opted out of automatic cleanup for that container, permanently.**

## 🔴 The state that leaks between runs

Everything above is mechanism. This is the cost.

A reused container is not a fresh database that happens to start faster. It is **yesterday's
database**: yesterday's rows, yesterday's schema, yesterday's sequence values, yesterday's migration
history table, and yesterday's half-finished experiment from the test you interrupted with Ctrl-C.

### What it does to a Flyway or Liquibase test

On first run, migrations apply to an empty database and the history table records them. On the
second run against the same container, the history table already lists every applied version, so
`migrate()` applies nothing — which is correct behaviour and is usually fine.

It stops being fine the moment you **edit an existing migration**, which is exactly what you do
while developing one. Flyway validates the checksum of each applied migration against the file on
disk, and an edited file no longer matches what the history table recorded. On a throwaway container
you would never notice, because there is no history to compare against; on a reused one you get a
validation failure that has nothing to do with the change you were testing. The full treatment is in
the Flyway topic —
[04 · Checksums and immutability](../../phase-10-data-access/11-flyway-migrations/04-checksums-and-immutability.md)
and [04b · The edits nothing catches](../../phase-10-data-access/11-flyway-migrations/04b-the-edits-nothing-catches.md) —
along with
[11 · Testing migrations](../../phase-10-data-access/11-flyway-migrations/11-testing-migrations.md)
and [11b · Wiring the container](../../phase-10-data-access/11-flyway-migrations/11b-wiring-the-container.md),
which is where the container-plus-migrations question properly belongs.

**The decision rule for migrations is simple: if the test's subject is the migration, do not reuse
the container.** You are testing the transition from one schema state to another, and reuse destroys
the starting state.

### What it does to `withInitScript`

Worse, and this one is not obvious from the documentation. `JdbcDatabaseContainer` runs its init
script from a lifecycle hook:

```java
@Override
protected void containerIsStarted(InspectContainerResponse containerInfo) {
    logger().info("Container is started (JDBC URL: {})", this.getJdbcUrl());
    runInitScriptIfRequired();
}
```

`GenericContainer` calls the *reuse-aware* overload `containerIsStarted(containerInfo, reused)`,
whose default implementation delegates to the one-argument form above — and
`JdbcDatabaseContainer` overrides only the one-argument form. **So the `reused` flag never reaches
it, and the init script runs again against a database that already has everything in it.** A script
of plain `CREATE TABLE` and `INSERT` statements fails on the second run; a script written with
`CREATE TABLE IF NOT EXISTS` and idempotent inserts survives it.

If you use `withInitScript` with `withReuse(true)`, **write the script to be idempotent** — that is
the fix, and there is no flag that does it for you.

### What it does to assertions

- **A row count is no longer a fact about your test.** `assertThat(repository.count()).isEqualTo(3)`
  passes on a clean container and fails on the second run because six rows are there. The symptom
  is a test that fails only on re-runs, which reads like flakiness and is not.
- **Generated identifiers keep climbing.** Sequences are not reset, so any assertion on a specific
  id, or on ids being `1, 2, 3`, breaks after the first run.
- **Unique constraints fire on the second run.** A test that inserts a user with a fixed email
  address passes once and then violates the constraint forever, until you clean the container by
  hand.

The mitigations are the same four from [05a3](05a3-the-cost-of-sharing.md) — rollback, truncation,
schema per class, unique data per test — and under reuse the balance shifts: **truncation and
unique-data become much more valuable, because they are the two that survive a database with a
history.**

### 🔴 The failure that costs the most time: passes locally, fails in CI

This is the shape to recognise, because it inverts the usual advice:

1. A developer with reuse enabled writes a test that depends on data an earlier run left behind — a
   lookup row, a schema object, a sequence position. It passes for them, every time, for days.
2. CI has reuse disabled — as the documentation instructs, *"not suited for CI usage"* — so every CI
   run starts an empty container.
3. The test fails in CI and passes on the author's machine, and every attempt to reproduce it
   locally succeeds.

**The reproduction step is `docker rm -f` the reused container, or unset
`TESTCONTAINERS_REUSE_ENABLE` for one run.** Not "run it again", which is what the developer will
try first, and which reuses the same polluted container and passes again.

The inverse also exists and is rarer but nastier: a test that only passes on a *dirty* container
because it asserts the absence of something the migration would have created.

### A decision rule you can actually apply

Reuse is a good trade when **all** of these hold:

- the container is expensive to start relative to your edit-run-edit loop — a database with
  migrations, a Kafka broker, an Elasticsearch node;
- your tests already do not depend on a pristine database, because they roll back, truncate, or use
  unique data per test;
- the container's schema is stable — you are not currently developing a migration against it;
- it is your own machine, and you accept that you now own the container's lifetime.

Reuse is a bad trade when **any** of these hold:

- you are in CI (the documentation says so directly);
- the test's subject is a migration, a schema change or a first-run behaviour;
- any assertion in the suite counts rows or names a generated id;
- the container is cheap to start, in which case you are buying almost nothing and paying with
  isolation.

## Where this goes next

The JDBC-URL form of reuse — `?TC_REUSABLE=true` — and the way reuse and the singleton pattern
compose rather than compete are [05b4](05b4-jdbc-urls-and-the-singleton.md).

## Gotchas

**★ Assuming a reused container gets cleaned up eventually.**
It carries no `org.testcontainers.sessionId` label, because reusable containers skip
`ResourceReaper.register`. No Ryuk session will ever match it. Nothing removes it but you.

**★ A `CREATE TABLE` init script failing on the second run.**
`JdbcDatabaseContainer` overrides only the one-argument `containerIsStarted`, so the `reused` flag
never reaches `runInitScriptIfRequired()` and the script runs again on an already-populated
database. Write the script with `CREATE TABLE IF NOT EXISTS` and idempotent inserts.

**★ Editing a migration while reuse is on.**
The history table from the previous run still records the old checksum, so Flyway's validation fails
on a file you deliberately changed. Delete the container, or turn reuse off, when the migration
itself is what you are working on.

**★ Row-count and generated-id assertions under reuse.**
`count()` grows every run, sequences never reset, and a fixed unique value violates its constraint
the second time. These read as flakiness and are not — they are a test that assumed a clean
database.

**★ "It passes locally and fails in CI" with reuse enabled locally.**
CI does not reuse, so CI is the only place that ever sees the first-run behaviour. Reproduce by
removing the container, not by re-running the test — re-running reuses the same polluted state and
passes again.

**★ Treating reuse as a CI optimisation.**
The documentation says reusable containers *"are not suited for CI usage"* and that not all features
are fully working, naming resource cleanup and networking. A CI agent that never removes its
containers is a disk-space incident waiting to happen, and a CI run that inherits state is not a
regression test.

## Interview questions

**★ Why does a reused container never get cleaned up?**
Because `GenericContainer.tryStart()` only calls `ResourceReaper.instance().register(...)` when the
container is *not* reusable, and registration is what attaches the `org.testcontainers.sessionId`
label that Ryuk's filters match on. No label, no match, no reaping — which is the only way a
container can outlive its JVM, and which the documentation states as *"Those containers won't stop
after all tests are finished."*

**★ Name the two warnings the reuse documentation carries.**
That it *"is still an experimental feature and the behavior can change"* and that *"Those containers
won't stop after all tests are finished"*; and that reusable containers *"are not suited for CI usage
and as an experimental feature not all Testcontainers features are fully working (e.g., resource
cleanup or networking)."*

**★ A test passes locally and fails in CI. How does reuse explain that, and how do you reproduce it?**
The developer's machine has reuse enabled, so the container carries state from earlier runs — rows,
schema objects, sequence positions — that the test has come to depend on. CI does not reuse, so it
sees a first run every time. You reproduce it by deleting the reused container or unsetting
`TESTCONTAINERS_REUSE_ENABLE` for one run; re-running the test locally reuses the same polluted
container and passes again.

**★ You use `withInitScript` and reuse. What breaks?**
The init script runs again. `JdbcDatabaseContainer` overrides only the one-argument
`containerIsStarted(InspectContainerResponse)`, so the `reused` flag that `GenericContainer` passes
to the two-argument overload never reaches `runInitScriptIfRequired()`. A script of plain
`CREATE TABLE`/`INSERT` statements fails against the already-populated database. The fix is to make
the script idempotent — `CREATE TABLE IF NOT EXISTS` and inserts guarded on absence.

**★ How does reuse interact with Flyway?**
On the second run the history table already records every applied version, so `migrate()` does
nothing — fine, until you edit an existing migration, at which point its checksum no longer matches
what the history recorded and validation fails on a change you made deliberately. The rule is: if
the migration is the subject of the test, do not reuse the container.

{/* FOOTER */}
