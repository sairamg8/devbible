---
name: angular-phase-0-lane-dispatch-2
description: Angular Phase 0 dispatch spec for topics 07-12 — the TypeScript setup, ng new, the release train, partial compilation, JIT vs AOT, dev-mode-only behaviour. The restart procedure and the lane table are in [[angular-phase-0-lane-dispatch]].
metadata:
  type: project
---

> Continued from [[angular-phase-0-lane-dispatch]], which carries the restart procedure, the
> six-lane table and topics 01-06. The shared brief every lane needs is
> [[angular-phase-0-lane-brief]].

# Angular Phase 0 — dispatch spec, topics 07-12

## 07 · The TypeScript setup Angular requires — **Understand** — Lane F

Syllabus row: *"**The TypeScript setup Angular requires** — the hard `>=6.0 <6.1` peer pin,
`strictTemplates`, and the `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` split"*

Cover: **the hard peer pin `typescript: >=6.0 <6.1`** — Angular 22 does not run on TS 5.x and will
not run on 6.1; *why* Angular pins a narrow range when almost nothing else does (the compiler is a
TypeScript transformer built against internal APIs — connect to topic 01), the exact error on a
wrong version, why you cannot upgrade TypeScript ahead of Angular; **the three-file split** —
`tsconfig.json` as shared base, `tsconfig.app.json` adding the app's `files`/`include`,
`tsconfig.spec.json` adding test types, and why it exists (different file sets, different `types`,
so a spec-only import cannot leak into the app build); **`angularCompilerOptions`** in full —
`strictTemplates` and everything it turns on (`strictInputTypes`, `strictNullInputTypes`,
`strictAttributeTypes`, `strictDomLocalRefTypes`, `strictOutputEventTypes`, `strictDomEventTypes`,
`strictContextGenerics`, `strictLiteralTypes`), plus `strictInjectionParameters`,
`strictStandalone`, the interaction with `strictNullChecks`, `typeCheckHostBindings`,
`extendedDiagnostics` with its `checks`/`defaultCategory`; the TS `strict` family Angular turns on
by default (`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `isolatedModules`); `"moduleResolution": "bundler"` and
`"module": "preserve"` in v22; path aliases and where they must be declared for the build *and* the
IDE to agree.

Gotchas symptom → cause → fix: turning on `strictTemplates` in an existing app and drowning — the
staged approach; a template error the IDE does not show but the build does (and the Angular
Language Service); `noPropertyAccessFromIndexSignature` breaking `environment` access; a path alias
that works in the editor and fails in `ng build`; a type imported into a spec that then fails the
app build.

Footers: prev `../06-angular-json-anatomy/README.md` · next `../08-what-ng-new-produces/README.md`

## 08 · What `ng new` produces in v22 — **Understand** — Lane E

Syllabus row: *"**What `ng new` produces in v22** — the file tree, `app.config.ts`, `app.routes.ts`,
`main.ts`, and what each line is for"*

The **orientation topic** — the reader's first real Angular app, explained file by file. Cover: the
`ng new` prompts in v22 and what each choice changes (routing, stylesheet format, SSR/SSG, zoneless,
AI config files); the complete generated tree with every file named and explained — `angular.json`,
`package.json`, `tsconfig*.json`, `public/`, `src/main.ts`, `src/index.html`, `src/styles.css`,
`src/app/app.ts` (note the v20+ naming: `app.ts` / `app.html` / `app.css`, **not**
`app.component.ts` — the `.component` suffix was dropped from generated names), `src/app/app.config.ts`,
`src/app/app.routes.ts`, and the server files when SSR is chosen (`app.config.server.ts`,
`app.routes.server.ts`, `main.server.ts`, `server.ts`); **every line of `main.ts`, `app.config.ts`,
`app.routes.ts` and `app.ts` explained**; what the generated app has that a real app changes on day
one; `ng generate component|service|directive|pipe` and the v22 naming/flags; the schematics
defaults in `angular.json` and changing them once instead of passing flags forever; what `ng new`
deliberately does *not* give you (a state library, a UI kit, an HTTP client provider until you add
it, a linter until `ng add @angular/eslint`).

Gotchas symptom → cause → fix: files still named `*.component.ts` in an older project and whether to
rename; `ng new` inside an existing workspace; the wrong Node version; a global `@angular/cli` older
than the project.

Footers: prev `../07-the-typescript-setup/README.md` · next `../09-the-release-train/README.md`

## 09 · The release train — **Understand** — Lane D

Syllabus row: *"**The release train** — majors every six months (May/June and November), 6 months
active support plus 12 months LTS, and how to read a changelog for the breaking changes that matter
to you"*

Cover: the cadence — a major every six months (May/June and November), minors roughly monthly,
patches weekly; **6 months active + 12 months LTS = 18 months per major**; the concrete current
picture (v22 current since 3 Jun 2026 at 22.1.4; v21 LTS to ~May 2027 at 21.2.22; v20 LTS ending
~Nov 2026 at 20.3.30; v19 out of support since 2 Jun 2026, final patch 19.2.25; **v23 due
~Nov 2026**) — say plainly these are as of August 2026 and where to re-check; what "active" vs
"LTS" entitles you to (features and fixes vs critical fixes and security only); **the deprecation
policy** — an API deprecated in v(N) is removed no earlier than v(N+2), which is exactly why
skipping a major hurts; how to read a changelog for what matters to *you* — the BREAKING CHANGES
section, migration notes, filtering by the packages you use, and the difference between a breaking
change with an automated migration and one without; Node, TypeScript and RxJS support moving with
the train; **planning upgrades on a cadence rather than reactively** — the 6-month rhythm means an
app upgraded once a year is always one major behind and one upgraded every 18 months is out of
support; how to decide when to adopt a major (day one vs the .1 release).

Footers: prev `../08-what-ng-new-produces/README.md` · next `../10-partial-compilation/README.md`

## 10 · Partial compilation — **Know** — Lane C

Syllabus row: *"Partial compilation — why published libraries contain `ɵɵngDeclareComponent` calls
rather than finished instructions, and what the linker does at build time"*

Cover: the problem it solves — a library compiled to finished Ivy instructions is locked to one
Angular version's private instruction set, so npm would need one build per Angular major; the
**partial** output instead (`ɵɵngDeclareComponent`, `ɵɵngDeclareDirective`, `ɵɵngDeclareInjectable`,
`ɵɵngDeclareFactory`) as a stable, declarative, version-independent description; **the linker**
(`@angular/compiler-cli/linker`, the babel plugin `@angular/compiler-cli/linker/babel`) turning
declarations into instructions at *application* build time using the application's Angular version;
`compilationMode: "partial"` in a library's `tsconfig.lib.prod.json` and why `ng-packagr` sets it;
the **Angular Package Format** and where partial output sits in it; what this means when you debug
into `node_modules`; why a library must not be published in full compilation mode and the symptom
when someone does (version-mismatch errors, `NG0203`-family confusion); the practical monorepo
consequence — a locally-built library is usually full-compiled and a published one is not, so
behaviour can differ between `ng build my-lib` and the npm tarball.

Footers: prev `../09-the-release-train/README.md` · next `../11-jit-vs-aot/README.md`

## 11 · JIT vs AOT — **Know** — Lane B

Syllabus row: *"JIT vs AOT — where JIT still exists (`TestBed`, `platform-browser-dynamic`), and why
it is not a deployment option"*

Cover: what each means (compile templates in the browser at runtime vs at build time); **AOT is the
only supported deployment mode** and has been the default since v9 — `aot: false` is not a
production choice; what shipping JIT would cost (the compiler in your bundle, a runtime compile
step, no template type checking, a CSP problem because JIT needs `eval`-like behaviour); **where JIT
genuinely still lives** — `TestBed` compiling components declared in a spec,
`@angular/platform-browser-dynamic` (still published at 22.1.4), dynamic template scenarios; why
`TestBed` being JIT explains some test-only behaviour differences; and the honest note that this is
now largely a historical interview question — say so, and give the answer the interviewer wants
anyway. Include the CSP angle, the one place this still bites in production.

Footers: prev `../10-partial-compilation/README.md` · next `../12-dev-mode-only-behaviour/README.md`

## 12 · Dev-mode-only behaviour — **Know** — Lane A

Syllabus row: *"Dev-mode-only behaviour — `isDevMode()`, `ngDevMode` assertions,
`provideNgReflectAttributes()`, and the checks that vanish in a production build"*

Cover: `isDevMode()` and what determines it; the `ngDevMode` global and how it is tree-shaken out of
a production build (the `ngDevMode && assertSomething()` pattern); **`provideNgReflectAttributes()`**
— the v22 provider restoring the `ng-reflect-*` DOM attributes that used to appear automatically in
dev builds, why they were removed by default, and why you should never assert on them in tests;
`provideBrowserGlobalErrorListeners` (new in the v22 surface) and where it belongs; the dev-only
checks that vanish — expression-changed-after-checked, the assertions in signals and change
detection; Angular DevTools and what it needs from a build; and the honest consequence: **a bug that
only reproduces in production is often a dev-only check that was hiding it**. Give
`ExpressionChangedAfterItHasBeenCheckedError` proper symptom → cause → fix treatment — it is the
canonical dev-only error and a frequent interview question.

Footers: prev `../11-jit-vs-aot/README.md` · **no Next** — last topic of the phase:
`← Prev: [JIT vs AOT](../11-jit-vs-aot/README.md) · Index: [Phase 0 — How Angular runs](../README.md)`
