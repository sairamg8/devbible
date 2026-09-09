---
title: "Required migrations run without asking and optional ones prompt — which means an `ng update` in CI silently transforms less of your codebase than the identical command on a laptop"
sidebar_label: "06 · Required and optional migrations"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts)
> — the schematic description interface, the bucket split, the TTY branch and
> `getMigrationTitleAndDescription` are quoted verbatim from that file.
> Documentation-validated; **no sandbox run**; every message below is quoted from the line that
> emits it and no transcript is reconstructed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular ships two kinds of migration and treats them completely differently: required ones run
without asking, optional ones ask.** The consequence is the single most important operational fact
in this topic — **there is no way to answer a prompt in CI, so a pipeline's `ng update` skips every
optional migration and tells you about it in output nobody reads.** The codebase that comes out of
an automated upgrade is therefore not the codebase that comes out of the same command run by a
person, and the difference accumulates across majors.

## The four fields that classify a migration

A migration is a schematic with four extra fields on its description:

```ts
export interface MigrationSchematicDescription extends SchematicDescription<
  FileSystemCollectionDescription,
  FileSystemSchematicDescription
> {
  version?: string;
  optional?: boolean;
  recommended?: boolean;
  documentation?: string;
}
```

| Field | What it decides |
|---|---|
| `version` | Whether the migration falls in the range being replayed |
| `optional` | Which bucket it lands in — and therefore whether you are asked |
| `recommended` | Whether its checkbox is **pre-ticked** in the prompt |
| `documentation` | A URL, resolved relative to `https://angular.dev` |

The bucket split is one line:

```ts
(description.optional ? optionalMigrations : requiredMigrations).push(…);
```

🔴 **A migration with no `version` is skipped entirely, silently:**

```ts
description.version = coerceVersionNumber(description.version);
if (!description.version) {
  continue;
}
```

There is no warning. If you author a migration collection and forget the `version` field, your
migration is not broken — it simply never runs, and nothing tells you.

## Required migrations: a banner, then work

```ts
if (requiredMigrations.length) {
  logger.info(colors.cyan(`** Executing migrations of package '${packageName}' **\n`));
  requiredMigrations.sort(compareMigrations);
  const result = await executePackageMigrations(…);
  if (result === 1) { return 1; }
}
```

The banner, exactly: `** Executing migrations of package '<name>' **`

They are sorted by version before running, which is the mechanism behind the one-major-at-a-time
rule — migrations are applied in release order, each assuming the shape the previous one left
behind. Nothing prompts, nothing is skippable, and a non-zero result aborts the whole update.

## Optional migrations: a prompt, or a list you have to act on yourself

```ts
if (optionalMigrations.length) {
  logger.info(colors.magenta(`** Optional migrations of package '${packageName}' **\n`));
  optionalMigrations.sort(compareMigrations);
  const migrationsToRun = await getOptionalMigrationsToRun(logger, optionalMigrations, packageName);
  if (migrationsToRun?.length) {
    return executePackageMigrations(workflow, logger, migrationsToRun, packageName, commit);
  }
}
```

Inside `getOptionalMigrationsToRun`, the count is announced and then the code forks on whether it
has a terminal:

```ts
logger.info(
  `This package has ${numberOfMigrations} optional migration${
    numberOfMigrations > 1 ? 's' : ''
  } that can be executed.`,
);

if (!isTTY()) {
  for (const migration of optionalMigrations) {
    const { title } = getMigrationTitleAndDescription(migration);
    logger.info(colors.cyan(figures.pointer) + ' ' + colors.bold(title));
    logger.info(colors.gray(`  ng update ${packageName} --name ${migration.name}`));
    logger.info('');
  }
  return undefined;
}

logger.info(
  'Optional migrations may be skipped and executed after the update process, if preferred.',
);
…
const answer = await askChoices(
  `Select the migrations that you'd like to run`,
  optionalMigrations.map((migration) => {
    const { title, documentation } = getMigrationTitleAndDescription(migration);
    return {
      name: `[${colors.white(migration.name)}] ${title}${documentation ? ` (${documentation})` : ''}`,
      value: migration.name,
      checked: migration.recommended,
    };
  }),
  null,
);
```

🔴 **`return undefined` on the non-TTY branch is the whole story.** No optional migration runs. The
caller receives nothing to execute, prints nothing further, and the update continues to completion
and reports success. What you get instead is a list of the commands you could have run, in a log,
after the fact.

Three strings worth knowing verbatim, because they are what you grep a CI log for:

- `This package has N optional migrations that can be executed.`
- `Optional migrations may be skipped and executed after the update process, if preferred.`
- `Select the migrations that you'd like to run`

The first appears in **both** branches; the second and third only ever appear on a terminal. So the
test for "did this run have a prompt" is the presence of the second string, not the first.

`checked: migration.recommended` is why some boxes arrive pre-ticked and others do not — and note
that *recommended* is a publisher's opinion carried in the collection, not a judgement the CLI makes
about your project.

## How a migration's description becomes the title you see

```ts
function getMigrationTitleAndDescription(migration: MigrationSchematicDescription): {
  title: string;
  description: string;
  documentation?: string;
} {
  const [title, ...description] = migration.description.split('. ');

  return {
    title: title.endsWith('.') ? title : title + '.',
    description: description.join('.\n  '),
    documentation: migration.documentation
      ? new URL(migration.documentation, 'https://angular.dev').href
      : undefined,
  };
}
```

