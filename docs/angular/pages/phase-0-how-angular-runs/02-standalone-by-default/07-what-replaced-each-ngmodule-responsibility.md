---
title: "`@NgModule` carried nine responsibilities and two of them are now answered by nothing at all — `declarations` and `exports` were bookkeeping that existed only because a container had to be told what it held"
sidebar_label: "07 · What replaced each `NgModule` responsibility"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and
> `angular/angular` at tag `v22.1.5`:
> [`packages/core/src/metadata/ng_module.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/ng_module.ts),
> [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md),
> [`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts),
> [`packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts),
> [`packages/core/src/render3/deps_tracker/deps_tracker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/deps_tracker/deps_tracker.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Migrating off `NgModule` is not one substitution, it is nine, and they are not the same kind of substitution. Two of the nine were answered by deleting the problem rather than relocating it, and those two — `declarations` and `exports` — are this page. They were the module's *declaration* half: the part angular.dev describes as *"Declaring components, directives, and pipes that belong to the NgModule."* Nothing replaced them, because once a component names its own template dependencies there is no container left to keep a manifest for. The price is real and specific: `declarations`-without-`exports` was Angular's only way to make a component private to a feature, and standalone has no equivalent at all.**

## The complete field list, at v22.1.5

These are **all** the fields `@NgModule` has, in source order from `packages/core/src/metadata/ng_module.ts` — and the public-API golden agrees exactly:

```ts
// @angular/core 22.1.5 — the whole @NgModule surface
providers?: Array<Provider | EnvironmentProviders>;
declarations?: Array<Type<any> | any[]>;
imports?: Array<Type<any> | ModuleWithProviders<{}> | any[]>;
exports?: Array<Type<any> | any[]>;
bootstrap?: Array<Type<any> | any[]>;
schemas?: Array<SchemaMetadata | any[]>;
id?: string;
jit?: true;
```

🔴 **`entryComponents` is not on that list and has not been since 16.0.0.** It is the ninth responsibility, and the only one removed rather than replaced.

## The substitution table — all nine rows

| `@NgModule` field | The v22 answer | Where it is worked |
|---|---|---|
| `declarations` | **Nothing.** A class no longer belongs to a container. | This page |
| `exports` | **Nothing.** A standalone component *is* its own export. | This page |
| `imports` (a plain module) | `imports` on **each component** that needs the template dependency, **plus** a `provide*()` call for the provider half | [07b](07b-imports-split-in-two-and-providers-gained-four-homes.md) |
| `imports` (`X.forRoot()`) | `provideX()` in a provider array; a `ModuleWithProviders` in a component's `imports` is **NG2012** | [07b](07b-imports-split-in-two-and-providers-gained-four-homes.md) |
| `providers` | `ApplicationConfig.providers` · `Route.providers` · `@Component.providers` · `@Injectable({providedIn: 'root'})` | [07b](07b-imports-split-in-two-and-providers-gained-four-homes.md) |
| `bootstrap` | The **first argument** of `bootstrapApplication` | [Chunk 02](01b-the-ngmodule-bootstrap-it-replaced.md), and [07c](07c-the-fields-that-moved-and-the-ones-deleted.md) |
| `schemas` | `schemas` on the **component**, and only a standalone one | [07c](07c-the-fields-that-moved-and-the-ones-deleted.md) |
| `entryComponents` | **Nothing. Deleted in 16.0.0.** | [07c](07c-the-fields-that-moved-and-the-ones-deleted.md) |
| `id` / `jit` | **Still there, still `NgModule`-only.** No standalone equivalent, and none is needed. | [07c](07c-the-fields-that-moved-and-the-ones-deleted.md) |

## `declarations` → nothing

**Before.** Every component, directive and pipe had to be listed exactly once, in exactly one module:

```ts
@NgModule({
  declarations: [UserCardComponent, HighlightDirective, CurrencyFmtPipe],
  imports: [CommonModule, MatButtonModule],
  exports: [UserCardComponent],
})
export class UserUiModule {}
```

**After.** There is no list. `UserCardComponent` is a file; whoever renders it names it:

```ts
@Component({
  selector: 'app-user-page',
  imports: [UserCardComponent, HighlightDirective, CurrencyFmtPipe],
  template: `
    <app-user-card [user]="user()" appHighlight>{{ balance() | currencyFmt }}</app-user-card>
  `,
})
export class UserPageComponent {
  readonly user = input.required<User>();
  readonly balance = signal(0);
}
```

**What you lost.** One place to read "everything in this feature", and one edit point that added a dependency to twenty components at once. Both were real conveniences and both are gone.

**What you gained.** *"If Angular discovers any components, directives, or pipes declared in more than one NgModule, it reports an error"* (angular.dev, NgModules overview) — that whole error class stops existing, because there is nothing to declare twice. Moving a component between features becomes a file move rather than a two-module edit.

**The surprise.** The reason a component never needs to import itself is one line of the compiler, verbatim from `packages/compiler-cli/src/ngtsc/scope/src/standalone.ts`:

```ts
// A standalone component always has itself in scope, so add `clazzMeta` during
// initialization.
const dependencies = new Set<DirectiveMeta | PipeMeta | NgModuleMeta>([clazzMeta]);
```

A recursive tree node renders `<app-tree-node>` inside its own template with an empty `imports` array, and that is correct — not a trick.

## `exports` → nothing

**Before**, a shared module declared what it owned and re-exported the subset it wanted public — and `exports` was not limited to `declarations`, so it could also re-export what it merely imported. angular.dev states both halves:

> *"An NgModule can _export_ its declared components, directives, and pipes such that they're available to other components and NgModules."*

> *"The `exports` property is not limited to declarations, however. An NgModule can also export any other components, directives, pipes, and NgModules that it imports."*

**After**, there is no re-export step at all. A convenience bundle is a plain exported array, and `imports` flattens it because its type is `(Type<any> | ReadonlyArray<any>)[]`:

```ts
// src/app/shared/shared-ui.ts
import { NgClass } from '@angular/common';
import { CardComponent } from './card.component';
import { BadgeComponent } from './badge.component';

export const SHARED_UI = [CardComponent, BadgeComponent, NgClass] as const;
```

```ts
@Component({
  selector: 'app-dashboard',
  imports: [SHARED_UI, RouterLink],
  template: `<app-card><app-badge [ngClass]="tone()" /></app-card>`,
})
export class DashboardComponent {
  readonly tone = signal('ok');
}
```

**What you lost — and this one is genuine.** `declarations` without `exports` was Angular's only encapsulation primitive: a component could be *private to its module*. Standalone has no equivalent. An exported class is importable by anyone in the workspace, and the compiler will never object. The replacements are outside the framework: an ESLint boundary rule, an Nx project tag, or a library's `package.json` `exports` map.

**What you gained.** The "added it to `declarations`, forgot to add it to `exports`" failure — reported from the consuming side as NG2011, with a related-information note reading *"It's declared in the 'LegacyUiModule' NgModule, but is not exported. Consider exporting it and importing the NgModule instead."* — is now unreachable.

**The surprise.** Whether that shared array is `export`ed changes compiler behaviour. NG8113 (unused imports) deliberately stays quiet about symbols that *might* be shared, and its test for "might be shared" is exactly exportedness — verbatim from `unused_standalone_imports_rule.ts`:

> *"The reference might be shared if it comes from an exported array. If the variable is local to the file, then it likely isn't shared. Note that this has the potential for false positives if a non-exported array of imports is shared between components in the same file."*

A local, un-exported `const` array of imports gets flagged entry by entry. Export it and the warnings stop.

## The "before" in twenty lines of runtime code

If you want the ambient scope as an algorithm rather than as folklore, it is `computeNgModuleScope` in `packages/core/src/render3/deps_tracker/deps_tracker.ts`:

```ts
// Analyzing imports
for (const imported of maybeUnwrapFn(def.imports)) {
  if (isNgModule(imported)) {
    const importedScope = this.getNgModuleScope(imported);

    // When this module imports another, the imported module's exported directives and pipes
    // are added to the compilation scope of this module.
    addSet(importedScope.exported.directives, scope.compilation.directives);
    addSet(importedScope.exported.pipes, scope.compilation.pipes);
  } else if (isStandalone(imported)) {
    // ... add the single class ...
  }
}

// Analyzing declarations
if (!scope.compilation.isPoisoned) {
  for (const decl of maybeUnwrapFn(def.declarations)) {
    // Cannot declare another NgModule or a standalone thing
    if (isNgModule(decl) || isStandalone(decl)) {
      scope.compilation.isPoisoned = true;
      break;
    }
    // ...
  }
}
```

**Every declaration in the module shares one `compilation` set.** That is "ambient and transitive" in code — and it is exactly why the two rows above could be answered with "nothing": once a component names its own dependencies, there is no shared set to bookkeep, and therefore no manifest and no re-export list to keep in sync with it.

Note the second half too. A standalone class in `declarations` poisons the scope — which is the runtime shadow of the compile-time rule that a class belongs to exactly one world.

## Gotchas

**★ Symptom: you deleted the shared module's `exports` and now twelve unrelated components fail to compile.** Cause: `exports` was doing real work — it made one edit visible everywhere. Deleting it means twelve `imports` arrays each need the symbol. Fix: replace the module with an exported array and import that, one line per consumer:

```ts
// src/app/shared/shared-form-controls.ts
export const SHARED_FORM_CONTROLS = [TextFieldComponent, SelectComponent, FieldErrorComponent] as const;
```

```ts
@Component({
  selector: 'app-signup-form',
  imports: [SHARED_FORM_CONTROLS, ReactiveFormsModule],
  template: `<app-text-field label="Email" [control]="form.controls.email" />`,
})
export class SignupFormComponent {
  readonly form = inject(FormBuilder).nonNullable.group({ email: '' });
}
```

**★ Symptom: NG8113 warns that a symbol "is not used within the template" of a component that clearly uses it.** Cause: your shared imports array is declared `const` but not `export`ed, and two components in the same file share it — the rule's shared-array exemption keys on exportedness, and its own comment admits the false positive. Fix: add `export` to the array, or move it to its own file:

```ts
export const SHARED_UI = [CardComponent, BadgeComponent] as const;
```

**★ Symptom: a component you moved out of `declarations` compiles, but nothing renders it and the failure names its old owning module.** Cause: half an edit. Removing a class from `declarations` while it still says `standalone: false` leaves it owned by nothing — the non-standalone runtime path looks its owner up in the `ownerNgModule` map and finds no entry. Fix: the two edits are one commit:

```ts
@Component({
  selector: 'app-user-card',
  imports: [DatePipe],
  template: `<p>{{ user().joinedAt | date }}</p>`,
})
export class UserCardComponent {
  readonly user = input.required<User>();
}
```

Delete the `standalone: false` line at the same moment you delete the `declarations` entry, and the class is complete on its own.

**★ Symptom: after migrating a feature, a component nobody was supposed to use is now imported by three other teams.** Cause: it was private only by virtue of not being in `exports`, and that mechanism no longer exists. Nothing in Angular 22 can express "internal to this folder". Fix: enforce it in the toolchain — an ESLint boundary rule is the smallest thing that works:

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": ["*/billing/internal/*"]
    }]
  }
}
```

For a published library, do it in `package.json` instead: an `exports` map that lists only your public entry points makes deep imports unresolvable rather than merely discouraged.

**Symptom: a standalone class listed in a surviving module's `declarations` makes every template in that module fail.** Cause: `computeNgModuleScope` sets `isPoisoned = true` the moment it finds an `isStandalone(decl)` in `declarations`, and a poisoned scope contributes no directives or pipes to anything the module declares. Fix: remove the class from `declarations` and put it in the `imports` of whichever components render it. A standalone class is never declared, only imported.

**Symptom: the migration left `exports: [UserCardComponent]` on a module whose `declarations` array is now empty.** Cause: `exports` is legal without `declarations` — a module may re-export anything it imports — so the compiler has no reason to complain, and the module quietly survives as a no-op re-export shim. Fix: delete the module. If something still imports it, that consumer needs `UserCardComponent` in its own `imports` array instead; a re-export module is exactly the ambient indirection this design removed.

## Interview questions

**★ Which `@NgModule` fields have no replacement at all, and why is that not a loss?**
`declarations`, `exports` and `entryComponents`. All three were bookkeeping obligations that existed only because a container had to be told what it held. `declarations` answered "who owns this class"; once a component names its own dependencies, nothing owns it. `exports` answered "what may leave this module"; once a component names a class directly, there is no boundary to cross. `entryComponents` answered "which classes will be created without a template reference", and Ivy removed the need in v9. The one thing genuinely lost with `exports` is encapsulation — a component can no longer be private to a feature — and that has to be enforced by lint rules or package boundaries instead.

**★ `exports` is gone — how do you make a component private to a feature now?**
You cannot, at the framework level. That is the honest answer. `declarations` without `exports` was Angular's only encapsulation primitive and standalone has no equivalent: an exported class is importable from anywhere in the workspace and the compiler will never complain. The replacements live outside Angular — an ESLint module-boundary rule, Nx project tags, or, for a published library, a `package.json` `exports` map that simply does not expose the file. If an interviewer expects "use a barrel file", push back: a barrel changes convenience, not visibility.

**★ Why is `declarations` the field whose removal makes incremental compilation possible?**
Because a `declarations` array made the compilation scope of every component in a module a function of the whole module graph. Change what one module imports and every component declared anywhere downstream may have gained or lost a directive, so the compiler could not safely reuse yesterday's answer for a file you did not touch. `imports` on a component makes that scope a function of one file's own literal array, resolved by `StandaloneComponentScopeReader` without leaving the file except to follow the classes it names. That locality is the property, not the syntax — and it is the same property [chunk 03](03-standalone-by-default-which-version-changed-what.md) shows the compiler leaning on when it decides a default from your resolved `@angular/core` version.

**★ Why does a standalone component never import itself, and what happens if you try?**
Because the scope reader seeds the dependency set with the component's own metadata before it looks at `imports` at all, and it maintains a `seen` set that already contains the class. Listing yourself is therefore a no-op: the `continue` branch fires on the first iteration. The practical consequence is that a recursive component — a tree node, a nested comment thread — needs nothing in `imports` to render its own selector. NG8113 may still warn that the self-import is unused, which is the only visible effect.

**What is the replacement for a "SharedModule", and why is an exported `const` array not just the same thing again?**
A plain `export const SHARED_UI = [Card, Badge] as const;`, imported by whoever wants it — `@Component.imports` is typed `(Type<any> | ReadonlyArray<any>)[]` and flattens nested arrays, so the array behaves exactly like a list of individual entries. It is not the same thing as a `SharedModule` in the one way that matters: the array contributes only template scope, never providers or an injector, and it is resolved statically per component. A `SharedModule` also dragged its own `imports` graph and its providers along, which is precisely how "I imported one directive and got a second copy of a service" used to happen.

**Why does a standalone class in a surviving module's `declarations` break every template in that module, rather than just that one class?**
Because the failure is modelled as a *poisoned scope*, not as a per-class error. `computeNgModuleScope` breaks out of the declarations loop and marks `scope.compilation.isPoisoned = true`, and a poisoned compilation scope contributes nothing — so every component the module declares loses every directive and pipe it was relying on, and you get a wall of unknown-element errors pointing at files you did not touch. It is deliberate: Angular would rather stop than emit a half-resolved scope.

---

← Prev: [Where `schemas` lives](06g-where-schemas-lives.md) · Index: [Topic index](README.md) · Next → [`imports` split in two, `providers` gained four homes](07b-imports-split-in-two-and-providers-gained-four-homes.md)
