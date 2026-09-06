---
title: "Mode 2 deletes classes, and its five removal criteria are best read backwards — as the checklist explaining why your module is still there"
sidebar_label: "09c · Mode 2 — prune NgModules"
sidebar_position: 9.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Migrate to standalone](https://angular.dev/reference/migrations/standalone)
> — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/ng-generate/standalone-migration/README.md`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/README.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Mode 2 is the only destructive pass — it deletes whole files. It removes an `NgModule` only when the
class passes all five of a published removability test, and it removes references to that module only
where the reference has an unambiguous meaning: an entry in another module's `imports`, an export in a
barrel. Anywhere else it declines and leaves a `TODO(standalone-migration)` comment instead, because
deleting an arbitrary statement is not a safe transformation. Removability is transitive in the negative
direction, so one stubborn module can protect a dozen above it and a second run after a manual fix will
remove more than the first. And the pass does not tidy: an emptied `imports: []` stays exactly where it
was.**

## The five criteria, verbatim

Identical wording in the schematic's `README.md` and on angular.dev:

> *"A module is considered "safe to remove" if it: Has no `declarations`. Has no `providers`. Has no
> `bootstrap` components. Has no `imports` that reference a `ModuleWithProviders` symbol or a module
> that can't be removed. Has no class members. Empty constructors are ignored."*

Read backwards, that is a complete diagnostic for a module that survived:

| It still has | So it survived because | The manual move |
|---|---|---|
| `declarations` | mode 1 skipped it — almost always the root module, which mode 1 ignores by design | run mode 3; it converts those declarations |
| `providers` | it is a DI host, not just a scope | move the token to `providedIn: 'root'`, a route's `providers`, or `bootstrapApplication` |
| `bootstrap` | it is the root module | run mode 3 |
| an `imports` entry returning `ModuleWithProviders` | almost always `RouterModule.forRoot(routes)` or an equivalent `forRoot` | replace with `provideRouter(routes)` in the composition root |
| an `imports` entry naming an unremovable module | transitivity — the blocker is elsewhere | fix the blocker, re-run mode 2 |
| a class member | it has behaviour somebody wrote on purpose | move the behaviour out, then re-run |

An **empty** constructor is explicitly forgiven, so a module whose only member is
`constructor() {}` still qualifies for removal. A constructor with a parameter does not — an injected
dependency in a module constructor is a real side effect (it forces instantiation of that dependency),
and the schematic will not delete code with behaviour.

## What it actually does to a file, in three different ways

The README's own worked example is unusually good, because it shows all three outcomes at once:

```typescript
// BEFORE — importer.module.ts
@NgModule({
  imports: [FooComp, BarPipe],
  exports: [FooComp, BarPipe],
})
export class ImporterModule {}
```

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
// BEFORE — index.ts
export {ImporterModule, ConfigurerModule} from './modules/index';
```

```typescript
// AFTER — importer.module.ts
// Deleted!
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

```typescript
// AFTER — index.ts
export {ConfigurerModule} from './modules/index';
```

Three outcomes, and the difference between them is the whole design of this mode:

- **`ImporterModule` was deleted outright** — file and all. It declared nothing, provided nothing,
  bootstrapped nothing, imported only standalone classes, and had no members. Five for five.
- **The barrel re-export was rewritten.** `export {X, Y} from './z'` has exactly one possible meaning, so
  dropping one name from it is a safe mechanical edit.
- **The `console.log` was annotated and left alone.** An arbitrary expression could be anything, so the
  schematic converts an unsafe automated deletion into a safe, greppable human task.
- **`ConfigurerModule` survived** on criterion two — a single `{provide: FOO, useValue: 123}`. Note that
  its now-pointless `imports: []` and `exports: []` were left in place. The pass removes references; it
  does not tidy metadata.

🔴 **The marker string is fixed and greppable, and it is the only report this mode produces.** Run this
after every mode-2 invocation — it is your entire work queue:

```bash
grep -rn 'TODO(standalone-migration)' src/
```

## Gotchas

**★ Symptom: a module you expected to disappear is still there after mode 2, and nothing tells you
why.** Cause: it fails one of the five criteria — most often a lone `providers` entry, a single class
member, or an import of something returning a `ModuleWithProviders` such as `RouterModule.forRoot()`.
Fix: remove the disqualifier by hand and re-run. For a provider, the cheapest move is to put the scope
on the service itself so the module has nothing left to host:

```ts
// BEFORE — analytics.module.ts survives mode 2 because of this one line
@NgModule({imports: [], providers: [{provide: AnalyticsClient, useClass: SegmentClient}]})
export class AnalyticsModule {}

// AFTER — nothing declared, nothing provided, module now qualifies for removal
@Injectable({providedIn: 'root', useClass: SegmentClient})
export abstract class AnalyticsClient {
  abstract track(event: string, payload: Record<string, unknown>): void;
}
```

**★ Symptom: `ng lint` fails after mode 2 with an unused-variable error naming a module that no longer
exists on disk.** Cause: the schematic could not statically delete an arbitrary reference to a module it
removed, so it annotated it instead — the code still compiles, but the `import` is now dangling. Fix:
grep the marker and delete the dead statement together with its import:

```bash
grep -rn 'TODO(standalone-migration)' src/
```

```ts
// BEFORE
import {ImporterModule} from './importer.module';
console.log(
  /* TODO(standalone-migration): clean up removed NgModule reference manually */ ImporterModule,
);

// AFTER — both lines deleted
```

**★ Symptom: a second identical mode-2 run removes modules the first run left behind, which looks like
non-determinism.** Cause: it is transitivity, not randomness. The fourth criterion is *"Has no `imports`
that reference a `ModuleWithProviders` symbol or a module that can't be removed"* — so a module blocked
only by an unremovable dependency becomes removable the moment that dependency goes. Fix: treat it as a
fixed-point process: run, clear the blockers you can, run again, until a run changes nothing.

```bash
ng generate @angular/core:standalone --mode=prune-ng-modules
grep -rln '@NgModule' src/          # the survivors, to check against the five criteria
# fix blockers by hand, then:
ng generate @angular/core:standalone --mode=prune-ng-modules
```

**★ Symptom: you cannot tell whether mode 2 will delete a feature module reached only through a
`loadChildren` dynamic import.** Cause: a route table is data, and a dynamic import is a string path
plus a property access rather than a static class reference. ⚠️ **The documentation does not state how
mode 2 treats a module referenced only from a dynamic import** — it documents path adjustment for mode
3, not reference-finding for mode 2. What is documented is criterion four, and in practice a lazy
feature module imports `RouterModule.forChild(routes)`, which returns a `ModuleWithProviders` and
disqualifies it, so it survives. Fix: verify rather than assume — after every mode-2 run, list your
dynamic imports and confirm each target still exists:

```bash
grep -rn "loadChildren" src/ | grep "import("
ls src/app/admin/admin.module.ts        # every target named above must still be there
```

The durable fix is to stop routing through a module at all — convert the lazy boundary to routes:

```ts
// BEFORE
{path: 'admin', loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)}

