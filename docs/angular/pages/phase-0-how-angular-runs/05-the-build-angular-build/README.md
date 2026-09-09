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

Thirty-nine pages across twelve concepts. Every concept that outgrew the 300-line cap split on a
concept boundary into lettered siblings — chunk 06 alone became ten pages, which is what an
exhausted topic looks like.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What `ng build` actually runs](01-what-ng-build-actually-runs.md)** | One lookup, four build builders, and the output path the docs understate |
| 02 | **[Inside the package](02-inside-the-package.md)** | The manifest, the description, `engines` |
| 02b | [Twenty-six dependencies](02b-twenty-six-dependencies.md) | 🔴 esbuild, Vite, Rolldown, oxc-parser — and no webpack at all |
| 02c | [The six builders it declares](02c-the-six-builders-it-declares.md) | The whole public surface of `@angular/build` |
| 02d | [The peer contract](02d-the-peer-contract.md) | Fourteen optional peers; the hard requirements are the two compilers |
| 02e | [What `ng new` installs](02e-what-ng-new-installs.md) | Which of those peers actually land in your project |
| 03 | **[esbuild does the output](03-esbuild-does-the-output.md)** | The Angular compiler running inside an esbuild plugin |
| 03b | [Eleven concerns, one process](03b-eleven-concerns-one-process.md) | Everything the builder does besides bundling |
| 03c | [browserslist → esbuild target](03c-browserslist-becomes-an-esbuild-target.md) | How your browser list becomes a compilation target |
| 03d | [Critical CSS and font inlining](03d-critical-css-and-font-inlining.md) | Beasties, and the option that needs network access |
| 04 | **[The Rolldown chunk optimizer](04-the-rolldown-chunk-optimizer.md)** | 🔴 A second pass over esbuild's output, default since 22.1.0 |
| 04b | [What the second pass is worth](04b-what-the-second-pass-is-worth.md) | The threshold, and when it does not run at all |
| 04c | [The Rolldown switch](04c-the-rolldown-switch-and-the-environment.md) | `NG_BUILD_CHUNKS_ROLLDOWN`, and the Rollup path's unconfirmed requirements |
| 05 | **[Vite is only the dev server](05-vite-is-only-the-dev-server.md)** | 🔴 Angular is not "Vite-based"; there is no `vite.config.ts` |
| 05b | [Prebundling](05b-prebundling.md) | What the dev server does to your dependencies, once |
| 05c | [What HMR actually replaces](05c-what-hmr-actually-replaces.md) | ⚠️ Three sources give three different scopes; none is picked |
| 05d | [The dev/prod gap](05d-the-dev-prod-gap.md) | "Works in serve" is a three-line option difference, not a mystery |
| 06 | **[The dev-server contract](06-the-dev-server-contract.md)** | The option surface, and what `serve` shares with `build` |
| 06b | [The serve-to-build coupling](06b-the-serve-to-build-coupling.md) | `buildTarget`, and which options `serve` cannot override |
| 06c | [The rebuild loop](06c-the-rebuild-loop.md) | Watch, rebuild, reload — and where HMR sits in it |
| 06d | [The three that fail silently](06d-the-three-that-fail-silently.md) | Options that accept a value and do nothing with it |
| 06e | [The four that do what they say](06e-the-four-that-do-what-they-say.md) | The straightforward half of the surface |
| 06f | [Ports and the `PORT` variable](06f-ports-and-the-port-variable.md) | 🔴 Since v22, `PORT` outranks `angular.json` **and** `--port` |
| 06g | [When the port is taken](06g-when-the-port-is-taken.md) | A prompt on a laptop, a hard failure in CI |
| 06h | [Host binding and `allowedHosts`](06h-host-binding-and-allowedhosts.md) | 🔴 An unrecognised `Host` is now a 400, not a CSR fallback |
| 06i | [HTTPS on the dev server](06i-https-on-the-dev-server.md) | `ssl`, `sslKey`, `sslCert`, and what the schema does not say |
| 06j | [Proxying to a backend](06j-proxying-to-a-backend.md) | Vite's proxy semantics, which are not webpack's |
| 07 | **[The webpack builders are deprecated](07-the-webpack-builders-are-deprecated.md)** | 🔴 Three packages, one day, and no removal version anywhere |
| 07b | [What still ships, what was removed](07b-what-still-ships-and-what-was-removed.md) | Deprecated and left in place, against actually deleted |
| 08 | **[Migrating off webpack](08-migrating-off-webpack.md)** | Three paths, three destinations — and a conditional package swap |
| 08b | [The option renames](08b-the-option-renames.md) | Eight options, and the one the guide and the schema disagree about |
| 09 | **[What breaks when you switch](09-what-breaks-when-you-switch.md)** | 🔴 The output path change fails nothing and reaches production |
| 09b | [What the build stops telling you](09b-what-the-build-stops-telling-you.md) | A CI-only warning, unchecked workers, a misleading error |
| 10 | **[`define`](10-features-only-this-builder-has.md)** | Values substituted as source code — and never inside a decorator |
| 10b | [`loader`](10b-the-loader-option.md) | Six loaders, and why the choice is really about caching |
| 10c | [Import attributes and conditions](10c-import-attributes-and-conditions.md) | 🔴 "Optimized" means `optimization.scripts`, not a name |
| 11 | **[Cache and workers](11-cache-and-workers.md)** | 🔴 The cache is off in CI by default; workers are capped at four |
| 11b | [The `NG_BUILD_*` surface](11b-the-ng-build-environment-surface.md) | Fourteen variables, none public API, and `=yes` means nothing |
| 12 | **[The test builders](12-the-test-builders.md)** | The default `test` target names an `[EXPERIMENTAL]` builder |

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

← Prev: [04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md) · Index: [Phase 0](../README.md) · Start → [01 · What `ng build` actually runs](01-what-ng-build-actually-runs.md) · Next topic → [06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md)
