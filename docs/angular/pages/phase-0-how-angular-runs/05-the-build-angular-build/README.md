---
title: "The build is one package with twenty-six dependencies and no webpack in them — esbuild bundles, Rolldown re-chunks, Vite serves, and the webpack builders it replaced were formally deprecated in three packages on the same day"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **`@angular/build` 22.1.7** — the published manifest at
> `https://registry.npmjs.org/@angular/build/22.1.7`,
> [`packages/angular/build/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/builders.json)
> at tag `v22.1.7`, the `22.0.0` and `22.1.0` sections of
> [CHANGELOG.md](https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md), and
> [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build). Documentation-validated;
> **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ng build` does exactly one thing: it runs the builder named in the `build` target of the
resolved project.** Everything people mean when they say "the Angular build" — the AOT compilation,
the bundling, the chunking, the dev server — is downstream of that single lookup, and since v18 the
thing it looks up is `@angular/build:application`. This topic is about what that package actually
is, which turns out to be answerable by reading one JSON object: its dependency list names
**esbuild**, **Vite**, **Rolldown** and **oxc-parser**, and names webpack nowhere at all.

🔴 **`@angular/build` versions independently of `@angular/core`.** The framework is at **22.1.5**
and the build system at **22.1.7**; both numbers are correct and they are not the same line. A page
or a `package.json` that writes "Angular 22.1.7" has mixed them up.

🔴 **The webpack builders are not merely legacy — v22.0.0 formally deprecated them**, in
`@angular-devkit/build-angular`, `@angular-devkit/build-webpack` and `@ngtools/webpack`, on the same
day. They still ship and still work. The release notes name no removal version, and this topic does
not guess one.

## Chunks

🚧 **Being written.** Chunks land one at a time and every row below links to a page that exists;
planned chunks appear as plain text until they do, because a link to a page that does not exist
fails the build for the whole site.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What `ng build` actually runs](01-what-ng-build-actually-runs.md)** | One lookup, four build builders, and the output path the docs understate |
| 02 | **Inside the package** *(not written yet)* | Twenty-six dependencies, two non-optional peers, and why that is the design |
| 03 | **esbuild does the output** *(not written yet)* | AOT inside a plugin; browserslist becomes an esbuild target |
| 04 | **The Rolldown chunk optimizer** *(not written yet)* | 🔴 The second pass, default since 22.1.0 |
| 05 | **Vite is only the dev server** *(not written yet)* | An in-memory build handed to Vite; prebundling; HMR scope |
| 06 | **The dev-server contract** *(not written yet)* | 🔴 `PORT` outranks `angular.json` **and** `--port` since v22 |
| 07 | **The webpack builders are deprecated** *(not written yet)* | Three packages, one day, and what still ships |
| 08 | **Migrating off webpack** *(not written yet)* | `use-application-builder`, the option renames, `browser-esbuild` as the cheap path |
| 09 | **What breaks when you switch** *(not written yet)* | Output location, ESM imports, side-effect order, CommonJS, top-level await |
| 10 | **Features only this builder has** *(not written yet)* | `define`, `loader`, import attributes, import conditions |
| 11 | **Cache, workers and the environment variables** *(not written yet)* | `.angular/cache`, the SQLite fallback, the `NG_BUILD_*` surface |
| 12 | **The test builders** *(not written yet)* | `unit-test` is `[EXPERIMENTAL]` and is also what `ng new` writes |

## Where this sits

Topics [01](../01-compiler-with-a-framework-attached/README.md) to
[03](../03-the-provider-array/README.md) explain what an Angular application *is*;
[04](../04-ng-update-not-npm-install/README.md) explains how you keep it current. This one and the
seven after it explain the machinery it is built with — the builder, the config file that names it,
the TypeScript setup it demands, and what `ng new` lays down.

⚠️ **How `"@angular/build:application"` becomes a function call is topic 06**, which owns
`angular.json`, Architect, and builder resolution. This topic stops at the package boundary.

## Phase gate

You are done with this topic when you can say which builder a given project uses and where you
looked, name what bundles and what serves and what merely re-chunks, predict which directory your
`index.html` lands in before running anything, and decide — with reasons — whether a project on the
webpack builders should move.

---

← Prev: [04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md) · Index: [Phase 0](../README.md) · Start → [01 · What `ng build` actually runs](01-what-ng-build-actually-runs.md) · Next topic → **06 · `angular.json` anatomy** *(not written yet)*
