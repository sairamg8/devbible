---
title: "Thirteen migrations run on a v21 → v22 update, eleven of them without asking — and two of the automatic ones exist to switch v22's new defaults back off so your build survives upgrade day"
sidebar_label: "07 · The v22 migration inventory"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** and **Angular CLI 22.1.7** — both collections are
> quoted complete and verbatim from
> [`packages/core/schematics/migrations.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations.json)
> at tag `v22.1.5` and
> [`packages/schematics/angular/migrations/migration-collection.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/migrations/migration-collection.json)
> at tag `v22.1.7`, plus [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This page exists so that "schematics rewrite your source" stops being an assertion you have to
take on trust.** Here are both v22 collections in full — eight from `@angular/core`, five from the
CLI. Every entry names a v22 breaking change from the other side, so the inventory doubles as a
list of what actually changed. And two of the eight are the most revealing thing in the topic: they
exist to turn v22's *own new defaults* off, because the alternative was a framework release that
broke every upgrading project's build on day one.

## `@angular/core` — all eight, complete

```json
{
  "schematics": {
    "change-detection-eager": {
      "version": "22.0.0",
      "description": "Adds `ChangeDetectionStrategy.Eager` to all components.",
      "factory": "./bundles/change-detection-eager.cjs#migrate"
    },
    "http-xhr-backend": {
      "version": "22.0.0",
      "description": "Adds 'withXhr' to 'provideHttpClient' function calls when the 'HttpXhrBackend' is used. For more information see: https://angular.dev/api/common/http/withXhr",
      "factory": "./bundles/http-xhr-backend.cjs#migrate"
    },
    "strict-templates-default": {
      "version": "22.0.0",
      "description": "Adds 'strictTemplates: false' in tsconfig.json when not set.",
      "factory": "./bundles/strict-templates-default.cjs#migrate"
    },
    "can-match-snapshot-required": {
      "version": "22.0.0",
      "description": "Adds the required third argument to canMatch callsites.",
      "factory": "./bundles/can-match-snapshot-required.cjs#migrate"
    },
    "incremental-hydration": {
      "version": "22.0.0",
      "description": "Adds withNoIncrementalHydration() opt out to provideClientHydration() when incremental hydration is not enabled to retain pre-v22 behavior-.",
      "factory": "./bundles/incremental-hydration.cjs#migrate"
    },
    "strict-safe-navigation-narrow": {
      "version": "22.0.0",
      "description": "Disables the 'nullishCoalescingNotNullable & optionalChainNotNullable extended diagnostics.",
      "factory": "./bundles/strict-safe-navigation-narrow.cjs#migrate"
    },
    "model-output": {
      "version": "22.0.0",
      "description": "Migrate broken duplicate outputs",
      "factory": "./bundles/model-output.cjs#migrate"
    },
    "safe-optional-chaining": {
      "version": "22.0.0",
      "description": "Wraps optional chaining expressions in $safeNavigationMigration().",
      "factory": "./bundles/safe-optional-chaining.cjs#migrate"
    }
  }
}
```

🔴 **All eight are `"version": "22.0.0"` and not one carries `"optional": true`.** Apply the bucket
rule from [06](06-required-and-optional-migrations.md) and the conclusion is checkable rather than
asserted: **all eight run on a v21 → v22 update, without asking, on a laptop and in CI alike.**
There is no prompt to miss and no TTY-dependent behaviour on this collection.

⚠️ **The stray `behavior-.` and the unbalanced quote in `'nullishCoalescingNotNullable & optionalChainNotNullable`
are in the published source.** They are quoted here as-is; tidying inside a quote is how a corpus
stops being checkable.

## The two that switch v22's own defaults back off

`strict-templates-default` writes `"strictTemplates": false` into your `tsconfig.json` **when the
key is not already set**. `strict-safe-navigation-narrow` disables the `nullishCoalescingNotNullable`
and `optionalChainNotNullable` extended diagnostics.

Both are opt-outs for behaviour v22 turned on. That looks backwards until you consider the
alternative: a project that upgrades and finds its templates no longer type-check is a project that
cannot build, at the exact moment it has the least information about why. Writing the opt-out gives
the team a working build and a decision to make deliberately, later, instead of a wall on upgrade
day.

**Which means the migration has handed you a debt, silently.** What to do about the two settings —
and why you should not leave them off forever — is
[01 · 15e What changes underneath you](../01-compiler-with-a-framework-attached/15e-what-changes-underneath-you.md);
the wider picture of what v22 demands is
[01 · 17c The v22 upgrade wall](../01-compiler-with-a-framework-attached/17c-the-v22-upgrade-wall.md).
The removal itself is one line:

```jsonc
// tsconfig.json — after the migration
{
  "angularCompilerOptions": {
    "strictTemplates": false   // ← written by strict-templates-default; delete when ready
  }
}
```

## The CLI — all five, complete

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

🔴 **This file is the worked example for every field in
[06](06-required-and-optional-migrations.md).** Read it as a table:

| Migration | `optional` | `recommended` | `documentation` | What you see |
|---|---|---|---|---|
| `add-istanbul-instrumenter` | — | — | — | Runs silently |
| `use-application-builder` | ✔ | ✔ | ✔ | Prompted, **pre-ticked**, with a URL beside it |
| `migrate-karma-to-vitest` | ✔ | — | — | Prompted, box **empty** |
| `trust-proxy-headers` | — | — | — | Runs silently |
| `update-workspace-config` | — | — | — | Runs silently |

`use-application-builder` is the only entry in either collection carrying all three fields, which is
why its prompt line is the one with a `https://angular.dev/tools/cli/build-system-migration` link
after the title — `documentation` is stored as the bare path and resolved against `https://angular.dev`.

So of thirteen migrations on a v21 → v22 update, **eleven run automatically and two are offered.**
And the two that are offered are the two large ones.

Angular documents running the big one by hand, which is the answer to "we skipped it, now what":

> *"This migration is entirely optional for v18 and can also be run manually at anytime after an
> update via the following command:"*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

```bash
ng update @angular/cli --name use-application-builder
```

## Gotchas

**★ Symptom: after upgrading to v22, `tsconfig.json` contains a `"strictTemplates": false` that
nobody on the team wrote.** Cause: the required `strict-templates-default` migration adds it when
the key is unset, so that a project whose templates do not yet type-check still builds. Fix: treat
it as a dated TODO rather than a setting — delete the line, fix what breaks, and read
[01 · 15e](../01-compiler-with-a-framework-attached/15e-what-changes-underneath-you.md) for what the
strict mode actually catches.

**★ Symptom: `withNoIncrementalHydration()` appeared inside `provideClientHydration()` in
`app.config.ts`.** Cause: the required `incremental-hydration` migration adds the opt-out to
preserve pre-v22 behaviour. Fix: decide deliberately whether you want incremental hydration — the
feature is covered in
[03 · 11c Incremental hydration and event replay](../03-the-provider-array/11c-incremental-hydration-and-event-replay.md)
— and remove the call when you do.

**★ Symptom: the Karma → Vitest migration never offered itself during your CI upgrade.** Cause:
`migrate-karma-to-vitest` is `optional: true` with no `recommended`, and optional migrations are
skipped entirely without a TTY. Fix: run it by name when you are ready, on a branch:

```bash
ng update @angular/cli --name migrate-karma-to-vitest
```

**★ Symptom: you accepted the pre-ticked prompt and the build system changed under you.** Cause:
`use-application-builder` is `recommended: true`, so its box starts ticked — a publisher's default,
not an analysis of your project. Fix: read its documentation link before accepting; it is the
largest single change in the v22 update and it has known limitations, which is exactly why it ships
with a `documentation` field.

**★ Symptom: `ChangeDetectionStrategy.Eager` appeared on components that did not have a change
detection strategy before.** Cause: the required `change-detection-eager` migration adds it to all
components, preserving pre-v22 semantics explicitly rather than by default. Fix: expected; the
migration is making an implicit default explicit so that the framework's default can move.

**★ Symptom: `withXhr` was added to a `provideHttpClient()` call and you cannot see why.** Cause:
the required `http-xhr-backend` migration adds it where `HttpXhrBackend` is used, per the
description's own link to `https://angular.dev/api/common/http/withXhr`. Fix: expected; removing it
changes which backend the client uses.

**★ Symptom: a `canMatch` guard suddenly takes three arguments.** Cause: `can-match-snapshot-required`
adds the required third argument at every call site. Fix: expected, and it is a signature change
rather than a behaviour change — the migration cannot know what you want to do with the new
parameter, only that it must be there.

**★ Symptom: you counted the migrations in `packages/core/schematics/migrations/` on disk and got a
different list.** Cause: that directory is the shared implementation directory for both the
automatic and the on-demand collections; it is neither list. Fix: the two `.json` collections are
the authority — this page for the automatic ones,
[07b](07b-the-on-demand-migrations.md) for the generators.

## Interview questions

**★ How many migrations run on a v21 → v22 update, and how many of them ask first?**
Thirteen, of which eleven run automatically. Eight come from `@angular/core` and all eight are
required — none carries `optional`. Five come from the CLI, of which three are required and two are
optional: `use-application-builder`, which is also `recommended` so its box is pre-ticked, and
`migrate-karma-to-vitest`, which is not. The reason the exact numbers are worth knowing is that they
are checkable from two JSON files, which turns "migrations rewrite your source" from a claim into
something a candidate can verify.

**★ Two of v22's automatic migrations turn v22's own new behaviour off. Why would a framework ship
that?**
Because the alternative is worse. `strictTemplates` and the two narrowing diagnostics became
defaults in v22, and a large existing codebase upgrading into them finds its templates no longer
type-check — a broken build on the day it has least context. Writing the opt-out gives the team a
working build immediately and converts a blocker into a scheduled piece of work. It is a deliberate
trade of *strictness now* for *upgrade adoption*, and the cost is that the opt-out is easy to forget,
which is why it is worth treating the written line as a dated TODO rather than a setting.

**★ Which v22 migration is optional but pre-ticked, and what does that tell you about the fields?**
`use-application-builder`, which is the only entry in either collection carrying `optional`,
`recommended` and `documentation` together. `optional` puts it in the prompt, `recommended` starts
its checkbox ticked, and `documentation` — stored as the bare path `tools/cli/build-system-migration`
and resolved against `https://angular.dev` — is why its prompt line shows a URL. It is the cleanest
worked example of the four-field classification in the whole corpus.

**How would you run the build-system migration a year after upgrading?**
`ng update @angular/cli --name use-application-builder`, which is the command angular.dev itself
gives. `--name` implies `--migrate-only`, so nothing about your installed versions changes — it runs
that one schematic against the project as it stands. This is the general recovery path for any
optional migration that was skipped, including every optional migration in a CI run.

**Why does `add-istanbul-instrumenter` exist, and what does its presence tell you about the v22
test story?**
It adds `istanbul-lib-instrument` to `devDependencies` if Karma unit testing is used — a required
migration that patches a dependency the new arrangement no longer pulls in implicitly. Read
alongside the optional `migrate-karma-to-vitest`, it says the v22 position plainly: Karma still
works and is kept working, but Vitest is where the CLI is going, and the move is offered rather than
imposed.

---

← Prev: [`--create-commits`](06c-create-commits.md) · Index: [Topic index](README.md) · Next → [The on-demand migrations](07b-the-on-demand-migrations.md)
