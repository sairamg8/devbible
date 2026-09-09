---
title: "Running one migration is four steps, and the fourth is Prettier — which is why a migration that changed one line can arrive as a reformatted file, and why `--from 21` quietly means `21.0.0`"
sidebar_label: "06b · Running one migration"
sidebar_position: 6.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts)
> and its import of `formatFiles` from `../../../utilities/prettier`.
> Documentation-validated; **no sandbox run**; every message is quoted from the line that emits it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Each migration is announced, executed, counted and then formatted.** The formatting step is the
one nobody expects: since the CLI grew a Prettier integration, every file a migration touches is
run through Prettier afterwards. A migration that changes a single line in a file your team never
formatted will hand you that whole file as a diff — and the failure is soft, so a broken Prettier
config downgrades to a warning rather than stopping the update.

## The four steps, verbatim

```ts
logger.info(colors.cyan(figures.pointer) + ' ' + colors.bold(title));
if (description) { logger.info('  ' + description); }

const { success, files } = await executeSchematic(
  workflow, logger, migration.collection.name, migration.name,
);
if (!success) { return 1; }

let modifiedFilesText: string;
switch (files.size) {
  case 0:  modifiedFilesText = 'No changes made'; break;
  case 1:  modifiedFilesText = '1 file modified'; break;
  default: modifiedFilesText = `${files.size} files modified`; break;
}

if (files.size) {
  try {
    await formatFiles(process.cwd(), files);
  } catch (error) {
    assertIsError(error);
    logger.warn(
      `WARNING: Formatting of files failed with the following error: ${error.message}`,
    );
  }
}

logger.info(`  Migration completed (${modifiedFilesText}).`);
```

Read the order carefully, because it decides what you can conclude from the output:

1. **Announce** — the title, then the description body if the split in
   [06](06-required-and-optional-migrations.md) produced one.
2. **Execute** — a schematic run against the workflow. A failure returns `1` and aborts.
3. **Count** — `files.size` is the set the *schematic* touched, computed **before** formatting.
4. **Format** — Prettier over exactly that set, inside a `try`/`catch` that only warns.

🔴 **The count in `Migration completed (N files modified).` is the schematic's count, not the
diff's.** Formatting runs after the number is decided and can widen the change, so the reported
figure is a floor, not a total. `No changes made` is honest, though — with `files.size` zero, the
formatting block is skipped entirely.

## Prettier runs on every file a migration touched

```ts
import { formatFiles } from '../../../utilities/prettier';
```

This is the same direction of travel as `ng new` scaffolding `prettier` as a devDependency and
writing a `.prettierrc`: the CLI now assumes a formatter exists and uses it to clean up after
codemods, which genuinely improves migration output — a schematic emitting syntactically valid but
badly laid-out code gets tidied before you see it.

The cost lands on projects that do not format, or that format differently. A `@if` block written by
the control-flow migration is formatted to *Prettier's* preferences for the whole file it lives in,
not just the lines that changed.

⚠️ **The failure is soft, and the string is the only evidence:**
`WARNING: Formatting of files failed with the following error: <message>`. A missing config, an
unparseable file, a Prettier version that does not understand your syntax — all of them produce one
warning, and the migration is still reported as completed. In a long update log that warning is
easy to lose.

## When a migration fails

Two shapes come out of `executeSchematic`, both prefixed with the `figures.cross` glyph:

- `✖ Migration failed. See above for further details.`
- `✖ Migration failed: <message>` followed by `  See "<logPath>" for further details.`

The first means the schematic reported failure with detail already printed above it; the second
means it threw, and the message plus a log file path are the detail. Either way `executeMigration`
returns `1` and the update stops — which matters because, as
[03c · The install step and the rollback](03c-the-install-step-and-the-rollback.md) covers, the
version change has already happened by this point. You are left on the new version with the
migrations partially applied, and the way forward is to fix the cause and replay the range rather
than to re-run the update.

## Replaying: how `--name` and `--from` are resolved

```ts
if (options.name) {
  return executeMigration(workflow, logger, packageName, migrations, options.name, options.createCommits);
}

const from = coerceVersionNumber(options.from);
if (!from) {
  logger.error(`"from" value [${options.from}] is not a valid version.`);
  return 1;
}

return executeMigrations(
  workflow, logger, packageName, migrations, from,
  options.to || packageNode.version, options.createCommits,
);
```

Two distinct modes, and the code makes the priority explicit: `--name` short-circuits before
`--from` is even read. A named migration is looked up by exact name:

```ts
const name = collection.listSchematicNames().find((name) => name === migrationName);
if (!name) {
  logger.error(`Cannot find migration '${migrationName}' in '${packageName}'.`);
  return 1;
}
```

🔴 **`options.to || packageNode.version` — `--to` defaults to the *installed* version, not the
latest.** So `ng update @angular/core --migrate-only --from 21.0.0` replays every migration in the
half-open range up to and including whatever is in `node_modules` right now. That is the correct
default for the recovery case and a trap if you assumed it meant "latest".

The other strings from this path, for searching: `** Executing '<name>' of package '<package>' **`
and `Package is not installed.`

## `coerceVersionNumber` — why `--from 21` works

```ts
export function coerceVersionNumber(version: string | undefined): string | undefined {
  if (!version) { return undefined; }

  if (!/^\d{1,30}\.\d{1,30}\.\d{1,30}/.test(version)) {
    const match = version.match(/^\d{1,30}(\.\d{1,30})*/);
    if (!match) { return undefined; }

    if (!match[1]) {
      version = version.substring(0, match[0].length) + '.0.0' + version.substring(match[0].length);
    } else if (!match[2]) {
      version = version.substring(0, match[0].length) + '.0' + version.substring(match[0].length);
    } else {
      return undefined;
    }
  }

  return semver.valid(version) ?? undefined;
}
```

