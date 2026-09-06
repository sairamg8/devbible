---
title: "Mode 1 rewrites decorators — it deletes `standalone: false`, infers each template's real dependencies, and moves every declared class into the module's own `imports`"
sidebar_label: "09b · Mode 1 — convert to standalone"
sidebar_position: 9.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Migrate to standalone](https://angular.dev/reference/migrations/standalone)
> — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/ng-generate/standalone-migration/README.md`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/README.md),
> [`packages/common/src/directives/ng_if.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/src/directives/ng_if.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Mode 1 is a decorator rewrite, and it makes exactly two edits per declarable and one per module. On
each component, directive and pipe it deletes `standalone: false` and writes an `imports` array
containing the individual directives and pipes that class's template actually references — `NgIf`, not
`CommonModule`. On each module it moves the classes from `declarations` into `imports`, which keeps every
existing template resolving unchanged while making each declarable independently usable. It never
deletes a module, and it explicitly refuses any module carrying a `bootstrap` array. The result compiles
and behaves identically. It is also not modern: the migration writes a directive Angular deprecated in
v20 into your import list, because your template still uses the syntax that needs it.**

## What the mode is documented to do

angular.dev, verbatim:

> *"In this mode, the migration converts all components, directives and pipes to standalone by removing
> `standalone: false` and adding dependencies to their `imports` array."*

🔴 And the exception that makes a third mode necessary at all, verbatim from the schematic's
`README.md`:

> *"**Note:** NgModules which bootstrap a component are explicitly ignored in this step, because they
> are likely to be root modules and they would have to be bootstrapped using `bootstrapApplication`
> instead of `bootstrapModule`. Their declarations will be converted automatically as a part of the
> "Switch to standalone bootstrapping API" step."*

That is a deliberate refusal, not an oversight. Converting a root component to standalone while `main.ts`
still calls `bootstrapModule(AppModule)` would leave a standalone class sitting in the module's
`bootstrap` array, which does not compile. The schematic will not create an intermediate state that
fails to build, so it hands those declarables to the mode that also rewrites the bootstrap call.

## The complete before and after

The README's own worked example, verbatim. Note that the **module survives**, with its declared classes
moved out of `declarations` and into `imports`:

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
// BEFORE — my-dir.ts
@Directive({selector: '[my-dir]', standalone: false})
export class MyDir {}
```

```typescript
// BEFORE — my-pipe.ts
@Pipe({name: 'myPipe', pure: true, standalone: false})
export class MyPipe {}
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

```typescript
// AFTER — my-dir.ts
@Directive({selector: '[my-dir]'})
export class MyDir {}
```

```typescript
// AFTER — my-pipe.ts
@Pipe({name: 'myPipe', pure: true})
export class MyPipe {}
```

## Four decisions the schematic made for you

1. **`imports: [NgIf, …]`, not `imports: [CommonModule]`.** The migration resolved the *individual*
   directive the template used. That is the form the compiler can police: NG8113 can tell you an `NgIf`
   entry has gone stale, and it cannot tell you that about `CommonModule`, because a barrel module counts
   as used the moment any single one of its many exports is. See
   [05 · Unused imports and the compiler diagnostics](05-unused-imports-and-the-compiler-diagnostics.md).
2. **`*ngIf` is still in the template.** This migration changes declaration form, not template syntax.
   `NgIf` is deprecated as of 20.0 — *"@deprecated 20.0 Use the `@if` block instead. Intent to remove in
   a future major release"* — so the schematic has just written a deprecated symbol into your `imports`
   array, correctly, because your template still needs it.
3. **`standalone: false` was deleted, not replaced with `standalone: true`.** In v22 the *absence* of the
   flag is what standalone looks like; the CLI has not generated the flag since v19. See
   [03 · Which version changed what](03-standalone-by-default-which-version-changed-what.md).
4. **The module is still there, and its `imports` grew.** Mode 1 never deletes a module. Moving the
   declarables into `imports` is the minimal edit that keeps every template resolving — the module now
   imports and re-exports exactly what it used to declare — and it is the edit that makes mode 2's first
   removal criterion, *"Has no `declarations`"*, satisfiable at all.

## Gotchas

**★ Symptom: after mode 1 your unit tests fail with `Unexpected "UserCard" found in the "declarations"
array of the "TestBed.configureTestingModule" call`.** Cause: mode 1 deleted `standalone: false` from
`UserCard`, and `TestBed` refuses a standalone class in `declarations` — an omitted flag counts as
standalone. The specs were not updated because they are not what the migration's compiler-driven
analysis looks at. Fix: move the class from `declarations` to `imports` in every affected spec:

```ts
// BEFORE
TestBed.configureTestingModule({declarations: [UserCard], providers: [UserService]});

// AFTER
TestBed.configureTestingModule({imports: [UserCard], providers: [UserService]});
```

**★ Symptom: the migration ran, everything is standalone, and you still have `*ngIf`, `*ngFor` and
`CommonModule` all over the codebase.** Cause: mode 1 imported `NgIf` and `NgForOf` precisely so your
existing structural directives keep working unchanged — converting the template syntax is a different
migration with a different name. Fix: run the follow-up schematics afterwards, in this order, so the
control-flow rewrite happens before you try to delete the imports it made unnecessary:

```bash
ng generate @angular/core:control-flow
ng generate @angular/core:cleanup-unused-imports
```

**★ Symptom: a child component that was never listed in any module's `declarations` was skipped
entirely.** Cause: mode 1 reaches declarables through the modules that declare them, so a class in no
module is not something this pass enumerates. Fix: convert it by hand — delete any `standalone: false`,
add the template's real dependencies to `imports`, and let NG8113 tell you if you over-imported:

```ts
// BEFORE
@Component({selector: 'app-badge', template: '<span *ngIf="on">on</span>', standalone: false})
export class Badge { on = true; }

// AFTER
@Component({selector: 'app-badge', template: '<span *ngIf="on">on</span>', imports: [NgIf]})
export class Badge { on = true; }
```

**Symptom: the root component still carries `standalone: false` after a clean mode 1 run.** Cause: it is
declared by a module with a `bootstrap` array, which mode 1 ignores by design. Fix: nothing to do here —
this is expected and mode 3 handles it. Do **not** delete the flag by hand at this point; that produces
exactly the non-compiling intermediate state the schematic was avoiding, because the module still lists
the class in `bootstrap`.

**Symptom: a component now has an `imports` entry the compiler immediately flags with NG8113 as
unused.** Cause: the analysis added a dependency the template no longer references — most often because
the reference lives in a commented-out block, a string that is not a template, or a code path the static
analysis over-approximated. Fix: it is a warning, not an error, and there is a schematic for it:

```bash
ng generate @angular/core:cleanup-unused-imports
```

## Interview questions

**★ Why does mode 1 refuse to touch a module that has a `bootstrap` array?**
Because converting the root component to standalone while `main.ts` still calls
`platformBrowser().bootstrapModule(AppModule)` would leave the module listing a standalone class in
`bootstrap`, which is a compile error — NG6009, covered in
[01b · The `NgModule` bootstrap it replaced](01b-the-ngmodule-bootstrap-it-replaced.md). The schematic
will not create an intermediate state that does not build, so it defers those declarations to the step
that also rewrites the bootstrap call. That single decision is why the migration cannot be one pass.

**★ Why does the schematic emit `imports: [NgIf]` rather than `imports: [CommonModule]`?**
Because it resolved the actual template dependency rather than the bundle that happens to contain it,
and the narrow form is the one the compiler can keep honest. NG8113 reports an unused `NgIf` entry; it
cannot report an unused `CommonModule`, because that module counts as used the moment any one of its
many exports is. The narrow import is also what makes a symbol eligible for deferred loading later — a
`@defer` block can only split out a standalone class named directly in the template's dependency list.

**★ Mode 1 moved the declared classes into the module's `imports` array. Why is that the right
intermediate state rather than deleting the module immediately?**
Because at that moment nothing else has changed. Every template that relied on the module's ambient
scope still resolves: the module now *imports* the standalone classes and re-exports them exactly as
before. It is the minimal edit that keeps the application semantically identical while making every
declarable independently usable. Deleting the module in the same pass would break every component that
was relying on transitive visibility, and there would be no build in between to catch it — which is
precisely why "verify that the app works and commit" sits between each mode.

**If mode 1 leaves a deprecated `NgIf` in your imports, is it doing the wrong thing?**
No — it is doing the only correct thing available to it. The template still contains `*ngIf`, and a
template using `*ngIf` needs `NgIf` in scope; emitting `@if` instead would be a second, independent
rewrite with its own failure modes, and Angular ships it as a separate schematic for exactly that
reason. The right reading is that this migration produces *correct v16-era code*, and modernising the
template syntax is a follow-up you choose to run, not something this pass silently folded in.

**Why does mode 1 delete `standalone: false` instead of writing `standalone: true`?**
Because since v19.0.0 the compiler's default *is* standalone, and it reads that default from the
resolved `@angular/core` version. Writing `standalone: true` would be redundant metadata that the CLI
itself stopped generating, and it would leave every file carrying a flag whose only remaining purpose is
to say "the same as the default". Deleting the flag is what makes the file indistinguishable from one
`ng generate component` would produce today.

---

← Prev: [The standalone migration schematic](09-the-standalone-migration-schematic.md) · Index: [Topic index](README.md) · Next → [Mode 2 — prune NgModules](09c-mode-2-prune-ng-modules.md)
