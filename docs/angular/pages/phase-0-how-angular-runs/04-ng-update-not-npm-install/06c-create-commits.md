---
title: "`--create-commits` splits an update into one commit per migration — using `git add -A` and `--no-verify`, which is why the clean-tree precondition is not advice"
sidebar_label: "06c · `--create-commits`"
sidebar_position: 6.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/utilities/migration.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/migration.ts),
> [`packages/angular/cli/src/commands/update/utilities/git.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/utilities/git.ts),
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts).
> Documentation-validated; **no sandbox run**; every commit message shape and reporting string is
> quoted from the line that produces it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Without `--create-commits`, an `ng update` that touches four hundred files arrives as one
undifferentiated working-tree diff.** With it, the dependency bump is one commit and each migration
is another, named after the migration that made it — which turns an unreviewable change into a
reviewable sequence. The mechanism is two `git` invocations, and both of them carry a sharp edge
worth knowing before you use the flag: the staging is `git add -A`, and the commit is `--no-verify`.

## One commit per migration

```ts
if (commit) {
  const commitPrefix = `${packageName} migration - ${migration.name}`;
  const commitMessage = migration.description
    ? `${commitPrefix}\n\n${migration.description}`
    : commitPrefix;
  const committed = commitChanges(logger, commitMessage);
  if (!committed) {
    // Failed to commit, something went wrong. Abort the update.
    return 1;
  }
}
```

The subject line is exactly `<package> migration - <migration-name>`, and the migration's **full**
description — not the split title from
[06](06-required-and-optional-migrations.md), the whole field — becomes the body. So the commit log
carries the migration's own explanation of itself, which is the single most useful thing about the
flag six months later.

Note the abort: a failed commit returns `1` and stops the update. It does not carry on and leave you
with two migrations' changes in one commit.

The version change gets its own commit, from `cli.ts`:

```ts
if (!commitChanges(logger, `Angular CLI update for packages - ${packagesToUpdate.join(', ')}`))
```

exactly `Angular CLI update for packages - <pkg>, <pkg>`. So a v21 → v22 update with the two
canonical packages and three required migrations produces four commits: one dependency bump, then
one per migration in version order.

## What the commit actually does

```ts
export function createCommit(message: string) {
  // Stage entire working tree for commit.
  execGit(['add', '-A']);

  // Commit with the message passed via stdin to avoid bash escaping issues.
  execGit(['commit', '--no-verify', '-F', '-'], message);
}
```

🔴 **Two things in three lines, and both matter.**

**`git add -A` stages the entire working tree.** Not the files the migration touched — everything,
including untracked files. A scratch file, a `.env` you had not committed, a half-finished change in
an unrelated directory: all of it goes into the migration's commit, under a message claiming to be
that migration.

**`--no-verify` skips your hooks.** No pre-commit, no commit-msg. A team whose lint-staged setup or
conventional-commit check is the thing keeping the history clean gets neither on these commits — and
since the subject line is `<package> migration - <name>`, a commit-msg hook enforcing a
`feat:`/`fix:` prefix would have rejected them anyway. The flag is designed for a mechanical
sequence, not a hand-authored one.

⚠️ **This is why the clean-tree precondition is a precondition and not a courtesy.** `ng update`
refuses to run against a dirty tree by default, and `--allow-dirty` exists to override that. Passing
`--allow-dirty` *together with* `--create-commits` is the combination to avoid: the first says "I
have uncommitted work", the second says "sweep everything into a commit". Commit or stash first
instead:

```bash
git status --porcelain          # must be empty
ng update @angular/core @angular/cli --create-commits
```

The `-F -` is a small detail with a real reason, given in the comment: the message is piped on
stdin rather than passed as an argument, so a migration description containing quotes or backticks
cannot break the command.

## What it reports

Three strings, all indented two spaces because they sit under a migration's own output:

- `  No changes to commit after migration.`
- `  Committed migration step (<short-hash>): <first line>.`
- `  Failed to look up hash of most recent commit, continuing anyways.`

The first is common and benign — a migration that found nothing to change has nothing to commit, and
the update continues. The third is the interesting one: the commit **succeeded**, and only the
subsequent `git rev-parse` to report its hash did not. The CLI says so plainly and carries on, which
is the right call, but it means a missing hash in the log is not evidence of a missing commit.

## Reading the result

The point of the flag is the review, so the payoff is on the other side:

```bash
git log --oneline HEAD~4..HEAD
git show --stat HEAD~2          # exactly what one migration changed
git revert <hash>               # undo one migration without touching the rest
```

That last one is the strongest argument for the flag. Without it, backing out a single migration
from a four-hundred-file diff means identifying its changes by hand; with it, the migration is a
commit and `git revert` is the whole procedure.

## Gotchas

**★ Symptom: an unrelated scratch file ended up inside a migration commit.** Cause: `createCommit`
stages with `git add -A`, which sweeps the entire working tree including untracked files. Fix: start
from a genuinely clean tree, and check before you run rather than after:

```bash
git status --porcelain && git stash -u
ng update @angular/core --create-commits
```

**★ Symptom: pre-commit hooks did not run on any of the migration commits.** Cause: the commit is
made with `--no-verify`. Fix: this is deliberate and not overridable from the CLI. Run your checks
across the whole range afterwards, before pushing:

```bash
npx lint-staged --diff="HEAD~4 HEAD" || npx eslint .
```

**★ Symptom: `--create-commits` produced fewer commits than there were migrations.** Cause:
migrations that changed nothing print `No changes to commit after migration.` and produce no commit.
Fix: expected — the count of commits is the count of migrations that did something.

**★ Symptom: `Failed to look up hash of most recent commit, continuing anyways.` and you assume the
commit was lost.** Cause: the commit succeeded; only the follow-up hash lookup failed. Fix: check
the log rather than re-running anything — `git log --oneline -5` will show it.

**★ Symptom: the update aborted mid-way with a commit failure.** Cause: `commitChanges` returned
false, so `executeMigration` returned `1` deliberately rather than continuing and merging two
migrations into one commit. Fix: find out why git refused — an unset `user.email` in a container is
the usual cause in CI — then replay from the last successful migration:

```bash
git config user.email "ci@example.com" && git config user.name "CI"
ng update @angular/core --migrate-only --from 21.2.23 --create-commits
```

**★ Symptom: a commit-msg hook would have rejected these subjects, so the team banned the flag.**
Cause: the subject is fixed as `<package> migration - <name>` and hooks are skipped anyway, so the
two never meet. Fix: keep the flag and normalise afterwards if your history requires it — an
interactive rebase or a squash into one conventional commit preserves the review benefit during the
upgrade without polluting the branch.

**★ Symptom: you used `--allow-dirty` and `--create-commits` together and the first migration commit
contains someone else's work in progress.** Cause: the two flags compose badly by design — one
permits a dirty tree, the other commits all of it. Fix: never pair them; stash the in-progress work,
run the update, then unstash.

## Interview questions

**★ What exactly does `--create-commits` commit, and how?**
One commit for the dependency change, subject `Angular CLI update for packages - <pkg>, <pkg>`, then
one commit per migration that changed something, subject `<package> migration - <migration-name>`
with the migration's full description as the body. Each is produced by staging the entire working
tree with `git add -A` and committing with `--no-verify`, the message piped on stdin so quoting in a
description cannot break the command. The two sharp edges are exactly those git flags: anything else
in your tree is swept in, and none of your hooks run.

**★ Why is a clean working tree a precondition for `ng update`, rather than just a recommendation?**
Because of `git add -A`. With `--create-commits`, uncommitted and untracked files are staged into a
commit that claims to be a specific migration, which corrupts the one thing the flag exists to
provide — an accurate record of what each migration did. Without the flag it is less severe but
still bad: the update's changes and yours end up interleaved in one diff with no way to separate
them. `--allow-dirty` exists to override the check, and pairing it with `--create-commits` is the
combination to avoid.

**★ What is the practical payoff of one commit per migration?**
Reviewability and reversibility. A large update is otherwise a single diff spanning hundreds of
files with no attribution, so a reviewer cannot tell a mechanical rename from a semantic change, and
backing out one bad transformation means finding its edits by hand. With per-migration commits,
`git show --stat` answers "what did this migration do" and `git revert` answers "undo just this one"
— and the commit body carries the migration's own description, so the record explains itself
without the CLI's log.

**Why does a failed commit abort the update instead of continuing?**
Because the alternative is silently wrong. If migration three's commit fails and migration four then
runs and commits, the resulting commit contains both migrations' changes under migration four's
name — the history now lies. Returning `1` at the first failure keeps the invariant the flag
promises, at the cost of leaving the update partially applied, which is recoverable with
`--migrate-only --from`.

---

← Prev: [Running one migration](06b-running-one-migration.md) · Index: [Topic index](README.md) · Next → [The v22 migration inventory](07-the-v22-migration-inventory.md)