`21` becomes `21.0.0`; `21.2` becomes `21.2.0`. The same function is what gates a migration's own
`version` field, which is why an unparseable version in a collection means the migration is skipped
rather than reported.

⚠️ **Padding with zeros is not neutral for a replay.** `--from 21` is `21.0.0`, so it replays every
migration published across the whole of v21, not only the ones since the release you were actually
on. If you were on `21.2.23`, say so — otherwise you re-run months of migrations against a codebase
that has already had them.

## Gotchas

**★ Symptom: a migration that changed one line arrived as a whole-file reformat.** Cause:
`formatFiles` runs Prettier over every file the schematic touched, after the change. Fix: adopt the
scaffolded `.prettierrc` so the formatting is a one-time cost rather than a per-migration surprise,
or format the file separately first so the migration's commit contains only the migration:

```bash
npx prettier --write "src/app/**/*.{ts,html}"
git commit -am "format before migration"
```

**★ Symptom: `WARNING: Formatting of files failed with the following error: …` and the update
succeeded.** Cause: the Prettier step is wrapped in a `try`/`catch` that warns and continues. Fix:
read the message — an unresolvable config or a parse error usually means the migrated files were
left unformatted, not that anything was corrupted. Re-run Prettier by hand once the config is fixed.

**★ Symptom: `Migration completed (2 files modified).` but `git status` shows nine changed files.**
Cause: the count is `files.size` from the schematic, computed before formatting; Prettier then
touched more. Fix: trust the diff, not the count. If you need them separable, use `--create-commits`
so each migration's change is its own commit.

**★ Symptom: `Cannot find migration 'control-flow' in '@angular/core'.`** Cause: `--name` matches
the schematic name exactly, with no prefix or fuzzy matching. Fix: list what the collection actually
publishes and copy the name:

```bash
node -p "Object.keys(require('@angular/core/schematics/migrations.json').schematics).join('\n')"
```

**★ Symptom: `"from" value [v21] is not a valid version.`** Cause: `coerceVersionNumber` only pads
numeric versions — it accepts `21` and `21.2`, but a leading `v` fails the initial regex and the
match. Fix: drop the prefix; pass `21.2.23`.

**★ Symptom: `--migrate-only --from 21` re-ran far more migrations than expected.** Cause: `21`
coerces to `21.0.0` and `--to` defaults to the installed version, so the range was the whole of v21
plus everything up to what you now have. Fix: pass the version you were actually on, read from git
rather than guessed:

```bash
git show HEAD~1:package.json | grep '"@angular/core"'
ng update @angular/core --migrate-only --from 21.2.23
```

**★ Symptom: a migration failed, you fixed the cause, re-ran `ng update`, and it said everything was
already up to date.** Cause: the version change happened before migrations ran, so the update has
nothing left to do. Fix: replay the range with `--migrate-only --from` — this is the recovery
surface those flags exist for, and it is covered in full in
[03d · The option surface](03d-the-option-surface.md).

**★ Symptom: `Package is not installed.` from a `--migrate-only` run.** Cause: the package named is
not present in `node_modules` — commonly because the install step failed earlier in the same update,
or because the name is misspelled. Fix: install first; migrations are read off the installed package
on disk, not off the registry.

## Interview questions

**★ Why did a migration reformat files it did not otherwise change?**
Because after the schematic runs, the CLI passes the exact set of touched files to Prettier via
`formatFiles`. It is a deliberate quality step — codemods emit valid but untidy code — and it pairs
with `ng new` now scaffolding Prettier and a `.prettierrc`. The consequence for an existing project
that does not format, or formats differently, is that a one-line semantic change arrives as a
whole-file diff. It is also why the number in `Migration completed (N files modified)` can be lower
than the number of files in your working tree: that count is taken before formatting runs.

**★ A migration failed halfway through `ng update`. What state is the project in, and how do you
finish?**
The versions have already moved — the install happens before migrations — so the project is on the
new version with an arbitrary prefix of the migrations applied. Re-running `ng update` does nothing,
because there is no version change left to make. The recovery is to fix the cause and replay the
range with `ng update <package> --migrate-only --from <the version you were on>`, where `--to`
defaults to the installed version and therefore covers exactly the migrations the interrupted run
owed you.

**★ What does `--from 21` actually mean?**
`21.0.0`. `coerceVersionNumber` pads a bare major to three segments and a `major.minor` to three as
well, so `21` and `21.2` are both accepted. The trap is that the padding is downward: if you were on
`21.2.23`, passing `21` replays every migration published across the entire v21 line, not the ones
you missed. The habit worth having is to read the previous version out of git rather than typing a
major.

**How does the CLI decide a migration's name, and what happens if you get it wrong?**
`--name` is matched exactly against `collection.listSchematicNames()`; there is no prefix matching
and no suggestion. A miss logs `Cannot find migration '<name>' in '<package>'.` and returns 1. The
names are the keys of the collection's `schematics` object, which is worth knowing because it means
you can enumerate the valid values straight out of `node_modules` rather than searching
documentation.

**Why is the Prettier step wrapped in a `try`/`catch` that only warns?**
Because formatting is cosmetic and the migration's actual work has already succeeded by that point.
Failing the update over a formatter problem would strand a project mid-migration for a reason that
has nothing to do with correctness. The trade-off is visibility: the only evidence is one
`WARNING:` line in a long log, and the practical effect — migrated files left unformatted — looks
like nothing at all.

---

← Prev: [Required and optional migrations](06-required-and-optional-migrations.md) · Index: [Topic index](README.md) · Next → [`--create-commits`](06c-create-commits.md)
