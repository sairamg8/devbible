---
title: "The compiler reads your `imports` array without ever running it, and the array does two jobs beyond naming template dependencies — it opens an injector and it decides what reaches the compiled output"
sidebar_label: "04c · What the compiler does with it"
sidebar_position: 4.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular` at tag `v22.1.5`: [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts), [`.../annotations/component/src/handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts), [`.../annotations/common/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts), [`packages/core/src/render3/standalone_service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/standalone_service.ts), [`packages/core/src/render3/deps_tracker/deps_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/deps_tracker/deps_tracker.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`imports` looks like an ordinary JavaScript array and it is not treated like one. `ngtsc`
reads it out of your source with a partial evaluator that never executes your program, which
is why a computed array is a build error rather than a runtime surprise. Once evaluated, the
array does two more jobs nobody tells you about: any NgModule in it installs that module's
providers into a lazily-created environment injector keyed on the component's definition, and
the array's entries are filtered — asymmetrically — before anything reaches the compiled
output. Both behaviours produce bugs that look nothing like an import problem: a service that
exists twice, and an "unused" import that is not actually free.**

## Why the array has to be identifiers a compiler can follow

`ngtsc` reads your `.ts` file. It does not run it. The array is handed to the partial
evaluator with two special resolvers registered in the component handler —
`createModuleWithProvidersResolver` and `createForwardRefResolver` — and then validated and
flattened by `validateAndFlattenComponentImports`, whose failure message is verbatim:

```ts
const errorMessage = isDeferred
  ? `'deferredImports' must be an array of components, directives, or pipes.`
  : `'imports' must be an array of components, directives, pipes, or NgModules.`;
```

That message is raised through `createValueHasWrongTypeError`, which ends in
`new FatalDiagnosticError(ErrorCode.VALUE_HAS_WRONG_TYPE, ...)` — and
`VALUE_HAS_WRONG_TYPE = 1010`, so the diagnostic you see is **NG1010**, not one of the NG20xx
standalone codes. When the offending value could not be evaluated at all, the error gains a
second, chained line, also verbatim from `annotations/common/src/diagnostics.ts`:

```ts
chainedMessage = 'Value could not be determined statically.';
```

One entry shape gets its own bespoke diagnostic instead —
`ErrorCode.COMPONENT_UNKNOWN_IMPORT = 2012`, i.e. **NG2012**, for a `Module.forRoot()` call:

```ts
`Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. ` +
  `These calls are not used to configure components and are not valid in standalone component imports - ` +
  `consider importing them in the application bootstrap instead.`
```

This constraint is not local to `imports`. It is the same rule that governs `selector`,
`providers` and every other `@Component` argument, and it is the subject of **09 · Static
analysability is the load-bearing constraint** *(not written yet)* in
[01 · A compiler with a framework attached](../01-compiler-with-a-framework-attached/README.md).
The short version: if a human reading only your source cannot say what the value is, neither
can `ngtsc`.

## `imports` is an injector edge as well as a scope

The half most write-ups miss. When you import an NgModule that carries `providers`, those
providers do not vanish — they are collected into a **standalone injector**, created lazily
for that component. `packages/core/src/render3/standalone_service.ts`, class doc verbatim:

> *"A service used by the framework to create instances of standalone injectors. Those
> injectors are created on demand in case of dynamic component instantiation and contain
> ambient providers collected from the imports graph rooted at a given standalone component."*

```ts
getOrCreateStandaloneInjector(componentDef: ComponentDef<unknown>): EnvironmentInjector | null {
  if (!componentDef.standalone) {
    return null;
  }

  if (!this.cachedInjectors.has(componentDef)) {
    const providers = internalImportProvidersFrom(false, componentDef.type);
    const standaloneInjector =
      providers.length > 0
        ? createEnvironmentInjector(
            [providers],
            this._injector,
            typeof ngDevMode !== 'undefined' && ngDevMode
              ? `Standalone[${componentDef.type.name}]`
              : '',
          )
        : null;
    this.cachedInjectors.set(componentDef, standaloneInjector);
  }

  return this.cachedInjectors.get(componentDef)!;
}
```

🔴 **The cache key is the `ComponentDef`, not the application.** Two different components that
each import the same providers-carrying module get **two** environment injectors and therefore
two instances of that module's services. Providers reached this way are also not in the root
injector, so a sibling that did not import the module cannot inject them. That is a genuine
double-instantiation trap, and it is why a module with global state belongs in
`bootstrapApplication`'s providers rather than in a component's `imports`.

## What actually reaches the compiled output

`componentDependenciesToDeclarations` in the component handler decides which imports become
entries in the generated component definition. The asymmetry is the point:

```ts
// Transform the dependencies list, filtering out unused dependencies.
for (const dep of allDependencies) {
  // Only emit references to each dependency once.
  if (declarations.has(dep.ref.node)) {
    continue;
  }

  switch (dep.kind) {
    case MetaKind.Directive:
      if (!wholeTemplateUsed.has(dep.ref.node) || dep.matchSource !== MatchSource.Selector) {
        continue;
      }
      // ...emits an R3TemplateDependencyKind.Directive entry...
      break;
    case MetaKind.NgModule:
      const ngModuleType = this.refEmitter.emit(dep.ref, context);
      assertSuccessfulReferenceEmit(ngModuleType, node.name, 'NgModule');

      declarations.set(dep.ref.node, {
        kind: R3TemplateDependencyKind.NgModule,
        type: ngModuleType.expression,
        importedFile: ngModuleType.importedFile,
      });
      break;
  }
}
```

Pipes get the same treatment as directives, in a second loop that also skips anything not in
`wholeTemplateUsed`. So: a directive or pipe the template never uses is `continue`d and never
reaches the definition. An **NgModule** has no such filter — it is emitted unconditionally,
because its providers still have to be collected by the injector above.

The honest, source-backed answer to *"does an unused import cost anything?"* is therefore:
an unused standalone directive or pipe costs you a compiler warning and a live ES import in
your `.ts`; an unused **NgModule** additionally puts a reference to that module class in the
emitted output. ⛔ No number goes here — nothing was built and no bundle was measured. The
warning itself is **05 · Unused imports and the compiler diagnostics** *(not written yet)*.

## Gotchas

**★ Symptom: `imports: [StoreModule.forRoot(reducers)]` fails to compile.** Cause: NG2012 —
the value is a `ModuleWithProviders`, and the compiler's message says so: *"These calls are not
used to configure components and are not valid in standalone component imports"*. Fix: move it
into the application config, which is what the message means by "the application bootstrap":

```ts
// src/app/app.config.ts
import {ApplicationConfig, importProvidersFrom} from '@angular/core';
import {StoreModule} from '@ngrx/store';
import {reducers} from './state/reducers';

export const appConfig: ApplicationConfig = {
  providers: [importProvidersFrom(StoreModule.forRoot(reducers))],
};
```

**★ Symptom: NG1010 with a second line reading `Value could not be determined statically.`**
Cause: the array is built by something the partial evaluator cannot follow — a function call,
a conditional, a spread of a computed value. Fix: make it a plain exported constant of
identifiers:

```ts
// src/app/users/user-card.component.ts
import {Component, input} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AvatarComponent} from '../shared/avatar.component';
import type {User} from './user';

