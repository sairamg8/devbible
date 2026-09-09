---
title: "`ng update` runs twelve steps in a fixed order, and knowing which step you are on tells you exactly what state your project is in when something fails"
sidebar_label: "03 · What `ng update` actually does"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts),
> [`.../update/utilities/git.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/git.ts),
> [`.../update/update-resolver.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/update-resolver.ts).
> Documentation-validated; **no sandbox run** — every message below is quoted from the source line
> that emits it. There are no transcripts on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ng update` is not one operation, it is twelve, and they happen in a fixed order that the source
makes explicit.** That ordering is the difference between a failure you can shrug off and one that
leaves your project in pieces: a refusal in step 0 or step 7 has changed nothing at all, while a
failure in step 10 has already deleted `node_modules` and rewritten `package.json`. Reading the
sequence once means never having to guess what state you are in when a message appears — and the
messages are quoted below from the lines that print them, so you can match what you see to where
you are.

## Step 0 — the working tree must be clean

Before yargs even hands over to the command body, its `.check()` runs:

```ts
if (packages?.length && !checkCleanGit(this.context.root)) {
  if (allowDirty) {
    logger.warn(
      'Repository is not clean. Update changes will be mixed with pre-existing changes.',
    );
  } else {
    throw new CommandModuleError(
      'Repository is not clean. Please commit or stash any changes before updating.',
    );
  }
}
```

The message, exact:

> **`Repository is not clean. Please commit or stash any changes before updating.`**

This is a design decision, not a safety blanket. `ng update`'s entire value proposition is that it
produces a **reviewable, revertible diff** — migrations rewrote four hundred files and the only way
to trust that is `git diff`. Starting from a dirty tree destroys that property, so the command
refuses rather than producing a diff you cannot separate.

The opt-out is `--allow-dirty`, whose own description is *"Whether to allow updating when the
repository contains modified or untracked files."* It downgrades the error to a warning; it does
not make the resulting diff any easier to read.

🔴 **The check is scoped to the workspace root, not the whole repository.** `checkCleanGit`'s doc
comment says so:

> *"Checks if the git repository is clean. This function only checks for changes that are within
> the specified root directory. Changes outside the root directory are ignored."*
> — [`utilities/git.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/git.ts)

In a monorepo that means a dirty sibling package elsewhere in the repo **does not block** the
update. Useful, and worth knowing before you spend twenty minutes stashing changes in a package the
command was never going to look at.

Note also the `packages?.length &&` guard: a bare `ng update` reports without checking git at all,
because it changes nothing ([01d](01d-a-bare-ng-update-is-a-report.md)).

## The twelve steps

**1 · Version check, and possibly a re-execution.** If your installed CLI is behind the target
major, the command installs a temporary CLI and re-executes itself under it — the whole mechanism,
including why `ng --version` afterwards can disagree with what ran, is
[02c · How the CLI keeps its own promise](02c-how-the-cli-keeps-its-own-promise.md).

**2 · Parse each package identifier.** Non-registry specifiers are rejected outright:

```ts
if (!packageIdentifier.registry) {
  logger.error(`Package '${request}' is not a registry package identifer.`);
  return 1;
}
```

⚠️ The typo *"identifer"* is in the source. Quoted unaltered — if you are grepping your terminal
scrollback for it, that is the spelling to search for. Duplicates are refused in the same pass:
**`Duplicate package '<name>' specified.`**

**3 · Resolve a bare name to a dist-tag.**

```ts
if (packageIdentifier.rawSpec === '*') {
  packageIdentifier.fetchSpec = options.next ? 'next' : 'latest';
  packageIdentifier.type = 'tag';
}
```

So `ng update @angular/core` means `latest`, and `ng update @angular/core --next` means the `next`
tag. This is the step that decides which dist-tag every subsequent decision is made against.

**4 · Report the package manager and collect the dependency tree.**

```ts
logger.info(`Using package manager: ${colors.gray(packageManager.name)}`);
logger.info('Collecting installed dependencies...');
const rootDependencies = await packageManager.getProjectDependencies();
logger.info(`Found ${rootDependencies.size} dependencies.`);
```

The first line is worth reading rather than skipping: `ng update` detects your package manager and
several later steps behave differently depending on which one it found
([03c · The install step](03c-the-install-step-and-the-rollback.md)).

