---
title: "Eleven fields carry every edit a real project ever makes to `angular.json`, and choosing between `options` and a configuration for each one is the decision that actually goes wrong"
sidebar_label: "06c · The live fields"
sidebar_position: 6.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; configuration semantics quoted verbatim from
> [angular.dev/tools/cli/environments](https://angular.dev/tools/cli/environments).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the payoff of the whole topic: after this page you can open an unfamiliar `angular.json`
and classify every line in it.** Scaffolding, live setting, or leftover. The live set is small —
eleven fields cover essentially every deliberate edit a production Angular workspace ever
accumulates — and for each one the interesting question is not *what does it do* but *where does it
go*: in `options`, where it applies to every build, or in a configuration, where it applies to one.

## The eleven

| Field | Why a real project touches it | Where it belongs | Covered in |
|---|---|---|---|
| `budgets` | make CI fail on a size regression | a configuration CI actually runs, or `options` | [08](08-budgets-the-seven-types.md), [09](09-when-a-budget-fails.md) |
| `fileReplacements` | per-environment values | a configuration, always | [07](07-file-replacements.md) |
| `assets` | copy something extra, or stop copying something | `options` | **10 · `assets`, `styles`, `scripts`** |
| `styles` / `scripts` | a global stylesheet, a third-party script | `options` | **10** |
| `outputPath` | a deploy toolchain expects a different layout | `options` | **11 · `outputPath`, `index`, `dist`** |
| `optimization` / `sourceMap` | ship source maps, keep licence comments, disable an optimisation | a configuration | **12 · `optimization` and `sourceMap`** |
| `proxyConfig` | talk to a local backend | the **serve** target's `options` | [topic 05 · 06j](../05-the-build-angular-build/06j-proxying-to-a-backend.md) |
| `allowedCommonJsDependencies` | silence a warning you have decided to accept | `options` | [topic 05 · 09](../05-the-build-angular-build/09-what-breaks-when-you-switch.md) |
| `define` / `loader` / `conditions` | build-time values and non-JS imports | `options`, or a configuration for `define` | [topic 05 · 10](../05-the-build-angular-build/10-features-only-this-builder-has.md) |
| `cli.cache` / `cli.packageManager` / `cli.schematicCollections` | workspace policy | the top-level `cli` block | **13 · The `cli` block** |
| a new named `configurations` entry | a staging or preview environment | `configurations` | [07b](07b-environments-in-practice.md) |

Everything else in the file is either scaffolding ([06b](06b-scaffolding-you-do-not-edit.md)) or a
default you have never needed to override.

## The decision that actually goes wrong

For every one of those fields the question is the same, and it has a clean rule:

> **Put it in `options` if it is true of every build. Put it in a configuration if it is true of
> one.**

The trap is the third case people reach for, which does not exist: *"true of most builds, with one
exception."* There is no inheritance between configurations and no way to add to a base value from
a configuration — a configuration replaces the value of every key it names. So "most builds plus an
exception" has to be expressed as either a value in `options` that each exceptional configuration
**restates in full**, or a value repeated in every configuration.

The rule that forces this is **04 · `options` and `configurations`**; the
consequence is worth stating here because it is what makes the eleven fields above hard rather than
obvious.

## Where each of the eleven actually goes

**`budgets` — wherever CI runs.** The generated file puts them in `configurations.production` only.
That is right if CI builds production and wrong the moment it does not. A budget that never
executes is worse than no budget, because it looks like a guard. See
[09](09-when-a-budget-fails.md).

**`fileReplacements` — always a configuration.** A replacement that applies to every build is not a
replacement; it is just the file you should have imported. [07](07-file-replacements.md).

**`assets`, `styles`, `scripts` — `options`.** These describe the application, not the environment.
Putting a stylesheet in a configuration means the other configurations silently build a differently
styled application, and because a configuration replaces the whole array you will lose the base
entries the first time you try.

**`outputPath` — `options`,** unless two configurations genuinely deploy to different layouts. If
they do, restate it in both rather than setting it once and overriding it once, so a reader can see
both values without computing a merge.

**`optimization` and `sourceMap` — a configuration.** They are the archetypal per-environment
settings, and the generated file already demonstrates the shape. The specific trap is setting one
of them as an **object** in `options` and a **boolean** in a configuration, which throws the object
away wholesale.

**`proxyConfig` — the serve target.** It is a dev-server option, not a build option; the
`application` builder's schema does not declare it and `additionalProperties: false` will reject
it. This is the single most common "why is my option rejected" in this file.

**`allowedCommonJsDependencies` — `options`,** and it should be a short list with a comment in your
pull request explaining each entry. It suppresses a warning about a real cost; it does not remove
the cost.

**`define`, `loader`, `conditions` — `options`,** except `define`, which is frequently
per-environment and belongs in a configuration when it is.

**`cli.*` — the top-level `cli` block**, which is workspace-wide and not part of any target.

**A new `configurations` entry — plus its serve-side twin.** Adding `staging` to `build` does not
create `staging` on `serve`; both targets keep separate maps
([05d](05d-serve-test-and-libraries.md)).

## Gotchas

**★ Symptom: `"proxyConfig"` in the build target's `options` is rejected as an additional
property.** Cause: it is a dev-server option; the `application` builder's schema does not declare
it and rejects unknown keys. Fix: move it to the `serve` target:

```json
{
  "serve": {
    "builder": "@angular/build:dev-server",
    "options": { "proxyConfig": "proxy.conf.json" }
  }
}
```

**★ Symptom: you add a `staging` configuration and it builds without budgets, without hashing and
without your production `define` values.** Cause: a configuration inherits from `options`, never
from another configuration — there is no `extends`. Fix: restate everything staging needs, or move
the shared parts into `options` so both configurations inherit them:

```json
{
  "configurations": {
    "production": { "outputHashing": "all", "budgets": [{ "type": "initial", "maximumError": "1MB" }] },
    "staging":    { "outputHashing": "all", "budgets": [{ "type": "initial", "maximumError": "1MB" }] }
  }
}
```

**★ Symptom: budgets are configured and CI has never failed on a size regression.** Cause: the
budgets live in `configurations.production` and CI runs a different configuration, so the array is
replaced by one that does not exist and nothing is checked. Fix: name the configuration in CI, or
put the budgets where every build sees them:

```json
{
  "options": {
    "budgets": [{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }]
  }
}
```

**★ Symptom: you added a global stylesheet inside `configurations.production` and development
builds lost their styling.** Cause: `styles` describes the application, and a configuration
replaces the whole array for the configuration that names it — the other configurations never see
your addition. Fix: put it in `options`:

```json
{ "options": { "styles": ["src/styles.css", "src/theme.css"] } }
```

**★ Symptom: `optimization.fonts.inline` is set in `options` and has no effect in any build.**
Cause: both generated configurations name `optimization` — `development` sets it to `false`, and a
production build that names it replaces the object too. A boolean replaces an object wholesale.
Fix: express the per-configuration value as an object so nothing is lost:

```json
{
  "options": { "optimization": { "fonts": { "inline": true } } },
  "configurations": {
    "development": { "optimization": { "scripts": false, "styles": false, "fonts": false } }
  }
}
```

**Symptom: source maps ship to production because `sourceMap: true` was set in `options` to fix a
debugging session.** Cause: `options` applies to every build, and nothing in the production
configuration turns it back off. Fix: put it in the configuration that needs it, and if you do want
production maps, use the hidden form deliberately:

```json
{
  "configurations": {
    "development": { "sourceMap": true },
    "production": { "sourceMap": { "scripts": true, "styles": false, "hidden": true } }
  }
}
```

**Symptom: `allowedCommonJsDependencies` has grown to a dozen entries and nobody knows which are
still needed.** Cause: it silences a warning rather than resolving it, so entries accumulate and
never leave. Fix: treat it as a list with an owner — remove one, build, and see whether the warning
returns:

```json
{ "options": { "allowedCommonJsDependencies": ["some-legacy-lib"] } }
```

**Symptom: a third-party script added to `scripts` is not available to your components at
import time.** Cause: `scripts` injects a global script into the page; it is not a module the
TypeScript program can import. Fix: if the library ships an ESM entry point, import it instead and
let the bundler handle it:

```ts
import { createChart } from 'some-chart-lib';
```

**Symptom: `outputPath` was changed and the deploy still reads the old directory.** Cause: nothing
outside `angular.json` learns about the change — CI scripts, Dockerfiles and hosting configuration
all hold the path independently. Fix: change it in one place and grep for the old value everywhere
else:

```json
{ "options": { "outputPath": "dist/web" } }
```

**Symptom: `cli.cache` is disabled workspace-wide to work around one machine's problem.** Cause:
the `cli` block is workspace policy and applies to everyone who clones the repository. Fix: keep
the workspace setting and let the affected machine use an environment override rather than
committing a global slowdown — the cache options are **13 · The `cli` block**.

## Interview questions

**★ How do you decide whether a setting belongs in `options` or in a configuration?**
Ask whether it is true of every build or of one. Application-shaped facts — the entry point, the
assets, the global stylesheets, the output layout — go in `options`. Environment-shaped facts —
optimisation, source maps, hashing, file replacements, budgets in a project that only enforces them
on one path — go in a configuration. The case that trips people is "true of most builds with one
exception", because there is no inheritance between configurations and no additive merge: a
configuration replaces the value of every key it names, so the exception has to restate the value
in full.

**★ Which fields does a real Angular project actually change in `angular.json`?**
About eleven: `budgets`, `fileReplacements`, `assets`, `styles`/`scripts`, `outputPath`,
`optimization`/`sourceMap`, `proxyConfig` on the serve target, `allowedCommonJsDependencies`,
`define`/`loader`/`conditions`, the `cli` block, and the addition of a named configuration.
Everything else is either scaffolding a schematic wrote alongside files on disk, or a builder
default nobody has needed to override. Being able to say that quickly is the difference between
treating this file as configuration and treating it as a target graph you can reason about.

**★ Why can a new `staging` configuration not be "based on" production?**
Because configurations do not compose. There is no `extends`, and the merge that happens at build
time is a shallow spread of the selected configuration over `options` — not over another
configuration. Naming two configurations on the command line applies them left to right with later
values winning per key, which is the closest thing available, but within the file each entry stands
alone. The practical consequence is duplication: shared settings either live in `options` or are
repeated verbatim in every configuration that needs them.

**★ Why is `proxyConfig` rejected in the build target?**
Because options are validated against the schema of the builder named in that target, and
`proxyConfig` is declared by `@angular/build:dev-server`, not by `@angular/build:application`. The
application schema is `additionalProperties: false`, so an unknown key fails validation rather than
being ignored. It is a useful mistake to have made once: it teaches that a target's option surface
is defined entirely by its builder, and that "an option of Angular" is not a category that exists.

**When is `allowedCommonJsDependencies` the right answer, and when is it hiding a problem?**
It is right when the dependency genuinely has no ESM build, you have checked, and you have decided
the bundling cost is acceptable — it silences a warning about a decision you made. It is hiding a
problem when it was added to make output quiet, because the warning exists to tell you that a
dependency cannot be tree-shaken properly and is inflating the bundle. The distinguishing test is
whether anyone can say, per entry, why it is there. A list nobody can explain is a list of
unexamined bundle weight.

**You are handed an unfamiliar `angular.json`. What do you read first?**
The builder strings, because they determine which option schemas everything else is validated
against and whether the workspace is on the deprecated webpack path. Then `defaultConfiguration` on
each target, because it decides what a bare `ng build` or `ng serve` actually does. Then the
`configurations` maps, because that is where the environment differences live. `options` is last —
it is usually the least surprising part of the file, and anything unusual in it will already have
been implied by the first three.

{/* FOOTER */}
