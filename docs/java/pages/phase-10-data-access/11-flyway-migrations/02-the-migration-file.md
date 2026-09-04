---
title: "a Flyway migration file name is a five-part grammar — prefix, version, separator, description, suffix — and every one of the five is configurable, which is why a file that looks right can still be invisible to the tool"
sidebar_label: "02 · The migration file"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Redgate Flyway documentation *Migrations*
> ([documentation.red-gate.com/fd/migrations-271585107.html](https://documentation.red-gate.com/fd/migrations-271585107.html)),
> *Versioned migrations*
> ([documentation.red-gate.com/fd/versioned-migrations-273973333.html](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)),
> *Repeatable migrations*
> ([documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/repeatable-migrations)),
> *Undo migrations*
> ([documentation.red-gate.com/flyway/flyway-concepts/migrations/undo-migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/undo-migrations)),
> *Baseline migrations*
> ([documentation.red-gate.com/fd/baseline-migrations-273973336.html](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html))
> and Spring Boot 4.1's `FlywayProperties` source
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**Flyway discovers migrations by parsing file names, and the file name is the entire interface.
There is no manifest, no index, no registration step: a file whose name matches the grammar is a
migration and a file whose name does not is an inert resource sitting silently on the classpath.
That is the whole failure mode to understand — the tool does not tell you about a file it did
not recognise, because it never saw one.**

## The grammar

For a versioned migration, the documentation gives the structure as
**prefix + version + separator + description + suffix**:

```
V   2      __     add_cancelled_at_to_orders   .sql
│   │      │      │                            │
│   │      │      │                            └─ suffix
│   │      │      └─ description
│   │      └─ separator (two underscores)
│   └─ version
└─ prefix
```

Each of the five is a configuration setting, and Spring Boot exposes all five:

| Part | Default | Flyway setting | Spring Boot property |
|---|---|---|---|
| prefix (versioned) | `V` | `sqlMigrationPrefix` | `spring.flyway.sql-migration-prefix` |
| prefix (repeatable) | `R` | `repeatableSqlMigrationPrefix` | `spring.flyway.repeatable-sql-migration-prefix` |
| prefix (undo) | `U` | `undoSqlMigrationPrefix` | *(no Boot property — Teams edition)* |
| prefix (baseline) | `B` | `baselineMigrationPrefix` | *(no Boot property)* |
| version | — | *(parsed, not configured)* | — |
| separator | `__` | `sqlMigrationSeparator` | `spring.flyway.sql-migration-separator` |
| description | — | *(parsed, not configured)* | — |
| suffix | `.sql` | `sqlMigrationSuffixes` | `spring.flyway.sql-migration-suffixes` |

Two of those repay a second look.

**The suffix setting is a list, not a string.** Its Boot default is `[".sql"]`. Multiple
suffixes exist so that files can carry an extension an editor or a database tool already
associates with something — Oracle's `.pkg` and `.pkb` are the documented example. A single
migration file still has exactly one suffix; the list is the set of suffixes Flyway will
recognise.

**The separator is two underscores, and one is the most common typo in the ecosystem.**
`V2_add_column.sql` parses as version `2_add_column` with no description at all, or fails to
parse — either way it is not the migration you meant. Two underscores, always.

## The four prefixes

| Prefix | Kind | Has a version? | Runs | Edition |
|---|---|---|---|---|
| `V` | versioned | yes | once, in version order | any |
| `R` | repeatable | no | whenever its checksum changes, last | any |
| `U` | undo | yes — matches a `V` | on the `undo` command only | 🔴 **Teams** |
| `B` | baseline | yes | only on a database with no history | any |

**`V` — versioned.** The workhorse. *"Each versioned migration must be assigned a unique
version"*, and *"Versioned migrations are applied in the order of their versions."*

**`R` — repeatable.** No version, so the name is prefix + separator + description + suffix:
`R__order_summary_view.sql`. Re-applied *"every time their checksum changes"*, always after all
pending versioned migrations, in **alphabetical order of description**. This is
[05 · Repeatable migrations](05-repeatable-migrations.md).

**`U` — undo.** *"EDITION: TEAMS"* — quoted directly from the documentation page. `U2__…sql`
undoes `V2__…sql`, and only when you explicitly run the `undo` command. It is not a rollback of
a failed migration; the documentation is candid that *"Undo migrations assume the whole
migration succeeded and should now be undone"* and that *"They work for undoing schema changes
but not so well for undoing data changes."* On Community, plan without it.

**`B` — baseline migration.** *"B5__my_database.sql represents the state of your database after
applying all versioned migrations up to and including V5."* It is a single collapsed script
used only by databases that have no history yet; existing databases ignore it. Note the trap in
the name — *"Baseline migrations are not affiliated with the `baseline` command"*, which is a
different thing entirely and is [06 · Baselining](06-baselining.md).

## Versions: what is a valid one, and how they sort

*"Any version is valid as long as it conforms to the usual dotted notation or an underscore
separated notation."* So dots and underscores are interchangeable **inside the version**, which
is exactly why the separator has to be two of them:

| File name | Version | Description |
|---|---|---|
| `V1__init.sql` | `1` | `init` |
| `V1.1__add_index.sql` | `1.1` | `add_index` |
| `V1_1__add_index.sql` | `1.1` | `add_index` |
| `V2026.08.26.14.05__add_column.sql` | `2026.8.26.14.5` | `add_column` |
| `V001.002__NewTwitterColumn.sql` | `1.2` | `NewTwitterColumn` |

*"Versions are sorted numerically as you would normally expect"* — part by part, as numbers,
not as text. Three consequences follow and all three catch people:

**Zero padding is cosmetic.** `V001` and `V1` are the *same version*. Padding makes a directory
listing sort the way the tool sorts; it does not change the comparison. It also means
`V001__init.sql` and `V1__init.sql` are a duplicate-version conflict, not two migrations.

**More parts is greater when the shared prefix is equal.** `1.1` sorts after `1`. So `V1.1`
slots between `V1` and `V2`, which is how a hotfix gets inserted into a sequence that has
already been released.

**A version is not a timestamp unless you make it one.** `V2026.08.26.14.05` works because dots
separate the parts and each part is numeric — it is a five-part version that happens to read as
a date.

The description is the rest of the name up to the suffix, with underscores read as spaces —
`add_cancelled_at_to_orders` becomes `add cancelled at to orders` in the history table's
`description` column. Spaces in the file name work too and are worse: they survive into shell
commands, CI logs and URLs. Use underscores.

## What the description is actually for

It is not decoration. It is stored, it is compared, and it is what you read at three in the
morning.

- It lands in the `description` column of `flyway_schema_history`, which is often the only
  human-readable trace of what a migration did — [03 · The history table](03-the-history-table.md).
- `validate` fails on *"differences in migration names, types or checksums"*, so renaming an
  applied migration's description breaks validation exactly as editing its body does.
- For repeatable migrations it is the **sort key**, so `R__a_roles.sql` runs before
  `R__b_permissions.sql`. If one view depends on another, the description is how you order them.

Write it as what the migration does, in the imperative, at the granularity of the change:
`V7__add_unique_index_on_customer_email.sql`, not `V7__fix.sql` and not
`V7__CUST-1423.sql`. A ticket number is a pointer to a system that may not outlive the table.

## The rest of the name is not free-form

Two settings govern what happens to a file that does not parse.

**`spring.flyway.validate-migration-naming`** — *"Whether to validate migrations and callbacks
whose scripts do not obey the correct naming convention."* Its default in Boot is **`false`**,
which means the default behaviour is to **ignore** an unparseable file rather than complain
about it. That is the silence described at the top of this page.

```yaml
spring:
  flyway:
    validate-migration-naming: true
```

Turn it on. The cost is that a stray `.sql` file in the migrations directory becomes a startup
failure; the benefit is that a migration you fat-fingered becomes a startup failure too, which
is the one you care about.

**`spring.flyway.fail-on-missing-locations`** — default **`false`** — decides whether a
configured location that does not exist is an error. Also worth turning on, for the same
reason: a typo in `spring.flyway.locations` otherwise produces a service that starts happily
having applied nothing at all.

## A worked directory

```
src/main/resources/db/migration/
├── V1__create_customers.sql
├── V2__create_orders.sql
├── V2.1__backfill_orders_currency.sql
├── V3__add_cancelled_at_to_orders.sql
└── R__order_summary_view.sql
```

Read as: three released versions, one hotfix inserted between 2 and 3 after 2 had shipped, and
one view that is rebuilt whenever its definition changes. The order Flyway applies them in on
an empty database is `V1`, `V2`, `V2.1`, `V3`, then `R__order_summary_view` last.

## Gotchas

**★ A misnamed file is silently ignored.** With `validate-migration-naming` at its default of
`false`, Flyway skips what it cannot parse and says nothing. The symptom is not an error — it
is a table that does not exist at runtime.

**★ One underscore instead of two.** `V2_add_column.sql` does not mean version 2 with the
description "add column". It is the single most frequent naming mistake and the least visible.

**★ Zero padding does not create a distinct version.** `V001` and `V1` are the same version and
will collide. Pick a padding width at the start of the project and never mix.

**★ Lowercase `v` is not the prefix.** The prefix is `V` and it is case-sensitive on a
case-sensitive filesystem. `v2__thing.sql` is not a migration on Linux, and may be one on
macOS — which produces the worst possible failure: works locally, missing in CI.

**★ A version can go backwards relative to what is already applied, and Flyway will refuse
it.** Adding `V2.1` after `V3` has run in production means `V2.1` is *out of order*. By default
that fails validation; `spring.flyway.out-of-order: true` permits it. Use the setting
deliberately, not to silence an error you did not expect.

**★ Renaming an applied migration breaks `validate`.** The name and description are compared,
not just the body. A tidy-up commit that renames `V4__fix.sql` to
`V4__add_index_on_orders.sql` fails every environment that already ran `V4`.

**★ `sql-migration-suffixes` is a list and setting it replaces the default.** Configuring
`spring.flyway.sql-migration-suffixes: .pkg` means `.sql` is no longer recognised. Include
`.sql` explicitly if you are extending rather than replacing.

**★ Undo migrations are a Teams feature.** `U`-prefixed files on a Community setup are, at
best, files nobody runs. Do not design a release process around them without checking your
licence.

**★ A `B`-prefixed baseline migration and the `baseline` command are unrelated.** The
documentation says so in as many words. Two different mechanisms with confusingly similar
names, and [06 · Baselining](06-baselining.md) separates them.

**★ Two developers pick the same version number on two branches.** Nothing catches it until the
branches merge, and then the database has one of them applied and the other is a duplicate.
This is the whole reason timestamp versions exist — [02c · Choosing version numbers](02c-choosing-version-numbers.md).

**★ Description text is a sort key for `R__` files and nothing more for `V__` files.** Renaming
a repeatable migration changes when it runs relative to its siblings, which is a real behaviour
change disguised as a cosmetic edit.

## Interview questions

**★ What are the parts of a Flyway migration file name?**
Prefix, version, separator, description, suffix — `V2__add_cancelled_at.sql`. The prefix
selects the migration type, the version orders it, the separator is two underscores, the
description is stored in the history table, and the suffix is `.sql` by default.

**★ What happens to a file in the migrations directory that does not match the pattern?**
By default, nothing — it is ignored without a message, because `validateMigrationNaming` is
`false`. Setting `spring.flyway.validate-migration-naming: true` turns it into a startup
failure, which is what you want.

**★ Is `V1__x.sql` different from `V001__x.sql`?**
No. Versions are compared numerically, so `1` and `001` are the same version, and having both
is a duplicate-version conflict rather than two migrations.

**★ How do you insert a migration between two that have already been released?**
Give it a version between them — `V2.1` sits between `V2` and `V3`. If the higher version has
already been applied to the target database, that is an out-of-order migration and needs
`spring.flyway.out-of-order: true` to be accepted.

**★ What are the four prefixes and what does each mean?**
`V` versioned (runs once, in order), `R` repeatable (re-runs whenever its checksum changes,
after all versioned migrations, in description order), `U` undo (Teams edition, run only by the
`undo` command), and `B` baseline migration (a collapsed script applied only to a database with
no history yet).

**★ Why do dots and underscores both work inside a version?**
Because the documentation defines a version as "the usual dotted notation or an underscore
separated notation" — they are the same thing to the parser. That is precisely why the
*separator* has to be two underscores: one would be ambiguous with a version part.

**★ Where does the description end up, and does it matter?**
In the `description` column of `flyway_schema_history`, where it is often the only readable
record of a change. It is also compared by `validate`, so renaming an applied migration fails
validation, and for repeatable migrations it is the alphabetical sort key that decides run
order.

**★ You added a migration, deployed, and the table still is not there — no error anywhere. What
do you check first?**
The file name and the location, in that order. A parse failure and a wrong location both
produce silence by default. Turn on `validate-migration-naming` and `fail-on-missing-locations`
so that neither can be silent again.

{/* FOOTER */}