**5 · With no packages named, print the report and stop.** Return code 0, nothing changed. That
whole path is [01d · A bare `ng update` is a report](01d-a-bare-ng-update-is-a-report.md).

**6 · Validate each named package against the tree.** Three refusals live here, all exact:
**`Package '<name>' is not a dependency.`**, **`Package '<name>' is already at '<version>'.`** and
**`Package '<name>' is already up to date.`** The second and third are no-ops rather than errors,
and they are the reason a hand-bumped `package.json` cannot be repaired by simply running
`ng update` afterwards — the tool believes you are already there.

**7 · Fetch registry metadata, then apply the major-version guard.**
`logger.info('Fetching dependency metadata from registry...')`, and then the comparison that
refuses a two-major jump — [02 · One major at a time](02-one-major-at-a-time.md). **Everything up
to and including this point is read-only.** A failure here has changed nothing.

**8 · Resolve the update plan.** Peer dependencies are validated in both directions here, and this
is where `--force` applies. The gate is **05 · The peer-dependency gate** *(not written yet)*; the
`@angular/core`-specific range widening that happens as part of it is in
[02c](02c-how-the-cli-keeps-its-own-promise.md).

**9 · Back up `package.json` in memory, then write the new ranges.** The original file content is
held in a variable — this is the rollback that step 10's failure path uses — and `applyUpdatePlan`
rewrites the manifest. What exactly it writes, and the three surprising things it does while
writing, are [03b · What it writes](03b-what-it-writes-to-your-project.md).

🔴 **Step 9 is the boundary.** Before it, nothing on disk has changed. From here on, failure means
recovery rather than a clean exit.

**10 · Two install tasks, titled exactly `Cleaning node modules directory` and `Installing
packages`.** The cleaning task is skipped for every package manager except npm. If the install
fails, `package.json` is restored and **nothing else is** — see
[03c · The install step](03c-the-install-step-and-the-rollback.md).

**11 · Optionally commit the dependency change.** With `--create-commits` / `-C`, the manifest and
lockfile change lands as its own commit before any migration runs, so the dependency move and the
source rewrites are never mixed in one diff.

**12 · Run the migrations.** Per package with an `ng-update` key: required migrations first under a
banner naming the package, then the optional ones behind a prompt. The two buckets, the prompt, the
per-migration output and the recovery flags are **06 · Required and optional migrations** *(not
written yet)*.

## Reading a failure by its step

| Where it failed | Your project is | What to do |
|---|---|---|
| step 0 (dirty tree) | untouched | commit or stash, or `--allow-dirty` deliberately |
| steps 2–8 (parse, validate, guard, peers) | untouched | fix the command or the dependency; nothing to clean up |
| step 10 (install) | `package.json` restored, `node_modules` deleted on npm, lockfile touched | restore the lockfile from git and reinstall — [03c](03c-the-install-step-and-the-rollback.md) |
| step 12 (a migration) | dependencies fully updated, some migrations applied | fix forward with `--migrate-only`; do not re-run the whole update |

That last row is the one people get wrong. A failed migration does **not** mean the update failed —
the dependency change succeeded and some migrations already ran. Re-running the full `ng update`
will tell you the package is *"already up to date"* and do nothing. The way back in is
`--migrate-only`, which is [03d · The option surface](03d-the-option-surface.md).

## Gotchas

**★ Symptom: `Repository is not clean. Please commit or stash any changes before updating.` in
CI.** Cause: something inside the workspace root is modified or untracked — a generated file, a
build artefact, a lockfile the job rewrote before this step. Fix: `.gitignore` the artefact, or
commit it, rather than reaching for the flag. If you do use the flag, understand that you are giving
up the reviewable-diff property that is most of the command's value:

```bash
git status --porcelain          # find what is actually dirty first
ng update @angular/cli@^22 @angular/core@^22 --allow-dirty   # only if you must
```

**★ Symptom: you stashed changes across your whole monorepo to satisfy the clean-tree check and
half of them were irrelevant.** Cause: the check only examines the workspace root — *"Changes
outside the root directory are ignored."* Fix: only the workspace you are updating needs to be
clean; leave the rest of the repo alone.