// AFTER — admin.routes.ts exports `export const ADMIN_ROUTES: Routes = [...]`
{path: 'admin', loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES)}
```

**Symptom: a module's `imports: []` and `exports: []` are left behind as empty arrays.** Cause: the pass
removes references to deleted modules but does not delete a metadata key that is now empty. Fix:
harmless, but delete them by hand — an empty `exports` on a surviving module is a strong hint that the
module is one manual fix away from being removable itself:

```ts
// BEFORE
@NgModule({imports: [], exports: [], providers: [{provide: FOO, useValue: 123}]})
export class ConfigurerModule {}

// AFTER — and now the provider is the only thing standing between it and deletion
@NgModule({providers: [{provide: FOO, useValue: 123}]})
export class ConfigurerModule {}
```

**Symptom: a third-party library's `NgModule` was not removed.** Cause: the schematic migrates *your*
source, determined from your `tsconfig.json` files. `node_modules` is not yours to rewrite. Fix: nothing
here — that is correct behaviour. Where the library also ships standalone classes, importing those
directly instead of the module is a manual improvement covered in
**11 · Where `NgModule` still legitimately appears** *(not written yet)*.

**Symptom: a module survived and you cannot see any of the five disqualifiers in the file.** Cause: the
disqualifier can be inherited through the `imports` chain, which is not visible in the file itself, or
the module is referenced from a file the schematic could not analyse. Fix: walk the chain explicitly,
starting from the module's own `imports`, and check each one against the criteria:

```bash
grep -rln '@NgModule' src/                    # every survivor
grep -rn 'forRoot\|ModuleWithProviders' src/  # the usual root cause of the fourth criterion
```

## Interview questions

**★ A module survived `prune-ng-modules`. What does that tell you, precisely?**
That it fails at least one of five conditions: it still declares something, it provides something, it
bootstraps something, it imports a `ModuleWithProviders` or another unremovable module, or its class has
a member — an empty constructor being explicitly forgiven. Each points at different work. Surviving
declarations mean mode 1 skipped it, which almost always means it is the root module and mode 3 will
handle it. A provider means you have a real DI decision about where that token should live. A
`ModuleWithProviders` import is usually `RouterModule.forRoot` and points straight at `provideRouter`.

**★ Why does mode 2 leave a comment instead of deleting a reference it knows is dead?**
Because deleting an arbitrary statement is not a safe transformation. The schematic knows
`ImporterModule` was removed, but it does not know what the surrounding expression was for — the
reference might sit inside a conditional, a test fixture, a feature flag, or a debugging `console.log`.
Emitting the `TODO(standalone-migration)` marker keeps the code compiling and converts an unsafe
automated edit into a safe, greppable human task. The same reasoning explains why it *does* rewrite a
barrel re-export: `export {X} from './y'` has exactly one meaning, so it can be transformed with
confidence.

**★ Why is "has no class members" a removal criterion at all — the class is about to be deleted
anyway?**
Because a member is evidence that somebody wrote code with behaviour on that class, and behaviour cannot
be deleted safely. A `static forRoot()` returning a `ModuleWithProviders`, a constructor that injects a
service purely to force its instantiation, a field holding configuration — each of those does something
that would silently stop happening. An *empty* constructor carries no behaviour and is usually a
generator artifact, which is why it is the one member explicitly forgiven. The criterion is a proxy for
"does deleting this class lose anything?", and it deliberately errs toward keeping.

**Why is removability transitive, and what does that mean for how you run the pass?**
Because a module that imports an unremovable module might be the only thing keeping that module's
exports in scope for something else, so deleting it could change what resolves. The practical
consequence is that mode 2 is not a single pass but a fixed-point computation with you in the loop: each
manual fix — hoisting a provider, replacing a `forRoot` with a `provide*` function, moving a method off
a module class — can unblock a whole subtree above it. Run it, fix blockers, run it again, and stop when
a run changes nothing.

**Is mode 2 the destructive one? What is your recovery if it deletes something it should not have?**
Yes — it is the only mode that deletes files, and there is no undo inside the schematic. Recovery is
entirely `git`: the documented prerequisite of a clean branch exists so that `git diff` and
`git checkout -- <path>` are available, and the documented instruction to commit between steps exists so
that reverting mode 2 does not also revert mode 1. If you ran all three modes and committed once, your
only recovery is to reset the branch and start over.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **10 · Why standalone makes the graph splittable** *(not written yet)*
