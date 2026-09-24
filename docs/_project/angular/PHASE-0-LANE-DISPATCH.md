---
name: angular-phase-0-lane-dispatch
description: How to restart an Angular Phase 0 lane, the six-lane split, and the dispatch spec for topics 01-06. Topics 07-12 are in [[angular-phase-0-lane-dispatch-2]]. Paste a lane's section under [[angular-phase-0-lane-brief]]. Nothing was written before the lanes were killed.
metadata:
  type: project
---

> 🔴 **Written 2026-08-31** when the six lanes were killed at the 80% usage line. All six were
> still fetching from angular.dev; **zero files were written**. Restarting is a clean re-dispatch,
> not a salvage.

# How to restart a lane

One `devbible-author` agent per lane. Its prompt is: *"You are Lane X of six parallel lanes
writing Angular Phase 0. FIRST read `/mnt/Storage/my-learning/claude/devbible/angular/PHASE-0-LANE-BRIEF.md`
in full and follow it exactly — it overrides the repo path in your agent definition"* — then that
lane's two topic sections, verbatim, from below.

Balanced by tier, not by count: three Master topics and three Know topics, so no lane carries two
heavy ones. Lanes touch **only** their own topic directories. The coordinator owns
`pages/README.md`, `phase-0-how-angular-runs/README.md`, all twelve `_category_.json` (already
written), `src/data/progress.js` and `sidebars.js`.

| Lane | Topics | Tiers |
|---|---|---|
| A | `01-compiler-with-a-framework-attached` + `12-dev-mode-only-behaviour` | Master + Know |
| B | `02-standalone-by-default` + `11-jit-vs-aot` | Master + Know |
| C | `03-the-provider-array` + `10-partial-compilation` | Master + Know |
| D | `04-ng-update-not-npm-install` + `09-the-release-train` | Understand ×2 |
| E | `05-the-angular-build` + `08-what-ng-new-produces` | Understand ×2 |
| F | `06-angular-json-anatomy` + `07-the-typescript-setup` | Understand ×2 |

Each lane writes its heavy topic **first**. Footer chain, one line per file:
`← Prev: [x](../NN-x/README.md) · Index: [Phase 0 — How Angular runs](../README.md) · Next → [y](../NN-y/README.md)`
Topic 01's prev is the phase index `../README.md`; topic 12 has **no Next** (phase 1 unwritten).

---

## 01 · A compiler with a framework attached — **Master** — Lane A

Syllabus row: *"**Angular is a compiler with a framework attached** — templates are a separate
language, compiled ahead of time into instruction calls; this is why metadata must be statically
analysable and why `@defer` can split a bundle where no bundler could"*

The anchor topic of the whole Angular track and the most important page in Phase 0. Almost every
"why does Angular need this?" in later phases resolves back to it — deepest treatment in the phase.
Each bullet its own concept boundary:

- The template is a **separate language**, not JSX and not JavaScript — parsed by Angular's own
  parser into an AST; that is why its expression rules (no assignment, no `new`, no bitwise, no
  chained statements) exist at all.
- What the compiler emits: a static `ɵcmp` definition, a **template function** of instruction calls
  (`ɵɵelementStart`, `ɵɵtext`, `ɵɵadvance`, `ɵɵproperty`, `ɵɵtemplate`), the create pass vs the
  update pass, and why instructions rather than a virtual DOM. Say explicitly it is the *shape* of
  generated code, not a byte-exact dump.
- **Static analysability** as the load-bearing constraint: metadata resolvable at build time — why
  you cannot compute a `selector`, why `imports` must be a literal array of identifiers, why a
  decorator argument cannot be built by a function call, and the exact error when you try.
- **Why `@defer` can split a bundle where no bundler could** — the compiler knows the template's
  dependency graph and can rewrite a `@defer` block's dependencies into a dynamic import boundary;
  a bundler seeing only a top-of-file `import` cannot. Show source and describe the transform.
- Ivy: the compilation model, **locality** (a component compiles knowing only its own metadata plus
  its imports), and why locality is what makes partial compilation and incremental builds possible.