**★ Symptom: `Package 'my-lib' is not a registry package identifer.`** Cause: you passed a git,
file or workspace specifier. `ng update` only accepts registry identifiers. Fix: update that
dependency with your package manager and run its migrations separately if it has any — and note the
source's spelling if you are searching for the message.

**★ Symptom: `Package '@angular/core' is already up to date.` on a project you know is behind.**
Cause: the installed version already satisfies the target you named — commonly because someone
hand-edited `package.json`, or because you named a bare major that is already satisfied. Fix: this
is why a hand-bump is unrecoverable by simply running `ng update`; the migrations must be driven
directly, with `--migrate-only --from`, which is [03d · The option surface](03d-the-option-surface.md).

**★ Symptom: an `ng update` that failed partway is re-run from the top and reports there is nothing
to do, while the source is still half-migrated.** Cause: step 6's no-op check looks at versions, and
the versions moved in step 9 even though migrations in step 12 did not complete. Fix: drive the
remaining migrations explicitly rather than re-running the update.

**★ Symptom: the update took a completely different path on a colleague's machine.** Cause: step 4
detects the package manager, and steps 10 onward differ by manager — the `node_modules` wipe is
npm-only. Fix: expected; check the `Using package manager:` line, which is printed precisely so this
is diagnosable.

**★ Symptom: you cannot tell whether a failure happened before or after anything was written.**
Cause: the messages do not announce a step number. Fix: use step 9 as the landmark. If you have not
yet seen `Cleaning node modules directory` or `Installing packages`, nothing on disk has changed.

## Interview questions

**★ Walk through what `ng update @angular/cli@^22 @angular/core@^22` does, in order.**
It checks the git working tree is clean within the workspace root and refuses otherwise. It checks
whether the installed CLI is behind the target major and, if so, installs a temporary CLI and
re-executes itself under it. It parses the two identifiers, rejecting non-registry specifiers and
duplicates, resolves bare names to the `latest` dist-tag, reports the detected package manager and
collects the installed dependency tree. It validates that each named package is actually a
dependency and is actually behind, fetches registry metadata, and applies the guard that refuses a
jump of more than one major. It resolves an update plan — validating peer dependencies, where
`--force` applies — then backs up `package.json` in memory and writes the new version ranges. It
cleans `node_modules` (npm only) and installs, optionally committing the dependency change. Finally
it runs each package's migrations, required ones without asking and optional ones behind a prompt.

**★ A migration failed. Is the update rolled back?**
No. The rollback in this command covers exactly one failure — the install step — and it restores
exactly one thing, `package.json`. By the time migrations run, the dependency change has been
written and installed and some migrations have already applied their edits. The project is in a
real, intermediate state, and the correct response is to fix forward using `--migrate-only` rather
than to re-run the whole command, which will report that the package is already up to date and do
nothing.

**★ Why does `ng update` insist on a clean working tree?**
Because the command's output is a large diff produced by programs, and the only way to review or
revert that diff is for it to be the *only* thing in the working tree. Mixing it with pre-existing
changes destroys both properties at once. The check is scoped to the workspace root — the doc
comment states that changes outside it are ignored — and `--allow-dirty` downgrades the refusal to a
warning for the cases where you have decided the trade is worth it.

**Which parts of `ng update` are read-only?**
Everything up to and including the update-plan resolution and the major-version guard. Parsing,
dependency collection, no-op detection, registry metadata fetching, the one-major check and peer
validation all happen before `package.json` is written. The first thing to touch disk is the
manifest rewrite, immediately before the install tasks.

**What does the `Using package manager:` line change downstream?**
More than it looks. The `node_modules` wipe before install runs only for npm, and npm 7 or later has
`--force` pushed at it during the install. So the same command does measurably different things
depending on what step 4 detected — which is why the line is printed at all.

**Why can a hand-bumped `package.json` not be repaired by running `ng update` afterwards?**
Because step 6 compares the installed version against the target and short-circuits with
`Package '<name>' is already at '<version>'.` or `Package '<name>' is already up to date.` The
migrations you need are selected by a range built from the *installed* version, and you destroyed
that input when you edited the number. The recovery is to drive the migrations directly with
`--migrate-only` and an explicit `--from`.

{/* FOOTER */}
