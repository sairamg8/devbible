---
title: "The CLI publishes a second migration collection of its own, and its migrations edit the files your TypeScript never mentions — angular.json, devDependencies and the server entry point"
sidebar_label: "01c · The CLI's own collection"
sidebar_position: 1.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `angular/angular-cli` at tag `v22.1.7`:
> [`packages/schematics/angular/migrations/migration-collection.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/migrations/migration-collection.json)
> (read in full, verbatim below),
> [`packages/angular/cli/src/commands/update/cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts);
> angular.dev [Angular build system migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run** — no migration was executed.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`@angular/core` is not the only package with an `ng-update` key. `@angular/cli` has its own
collection, and its migrations reach files that no component ever imports — `angular.json`,
`devDependencies`, the SSR server engine's configuration.** That matters for two reasons. The
narrow one: after an upgrade you should look for changes in the workspace config, not just in
`src/`. The broad one: this collection is where the `optional` and `recommended` fields appear, and
where the largest migration Angular has ever shipped — the one that swaps out your entire build
system — is sitting behind a checkbox that is ticked by default.

## The collection, in full

Verbatim from
[`packages/schematics/angular/migrations/migration-collection.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/migrations/migration-collection.json)
at `v22.1.7`:

```json
{
  "encapsulation": false,
  "schematics": {
    "add-istanbul-instrumenter": {
      "version": "22.0.0",
      "factory": "./add-istanbul-instrumenter/migration",
      "description": "Add 'istanbul-lib-instrument' to 'devDependencies' if Karma unit testing is used."
    },
    "use-application-builder": {
      "version": "22.0.0",
      "factory": "./use-application-builder/migration",
      "description": "Migrate application projects to the new build system. Application projects that are using the '@angular-devkit/build-angular' package's 'browser' and/or 'browser-esbuild' builders will be migrated to use the new 'application' builder. You can read more about this, including known issues and limitations, here: https://angular.dev/tools/cli/build-system-migration",
      "optional": true,
      "recommended": true,
      "documentation": "tools/cli/build-system-migration"
    },
    "migrate-karma-to-vitest": {
      "version": "22.0.0",
      "factory": "./migrate-karma-to-vitest/migration",
      "description": "Migrate projects using legacy Karma unit-test builder to the new unit-test builder with Vitest.",
      "optional": true
    },
    "trust-proxy-headers": {
      "version": "22.0.0",
      "factory": "./trust-proxy-headers/migration",
      "description": "Add 'trustProxyHeaders' configuration to 'AngularNodeAppEngine' or 'AngularAppEngine'. For more information see: https://angular.dev/best-practices/security#configuring-trusted-proxy-headers"
    },
    "update-workspace-config": {
      "version": "22.0.0",
      "factory": "./update-workspace-config/migration",
      "description": "Update the angular workspace configuration."
    }
  }
}
```

Five entries. **Three required, two optional** — and not one of them edits a component.

| Migration | Required? | The file it changes |
|---|---|---|
| `add-istanbul-instrumenter` | required | `package.json` — adds a `devDependency` |
| `update-workspace-config` | required | `angular.json` |
| `trust-proxy-headers` | required | the SSR server entry (`AngularNodeAppEngine` / `AngularAppEngine` configuration) |
| `use-application-builder` | optional, **recommended** | `angular.json` — replaces the builder your whole build runs on |
| `migrate-karma-to-vitest` | optional, not recommended | `angular.json` and the test setup |

## The two extra fields, and what they buy

`@angular/core`'s collection uses only `version`, `description` and `factory`. The CLI's adds two
more, and `use-application-builder` is the only entry in either collection carrying all of them:

- **`optional: true`** moves the migration out of the run-without-asking bucket and into a prompt.
- **`recommended: true`** pre-ticks its checkbox in that prompt. So the default answer for
  `use-application-builder` is *yes*, and the default answer for `migrate-karma-to-vitest` — which
  is `optional` without `recommended` — is *no*.
- **`documentation: "tools/cli/build-system-migration"`** is a path appended to angular.dev, so
  the prompt line carries a link to
  [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).

🔴 **`optional` has one consequence that catches every CI pipeline: a prompt needs a terminal.**
Without an interactive TTY there is nothing to answer the question, so optional migrations do not
run. An upgrade performed by an automation job therefore produces a *different result* from the
same upgrade performed on a laptop — the required three run in both cases, the optional two only in
one. The precise mechanism and the exact prompt are **06 · Required and optional migrations**
*(not written yet)*.

## The big one: `use-application-builder`

Read its description again. It replaces the `browser` or `browser-esbuild` builder from
`@angular-devkit/build-angular` with the `application` builder — that is a change of build system,
not a change of configuration, and it is the migration behind the entire
**05 · The build: `@angular/build`** *(not written yet)* topic. It arrives as a single pre-ticked
checkbox during an upgrade you started for an entirely different reason.

angular.dev is explicit that it can be deferred and run later, verbatim:

> *"This migration is entirely optional for v18 and can also be run manually at anytime after an
> update via the following command:"*
>
> ```
> ng update @angular/cli --name use-application-builder
> ```
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

That invocation is worth understanding rather than copying. `--name` names a single migration, and
the CLI's own argument middleware forces `--migrate-only` whenever it is present:

```ts
.middleware((argv) => {
  if (argv.name) {
    argv['migrate-only'] = true;
  }
})
```

— [`cli.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/commands/update/cli.ts).
So the command above **changes no version numbers at all**. It installs nothing, moves nothing in
`package.json`, and runs exactly one migration against your current tree. That is the whole
recovery surface for an optional migration you skipped, and it is why skipping one is a deferral
rather than a loss. The rest of that surface — `--from`, `--to`, and the single-package constraint
they carry — is [03 · What `ng update` actually does](03-what-ng-update-actually-does.md).

## Why a second collection at all

Because `packageGroup` membership decides who migrates you, and the CLI is not in
`@angular/core`'s group. The two packages version together at the major level but ship separately
(core is 22.1.5 while the CLI is 22.1.7 as this page is written), and their migrations concern
different artefacts: the framework's collection edits code that imports from `@angular/*`, the
CLI's edits the workspace that builds it. Each package with an `ng-update` key gets its **own
migration pass**, announced by its own banner naming the package, and a third-party library with
migrations of its own gets a third pass on the same run.

## Gotchas

**★ Symptom: after an upgrade, `angular.json` names a builder you have never heard of and the
build behaves differently.** Cause: `use-application-builder` is `optional` but `recommended`, so
its checkbox was pre-ticked and pressing Enter at the prompt accepted it. Fix: this is a real,
intended change and the right answer is usually to keep it — but if you need to land it separately,
revert that commit and re-run the migration on its own later:

```bash
git revert <the use-application-builder commit>     # if you used --create-commits
# ... and when you are ready:
ng update @angular/cli --name use-application-builder
```

**★ Symptom: the upgrade produced a different diff on the CI runner than on a developer's
machine.** Cause: optional migrations require a TTY to prompt, and CI has none, so the two
optional entries were silently skipped there. Fix: do not upgrade Angular in a non-interactive job
and expect parity. Run the upgrade locally, commit the result, and let CI verify it — or run the
optional migrations explicitly by name in the job, which needs no prompt:

```bash
ng update @angular/cli --name use-application-builder
ng update @angular/cli --name migrate-karma-to-vitest
```

**★ Symptom: `istanbul-lib-instrument` appeared in `devDependencies` and nobody added it.** Cause:
`add-istanbul-instrumenter`, a **required** migration, adds it when the project uses Karma unit
testing. Fix: leave it — removing it breaks coverage instrumentation under the v22 test setup. If
you do not want it, the exit is to move off Karma, which is what `migrate-karma-to-vitest` is for.

**★ Symptom: you migrated to Vitest expecting `ng update` to have offered it, and it never
appeared.** Cause: `migrate-karma-to-vitest` is `optional` **without** `recommended`, so its
checkbox starts empty; on a fast Enter-through it is declined. Fix: run it by name — `ng update
@angular/cli --name migrate-karma-to-vitest` — which, because `--name` implies `--migrate-only`,
touches no versions.

**★ Symptom: an SSR application behind a load balancer started reporting the proxy's IP address, or
started trusting a header it should not.** Cause: `trust-proxy-headers` is required and adds a
`trustProxyHeaders` configuration to `AngularNodeAppEngine` or `AngularAppEngine`; whichever value
it wrote is now your security posture. Fix: read what it wrote, against
[angular.dev's guidance on trusted proxy headers](https://angular.dev/best-practices/security#configuring-trusted-proxy-headers)
— the migration's own description links there, which is a strong hint that the framework expects
you to make a decision rather than accept a default.

**★ Symptom: you looked for the upgrade's changes in `git diff src/` and found nothing
interesting.** Cause: three of the CLI's five migrations edit files outside `src/` entirely. Fix:
review the whole diff, and specifically `angular.json` and `package.json`, which is where a build
system, a test runner and a dependency can change without a single line of TypeScript moving.

## Interview questions

**★ Which v22 migration is optional but pre-ticked, and why does that combination exist?**
`use-application-builder`, which carries `optional: true`, `recommended: true` and a
`documentation` URL. The combination exists because the change is large enough that a team should
be able to decline it — it swaps the build system — but correct enough that declining should be
the deliberate choice rather than the default one. `optional` buys you the veto; `recommended`
puts the burden of using it on you.

**★ How do you run a specific migration a year after the update that would have offered it?**
`ng update @angular/cli --name use-application-builder`. `--name` selects a single migration and the
CLI's argument middleware sets `--migrate-only` for you, so nothing in `package.json` moves; the
migration runs against the tree you already have. It only works for one package at a time — a
constraint the command enforces with `A single package must be specified when using the
'migrate-only' option.`

**★ Why does the same `ng update` command produce a different result in CI than on a laptop?**
Because two of the CLI's five v22 migrations are `optional`, optional migrations are offered
through an interactive prompt, and CI has no TTY to answer it. The required three run identically
in both places. This is the single most common reason a team's "we upgraded in the pipeline"
project ends up on a different build system from the one they thought they were on.

**Why does `@angular/cli` ship its own migration collection instead of putting everything in
`@angular/core`'s?**
Because the two packages are separate `ng-update` participants with separate `packageGroup`
memberships, and they migrate different artefacts. Core's migrations edit code that imports from
`@angular/*`; the CLI's edit the workspace configuration, the dev dependencies and the server
entry. Each package with an `ng-update` key gets its own migration pass on a run, so a project
depending on core, the CLI and a third-party library with migrations sees three passes.

**A required migration changed a security-relevant setting. Is "required" a promise that the change
is safe?**
No. `trust-proxy-headers` is required and it writes a setting whose correct value depends on your
deployment topology, which no migration can know. "Required" means only *"this runs without
asking"* — it is a statement about the prompt, not about the risk. The migration's own description
linking to a security guidance page is the framework saying as much.

---

← Prev: [What a migration rewrites](01b-what-a-migration-rewrites.md) · Index: [Topic index](README.md) · Next → [A bare `ng update` is a report](01d-a-bare-ng-update-is-a-report.md)
