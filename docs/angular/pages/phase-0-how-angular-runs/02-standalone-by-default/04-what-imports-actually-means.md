---
title: "`imports` is the complete list of what a component's template may name — computed by the compiler from that one file, never inherited from a parent and never borrowed from a module somewhere else"
sidebar_label: "04 · What `imports` actually means"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Anatomy of components](https://angular.dev/guide/components/anatomy-of-components) — and `angular/angular` at tag `v22.1.5`: [`packages/core/src/metadata/directives.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/metadata/directives.ts), [`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/scope/src/standalone.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One sentence carries this whole chunk: a standalone component's template may reference
exactly three things — itself, whatever its own `imports` array names, and whatever those
imported NgModules `export`. Nothing else. Not what its parent imports, not what a module
three directories away imports, not what `main.ts` bootstrapped. That list is not a hint to
a bundler and it is not a runtime lookup; `ngtsc` resolves it while type-checking that one
`.ts` file. The `NgModule` compilation scope it replaced worked the opposite way — ambient,
transitive, shared by every class the module declared — and its signature failure was a
component that compiled happily for a year and broke the day somebody moved it into a
different module. This chunk is the declaration and the algorithm; the three that follow are
what you may put in the array, what the compiler and the runtime then do with it, and the
ambient scope it replaced.**

## The declaration, and the three things it already tells you

This is the entire field, verbatim from `packages/core/src/metadata/directives.ts` at
`v22.1.5` — doc comment included, because the comment is the specification:

```ts
/**
 * The imports property specifies the standalone component's template dependencies — those
 * directives, components, and pipes that can be used within its template. Standalone components
 * can import other standalone components, directives, and pipes as well as existing NgModules.
 *
 * This property is only available for standalone components - specifying it for components
 * declared in an NgModule generates a compilation error.
 */
imports?: (Type<any> | ReadonlyArray<any>)[];
```

Three facts fall straight out of that type, and each one settles an argument people have:

1. The element type is `Type<any>` — a **class reference**. Not a string, not a selector, not
   a module specifier. `imports: ['app-avatar']` does not type-check, and there is no
   registry to look a selector up in.
2. The union arm `ReadonlyArray<any>` means **arrays nest**, to arbitrary depth. The compiler
   flattens them recursively, so `imports: [SHARED_UI, RouterLink]` is legal and idiomatic.
3. `imports` exists on `@Component` and on **nothing else**. `@Directive` and `@Pipe` have no
   such field in `directives.ts`, because neither of them has a template, and a template is
   the only thing a template scope could be for.

`schemas` on `@Component` carries the same *"only available for standalone components"*
clause — that is the escape hatch for custom elements, and it is scoped per component for the
same reason `imports` is.

⚠️ Two neighbouring fields are marked `@internal // 3p-only` in v22.1.5 and are **not** for
application code: `deferredImports` (which the framework uses to force a dependency into a
`@defer` chunk) and `foreignImports` (components authored in another framework). If a blog
post tells you to write `deferredImports`, it is describing an internal field. Use `imports`.

## How the scope is actually computed

`StandaloneComponentScopeReader` is the class that answers "what is this component allowed to
reference?". Its own doc comment, verbatim:

> *"Computes scopes for standalone components based on their `imports`, expanding imported
> NgModule scopes where necessary."*

And the loop that does it — quoted from `getScopeForComponent` in
`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts` at `v22.1.5`. This is the single
most load-bearing block in the topic:

```ts
// A standalone component always has itself in scope, so add `clazzMeta` during
// initialization.
const dependencies = new Set<DirectiveMeta | PipeMeta | NgModuleMeta>([clazzMeta]);
const deferredDependencies = new Set<DirectiveMeta | PipeMeta>();
const seen = new Set<ClassDeclaration>([clazz]);
let isPoisoned = clazzMeta.isPoisoned;

if (clazzMeta.imports !== null) {
  for (const ref of clazzMeta.imports) {
    if (seen.has(ref.node)) {
      continue;
    }
    seen.add(ref.node);

    const dirMeta = this.metaReader.getDirectiveMetadata(ref);
    if (dirMeta !== null) {
      dependencies.add({...dirMeta, ref});
      isPoisoned = isPoisoned || dirMeta.isPoisoned || !dirMeta.isStandalone;
      continue;
    }

    const pipeMeta = this.metaReader.getPipeMetadata(ref);
    if (pipeMeta !== null) {
      dependencies.add({...pipeMeta, ref});
      isPoisoned = isPoisoned || !pipeMeta.isStandalone;
      continue;
    }

    const ngModuleMeta = this.metaReader.getNgModuleMetadata(ref);
    if (ngModuleMeta !== null) {
      dependencies.add({...ngModuleMeta, ref});

      let ngModuleScope: ExportScope | null;
      if (ref.node.getSourceFile().isDeclarationFile) {
        ngModuleScope = this.dtsModuleReader.resolve(ref);
      } else {
        ngModuleScope = this.localModuleReader.getScopeOfModule(ref.node);
      }
      if (ngModuleScope === null) {
        // This technically shouldn't happen, but mark the scope as poisoned just in case.
        isPoisoned = true;
        continue;
      }

      isPoisoned = isPoisoned || ngModuleScope.exported.isPoisoned;
      for (const dep of ngModuleScope.exported.dependencies) {
        if (!seen.has(dep.ref.node)) {
          seen.add(dep.ref.node);
          dependencies.add(dep);
        }
      }

      continue;
    }

    // Import was not a component/directive/pipe/NgModule, which is an error and poisons the
    // scope.
    isPoisoned = true;
  }
}
```

Read it once and five rules become obvious:

- **A component is always in its own scope.** `new Set([clazzMeta])`, before the loop runs. A
  recursive component does not import itself, and trying to is a no-op — `seen` already
  contains it.
- **The scope starts empty apart from the component itself.** There is no parent, no
  ancestor chain, no bootstrap-level pool. The word "inherit" does not appear anywhere in
  this file, because there is nothing to inherit from.
- **An imported NgModule contributes `ngModuleScope.exported.dependencies`.** Its *exports*,
  never its *declarations* — the next chunk works that through with code.
- **A module resolved from a `.d.ts` goes through `dtsModuleReader`, one from your own source
  through `localModuleReader`.** Same answer, two readers — which is why importing
  `MatButtonModule` from a published package behaves identically to importing a module you
  wrote this morning.
- **Anything that is not a directive, component, pipe or NgModule sets `isPoisoned`.** So does
  an entry that *is* one of those but is not standalone. A poisoned scope suppresses the
  downstream flood of "unknown element" errors so you get the real diagnostic instead.

🔴 Note what is *not* in that function: any reference to a parent component, an injector, a
route, or the application. The only inputs are the class and its own `imports`. That is the
whole of the locality claim, and it is why "which components can use this directive?" is
answerable by grepping for the class name.

## Gotchas

**★ Symptom: `<app-avatar>` renders fine in `DashboardComponent` and is an unknown element in
`UserCardComponent`, which `DashboardComponent` renders.** Cause: scope is per component and
is not inherited; the parent's `imports` array has no effect on the child's template. Fix: add
it to the child's own array — every component that *writes the tag* imports the class:

```ts
// src/app/users/user-card.component.ts
import {Component, input} from '@angular/core';
import {AvatarComponent} from '../shared/avatar.component';
import type {User} from './user';

@Component({
  selector: 'app-user-card',
  imports: [AvatarComponent],
  template: `<app-avatar [label]="user().fullName" />`,
})
export class UserCardComponent {
  readonly user = input.required<User>();
}
```

**★ Symptom: a recursive tree component seems to need to import itself, and adding it changes
nothing.** Cause: `dependencies` is seeded with `new Set([clazzMeta])` and `seen` with
`new Set([clazz])`, so the self-import is skipped on the first loop iteration. Fix: delete the
self-import; recursion already works:

```ts
// src/app/org/org-node.component.ts
import {Component, input} from '@angular/core';

export interface OrgUnit {
  name: string;
  children: OrgUnit[];
}

@Component({
  selector: 'app-org-node',
  imports: [],
  template: `
    <span>{{ unit().name }}</span>
    @for (child of unit().children; track child.name) {
      <app-org-node [unit]="child" />
    }
  `,
})
export class OrgNodeComponent {
  readonly unit = input.required<OrgUnit>();
}
```

**★ Symptom: two components live in the same `.ts` file and one still cannot render the
other.** Cause: file membership is not a scope. `getScopeForComponent` reads `clazzMeta.imports`
and nothing about the source file. Fix: import it explicitly, exactly as you would across
files — `imports: [SidebarComponent]`.

**★ Symptom: TypeScript rejects `imports` on a `@Directive` or a `@Pipe`.** Cause: the field
does not exist on those interfaces — only components have templates. Fix: nothing to move; a
directive's collaborators come from DI, and a directive that needs to *compose* other
directives uses `hostDirectives`, not `imports`.

**★ Symptom: you added `imports` to a component that has `standalone: false`.** Cause: the doc
comment on the field is explicit — *"specifying it for components declared in an NgModule
generates a compilation error"*. Fix: delete `standalone: false` and remove the class from its
module's `declarations`; the version history behind that flag is
[03 · Which version changed what](03-standalone-by-default-which-version-changed-what.md), and
the diagnostic itself is **05 · Unused imports and the compiler diagnostics**
*(not written yet)*.

**★ Symptom: one bad entry in `imports` and the template reports a dozen unrelated unknown
elements.** Cause: `isPoisoned` — a non-standalone or non-Angular entry marks the whole scope
poisoned. Fix: read the *first* diagnostic, not the flood; poisoning exists precisely so the
real error is the one that matters. Make the offending class standalone, or import its
declaring module instead of the class.

## Interview questions

**★ Why can a child component not use a directive its parent imported?**
Because the scope is computed per component, from that component's own metadata, and the
algorithm never walks upward. `StandaloneComponentScopeReader.getScopeForComponent` seeds the
dependency set with the component itself and then iterates only `clazzMeta.imports`. There is
no parent reference in that function to walk. Practically: every component that writes a tag,
an attribute or a pipe name is the file that must import the class.

**★ What does "the scope is poisoned" mean, and why does the compiler bother?**
`isPoisoned` is set when an entry in `imports` is not a directive, component, pipe or
NgModule, or is one of those but is not standalone. A poisoned scope tells the template
type-checker not to report every consequential unknown-element and unknown-property error, so
the one diagnostic that names the real cause is not buried under twenty that do not. It is an
error-quality mechanism, not a failure mode.

**★ Does a recursive component need to import itself?**
No. `dependencies` is initialised with the component's own metadata and `seen` with its own
class declaration, so a self-import is skipped before anything else happens. The comment in
the source says it outright: *"A standalone component always has itself in scope"*.

**Why do `@Directive` and `@Pipe` have no `imports` field?**
Because `imports` is a *template* dependency list and neither has a template. A directive that
needs to compose behaviour from other directives uses `hostDirectives`; everything else it
needs arrives through dependency injection.

**Does it matter whether the imported class is in the same file, the same folder, or a
published package?**
Only for one detail: a module reaching the compiler through a `.d.ts` is resolved by
`dtsModuleReader` and one from your own sources by `localModuleReader`. The resulting scope is
the same either way, and for plain components, directives and pipes there is no branch at all —
the reference is the reference.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → [What goes in the array](04b-what-goes-in-the-imports-array.md)
