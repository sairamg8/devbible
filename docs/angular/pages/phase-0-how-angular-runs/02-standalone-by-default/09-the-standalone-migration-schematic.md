---
title: "`ng generate @angular/core:standalone` is not one migration but three, and the order they run in is forced by the removal criteria rather than by convention"
sidebar_label: "09 · The standalone migration schematic"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Migrate to standalone](https://angular.dev/reference/migrations/standalone),
> [`ng generate`](https://angular.dev/cli/generate) — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/collection.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/collection.json),
> [`packages/core/schematics/ng-generate/standalone-migration/README.md`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/README.md),
> [`.../standalone-migration/schema.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/schema.json),
> [`packages/platform-browser/animations/src/module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/animations/src/module.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One command, `ng generate @angular/core:standalone`, carries three separate migrations behind a
`mode` option, and Angular says flatly that they "have to be run multiple times" in a listed order.
That order is not a style preference or a safety ritual — it is a data dependency. Mode 1 moves every
declared class out of `declarations` and into the module's `imports`; mode 2 will only delete a module
whose first qualifying condition is "Has no `declarations`". So mode 2 run first finds nothing to
delete and reports success. Mode 1 deliberately skips any module with a `bootstrap` array, because
converting a root module's declarations without also replacing `bootstrapModule` would strand them —
mode 3 picks exactly those up. Each mode is the precondition for the next, and the schematic will not
tell you that you ran them backwards. It will just do less than you thought.**

## The command is one schematic wearing two names

`packages/core/schematics/collection.json` at `v22.1.5`, verbatim:

```json
"standalone-migration": {
  "description": "Converts the entire application or a part of it to standalone",
  "factory": "./bundles/standalone-migration.cjs#migrate",
  "schema": "./ng-generate/standalone-migration/schema.json",
  "aliases": ["standalone"]
}
```

`ng generate @angular/core:standalone` and `ng generate @angular/core:standalone-migration` are the
**same schematic** — the second is the real name, the first is the alias almost everyone types.

Its own `schema.json` declares exactly two options, and it is the enum here — not the prose labels in
the prompt — that you pass on the command line:

```json
{
  "properties": {
    "mode": {
      "description": "Operation that should be performed by the migrator",
      "type": "string",
      "enum": ["convert-to-standalone", "prune-ng-modules", "standalone-bootstrap"],
      "default": "convert-to-standalone",
      "x-prompt": {
        "message": "Choose the type of migration:",
        "type": "list",
        "items": [
          {"value": "convert-to-standalone", "label": "Convert all components, directives and pipes to standalone"},
          {"value": "prune-ng-modules", "label": "Remove unnecessary NgModule classes"},
          {"value": "standalone-bootstrap", "label": "Bootstrap the application using standalone APIs"}
        ]
      }
    },
    "path": {
      "type": "string",
      "description": "Path relative to the project root which should be migrated",
      "x-prompt": "Which path in your project should be migrated?",
      "default": "./"
    }
  }
}
```

🔴 **`"default": "convert-to-standalone"` is the trap in CI.** `mode` has an `x-prompt`, so an
interactive terminal asks. A non-interactive one — a CI job, a shell with `--defaults`, an agent —
takes the default and silently runs **only step 1**. The documented `ng generate` global options are
`--defaults` (*"Disable interactive input prompts for options with a default."*), `--dry-run` / `-d`
(*"Run through and reports activity without writing out results."*), `--force` and `--interactive`
(angular.dev, [`ng generate`](https://angular.dev/cli/generate)). Always pass `--mode` explicitly.

## 🔴 The order, in Angular's own words — and the mechanism underneath it

The schematic's `README.md`, verbatim:

> *"The standalone migration involves multiple distinct operations, and as such has to be run multiple
> times. Authors should verify that the app still works between each of the steps. If the application
> is large, it can be easier to use the `path` option to migrate specific sub-sections of the app
> individually."*

> *"The migration is made up the following modes that are intended to be run in the order they are
> listed in: 1. Convert declarations to standalone. 2. Remove unnecessary NgModules. 3. Switch to
> standalone bootstrapping API."*

angular.dev states the same rule more tersely:

> *"Run the migration in the order listed below, verifying that your code builds and runs between each
> step"*

**Why the order is load-bearing, in two sentences.** Mode 2's list of removal criteria opens with
*"Has no `declarations`"* — and the only thing that empties a module's `declarations` is mode 1, which
moves those classes into the module's `imports` array. Mode 1, in turn, explicitly refuses to touch
any module that has a `bootstrap` array, leaving those declarations non-standalone until mode 3 rewrites
the bootstrap and converts them in the same pass. Run them out of order and nothing errors; you simply
get a migration that did a third of its job.

The ten-step flow the README prints, verbatim:

> *"1. `ng generate @angular/core:standalone`. 2. Select the "Convert all components, directives and
> pipes to standalone" option. 3. Verify that the app works and commit the changes. 4. `ng generate
> @angular/core:standalone`. 5. Select the "Remove unnecessary NgModule classes" option. 6. Verify that
> the app works and commit the changes. 7. `ng generate @angular/core:standalone`. 8. Select the
> "Bootstrap the application using standalone APIs" option. 9. Verify that the app works and commit the
> changes. 10. Run your linting and formatting checks, and fix any failures. Commit the result."*

The non-interactive equivalent, as shell source:

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
# build, run the app, run the tests, then: git add -A && git commit -m "migration step 1"

ng generate @angular/core:standalone --mode=prune-ng-modules
# build, run the app, run the tests, then: git add -A && git commit -m "migration step 2"

ng generate @angular/core:standalone --mode=standalone-bootstrap
# build, run the app, run the tests, then: git add -A && git commit -m "migration step 3"

# only now: formatting and lint, as a SEPARATE commit
npx prettier --write "src/**/*.ts"
ng lint --fix
```

⚠️ **Keep formatting out of the migration commits.** The README is blunt about why:

> *"The schematic often needs to generate new code or copy existing code to different places. This means
> that likely the formatting won't match your app anymore and there may be some lint failures. The
> application should compile, but it's expected that the author will fix up any formatting and linting
> failures."*

A `prettier --write` folded into the same commit as mode 3 turns a reviewable 40-line diff into a
2,000-line one, and the one line that mattered is now unfindable.

## Before you run it

The prerequisites, verbatim from angular.dev:

> *"Before using the schematic, please ensure that the project: 1. Is using Angular 15.2.0 or later.
> 2. Builds without any compilation errors. 3. Is on a clean Git branch and all work is saved."*

Those three are not politeness. **A project that does not compile cannot be migrated at all** — the
schematic reads your code through the compiler, and a broken program produces a broken analysis. And a
dirty branch destroys the only review mechanism you have: after the run, `git diff` is the entire audit
trail, and it is worthless if half of it was already yours.

```bash
# 1. clean tree, dedicated branch
git status --porcelain          # must print nothing
git switch -c standalone-migration

# 2. it must build BEFORE, or the analysis is garbage in
ng build

# 3. and the tests must be green before, so a later failure is attributable
ng test --watch=false
```

`--dry-run` is a documented `ng generate` option and is worth one look for a first impression, but it
is not the safety net: the flow requires you to *"verify that the app works"* between steps, which means
actually applying each one. Git is the safety net. ⚠️ Whether `--dry-run` faithfully reports every edit
one of these compiler-driven migration schematics makes was not exercised here — treat the branch, not
the flag, as the thing that lets you back out.

## Mode 1 — `convert-to-standalone`

angular.dev, verbatim:

> *"In this mode, the migration converts all components, directives and pipes to standalone by removing
> `standalone: false` and adding dependencies to their `imports` array."*

🔴 And the exception that makes mode 3 necessary, verbatim from the README:

> *"**Note:** NgModules which bootstrap a component are explicitly ignored in this step, because they
> are likely to be root modules and they would have to be bootstrapped using `bootstrapApplication`
> instead of `bootstrapModule`. Their declarations will be converted automatically as a part of the
> "Switch to standalone bootstrapping API" step."*

The README's own before/after — note that the **module survives**, with its declared classes moved from
`declarations` into `imports`:

```typescript
// BEFORE — app.module.ts
@NgModule({
  imports: [CommonModule],
  declarations: [MyComp, MyDir, MyPipe],
})
export class AppModule {}
```

```typescript
// BEFORE — my-comp.ts
@Component({
  selector: 'my-comp',
  template: '<div my-dir *ngIf="showGreeting">{{ "Hello" | myPipe }}</div>',
  standalone: false,
})
export class MyComp {
  public showGreeting = true;
}
```

```typescript
// AFTER — app.module.ts
@NgModule({
  imports: [CommonModule, MyComp, MyDir, MyPipe],
})
export class AppModule {}
```

```typescript
// AFTER — my-comp.ts
@Component({
  selector: 'my-comp',
  template: '<div my-dir *ngIf="showGreeting">{{ "Hello" | myPipe }}</div>',
  imports: [NgIf, MyDir, MyPipe],
})
export class MyComp {
  public showGreeting = true;
}
```

Four things to read out of that AFTER block, because each one is a decision the schematic made for you:

1. **`imports: [NgIf, …]`, not `imports: [CommonModule]`.** The migration resolves the *individual*
   directive the template actually used. That is the modern, NG8113-visible form — a `CommonModule`
   entry is invisible to the unused-imports diagnostic, an `NgIf` entry is not.
2. **`*ngIf` is still in the template.** This migration makes you standalone; it does not make you
   modern. `NgIf` is deprecated as of 20.0 (*"Use the `@if` block instead. Intent to remove in a future
   major release"*), so you land on standalone code holding a deprecated directive.
3. **`standalone: false` was deleted, not replaced with `standalone: true`.** In v22 the absence of the
   flag *is* standalone.
4. **The module is still there.** Mode 1 never deletes a module. That is mode 2's job, and it is only
   possible because mode 1 emptied `declarations`.

## Mode 2 — `prune-ng-modules`

The removal criteria, verbatim and identical in both sources — read them as a checklist for *why your
module survived*:

> *"A module is considered "safe to remove" if it: Has no `declarations`. Has no `providers`. Has no
> `bootstrap` components. Has no `imports` that reference a `ModuleWithProviders` symbol or a module
> that can't be removed. Has no class members. Empty constructors are ignored."*

So, concretely: a module with a single `{provide: FOO, useValue: 123}` **survives**. A module with one
method on the class **survives**. A module importing `RouterModule.forRoot(routes)` survives, because
`forRoot` returns a `ModuleWithProviders`. And removability is transitive in the negative direction — a
module that imports an unremovable module is itself unremovable.

When it cannot delete a reference, it leaves a marker instead of guessing. The README's example:

```typescript
// BEFORE — configurer.module.ts
import {ImporterModule} from './importer.module';

console.log(ImporterModule);

@NgModule({
  imports: [ImporterModule],
  exports: [ImporterModule],
  providers: [{provide: FOO, useValue: 123}],
})
export class ConfigurerModule {}
```

```typescript
// AFTER — configurer.module.ts
console.log(
  /* TODO(standalone-migration): clean up removed NgModule reference manually */ ImporterModule,
);

@NgModule({
  imports: [],
  exports: [],
  providers: [{provide: FOO, useValue: 123}],
})
export class ConfigurerModule {}
```

`ImporterModule` itself is deleted, its barrel re-export is rewritten, and the arbitrary `console.log`
that referenced it gets a comment because the schematic will not delete a statement it does not
understand. **That comment is your work queue** — grep for it after every mode-2 run.

## Mode 3 — `standalone-bootstrap`

The seven operations, verbatim from the README:

> *"1. Generate the `bootstrapApplication` call to replace the `bootstrapModule` one. 2. Convert the
> `declarations` of the module that is being bootstrapped to `standalone`. These modules were skipped
> explicitly in the first step of the migration. 3. Copy any `providers` from the bootstrapped module
> into the `providers` option of `bootstrapApplication`. 4. Copy any classes from the `imports` array of
> the rootModule to the `providers` option of `bootstrapApplication` and wrap them in an
> `importsProvidersFrom` function call. 5. Adjust any dynamic import paths so that they're correct when
> they're copied over. 6. If an API with a standalone equivalent is detected, it may be converted
> automatically as well. E.g. `RouterModule.forRoot` will become `provideRouter`. 7. Remove the root
> module."*

⚠️ Step 4 says **`importsProvidersFrom`**. That is an upstream typo for `importProvidersFrom`; the
generated code in the very same file spells it correctly. Quoted as written, not silently corrected.

And the rule for code the root module referenced from outside the class:

> *"If the migration detects that the `providers` or `imports` of the root module are referencing code
> outside of the class declaration, it will attempt to carry over as much of it as it can to the new
> location. If some of that code is exported, it will be imported in the new location, otherwise it will
> be copied over."*

The `main.ts` it produces, verbatim from the README's worked example — this is the canonical shape of a
bridged bootstrap:

```ts
bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(SharedModule),
    {provide: token, useValue: {foo: true, bar: {baz: false}}},
    {provide: CONFIG, useClass: ExportedConfigClass},
    provideAnimations(),
    provideRouter(
      [
        {
          path: 'shop',
          loadComponent: () => import('./app/shop/shop.component').then((m) => m.ShopComponent),
        },
      ],
      withEnabledBlockingInitialNavigation(),
    ),
  ],
}).catch((e) => console.error(e));
```

Read what it chose. `RouterModule.forRoot(routes, {initialNavigation: 'enabledBlocking'})` became
`provideRouter(routes, withEnabledBlockingInitialNavigation())`. `BrowserAnimationsModule` became
`provideAnimations()`. Only `SharedModule` — which has no `provide*` equivalent because it is your own
code — stayed behind `importProvidersFrom`. **That is the whole rule in one example: after the
migration, `importProvidersFrom` is the residue, not the strategy.**

🔴 **But `provideAnimations()` is itself deprecated in v22.** From
`packages/platform-browser/animations/src/module.ts` at `v22.1.5`, verbatim:

> *"@deprecated 20.2 Use `animate.enter` or `animate.leave` instead. Intent to remove in v23"*

The migration's animation conversion was written for v15 and nobody re-aimed it. It is still the right
*mechanical* answer — `provideAnimations()` genuinely replaces `BrowserAnimationsModule` — but it lands
you on an API with a removal target one major away. Treat any `provideAnimations()` the schematic writes
as a TODO, not as a result. `withEnabledBlockingInitialNavigation` and `provideRouter`, by contrast,
carry no `@deprecated` tag in the v22.1.5 router public-API golden.

## Reviewing the diff — the four greps that matter

Do these after each mode, before you commit. They are cheap and they catch exactly the things the
schematic tells you about only by leaving evidence in the source.

```bash
# after EVERY step — the schematic's own work queue
grep -rn 'TODO(standalone-migration)' src/

# after step 1 — anything still carrying the flag was skipped, and you need to know why
grep -rn 'standalone: false' src/

# after step 2 — every surviving @NgModule, so you can check it against the five criteria
grep -rln '@NgModule' src/

# after step 3 — the bootstrap actually moved, and this is your importProvidersFrom debt
grep -rn 'bootstrapModule\|platformBrowserDynamic' src/
grep -rn 'importProvidersFrom\|provideAnimations' src/
```

⚠️ **The emptied files keep their old `import` statements.** In the README's own AFTER block,
`app.module.ts` still opens with `import {NgModule, InjectionToken} from '@angular/core';` and
`import {RouterModule} from '@angular/router';` after the `@NgModule` class is gone, and `main.ts`
imports `platformBrowser` alongside `bootstrapApplication` while using only the latter. Dead TypeScript
imports are not a compile error, so nothing will tell you. Your linter's `no-unused-vars` will, which is
one more reason step 10 of the flow is "run your linting checks".

⚠️ **The README's own worked example is internally inconsistent** — its AFTER `main.ts` imports
`AppModule` from a file whose AFTER block no longer exports one, and the `SharedModule` import path and
one interface field name differ between BEFORE and AFTER. Those look like editing artifacts in the
document rather than described behaviour; **the documentation does not state** what the schematic
actually emits in that case, so read the real diff rather than trusting the sample.

## Gotchas

**★ Symptom: you ran `ng generate @angular/core:standalone` in CI or with `--defaults` and only some
components changed.** Cause: `mode` has a `x-prompt`, so nothing prompted, and `schema.json` supplied
its `"default": "convert-to-standalone"` — you ran step 1 and only step 1. Fix: always pass the mode
explicitly, one command per step:

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
ng generate @angular/core:standalone --mode=prune-ng-modules
ng generate @angular/core:standalone --mode=standalone-bootstrap
```

**★ Symptom: `--mode=prune-ng-modules` runs clean and deletes nothing.** Cause: you ran it first. Every
module still has a populated `declarations` array, and the first removal criterion is *"Has no
`declarations`"*. Fix: run mode 1 over the same path, verify, commit, then re-run mode 2.

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
ng build && ng test --watch=false && git commit -am "step 1"
ng generate @angular/core:standalone --mode=prune-ng-modules
```

**★ Symptom: after mode 1 your unit tests fail with `Unexpected "UserCard" found in the
"declarations" array of the "TestBed.configureTestingModule" call`.** Cause: mode 1 deleted
`standalone: false` from `UserCard`, and `TestBed` refuses a standalone class in `declarations`. The
specs were not updated because they are not what the migration analyses. Fix: move the class from
`declarations` to `imports` in every affected spec.

```ts
// BEFORE
TestBed.configureTestingModule({declarations: [UserCard], providers: [UserService]});

// AFTER
TestBed.configureTestingModule({imports: [UserCard], providers: [UserService]});
```

**★ Symptom: a module you expected to disappear is still there after mode 2.** Cause: it fails one of
the five criteria — most often a lone `providers` entry, a single class member, or an import of
something that returns a `ModuleWithProviders` such as `RouterModule.forRoot(routes)`. Fix: remove the
disqualifier by hand, then re-run mode 2. For a provider, the cheapest move is to put the scope on the
service itself so there is nothing left to host:

```ts
// BEFORE — analytics.module.ts survives mode 2 because of this one line
@NgModule({imports: [], providers: [{provide: AnalyticsClient, useClass: SegmentClient}]})
export class AnalyticsModule {}

// AFTER — nothing to declare, nothing to provide, module qualifies for removal
@Injectable({providedIn: 'root', useClass: SegmentClient})
export abstract class AnalyticsClient {
  abstract track(event: string, payload: Record<string, unknown>): void;
}
```

**★ Symptom: `ng lint` fails after mode 2 with an unused-variable error on a module name.** Cause: the
schematic could not statically delete an arbitrary reference, so it left
`/* TODO(standalone-migration): clean up removed NgModule reference manually */` in front of it. Fix:
grep the marker and delete the dead statement:

```bash
grep -rn 'TODO(standalone-migration)' src/
```

```ts
// BEFORE
console.log(
  /* TODO(standalone-migration): clean up removed NgModule reference manually */ ImporterModule,
);

// AFTER — the whole statement goes, along with the now-dangling import
```

**★ Symptom: some components in the repo were never touched by any mode.** Cause: the schematic works
from your `tsconfig.json` files. angular.dev, verbatim: *"Files not included in a tsconfig - the
schematic determines which files to migrate by analyzing your project's `tsconfig.json` files. The
schematic excludes any files not captured by a tsconfig."* Fix: widen the include so the orphaned
directory is compiled, then re-run the mode:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {"outDir": "./out-tsc/app"},
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts", "src/legacy-widgets/**/*.ts"]
}
```

**Symptom: the migration aborts or produces nonsense on a project that "mostly works".** Cause:
*"Compilation errors - if the project has compilation errors, Angular cannot analyze and migrate it
correctly."* Fix: `ng build` must exit clean first — including the type errors your editor is hiding
behind an `// @ts-ignore` you added last month.

**Symptom: mode 3 ran, the app boots, and you now have `importProvidersFrom(EverythingModule)` at the
root.** Cause: step 4 copies every class from the root module's `imports` into `bootstrapApplication`'s
providers wrapped in `importProvidersFrom`, and only converts the ones it recognises (step 6). Fix: this
is expected output, not a defect — unpack it afterwards, module by module, replacing each with its
`provide*` function. Chunk **08 · Interop, honestly — `importProvidersFrom`** *(not written yet)* owns
what that bridge costs.

**Symptom: after the whole migration you still have `*ngIf` and `*ngFor` everywhere.** Cause: this
schematic converts *declaration form*, not *template syntax*. Fix: the follow-up schematics are
separate commands — see **09b · What the schematic cannot do** *(not written yet)*.

## Interview questions

**★ Why does the standalone migration have to be run three times instead of once?**
Because each mode's precondition is the previous mode's output, and they are separate program-wide
analyses. Mode 2 only removes a module whose `declarations` array is empty, and the only thing that
empties it is mode 1 moving those classes into `imports`. Mode 1 deliberately skips modules with a
`bootstrap` array, so their declarations stay non-standalone until mode 3 replaces `bootstrapModule`
with `bootstrapApplication` and converts them in the same pass. Angular also wants a human verification
point between each step — the README says authors *"should verify that the app still works between each
of the steps"* — because a static analysis of a large codebase gets some things wrong and you want the
blast radius of each wrong thing confined to one commit.

**★ What happens if you run `--mode=prune-ng-modules` first?**
Nothing destructive, and that is the problem. Every module still has declarations, so every module
fails the first removal criterion and the schematic reports having changed nothing. You conclude the
migration "doesn't work on our codebase" and stop. There is no warning about running out of order.

**★ Why does mode 1 refuse to touch a module that has a `bootstrap` array?**
Because converting the root component to standalone while `main.ts` still calls
`platformBrowser().bootstrapModule(AppModule)` would leave the module listing a standalone class in
`bootstrap`, which is a compile error (NG6009 — a standalone class cannot appear in `bootstrap`). The
schematic will not create an intermediate state that does not build, so it defers those declarations to
the step that also rewrites the bootstrap call.

**★ A module survived `prune-ng-modules`. What does that tell you?**
That it fails at least one of five conditions: it still declares something, it provides something, it
bootstraps something, it imports a `ModuleWithProviders` or an unremovable module, or its class has a
member (an empty constructor being explicitly forgiven). Each of those is a different piece of manual
work: declarations mean mode 1 skipped it, providers mean you have a DI decision to make, a
`ModuleWithProviders` import usually means `RouterModule.forRoot` and points at `provideRouter`.

**★ Why is the migration least trustworthy in your unit tests?**
Two reasons Angular states outright. First, *"Because unit tests are not ahead-of-time (AoT) compiled,
`imports` added to components in unit tests might not be entirely correct"* — the analysis that gives a
component its `imports` array leans on AoT compilation the specs never get. Second, *"The schematic
relies on direct calls to Angular APIs"*, so any house wrapper around `TestBed.configureTestingModule`
makes the components it declares invisible. The migration is weakest exactly where your type checking is
weakest, which is why "run the project's unit tests and fix any failures" is an explicit post-migration
step rather than an afterthought.

**Why does the schematic emit `imports: [NgIf]` rather than `imports: [CommonModule]`?**
Because it resolved the actual template dependency rather than the bundle that happens to contain it,
and the narrower form is the one the compiler can police. NG8113 can tell you an unused `NgIf` entry has
gone stale; it cannot tell you that about `CommonModule`, because a barrel module is "used" if any one
of its exports is. The narrow import is also what makes a symbol eligible for deferred loading later.

**What is the single most valuable thing to do between migration steps, and why?**
Commit. The migration is a whole-program rewrite driven by static analysis, and when it gets something
wrong the useful question is "which of the three passes did this?" — a question only a commit boundary
can answer. It also keeps the formatter out of the way: run `prettier` and `ng lint --fix` as a final,
separate commit so the mechanical churn never hides the one line where the schematic guessed wrong.

**Why does `--dry-run` not replace a Git branch here?**
Because the documented flow requires you to *"verify that the app works"* between steps, and you cannot
run an application whose migration was never written to disk. `--dry-run` gives you a preview of one
step in isolation; the branch gives you a way back out of three steps whose failure mode is usually
discovered by the test suite two steps later.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **10 · Why standalone makes the graph splittable** *(not written yet)*
