---
title: "There is a whole category of change that alters what a migration does while leaving the checksum, the description and the type all perfectly satisfied — and the rule against editing migrations survives precisely because the tool cannot be relied on to notice"
sidebar_label: "04b · The edits nothing catches"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `MigrationInfo.isChecksumMatching()`
> ([MigrationInfo.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/api/MigrationInfo.java)),
> `BaseJavaMigration`
> ([BaseJavaMigration.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/api/migration/BaseJavaMigration.java)),
> `SqlMigrationResolver.getChecksumForLoadableResource`
> ([SqlMigrationResolver.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/resolver/sql/SqlMigrationResolver.java)),
> `MigrationInfoImpl.validate()`
> ([MigrationInfoImpl.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/info/MigrationInfoImpl.java)),
> and the *Placeholders* and *Java-based migrations* references
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/java-based-migrations)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**[04](04-checksums-and-immutability.md) is the half people know: change the SQL, and `validate`
tells you. This is the half that decides whether you trust the tool or the discipline. Two
mechanisms let you change what an applied migration does while leaving every comparison
satisfied — the checksum that is allowed to be absent, and the substitution that happens after the
checksum was taken. Neither is carelessness. Both are Flyway doing exactly what it was designed to
do, for reasons that are defensible one at a time and dangerous together.**

## A null checksum is a *match*, not a mismatch

The comparison in `04` was `isChecksumMatching()`. Here it is in full, from `MigrationInfo`:

```java
default boolean isChecksumMatching() {
    return getResolvedChecksum() == null
        || getAppliedChecksum() == null
        || getResolvedChecksum().equals(getAppliedChecksum());
}
```

Two short-circuits before the equality test, and both return **true**. If either side has no
checksum, the pair is declared to agree. The same shape appears in `isTypeMatching()` and
`isDescriptionMatching()` — absence is never a failure anywhere in the comparison.

That is a reasonable default in isolation: a migration type that genuinely cannot be checksummed
should not fail every run forever. It becomes a real hole the moment a migration type routinely
*has* no checksum. One does.

## Java migrations have no checksum unless you write one

`BaseJavaMigration` is what every Java migration extends, and its `getChecksum()` is:

```java
@Override
public Integer getChecksum() {
    return null;
}
```

So a `JDBC`-type migration ships with a null checksum, `isChecksumMatching()` returns `true`
unconditionally, and **the body of a Java migration can be rewritten arbitrarily with no
detection whatsoever**. Not a warning, not a different error — no signal at all. Combine that with
`04`'s point that the file was probably edited by somebody whose local database is rebuilt from
empty, and a Java migration is a rewriting hazard that leaves no trace anywhere.

The fix is one method, and it is the reason to write it even when it feels like ceremony:

```java
public class V9__Backfill_customer_region extends BaseJavaMigration {

    @Override
    public Integer getChecksum() {
        return 20260826;          // bump deliberately whenever the logic changes meaning
    }

    @Override
    public void migrate(Context context) throws Exception {
        try (var statement = context.getConnection().createStatement()) {
            statement.execute("UPDATE customers SET region = 'unknown' WHERE region IS NULL");
        }
    }
}
```

A hand-maintained integer is not a hash — it does not change when you change the code, only when
you remember to change it. That is worse than a CRC and much better than nothing, because it turns
"nobody will ever know" into "the person editing this has to make a decision". Some teams compute
it from the SQL string the migration builds, which restores the automatic property at the cost of
a little machinery.

⚠️ **`checksum` in the history table is nullable**, and a null there is exactly what a Java
migration writes. A row with an empty `checksum` is not corruption — it is the normal state of a
`JDBC`-type migration, and it is why *"no checksum recorded"* is not a diagnosis.

## Placeholders: versioned and repeatable behave differently

Flyway substitutes `${placeholder}` tokens into migration text at run time. The question nobody
asks is *when* the checksum is taken — before or after the substitution — and the answer is
**both, depending on the migration type**. From `SqlMigrationResolver`:

```java
private Integer getChecksumForLoadableResource(final boolean repeatable,
    final List<LoadableResource> loadableResources,
    final ResourceName resourceName,
    final boolean placeholderReplacement) {
    if (repeatable && placeholderReplacement) {
        parsingContext.updateFilenamePlaceholder(resourceName, configuration);
        return ChecksumCalculator.calculate(createPlaceholderReplacingLoadableResources(loadableResources));
    }
    return ChecksumCalculator.calculate(loadableResources.toArray(LoadableResource[]::new));
}
```

- **Repeatable migration, placeholders on** → checksum of the **substituted** text.
- **Everything else, including every versioned migration** → checksum of the **raw** file.

