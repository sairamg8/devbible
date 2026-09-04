---
title: "A migration that has run is a historical fact, and the checksum is the only mechanism Flyway has for noticing that the fact has been rewritten — so it is worth knowing precisely which edits it catches"
sidebar_label: "04 · Checksums and immutability"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `ChecksumCalculator`
> ([ChecksumCalculator.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/resolver/ChecksumCalculator.java)),
> `MigrationInfoImpl.validate()`
> ([MigrationInfoImpl.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/info/MigrationInfoImpl.java)),
> `SqlMigrationResolver`
> ([SqlMigrationResolver.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/resolver/sql/SqlMigrationResolver.java)),
> and the *Validate* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/validate)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**Editing a migration that has already run is the one rule everybody repeats and almost nobody
can justify precisely. The justification is not that Flyway forbids it — Flyway will happily
apply an edited migration to a database that has never seen it. The justification is that after
the edit, two databases built from the same repository are different, and no tool anywhere can
tell you which one is right. The checksum is how Flyway notices the divergence, and it is a
narrower instrument than its reputation suggests.**

## What the checksum actually is

For a SQL migration it is a **CRC-32**, and the source that computes it is short enough to read
in one sitting:

```java
private static int calculateChecksumForResource(final LoadableResource resource) {
    final CRC32 crc32 = new CRC32();
    BufferedReader bufferedReader = new BufferedReader(resource.read(), 4096);
    String line = bufferedReader.readLine();
    if (line != null) {
        line = BomFilter.FilterBomFromString(line);
        do {
            crc32.update(line.getBytes(StandardCharsets.UTF_8));
        } while ((line = bufferedReader.readLine()) != null);
    }
    return (int) crc32.getValue();
}
```

Four properties fall straight out of those eight lines, and each one answers a question that
otherwise gets answered by folklore:

- **It is fed lines, never line terminators.** `readLine()` strips `\n`, `\r\n` and `\r`, and the
  terminator is never handed to `crc32.update`. The javadoc on the enclosing method says so
  outright: *"The checksum is encoding and line-ending independent."*
- **It re-encodes to UTF-8 before hashing.** The file is *decoded* using the configured
  `encoding`, then each line is *re-encoded* as UTF-8. Two files whose bytes differ but whose
  characters are identical hash the same.
- **A byte-order mark is removed from the first line only.** `BomFilter` runs once, before the
  loop, so a BOM cannot change the checksum.
- **A blank line contributes nothing.** `"".getBytes(UTF_8)` is a zero-length array and
  `CRC32.update` on zero bytes is a no-op — so inserting, removing or moving empty lines leaves
  the checksum untouched.

It is CRC-32, not a cryptographic hash. It exists to catch accident, not to resist an attacker,
and a 32-bit value over an unbounded input has collisions by construction. Nobody has ever
reported one in practice, and it would not be a security problem if they did — but the mental
model should be *"a change detector"*, not *"a fingerprint"*.

## Exactly which edits change it, and which do not

This is the table worth internalising, because the surprises are all on the right-hand column.

| The edit | Checksum? | Why |
|---|---|---|
| Change any SQL text | ✅ changes | different bytes on some line |
| Add or remove a statement | ✅ changes | ditto |
| Add or edit a `--` comment | ✅ changes | comments are lines like any other |
| Add a trailing space to a line | ✅ changes | `readLine` strips the terminator, not the spaces |
| Change indentation | ✅ changes | leading whitespace is part of the line |
| Reformat a statement across more lines | ✅ changes | the same characters, differently distributed |
| Change letter case of a keyword | ✅ changes | it is a byte comparison, not a SQL parse |
| Convert LF → CRLF (or a `.gitattributes` change) | ⛔ **no change** | terminators are never hashed |
| Convert UTF-8 → UTF-16 with `encoding` set to match | ⛔ **no change** | decoded, then re-encoded to UTF-8 |
| Add or remove a UTF-8 BOM | ⛔ **no change** | filtered from the first line |
| Insert, delete or move blank lines | ⛔ **no change** | zero bytes fed to the CRC |
| Add a trailing newline at end of file | ⛔ **no change** | the final terminator is dropped |
| Rename the file's **description** | ⛔ no change | but `description` mismatches — see below |
| Rename the file's **version** | ⛔ no change | it becomes a different migration entirely |
| Move the file to another location | ⛔ no change | but `script` changes — see below |
| Change a **placeholder value** in config | ⛔ no change **for a versioned migration** | see [04b](04b-the-edits-nothing-catches.md) |
| Edit a **Java** migration's code | ⛔ no change | it has no checksum at all by default — see [04b](04b-the-edits-nothing-catches.md) |

