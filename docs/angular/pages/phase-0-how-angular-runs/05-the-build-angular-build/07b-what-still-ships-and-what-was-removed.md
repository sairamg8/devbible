---
title: "The deprecated package still declares eleven builders, its first entry is a one-line alias to the new one, and it depends on `@angular/build` rather than the other way round — so keeping one webpack builder installs the entire webpack stack you are not using"
sidebar_label: "07b · What still ships, what was removed"
sidebar_position: 7.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the builder manifest from
> [`packages/angular_devkit/build_angular/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/builders.json)
> at tag `v22.1.7`; the package description, dependency list and version pins from the published
> manifest at `https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7`; the SemVer
> disclaimer and the builder table from
> [`packages/angular_devkit/build_angular/README.md`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/README.md);
> the removals from the `22.0.0 (2026-06-03)` Breaking Changes section of
> [`CHANGELOG.md`](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md); the
> consolidation statement from
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Deprecation removed nothing, and the package that carries the deprecated builders is not a
leftover — it is a superset that depends on the new one.** `@angular-devkit/build-angular@22.1.7`
lists `@angular/build@22.1.7` among its own dependencies, alongside webpack, `webpack-dev-server`,
terser and roughly a dozen loaders and plugins. Its very first builder entry is a one-line alias
pointing at the new package. So a project that installs it "just to keep one builder working" is
installing the new build system *plus* the entire webpack stack it does not use, and a project that
sees `@angular-devkit/build-angular:application` in its `angular.json` is already running
`@angular/build`'s code under a different name.

## The package describes itself in three words

From the published manifest of `@angular-devkit/build-angular` 22.1.7:

```json
"description": "Angular Webpack Build Facade"
```

A **facade** — which is exactly what the manifest below shows it to be.

## The manifest, and the alias hiding in plain sight

From `packages/angular_devkit/build_angular/builders.json` at `v22.1.7`:

```json
{
  "$schema": "../architect/src/builders-schema.json",
  "builders": {
    "application": "@angular/build:application",
    "app-shell":       { "description": "Build a server application and a browser application, then render the index.html and use it for the browser output." },
    "browser":         { "description": "Build a browser application." },
    "browser-esbuild": { "description": "Build a browser application." },
    "dev-server":      { "description": "Serve a browser application." },
    "extract-i18n":    { "description": "Extract i18n strings from a browser application." },
    "karma":           { "description": "Run Karma unit tests." },
    "server":          { "description": "Build a server Angular application." },
    "ng-packagr":      { "description": "Build a library with ng-packagr." },
    "ssr-dev-server":  { "description": "Serve a universal application." },
    "prerender":       { "description": "Perform build-time prerendering of chosen routes." }
  }
}
```

⚠️ **Two things about that block, stated rather than hidden.** The ten object entries each also
carry `"implementation": "./src/builders/<name>"` and `"schema": "./src/builders/<name>/schema.json"`
keys, which are omitted above so the shape is readable; the `description` values are verbatim. The
**`"application"` line is verbatim and complete** — it really is a bare string, not an object.

🔴 **`"application": "@angular/build:application"` is a builder alias.** Architect resolves the
right-hand side and runs the new package's builder. That means
`@angular-devkit/build-angular:application` and `@angular/build:application` are not two similar
builders — they are one builder reached by two names. The alias exists so that a project migrated to
the `application` builder does not have to rewrite the string on the same day it changes builders;
how Architect follows an alias, and the `Circular builder alias references detected:` error you get
if two aliases point at each other, is topic 06's material.

## The dependency direction is the argument

From the same published manifest, `@angular-devkit/build-angular@22.1.7` depends on — among others —
**`@angular/build: 22.1.7`**, plus:

| Dependency | Pin | What it is |
|---|---|---|
| `webpack` | 5.109.2 | the bundler |
| `webpack-dev-server` | 5.2.6 | the old dev server |
| `webpack-merge` | 6.0.1 | config composition |
| `webpack-dev-middleware` | 8.0.3 | the middleware behind it |
| `terser` | 5.49.0 | the minifier esbuild replaced |
| `css-loader` · `sass-loader` · `less-loader` · `postcss-loader` · `babel-loader` · `source-map-loader` · `resolve-url-loader` | 7.1.4 · 17.0.0 · 13.0.0 · 8.2.1 · 10.1.1 · 5.0.0 · 5.0.0 | the loader chain |
| `copy-webpack-plugin` · `mini-css-extract-plugin` · `license-webpack-plugin` · `webpack-subresource-integrity` | 14.0.0 · 2.10.2 · 4.0.2 · 5.1.0 | the plugin chain |
| `@ngtools/webpack` | 22.1.7 | Angular's own webpack integration — itself deprecated |
| `@angular-devkit/build-webpack` | 0.2201.7 | the webpack devkit builders — also deprecated |
| `esbuild-wasm` | 0.28.2 | the WebAssembly esbuild fallback |

🔴 **`@angular-devkit/build-angular` depends on `@angular/build`, not the reverse.** The legacy
package is the new build system *plus* about twenty webpack packages. That is the whole cost
argument for migrating in one sentence: you are not choosing between two build systems, you are
choosing whether to also install a second one you do not run.

Compare it with what the new package contains — twenty-six dependencies, esbuild, Vite, Rolldown and
oxc-parser, and no webpack at all — in **02 · Inside the package** *(not written yet)*.

## What `application` swallowed

The consolidation is why migrating off webpack is one migration rather than four. Verbatim:

> *"The `application` builder now provides the integrated functionality for all of the following
> preexisting builders:*
> *- `app-shell`*
> *- `prerender`*
> *- `server`*
> *- `ssr-dev-server`"*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

So four of the eleven entries in the manifest above are superseded by options on a single builder
rather than by four replacements. A project migrating away from them is deleting targets, not
rewriting them — which is also why the automated migration *"Removes any previous SSR builders
(because `application` does that now)"*. The mechanics of that migration are
**08 · Migrating off webpack** *(not written yet)*.

## What was actually removed in v22.0.0

Deprecation and removal happened in the same release, to different things. From the Breaking Changes
block, verbatim:

> *"The experimental `@angular-devkit/build-angular:jest` and
> `@angular-devkit/build-angular:web-test-runner` builders have been removed."*

> *"The `@angular-devkit/architect-cli` package is no longer available. The `architect` CLI tool has
> been moved to the `@angular-devkit/architect` package."*

Two removals, both narrow: two experimental test builders, and a CLI package whose contents moved
rather than disappeared. Neither touches the webpack builders. This is worth stating explicitly
because it demonstrates that the team does remove things in a major — and chose not to remove these.

## The builders are stable; their internals are not

The package's own README carries a disclaimer worth quoting whenever anyone proposes calling a
builder from code:

> *"While the builders when executed via the Angular CLI and their associated options are considered
> stable, the programmatic APIs are not considered officially supported and are not subject to the
> breaking change guarantees of SemVer."*
> — [`packages/angular_devkit/build_angular/README.md`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/README.md)

The line the README draws is between **the builder plus its options**, which are stable, and
**everything you can reach by importing the package**, which is not. A tool that shells out to
`ng build` is on the supported side of that line; a tool that imports a builder function is not, and
a patch release may move under it.

The same README also states, in its builder table, what each of the three application builders uses
— which is the cleanest one-line summary of the whole topic:

> *"| application     | Build an Angular application targeting a browser and server environment using [esbuild](https://esbuild.github.io).  |"*
> *"| browser         | Build an Angular application targeting a browser environment using [Webpack](https://webpack.js.org).  |"*
> *"| browser-esbuild | Build an Angular application targeting a browser environment using [esbuild](https://esbuild.github.io). |"*

## Gotchas

**★ Symptom: `@angular-devkit/build-angular:application` and `@angular/build:application` behave
identically and you cannot tell which you are "really" using.** Cause: the first is a literal
one-line alias to the second — `"application": "@angular/build:application"` in the legacy package's
manifest. There is one implementation. Fix: name the new package directly and drop the legacy
dependency once nothing else needs it; the alias exists to make the transition gradual, not to be a
destination:

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json"
  }
}
```

**★ Symptom: `node_modules` is far larger than a project using esbuild ought to need.** Cause:
`@angular-devkit/build-angular` depends on `@angular/build` *and* webpack, `webpack-dev-server`,
terser, seven loaders and four plugins. Keeping it for one builder installs both build systems. Fix:
migrate the remaining target, then remove the dependency — checking the target strings first,
because removing the package while a target still names one of its builders breaks resolution:

```bash
grep -n '"builder"' angular.json
```

**★ Symptom: a target using `@angular-devkit/build-angular:jest` stopped resolving after the v22
update.** Cause: it was **removed**, not deprecated — *"The experimental
`@angular-devkit/build-angular:jest` and `@angular-devkit/build-angular:web-test-runner` builders
have been removed."* Fix: move the `test` target to a builder that exists; what `ng new` writes at
22.1.7 and its stability label are **12 · The test builders** *(not written yet)*.

**★ Symptom: a script that invoked `architect` from `@angular-devkit/architect-cli` fails to
install.** Cause: *"The `@angular-devkit/architect-cli` package is no longer available. The
`architect` CLI tool has been moved to the `@angular-devkit/architect` package."* Fix: depend on
`@angular-devkit/architect` instead — the tool moved, it was not deleted.

**★ Symptom: you migrated to the `application` builder and your `server`, `prerender`, `app-shell`
or `ssr-dev-server` targets disappeared.** Cause: *"The `application` builder now provides the
integrated functionality for all of the following preexisting builders"* — the automated migration
*"Removes any previous SSR builders (because `application` does that now)"*. Fix: expected. Their
behaviour is now options on the one builder rather than separate targets:

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "browser": "src/main.ts",
    "server": "src/main.server.ts",
    "tsConfig": "tsconfig.app.json",
    "ssr": { "entry": "src/server.ts" },
    "prerender": true
  }
}
```

**★ Symptom: a build tool that imports a builder function broke on a patch upgrade.** Cause: the
README's own disclaimer — *"the programmatic APIs are not considered officially supported and are
not subject to the breaking change guarantees of SemVer."* Only the builders as invoked through the
CLI, and their options, are stable. Fix: invoke the CLI rather than importing the implementation:

```bash
ng run my-app:build:production
```

**Symptom: you removed `@angular-devkit/build-angular` and `ng build` now fails to find its
builder.** Cause: builder strings resolve by package lookup at run time, so the dependency is what
makes the name resolvable. If any target still names one of its builders — including the
`application` alias — removing the package removes the builder. Fix: change the strings first, then
the dependency, and verify with the file rather than with a successful `npm install`.

**Symptom: `@angular-devkit/build-webpack` appears in a dependency tree and nothing in your project
mentions it.** Cause: it is a dependency of `@angular-devkit/build-angular` at `0.2201.7`, and it
carries its own deprecated webpack builders. Fix: nothing to do directly — it leaves when the
package that pulled it in leaves.

**Symptom: someone claims the legacy package is "just the old builders" and can be updated
independently.** Cause: it is not — it pins `@angular/build` at the exact same version (22.1.7 for
22.1.7), so its version moves with the new package by construction. Fix: treat them as one release
line; there is no combination where the legacy package is on one version of the build system and the
new package on another.

## Interview questions

**★ What is the relationship between `@angular-devkit/build-angular` and `@angular/build`?**
The deprecated package depends on the new one. `@angular-devkit/build-angular@22.1.7` lists
`@angular/build@22.1.7` in its dependencies, alongside webpack, `webpack-dev-server`, terser and
around a dozen loaders and plugins — its own manifest calls it an *"Angular Webpack Build Facade"*.
So it is a superset, not an alternative: installing it gives you the esbuild-based build system plus
a second, unused one. That single fact is the clearest argument for completing a migration, because
the cost of staying is not "an older build system", it is "both build systems".

**★ There is a one-line entry `"application": "@angular/build:application"` in the legacy manifest.
What is it and why does it exist?**
It is a builder alias: Architect resolves the right-hand side and runs the new package's
implementation. It exists so that the builder migration and the package migration can happen at
different times — a project can move its target to the `application` builder while still depending
on `@angular-devkit/build-angular`, and rewrite the string later. The practical implication is that
`@angular-devkit/build-angular:application` is not a legacy builder at all; it is the new builder
under an old name, and a project that sees it in `angular.json` has already migrated the build and
has only the dependency left to clean up.

**★ Which builders did the `application` builder subsume, and why does that shape a migration plan?**
Four: `app-shell`, `prerender`, `server` and `ssr-dev-server` — angular.dev states it explicitly.
That is why migrating off webpack is one migration rather than four: those targets are deleted and
their behaviour becomes options on a single builder, which is also why the automated migration
*"Removes any previous SSR builders"*. For planning, it means an SSR project's migration is
structurally *larger* than a client-only one — more targets disappear and more configuration moves —
even though it is still one migration.

**★ What was actually removed in v22.0.0, as opposed to deprecated?**
Two experimental test builders — *"The experimental `@angular-devkit/build-angular:jest` and
`@angular-devkit/build-angular:web-test-runner` builders have been removed"* — and the
`@angular-devkit/architect-cli` package, whose tool moved into `@angular-devkit/architect`. Neither
is a webpack builder. The contrast is the useful part of the answer: the same release that removed
two experimental builders chose to deprecate the webpack ones and leave every one of them in place,
which is evidence about intent even though it is not a schedule.

**Are Angular's builders covered by SemVer?**
Partly, and the README draws the line precisely: *"While the builders when executed via the Angular
CLI and their associated options are considered stable, the programmatic APIs are not considered
officially supported and are not subject to the breaking change guarantees of SemVer."* So the
builder name and its option schema are a stable contract you can depend on across patch and minor
releases; anything you reach by importing the package is not, and can move in a patch. Any tooling
built around Angular builds should therefore shell out to `ng` rather than import builder
implementations, however tempting the latter is.

{/* FOOTER */}
