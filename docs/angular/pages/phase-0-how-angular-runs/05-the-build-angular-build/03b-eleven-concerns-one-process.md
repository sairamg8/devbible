---
title: "The `application` builder does eleven things around the bundle — chunk optimization, budgets, licenses, i18n and a CommonJS check among them — and knowing their order explains why budgets pass in `ng serve` and fail in CI"
sidebar_label: "03b · Eleven concerns, one process"
sidebar_position: 3.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against `angular/angular-cli` at tag `v22.1.7` —
> [`packages/angular/build/src/builders/application/execute-build.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts)
> (its comment structure only) and
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> — plus [the build system migration guide](https://angular.dev/tools/cli/build-system-migration) on
> angular.dev. Documentation-validated; **no sandbox run**; ⚠️ `execute-build.ts` was **not read end
> to end**, and this page says so wherever that matters.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"esbuild bundles it" is where people stop, and it accounts for maybe half of what the
`application` builder does.** Around the bundle sit ten more responsibilities — a second bundling
pass, budget evaluation, transfer-size accounting, a CommonJS check, asset copying, license
extraction, i18n and a metafile — and almost every one of them corresponds to an option you can see
in `angular.json`. Two of them explain a class of bug that otherwise looks like flakiness: budgets
are evaluated *after* chunk optimization, and chunk optimization is gated on the same flag that
controls minification.

## The concerns `execute-build.ts` names, in the order it names them

| Order in the file | Concern |
|---:|---|
| 1 | bundle |
| 2 | dispose |
| 3 | chunk optimization |
| 4 | external import analysis |
| 5 | budgets |
| 6 | transfer sizes |
| 7 | CommonJS check |
| 8 | assets |
| 9 | licenses |
| 10 | i18n |
| 11 | metafile |

⚠️ **That is a list of the concerns that appear as comments in one file, cited as such — not a
specification of the build pipeline.** This page did not read the file end to end, and the sources
that would settle the exact internal ordering are the programmatic ones, which carry no SemVer
guarantee. Take the table as a map of *what that builder is responsible for*, not as a contract you
can depend on.

## Each concern has an option with its name on it

The mapping below lines up a named concern with the declared option that plainly governs it. ⚠️
**The names line up; the wiring was not traced.** Read it as a navigation aid — "if this concern
misbehaves, that is the option to look at" — rather than as an implementation claim.

| Concern | The option in `angular.json` | Schema default |
|---|---|---|
| chunk optimization | `optimization.scripts` gates it | `true` |
| budgets | `budgets` | `[]` |
| CommonJS check | `allowedCommonJsDependencies` | `[]` |
| assets | `assets` | `[]` |
| licenses | `extractLicenses` | `true` |
| i18n | `localize`, `i18nMissingTranslation`, `i18nDuplicateTranslation` | `—`, `"warning"`, `"warning"` |
| metafile | `statsJson` | `false` |

Three of those defaults are worth stating out loud because they surprise people:

- **`budgets` defaults to `[]`.** The builder applies no budgets at all unless your configuration
  lists them. The values people quote as "the Angular defaults" are what the `ng new` schematic
  *writes into your `production` configuration*, which is a different thing from a builder default.
- **`extractLicenses` defaults to `true`**, which is why a production build produces a licenses
  file you did not ask for — and why the generated `development` configuration explicitly turns it
  off.
- **`statsJson` defaults to `false`.** It is the switch you flip before any bundle-analysis work;
  the analysis itself is **Phase 14 · Performance and the build** *(not written yet)*.

## The two consequences that explain real bugs

**1 · Budgets are evaluated after chunk optimization.** The budget concern sits below the
chunk-optimization concern in that file, so the sizes a budget checks are the sizes of the *final*
chunks — after the rolldown pass has combined and restructured them. A budget is therefore a
statement about optimized output, and comparing it against anything a development build produces is
comparing two different artefacts.

**2 · Chunk optimization is gated on `optimization.scripts`.** Turning script optimization off does
not merely skip minification; it skips an entire second bundling stage, which can change the
*number and names* of your chunks. That is why "I disabled minification to debug something and the
chunk layout changed" is expected rather than a bug. The threshold that decides whether the pass
runs at all, and what it does when it does, is **04 · The Rolldown chunk optimizer**
*(not written yet)*.

Put together, they produce the most common false alarm in this area: **budgets that pass locally and
fail in CI.** The `build` target's `defaultConfiguration` is `production` and `serve`'s is
`development`; budgets only exist in the `production` configuration the schematic writes; and they
are measured on optimized, chunk-optimized output. Three separate reasons a development run tells
you nothing about them.

## ESM output, and the two things it changes for you

The output format is the first bullet of the documentation's own description of the build system:

> *"- A modern output format using ESM, with dynamic import expressions to support lazy module
> loading."*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

Two consequences show up in real projects.

**CommonJS dependencies are now remarkable.** The builder runs a CommonJS check as one of its
concerns, and a CommonJS-only dependency gets flagged rather than silently wrapped. The declared
escape hatch is `allowedCommonJsDependencies`:

```json
{
  "builder": "@angular/build:application",
  "options": {
    "tsConfig": "tsconfig.app.json",
    "browser": "src/main.ts",
    "allowedCommonJsDependencies": ["some-legacy-package"]
  }
}
```

Use that list as an acknowledgement, not a mute button: every entry is a dependency you have decided
to keep despite it not being ESM, and each one is a small tax on tree-shaking.

**Module side-effect order is the module graph's, not a bundler configuration's.** Code that relied
on webpack's evaluation order can behave differently under ESM semantics. The catalogue of what
changes when you move is **09 · What breaks when you switch** *(not written yet)*.

## Gotchas

**★ Symptom: budgets pass in development and the same commit fails them in CI.** Cause: three
compounding reasons — budgets are generated only in the `production` configuration, `ng serve`
defaults to `development`, and budgets are evaluated after the chunk-optimization pass on optimized
output. Fix: reproduce the CI build locally rather than the default one:

```bash
ng build --configuration production
```

**★ Symptom: turning `optimization` off to debug something changes the number of output chunks, not
just their contents.** Cause: `optimization.scripts` gates the rolldown chunk-optimization pass as
well as minification, so switching it off removes an entire bundling stage. Fix: turn off only what
you meant to, using the nested form:

```json
{ "optimization": { "scripts": false, "styles": true, "fonts": true } }
```

Verify the nested shape against **topic 06 · `angular.json` anatomy** *(not written yet)* before
relying on it — the outer default is `true` and the inner defaults are independent of it.

**★ Symptom: a dependency that worked under the `browser` builder now produces a CommonJS
warning.** Cause: the output format is ESM and the builder explicitly checks for CommonJS
dependencies. Fix: either move to an ESM build of the dependency, or acknowledge it by name:

```json
{ "allowedCommonJsDependencies": ["some-legacy-package"] }
```

**★ Symptom: you set no `budgets` anywhere and expected Angular's "default budgets" to apply.**
Cause: the builder's schema default for `budgets` is `[]` — the familiar `500kB` / `1MB` numbers are
written into your `production` configuration by the `ng new` schematic, not applied by the builder.
A project that deleted them has no budgets at all. Fix: put them back explicitly:

```json
{
  "budgets": [
    { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
    { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
  ]
}
```

**Symptom: a production build emits a licenses file nobody asked for.** Cause: `extractLicenses`
defaults to `true`; the generated `development` configuration sets it to `false`, which is why you
only see it in production builds. Fix: it is doing its job, but if you genuinely do not want it:

```json
{ "extractLicenses": false }
```

**Symptom: translations silently fall back and nothing fails the build.** Cause:
`i18nMissingTranslation` and `i18nDuplicateTranslation` both default to `"warning"`. Fix: make them
fatal in CI, where a silent fallback is worse than a red build:

```json
{ "i18nMissingTranslation": "error", "i18nDuplicateTranslation": "error" }
```

**Symptom: you want to know why one chunk is enormous and there is no report to read.** Cause:
`statsJson` defaults to `false`, so the builder writes no analysable metadata. Fix: turn it on for
the configuration you want to analyse:

```json
{ "configurations": { "production": { "statsJson": true } } }
```

The analysis workflow that consumes it is **Phase 14 · Performance and the build**
*(not written yet)*.

**Symptom: an asset appears in the output of one configuration and not another, and no error is
raised.** Cause: `assets` defaults to `[]` and is an ordinary option, so a configuration that
overrides it replaces the list rather than adding to it. Fix: check what each configuration actually
sets before assuming inheritance:

```bash
node -p "JSON.stringify(require('./angular.json').projects['my-app'].targets.build, null, 2)"
```

The merge semantics between `options` and `configurations` are **topic 06 · `angular.json`
anatomy** *(not written yet)*, and they are shallower than most people expect.

## Interview questions

**★ What does the `application` builder do besides bundling?**
Around the bundle it runs a second, chunk-optimizing pass, analyses external imports, evaluates
budgets, accounts for transfer sizes, checks for CommonJS dependencies, copies assets, extracts
licenses, handles i18n and writes a metafile — the concerns named, in that order, by comments in its
`execute-build.ts` at `v22.1.7`. The reason to know the list is that nearly every entry maps to an
option you can see in `angular.json`, so "the build did something I did not ask for" almost always
resolves to a default: `extractLicenses` is `true`, the i18n diagnostics are `"warning"`,
`statsJson` is `false`, `budgets` is `[]`.

**★ Why can budgets pass locally and fail in CI on the same commit?**
Because they are measuring different artefacts. Budgets are written into the `production`
configuration by the schematic, `ng serve` defaults to `development`, and the budget step runs after
chunk optimization — so a local development run has no budgets, no optimization and no second
bundling pass. The fix is to run `ng build --configuration production` locally rather than to relax
the budget. The deeper point is that "it works locally" is a claim about a configuration, and in
Angular the configuration is visible: read `defaultConfiguration` on both targets before arguing.

**★ What does "a modern output format using ESM, with dynamic import expressions" cost you?**
The tolerance webpack had for CommonJS. The builder checks for CommonJS dependencies and surfaces
them rather than quietly wrapping them, so you either move to an ESM build of the package or list it
in `allowedCommonJsDependencies` — and each entry there is a real cost to tree-shaking, not a
warning suppressor. It also means module side-effect ordering follows the ES module graph, so code
that depended on webpack's evaluation order can change behaviour. Both are migration issues rather
than bugs, and both are invisible until you switch.

**★ Angular's "default budgets" — where do they actually come from?**
Not from the builder. The `application` builder's schema declares `budgets` with a default of `[]`,
which means no budgets are applied unless the configuration lists them. What people call the
defaults are the entries the `ng new` application schematic writes into the `production`
configuration. The distinction matters twice: a project that deleted the block silently has no
budget enforcement at all, and a documentation table describing "defaults" is describing the
generator, not the builder — which is why the documented and generated numbers can disagree without
either being a bug.

**Why is it worth knowing that chunk optimization runs before budgets?**
Because it tells you that a budget measures the final chunk layout, so the same code can move across
a budget line when nothing about the code changed — a toggle of `optimization.scripts` is enough,
since that flag gates the whole second pass. It also tells you the order to debug in: if a budget
suddenly fails, ask what changed about optimization or chunking before you go hunting for a fat new
dependency.

{/* FOOTER */}
