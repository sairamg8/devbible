---
title: "Link map · Angular · Part 1 (phases 0–1–2)"
sidebar_label: "01 · model components signals"
sidebar_position: 1
---

# Link map · Angular · Part 1 (phases 0–1–2)

Covers every topic row of `docs/angular/syllabus/01-the-angular-model.md`: phase 0 (T00-01 to T00-12, how Angular runs), phase 1 (T01-01 to T01-16, components and templates) and phase 2 (T02-01 to T02-15, signals). That is 43 rows. Only the first eight phase 0 rows have a page of ours (✅, path is the first chunk file of the topic directory); the other 35 are 🔲 not written.
*read* = the passage that supports the claim was read; *headings only* = fetched, headings and summary checked, passage not read. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation was found, the block has no Beyond line. Verification pass 2026-10-13: every URL re-fetched (all return 200); Beyond lines whose page proved thin, promotional or wrong on a point the block relies on were removed; the web-search budget ran out before the blocks that lack a Beyond line could be re-searched, so those blocks rest on the first researcher's searches only.

🔴 **Version note.** Our syllabus targets **Angular 22.1.4** (`docs/angular/README.md`). angular.dev on 2026-10-13 serves the v22 docs (its API pages are built at v22.2.2, its Update Guide offers v21.0 to v22.0). Three version facts to hold in mind when reading third-party pages: (1) most third-party pages below were written for Angular 16 to 20, and say so; (2) Ninja Squad's "What's new in Angular 22.0" says the optimizer switched back to Rollup by default and Rolldown is experimental behind `NG_BUILD_CHUNKS_ROLLDOWN` in 22.0, so the syllabus claim that Rolldown re-bundles by default since 22.1.0 is **not confirmed by anything fetched** (angular.dev's build-system page does not mention Rolldown at all); (3) `debounced()` and `resourceFromSnapshots` are marked experimental on their angular.dev API pages, while two third-party pages (Ninja Squad, lacolaco) say `resource()` is stable in v22. Pages that predate `@Service`, signal inputs or zoneless are flagged in the block.

---

## Phase 0 — How Angular runs

