---
title: "Adding a staging environment is four edits, not one — and the three people forget are the ones that leave staging without content hashing, without budgets, and without a way to serve it"
sidebar_label: "07c · Adding an environment"
sidebar_position: 7.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and [`packages/angular_devkit/architect/node/node-modules-architect-host.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts)
> at tag `v22.1.7`; the comma-separated configuration semantics quoted verbatim from
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config)
> and [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A new configuration inherits from `options` and from nothing else.** There is no `extends`, no
"based on production", and no way to add one key to another configuration's value. That single fact
turns "add a staging environment" from a one-line copy into a four-part edit, and it is why so many
workspaces end up with a staging build that quietly ships unhashed, unbudgeted output. This page is
the full edit, in order. The mechanism it wires is [07 · `fileReplacements`](07-file-replacements.md)
and [07b · Environments in practice](07b-environments-in-practice.md).

## The four edits, in order

**1 — the environment file.** Give it the same declared type as the others so a missing key is an
error where the key is missing:

```ts
// src/environments/environment.staging.ts
import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'https://staging.example.com/api',
};
```

**2 — the build configuration.** Everything staging needs, restated:

```json
{
  "configurations": {
    "staging": {
      "outputHashing": "all",
      "budgets": [
        { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
        { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
      ],
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.staging.ts"
        }
      ]
    }
  }
}
```

🔴 **The `outputHashing` and `budgets` lines are not decoration — they are the whole trap.** Those
two values exist only inside `configurations.production` in a generated workspace. Copy just the
`fileReplacements` array and staging gets neither: no cache-busting filenames, and no size
enforcement on a build you are about to hand to a QA team as a production stand-in.

**3 — the serve configuration**, because `build` and `serve` keep separate maps
([05d](05d-serve-test-and-libraries.md)):

```json
{
  "serve": {
    "configurations": {
      "staging": { "buildTarget": "my-app:build:staging" }
    }
  }
}
```

**4 — whatever runs it.** A CI job, a deploy script, a package script. Nothing outside
`angular.json` learns that a configuration exists:

```bash
ng build --configuration staging
```

## Why there is no `extends`

The merge that happens when a configuration is selected is a shallow spread of the configuration's
object over the target's `options`. There is no second lookup, no base-configuration resolution and
no deep merge. The documented behaviour of naming several configurations is the closest available
substitute:

> *"You can also pass in more than one configuration name as a comma-separated list. For example, to
> apply both `staging` and `french` build configurations, use the command `ng build --configuration
> staging,french`. In this case, the command parses the named configurations from left to right. If
> multiple configurations change the same setting, the last-set value is the final one. In this
> example, if both `staging` and `french` configurations set the output path, the value in `french`
> would get used."*

> *"Configurations can be applied to any Angular CLI builder. Multiple configurations can be
> specified with a comma separator. The configurations are applied in order, with conflicting
> options using the value from the last configuration."*

That gives you composition **at invocation time**, not in the file. It is genuinely useful for
orthogonal axes — environment and locale, for example — and useless for "staging is production with
one change", because the thing you want to reuse would still have to be a configuration someone
names on the command line every time.

🔴 **The comma form composes on the `buildTarget` string too**, since that string accepts
`project:target:production,staging`. Two independent places to get an ordering wrong.

## The alternative to duplication

If two configurations share almost everything, the shared part belongs in `options` and each
configuration states only its own deviation. That inverts the generated layout, and it is the right
inversion once you have three environments:

```json
{
  "options": {
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json",
    "outputHashing": "all",
    "budgets": [
      { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
      { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
    ]
  },
  "configurations": {
    "production": {},
    "staging": {
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.staging.ts" }
      ]
    },
    "development": {
      "optimization": false,
      "sourceMap": true,
      "outputHashing": "none",
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.development.ts" }
      ]
    }
  }
}
```

Now the budgets run everywhere, hashing is on unless a configuration turns it off, and adding a
fourth environment is one `fileReplacements` array rather than a copied block.

## Gotchas

**★ Symptom: you added a `staging` configuration with `fileReplacements` and lost production's
budgets and output hashing.** Cause: a configuration inherits from `options` only; those keys live
in `configurations.production`. Fix: restate them, or lift the shared ones into `options`:

```json
{
  "configurations": {
    "staging": {
      "outputHashing": "all",
      "budgets": [{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }],
      "fileReplacements": [
        { "replace": "src/environments/environment.ts", "with": "src/environments/environment.staging.ts" }
      ]
    }
  }
}
```

**★ Symptom: `ng serve --configuration staging` errors that the configuration is not set in the
workspace, even though `build` has one.** Cause: separate configuration maps per target. Fix: add
the serve-side entry that points at the build configuration:

```json
{ "serve": { "configurations": { "staging": { "buildTarget": "my-app:build:staging" } } } }
```

**★ Symptom: `ng build --configuration stagng` fails with a message naming the configuration rather
than suggesting one.** Cause: an unknown configuration name throws; there is no fuzzy matching and
no fallback to `options`. Fix: the names are exact strings — the full error surface is
**15 · When `angular.json` is wrong** *(not written yet)*:

```bash
ng build --configuration staging
```

**★ Symptom: `ng build --configuration staging,french` applies `french`'s output path and you
expected `staging`'s.** Cause: comma-separated configurations are applied left to right and the
last value wins per key. Fix: order them so the more specific one is last, and keep the axes
genuinely orthogonal so they rarely collide:

```bash
ng build --configuration french,staging
```

**★ Symptom: staging output overwrites production output in the same directory.** Cause:
`outputPath` is in `options` and no configuration changes it, so every configuration writes to the
same place — and `deleteOutputPath` defaults to `true`, so the second build clears the first. Fix:
give the configuration its own path if two builds must coexist:

```json
{ "configurations": { "staging": { "outputPath": "dist/staging" } } }
```

**Symptom: a fourth environment is added and the `configurations` block is now four near-identical
copies.** Cause: the shared settings were never lifted into `options`. Fix: invert the layout —
common values in `options`, deviations only in configurations:

```json
{
  "options": { "outputHashing": "all", "budgets": [{ "type": "initial", "maximumError": "1MB" }] },
  "configurations": { "production": {}, "staging": {}, "preview": {}, "development": { "outputHashing": "none" } }
}
```

**Symptom: `production: {}` looks wrong to a reviewer and gets deleted.** Cause: an empty
configuration is meaningful — it names a configuration that applies `options` unchanged, which is
what you want once the shared values live there. Deleting it makes
`ng build --configuration production` fail. Fix: keep it, and say why in the pull request:

```json
{ "configurations": { "production": {} } }
```

**Symptom: CI deploys staging but the environment values are production's.** Cause: the CI command
does not name the configuration, so `defaultConfiguration` applied — which in a generated workspace
is `production`. Fix: name it explicitly in CI rather than relying on a default that someone may
change:

```bash
ng build --configuration staging
```

## Interview questions

**★ You add a `staging` configuration by copying the `fileReplacements` array from `development`.
What have you just broken?**
Output hashing and budgets, and possibly more. A configuration inherits from `options` and from
nothing else — there is no `extends`, and copying one configuration's array does not bring across
the rest of the configuration it came from. In a generated workspace `outputHashing` and `budgets`
exist only inside `configurations.production`, so a staging configuration modelled on `development`
has neither. The fix is to restate them in every configuration that needs them, or to lift the
shared ones into `options` so every configuration inherits them.

**★ How do you compose configurations in Angular, given there is no `extends`?**
At invocation time, with a comma-separated list: `ng build --configuration staging,french`. The
documentation is explicit that they are applied left to right and that *"if multiple configurations
change the same setting, the last-set value is the final one."* That composes orthogonal axes
cleanly — environment and locale, say — but it does not give you inheritance, because the base you
want to reuse is still a configuration someone has to name every time. Genuine sharing goes in
`options`.

**★ When should shared settings move from `configurations.production` into `options`?**
As soon as there is a third configuration. With two, the generated layout is readable: `options`
holds the application, `production` holds the shipping settings, `development` holds the fast-loop
settings. With three or more, every new configuration has to re-copy the shipping settings, and the
copies drift. Lifting `outputHashing` and `budgets` into `options` and letting `development` turn
hashing off inverts the duplication so that only the genuinely different values are written down.

**Why does an empty configuration object have a purpose?**
Because a configuration name has to exist for `--configuration` to accept it, and once shared
settings live in `options` there may be nothing left for a given configuration to say.
`"production": {}` means "build with `options` exactly", which is a real, nameable thing. Deleting
it as redundant breaks every command and script that names `production`, and the error message
names a configuration rather than explaining the deletion.

**A staging build overwrites the production build in `dist/`. What happened?**
`outputPath` is set once in `options` and no configuration overrides it, so all configurations
write to the same directory — and `deleteOutputPath` defaults to `true`, so each build clears
whatever the previous one left. Nothing is wrong with the file; it simply never expressed the idea
that two configurations produce artefacts that must coexist. If they do, each configuration needs
its own `outputPath`.

**How many edits does adding an environment actually take?**
Four: the environment source file, the build configuration, the serve configuration, and whatever
invokes it. Only the first two are obvious, which is why the usual failure is a configuration that
builds correctly but cannot be served, or a CI job still building `production` because nobody
changed the command. Treat "does anything actually name this configuration?" as the last check
before calling the change done.

{/* FOOTER */}
