---
title: "sequential version numbers give you a readable history and a merge conflict on every parallel branch; timestamp versions give you no conflicts and a history whose order depends on when somebody started writing rather than what depends on what"
sidebar_label: "02c · Choosing version numbers"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Redgate Flyway documentation *Versioned migrations*
> ([documentation.red-gate.com/fd/versioned-migrations-273973333.html](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)),
> *Migrations*
> ([documentation.red-gate.com/fd/migrations-271585107.html](https://documentation.red-gate.com/fd/migrations-271585107.html))
> and Spring Boot 4.1's `FlywayProperties` source
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**A version number is a coordination protocol between people who are not talking to each other.
Sequential numbering makes the conflict visible in git, at merge time, where it is cheap.
Timestamp numbering makes the conflict impossible in git and possible in the database, where it
is not. Neither is wrong; the trade is where you would like to find out.**

## The two schemes

**Sequential.** `V1`, `V2`, `V3`. The next migration takes the next integer.

```
V1__create_customers.sql
V2__create_orders.sql
V3__add_cancelled_at_to_orders.sql
```

Readable, trivially sortable, and every reviewer can see at a glance whether a pull request is
based on current `main`. Its defect is structural: two branches both add "the next" migration,
both call it `V4`, and git merges them cleanly because they are different files with different
names — `V4__add_index.sql` and `V4__add_column.sql`. Nothing conflicts textually. Flyway then
refuses to run, because *"Each versioned migration must be assigned a unique version."*

**Timestamp.** `V20260826140501__add_cancelled_at.sql`, or with dots,
`V2026.08.26.14.05.01__add_cancelled_at.sql`. Both parse — the version is *"the usual dotted
notation or an underscore separated notation"*, and a long run of digits is a single numeric
part.

Two people cannot collide unless they generate a version in the same second. The defect is
equally structural: **the order is authoring time, not dependency order.** A migration written
Monday and merged Friday sorts before a migration written Wednesday and merged Wednesday. On a
database that has already applied the Wednesday one, the Monday one is out of order.

## What "out of order" means, exactly

Flyway records the highest version it has applied. A new migration whose version is *lower*
than something already in the history is out of order, and by default it is a validation
failure rather than something Flyway quietly slots in.

```yaml
spring:
  flyway:
    out-of-order: true
```

`FlywayProperties` documents it as *"Whether to allow migrations to be run out of order"*,
default **`false`**. With it on, Flyway applies the straggler and gives it the next
`installed_rank` — so the history table's `installed_rank` and its `version` disagree about the
order, which is precisely what `installed_rank` exists to record
([03 · The history table](03-the-history-table.md)).

⚠️ **Turning `out-of-order` on is a decision about correctness, not convenience.** If the
straggler assumed a table that a later migration renamed, applying it late runs it against a
schema it was never written for. The setting says "I accept that these migrations are
independent"; nothing verifies that they are.

## Which to choose

| | Sequential | Timestamp |
|---|---|---|
| Collisions between branches | frequent, caught at merge | essentially never |
| Where you find out | git / CI, before anything ran | the database, possibly in production |
| History reads as | dependency order | authoring order |
| Needs `out-of-order` | rarely | routinely, on any long-lived branch |
| Hotfix insertion | `V2.1` between `V2` and `V3` | just a later timestamp |
| Team size it suits | one team, one queue | many teams, many branches |

**The honest default for a single service with one team is sequential**, with a `V2.1`-style
decimal reserved for the hotfix case. You get a readable history, and the collision that
sequential numbering causes is a two-minute rename in a pull request rather than an incident.

**Timestamps earn their place** when several teams merge into one schema, when branches live
for weeks, or when a code generator produces migrations. Adopt `out-of-order: true` at the same
time and understand that you have accepted a weaker guarantee.

⚠️ **Do not mix the two schemes in one project.** They sort against each other numerically, so
every timestamp version is astronomically larger than every sequential one and permanently
pins the sequential ones below it. Adding `V4` after `V20260826…` has run is an out-of-order
migration forever.

## The decimal escape hatch

Because *"Versions are sorted numerically as you would normally expect"* part by part, `1.1`
sorts after `1` and before `2`. That gives you a way to insert into a released sequence:

```
V2__create_orders.sql          # already in production
V2.1__backfill_currency.sql    # the hotfix, written after V3 was merged
V3__add_cancelled_at.sql       # already in production
```

If `V3` has already been applied where `V2.1` needs to run, this is out of order and needs the
setting. If it has not — the hotfix reaches production before `V3` does — it is an ordinary
in-order migration and nothing special happens. **Which case you are in depends on the target
database, not on the repository**, so the same file can be in-order in staging and out-of-order
in production.

## `target` — stopping deliberately

```yaml
spring:
  flyway:
    target: "3"
```

The Boot default is the string `"latest"`. Setting a version applies only migrations up to and
including it. Two real uses:

- **A staged rollout** where the schema change is deployed ahead of the code that uses it, and
  you want the next batch held back until a specific release.
- **Reproducing a bug** against the schema as it was at version 3, in a throwaway database.

⚠️ It is not a rollback. Lowering `target` below what has already been applied does not undo
anything; it just stops adding. And leaving a numeric `target` in a production configuration is
a trap — every subsequent migration is silently skipped, forever, and the service starts fine.

## Reserved bands

A convention that costs nothing and prevents a class of collision outright: give each source of
migrations a version range.

| Band | Source |
|---|---|
| `V1`–`V899` | application migrations, in `src/main/resources` |
| `V900`–`V999` | test fixtures, in `src/test/resources` |
| `V1000`+ | anything generated |

The test band matters because the test classpath merges `src/test/resources/db/migration` into
the same logical location as the main one — [02b · Where they live](02b-where-they-live.md).
Without a reserved band, adding `V12` to the application collides with the `V12` a colleague
added to the fixtures six months ago, and only the test run notices.

## Gotchas

**★ Two branches both taking `V4` merge cleanly in git.** They are different file names, so
there is no textual conflict. The failure arrives at the first `migrate` after the merge.

**★ A duplicate version fails everywhere, including databases that had already applied one of
them.** It is a resolver-level conflict, detected before anything is applied — which is the
merciful part.

**★ Timestamp versions make out-of-order migrations routine rather than exceptional.** Any
branch older than a day produces one. Adopting timestamps without `out-of-order: true` produces
a merge that cannot deploy.

**★ `out-of-order: true` does not check that the migration is safe to apply late.** It only
permits it. If the late migration assumed a column a later migration dropped, it runs against a
schema that no longer matches its assumptions.

**★ `installed_rank` and `version` stop agreeing once anything runs out of order.** That is
correct behaviour and it means you must read `installed_rank` — not `version` — when you want
to know what actually happened in what sequence.

**★ Mixing sequential and timestamp versions permanently strands the sequential ones.**
Numerically, `20260826140501` dwarfs `4`. Every later small number is out of order by
definition.

**★ Zero-padding is presentational only.** `V001` and `V1` are the same version. Padding makes
`ls` agree with Flyway's sort; it does not create distinct versions, and mixing padded and
unpadded forms of the same number is a duplicate.

**★ A `target` left set in configuration silently freezes the schema.** New migrations are
skipped without error and the application starts normally, which makes it one of the hardest
"the migration did not run" causes to find.

**★ The same migration can be in-order in one environment and out-of-order in another.**
Ordering is relative to what that database has applied, so staging passing tells you nothing
about production.

**★ Version numbers are not release numbers and should not be made to match.** Tying `V4.2.1`
to the application's semantic version means every patch release wants a migration whether or
not the schema changed, and a schema change mid-release has nowhere to go.

## Interview questions

**★ Sequential or timestamp version numbers — which do you use and why?**
Sequential for a single team on a single service: the history reads as dependency order and a
collision surfaces as a rename in a pull request. Timestamps when many teams or long-lived
branches share a schema, accepting that migrations will routinely apply out of order and that
`out-of-order: true` has to be on.

**★ Two developers both created `V4`. What happens, and when?**
Git merges them without conflict because the file names differ. Flyway then refuses at the next
`migrate` with a duplicate-version conflict, before applying anything. The fix is to renumber
one of them — which is safe precisely because neither has been applied yet.

**★ What does `out-of-order` actually permit?**
Applying a migration whose version is lower than the highest already applied to that database.
Flyway gives it the next `installed_rank`, so the history records the real execution order even
though the versions are out of sequence. It does not validate that late application is safe.

**★ How do you insert a fix between two migrations that are already in production?**
Give it a decimal version between them, such as `V2.1` between `V2` and `V3`. Whether that is
an out-of-order migration depends on the target database: if `V3` has already run there, yes;
if it has not, the new migration is simply next in line.

**★ What is `spring.flyway.target` for, and what is the danger?**
It caps the version Flyway will migrate up to; the default is `latest`. It is useful for staged
rollouts and for reproducing a bug at an older schema. The danger is leaving it set — every
later migration is skipped silently and the application starts perfectly.

**★ Why should `installed_rank` be trusted over `version` when reconstructing history?**
Because with out-of-order migrations enabled the two disagree by design. `version` is what the
migration claims to be; `installed_rank` is the order in which this database actually applied
things.

**★ Can you mix sequential and timestamp versions?**
You can, and you should not. Numeric comparison means every timestamp is larger than every
plausible sequential number, so once a timestamp is applied, every future sequential version is
out of order permanently.

**★ Should the migration version track the application's release version?**
No. They change at different rates and for different reasons — a release with no schema change
would need a placeholder migration, and two schema changes inside one release would have
nowhere to sit. Keep the migration sequence independent and let the description carry the
meaning.

<!--FOOTER-->
