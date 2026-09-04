---
title: "Two conditions switch the whole comparison off — everything at or below the baseline, and everything past the two-hundredth character of a description — and once you have added those to the checksum's blind spots the interesting question is why the rule against editing migrations survives at all"
sidebar_label: "04c · Where the comparison does not run"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `MigrationInfoImpl.validate()`
> ([MigrationInfoImpl.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/info/MigrationInfoImpl.java)),
> `AbbreviationUtils`
> ([AbbreviationUtils.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/util/AbbreviationUtils.java)),
> the *Ignore Migration Patterns* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-ignore-migration-patterns-setting-277579006.html))
> and the *Baseline* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/baseline)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**[04b](04b-the-edits-nothing-catches.md) was about what Flyway hashes. This is about when Flyway
does not look at all. Two conditions in `validate()` disable the type, checksum and description
checks outright, and neither is announced anywhere in a build log. Add them to the blind spots and
the tool's protection starts to look thin enough that the honest conclusion is the one this page
ends on: the rule against editing applied migrations is a discipline, and the checksum is a
convenience that catches the common half of the violations.**

## Everything at or below the applied baseline is never compared

One condition wraps all three of `04`'s comparisons:

```java
if (getVersion() == null || getVersion().compareTo(context.appliedBaseline) > 0) {
    // type / checksum / description checks live in here
}
```

Below or equal to the applied baseline version, none of them run. After baselining a database at
`V50`, migrations `V1`–`V50` can be edited, renamed or retyped freely as far as *that* database is
concerned — their rows exist, their files may or may not, and nothing looks.

That is not a bug; it is what makes baselining possible at all
([06 · Baselining](06-baselining.md)). A baseline says *"the schema at this version is correct,
however it got there"*, and comparing against files this database may deliberately never have run
would fail every time. The cost is that **the reproducibility guarantee applies only above the
baseline**, and the boundary is invisible unless you go looking for it — a database baselined at
`V50` and a database that ran `V1`–`V50` for real are not verified to be the same thing.

## Descriptions are compared after truncation

A smaller hole, and worth knowing because it explains a puzzling non-failure. The description
comparison abbreviates the resolved side first:

```java
public static String abbreviateDescription(final String description) {
    if (description == null) return null;
    if (description.length() <= 200) return description;
    return description.substring(0, 197) + "...";
}
```

So two descriptions that differ only after character 197 are indistinguishable. `script` gets the
same treatment at 1000 characters. Neither limit is configurable and neither needs to be — but if
you have ever wondered why a rename went unnoticed, an over-long description is one of the two
explanations. The other is the baseline.

## What no ignore pattern can suppress

[03c](03c-reading-the-history.md) covered `ignore-migration-patterns`, whose statuses are
`Missing`, `Pending`, `Ignored` and `Future`. Look at what is not in that list: **there is no
pattern that suppresses a checksum, description or type mismatch.** A migration whose file was
edited is still in state `SUCCESS` — the state describes the *row*, and the mismatch is a separate
comparison that runs after the pattern check has already passed.

That is a good design and it is worth naming as one. Missing, pending and future are situations a
team may legitimately want to tolerate as policy. A rewritten migration is never a policy; it is
either a mistake to revert or a deliberate act to record with `repair`. Flyway gives you no way to
declare it acceptable in configuration and walk away.

The only ways to make a checksum mismatch stop failing are therefore: fix the file, run `repair`,
or turn `validate-on-migrate` off entirely — which is
[07b · Validate, not update](07b-validate-not-update.md)'s subject and is close to never right.

## Why the rule survives anyway

Add the four holes up and Flyway's protection looks thin: no checksum on Java migrations, no
checksum coverage of placeholder values on versioned migrations, no comparison at all below the
baseline, and truncation in the description. If the rule against editing migrations rested on the
tool, it would not hold.

It does not rest on the tool. A migration set is a claim: **replaying these files against an empty
database produces this schema.** Everything migrations are used for depends on that claim being
true — building a test database, standing up a new region, reproducing a bug on a fresh instance,
onboarding a developer. Edit an applied migration and the claim is false for every database that
ran the old text, and the only record of the difference is in somebody's memory.

Worse, the divergence is silent *in exactly the environments you test in*. Development databases
are dropped and rebuilt, so they run the new text. The environment running the old text is the one
nobody rebuilds.

So the answer is always the same, and it is not a compromise: **write the next migration.**

```sql
-- V7__Add_index_on_orders.sql   -- shipped with the wrong column, already applied. Leave it.
CREATE INDEX idx_orders_customer ON orders (custmer_id);
```

```sql
-- V8__Fix_index_on_orders.sql   -- the correction, as its own historical fact
DROP INDEX IF EXISTS idx_orders_customer;
CREATE INDEX idx_orders_customer ON orders (customer_id);
```

A migration that fixes a migration is normal and permanently visible, which is a feature. It tells
the next reader that `V7` was wrong and how it was corrected — strictly more information than a
silently-rewritten `V7` conveys.

## Gotchas

**★ Nothing at or below the applied baseline version is compared at all.** Not the checksum, not
the description, not the type. Baselining moves the verification boundary and everything under it
is taken on trust permanently.

**★ The boundary is the *applied* baseline, not the configured one.** It comes from the `BASELINE`
row in the history table, so a database baselined at `V50` and one baselined at `V10` verify
different amounts of the same repository while reporting the same clean result.