- Where the compiler runs — `@angular/compiler-cli`, the `ngtsc` TypeScript program, why it is a TS
  *transformer* not a separate pass, and how that connects to the hard TypeScript peer pin.
- Template type checking as a compiler feature: `strictTemplates`, what it checks, and the class of
  bugs it moves from runtime to build time.
- Comparison for readers arriving from React/Vue/Svelte — Svelte also compiles, React does not;
  what that buys and costs.
- Consequences readers actually hit: a template error pointing at a `.html` line number, the
  "cannot determine the module for class" error, an expression that works in TS and fails in a
  template.

Footers: prev `../README.md` · next `../02-standalone-by-default/README.md`

## 02 · Standalone by default — **Master** — Lane B

Syllabus row: *"**Standalone by default** — `bootstrapApplication(App, appConfig)`, no `NgModule`
anywhere in a v22 app; what `imports` on a component now means"*

- `bootstrapApplication(App, appConfig)` in `main.ts`, line by line, against
  `platformBrowserDynamic().bootstrapModule(AppModule)` which it replaced.
- **`standalone` is the default and the flag is gone** — in v22 a component is standalone unless it
  says otherwise; `standalone: true` is redundant, `standalone: false` is legacy-interop opt-out.
  Be precise about which version changed what (v14 introduced, v19 flipped the default, v20+ removed
  the boilerplate) — readers arrive from all of them.
- **What `imports` actually means**: the component's own template dependency list — components,
  directives, pipes it may reference. Per-component, statically analysed, unused entries a compile
  error you should want. Contrast `NgModule.declarations`/`exports` and the transitive visibility
  that used to hide missing imports.
- The real error — `'x' is not a known element` / `Can't bind to 'y' since it isn't a known
  property` — symptom → cause → fix, including the case where `CommonModule` was never needed
  because control flow is built in now.
- What replaced each `NgModule` responsibility, as a table: `declarations` → component `imports`;
  `providers` → `ApplicationConfig.providers` or component `providers`; `exports` → nothing;
  `bootstrap` → `bootstrapApplication`.
- **Interop, honestly** — `importProvidersFrom()` for a library still shipping an `NgModule`, what
  it costs, why it is a bridge not a destination; lazy-loading a legacy module with `loadChildren`.
- Migration: `ng generate @angular/core:standalone`, the three-step run order, what it cannot do.
- Why standalone matters beyond ergonomics — it makes a component's dependency graph local and
  therefore statically splittable, the same property topic 01 explains and what `@defer` depends on.
- Where an `NgModule` legitimately still appears in 2026: some third-party libraries, `TestBed`.

Footers: prev `../01-compiler-with-a-framework-attached/README.md` · next `../03-the-provider-array/README.md`

## 03 · The provider array is the wiring — **Master** — Lane C

Syllabus row: *"**The provider array is the application's wiring** — `ApplicationConfig.providers`,
what belongs there (`provideRouter`, `provideHttpClient`, `provideZonelessChangeDetection`) and
what does not"*

⚠️ Scope: this is **the application's wiring — the config object and the `provide*` convention**.
The DI *mechanism* (injectors, tokens, resolution, hierarchies, `inject()`) is **Phase 6** and must
not be re-taught; forward-reference it.

- `app.config.ts` and the `ApplicationConfig` type; how `bootstrapApplication` consumes it; what a
  "root provider" means without an `AppModule`.
- **The `provide*` function convention** — why Angular replaced `NgModule.forRoot()` with
  tree-shakable provider functions; what `EnvironmentProviders` is vs a plain `Provider[]`, and why
  that type distinction stops you putting `provideRouter()` on a component.
- The catalogue with what each does and its important features: `provideRouter()` (+
  `withComponentInputBinding`, `withViewTransitions`, `withInMemoryScrolling`, `withPreloading`,
  `withRouterConfig`, `withHashLocation`), `provideHttpClient()` (+ `withInterceptors`, `withFetch`,
  `withXsrfConfiguration`, `withInterceptorsFromDi`), **`provideZonelessChangeDetection()` — stable
  in v22**, `provideBrowserGlobalErrorListeners()`, `provideAnimationsAsync()`,
  `provideClientHydration()` (+ `withEventReplay`, `withIncrementalHydration`),
  `provideAppInitializer()`.
