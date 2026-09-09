---
title: "Ten flags, four of which imply or forbid each other — and the four that do are the entire recovery surface for an update that went wrong"
sidebar_label: "03d · The option surface"
sidebar_position: 3.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts)
> — every option description below is quoted verbatim from the yargs builder in that file, and the
> `implies` / `conflicts` relationships are read from the same declarations.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Most of `ng update`'s flags are self-explanatory and one cluster is not.** `--migrate-only`,
`--name`, `--from` and `--to` exist to run migrations *without* changing any version, and they are
wired together with yargs `implies` and `conflicts` rules that make several combinations
impossible. That cluster is the only way back into a project whose update went wrong — a migration
that crashed, an optional migration declined in CI, a `package.json` someone hand-bumped — so it is
worth knowing precisely rather than approximately.

## Every option, verbatim

| Option | Type | Default | Description, quoted from the builder |
|---|---|---|---|
| `packages` (positional, array) | string | — | *"The names of package(s) to update."* |
| `--force` | boolean | `false` | *"Ignore peer dependency version mismatches."* |
| `--next` | boolean | `false` | *"Use the prerelease version, including beta and RCs."* |
| `--migrate-only` | boolean | — | *"Only perform a migration, do not update the installed version."* |
| `--name` | string | — | *"The name of the migration to run. Only available when a single package is updated."* |
| `--from` | string | — | *"Version from which to migrate from. Only available when a single package is updated, and only with 'migrate-only'."* |
| `--to` | string | — | *"Version up to which to apply migrations. Only available when a single package is updated, and only with 'migrate-only' option. Requires 'from' to be specified. Default to the installed version detected."* |
| `--allow-dirty` | boolean | `false` | *"Whether to allow updating when the repository contains modified or untracked files."* |
| `--verbose` | boolean | `false` | *"Display additional details about internal operations during execution."* |
| `--create-commits` / `-C` | boolean | `false` | *"Create source control commits for updates and migrations."* |

## The constraints, and where they are enforced

Three of them are declarative, expressed on the yargs option definitions themselves:

- **`--name`** carries `conflicts: ['to', 'from']`. You either name one migration or you name a
  range; asking for both is a contradiction and yargs rejects it.
- **`--from`** carries `implies: ['migrate-only']`.
- **`--to`** carries `implies: ['from', 'migrate-only']` — so `--to` alone is an error, and `--to`
  always drags `--from` and `--migrate-only` in with it.

One is imperative, in the command's argument middleware:

```ts
.middleware((argv) => {
  if (argv.name) {
    argv['migrate-only'] = true;
  }
  …
})
```

🔴 **`--name` silently turns on `--migrate-only`.** That is the single most useful fact about this
cluster: `ng update @angular/cli --name use-application-builder` **changes no versions at all**. It
installs nothing, rewrites no ranges, and runs exactly one migration against the tree you already
have.

And one is a runtime check with its own message:

```ts
if (migrateOnly) {
  if (packages?.length !== 1) {
    throw new CommandModuleError(
      `A single package must be specified when using the 'migrate-only' option.`,
    );
  }
}
```

Exact: **`A single package must be specified when using the 'migrate-only' option.`** Not zero
packages, not two. Every migrate-only invocation names precisely one package, because migrations
belong to packages and the range is computed per package.

## The recovery surface, worked

**A migration crashed partway through an otherwise successful update.** The dependency change
landed; you fixed whatever made the migration fail; you need the migrations to finish. Do not
re-run the update — step 6 will report the package is already up to date and do nothing. Replay the
range instead:

```bash
ng update @angular/core --migrate-only --from=21.2.23
```

`--from` is the version you were on before, and `--to` defaults to *"the installed version
detected"* — which is now v22, because step 9 already wrote it. So this replays exactly the
migrations the interrupted run was supposed to apply.

**An optional migration was declined, or was never offered because CI has no TTY.** Name it:

```bash
ng update @angular/cli --name use-application-builder
```

**Someone hand-bumped `package.json` and no migration ever ran.** This is the case
[chunk 01](01-why-npm-install-is-not-an-upgrade.md) warns about, and it is recoverable — but only
by telling the tool what the installed version *used to be*, because that information was destroyed:

```bash
ng update @angular/core --migrate-only --from=21.2.23 --to=22.1.5
```

⚠️ You have to know the real previous version. If nobody recorded it, `git log -p package.json`
does — which is the argument for the dependency change being its own commit.

## The rest of the flags

**`--create-commits` / `-C`** turns the update into a series of reviewable commits — one for the
dependency change, then one per migration — instead of a single unreadable diff. On any update of
consequence this should be the default habit, not the exception.

**`--verbose`** is the flag that makes internal decisions visible, including the npm-force
announcement in [03c](03c-the-install-step-and-the-rollback.md). Reach for it the moment a run does
something you did not expect.

**`--next`** changes which dist-tag targets resolve from, and it changes the runner CLI too —
`getCLIUpdateRunnerVersion` returns the `next` tag rather than a major
([02c](02c-how-the-cli-keeps-its-own-promise.md)). A `--next` update therefore runs unreleased
migrations against your source. That is a legitimate thing to do on a throwaway branch to see what
is coming, and not a thing to do on `main`.