**★ `baseline-on-migrate` can create that boundary without anyone deciding to.** It baselines a
non-empty schema automatically on the next `migrate`, which silently switches verification off for
everything up to `baseline-version` — the documentation's own warning about it *"removing the
safety net"* is about exactly this.

**★ Descriptions are compared after truncation to 200 characters.** The resolved side is
abbreviated to the first 197 plus `...` before the equality test, so two descriptions differing
only past character 197 are identical as far as `validate` is concerned.

**★ `script` is truncated at 1000 characters too**, by the same utility. It matters only for
absurdly deep directory trees, and when it matters it is very confusing.

**★ Neither limit is configurable.** They exist to fit the history table's columns, and widening
the columns by hand does not change the Java constants.

**★ No ignore pattern can suppress a checksum, description or type mismatch.** The statuses are
`Missing`, `Pending`, `Ignored` and `Future`; a rewritten migration is still `SUCCESS`, and the
mismatch is a separate check that runs after the pattern test has already passed.

**★ That gap is deliberate and worth defending.** Tolerating a missing or future migration can
legitimately be team policy. Tolerating a rewritten one cannot, so Flyway offers no configuration
that lets you declare it acceptable and forget about it.

**★ Turning `validate-on-migrate` off suppresses all of it at once.** It is the only switch that
makes a checksum mismatch stop failing, and it removes every other check with it.

**★ Editing an applied migration produces no error at all on a database that never ran it.** A
fresh environment applies the edited file and reports perfect health. A green `validate` on a new
database proves nothing whatsoever about an old one.

**★ The environment that reports the problem is the one with the oldest database.** Development is
rebuilt from empty and stays quiet; whichever environment is long-lived is where it surfaces, and
that is often production.

**★ These holes are not reasons to relax the rule — they are the reason for it.** The discipline
has to hold in the cases the tool cannot see, and there is no way to tell from the outside which
case you are in.

**★ "The build is green" and "the schema is right" are different claims.** `validate` compares the
history table against the files. Nothing in it has ever looked at the actual schema — that is
[07b · Validate, not update](07b-validate-not-update.md)'s job.

## Interview questions

**★ Why does `validate` ignore everything below the baseline version?**
Because a baseline asserts that the schema at that version is correct however it was reached.
Comparing against files this database may deliberately never have run would fail every time. The
cost is that the reproducibility guarantee holds only above the baseline, and nothing tells you
where the line is except the `BASELINE` row.

**★ Two databases both report a clean `validate` but verify different things. How?**
They were baselined at different versions. The comparison is skipped at or below the *applied*
baseline, which is a per-database fact recorded in its own history table, not a property of the
repository.

**★ Why is `baseline-on-migrate` dangerous?**
It creates a baseline without anybody deciding to. Point an application at the wrong database, or
at one that has a schema but no history table, and instead of failing it writes a baseline row and
declares everything below it verified. The documentation's warning about removing the safety net
is precisely this.

**★ You rename a migration and `validate` does not complain. Why not?**
Two candidates. Either the migration is at or below the applied baseline, where nothing is
compared, or the description is long enough that the rename happens past character 197 and the
truncated forms are equal.

**★ Can you configure Flyway to tolerate a checksum mismatch?**
Not through `ignore-migration-patterns` — its statuses cover missing, pending, ignored and future,
and a rewritten migration is still in state `SUCCESS`. Your options are to fix the file, run
`repair`, or disable validation wholesale. The absence of a middle option is a design choice, not
an oversight.

**★ Why is it right that there is no such option?**
Because the other tolerances describe situations a team can reasonably adopt as policy — a
consolidated history, a rolled-back release. A rewritten migration is never a policy. It is either
a mistake to revert or a deliberate act to record, and both have an explicit action attached.

**★ Two environments show a clean `validate` and different schemas. How many ways can that happen?**
At least five, and they are worth being able to list: a placeholder with different values, an
edited Java migration with a null checksum, different applied baselines, a description difference
past the truncation limit, and the mundane one — somebody ran DDL by hand, which the history table
cannot see at all.

**★ If the tool's protection has this many holes, why bother with checksums?**
Because they catch the overwhelmingly common case — somebody edited a `.sql` file — early and
loudly, at application start rather than at the next incident. A partial detector that fires on the
frequent mistake is worth far more than the exhaustive one that does not exist.

**★ What is the right way to fix a mistake in a migration that shipped?**
Write the next migration. `V8` drops and recreates the mis-named index, or backfills the column
added with the wrong default. It is permanent, reviewable, and leaves the history honest about what
happened — strictly more information than a silently corrected `V7`.

**★ Someone argues that editing the migration is fine because staging and production will both be
rebuilt eventually. What do you say?**
That "eventually" is doing all the work. Between the edit and the rebuild, the database in
production has a schema no file describes, and if anything goes wrong in that window nobody can
reconstruct what it looked like. And databases that are genuinely rebuilt on demand rarely stay
that way for the lifetime of a product.

**★ Does any of this tell you whether the schema itself is correct?**
No, and that is the most important limitation of the whole mechanism. `validate` compares the
history table against the files on disk. A hand-run `ALTER TABLE` leaves both sides perfectly
consistent and the database wrong. Detecting that needs a comparison against the live schema.

{/* FOOTER */}