- **What does NOT belong** — component-scoped services, anything needing per-route or per-component
  lifetime, feature config that should ride a route's `providers`, `useValue` blobs that should be a
  typed `InjectionToken`. Give the "everything ends up in app.config.ts" anti-pattern its own
  symptom → cause → fix.
- **Order dependence** — where it matters and where it does not; last-wins for the same token;
  interceptor order inside `withInterceptors` being execution order.
- `providedIn: 'root'` vs listing in the array — when you need the array at all.
- Route-level `providers` and lazy feature config as the correct alternative for feature scope;
  forward-reference Phases 6 and 8.
- The `main.ts` error surface: what `NullInjectorError: No provider for HttpClient!` means and its
  three different causes.
- SSR: `app.config.server.ts`, `mergeApplicationConfig`, why the server config is a merge.

Footers: prev `../02-standalone-by-default/README.md` · next `../04-ng-update-not-npm-install/README.md`

## 04 · `ng update`, not `npm install` — **Understand** — Lane D

Syllabus row: *"**`ng update` is the upgrade mechanism, not `npm install`** — schematics rewrite
your source; skipping a major and jumping two is the single most expensive Angular mistake (Master
in Phase 15, where the mechanics live)"*

⚠️ Scope: **full migration mechanics are Phase 15 at Master.** This topic installs the *mental
model* — an Angular upgrade is a **code migration**, not a dependency bump — and makes the reader
unable to run `npm install @angular/core@latest` by accident.

Cover: what `ng update` does that `npm install` cannot — it runs **migration schematics** shipped
inside the new version that rewrite your source (renamed symbols, changed signatures, new control
flow, removed APIs); reading its output; **one major at a time** — `ng update @angular/core@21
@angular/cli@21` then `@22`, and why jumping v20 → v22 loses the v21 migrations forever, which is
the expensive mistake in the row; core and CLI updated together; third-party packages with their
own migrations (`@angular/material`, `@ngrx/*`) in the same step; `--force`, `--allow-dirty`,
`--migrate-only`, `--from`/`--to` and when each is legitimate; committing first and why a dirty
tree is refused; update.angular.dev and what it is for; an out-of-support version (v19 since
2 Jun 2026 — migrations still exist, nobody will fix them); Node and TypeScript upgraded *by* the
Angular upgrade rather than before it, with the hard TS `>=6.0 <6.1` pin as the thing that breaks
first.

Gotchas needing symptom → cause → fix: a peer-dependency conflict blocking the update; a migration
silently skipping files it cannot parse; a monorepo where one app is behind; `npm install` already
run and the lockfile now ahead of the source.

Footers: prev `../03-the-provider-array/README.md` · next `../05-the-angular-build/README.md`

## 05 · The build: `@angular/build` — **Understand** — Lane E

Syllabus row: *"**The build: `@angular/build`** — esbuild for output, Vite for the dev server; the
Webpack builders are legacy and only kept for old configurations"*

⚠️ Scope: **Phase 14 owns performance, budgets and bundle analysis.** This topic owns what the
build system *is* and how it is put together. Name the Phase 14 topics rather than teaching them.

- The package landscape: **`@angular/build`** (22.1.6) current, `@angular-devkit/build-angular` the
  legacy Webpack one, still published and working. The builder strings for each
  (`@angular/build:application`, `:dev-server`, `:unit-test` vs
  `@angular-devkit/build-angular:browser`) and how to tell which one a project is on.
- **The two-engine story**: esbuild produces the output, **Vite serves the dev server** — precisely,
  a dev-time server with HMR, not the production bundler. Why two tools.
- The **`application` builder** as the single modern builder replacing `browser` + `server` +
  `prerender`; the `outputPath` object form; `browser`, `server`, `ssr`, `prerender`, `outputMode`.
