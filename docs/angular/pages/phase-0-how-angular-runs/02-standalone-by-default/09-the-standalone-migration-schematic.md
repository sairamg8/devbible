---
title: "`ng generate @angular/core:standalone` is not one migration but three, and the order they run in is forced by the removal criteria rather than by convention"
sidebar_label: "09 · The standalone migration schematic"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Migrate to standalone](https://angular.dev/reference/migrations/standalone),
> [`ng generate`](https://angular.dev/cli/generate) — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/collection.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/collection.json),
> [`packages/core/schematics/ng-generate/standalone-migration/README.md`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/README.md),
> [`.../standalone-migration/schema.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/schema.json).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One command, `ng generate @angular/core:standalone`, carries three separate migrations behind a
`mode` option, and Angular says flatly that they "have to be run multiple times" in a listed order.
That order is not a style preference or a safety ritual — it is a data dependency. Mode 1 moves every
declared class out of `declarations` and into the module's own `imports`; mode 2 will only delete a
module whose first qualifying condition is "Has no `declarations`". So mode 2 run first finds nothing
to delete and reports success. Mode 1 in turn deliberately skips any module with a `bootstrap` array,
because converting a root component without also replacing `bootstrapModule` would produce code that
does not compile — mode 3 picks exactly those up. Each mode is the precondition for the next, the
schematic will not tell you that you ran them backwards, and running them backwards fails silently by
doing less than you thought.**

## The command is one schematic wearing two names

`packages/core/schematics/collection.json` at `v22.1.5`, verbatim:

```json
"standalone-migration": {
  "description": "Converts the entire application or a part of it to standalone",
  "factory": "./bundles/standalone-migration.cjs#migrate",
  "schema": "./ng-generate/standalone-migration/schema.json",
  "aliases": ["standalone"]
}
```

`ng generate @angular/core:standalone` and `ng generate @angular/core:standalone-migration` are the
**same schematic** — the second is its real name, the first is the alias almost everyone types. If you
are reading a script or a CI job that uses the long name, it is not a different tool.

Its `schema.json` declares exactly two options, and it is the `enum` here — not the prose labels shown
in the prompt — that you pass on a command line:

```json
{
  "properties": {
    "mode": {
      "description": "Operation that should be performed by the migrator",
      "type": "string",
      "enum": ["convert-to-standalone", "prune-ng-modules", "standalone-bootstrap"],
      "default": "convert-to-standalone",
      "x-prompt": {
        "message": "Choose the type of migration:",
        "type": "list",
        "items": [
          {"value": "convert-to-standalone", "label": "Convert all components, directives and pipes to standalone"},
          {"value": "prune-ng-modules", "label": "Remove unnecessary NgModule classes"},
          {"value": "standalone-bootstrap", "label": "Bootstrap the application using standalone APIs"}
        ]
      }
    },
    "path": {
      "type": "string",
      "description": "Path relative to the project root which should be migrated",
      "x-prompt": "Which path in your project should be migrated?",
      "default": "./"
    }
  }
}
```

🔴 **`"default": "convert-to-standalone"` is the trap outside an interactive terminal.** `mode` carries
an `x-prompt`, so a human at a TTY gets a list to choose from. A CI job, a shell run with `--defaults`,
or an agent driving the CLI gets no prompt and takes the default — meaning it runs **step 1 and only
step 1**, exits zero, and looks like it did the whole migration. The documented `ng generate` global
options, verbatim from angular.dev, are `--defaults` (*"Disable interactive input prompts for options
with a default."*), `--dry-run` / `-d` (*"Run through and reports activity without writing out
results."*), `--force` (*"Force overwriting of existing files."*) and `--interactive` (*"Enable
interactive input prompts."*, default `true`). Pass `--mode` explicitly, always.

## 🔴 The order, in Angular's own words — and the mechanism underneath it

The schematic's own `README.md`, verbatim:

> *"The standalone migration involves multiple distinct operations, and as such has to be run multiple
> times. Authors should verify that the app still works between each of the steps. If the application
> is large, it can be easier to use the `path` option to migrate specific sub-sections of the app
> individually."*

> *"The migration is made up the following modes that are intended to be run in the order they are
> listed in: 1. Convert declarations to standalone. 2. Remove unnecessary NgModules. 3. Switch to
> standalone bootstrapping API."*

angular.dev states the same rule more tersely:

> *"Run the migration in the order listed below, verifying that your code builds and runs between each
> step"*

**Why the order is load-bearing, in two sentences.** Mode 2's list of removal criteria opens with
*"Has no `declarations`"*, and the only thing that empties a module's `declarations` array is mode 1
moving those classes into the module's `imports`. Mode 1 in turn explicitly refuses any module with a
`bootstrap` array, leaving those declarations non-standalone until mode 3 rewrites the bootstrap call
and converts them in the same pass. Neither dependency is checked at runtime — the schematic has no
idea which modes you have already run — so an out-of-order invocation is not an error, it is a no-op
dressed as a success.

The ten-step flow the README prints, verbatim:

> *"1. `ng generate @angular/core:standalone`. 2. Select the "Convert all components, directives and
> pipes to standalone" option. 3. Verify that the app works and commit the changes. 4. `ng generate
> @angular/core:standalone`. 5. Select the "Remove unnecessary NgModule classes" option. 6. Verify that
> the app works and commit the changes. 7. `ng generate @angular/core:standalone`. 8. Select the
> "Bootstrap the application using standalone APIs" option. 9. Verify that the app works and commit the
> changes. 10. Run your linting and formatting checks, and fix any failures. Commit the result."*

The non-interactive equivalent, as shell source:

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
ng build && ng test --watch=false
git add -A && git commit -m "standalone migration step 1: convert declarations"

ng generate @angular/core:standalone --mode=prune-ng-modules
ng build && ng test --watch=false
git add -A && git commit -m "standalone migration step 2: prune NgModules"

ng generate @angular/core:standalone --mode=standalone-bootstrap
ng build && ng test --watch=false
git add -A && git commit -m "standalone migration step 3: standalone bootstrap"

# only now, and as a SEPARATE commit
npx prettier --write "src/**/*.ts"
ng lint --fix
git add -A && git commit -m "standalone migration: formatting and lint"
```

⚠️ **Keep formatting out of the migration commits.** The README is blunt about why:

> *"The schematic often needs to generate new code or copy existing code to different places. This means
> that likely the formatting won't match your app anymore and there may be some lint failures. The
> application should compile, but it's expected that the author will fix up any formatting and linting
> failures."*

A `prettier --write` folded into the same commit as mode 3 turns a reviewable forty-line diff into a
two-thousand-line one, and the single line where the schematic guessed wrong becomes unfindable.

## Before you run it

The prerequisites, verbatim from angular.dev:

> *"Before using the schematic, please ensure that the project: 1. Is using Angular 15.2.0 or later.
> 2. Builds without any compilation errors. 3. Is on a clean Git branch and all work is saved."*

None of those three is politeness. **A project that does not compile cannot be migrated at all** — the
schematic reads your code through the Angular compiler, and a broken program produces a broken analysis
rather than an error message. And a dirty branch destroys the only review mechanism you have: after the
run, `git diff` *is* the entire audit trail, and it is worthless if half of it was already yours.

```bash
# 1. clean tree, dedicated branch — this is the rollback mechanism
git status --porcelain          # must print nothing
git switch -c standalone-migration

# 2. it must build BEFORE, or the analysis is garbage in
ng build

# 3. and the tests must be green before, so a later failure is attributable
ng test --watch=false

# 4. confirm you are actually above the floor the migration requires
ng version
```

`--dry-run` is a documented `ng generate` option and is worth one look for a first impression of blast
radius, but it is not the safety net. The flow requires you to *"verify that the app works"* between
steps, which means actually applying each one; you cannot run an application whose migration was never
written to disk. ⚠️ Whether `--dry-run` faithfully reports every edit one of these compiler-driven
migration schematics makes was **not** exercised here — the documentation does not describe its
behaviour for this schematic specifically, so treat the branch, not the flag, as the way back out.

## Gotchas

**★ Symptom: you ran `ng generate @angular/core:standalone` in CI, or with `--defaults`, and only the
component decorators changed — no modules were deleted and `main.ts` is untouched.** Cause: `mode` has
an `x-prompt`, so with prompting disabled nothing asked you, and `schema.json` supplied its
`"default": "convert-to-standalone"`. You ran step 1 and only step 1, and the command exited zero. Fix:
never rely on the prompt — name the mode on every invocation:

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
ng generate @angular/core:standalone --mode=prune-ng-modules
ng generate @angular/core:standalone --mode=standalone-bootstrap
```

**★ Symptom: `--mode=prune-ng-modules` runs clean and deletes nothing, so you conclude the migration
does not work on your codebase.** Cause: you ran it first. Every module still has a populated
`declarations` array, and the first removal criterion is *"Has no `declarations`"* — so every module is
correctly judged unremovable. Fix: run mode 1 over the same path, verify, commit, then re-run mode 2:

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
ng build && ng test --watch=false && git commit -am "step 1"
ng generate @angular/core:standalone --mode=prune-ng-modules
```

**★ Symptom: the migration produced something wrong and you cannot tell which of the three passes did
it.** Cause: you ran all three modes and committed once at the end, so the three whole-program rewrites
are indistinguishable in the history. Fix: one commit per mode, before the formatter ever runs — the
sequence in the shell block above. Recovering from this without commit boundaries means re-running the
migration from scratch on a clean branch, because `git diff` cannot separate passes that were never
separated.

**★ Symptom: `git diff` after the migration is thousands of lines of re-indentation and you cannot
review it.** Cause: your editor, a pre-commit hook, or a `prettier --write` in the same commit
reformatted every file the schematic touched. Angular says outright that *"likely the formatting won't
match your app anymore"* — that reformatting is expected, but it belongs in its own commit. Fix:
disable format-on-save for the duration, commit each migration step raw, then run the formatter last:

```bash
git commit -am "standalone migration step 3: standalone bootstrap"
npx prettier --write "src/**/*.ts"
ng lint --fix
git commit -am "standalone migration: formatting and lint"
```

**Symptom: the schematic errors out or produces nothing useful on an older project.** Cause: the
documented floor is *"using Angular 15.2.0 or later"* — the schematic emits `imports` arrays and
standalone metadata that earlier compilers reject. Fix: get onto a supported line first with `ng update`
(topic **04 · Keeping an Angular app current** *(not written yet)* owns that command; Phase 15 owns
upgrade mechanics end to end), and only then run this schematic. The two are unrelated tools that
people routinely confuse — `ng update` moves your *version*, this schematic changes your *code shape*.

**Symptom: you ran the migration on `main` with uncommitted work in the tree.** Cause: the schematic
rewrites files in place with no backup and no undo. Fix: there is no fix after the fact — the
prerequisite exists precisely because this state is unrecoverable. Before every run:

```bash
git status --porcelain          # must print nothing
git switch -c standalone-migration
```

## Interview questions

**★ Why does the standalone migration have to be run three times instead of once?**
Because each mode's precondition is the previous mode's output, and each is a separate whole-program
analysis. Mode 2 only removes a module whose `declarations` array is empty, and the only thing that
empties it is mode 1 moving those classes into `imports`. Mode 1 deliberately skips modules with a
`bootstrap` array, so their declarations stay non-standalone until mode 3 replaces `bootstrapModule`
with `bootstrapApplication` and converts them in the same pass. Angular also wants a human verification
point between steps — the README says authors *"should verify that the app still works between each of
the steps"* — because a static analysis of a large codebase gets some things wrong, and you want the
blast radius of each wrong thing confined to one commit.

**★ What actually happens if you run `--mode=prune-ng-modules` first?**
Nothing destructive, and that is the problem. Every module still has declarations, so every module
fails the first removal criterion, the schematic changes nothing and exits successfully. There is no
warning about running out of order, no state file recording which modes you have run, and no diagnostic
distinguishing "no modules were removable" from "no modules were removable *yet*".

**★ Why is a clean Git branch a documented prerequisite rather than a suggestion?**
Because `git diff` is the schematic's only output review mechanism. It rewrites files in place, has no
undo, and produces changes that compile but may be semantically wrong — the classic case being an
`imports` array inferred for a component whose real dependency comes from a code path the static
analysis could not follow. If your own uncommitted edits are mixed into the same diff you cannot tell
the schematic's guesses from your intentions, and you cannot revert one without reverting the other.

**★ Why should the formatter run last, in its own commit, rather than as part of the migration?**
Because the schematic *"often needs to generate new code or copy existing code to different places"*,
so its output will not match your house formatting — and the reviewer's job is to spot the one provider
that moved to the wrong injector, not to skim two thousand lines of re-indentation. Splitting the
commits makes the migration's diff small enough to read line by line and leaves the mechanical churn in
a commit nobody has to review.

**Why does `--dry-run` not replace a Git branch here?**
Because the documented flow requires you to verify that the app *works* between steps, and an
application whose migration was never written to disk cannot be run. `--dry-run` previews one step in
isolation; the branch gives you a way out of three steps whose failure mode is usually discovered by the
test suite two steps later. The dry run also cannot show you the second-order effects — the specs that
break, the lint failures, the dead imports — that are the actual cost of each pass.

**What is the difference between this schematic and the `ng update` migration that touched `standalone`
in v19?**
They move in opposite directions. The v19 `explicit-standalone-flag` migration, covered in
[03 · Which version changed what](03-standalone-by-default-which-version-changed-what.md), ran as part
of `ng update @angular/core@19` and *added* `standalone: false` to every class still declared in an
`NgModule`, so that flipping the compiler default would not change your app's meaning. This schematic
*removes* those flags and rewrites the surrounding code. One preserved your existing semantics across a
default flip; this one changes your architecture on purpose.

---

← Prev: [The two errors it raises](08d-the-two-errors-importprovidersfrom-raises.md) · Index: [Topic index](README.md) · Next → [Mode 1 — convert to standalone](09b-mode-1-convert-to-standalone.md)