### T00-01 · Angular is a compiler with a framework attached — Master · ✅ written `docs/angular/pages/phase-0-how-angular-runs/01-compiler-with-a-framework-attached/01-the-template-is-a-separate-language.md`
- **Read this:** [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) · angular.dev · three phases (code analysis, code generation, template type checking), the metadata rules the compiler enforces (*read*) · covers our angle: **partial** — nothing on `@defer` splitting a bundle at a template boundary · fetched 2026-10-13
- **Beyond the docs:** [Ivy engine in Angular: first in-depth look at compilation, runtime and change detection](https://angular.love/ivy-engine-in-angular-first-in-depth-look-at-compilation-runtime-and-change-detection) · Max Koretskyi, angular.love, 14 May 2018 · shows the template compiled into a function with a create block and an update block, so "a template is compiled code" is visible; written against the Ivy preview, so instruction names are not today's · fetched 2026-10-13 (*read*)
- **Our delta:** why a compiler you cannot opt out of forces statically analysable metadata, and the `@defer` consequence.

### T00-02 · Standalone by default — Master · ✅ written `docs/angular/pages/phase-0-how-angular-runs/02-standalone-by-default/01-bootstrapapplication-line-by-line.md`
- **Read this:** [bootstrapApplication](https://angular.dev/api/platform-browser/bootstrapApplication) · angular.dev API · renders a standalone component as the root, takes an optional config for providers, returns a promise of `ApplicationRef` (*read*) · covers our angle: **partial** — API reference, not the "no NgModule anywhere" story · fetched 2026-10-13
- **Also good:** [Anatomy of components](https://angular.dev/guide/components) · angular.dev · a component lists what it uses in `imports`; components are standalone by default and the `standalone` option defaulted to `false` before 19.0.0 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular's Future Without NgModules, Part 1](https://www.angulararchitects.io/aktuelles/angulars-future-without-ngmodules-lightweight-solutions-on-top-of-standalone-components/) · Manfred Steyer, ANGULARarchitects, 1 May 2022 (updated 2022-10-09) · why NgModules existed (the compilation context for which component may use which), and how `bootstrapApplication` replaces the root `AppModule` while `importProvidersFrom` is a bridge for existing NgModules, not a replacement; written for Angular 14, before standalone became the default · fetched 2026-10-13 (*read*)
- **Our delta:** v22 reality: no module bridge needed in a new app, and what `imports` now means.

### T00-03 · The provider array is the application's wiring — Master · ✅ written `docs/angular/pages/phase-0-how-angular-runs/03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md`
- **Read this:** [ApplicationConfig](https://angular.dev/api/core/ApplicationConfig) · angular.dev API · the `providers` property is the "list of providers that should be available to the root component and all its children" (*read*) · covers our angle: **partial** — says nothing of what belongs there versus not · fetched 2026-10-13
- **Beyond the docs:** [Understanding app.config.ts in Angular 19 Standalone Applications](https://dev.to/prateek_kr/understanding-appconfigts-in-angular-19-standalone-applications-a-complete-guide-5coh) · Prateek Kr, DEV Community, 13 Oct 2025 · goes through a real `app.config.ts` provider by provider (router, HTTP with fetch, state store); uses zone change detection, not zoneless, and mixes in third-party providers · fetched 2026-10-13 (*read*)
- **Our delta:** the rule for what belongs in the array, and `provideZonelessChangeDetection` as the v22 choice.

### T00-04 · `ng update` is the upgrade mechanism — Understand · ✅ written `docs/angular/pages/phase-0-how-angular-runs/04-ng-update-not-npm-install/01-why-npm-install-is-not-an-upgrade.md`
- **Read this:** [ng update](https://angular.dev/cli/update) · angular.dev CLI reference · updates framework and CLI and applies migrations; recommends the latest patch of a major; points to the Update Guide (*read*) · covers our angle: **partial** — no account of how schematics rewrite source · fetched 2026-10-13
- **Also good:** [Update Guide](https://angular.dev/update-guide) · angular.dev · pick start and target version and app complexity, get a tailored checklist (*read*) · [Versioning and releases](https://angular.dev/reference/releases) · angular.dev · "If you want to update across multiple major versions, perform each update one major version at a time", with a worked 10 to 11 to 12 example (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Schematics Deep Dive, Part 4: Writing Migration Schematics with ng update](https://angular.love/angular-schematics-deep-dive-part-4-writing-migration-schematics-with-ng-update) · Sakthikumaran Navakumar, angular.love, 21 Apr 2026 · shows how the CLI reads `ng-update` in `package.json`, finds `migrations.json` and runs only the migrations between installed and target versions; written from the library author's side · fetched 2026-10-13 (*read*)
- **Our delta:** why skipping a major is the expensive mistake. Master tier arrives in Phase 15.

### T00-05 · The build: `@angular/build` — Understand · ✅ written `docs/angular/pages/phase-0-how-angular-runs/05-the-build-angular-build/01-what-ng-build-actually-runs.md`
- **Read this:** [Angular application build system](https://angular.dev/tools/cli/build-system-migration) · angular.dev · esbuild and Vite named as the new tools, Vite used "within a development server capacity only", the webpack-based system and `browser` builder stated as deprecated (*read*) · covers our angle: **partial** — no Rolldown at all · fetched 2026-10-13
- **Also good:** [Angular 17 Update: Control Flow and App Builder Migration](https://www.angulararchitects.io/blog/angular-17-update/) · Alexander Thalhammer, ANGULARarchitects, 10 May 2024 · the `use-application-builder` migration and what to replace (the webpack bundle analyzer) (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular, Analog, and Vite](https://angularindepth.com/article/angular-analog-and-vite/) · Robin Goetz, Angular In Depth, 4 Jan 2024 · explains what a bundler is, why esbuild is fast, and why the CLI uses esbuild for `ng build` and Vite only for `ng serve`; predates Rolldown · fetched 2026-10-13 (*read*)
- **Our delta:** the three-tool picture. See the version note: Ninja Squad's 22.0 post says Rolldown was opt-in then; the 22.1.0 default is unverified here.

### T00-06 · `angular.json` anatomy — Understand · ✅ written `docs/angular/pages/phase-0-how-angular-runs/06-angular-json-anatomy/01-the-file-the-cli-reads.md`
- **Read this:** [Angular workspace configuration](https://angular.dev/reference/configs/workspace-config) · angular.dev · sections for general structure, project options, builders and build target; `budgets` is "default size-budget type and thresholds", `fileReplacements` maps files to compile-time replacements (*read*) · covers our angle: **partial** — a reference, not a "which fields you never touch" guide · fetched 2026-10-13
- **Our delta:** which fields you set and which are scaffolding. Searches (three queries' worth of results) returned only pages for Angular 7 to 11.

### T00-07 · The TypeScript setup Angular requires — Understand · ✅ written `docs/angular/pages/phase-0-how-angular-runs/07-the-typescript-setup/01-the-typescript-peer-pin.md`
- **Read this:** [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options) · angular.dev · `extends` inheritance and `strictTemplates` ("when `true`, enables strict template type checking", default `true`) (*read*) · covers our angle: **partial** — shows one `tsconfig.app.json` that extends `./tsconfig.json`, not the three-file split · fetched 2026-10-13
- **Also good:** [Version compatibility](https://angular.dev/reference/versions) · angular.dev · active-support table with Node.js, TypeScript and RxJS ranges; the 22.0.x row reads TypeScript `>=6.0.0 <6.1.0` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [What's new in Angular 22.0?](https://blog.ninja-squad.com/2026/06/03/what-is-new-angular-22.0) · Cédric Exbrayat, Ninja Squad, 3 Jun 2026 · opens with "Angular v22 now requires TypeScript v6", Node 20 dropped, and `strictTemplates` enabled by default (with a migration to keep the old behaviour); this is the 22.0 post, not 22.1 (*read*) · fetched 2026-10-13
- **Our delta:** the `>=6.0 <6.1` range is confirmed for the 22.0.x row of the versions page; the page I fetched has no 22.1.x row, so the 22.1 pin itself is unconfirmed.

### T00-08 · What `ng new` produces in v22 — Understand · ✅ written `docs/angular/pages/phase-0-how-angular-runs/08-what-ng-new-produces/03-the-src-directory.md`
- **Read this:** [Workspace and project file structure](https://angular.dev/reference/configs/file-structure) · angular.dev · `main.ts` is the entry point, `app.config.ts` "defines the application configuration that tells Angular how to assemble the application" (the page also says it is only generated with the `--standalone` option, wording that looks stale for v22), `app.routes.ts` defines routing (*read*) · covers our angle: **partial** — one line per file, no walk through the lines inside them · fetched 2026-10-13
- **Our delta:** what each line is for.

### T00-09 · Partial compilation — Know · 🔲 not written
- **Read this:** [Angular package format](https://angular.dev/tools/libraries/angular-package-format) · angular.dev · libraries must publish in "partial compilation" mode, not tied to one runtime version; the CLI converts it to full compilation in the application build (*read*) · covers our angle: **partial** — no `ɵɵngDeclareComponent` example, no word "linker" · fetched 2026-10-13
- **Beyond the docs:** [The Angular linker (goodbye ngcc!)](https://blog.ninja-squad.com/2021/01/27/angular-linker/) · Cédric Exbrayat, Ninja Squad, 27 Jan 2021 · what `ngcc` did, why it is gone, and how partial output hands off to the linker; shows `ɵɵngDeclareComponent` but does not explain its signature; Angular 11.1 era · fetched 2026-10-13 (*read*)
- **Our delta:** what the linker does at build time, in v22 terms. Part of this is already in our chunk `docs/angular/pages/phase-0-how-angular-runs/01-compiler-with-a-framework-attached/12f-partial-compilation-and-the-linker.md`, written under T00-01.

### T00-10 · JIT vs AOT — Know · 🔲 not written
- **Read this:** [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler) · angular.dev · "Choosing a compiler": JIT compiles in the browser at runtime and was the default until Angular 8, AOT compiles at build time and is the default from Angular 9 (*read*) · covers our angle: **partial** — nothing on `TestBed` or `platform-browser-dynamic` · fetched 2026-10-13
- **Our delta:** where JIT still exists, and the npm deprecation of `platform-browser-dynamic` (not verified here). A third-party AOT-vs-JIT article from Angular In Depth (Sonu Kapoor, 24 Feb 2025) has a comparison table but its code examples still use `ng build --prod` and `--aot` flags, so I left it out.

### T00-11 · Dev-mode-only behaviour — Know · 🔲 not written
- **Read this:** [isDevMode](https://angular.dev/api/core/isDevMode) · angular.dev API · "Returns whether Angular is in development mode"; the page names `enableProdMode` and the CLI's `optimization` option as what switches it off (*read*) · covers our angle: **partial** — no `ngDevMode` or `provideNgReflectAttributes()` · fetched 2026-10-13
- **Our delta:** the checks that vanish in a production build. Search results were old (2019 `ngDevMode` issues) or tooling pages.

### T00-12 · The release train — Understand · 🔲 not written
- **Read this:** [Angular versioning and releases](https://angular.dev/reference/releases) · angular.dev · "A major release every 12 months", 4 to 6 minors per major, "All major releases are typically supported for 24 months", the note that until v22 the cycle was 6 months, deprecations kept at least one major (*read*) · covers our angle: **full** for the cadence; changelog-reading is not covered · fetched 2026-10-13
- **Also good:** [Version compatibility](https://angular.dev/reference/versions) · angular.dev · actively supported versus unsupported tables (*read*) · fetched 2026-10-13
- **Our delta:** how to read a changelog for the breaking changes that matter to you. A third-party restatement (angular.love, 5 Aug 2026) was dropped: it repeats the official page and cites no primary source.

---

## Phase 1 — Components and templates

### T01-01 · `@Component` metadata — Master · 🔲 not written
- **Read this:** [Component decorator](https://angular.dev/api/core/Component) · angular.dev API · lists `selector`, `template`, `styleUrl`, `imports`, `host`, `encapsulation` and `changeDetection` (*read*) · covers our angle: **partial** — an option list, no "what each costs" · fetched 2026-10-13
- **Also good:** [Anatomy of components](https://angular.dev/guide/components) · angular.dev · class, template and selector as the three required parts (*read*) · fetched 2026-10-13
- **Our delta:** what every field costs. Searches returned only version mirrors of the same API page.

### T01-02 · Interpolation and template expression rules — Master · 🔲 not written
- **Read this:** [Expression syntax](https://angular.dev/guide/templates/expression-syntax) · angular.dev · lists unsupported syntax: BigInt literals, all bitwise operators, destructuring, the comma operator, `new`, and declarations (variables, functions, classes) (*read*) · covers our angle: **partial** — lists what is rejected, never says why · fetched 2026-10-13
- **Our delta:** why the compiler forbids each. No third-party page found that explains the reasons for current Angular.

### T01-03 · Property binding vs attribute binding — Master · 🔲 not written
- **Read this:** [Binding dynamic text, properties and attributes](https://angular.dev/guide/templates/binding) · angular.dev · "Native element properties" and "Attributes" with the `attr.` prefix (SVG attributes given as the case for it) (*read*) · covers our angle: **partial** — no side-by-side comparison of the two · fetched 2026-10-13
- **Beyond the docs:** [Attribute vs Property In Angular](https://upmostly.com/angular/attribute-vs-property-in-angular) · Wade, Upmostly, 16 Nov 2021 · an attribute holds the initial value and a property the current one, shown with an input edited from "Jim" to "Jane"; explains the `[colspan]` error and `aria-*` · fetched 2026-10-13 (*read*)
- **Our delta:** the SVG case and the full list of bugs from confusing the two.

### T01-04 · Class and style bindings — Master · 🔲 not written
- **Read this:** [Binding dynamic text, properties and attributes](https://angular.dev/guide/templates/binding) · angular.dev · "CSS classes" and "CSS style properties": `[class.x]`, `[style.x.unit]`, string, array and object forms, and a new instance needed on update because references are compared (*read*) · covers our angle: **partial** — no account of when `NgClass`/`NgStyle` is still right · fetched 2026-10-13
- **Also good:** [Migrations overview](https://angular.dev/reference/migrations) · angular.dev · lists the migrations "NgClass to Class Bindings" and "NgStyle to Style Bindings" (*read*) · fetched 2026-10-13
- **Our delta:** when `NgClass`/`NgStyle` is still the right answer. A DEV Community post on the shift (Nhan Nguyen, 9 Jan 2025) was dropped: short, with performance claims it does not back.

### T01-05 · Event binding — Understand · 🔲 not written
- **Read this:** [Adding event listeners](https://angular.dev/guide/templates/event-listeners) · angular.dev · listening to native events, `$event`, key modifiers (`keyup.shift.enter`, `alt`, `control`, `meta`, `shift`), the `code` suffix, global targets (*read*) · covers our angle: **partial** — what the listener is attached to is not stated · fetched 2026-10-13
- **Our delta:** where the listener actually attaches. The older `/guide/templates/event-binding` URL redirects to this page; a DigitalOcean key-binding tutorial returned no article text, so I left it out.

### T01-06 · Two-way binding — Master · 🔲 not written
- **Read this:** [Two-way binding](https://angular.dev/guide/templates/two-way-binding) · angular.dev · `[()]` "combines the syntax from property binding and event binding", with form controls and between components (*read*) · covers our angle: **partial** — never shows the expanded equivalent · fetched 2026-10-13
- **Also good:** [Two-way Data Binding in Angular](https://blog.thoughtram.io/angular/2016/10/13/two-way-data-binding-in-angular-2.html) · Pascal Precht, thoughtram, 13 Oct 2016 · expands `[(ngModel)]` into `[ngModel]` plus `(ngModelChange)`, then into `[value]` plus `(input)`; Angular 2 era (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Model Inputs: Reactive Two-Way Binding](https://angularindepth.com/article/model-inputs-reactive-two-way-binding/) · Ilir Beqiri, Angular In Depth, 28 Feb 2024 · compares the compiled instructions for an input/output pair (`property`, `listener`) with those for `model()` (`twoWayProperty`, `twoWayListener`), and states the `Change` output naming pattern · fetched 2026-10-13 (*read*)
- **Our delta:** the exact desugaring in v22 terms. The official page never shows the expanded form; the Model Inputs article does state that the output follows the input name plus `Change`.

### T01-07 · Lifecycle hooks in full order — Understand · 🔲 not written
- **Read this:** [Component Lifecycle](https://angular.dev/guide/components/lifecycle) · angular.dev · Summary, Lifecycle interfaces, Execution order (During initialization, Subsequent updates, Ordering with directives) including `afterNextRender` and `afterEveryRender`; the fetch flattened the order diagram, so only the prose rules (`ngOnChanges` before `ngOnInit`, `ngDoCheck` after it) were confirmed (*read*) · covers our angle: **partial** — does not say which hooks signals made unnecessary · fetched 2026-10-13
- **Our delta:** which hooks signals replaced. A DEV Community lifecycle post (Cristian Sifuentes, 27 Oct 2025) was dropped: its initialization order puts `ngAfterContentChecked` after `ngAfterViewInit`, which is wrong.

### T01-08 · `OnPush` as the default posture — Master · 🔲 not written
- **Read this:** [ChangeDetectionStrategy](https://angular.dev/api/core/ChangeDetectionStrategy) · angular.dev API · OnPush is the "CheckOnce" strategy, `Eager` is the check-always one, and `Default` is marked deprecated as equivalent to `Eager`; a note says "OnPush is enabled by default" (page built at v22.2.2) (*read*) · covers our angle: **partial** — no list of what marks a component dirty · fetched 2026-10-13
- **Also good:** [Should You Pair Signals and OnPush?](https://dev.to/playfulprogramming-angular/should-you-pair-signals-onpush-1jko) · Ilir Beqiri, Playful Programming, 21 Sep 2023 · shows the stale-table problem and two fixes (async pipe, signals); the author notes in comments it predates later signal change detection (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Deep dive into the OnPush change detection strategy in Angular](https://angular.love/deep-dive-into-the-onpush-change-detection-strategy-in-angular) · Max Koretskyi, angular.love, 19 Feb 2023 · the dirty triggers: input reference change, bound event (marks ancestors up to the root), `markForCheck()`, async pipe; written for the pre-signal, `@Input` model · fetched 2026-10-13 (*read*)
- **Our delta:** OnPush as the v22 default (the Ninja Squad 22.0 post lists "OnPush by default"), and the signal-driven dirty path.

### T01-09 · Component selectors — Understand · 🔲 not written
- **Read this:** [Component selectors](https://angular.dev/guide/components/selectors) · angular.dev · Types of selectors, Choosing a selector; custom element names for most components, attribute selectors for native elements, `:not()` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** none needed. A Medium article on when an attribute selector is right (table rows) returned 403, so it is unverified and left out.

### T01-10 · Template reference variables and `@let` — Understand · 🔲 not written
- **Read this:** [Variables in templates](https://angular.dev/guide/templates/variables) · angular.dev · `@let` declares one variable, cannot be reassigned, scoped to its view; `#ref` can point to an element, a directive with `exportAs`, or a `TemplateRef` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [exportAs in Angular: What It Does and When to Use It](https://briantree.se/how-why-and-when-to-use-export-as-in-angular/) · Brian Treese, 22 May 2025 · a wizard where `#ref` points at the DOM element until `exportAs` is added (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular @let Template Variables](https://briantree.se/angular-tutorial-local-template-variables-let/) · Brian Treese, 19 Jul 2024 · worked uses: async pipe, repeated conditions, signal type narrowing, plus the read-only and scoping limits; written when `@let` was new · fetched 2026-10-13 (*read*)
- **Our delta:** the "recomputed three times" framing.

### T01-11 · The `host` object, `@HostBinding` and `@HostListener` — Understand · 🔲 not written
- **Read this:** [Component host elements](https://angular.dev/guide/components/host-elements) · angular.dev · "Always prefer using the `host` property over `@HostBinding` and `@HostListener`"; also binding collisions and injecting host attributes (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** none needed. No third-party page found that added to this.

### T01-12 · `ViewEncapsulation` — Understand · 🔲 not written
- **Read this:** [Styling components](https://angular.dev/guide/components/styling) · angular.dev · Emulated (default), ShadowDom, None and an experimental isolated shadow DOM mode; `::ng-deep` "strongly discouraged" and kept for backwards compatibility (*read*) · covers our angle: **partial** — `:host` and `:host-context()` are named under Emulated, but there is no history of the `::ng-deep` deprecation · fetched 2026-10-13
- **Beyond the docs:** [Angular ::ng-deep Alternatives: Modern Styling Approaches](https://briantree.se/angular-ng-deep-alternatives/) · Brian Treese, 20 Dec 2024 · replaces `::ng-deep` with CSS custom properties set on `:host`, with `ViewEncapsulation.None` as the fallback · fetched 2026-10-13 (*read*)
- **Our delta:** the long deprecation history of `::ng-deep`.

### T01-13 · Component styles — Understand · 🔲 not written
- **Read this:** [Styling components](https://angular.dev/guide/components/styling) · angular.dev · defining styles in templates, external style files, namespacing CSS custom properties (*read*) · covers our angle: **partial** — no utility framework · fetched 2026-10-13
- **Also good:** [Install Tailwind CSS with Angular](https://tailwindcss.com/docs/installation/framework-guides/angular) · Tailwind CSS docs · PostCSS plugin plus a single `@import "tailwindcss"` in the global `src/styles.css` (*read*) · fetched 2026-10-13
- **Our delta:** where Tailwind sits against encapsulation. Neither page covers that; community answers (`ViewEncapsulation.None`) are in blog posts I did not verify.

### T01-14 · Content projection — Understand · 🔲 not written
- **Read this:** [Content projection with ng-content](https://angular.dev/guide/components/content-projection) · angular.dev · multiple placeholders, fallback content ("add child content to the `ng-content` element itself"), aliasing, caveats (*read*) · covers our angle: **full** — states that projected content "is still owned by the component that declared it" and that Angular "always instantiates and creates DOM nodes for content rendered to a `ng-content` placeholder" even when hidden · fetched 2026-10-13
- **Beyond the docs:** [One Slot? Two Slots? Conditional Slots? Solved.](https://briantree.se/multiple-component-slots-in-angular/) · Brian Treese, 10 Jul 2025 · named slots with `select`, `contentChild()` to hide empty wrappers, and why projecting the same slot twice fails (only the first matching placeholder renders) and the `ng-template` plus `ngTemplateOutlet` fix · fetched 2026-10-13 (*read*)
- **Our delta:** the parent-creates-the-content rule, shown as a failing example.

### T01-15 · `ng-template`, `ng-container` and `NgTemplateOutlet` — Understand · 🔲 not written
- **Read this:** [Create template fragments with ng-template](https://angular.dev/guide/templates/ng-template) · angular.dev · getting a reference (variable, query, injection), rendering with `NgTemplateOutlet` or `ViewContainerRef`, passing parameters through a context object, providing injectors (*read*) · covers our angle: **full** for context passing · fetched 2026-10-13
- **Also good:** [Grouping elements with ng-container](https://angular.dev/guide/templates/ng-container) · angular.dev · marks a location without rendering an element; dynamic contents, structural directives, injection (*read*) · [NgTemplateOutlet](https://angular.dev/api/common/NgTemplateOutlet) · angular.dev API · inserts an embedded view from a `TemplateRef`, with context and injector (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular ng-template, ng-container and ngTemplateOutlet](https://blog.angular-university.io/angular-ng-template-ng-container-ngtemplateoutlet/) · Angular University, 23 Feb 2026 · covers `ng-template` with `ngIf`, multiple structural directives, template context and references; its examples use `*ngIf` and decorator-based inputs, never `@if` (*read*) · fetched 2026-10-13
- **Our delta:** the v22 control-flow form of the same examples.

### T01-16 · Dynamic components — Know · 🔲 not written
- **Read this:** [Programmatically rendering components](https://angular.dev/guide/components/programmatic-rendering) · angular.dev · `NgComponentOutlet` inputs, `ViewContainerRef.createComponent`, standalone `createComponent`, and `inputBinding` in the `bindings` array (*read*) · covers our angle: **partial** — `inputBinding()` appears in examples tied to a signal, with little explanation of why · fetched 2026-10-13
- **Beyond the docs:** [The Next Generation of Dynamic Component](https://angularindepth.com/article/the-next-generation-of-dynamic-component/) · Nicolas Frizzarin, Angular In Depth, 1 Apr 2025 · `NgComponentOutlet` versus the upgraded `createComponent` with `inputBinding`; written against a preview build before Angular 20, so check the API against the docs (*read*) · fetched 2026-10-13
- **Our delta:** setting inputs with `inputBinding()` against a signal.

---

## Phase 2 — Signals

### T02-01 · `signal()` — Master · 🔲 not written
- **Read this:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · writable signals (`.set()` assigns, `.update()` "compute[s] a new value from the previous one"), computed signals, reactive contexts, a section on reading signals in OnPush components (*read*) · covers our angle: **partial** — `set` versus `update` is covered; the template-read contract is only under the OnPush heading · fetched 2026-10-13
- **Also good:** [signal](https://angular.dev/api/core/signal) · angular.dev API (v22) · "Create a Signal that can be set or updated directly" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular Signals: set() vs update() - When to Use Each](https://briantree.se/signal-set-vs-update/) · Brian Treese, 6 Dec 2024 · `update()` when the new value depends on the old, `set()` when it does not, with two worked cases · fetched 2026-10-13 (*read*)
- **Our delta:** the template-read-subscribes-the-view contract.

### T02-02 · `computed()` — Master · 🔲 not written
- **Read this:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · "computed signals are lazily evaluated and memoized": the derivation "does not run ... until the first time you read" it (*read*) · covers our angle: **full** for laziness; "why that is the point" is not argued · fetched 2026-10-13
- **Beyond the docs:** [Signals in Angular: deep dive for busy developers](https://angularindepth.com/article/signals-in-angular-deep-dive-for-busy-developers/) · Max Koretskyi, Angular In Depth, 6 Aug 2024 · pull-based laziness explained through the reactive graph, with producers recording versions so a consumer recomputes only when one changed · fetched 2026-10-13 (*read*)
- **Our delta:** why never-runs-unless-read is a feature.

### T02-03 · `effect()` — Master · 🔲 not written
- **Read this:** [Effects](https://angular.dev/guide/signals/effect) · angular.dev · use cases, injection context (pass an `Injector` elsewhere), execution, destroying, `onCleanup` (*read*) · covers our angle: **partial** — no comparison with React's `useEffect` · fetched 2026-10-13
- **Beyond the docs:** [Learn When to use Signal Effects in Angular and Why You Should Avoid Overusing them](https://dev.to/amosisaila/learn-when-to-use-signal-effects-in-angular-and-why-you-should-avoid-overusing-them-1mad) · Amos Isaila, DEV Community, 10 Oct 2025 (first published 2024-09-21) · the case against overuse: scheduling, split sources of truth, loops, and the alternatives; covers roots versus view effects · fetched 2026-10-13 (*read*)
- **Our delta:** the explicit "not React's `useEffect`" list.

### T02-04 · `resource()` — Master · 🔲 not written
- **Read this:** [Async reactivity with resources](https://angular.dev/guide/signals/resource) · angular.dev · loaders, `status`, `reload()`, the `AbortSignal` passed to the loader, `stream`, `httpResource` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Managing async data with signals using the Resources API](https://angular.dev/tutorials/signals/4-managing-async-data-with-signals) · angular.dev tutorial · a profile loader tied to a user ID signal (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular: Resource API Family System Diagram](https://dev.to/lacolaco/angular-resource-api-family-system-diagram-3bf0) · Suguru Inatomi (lacolaco), DEV Community, 12 July (year not shown on the page) · maps `Resource`, `WritableResource`, `ResourceSnapshot`, `resource` and `httpResource` as one family and says it is stable in v22 · fetched 2026-10-13 (*read*)
- **Our delta:** the abort signal "for free" framing.

### T02-05 · `toSignal()` and `toObservable()` — Master · 🔲 not written
- **Read this:** [RxJS interop with Angular signals](https://angular.dev/ecosystem/rxjs-interop) · angular.dev · `initialValue`, `requireSync`, subscribes immediately, unsubscribes on destroy, `manualCleanup`; `toObservable` goes through an effect and emits settled values only (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [RxJS to Angular Signals: Patterns, Pitfalls, and Practical Tips](https://certificates.dev/blog/rxjs-to-angular-signals-patterns-pitfalls-and-practical-tips) · Alain Chautard, certificates.dev, 5 May 2026 · the undefined-initial-value trap with `toSignal`; does not cover `toObservable` · fetched 2026-10-13 (*read*)
- **Our delta:** the subscription lifetime you just took on, for both directions.

### T02-06 · Signals vs RxJS — the decision rule — Master · 🔲 not written
- **Read this:** [RxJS interop with Angular signals](https://angular.dev/ecosystem/rxjs-interop) · angular.dev · the bridge between the two (*read*) · covers our angle: **partial** — no stated decision rule · fetched 2026-10-13
- **Our delta:** the genuinely ambiguous cases and the tie-break. The official page states no rule; a DEV Community pros-and-cons post (Samir Tahiri, 16 Jul 2025) was dropped as a thin listicle with unsupported claims.

### T02-07 · Equality functions — Understand · 🔲 not written
- **Read this:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · "By default, signals use referential equality"; a custom equality function works for writable and computed signals (*read*) · covers our angle: **partial** — no array `.push()` explanation · fetched 2026-10-13
- **Our delta:** the `Object.is` default stated plainly, and what a custom `equal` can and cannot fix. A DEV Community post on signals that do not update (Rajat, 22 Oct 2025) was dropped: unsourced statistics, questionable snippets, heavy self-promotion.

### T02-08 · `untracked()` — Understand · 🔲 not written
- **Read this:** [untracked](https://angular.dev/api/core/untracked) · angular.dev API · runs a function without registering its reads as dependencies (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · use it when an effect reacts to one signal but reads another incidentally, or calls external code that might read signals (*read*) · fetched 2026-10-13
- **Beyond the docs:** [An introduction to Angular Signals](https://blog.ninja-squad.com/2023/04/26/angular-signals) · Cédric Exbrayat, Ninja Squad, 26 Apr 2023 · covers `signal`, `computed`, `effect` and `untracked` in one pass, with an example where a computed value ignores one signal; Angular 16 form (*read*) · fetched 2026-10-13
- **Our delta:** the two situations that actually need it.

### T02-09 · `linkedSignal()` — Understand · 🔲 not written
- **Read this:** [Dependent state with linkedSignal](https://angular.dev/guide/signals/linked-signal) · angular.dev · `previous.source` and `previous.value` in the source/computation form, custom equality, customizing `set`; its `ShippingMethodPicker` example keeps the user's choice if that option still exists after the source changes (*read*) · covers our angle: **partial** — the refetch case is the same shape but not named · fetched 2026-10-13
- **Also good:** [linkedSignal](https://angular.dev/api/core/linkedSignal) · angular.dev API · stable since v20; simple and advanced overloads (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular linkedSignal: Missing Link in Signal Reactivity](https://angularindepth.com/article/angular-linkedsignal-missing-link-in-signal-reactivity/) · Angular University, Angular In Depth, 14 Mar 2025 · a quantity field that resets when the selected course changes yet stays editable, and why an effect is the worse way to do it · fetched 2026-10-13 (*read*)
- **Our delta:** the "selected row survives a refetch" case.

### T02-10 · `debounced()` — Understand · 🔲 not written
- **Read this:** [Angular Debounced Signals Guide](https://angular.dev/guide/signals/debounced) · angular.dev · returns a Resource; loading status while the timer runs with the last settled value kept; wait can be a function returning a promise; needs an injection context (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [debounced](https://angular.dev/api/core/debounced) · angular.dev API · marked experimental, added in v22.0 (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Angular's New debounced() Signal Explained](https://briantree.se/angular-debounced-signals-explained/) · Brian Treese, 19 Mar 2026 · refactors a `toObservable` plus `debounceTime` search box to `debounced()` plus `resource()`, side by side · fetched 2026-10-13 (*read*)
- **Our delta:** none needed beyond the experimental status.

### T02-11 · Glitch-free, pull-based evaluation — Understand · 🔲 not written
- **Read this:** [Angular Signals](https://angular.dev/guide/signals) · angular.dev · lazy, memoized computeds; no glitch-free discussion on the page (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Signals in Angular: deep dive for busy developers](https://angularindepth.com/article/signals-in-angular-deep-dive-for-busy-developers/) · Max Koretskyi, Angular In Depth, 6 Aug 2024 · the "Two-Phase Update Model": notification only marks nodes dirty, then each node computes once on pull, so no half-updated pair is seen; covers the diamond problem · fetched 2026-10-13 (*read*)
- **Our delta:** the contrast with naive subscriptions.

### T02-12 · Resource status and reloading — Understand · 🔲 not written
- **Read this:** [Async reactivity with resources](https://angular.dev/guide/signals/resource) · angular.dev · statuses: idle, loading (value undefined), reloading (previous value kept), resolved, error (reading `value()` throws), local; chaining; snapshots (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [resourceFromSnapshots](https://angular.dev/api/core/resourceFromSnapshots) · angular.dev API · experimental; builds a Resource from a snapshot function (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Getting to Know Angular Resource Snapshots](https://angularindepth.com/article/getting-to-know-angular-resource-snapshots/) · Fanis Prodromou, Angular In Depth, 9 Jun 2026 · keeps old data visible while a new request loads or fails, using snapshots, `linkedSignal` and `resourceFromSnapshots` · fetched 2026-10-13 (*read*)
- **Our delta:** request functions that re-run on dependency change, in one place.

### T02-13 · Writing to a signal from an effect — Understand · 🔲 not written
- **Read this:** [Effects](https://angular.dev/guide/signals/effect) · angular.dev · "When not to use effects": warns that propagating state in an effect can cause `ExpressionChangedAfterItHasBeenChecked` errors and infinite circular updates, and recommends `computed` (*read*) · covers our angle: **partial** — no `assertNotInReactiveContext` and no worked loop · fetched 2026-10-13
- **Also good:** [assertNotInReactiveContext](https://angular.dev/api/core/assertNotInReactiveContext) · angular.dev API · "Asserts that the current stack frame is not within a reactive context" (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Learn When to use Signal Effects in Angular and Why You Should Avoid Overusing them](https://dev.to/amosisaila/learn-when-to-use-signal-effects-in-angular-and-why-you-should-avoid-overusing-them-1mad) · Amos Isaila, DEV Community, 10 Oct 2025 · warns that writing to a signal an effect also reads loops forever, recommends `computed` signals instead, and says `allowSignalWrites` was removed (PR 57874) · fetched 2026-10-13 (*read*)
- **Our delta:** the design that removes the need for the write.

### T02-14 · `afterRenderEffect()` — Know · 🔲 not written
- **Read this:** [afterRenderEffect](https://angular.dev/api/core/afterRenderEffect) · angular.dev API · phases earlyRead, write, mixedReadWrite, read; browser-only; choose phases to avoid layout thrash (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [afterRenderEffect, afterNextRender, afterEveryRender & Renderer2](https://angularindepth.com/article/afterrendereffect-afternextrender-aftereveryrender-renderer2/) · Eduard Krivanek, Angular In Depth, 16 Sep 2025 · which of the five APIs to pick, and why `effect` also runs on the server where DOM work does not belong · fetched 2026-10-13 (*read*)
- **Our delta:** measuring an element without fighting change detection.

### T02-15 · Debugging the graph — Know · 🔲 not written
- **Read this:** [Debug the signal graph](https://angular.dev/tools/devtools/signals) · angular.dev · a live graph of signals, computeds, effects, linked signals, templates and resources; `debugName`; the page says it needs Angular 19 or later in development mode (*read*) · covers our angle: **partial** — nothing on finding the `computed` that recomputes on every keystroke · fetched 2026-10-13
- **Also good:** [enableProfiling](https://angular.dev/api/core/enableProfiling) · angular.dev API · stable since v21.0; feeds Angular events to the Chrome DevTools performance panel, development mode only (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Tired of Console Logs? Meet Angular's Signal Graph](https://briantree.se/how-to-install-and-use-the-angular-signal-graph/) · Brian Treese, 21 Aug 2025 · fixes a computed stuck at zero by spotting its missing edge in the graph; says the tool arrived in Angular 20.1 and was experimental, which differs from the official page · fetched 2026-10-13 (*read*)
- **Our delta:** the `enableProfiling()` route to the per-keystroke recompute.