The three rows with a checkmark for "not the checksum, but something else" matter as much as the
checksum rows, because they produce a *different* error with a *different* fix.

## The three things `validate` compares, in the order it compares them

`validate` *"validates the applied migrations against the available ones"* and fails on
*"differences in migration names, types or checksums"*. In the source those are three separate
checks, and they run in a fixed order:

```java
if (resolvedMigration.getType() != appliedMigration.getType()) {          // 1. TYPE_MISMATCH
    ...
}
if (!isChecksumMatching()) {                                              // 2. CHECKSUM_MISMATCH
    ...
}
if (descriptionMismatch(resolvedMigration, appliedMigration)) {           // 3. DESCRIPTION_MISMATCH
    ...
}
```

The order is not cosmetic. **The first failure returns**, so a type mismatch hides a checksum
mismatch, and a checksum mismatch hides a description mismatch. A migration that was rewritten
from `V7__x.sql` into `V7__x.java` reports a type problem and says nothing about the fact that
its contents also changed.

All three compose the same message, from one format string in `createMismatchMessage`:

```java
return String.format("Migration " + mismatch + " mismatch for migration %s\n"
        + "-> Applied to database : %s\n"
        + "-> Resolved locally    : %s\n"
        + "Either revert the changes to the migration, or run repair to update the schema history.",
    migrationIdentifier, applied, resolved);
```

That last sentence is the whole decision, and it is a real decision rather than a formality:
**revert** if the edit was a mistake, **repair** if the edit was deliberate and you are certain
every database that ran the old version is compatible with the new text. [04d · What `repair`
actually does](04d-what-repair-actually-does.md) takes that apart.

## The three failure modes, and the fix for each

### The checksum changed — you edited an applied migration

The common case, and the one everybody means when they say "don't edit migrations". It is caught
on the next `validate`, which under Spring Boot means **the next application start**, because
`validate-on-migrate` defaults to `true` and `migrate` runs during context refresh.

The reason this one bites so hard is a timing asymmetry. The developer who made the edit almost
certainly rebuilt their local database from empty, where the edited file simply ran and worked.
The failure appears first in whatever environment has a long-lived database — usually staging, and
occasionally straight to production if staging is also rebuilt.

### The description changed — you renamed the file

`V7__Add_index.sql` renamed to `V7__Add_index_on_orders.sql` does not change one byte of SQL, so
the checksum is identical. The `description` column still says `Add index`, and the comparison is:

```java
return !AbbreviationUtils.abbreviateDescription(resolvedMigration.getDescription())
        .equals(appliedMigration.getDescription());
```

Note `abbreviateDescription`. Descriptions are truncated to fit the column — anything over 200
characters becomes the first 197 plus `...` — and the *resolved* side is abbreviated before
comparison, so a 250-character description does not spuriously mismatch. `script` gets the same
treatment at 1000 characters. Both limits are in `AbbreviationUtils` and neither is configurable.

### The type changed — you rewrote it in another language

`SQL` → `JDBC` (a Java migration), or `SQL` → `SQL_BASELINE` (adding a `B` prefix). Rare, but it
is the check that runs first, so it is the one that reports.

## Three failure modes is the complete list — which is the problem

Everything above is what `validate` *catches*. It is a short list, and the interesting question is
what falls outside it: an entire category of edits that change what a migration does while leaving
all three comparisons perfectly satisfied.
[04b · The edits nothing catches](04b-the-edits-nothing-catches.md) is that category —
the checksum that is allowed to be absent, and the substitution that happens after it was taken.
[04c · Where the comparison does not run](04c-where-the-comparison-does-not-run.md) adds the two
conditions that switch the comparison off entirely, and takes up the argument this page's thesis
opened: why the rule survives even though Flyway has no enforcement behind it.

## Gotchas

