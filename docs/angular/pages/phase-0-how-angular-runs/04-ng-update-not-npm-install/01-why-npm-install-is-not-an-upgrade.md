---
title: "An Angular major version bump has two halves — the numbers in package.json and the rewrites to your own source — and npm install does exactly one of them"
sidebar_label: "01 · Why `npm install` is not an upgrade"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Angular versioning and releases](https://angular.dev/reference/releases);
> the published manifest [`@angular/core@22.1.5`](https://registry.npmjs.org/@angular/core/22.1.5);
> `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/migrations.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations.json);
> `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts).
> Documentation-validated; **no sandbox run** — no `ng update` was executed and no output below is a transcript.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every other line in your `package.json` describes a file that will be downloaded. The
`@angular/*` lines describe that *and* a set of programs that will open your `.ts` files and edit
them.** Angular ships its breaking changes as executable code — schematics called **migrations** —
declared inside the packages themselves, and `ng update` is the only thing in the toolchain that
knows they exist. `npm install @angular/core@latest` performs half of an upgrade: it moves the
version numbers, resolves the tree, and leaves your source in the shape the previous major
required. The project will install cleanly. It will not compile, and the reason will be spread
across a hundred files that a program was supposed to have rewritten.

## The two halves, named

| Half | What changes | Who does it |
|---|---|---|
| **1 · Dependency resolution** | version ranges in `package.json`, the lockfile, the contents of `node_modules` | `npm install` — or `ng update`, which delegates to your package manager |
| **2 · Source rewrites** | your components, your `app.config.ts`, your `tsconfig.json`, your templates | 🔴 **`ng update` only.** Nothing else in the toolchain knows the rewrites exist |

Half 2 is not a convenience layer bolted on top. It is how Angular discharges the obligation it
takes on when it makes a breaking change, and the release policy says so in as many words.

## The commitment, in the framework's own words

From angular.dev, *Angular versioning and releases*, under **Breaking change policy and update
paths**:

> *"Support update automation via the `ng update` command. It provides code transformations which
> we often have tested ahead of time over hundreds of thousands of projects at Google"*
> — [angular.dev/reference/releases](https://angular.dev/reference/releases)

Read that as a contract with two clauses. Angular reserves the right to break your source across a
major boundary; in exchange it ships the transformation that repairs it. **Declining to run the
transformation does not cancel the first clause.**

## The proof is in the published package, and you can read it

`@angular/core`'s own manifest on the npm registry carries a top-level `ng-update` key. Verbatim
from `https://registry.npmjs.org/@angular/core/22.1.5`:

```json
"ng-update": {
  "migrations": "./schematics/migrations.json",
  "packageGroup": ["@angular/core", "@angular/bazel", "@angular/common", "@angular/compiler",
    "@angular/compiler-cli", "@angular/animations", "@angular/elements",
    "@angular/platform-browser", "@angular/platform-browser-dynamic", "@angular/forms",
    "@angular/platform-server", "@angular/upgrade", "@angular/router",
    "@angular/language-service", "@angular/localize", "@angular/service-worker"]
}
```

Two facts follow, and both matter more than they look.

- **`migrations` is a path inside the published tarball.** It is already on your disk, in
  `node_modules/@angular/core/schematics/migrations.json`, right now. `npm install` downloaded it
  and never opened it.
- **`packageGroup` names sixteen packages that move as a unit.** That is why the documented
  invocation updates the framework as a group rather than a package at a time. The full contract —
  what each field means and how a third-party library declares its own — is
  **04 · The `ng-update` metadata contract** *(not written yet)*.

## What those migrations are, and what they do to your files

`@angular/core`'s v22 collection declares eight of them, all at `"version": "22.0.0"`, none
marked `optional` — so all eight run, without asking, on a v21 → v22 update. One of them, by its
own description, *"Adds `ChangeDetectionStrategy.Eager` to all components."* The collection file,
the three fields every entry carries, and the before/after of four real v22 migrations are
[01b · What a migration rewrites](01b-what-a-migration-rewrites.md); the CLI's separate collection,
which edits `angular.json` and your dev dependencies rather than your source, is
[01c · The CLI's own collection](01c-the-clis-own-collection.md).

## The command, and the exact form the docs tell you to type

`ng update`'s own `describe` string, verbatim from
[`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts):

```ts
command = 'update [packages..]';
describe = 'Updates your workspace and its dependencies. See https://update.angular.dev/.';
```

**"Your workspace *and* its dependencies"** — the workspace is named first, and that ordering is
not accidental prose. The dependency change is the part the command delegates to your package
manager; the workspace change is the part only it can do.

Its long description, verbatim and complete, from
[`long-description.md`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/long-description.md):

> *"Perform a basic update to the current stable release of the core framework and CLI by running
> the following command."*
>
> ```
> ng update @angular/cli @angular/core
> ```
>
> *"To update to the next beta or pre-release version, use the `--next` option."*
>
> *"To update from one major version to another, use the format"*
>
> ```
> ng update @angular/cli@^<major_version> @angular/core@^<major_version>
> ```
>
> *"We recommend that you always update to the latest patch version, as it contains fixes we
> released since the initial major release. For example, use the following command to take the
> latest 21.x.x version and use that to update."*
>
> ```
> ng update @angular/cli@^21 @angular/core@^21
> ```
>
> *"For detailed information and guidance on updating your application, see the interactive
> [Angular Update Guide](https://angular.dev/update-guide)."*

🔴 **Two details in there decide whether your upgrade goes well.**

- **`@angular/cli` is named before `@angular/core` in every single example.** The CLI is what runs
  the migrations, so the CLI is what has to be current first. [02c · How the CLI keeps its own
  promise](02c-how-the-cli-keeps-its-own-promise.md) shows the mechanism that makes this work even
  when your installed CLI is a major behind.
- **The recommended form is `@^21`, a caret range — not a bare `@21`.** A bare major resolves to a
  range with a floor, and the docs say why you do not want that: *"the latest patch version …
  contains fixes we released since the initial major release."* Upgrading to `22.0.0` when
  `22.1.7` exists means adopting a major release without three months of its bug fixes.

⚠️ The interactive **Angular Update Guide** at `update.angular.dev` is a client-rendered
application; this page links it but deliberately does not describe its steps, because its contents
could not be read from its served HTML.

## Why no other dependency in `package.json` behaves like this

Other ecosystems ship codemods. What is different here is **where they are declared and who runs
them**: the `ng-update` key is part of the published manifest, the CLI discovers it by reading
`node_modules`, and `ng update` runs the in-range migrations **by default, without being asked**
for every migration not marked `optional`. There is no equivalent step in `npm install`, `npm
update`, `yarn up` or `pnpm update`, and none of them will ever grow one — they are dependency
resolvers, and the file they are contractually allowed to edit is `package.json`, not `src/`.

So the reasoning that works for every other line in your manifest — *"it is semver, a major bump
means read the changelog and fix the call sites"* — is not wrong for Angular, it is **incomplete**.
The changelog is real, the call sites are real, and a program that fixes most of them shipped in
the tarball you already downloaded.

## Gotchas

**★ Symptom: `npm install @angular/core@latest @angular/cli@latest` succeeds, then `ng build`
produces hundreds of template and type errors across files you did not touch.** Cause: half 2 never
ran. The versions moved; the source rewrites Angular ships as migrations did not. Fix: put the
manifest and the lockfile back, then let the CLI do it —

```bash
git checkout -- package.json package-lock.json
rm -rf node_modules
npm install
ng update @angular/cli@^22 @angular/core@^22
```

The revert is not optional politeness. `ng update` reads the **installed** version to decide which
migrations are in range, so a project whose `package.json` already says `22.x` while its source is
still v21-shaped will be told it is *"already up to date"* and no migration will ever run for it.

**★ Symptom: the upgrade "worked", and six months later a v23 migration crashes or silently does
nothing.** Cause: v23's migrations are written against v22-shaped source. If you hand-bumped to v22
and patched the compile errors yourself, your source is *build-correct* but not necessarily
*migration-correct* — the pattern the next migration matches on may not be there. Fix: after any
hand-bump, run the migrations you skipped explicitly rather than leaving the gap. The recovery
surface (`--migrate-only`, `--from`, `--to`, `--name`) is
[03 · What `ng update` actually does](03-what-ng-update-actually-does.md) and
**06 · Required and optional migrations** *(not written yet)*.

**★ Symptom: you upgraded `@angular/core` alone and `@angular/router` now fails at runtime with a
version-skew error.** Cause: `packageGroup` lists sixteen packages that Angular builds and tests as
a unit; nothing in npm enforces that they move together. Fix: name the group's entry points on the
command line and let the CLI expand the rest — `ng update @angular/cli@^22 @angular/core@^22`. The
compiler's own gates on mismatched versions are already documented in topic 01's
[`12g · version skew is a coded concern`](../01-compiler-with-a-framework-attached/12g-version-skew-is-a-coded-concern.md).

**★ Symptom: `ng update @angular/cli@22 @angular/core@22` landed you on 22.0.0 while 22.1.7 was
available.** Cause: a bare major is a range whose floor is the `.0` release, and the resolver is
entitled to satisfy it there. Fix: use the caret form the documentation actually recommends, which
takes the latest patch of that major:

```bash
ng update @angular/cli@^22 @angular/core@^22    # ✅ latest 22.x
ng update @angular/cli@22 @angular/core@22      # ⚠️ may land on 22.0.0
```

This matters more than it sounds: `22.0.0` is the release with three months of not-yet-found bugs
in it, and the migrations you are about to run are the ones shipped in the version you land on.

**★ Symptom: you ran `ng update @angular/core@^22` alone and the migrations behaved oddly, or the
CLI complained.** Cause: the CLI is the schematic runtime. Every documented example names
`@angular/cli` first for that reason, and updating the framework without the tool that migrates it
puts the two out of step. Fix: always name both, CLI first —
`ng update @angular/cli@^22 @angular/core@^22`.

**★ Symptom: you are on a fork or a vendored copy of an Angular package and migrations never run
for it.** Cause: `ng update` reads `ng-update` out of the installed manifest, so a vendored package
whose manifest you rewrote — or one installed from a git or file specifier rather than the
registry — is outside the mechanism. Fix: keep registry installs for anything you want migrated;
`ng update` rejects non-registry specifiers outright, which
[03 · What `ng update` actually does](03-what-ng-update-actually-does.md) shows in the source.

## Interview questions

**★ Why can a framework not simply use semver and let `npm install` do the upgrade?**
Because a breaking change in a compiler-backed framework changes the meaning of *your* source, not
only the library's exported API surface. When `strictTemplates` flips its default, no import in
your code changed and no function signature moved — the compiler now reads your existing templates
differently. Semver can express *"this release may break you"*; it cannot express *"and here is the
program that unbreaks you."* Angular's answer is to ship that program inside the package and commit
to it in the release policy: *"Support update automation via the `ng update` command."*

**★ Someone hand-bumped every `@angular/*` version in `package.json` and fixed the compile errors
by hand until the build went green. What is wrong with the result?**
Possibly nothing visible, and that is the problem. Two things are now untrue of the project. First,
any migration whose edit was *behaviour-preserving rather than error-fixing* never happened —
nothing in `strict-templates-default` or `incremental-hydration` produces a compile error if you
skip it, they exist to hold behaviour steady, so the project has silently taken v22's new defaults
without a decision. Second, the source is no longer in the shape the *next* major's migrations
expect, so the damage compounds at the following upgrade rather than at this one.

**★ Where do Angular's migrations physically live, and when did they arrive on your machine?**
In the published npm tarball of the package they belong to, at the path its manifest's
`ng-update.migrations` field names — for `@angular/core@22.1.5` that is
`./schematics/migrations.json`. They arrived with the ordinary `npm install` that fetched the
package; they are sitting in `node_modules` unopened. `ng update` does not download anything
special to migrate you, it reads what installing already put there.

**Is `ng-update` an Angular-only mechanism?**
No. It is a convention read by the Angular CLI, and any package can publish an `ng-update` key with
its own migration collection; that is how libraries such as router-adjacent and state-management
packages ship their own upgrade codemods. What is Angular-specific is the CLI's willingness to run
them and the guarantees around `@angular/*` scoped packages in particular — see
[02 · One major at a time](02-one-major-at-a-time.md).

**★ What is the difference between `ng update @angular/core@22` and `ng update @angular/core@^22`,
and why does the documentation recommend the second?**
A bare `@22` is a version range whose floor is `22.0.0`, so it can be satisfied by the `.0` release;
`@^22` asks for the highest `22.x.x` available. The docs are explicit about the reason —
*"we recommend that you always update to the latest patch version, as it contains fixes we released
since the initial major release."* There is a second reason they do not spell out: the migrations
that run are the ones shipped in the version you resolve to, so landing on `.0` means running the
first cut of them rather than the patched cut.

**Why is `@angular/cli` always written before `@angular/core` in the documented commands?**
Because the CLI is the program that runs the migrations. It is the schematic runtime, and it has to
be able to execute the target version's migration collection. Writing it first is the documentation
encoding an ordering that the tool then enforces for itself in a more robust way — see
[02c · How the CLI keeps its own promise](02c-how-the-cli-keeps-its-own-promise.md).

**Why does the version number in `package.json` matter to the migration system at all?**
Because it is the *from* end of the range that selects which migrations run. Every migration
carries a `version` field, and `ng update` builds a semver range from the installed version to the
target and runs the migrations inside it. Editing the installed version by hand does not just skip
a step — it destroys the input the selection depends on.

{/* FOOTER */}
