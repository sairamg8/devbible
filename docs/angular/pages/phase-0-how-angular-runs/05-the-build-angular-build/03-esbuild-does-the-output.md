---
title: "esbuild owns resolution, bundling and emit, and the Angular compiler runs as a plugin inside it — there is no separate `tsc` pass whose output a bundler later reads, which is why you will never find an intermediate directory to inspect"
sidebar_label: "03 · esbuild does the output"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against angular.dev —
> [Angular CLI builds](https://angular.dev/tools/cli/build) and
> [the build system migration guide](https://angular.dev/tools/cli/build-system-migration) (source
> `adev/src/content/tools/cli/build-system-migration.md` at tag `v22.1.5`) — and
> `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and the directory
> [`packages/angular/build/src/tools/esbuild/`](https://github.com/angular/angular-cli/tree/v22.1.7/packages/angular/build/src/tools/esbuild).
> Documentation-validated; **no sandbox run** — no build was executed and no build output is
> reproduced anywhere on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The mental model most people carry over from the webpack era — compile TypeScript, then hand the
JavaScript to a bundler — is wrong for `@angular/build`, and the wrongness has consequences.** The
Angular compilation runs *inside* esbuild, as a plugin, in one process. esbuild owns module
resolution, bundling and emit; the compiler contributes transformed modules as esbuild asks for
them. That is why there is no `tsc` output directory to inspect, why an "esbuild option" and an
"Angular option" are the same kind of thing, and why questions like *"can I run the compiler and
then post-process before bundling?"* have no natural answer here.

## What the build system is, in its own documentation's words

The migration guide states the whole scope in one list, and it is worth quoting entire rather than
summarising:

> *"In v17 and higher, the new build system provides an improved way to build Angular
> applications. This new build system includes:*
> *- A modern output format using ESM, with dynamic import expressions to support lazy module loading.*
> *- Faster build-time performance for both initial builds and incremental rebuilds.*
> *- Newer JavaScript ecosystem tools such as [esbuild](https://esbuild.github.io/) and [Vite](https://vitejs.dev/).*
> *- Integrated SSR and prerendering capabilities.*
> *- Automatic global and component stylesheet hot replacement."*
>
> *"This new build system is stable and fully supported for use with Angular applications."*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

Five bullets, and four of them are about output or tooling. The one that changes how you reason
about your own code is the first — **the output format is ESM, and lazy loading is expressed as
dynamic `import()`** — which is [03b · Eleven concerns, one process](03b-eleven-concerns-one-process.md).

⚠️ Note what the third bullet does *not* say. It names esbuild **and** Vite as tools the build
system uses; it does not say Vite bundles your production output. Vite's role is the development
server — [05 · Vite is only the dev server](05-vite-is-only-the-dev-server.md).

## AOT is on by default, and it runs inside the bundler

`aot` is an ordinary option of the `application` builder, and the schema gives it a default:

> *"Build using Ahead of Time compilation."* — `application/schema.json`, `aot`, `"default": true`

The mechanism behind that boolean is the part worth internalising. **The Angular compilation is an
esbuild plugin.** The evidence is the shape of the source tree at `v22.1.7`:
`packages/angular/build/src/tools/esbuild/` contains an `angular/` directory — the compiler plugin —
alongside `application-code-bundle.ts`, `compiler-plugin-options.ts`, `javascript-transformer.ts`
and `bundler-context.ts`, among roughly twenty-five other esbuild concerns. The compiler is one
citizen of an esbuild-shaped directory, not a step that precedes it.

🔴 **This page will not give you a numbered pipeline diagram, because the sources do not support
one.** What can be said accurately: *the Angular compilation runs as an esbuild plugin; esbuild owns
module resolution, bundling and emit.* Anything more granular — "first the compiler emits, then
esbuild reads" — would be an invention, and it is exactly the invention that makes people go looking
for intermediate files that do not exist.

## The compiler is not optional, and the schema says so

The `application` builder's schema declares exactly one required option:

```json
{ "title": "Application schema for Build Facade.", "required": ["tsConfig"], "additionalProperties": false }
```

🔴 **Not `browser`. Not `outputPath`. `tsConfig`.** You can, in principle, configure a build with no
entry point named in `angular.json`, but not one without a TypeScript configuration — which is the
same statement as the peer list in [02d](02d-the-peer-contract.md), made by a different file. What
belongs *inside* those tsconfig files is **topic 07 · The TypeScript setup** *(not written yet)*;
the field itself, and the consequences of `additionalProperties: false`, are [topic 06 ·
`angular.json` anatomy](../06-angular-json-anatomy/README.md).

## What esbuild does not do here

Three boundaries, so you know which page answers which question:

| Not esbuild's job | Whose it is |
|---|---|
| Re-chunking the bundled output | rolldown, a second pass — [04 · The Rolldown chunk optimizer](04-the-rolldown-chunk-optimizer.md) |
| Serving your app during development | Vite — [05 · Vite is only the dev server](05-vite-is-only-the-dev-server.md) |
| Deciding which JavaScript syntax to emit | your browserslist, translated — [03c](03c-browserslist-becomes-an-esbuild-target.md) |
| Rewriting `index.html` after the bundle is written | critical CSS and font inlining — [03d](03d-critical-css-and-font-inlining.md) |

And one thing that *is* esbuild-adjacent but is really about the builder's other responsibilities —
budgets, licenses, i18n, the CommonJS check — which is
[03b](03b-eleven-concerns-one-process.md).

## Gotchas

**★ Symptom: you go looking for the compiled JavaScript "before bundling" and there is no such
directory.** Cause: there is no separate emit step — the compiler is an esbuild plugin and the only
artefacts written are the build's final output. Fix: stop looking for an intermediate stage and
inspect the real output instead; the builder declares a `statsJson` option for exactly this, and
bundle analysis proper belongs to **Phase 14 · Performance and the build** *(not written yet)*:

```json
{ "statsJson": true }
```

**★ Symptom: you add a custom webpack config — or `@angular-builders/custom-webpack` — and nothing
happens.** Cause: there is no webpack in this pipeline to configure; the builder is
`@angular/build:application`. Fix: the first step is to confirm which builder is actually running,
because a custom-webpack builder replaces the builder string entirely:

```bash
node -p "require('./angular.json').projects['my-app'].targets.build.builder"
```

If that prints a custom builder, you are not on `@angular/build` at all. The sanctioned extension
points on this builder — `define`, `loader`, `conditions`, `externalDependencies` — are
[10 · Features only this builder has](10-features-only-this-builder-has.md).

**★ Symptom: `aot: false` was set "to make development faster" and template behaviour changed.**
Cause: `aot` defaults to `true`, and turning it off changes the compilation mode rather than merely
its speed. Fix: leave it at the default and delete the override — the development configuration the
schematic writes touches optimization and source maps, not compilation mode:

```json
{ "configurations": { "development": { "optimization": false, "sourceMap": true } } }
```

What actually differs between the two compilation modes is **topic 11 · JIT vs AOT**
*(not written yet)*.

**★ Symptom: an option you found in esbuild's own documentation is rejected by `angular.json`.**
Cause: you configure the *builder*, not esbuild — the builder's schema is the accepted surface, and
it declares `additionalProperties: false`, so an unknown key is a hard failure rather than a
harmless extra. Fix: check the builder's own option list first:

```bash
ng build --help
```

**Symptom: a build error points into a `.mjs` or `.js` file inside `node_modules` and you cannot
tell whether it is your code or the compiler's.** Cause: with the compiler inside the bundler, the
failing frame is often a dependency being bundled, not a template being compiled. Fix: turn on
source maps — including vendor ones — for the configuration that is failing:

```json
{ "sourceMap": { "scripts": true, "vendor": true } }
```

**Symptom: someone asks you to "run the Angular compiler and then post-process the output before
bundling", and there is no place to stand.** Cause: correct — there is no such seam; compilation
and bundling are one process. Fix: do the transformation where a seam exists, which is the builder's
own options (`define`, `loader`, `conditions`) or a genuinely separate step after the build writes
its output:

```bash
ng build && node ./tools/post-process-dist.mjs
```

**Symptom: you set `tsConfig` to a file that does not exist and expect a clear message about the
missing file.** Cause: `tsConfig` is the builder's single required option, so the failure is a
configuration failure before the build begins rather than a compilation error. Fix: check the path
resolves from the workspace root, not from the project directory:

```bash
node -p "require('fs').existsSync(require('./angular.json').projects['my-app'].targets.build.options.tsConfig)"
```

**Symptom: a project builds under `ng serve` and a colleague insists "the compiler is not running"
because there is no `ngc` in the scripts.** Cause: `ngc` is not how a v22 build invokes the
compiler — the compiler is a plugin inside the bundler, reached through the builder. Fix: nothing to
add to `package.json`; the compilation is already happening, and the option that governs it is
`aot`, whose schema default is `true`. Print what your project actually sets:

```bash
node -p "require('./angular.json').projects['my-app'].targets.build.options.aot ?? 'unset - schema default true'"
```

## Interview questions

**★ Where does Angular's AOT compilation happen in a v22 build?**
Inside esbuild, as a plugin. `aot` is an option on the `application` builder with a schema default
of `true`, and the compilation itself is implemented as an esbuild plugin — the source tree puts the
compiler directory alongside `application-code-bundle.ts`, `javascript-transformer.ts` and
`bundler-context.ts` in `src/tools/esbuild/`. The practical significance is that there is no
intermediate emit: esbuild owns module resolution, bundling and emit, and the compiler feeds it
transformed modules on demand. Anyone describing it as "tsc runs, then esbuild bundles the result"
has a model that will send them looking for files that do not exist.

**★ Which is in charge, esbuild or the Angular compiler?**
esbuild. It is the bundler; it drives resolution and emit, and it calls into the Angular compiler
through a plugin as it needs modules transformed. That inversion is the whole reason the build got
faster: the compiler no longer produces a complete intermediate program that a second tool then
reads and re-parses. It is also why "an esbuild option" and "an Angular build option" are not
separate categories — everything you can set arrives through the builder's schema, and options from
esbuild's own documentation are not automatically accepted.

**★ Someone hands you a project with a custom webpack configuration and asks you to move it to
Angular 22. What is the first thing you tell them?**
That there is nothing to port the configuration *to* — `@angular/build:application` has no webpack
in it, so a webpack config is not a thing this builder can read. The first diagnostic step is to
print the current builder string, because a project with a custom webpack config is usually running
a third-party builder rather than an Angular one, and that changes the migration entirely. From
there the honest conversation is about which specific things the config did, and whether each maps
onto a declared option (`define`, `loader`, `conditions`, `externalDependencies`), onto a
post-build step, or onto writing a custom builder — which is a much larger commitment than a
webpack plugin was.

**★ What is the one required option of the `application` builder, and why is it the right one?**
`tsConfig` — the schema declares `"required": ["tsConfig"]` and nothing else. Not the entry point,
not the output path. It is the right one because the build is a compilation first: the TypeScript
configuration is what the Angular compiler needs to exist at all, which is the same fact the peer
list states when it makes `typescript` and `@angular/compiler-cli` non-optional while
`@angular/core` is optional. Two independent files in two independent packages making the same
claim is about as strong as documentation-level evidence gets.

**Why does the documentation call the build system "stable and fully supported" and still keep a
migration guide?**
Because the two statements are about different audiences. The stability sentence — *"This new build
system is stable and fully supported for use with Angular applications"* — is aimed at anyone
deciding whether to adopt it, and it has been true since v17. The migration guide exists for
projects that predate it and still name webpack builders, which is a different question: not
*should I trust this*, but *what breaks when I switch*. In v22 the second question got sharper,
because the webpack builders moved from "legacy" to formally deprecated.

---

← Prev: [What `ng new` installs](02e-what-ng-new-installs.md) · Index: [Topic index](README.md) · Next → [Eleven concerns, one process](03b-eleven-concerns-one-process.md)