**★ Changing line endings does not change the checksum, and this is the one thing people expect to
go wrong that does not.** The CRC is fed lines with the terminator already stripped, so a Windows
checkout, a `.gitattributes` normalisation and a `dos2unix` are all invisible to it.

**★ Adding a blank line does not change the checksum either.** An empty line contributes zero
bytes. Deleting one is equally invisible.

**★ A trailing space on a line *does* change it.** Whitespace inside the line is hashed; only the
terminator is not. An editor configured to strip trailing whitespace on save will break a
migration nobody consciously edited.

**★ Reformatting is a content change.** Re-indenting a `CREATE TABLE` or splitting a long
statement across more lines produces a mismatch even though the SQL is identical.

**★ Renaming a migration file produces a *description* mismatch, not a checksum mismatch.**
Different error, same severity — and the message names the field, so read which of the three it
actually reported.

**★ A description over 200 characters is truncated in the history table**, and the resolved side
is truncated before comparison so the two still agree. Two migrations whose descriptions differ
only after character 197 are indistinguishable in the history.

**★ The three comparisons short-circuit in order.** Type, then checksum, then description. A type
mismatch reports and returns, so you never learn from that run whether the contents also changed.

**★ `validate-on-migrate` is `true` by default, so under Spring Boot the check runs at
application start.** The failure is a startup failure, not a deployment-tool failure, which is
why it so often surfaces as "the pod will not come up".

**★ The mismatch is discovered by the environment with the oldest database.** Developers rebuild
from empty and see nothing wrong; whichever environment is long-lived is the one that reports it,
and that is often production.

**★ CRC-32 is a change detector, not a fingerprint.** It is 32 bits over unbounded input. Treat it
as "this file is not the file that ran", never as a cryptographic guarantee.

**★ The error message offers two fixes and they are not equivalent.** *Revert* restores the truth;
*repair* rewrites the record to match a file that some databases never ran. Choosing repair
because it makes the error go away is how history quietly becomes fiction.

## Interview questions

**★ Why can you not edit a migration that has already run?**
Because the migration set claims that replaying the files produces the schema, and after the edit
that claim is false for every database that ran the old text. Those databases now have a schema
that no file describes, and nothing can tell you what the difference is. Flyway's checksum is how
the divergence gets noticed; the reason for the rule is reproducibility, not the tool.

**★ How is the checksum computed, and what does that imply?**
A CRC-32 over the file's lines, each re-encoded to UTF-8, with the line terminators stripped by
`readLine` and a BOM removed from the first line. So it is line-ending and encoding independent,
blank lines are invisible to it, and everything else about the text — including indentation and
trailing spaces — is not.

**★ Does changing a file from LF to CRLF break a migration?**
No. That is the most common thing people expect to break and it does not, by design. The
terminator is never fed to the CRC.

**★ You rename `V7__Add_index.sql` to `V7__Add_index_on_orders.sql`. What happens?**
The checksum is unchanged, because no line changed. `validate` fails with a **description**
mismatch instead, because the `description` column still holds the old text. Same severity,
different message, and the same two options: rename it back, or `repair`.

**★ What three things does `validate` compare, and in what order?**
Type, checksum, description — and it returns on the first failure. So a type mismatch masks a
checksum mismatch, and a checksum mismatch masks a description mismatch.

**★ Why did the change work locally and fail in staging?**
Because the local database was rebuilt from empty and simply ran the edited file, which is a
perfectly valid thing to do to a database that never saw the original. Staging has the old row and
the new file, which is the only situation in which the mismatch exists.

**★ The build says "Migration checksum mismatch". What are your options?**
Revert the file to what actually ran, or run `repair` to realign the recorded checksum with the
file. Revert unless you have positively established that every database carrying the old row is
compatible with the new text — and if it is not, neither option is right and you need a new
migration that reconciles them.

**★ Is a CRC-32 collision a realistic risk?**
Not in practice, and it would not be a security issue if it happened — the checksum defends
against accident, not against a person deliberately constructing a colliding migration. Anyone
able to do that can also just edit the history table.

**★ Under Spring Boot, when exactly is the mismatch detected?**
During context refresh, when `FlywayMigrationInitializer` calls `migrate()`, because
`validate-on-migrate` defaults to `true`. The application fails to start — it does not start and
then misbehave — which is the correct failure mode and the reason not to turn the check off.

{/* FOOTER */}