The asymmetry is deliberate and it follows from what each type is for. A repeatable migration is
re-applied *when its checksum changes*, so it must notice a changed placeholder — otherwise a view
whose definition depends on `${schema}` would never be rebuilt after the schema moved. A versioned
migration runs once and never again, so there is nothing for a changed checksum to trigger.

The consequence is the part to carry away:

```sql
-- V12__Grant_read_access.sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${readonly_role};
```

Change `readonly_role` from `reporting` to `analytics` in configuration, and `V12`'s checksum is
byte-for-byte identical. Every environment reports a clean `validate`, and two databases have
grants to two different roles from what the history insists is the same migration. Nothing in
Flyway is wrong here; the record simply does not describe the change, because the change was never
in the file.

⚠️ **The same applies to `${flyway:*}` built-ins** — `flyway:defaultSchema`, `flyway:user`,
`flyway:database`, `flyway:timestamp`. A versioned migration containing `${flyway:user}` produces
different SQL under a different deployment identity with an unchanged checksum. `flyway:timestamp`
in a versioned migration is worse still: it is different on every single run, which is invisible
because the run happens once.

The practical rule: **a versioned migration should not depend on a placeholder whose value could
reasonably differ between environments.** If it must, the placeholder value belongs in the
repository next to the migration, not in per-environment configuration.

## Two more places the comparison simply does not run

Both mechanisms above are about *what* gets hashed. There are also two places where the comparison
is skipped entirely regardless of what the checksum says — below the baseline, and past the length
limit on a description. Those, and the question of why the rule against editing migrations survives
at all given how much the tool cannot see, are
[04c · Where the comparison does not run](04c-where-the-comparison-does-not-run.md).

## Gotchas

**★ A null checksum on either side counts as matching.** `isChecksumMatching()` returns `true`
when either value is absent. Absence is never a failure anywhere in Flyway's comparison.

**★ Java migrations have no checksum by default, so editing one is completely undetectable.**
`BaseJavaMigration.getChecksum()` returns `null`. This is the single largest hole in the model and
it affects the migration type most likely to contain complicated logic.

**★ A hand-written `getChecksum()` only changes when a human remembers to change it.** It converts
silence into a decision point; it does not restore automatic detection.

**★ A `NULL` in the history table's `checksum` column is normal, not corruption.** It is what every
Java migration writes.

**★ Changing a placeholder value does not change a versioned migration's checksum.** The checksum
is taken on the raw file. Two environments can run genuinely different SQL from the same migration
with identical recorded checksums.

**★ A repeatable migration behaves the opposite way** — its checksum is taken *after* substitution,
so a changed placeholder re-runs it. Do not generalise from one to the other.

**★ `${flyway:timestamp}` in a versioned migration is different on every run and nothing notices**,
because a versioned migration only ever runs once per database.

## Interview questions

**★ Can Flyway detect every change to an applied migration?**
No. A null checksum counts as a match, Java migrations have no checksum by default, placeholder
values are outside a versioned migration's checksum, and nothing at or below the applied baseline
is compared at all. The rule against editing migrations is a discipline that has to hold where the
tool is blind.

**★ You edit the body of a Java migration that already ran. What happens?**
Nothing. `BaseJavaMigration.getChecksum()` returns `null`, `isChecksumMatching()` short-circuits to
`true`, and no environment reports anything. The remedy is to override `getChecksum()` so the
migration has an identity at all, and to bump it deliberately when the logic changes.

**★ Why does a null checksum count as matching rather than failing?**
Because a migration type that legitimately cannot be checksummed would otherwise fail validation
forever. Defensible in isolation; the problem is that Java migrations fall into it by default
rather than by exception.

**★ You change a placeholder value in configuration. Which migrations notice?**
Repeatable ones, whose checksum is computed after substitution — they will be re-applied.
Versioned ones do not: their checksum is computed on the raw file, so the change is invisible and
the migration will not run again anyway.

**★ Why is that asymmetry there?**
Because a repeatable migration is triggered *by* its checksum changing, so it must see through the
substitution — a view defined in terms of `${schema}` has to be rebuilt when the schema moves. A
versioned migration runs once; there is nothing for a changed checksum to trigger.

**★ Is it safe to use placeholders in a versioned migration?**
Only for values that are the same everywhere, or that live in the repository beside the migration.
A placeholder whose value differs per environment means the same recorded migration produced
different schemas, and nothing in the history says so.

**★ How would you close the Java-migration hole across a codebase?**
Require `getChecksum()` on every `JavaMigration`, enforced by a test that reflects over the
implementations and fails when one returns `null`. That test costs almost nothing and converts the
most dangerous migration type from silent to noisy.

{/* FOOTER */}