// ❌ `imports: buildImports({withRouter: true})` — ngtsc cannot evaluate a call.
// ✅ a plain exported constant of identifiers, which it can.
export const USER_CARD_IMPORTS = [AvatarComponent, RouterLink] as const;

@Component({
  selector: 'app-user-card',
  imports: [USER_CARD_IMPORTS],
  template: `
    <a [routerLink]="['/users', user().id]"><app-avatar [label]="user().fullName" /></a>
  `,
})
export class UserCardComponent {
  readonly user = input.required<User>();
}
```

**★ Symptom: a service you expected to be a singleton has two instances, and both components
that see one imported the same NgModule.** Cause: `getOrCreateStandaloneInjector` caches per
`ComponentDef`, so each importing component class gets its own environment injector built from
its own imports graph. Fix: import the module once, at bootstrap, and leave it out of the
components:

```ts
// src/app/app.config.ts
import {ApplicationConfig, importProvidersFrom} from '@angular/core';
import {AnalyticsModule} from '@acme/analytics';

export const appConfig: ApplicationConfig = {
  providers: [importProvidersFrom(AnalyticsModule)],
};
```

**★ Symptom: a service provided by a module a *parent* component imported cannot be injected in
a child.** Cause: the same mechanism seen from the other side — the standalone injector belongs
to the importing component's `ComponentDef`, not to the element tree beneath it. Fix: as above,
hoist the providers to `bootstrapApplication`, or declare the service with
`providedIn: 'root'` so there is exactly one:

```ts
// src/app/analytics/analytics.service.ts
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class AnalyticsService {
  track(event: string): void {
    performance.mark(event);
  }
}
```

**★ Symptom: you deleted markup but the directive is still imported, and the build only
warns.** Cause: NG8113 is a warning by default, and the unused entry still costs you a live ES
import that keeps that file in the module graph. Fix: delete the entry, or run
`ng generate @angular/core:cleanup-unused-imports`. The full diagnostic story is **05 · Unused
imports and the compiler diagnostics** *(not written yet)*.

**★ Symptom: you removed the last usage of an imported NgModule from the template and the
module is still referenced in the built output.** Cause: the `MetaKind.NgModule` branch of
`componentDependenciesToDeclarations` has no `wholeTemplateUsed` guard — modules are emitted
unconditionally so their providers can still be collected. Fix: delete the entry from
`imports`; nothing else removes it.

## Interview questions

**★ Why must `imports` be a literal array of identifiers rather than something computed?**
Because `ngtsc` is a TypeScript transformer that reads your source at build time; it never
executes your program. The array goes through the partial evaluator, and a value it cannot
resolve produces NG1010 with the chained message `Value could not be determined statically.`.
Two escape hatches are registered specifically for this array — `forwardRef` for cycles and a
`ModuleWithProviders` resolver so that `forRoot()` calls get a useful error instead of a
confusing one.

**★ Does an unused entry in `imports` end up in the compiled component definition?**
A directive or pipe, no — `componentDependenciesToDeclarations` skips anything not in
`wholeTemplateUsed`. An NgModule, yes — the `MetaKind.NgModule` branch has no such filter,
because the module's providers still have to be collected. The unused directive still costs
you the ES import statement and an NG8113 warning.

**★ Two sibling components both import the same NgModule, which provides a service. How many
instances of that service exist?**
Two. `StandaloneService.getOrCreateStandaloneInjector` caches by `ComponentDef`, so each
component class gets its own environment injector built from its own imports graph. If you
want one, import the module once at bootstrap with `importProvidersFrom`, or give the service
`providedIn: 'root'`.

**★ Where do the providers of a module you imported into a component live, and when are they
created?**
In an `EnvironmentInjector` created on first use by `StandaloneService`, parented to the
injector the component was created in, cached against the component's `ComponentDef`, and torn
down with its parent environment injector. In dev mode it even carries a debug name of the
form `Standalone[UserCardComponent]`, which is how you spot one in an injector tree.

---

← Prev: [What goes in the array](04b-what-goes-in-the-imports-array.md) · Index: [Topic index](README.md) · Next → [The ambient scope it replaced](04d-the-ambient-ngmodule-scope-it-replaced.md)