🔴 **The `description` field is split on `'. '` — first sentence becomes the title, everything after
becomes the body.** That single line explains the house style of every description in every
`migrations.json`: they are written to a format, first sentence short enough to be a heading.

Two consequences for anyone authoring a collection. An abbreviation with a period followed by a
space (`e.g. this`) truncates your title at the abbreviation. And a description that is one long
sentence gets a title equal to the whole thing and an empty body.

`documentation` is resolved with `new URL(value, 'https://angular.dev')`, which is why the CLI's own
collection stores a bare path such as `tools/cli/build-system-migration` rather than a full URL —
and why an absolute URL there would also work, since `new URL` ignores the base when the input is
absolute.

## Gotchas

**★ Symptom: the CI upgrade produced a smaller diff than the same command run locally, on the same
commit.** Cause: no TTY, so `getOptionalMigrationsToRun` returned `undefined` and every optional
migration was skipped. Fix: run them explicitly as a second step in the pipeline — the log already
printed the exact commands:

```bash
ng update @angular/core --migrate-only --from 21.2.23
ng update @angular/core --name control-flow-migration
```

**★ Symptom: your pipeline's `ng update` reports success and months later a required migration
depends on an optional one you never ran.** Cause: optional migrations are the ones that rot —
nothing re-offers them, and the window in which they were cheap closes. Fix: treat the optional list
as work, not as noise. Grep the log for the count line and fail the job if it is non-zero and
unhandled:

```bash
grep -q 'optional migration' update.log && echo 'optional migrations pending — handle before merge'
```

**★ Symptom: you skipped an optional migration during the prompt and want it back.** Cause: the
prompt is offered once, during the update. Fix: run it by name afterwards — and note that `--name`
implies `--migrate-only`, so no version moves:

```bash
ng update @angular/core --name control-flow-migration
```

**★ Symptom: a migration you wrote never runs and prints no error.** Cause: no `version` field on
its schematic description, so `coerceVersionNumber` returned `undefined` and the loop hit `continue`.
Fix: add the version the migration applies from:

```json
{
  "control-flow-migration": {
    "version": "22.0.0",
    "description": "Migrate to the built-in control flow syntax. Structural directives are replaced with @if, @for and @switch.",
    "factory": "./control-flow-migration/index"
  }
}
```

**★ Symptom: a migration's title in the prompt is cut off mid-sentence.** Cause: the description was
split on `'. '`, and an abbreviation such as `e.g. ` matched first. Fix: write descriptions whose
first sentence is the title and avoid abbreviations with trailing periods in it.

**★ Symptom: some optional migrations are pre-ticked and you assumed the CLI analysed your
project.** Cause: `checked: migration.recommended` reads a boolean the *publisher* set in the
collection. Fix: it is a default, not advice about your codebase; read each one before accepting the
pre-ticked set.

**★ Symptom: `This package has 3 optional migrations that can be executed.` appears in CI and you
concluded the prompt was shown and answered.** Cause: that line prints in both branches. Fix: the
line that only appears with a terminal is `Optional migrations may be skipped and executed after the
update process, if preferred.` — grep for that one to tell the two runs apart.

## Interview questions

**★ What is the difference between a required and an optional migration, and who decides which is
which?**
The `optional` boolean on the migration's schematic description, set by whoever publishes the
migration collection — Angular for its own packages, the library author for anyone else. Required
migrations run automatically and in version order, and a failure aborts the update. Optional ones
are collected separately and offered as a multi-select prompt, with `recommended` deciding which
boxes start ticked. The decision is a publisher's judgement about whether the change is necessary
for correctness or merely desirable.

**★ You ran `ng update` in CI and the resulting codebase differs from a local run of the same
command. Why?**
Because optional migrations are prompted for, and there is no way to prompt without a terminal. The
CLI checks `isTTY()`; when there is none it prints each optional migration's title and the
`ng update <package> --name <migration>` command that would run it, then returns `undefined` — so
none of them execute and the update still reports success. The fix is to treat the printed commands
as a required second stage of the pipeline rather than as informational output. The deeper point for
an interview is that this is a *silent* divergence: nothing fails, and the gap only shows up later
as a codebase that is several majors behind on transformations it was offered.

**★ How do you run a single migration after the fact, and what does that command not do?**
`ng update <package> --name <migration-name>`. It does not change any installed version — `--name`
implies `--migrate-only` — so it is safe to run against a project that is already on the target
version. It is the documented recovery path for a skipped optional migration and the practical one
for a CI pipeline.

**Why does a migration with no `version` field silently do nothing?**
Because the loop that builds the two buckets coerces `version` first and `continue`s when the result
is falsy, with no logging. Migrations are selected by semver range, so a migration with no version
cannot be placed in any range and is unreachable by construction. It is a real authoring trap: the
collection is valid, the schematic is valid, and the only symptom is absence.

**What does `recommended` actually mean?**
Only that the checkbox starts ticked. It carries no enforcement and no analysis of your project — it
is the publisher saying "most people should take this one". Reading it as a project-specific
recommendation is the mistake, and it matters because accepting the pre-ticked set unread is how a
large refactoring migration lands in a diff nobody expected.

---

← Prev: [What else shapes the plan](05b-what-else-shapes-the-plan.md) · Index: [Topic index](README.md) · Next → [Running one migration](06b-running-one-migration.md)