**`--force`** is peer-dependency-specific and nothing else: *"Ignore peer dependency version
mismatches."* It does **not** bypass the one-major guard ([02](02-one-major-at-a-time.md)), and it
is unrelated to the `--force` the CLI passes to npm at install time.

**`--allow-dirty`** downgrades the clean-tree refusal to a warning
([03 · step 0](03-what-ng-update-actually-does.md)).

## Gotchas

**★ Symptom: `A single package must be specified when using the 'migrate-only' option.`** Cause:
you passed zero packages or more than one alongside a migrate-only flag — often without realising,
because `--name` and `--from` both turn migrate-only on implicitly. Fix: name exactly one package
per invocation and run the command twice if you need two:

```bash
ng update @angular/core --migrate-only --from=21.2.23
ng update @angular/cli  --migrate-only --from=21.2.23
```

**★ Symptom: `ng update @angular/cli --name use-application-builder` did not update anything, and
you expected it to.** Cause: `--name` implies `--migrate-only`, so no version moves by design. Fix:
this is correct behaviour — run the ordinary update separately if you also want the version change.

**★ Symptom: yargs rejected your command when you combined `--name` with `--from`.** Cause:
`--name` declares `conflicts: ['to', 'from']`. Fix: they are two different modes — one named
migration, or every migration in a version range. Pick one.

**★ Symptom: `--to` on its own produced an error about `--from`.** Cause: `--to` declares
`implies: ['from', 'migrate-only']`; a range needs both ends. Fix: supply `--from` explicitly.

**★ Symptom: `--migrate-only` ran nothing at all.** Cause: `--to` defaults to the *installed*
version, so if `--from` is at or above the installed version the computed range is empty. Fix: check
what is actually installed before choosing `--from`:

```bash
node -p "require('./node_modules/@angular/core/package.json').version"
ng update @angular/core --migrate-only --from=21.2.23
```

**★ Symptom: you cannot recover a hand-bumped project because nobody knows the old version.**
Cause: `--from` is the input the range needs, and editing `package.json` destroyed the record of it.
Fix: `git log -p -- package.json` will show the previous value if the change was ever committed;
if it was not, the honest answer is that the migration range cannot be reconstructed reliably.

**★ Symptom: `--force` did not get you past `Updating multiple major versions ... is not
supported.`** Cause: `--force` is scoped to peer dependency mismatches only. Fix: no flag bypasses
the major guard; run the ladder ([02b · Running the ladder](02b-running-the-ladder.md)).

**★ Symptom: a `--next` update pulled pre-release everything, including the CLI that ran the
migrations.** Cause: `--next` propagates — it changes both the resolved targets and the runner CLI
version. Fix: expected; keep `--next` on a branch you are willing to throw away.

## Interview questions

**★ What does `--migrate-only` do, and what are the three ways to end up in that mode?**
It runs migrations without changing any installed version — *"Only perform a migration, do not
update the installed version."* You get there explicitly by passing it, or implicitly in two ways:
`--name` sets it in the command's argument middleware, and `--from` declares `implies:
['migrate-only']`. In every case exactly one package must be named, enforced with
`A single package must be specified when using the 'migrate-only' option.`

**★ A migration failed halfway through an `ng update`. How do you finish the job?**
Not by re-running the update — the versions already moved in step 9, so the command reports the
package is already up to date and does nothing. Fix the cause of the failure, then replay the range
with `ng update @angular/core --migrate-only --from=<the version you were on>`. `--to` defaults to
the installed version, which is now the new one, so the range is exactly the set of migrations the
interrupted run should have applied.

**★ Why can `--name` not be combined with `--from` or `--to`?**
Because they express two different selections and there is no coherent meaning for both at once.
`--name` picks one migration by name; `--from`/`--to` pick every migration whose `version` falls in
a semver range. The option declares `conflicts: ['to', 'from']` so yargs rejects the combination
rather than silently preferring one.

**Someone hand-edited `package.json` to a new major and no migrations ran. Can `ng update` still
help?**
Yes, but only if you know the version they edited *away from*, because that is the `--from` end of
the range and it is exactly the information the edit destroyed. With it,
`ng update @angular/core --migrate-only --from=<old> --to=<new>` reconstructs the run. Without it,
`git log -p -- package.json` is the next place to look, and if the change was never committed the
range cannot be reconstructed reliably.

**What is the difference between `ng update --force` and the `--force` the CLI passes to npm?**
Different targets entirely. `ng update --force` is *"Ignore peer dependency version mismatches"* and
suppresses the CLI's own peer gate during plan resolution. The npm `--force` is applied
automatically on npm 7 or later at install time, because the CLI has already computed correct
versions and npm's peer resolver can only produce false failures against them. A run with no flags
at all still forces the npm install.

**When would you use `--create-commits`?**
On any update you intend to review, which should be all of them. It splits the run into one commit
for the dependency change and one per migration, so a four-hundred-file change arrives under a
message naming the migration that made it. Without it, the dependency change and every migration's
edits land in one working-tree diff that has to be read line by line to be trusted.

{/* FOOTER */}