- What the build does end to end: TypeScript via `ngtsc` → Angular instructions → esbuild bundling →
  optimization, minification, and the **build-time linker step for partial-compiled libraries**
  (forward-reference topic 10).
- **HMR** in v22 — template and style hot replacement, what is preserved, the flags.
- Watch mode and incremental rebuilds; why the first build is slow and later ones are not.
- `ng build` vs `ng serve` vs `ng build --watch` — three things people conflate; where `ng serve`
  legitimately differs from a real build, the source of "works in dev, breaks in prod".
- Migrating off the Webpack builders: what `ng update` handles, what it cannot (a custom Webpack
  config, `@angular-builders/custom-webpack`, `ngx-build-plus`), and the honest answer for a project
  that still needs one.
- Where output goes (`dist/<project>/browser`, `/server`), what each file is, what you deploy.
- Gotchas symptom → cause → fix: a CommonJS dependency warning; a library that only works under
  Webpack; `allowedHosts`/proxy config; a polyfill implicit under Webpack and not now; source maps
  missing in production by default.

Footers: prev `../04-ng-update-not-npm-install/README.md` · next `../06-angular-json-anatomy/README.md`

## 06 · `angular.json` anatomy — **Understand** — Lane F

Syllabus row: *"**`angular.json` anatomy** — projects, targets, builders, `configurations`,
`fileReplacements`, `budgets`; which fields you set and which are scaffolding you never touch again"*

⚠️ Scope: **the build system is topic 05**; **budgets as a performance practice are Phase 14.**
This topic owns the *config file* — its structure, every field that matters, changing it safely.

- Top-level shape: `$schema`, `version`, `newProjectRoot`, `projects`, `cli`, `schematics` — and
  that the schema is real and your editor will complete it.
- **Projects → targets → builders → options → configurations** as a hierarchy: a workspace has
  projects; a project has targets (`build`, `serve`, `test`, `extract-i18n`, `lint`); each names a
  **builder** with `options`; `configurations` are named option overlays merged over the base.
- Every `@angular/build:application` option worth knowing, grouped: entry/output (`browser`,
  `outputPath` object form, `index`, `tsConfig`, `assets`, `styles`, `scripts`, `polyfills`) and
  behaviour (`server`, `ssr`, `prerender`, `outputMode`, `sourceMap`, `optimization` and its object
  form, `extractLicenses`, `namedChunks`, `define`, `loader`, `externalDependencies`,
  `stylePreprocessorOptions`).
- **`configurations` and `defaultConfiguration`** — how `production`/`development` compose, how a
  configuration merges and where it *replaces* rather than merges (the array trap), adding a third
  environment properly.
- **`fileReplacements`** — the mechanism, `environment.ts` → `environment.prod.ts`, and the honest
  modern take: it works, but `define`, a runtime-fetched config, or an injected `InjectionToken` are
  usually better for anything not a build-time constant. Show at least one alternative properly.
- **`budgets`** — entry shape (`type`, `name`, `maximumWarning`, `maximumError`, `baseline`), the
  types (`initial`, `allScript`, `anyComponentStyle`, `any`, `bundle`), the v22 defaults, what a
  failing budget means in CI. Then hand performance to Phase 14.
- `assets` in v22 — the `public/` convention, glob objects (`glob`, `input`, `output`), copying from
  `node_modules`.
- `serve` and `test` targets; `proxyConfig`, because every real app needs it on day one.
- **What you never touch**: `$schema`, `version`, `newProjectRoot`, `projectType`, `sourceRoot`,
  `prefix` after creation.
- Multi-project workspaces, libraries, where `angular.json` gets genuinely complicated.
- Gotchas symptom → cause → fix: editing it and forgetting the dev server needs a restart; an array
  option in a configuration replacing rather than appending; a budget failing only in CI; an asset
  404 in production but not dev; `defaultConfiguration` making `ng build` production unnoticed.

Footers: prev `../05-the-angular-build/README.md` · next `../07-the-typescript-setup/README.md`

---

Topics **07-12** continue in [[angular-phase-0-lane-dispatch-2]].
