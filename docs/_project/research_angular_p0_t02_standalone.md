---
name: research-angular-p0-02-standalone-by-default
description: Banked primary-source research for Angular Phase 0 topic 02-standalone-by-default — verbatim quotes and URLs for every remaining chunk.
metadata:
  type: reference
---

# Research bank — Angular Phase 0, topic `02-standalone-by-default`

**Banked 2026-09-06.** Everything below was read from a primary source at **`@angular/core` 22.1.5**
(`angular/angular` tag `v22.1.5`), `@angular/cli` / `@schematics/angular` **22.1.7**
(`angular/angular-cli` tag `v22.1.7`), the npm registry, or angular.dev's own markdown source
(`adev/src/content/**` at `v22.1.5`, which is exactly what the published site renders).

🔴 **No sandbox was used. Nothing here was run.** Every code block is *source read from a file*,
never program output. If a chunk wants to claim a bundle size, a timing, or a terminal transcript,
it must not — that claim is not in this bank and cannot be made.

## How to read this bank

- **§0** is the shared spine — read it whichever chunk you are writing.
- **§1–§8** map to chunks 04–11 in the topic `README.md` chunk table. Jump to yours.
- **§9** lists every place angular.dev and the v22.1.5 source disagree. 🔴 **The source wins, and the
  page must say so** when the disagreement is relevant.
- **§10** lists what could not be settled. Write those as *"the documentation does not state whether X"*
  or leave them out. Never guess.
- **§11** is the source-file inventory with reproducible fetch commands and URLs for `> Verified:` lines.

## How to re-read any file cited here

🔴 `raw.githubusercontent.com` 404s in this environment. Repo tags on `angular/angular` carry a `v`
prefix **from v16 onward**; older tags (`13.4.0`, `14.3.0`, `15.2.10`) do **not**.
`angular/angular-cli` tags carry the `v` prefix.

```bash
# preferred — works for files of any size, no base64 step
gh api -H "Accept: application/vnd.github.raw" \
  "repos/angular/angular/contents/<path>?ref=v22.1.5"

# also works, but returns empty content for large files
gh api "repos/angular/angular/contents/<path>?ref=v22.1.5" -q .content | base64 -d
```

---

## §0 · Facts every chunk needs

### 0.1 The version spine (re-measured 2026-09-06 from `registry.npmjs.org`)

| | |
|---|---|
| `@angular/core` `latest` | **22.1.5**, published **2026-09-03T02:38:10Z** |
| `@angular/core` `next` | 22.2.0-next.5 |
| `@angular/cli` · `@angular/build` · `@angular/ssr` | **22.1.7** |
| `@angular/material` · `@angular/cdk` · `@angular/animations` · `@angular/upgrade` · `@angular/platform-browser-dynamic` | **22.1.5** |
| `@angular/core@22.1.5` peers | `rxjs: ^6.5.3 \|\| ^7.4.0` · `zone.js: ~0.15.0 \|\| ~0.16.0` · `@angular/compiler: 22.1.5` |
| TypeScript peer | `>=6.0 <6.1` (hard pin — Angular 22 does **not** run on TS 5.x) |
| Node engines | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| LTS | v21 → 21.2.22 · v20 → 20.3.30 · v19 out of support at 19.2.25 |

Every `> Verified:` line in this topic should carry:
`Version spine: **Angular 22.1.5** · CLI / @angular/build / @angular/ssr **22.1.7** · TypeScript peer >=6.0 <6.1.`

### 0.2 The single sentence the whole topic turns on

**A standalone component's template can reference exactly three things: itself, whatever its own
`imports` array names, and whatever those imported NgModules `export`.** Nothing else. Not what the
parent imports, not what some module elsewhere imports. This is enforced by
`StandaloneComponentScopeReader`, and the code is quoted in §1.3.

### 0.3 What is NOT deprecated in v22.1.5 (do not claim otherwise)

Read directly from the v22.1.5 typings — **no `@deprecated` tag** on any of these:

- `@NgModule` the decorator, and every field it still has (`declarations`, `imports`, `exports`,
  `providers`, `bootstrap`, `schemas`, `id`, `jit`).
- `standalone: true` and `standalone: false` on `@Component` / `@Directive` / `@Pipe`.
- `platformBrowser().bootstrapModule(...)`.
- `importProvidersFrom()`, `createNgModule()`, `isStandalone()`.
- `NgClass` and `NgStyle` — **not** deprecated in 22.1.5, despite the `ngclass-to-class` and
  `ngstyle-to-style` schematics existing. 🔴 Do not write that they are.
- `CommonModule` itself.
- `UpgradeModule` in `@angular/upgrade/static`.

**What IS deprecated and relevant here:**

- `@angular/platform-browser-dynamic` — every entry point, since **v20.0.0**. The v22.1.5 public-API
  golden marks both exports: `// @public @deprecated (undocumented) export const platformBrowserDynamic`
  and `// @public @deprecated (undocumented) export class JitCompilerFactory`. Still **published at
  22.1.5**. (`goldens/public-api/platform-browser-dynamic/index.api.md`)
- `NgIf` / `NgFor` / `NgSwitch` — deprecated **20.0**, verbatim from
  `packages/common/src/directives/ng_if.ts`:
  > *"@deprecated 20.0 Use the `@if` block instead. Intent to remove in a future major release"*
- `@Component.animations` — *"@deprecated 20.2 Use `animate.enter` or `animate.leave` instead. Intent
  to remove in v23"* (`packages/core/src/metadata/directives.ts`).

### 0.4 What the v22 CLI actually generates (`@schematics/angular` 22.1.7)

`ng generate component` — note it emits `imports: []` and **never** emits `standalone: true`
(`packages/schematics/angular/component/files/__name@dasherize@if-flat__/__name@dasherize__.__type@dasherize__.ts.template`):

```ts
// EJS template, verbatim from the schematic
@Component({<% if (changeDetection !== 'OnPush') { %>
  changeDetection: ChangeDetectionStrategy.<%= changeDetection %>,<% } %><% if (!!viewEncapsulation) { %>
  encapsulation: ViewEncapsulation.<%= viewEncapsulation %>,<% } %><% if (standalone) { %>
  imports: [],<% } %><% if (!skipSelector) { %>
  selector: '<%= selector %>',<% } %><% if (!standalone) { %>
  standalone: false,<% } %>
```

So: `ng g c foo` → `imports: []`. `ng g c foo --standalone=false` → `standalone: false` and **no**
`imports` key at all (because `imports` on a non-standalone component is NG2010 — §2.2).

`ng new` tsconfig (`packages/schematics/angular/workspace/files/tsconfig.json.template`) writes
`"strictTemplates": false` **only in the non-strict branch** — because in v22 `strictTemplates` is
already `true` by default (§0.5).

### 0.5 🔴 `strictTemplates` defaults to `true` in v22

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`, verbatim including the comment:

```ts
/**
 * strictTemplate is `true` by default.
 * Explicit opt-out is required to disable strictness
 */
private get strictTemplates(): boolean {
  return this.options.strictTemplates !== false;
}
```

angular.dev agrees (`reference/configs/angular-compiler-options`, `### strictTemplates`):
> *"Default is `true`."*

This matters to chunks 05 and 06: the "you must turn on `strictTemplates` first" advice that fills the
internet is v19-era. It is on unless you turned it off.

### 0.6 🔴 How an Angular error code becomes `NGxxxx` — and what a *negative* enum value means

`packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts`, verbatim:

```ts
export function ngErrorCode(code: ErrorCode): number {
  const absoluteCode = Math.abs(code);
  return -(ERROR_CODE_MARKER * 10 ** decimalDigits(absoluteCode) + absoluteCode);
}
```

with the explaining comment, verbatim:

> *"During formatting of `ts.Diagnostic`s, the numeric code of each diagnostic is prefixed with the
> hard-coded "TS" prefix. For Angular's own error codes, a prefix of "NG" is desirable. To achieve
> this, all Angular error codes start with "-99" so that the sequence "TS-99" can be assumed to
> correspond with an Angular specific error code."*

🔴 **A negative value in the `ErrorCode` enum does NOT mean "warning".** It means the code has an
associated **error guide page** on angular.dev. From the same file:

```ts
/**
 * Given a raw TypeScript diagnostic code, returns the corresponding {@link ErrorCode} if it is a
 * negative Angular error code that has an associated error guide, or `null` otherwise.
 */
export function errorCodeWithGuideFromDiagnosticCode(code: number): ErrorCode | null { /* ... */ }
```

That is why `SCHEMA_INVALID_ELEMENT = -8001` (has `angular.dev/errors/NG8001`) is negative while
`UNUSED_STANDALONE_IMPORTS = 8113` (whose page lives under the *extended-diagnostics* family, not
*errors*) is positive. **Severity is decided elsewhere** — see §2.1. Do not infer severity from sign.

**Runtime** codes are a different table entirely (`packages/core/src/errors.ts`). Its header comment
splits ranges per package: *"core (this package): 100-999 · forms: 1000-1999 · common: 2000-2999 ·
animations: 3000-3999 · router: 4000-4999 · platform-browser: 5000-5500 · service-worker: 5600-5699 ·
platform-server: 5700-5800"*.

### 0.7 The `standalone` field, verbatim from v22.1.5

`packages/core/src/metadata/directives.ts`:

```ts
/**
 * Set `standalone` to `false` if you want to import the directive into an NgModule.
 */
standalone?: boolean;
```

### 0.8 Do not re-derive the version history

Chunk **03** (`03-standalone-by-default-which-version-changed-what.md`, already on disk) owns the
timeline, `NgCompiler.implicitStandaloneValue`, `strictStandalone`, NG2023, `isStandalone()` and the
`explicit-standalone-flag` migration. **Link to it; do not repeat it.** The facts it fixes, which
nothing else in this topic may contradict:

- v14.0.0 introduced standalone (developer preview on the field in the 14.3.0 typings).
- v15 dropped the `@developerPreview` tag. **No changelog sentence announces v15 stability.**
- **v19.0.0 flipped the default and stripped the boilerplate.** Not v20.
- v20.0.0 changed **nothing** about `standalone`; it deprecated `@angular/platform-browser-dynamic`
  and `ngIf`/`ngFor`/`ngSwitch`.
- v22.0.0 removed `createNgModuleRef`, `ComponentFactory`, `ComponentFactoryResolver`.
- `standalone: true` is redundant but **not deprecated** in 22.1.5.

New dates this bank adds that chunk 03 does not carry, safe to use:

| Thing | First shipped in | Evidence |
|---|---|---|
| NG8113 `unusedStandaloneImports` | **19.0.0** | `unused_standalone_imports_rule.ts` is 404 at tag `18.2.14`, present at `19.0.0` |
| `ng g @angular/core:cleanup-unused-imports` | **19.1.0** | absent from `collection.json` at `19.0.0`, present at `19.1.0` |
| `ng g @angular/core:common-to-standalone` | **21.0.0** | absent at `20.0.0`, present at `21.0.0` |
| `entryComponents` removed | **16.0.0** | present in `ng_module.ts` at `15.2.10`, absent at `16.2.12`; v16.0.0 release notes confirm |

---

## §1 · Chunk 04 — "What `imports` actually means"

*(planned file `04-what-imports-actually-means.md`, `sidebar_position: 4`)*

### 1.1 The exact declared type, and the doc comment that comes with it

`packages/core/src/metadata/directives.ts` at `v22.1.5`, verbatim — this is the whole declaration:

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

Three things worth saying on the page, all readable straight off that type:

1. It is `(Type<any> | ReadonlyArray<any>)[]` — **arrays nest**, arbitrarily deep, and the compiler
   flattens them (§1.5). `imports: [SHARED_UI, RouterLink]` is legal.
2. It is `Type<any>`, i.e. **class references**, not strings and not selectors.
3. `@Directive` and `@Pipe` **do not have** an `imports` field. Only `@Component` does — because only a
   component has a template. (Verified: `imports` appears in `directives.ts` only inside the
   `Component` interface.)

The sibling fields on `@Component` that behave the same way:

```ts
/**
 * The set of schemas that declare elements to be allowed in a standalone component. Elements and
 * properties that are neither Angular components nor directives must be declared in a schema.
 *
 * This property is only available for standalone components - specifying it for components
 * declared in an NgModule generates a compilation error.
 */
schemas?: SchemaMetadata[];
```

```ts
/**
 * The `deferredImports` property specifies a standalone component's template dependencies,
 * which should be defer-loaded as a part of the `@defer` block. Angular *always* generates
 * dynamic imports for such symbols and removes the regular/eager import. Make sure that imports
 * which bring symbols used in the `deferredImports` don't contain other symbols.
 *
 * Note: this is an internal-only field, use regular `@Component.imports` field instead.
 * @internal // 3p-only
 */
deferredImports?: (Type<any> | ReadonlyArray<any>)[];
```

⚠️ `deferredImports` is **`@internal`** in v22.1.5. It is real, it has its own diagnostics
(NG2022, NG8012, NG8013, NG8014), and it is **not for application authors**. Mention it as internal or
not at all. `foreignImports` (components from other frameworks) is likewise `@internal // 3p-only`.

### 1.2 angular.dev's own framing, verbatim

`adev/src/content/guide/components/anatomy-of-components.md` → https://angular.dev/guide/components/anatomy-of-components

> *"To use a component, [directive](guide/directives), or [pipe](guide/templates/pipes), you must add
> it to the `imports` array in the `@Component` decorator"*

> *"By default, Angular components are _standalone_, meaning that you can directly add them to the
> `imports` array of other components. Components created with an earlier version of Angular may
> instead specify `standalone: false` in their `@Component` decorator. For these components, you
> instead import the `NgModule` in which the component is defined."*

> *"IMPORTANT: In Angular versions before 19.0.0, the `standalone` option defaults to `false`."*

### 1.3 🔴 The mechanism — `StandaloneComponentScopeReader`

`packages/compiler-cli/src/ngtsc/scope/src/standalone.ts` at `v22.1.5`. Class doc, verbatim:

> *"Computes scopes for standalone components based on their `imports`, expanding imported NgModule
> scopes where necessary."*

The body, verbatim and load-bearing (this is the single best code block for this chunk):

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
      // ... resolve the module's export scope ...
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

Four facts fall straight out of that, and every one of them is a page-worthy claim:

1. **A component is always in its own scope.** `new Set([clazzMeta])`. This is why a recursive
   component (a tree node rendering itself) does **not** import itself, and why trying to is a no-op
   — `seen` already contains it.
2. **Importing an NgModule flattens in that module's `exported` dependencies, not its
   `declarations`.** Whatever the module does not export, you do not get.
3. **The flattening is one level of `imports`, but the NgModule side is already transitive** —
   `ngModuleScope.exported.dependencies` is the module's own fully-resolved export scope. Importing
   `MatButtonModule` gets you everything `MatButtonModule` exports, including what it re-exports.
4. **A non-standalone entry poisons the scope**, which is why NG2011 (§2.3) suppresses the flood of
   downstream template errors rather than adding to it.

### 1.4 🔴 `imports` carries *providers* too — the standalone injector

This is the fact most pages miss. `packages/core/src/render3/standalone_service.ts`, class doc verbatim:

> *"A service used by the framework to create instances of standalone injectors. Those injectors are
> created on demand in case of dynamic component instantiation and contain ambient providers
> collected from the imports graph rooted at a given standalone component."*

```ts
export class StandaloneService implements OnDestroy {
  cachedInjectors = new Map<ComponentDef<unknown>, EnvironmentInjector | null>();

  constructor(private _injector: EnvironmentInjector) {}

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
  // ...
}
```

and the hook that installs it, `packages/core/src/render3/definition.ts`:

```ts
getStandaloneInjector: baseDef.standalone
  ? (parentInjector: EnvironmentInjector) => {
      return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(def);
    }
  : null,
```

Consequences to write up:

- `imports: [SomeLibraryModule]` on a *nested* component installs that module's providers into a
  **new environment injector**, created lazily, cached **per `ComponentDef`** — i.e. one per component
  *class*, not per instance, and destroyed with the parent environment injector.
- Because the cache key is the `ComponentDef`, two components each importing the same module get
  **two** injectors, each with its own instance of that module's providers. That is a real
  double-instantiation trap and belongs in Gotchas.
- Providers reached this way are **not** in the root injector, so a sibling component that did not
  import the module cannot inject them.

### 1.5 What the compiler will and will not accept in the array

`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`,
`validateAndFlattenComponentImports`. Verbatim messages:

```ts
const errorMessage = isDeferred
  ? `'deferredImports' must be an array of components, directives, or pipes.`
  : `'imports' must be an array of components, directives, pipes, or NgModules.`;
```

and, from `packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`, the resolvers that
run over the array before it is evaluated:

```ts
const importResolvers = combineResolvers([
  createModuleWithProvidersResolver(this.reflector, this.isCore),
  createForwardRefResolver(this.isCore),
]);
```

So the array **is** evaluated by the static evaluator, with two special resolvers, which means:

- ✅ `imports: [ChildComponent]`
- ✅ `imports: [SHARED_DIRECTIVES, RouterLink]` where `SHARED_DIRECTIVES` is a statically resolvable
  array — flattened recursively by `validateAndFlattenComponentImports`.
- ✅ `imports: [forwardRef(() => ChildComponent)]` — `createForwardRefResolver` exists for exactly this,
  and it is how you break a circular file reference between two components.
- ❌ anything the partial evaluator cannot resolve at build time (a value from a function call, a
  computed key, an import from outside the compilation unit). It is `ngtsc` reading your `.ts` file,
  not runtime code.

### 1.6 🔴 What the compiler *emits* — the answer to "does an unused import cost anything?"

`handler.ts`, `componentDependenciesToDeclarations`, verbatim:

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
      // ... emit it ...
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

🔴 **Read the asymmetry.** A directive or pipe that the template does not use is `continue`d — it never
reaches the emitted `ɵcmp`. An **NgModule** in `imports` has **no such filter**: it is emitted
unconditionally, because its providers must still be collected (§1.4).

This is the honest, source-backed version of "unused imports cost you something":

- an unused **standalone directive/pipe** import costs a compiler diagnostic (NG8113) and the ES import
  statement in your `.ts`, but produces no entry in the component definition;
- an unused **NgModule** import always produces a reference to the module class.

⛔ Do **not** turn this into a bundle-size number. There is no sandbox and no measurement.

### 1.7 The runtime side, for a page that wants to close the loop

`packages/core/src/render3/deps_tracker/deps_tracker.ts` — this path is JIT/local-compilation, but it
is the clearest statement of the two models side by side:

```ts
getComponentDependencies(
  type: ComponentType<any>,
  rawImports?: RawScopeInfoFromDecorator[],
): ComponentDependencies {
  this.resolveNgModulesDecls();

  const def = getComponentDef(type);
  // ...
  if (def.standalone) {
    const scope = this.getStandaloneComponentScope(type, rawImports);
    if (scope.compilation.isPoisoned) {
      return {dependencies: []};
    }
    return {
      dependencies: [
        ...scope.compilation.directives,
        ...scope.compilation.pipes,
        ...scope.compilation.ngModules,
      ],
    };
  } else {
    if (!this.ownerNgModule.has(type)) {
      // This component is orphan! No need to handle the error since the component rendering
      // pipeline (e.g., view_container_ref) will check for this error based on configs.
      return {dependencies: []};
    }
    // ...
  }
}
```

A standalone component **carries** its dependency list. A non-standalone one **looks its owner up in a
`WeakMap`** (`ownerNgModule`) that is only populated once the declaring module has been loaded. That
lookup is the whole of the difference, and it is what produces the orphan error in §6.4.

### 1.8 The comparison — the ambient `NgModule` scope `imports` replaced

angular.dev `guide/ngmodules/overview` → https://angular.dev/guide/ngmodules/overview. Verbatim:

> *"An NgModule has two main responsibilities: Declaring components, directives, and pipes that belong
> to the NgModule · Add providers to the injector for components, directives, and pipes that import the
> NgModule"*

> *"The `declarations` property of the `@NgModule` metadata declares the components, directives, and
> pipes that belong to the NgModule."*

> *"Components declared in an NgModule may depend on other components, directives, and pipes. Add these
> dependencies to the `imports` property of the `@NgModule` metadata."*

> *"An NgModule can _export_ its declared components, directives, and pipes such that they're available
> to other components and NgModules."*

> *"The `exports` property is not limited to declarations, however. An NgModule can also export any
> other components, directives, pipes, and NgModules that it imports."*

> *"If Angular discovers any components, directives, or pipes declared in more than one NgModule, it
> reports an error."*

> *"When you bootstrap an application from an NgModule, the collected `providers` of this module and all
> of the `providers` of its `imports` are eagerly loaded and available to inject for the entire
> application."*

That last sentence is the whole contrast in one line: **module providers are collected eagerly and
apply application-wide; a component's `imports` apply to that component.**

### 1.9 Gotcha material for this chunk

- Two components each importing the same providers-carrying NgModule ⇒ two standalone injectors,
  two service instances (§1.4).
- A recursive component that "must import itself" — it must not; it is already in its own scope (§1.3).
- Importing an NgModule gives you only what it **exports**, never what it merely declares (§1.3, §1.8).
- `imports` on `@Directive` / `@Pipe` does not exist — the type has no such field (§1.1).
- A non-statically-analysable `imports` array fails at build time, not at runtime (§1.5).
- `imports: [SomeModule.forRoot()]` is NG2012 with a bespoke message (§2.4) — belongs in chunk 05 or 08,
  cross-link rather than duplicate.

---

## §2 · Chunk 05 — "Unused imports and the compiler diagnostics"

*(planned file `05-unused-imports-and-the-compiler-diagnostics.md`, `sidebar_position: 5`)*

### 2.1 🔴 NG8113 is a **WARNING** by default — settled, with the line that settles it

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`, `getTypeCheckingConfig()`. The line appears
**twice**, once in the `strictTemplates` branch and once in the non-strict branch, identically:

```ts
unusedStandaloneImports:
  this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
```

and the only override:

```ts
if (this.options.extendedDiagnostics?.checks?.unusedStandaloneImports !== undefined) {
  typeCheckingConfig.unusedStandaloneImports =
    this.options.extendedDiagnostics.checks.unusedStandaloneImports;
}
```

The rule then turns that label into a TypeScript diagnostic category
(`packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts`):

```ts
const category =
  this.typeCheckingConfig.unusedStandaloneImports === 'error'
    ? ts.DiagnosticCategory.Error
    : ts.DiagnosticCategory.Warning;
```

angular.dev's extended-diagnostics overview says the same thing about the whole family
(`adev/src/content/reference/extended-diagnostics/overview.md` → https://angular.dev/extended-diagnostics):

> *"Extended diagnostics are warnings by default and do not block compilation."*

> *"`warning` | Default - The compiler emits the diagnostic as a warning but does not block
> compilation. The compiler will still exist with status code 0, even if warnings are emitted."*

(The typo *"will still exist"* for *"will still exit"* is upstream. If you quote that row, quote it as
written or trim to the first clause.)

> *"`error` | The compiler emits the diagnostic as an error and fails the compilation. The compiler will
> exit with a non-zero status code if one or more errors are emitted."*

> *"`suppress` | The compiler does _not_ emit the diagnostic at all."*

> *"The `defaultCategory` field is used for any diagnostics that are not explicitly listed under
> `checks`. If not set, such diagnostics will be treated as `warning`."*

And the semver note, which is the reason not to set `defaultCategory: "error"` casually:

> *"The Angular team intends to add or enable new extended diagnostics in **minor** versions of Angular
> […] This means that upgrading Angular may show new warnings in your existing codebase."*

> *"However, setting `"defaultCategory": "error"` will promote such warnings to hard errors. This can
> cause a minor version upgrade to introduce compilation errors, which may be seen as a semver
> non-compliant breaking change."*

### 2.2 The two NG8113 messages, verbatim

From the rule. There are exactly two, and which one you get depends on whether *every* entry is unused:

```ts
if (unused.length === metadata.imports.length && propertyAssignment !== null) {
  return makeDiagnostic(
    ErrorCode.UNUSED_STANDALONE_IMPORTS,
    propertyAssignment.name,
    'All imports are unused',
    undefined,
    category,
  );
}

return unused.map((ref) => {
  // ...
  return makeDiagnostic(
    ErrorCode.UNUSED_STANDALONE_IMPORTS,
    diagnosticNode,
    `${ref.node.name.text} is not used within the template of ${metadata.name}`,
    undefined,
    category,
  );
});
```

So the two strings are exactly:

- `` `All imports are unused` `` — reported on the `imports` property name.
- `` `NgClass is not used within the template of UserCard` `` — one per unused symbol, reported on the
  identifier inside the array where possible.

⚠️ These are built with `makeDiagnostic`, **not** `formatExtendedError`, so — unlike NG8103 (§3.6) —
they do **not** carry a trailing `Find more at https://v22.angular.dev/extended-diagnostics/NG8113`.
Do not invent that suffix onto an NG8113 message.

### 2.3 What NG8113 deliberately does **not** flag

Four exemptions, all readable in the rule:

```ts
if (
  !metadata ||
  !metadata.isStandalone ||
  metadata.rawImports === null ||
  metadata.imports === null ||
  metadata.imports.length === 0
) {
  return null;
}
```

1. **Non-standalone components** are skipped entirely.
2. **NgModules in `imports` are never flagged.** The loop only asks
   `getDirectiveMetadata` and `getPipeMetadata`; anything that is neither is passed over. 🔴 So
   `imports: [CommonModule]` with an empty template produces **no warning**. That is the single most
   useful thing to tell a reader, and it is why the `common-to-standalone` schematic (§8.4) had to exist
   separately.
3. **Non-standalone directives/pipes in `imports`** are skipped — `dirMeta.isStandalone` is required
   before flagging. They are already NG2011 (§2.5).
4. **Symbols that might come from a shared, exported array.** Verbatim doc comment:

   > *"Determines if an import reference *might* be coming from a shared imports array."*

   and the reasoning, verbatim:

   > *"The reference might be shared if it comes from an exported array. If the variable is local to the
   > file, then it likely isn't shared. Note that this has the potential for false positives if a
   > non-exported array of imports is shared between components in the same file."*

   Practical rule for the page: put your shared imports in an **exported** `const` and NG8113 goes
   quiet; leave it un-exported and local and it will flag entries the other component in the same file
   is using.

The `shouldCheck` gate is worth a line too — the rule only opens a file at all if it plausibly contains
a component:

```ts
shouldCheck(sourceFile: ts.SourceFile): boolean {
  return (
    this.typeCheckingConfig.unusedStandaloneImports !== 'suppress' &&
    (this.importedSymbolsTracker.hasNamedImport(sourceFile, 'Component', '@angular/core') ||
      this.importedSymbolsTracker.hasNamespaceImport(sourceFile, '@angular/core'))
  );
}
```

### 2.4 🔴 NG8113 is not, mechanically, an "extended template diagnostic"

It is listed in angular.dev's extended-diagnostics table and configured under `extendedDiagnostics`,
but it is implemented as a **`SourceFileValidatorRule`**, and the validator runs on a different gate
from the extended checks. `compiler.ts`, `runAdditionalChecks`, verbatim:

```ts
for (const sf of files) {
  if (sourceFileValidator !== null) {
    const sourceFileDiagnostics = sourceFileValidator.getDiagnosticsForFile(sf);
    if (sourceFileDiagnostics !== null) {
      diagnostics.push(...sourceFileDiagnostics);
    }
  }

  if (templateSemanticsChecker !== null) { /* ... */ }

  if (this.strictTemplates && extendedTemplateChecker !== null) {
    diagnostics.push(
      ...compilation.traitCompiler.runAdditionalChecks(sf, (clazz, handler) => {
        return handler.extendedTemplateCheck?.(clazz, extendedTemplateChecker) || null;
      }),
    );
  }
}
```

The `sourceFileValidator` call has **no `strictTemplates` guard**; the extended checks do. angular.dev
says of the whole family:

> *"Extended diagnostics will emit when [`strictTemplates`](tools/cli/template-typecheck#strict-mode) is
> enabled. This is required to allow the compiler to better understand Angular template types and
> provide accurate and meaningful diagnostics."*

⚠️ Record this as a *source-vs-docs* nuance (§9.3), not as a claim you tested. Since `strictTemplates`
now defaults to `true` (§0.5), it almost never changes what a reader sees; say so.

The validator is also skipped wholesale if the compilation already failed to construct:

```ts
const sourceFileValidator =
  this.constructionDiagnostics.length === 0
    ? new SourceFileValidator(reflector, importTracker, templateTypeChecker, typeCheckingConfig)
    : null;
```

…and never runs on declaration files:

```ts
if (sourceFile.isDeclarationFile || sourceFile.fileName.endsWith('.ngtypecheck.ts')) {
  return null;
}
```

### 2.5 The cleanup schematic

angular.dev `reference/migrations/cleanup-unused-imports` →
https://angular.dev/reference/migrations/cleanup-unused-imports. Verbatim:

> *"As of version 19, Angular reports when a component's `imports` array contains symbols that aren't
> used in its template."*

> *"Running this schematic will clean up all unused imports within the project."*

```shell
ng generate @angular/core:cleanup-unused-imports
```

Its `schema.json` at v22.1.5 has **no options at all** (`"properties": {}`) — no `path`, no `mode`.
Verified. It is whole-project or nothing. (Contrast the standalone migration, which has `mode` and
`path`.) `collection.json` description, verbatim:

> *"Removes unused imports from standalone components."*

🔴 **The schematic re-enables the diagnostic behind your back.**
`packages/core/schematics/ng-generate/cleanup-unused-imports/unused_imports_migration.ts`:

```ts
override createProgram(tsconfigAbsPath: string, fs: FileSystem): ProgramInfo {
  return super.createProgram(tsconfigAbsPath, fs, {
    extendedDiagnostics: {
      checks: {
        // Ensure that the diagnostic is enabled.
        unusedStandaloneImports: DiagnosticCategoryLabel.Warning,
      },
    },
  });
}
```

and then it simply reads NG8113 back out:

```ts
info.ngCompiler?.getDiagnostics().forEach((diag) => {
  if (
    diag.file !== undefined &&
    diag.start !== undefined &&
    diag.length !== undefined &&
    diag.code === ngErrorCode(ErrorCode.UNUSED_STANDALONE_IMPORTS)
  ) {
    // ...
  }
});
```

So: the schematic works even if your `tsconfig.json` says `"unusedStandaloneImports": "suppress"`, and
it can only remove what NG8113 can see — meaning **it will not remove `CommonModule`** (§2.3) and it
will not remove an entry it thinks might be shared.

It empties the array rather than deleting the key. From the migration's own before/after
(angular.dev, verbatim):

```angular-ts
// After
@Component({
  template: 'Hello',
  imports: [],
})
export class MyComp {}
```

The IDE-side equivalent is a real code fix,
`packages/language-service/src/codefixes/fix_unused_standalone_imports.ts`, whose descriptions are
verbatim `Remove all unused imports` for both `description` and `fixAllDescription`, keyed on
`ngErrorCode(ErrorCode.UNUSED_STANDALONE_IMPORTS)`.

### 2.6 🔴 NG2010 / NG2011 / NG2012 — what each actually is, with the real strings

All three confirmed from `packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts` (the enum doc
comments) and from the two files that raise them. **All three are compile-time errors, not warnings, not
runtime.**

**NG2010 — `COMPONENT_NOT_STANDALONE`.** Enum comment, verbatim:
> *"Raised when a component has `imports` but is not marked as `standalone: true`."*

Raised in three distinct places in `handler.ts`, with three different messages:

```ts
// 1. imports / deferredImports / foreignImports on a non-standalone component
const importsField = rawImports
  ? 'imports'
  : rawDeferredImports
    ? 'deferredImports'
    : 'foreignImports';
diagnostics.push(
  makeDiagnostic(
    ErrorCode.COMPONENT_NOT_STANDALONE,
    component.get(importsField)!,
    `'${importsField}' is only valid on a component that is standalone.`,
    [
      makeRelatedInformation(
        node.name,
        `Did you forget to add 'standalone: true' to this @Component?`,
      ),
    ],
  ),
);
```

```ts
// 2. schemas on a non-standalone component
makeDiagnostic(
  ErrorCode.COMPONENT_NOT_STANDALONE,
  component.get('schemas')!,
  `'schemas' is only valid on a component that is standalone.`,
)
```

```ts
// 3. selectorless on a non-standalone component
makeDiagnostic(
  ErrorCode.COMPONENT_NOT_STANDALONE,
  component.get('standalone') || node.name,
  `Cannot use selectorless with a component that is not standalone`,
)
```

Note the **related information** on the first one still says *"Did you forget to add `standalone: true`"*
even though nobody writes that in v22 — the message predates the default flip. Worth a sentence: the
real fix in v22 is usually to **delete `standalone: false`**, not to add `standalone: true`. Also note
that after raising it the compiler sets `isPoisoned = true`, with the verbatim comment:

> *"Poison the component so that we don't spam further template type-checking errors that result from
> misconfigured imports."*

**NG2011 — `COMPONENT_IMPORT_NOT_STANDALONE`.** Enum comment, verbatim:
> *"Raised when a type in the `imports` of a component is a directive or pipe, but is not standalone."*

Message, from `packages/compiler-cli/src/ngtsc/scope/src/util.ts`, `makeNotStandaloneDiagnostic` —
this one is *adaptive*, which is the interesting part:

```ts
let message = `The ${kind} '${ref.node.name.text}' appears in 'imports', but is not standalone and cannot be imported directly.`;
let relatedInformation: ts.DiagnosticRelatedInformation[] | undefined = undefined;
if (scope !== null && scope.kind === ComponentScopeKind.NgModule) {
  // The directive/pipe in question is declared in an NgModule. Check if it's also exported.
  const isExported = scope.exported.dependencies.some((dep) => dep.ref.node === ref.node);
  const relatedInfoMessageText = isExported
    ? `It can be imported using its '${scope.ngModule.name.text}' NgModule instead.`
    : `It's declared in the '${scope.ngModule.name.text}' NgModule, but is not exported. ` +
      'Consider exporting it and importing the NgModule instead.';
  relatedInformation = [makeRelatedInformation(scope.ngModule.name, relatedInfoMessageText)];
}
if (relatedInformation === undefined) {
  // If no contextual pointers can be provided to suggest a specific remedy, then at least tell
  // the user broadly what they need to do.
  message += ' It must be imported via an NgModule.';
}
```

`kind` is one of `'component' | 'directive' | 'pipe'`. So the four strings a reader can actually hit:

- `The component 'LegacyBadge' appears in 'imports', but is not standalone and cannot be imported directly. It must be imported via an NgModule.`
- the same first sentence, plus related info `It can be imported using its 'LegacyUiModule' NgModule instead.`
- the same first sentence, plus related info `It's declared in the 'LegacyUiModule' NgModule, but is not exported. Consider exporting it and importing the NgModule instead.`
- (the `directive` / `pipe` variants of each)

⚠️ Angular's own TODO admits a gap, verbatim:
> *"TODO(alxhub): the above case handles directives/pipes in NgModules that are declared in the current
> compilation, but not those imported from .d.ts dependencies."*
So the helpful "import its NgModule instead" hint appears for **your own** modules and not for a
third-party library shipped as `.d.ts`. That is a genuine, source-backed gotcha.

**NG2012 — `COMPONENT_UNKNOWN_IMPORT`.** Enum comment, verbatim:
> *"Raised when a type in the `imports` of a component is not a directive, pipe, or NgModule."*

Two messages. The generic one, from `scope/src/util.ts`:

```ts
export function makeUnknownComponentImportDiagnostic(
  ref: Reference<ClassDeclaration>,
  rawExpr: ts.Expression,
) {
  return makeDiagnostic(
    ErrorCode.COMPONENT_UNKNOWN_IMPORT,
    getDiagnosticNode(ref, rawExpr),
    `Component imports must be standalone components, directives, pipes, or must be NgModules.`,
  );
}
```

🔴 And the special-cased one — **the best gotcha in this whole chunk** — from
`annotations/component/src/util.ts`:

```ts
makeDiagnostic(
  ErrorCode.COMPONENT_UNKNOWN_IMPORT,
  origin,
  `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. ` +
    `These calls are not used to configure components and are not valid in standalone component imports - ` +
    `consider importing them in the application bootstrap instead.`,
)
```

That is what you get for `imports: [RouterModule.forRoot(routes)]` on a component, and the fix it points
at is exactly chunk 08's subject.

### 2.7 The neighbouring codes worth naming (all verified from the enum)

| Code | Enum member | Verbatim enum doc comment |
|---|---|---|
| NG2013 | `HOST_DIRECTIVE_INVALID` | *"Raised when the compiler wasn't able to resolve the metadata of a host directive."* |
| NG2014 | `HOST_DIRECTIVE_NOT_STANDALONE` | *"Raised when a host directive isn't standalone."* — message: `` `Host directive ${hostMeta.name} must be standalone` `` |
| NG2015 | `HOST_DIRECTIVE_COMPONENT` | message: `` `Host directive ${hostMeta.name} cannot be a component` `` |
| NG2022 | `COMPONENT_UNKNOWN_DEFERRED_IMPORT` | *"Raised when a type in the `deferredImports` of a component is not a component, directive or pipe."* — message: `Component deferred imports must be standalone components, directives or pipes.` |
| NG2023 | `NON_STANDALONE_NOT_ALLOWED` | *"Raised when a `standalone: false` component is declared but `strictStandalone` is set."* — **owned by chunk 03, cross-link** |
| NG2024 | `MISSING_NAMED_TEMPLATE_DEPENDENCY` | *"Raised when a named template dependency isn't defined in the component's source file."* |
| NG2025 | `INCORRECT_NAMED_TEMPLATE_DEPENDENCY_TYPE` | *"Raised if an incorrect type is used for a named template dependency (e.g. directive class used as a component)."* |
| NG8012 | `DEFERRED_PIPE_USED_EAGERLY` | *"A pipe imported via `@Component.deferredImports` is used outside of a `@defer` block in a template."* |
| NG8013 | `DEFERRED_DIRECTIVE_USED_EAGERLY` | *"A directive/component imported via `@Component.deferredImports` is used outside of a `@defer` block in a template."* |
| NG8014 | `DEFERRED_DEPENDENCY_IMPORTED_EAGERLY` | *"A directive/component/pipe imported via `@Component.deferredImports` is also included into the `@Component.imports` list."* |
| NG8116 | `MISSING_STRUCTURAL_DIRECTIVE` | *"A structural directive is used in a template, but the directive is not imported."* |

NG8116's runtime-facing message, verbatim from
`typecheck/extended/checks/missing_structural_directive/index.ts`:

```
A structural directive `<Name>` was used in the template without a corresponding import in the
component. Make sure that the directive is included in the `@Component.imports` array of this
component.
```
(assembled by `formatExtendedError`, so it *does* get the `Find more at …/NG8116` suffix — §3.6.)

### 2.8 The tsconfig knob, verbatim from angular.dev's NG8113 page

https://angular.dev/extended-diagnostics/NG8113 —

> *"This diagnostic detects cases where the `imports` array of a `@Component` contains symbols that
> aren't used within the template."*

> *"The unused imports add unnecessary noise to your code and can increase your compilation time."*

⚠️ Note what that sentence says and does not say: **compilation time**, not bundle size. §1.6 explains
why bundle size is the wrong claim for unused *standalone* imports.

> *"Delete the unused import."*

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "unusedStandaloneImports": "suppress"
      }
    }
  }
}
```

---

## §3 · Chunk 06 — "`'x' is not a known element`"

*(planned file `06-not-a-known-element.md`, `sidebar_position: 6`)*

### 3.1 🔴 There are FOUR different errors here, not two

This is the thing the chunk exists to untangle. Two are compile-time, two are runtime, and they carry
different codes and slightly different text.

| | Element | Property |
|---|---|---|
| **Compile time (AOT / `ngtsc`)** | **NG8001** `SCHEMA_INVALID_ELEMENT = -8001` | **NG8002** `SCHEMA_INVALID_ATTRIBUTE = -8002` |
| **Runtime (JIT only)** | **NG0304** `UNKNOWN_ELEMENT = 304` | **NG0303** `UNKNOWN_BINDING = 303` |

Compile-time strings live in `packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts`
(`RegistryDomSchemaChecker`); runtime strings live in
`packages/core/src/render3/instructions/element_validation.ts`.

🔴 **angular.dev's NG8002 page names the wrong runtime code** — see §9.1.

### 3.2 The compile-time element message, verbatim from source

`dom.ts`, `checkElement`:

```ts
if (!REGISTRY.hasElement(name, schemas)) {
  const mapping = this.resolver.getTemplateSourceMapping(id);

  const schemas = `'${hostIsStandalone ? '@Component' : '@NgModule'}.schemas'`;
  let errorMsg = `'${name}' is not a known element:\n`;
  errorMsg += `1. If '${name}' is an Angular component, then verify that it is ${
    hostIsStandalone
      ? "included in the '@Component.imports' of this component"
      : 'part of this module'
  }.\n`;
  if (name.indexOf('-') > -1) {
    errorMsg += `2. If '${name}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.`;
  } else {
    errorMsg += `2. To allow any element add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
  }

  const diag = makeTemplateDiagnostic(
    id, mapping, sourceSpanForDiagnostics,
    ts.DiagnosticCategory.Error,
    ngErrorCode(ErrorCode.SCHEMA_INVALID_ELEMENT),
    errorMsg,
  );
  this._diagnostics.push(diag);
}
```

**The exact string a v22 standalone app sees**, for a hyphenated selector:

```
'app-user-card' is not a known element:
1. If 'app-user-card' is an Angular component, then verify that it is included in the '@Component.imports' of this component.
2. If 'app-user-card' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the '@Component.schemas' of this component to suppress this message.
```

Three details worth spelling out:

- `ts.DiagnosticCategory.Error` — hard error, build fails, even though the enum value is negative (§0.6).
- The text branches on `hostIsStandalone`. A v22 app always gets *"included in the `'@Component.imports'`
  of this component"*; the older *"part of this module"* wording only appears for a `standalone: false`
  host. That single phrase tells a reader which world the failing component is in.
- The `2.` line branches on whether the tag contains a `-`. No dash ⇒ you are told about
  `NO_ERRORS_SCHEMA`; with a dash ⇒ `CUSTOM_ELEMENTS_SCHEMA`. A typo like `<dvi>` gets the
  `NO_ERRORS_SCHEMA` branch, which is misleading advice for a typo — worth a gotcha.

There is one more preprocessing step worth knowing:

```ts
const REMOVE_XHTML_REGEX = /^:xhtml:/;
// HTML elements inside an SVG `foreignObject` are declared in the `xhtml` namespace.
// We need to strip it before handing it over to the registry because all HTML tag names
// in the registry are without a namespace.
const name = tagName.replace(REMOVE_XHTML_REGEX, '');
```

and the registry itself is, verbatim from the class doc:

> *"Checks non-Angular elements and properties against the `DomElementSchemaRegistry`, a schema
> maintained by the Angular team via extraction from a browser IDL."*

### 3.3 The compile-time property message, verbatim

`dom.ts`, `checkTemplateElementProperty`:

```ts
if (!REGISTRY.hasProperty(tagName, name, schemas)) {
  const mapping = this.resolver.getTemplateSourceMapping(id);

  const decorator = hostIsStandalone ? '@Component' : '@NgModule';
  const schemas = `'${decorator}.schemas'`;
  let errorMsg = `Can't bind to '${name}' since it isn't a known property of '${tagName}'.`;
  if (tagName.startsWith('ng-')) {
    errorMsg +=
      `\n1. If '${name}' is an Angular directive, then add 'CommonModule' to the '${decorator}.imports' of this component.` +
      `\n2. To allow any property add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
  } else if (tagName.indexOf('-') > -1) {
    errorMsg +=
      `\n1. If '${tagName}' is an Angular component and it has '${name}' input, then verify that it is ${
        hostIsStandalone
          ? "included in the '@Component.imports' of this component"
          : 'part of this module'
      }.` +
      `\n2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.` +
      `\n3. To allow any property add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
  }
  // ... ts.DiagnosticCategory.Error, ngErrorCode(ErrorCode.SCHEMA_INVALID_ATTRIBUTE) ...
}
```

🔴 **The `ng-` branch is the one that tells you to add `CommonModule`, and it is v14-era advice the
compiler still gives.** For `<ng-container *ngIf="...">` you are told to add `CommonModule`. In v22 the
right answer is `@if`. Say this on the page: **the compiler's own suggestion is the outdated one.** It
is the cleanest possible illustration of "why `CommonModule` is usually the wrong fix now".

Note the third method, `checkHostElementProperty`, which produces the bare form with no numbered
suggestions at all:

```ts
const errorMessage = `Can't bind to '${name}' since it isn't a known property of '${tagName}'.`;
```

### 3.4 The runtime versions, verbatim, and when they can possibly fire

`element_validation.ts`. The gate is **JIT only** — the doc comment says so twice:

> *"This check is relevant for JIT-compiled components (for AOT-compiled ones this check happens at
> build time)."*

and the mechanism is a `null` schemas field:

```ts
// If `schemas` is set to `null`, that's an indication that this Component was compiled in AOT
// mode where this check happens at compile time. In JIT mode, `schemas` is always present and
// defined as an array (as an empty array in case `schemas` field is not defined) and we should
// execute the check below.
if (tView.schemas === null) return;
```

The element message:

```ts
let message = `'${tagName}' is not a known element${templateLocation}:\n`;
message += `1. If '${tagName}' is an Angular component, then verify that it is ${
  isHostStandalone
    ? "included in the '@Component.imports' of this component"
    : 'a part of an @NgModule where this component is declared'
}.\n`;
if (tagName && tagName.indexOf('-') > -1) {
  message += `2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.`;
} else {
  message += `2. To allow any element add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
}
if (shouldThrowErrorOnUnknownElement) {
  throw new RuntimeError(RuntimeErrorCode.UNKNOWN_ELEMENT, message);
} else {
  console.error(formatRuntimeError(RuntimeErrorCode.UNKNOWN_ELEMENT, message));
}
```

Two differences from the compile-time text, both worth naming:

1. `${templateLocation}` — the runtime message interpolates a location suffix
   (`getTemplateLocationDetails(lView)`) that the compile-time one does not have.
2. The non-standalone branch says *"a part of an @NgModule where this component is declared"* at runtime
   vs *"part of this module"* at compile time. Same meaning, different string — a reader searching the
   exact phrase needs to know which one they have.

**By default it is `console.error`, not a throw.** The toggles, verbatim:

```ts
let shouldThrowErrorOnUnknownElement = false;

/**
 * Sets a strict mode for JIT-compiled components to throw an error on unknown elements,
 * instead of just logging the error.
 * (for AOT-compiled ones this check happens at build time).
 */
export function ɵsetUnknownElementStrictMode(shouldThrow: boolean) {
  shouldThrowErrorOnUnknownElement = shouldThrow;
}
```

…and the identical pair `ɵsetUnknownPropertyStrictMode` / `ɵgetUnknownPropertyStrictMode`. These are
what `TestBed`'s `errorOnUnknownElements` / `errorOnUnknownProperties` options drive, which is why an
unknown element is a **silent console error in a browser** and a **test failure in TestBed**. That
asymmetry is a gotcha in its own right.

The runtime property message, and 🔴 its dedicated control-flow branch:

```ts
let message = `Can't bind to '${propName}' since it isn't a known property of '${tagName}'${templateLocation}.`;

const schemas = `'${isHostStandalone ? '@Component' : '@NgModule'}.schemas'`;
const importLocation = isHostStandalone
  ? "included in the '@Component.imports' of this component"
  : 'a part of an @NgModule where this component is declared';
if (KNOWN_CONTROL_FLOW_DIRECTIVES.has(propName)) {
  // Most likely this is a control flow directive (such as `*ngIf`) used in
  // a template, but the directive or the `CommonModule` is not imported.
  const correspondingImport = KNOWN_CONTROL_FLOW_DIRECTIVES.get(propName);
  message +=
    `\nIf the '${propName}' is an Angular control flow directive, ` +
    `please make sure that either the '${correspondingImport}' directive or the 'CommonModule' is ${importLocation}.`;
} else {
  message +=
    `\n1. If '${tagName}' is an Angular component and it has the ` +
    `'${propName}' input, then verify that it is ${importLocation}.`;
  // ... CUSTOM_ELEMENTS_SCHEMA / NO_ERRORS_SCHEMA branches ...
}
```

and the special case that catches `<ng-template *ngIf="…">`, verbatim comment:

> *"Special-case a situation when a structural directive is applied to an `<ng-template>` element, for
> example: `<ng-template *ngIf="true">`. In this case the compiler generates the `ɵɵtemplate`
> instruction with the `null` as the tagName."*

### 3.5 🔴 Why `CommonModule` is usually the wrong fix in v22

Four independent, quotable pieces of evidence. Use them together; each alone is weaker.

**(a) The built-in blocks are template syntax and need no import at all.** angular.dev
`reference/migrations/control-flow` → https://angular.dev/reference/migrations/control-flow, verbatim:

> *"[Control flow syntax](guide/templates/control-flow) is available from Angular v17. The new syntax is
> baked into the template, so you don't need to import `CommonModule` anymore."*

⚠️ Supporting observation, safe to state: angular.dev's own control-flow guide
(https://angular.dev/guide/templates/control-flow) describes `@if`, `@for`, `@switch`, `@let` across 184
lines and **never mentions an import**, because there is nothing to import. That is an observation about
the document, not an inference about behaviour.

**(b) Angular's own diagnostic now recommends the built-in first.** NG8103
`missingControlFlowDirective`, verbatim from
`typecheck/extended/checks/missing_control_flow_directive/index.ts`:

```ts
export const KNOWN_CONTROL_FLOW_DIRECTIVES = new Map([
  ['ngIf', {directive: 'NgIf', builtIn: '@if'}],
  ['ngFor', {directive: 'NgFor', builtIn: '@for'}],
  ['ngSwitchCase', {directive: 'NgSwitchCase', builtIn: '@switch with @case'}],
  ['ngSwitchDefault', {directive: 'NgSwitchDefault', builtIn: '@switch with @default'}],
]);
```

```ts
const errorMessage = formatExtendedError(
  ErrorCode.MISSING_CONTROL_FLOW_DIRECTIVE,
  `The \`*${controlFlowAttr.name}\` directive was used in the template, ` +
    `but neither the \`${directiveAndBuiltIn?.directive}\` directive nor the \`CommonModule\` was imported. ` +
    `Use Angular's built-in control flow ${directiveAndBuiltIn?.builtIn} or ` +
    `make sure that either the \`${directiveAndBuiltIn?.directive}\` directive or the \`CommonModule\` ` +
    `is included in the \`@Component.imports\` array of this component.`,
);
```

So the assembled NG8103 message for `*ngIf` is exactly:

```
NG8103: The `*ngIf` directive was used in the template, but neither the `NgIf` directive nor the
`CommonModule` was imported. Use Angular's built-in control flow @if or make sure that either the
`NgIf` directive or the `CommonModule` is included in the `@Component.imports` array of this
component. Find more at https://v22.angular.dev/extended-diagnostics/NG8103
```

Note the class doc's own scoping notes, verbatim — both are gotchas:

> *"Note: there is no `ngSwitch` here since it's typically used as a regular binding (e.g.
> `[ngSwitch]`), however the `ngSwitchCase` and `ngSwitchDefault` are used as structural directives and
> a warning would be generated."*

> *"Note: this check only handles the cases when structural directive syntax is used (e.g. `*ngIf`).
> Regular binding syntax (e.g. `[ngIf]`) is handled separately in type checker and treated as a hard
> error instead of a warning."*

and the check bails out entirely on non-standalone components:

```ts
// Avoid running this check for non-standalone components.
if (!componentMetadata || !componentMetadata.isStandalone) {
  return [];
}
```

**(c) `ngIf` / `ngFor` / `ngSwitch` are themselves deprecated.** Verbatim from
`packages/common/src/directives/ng_if.ts`:
> *"@deprecated 20.0 Use the `@if` block instead. Intent to remove in a future major release"*

and on the input itself:
> *"@deprecated Use the `@if` block instead. Intent to remove in a future major release"*

**(d) `CommonModule` is 24 symbols.** Read from `packages/common/src/directives/index.ts` and
`packages/common/src/pipes/index.ts` at v22.1.5 — the complete lists, verbatim:

```ts
export const COMMON_DIRECTIVES: Provider[] = [
  NgClass, NgComponentOutlet, NgForOf, NgIf, NgTemplateOutlet,
  NgStyle, NgSwitch, NgSwitchCase, NgSwitchDefault, NgPlural, NgPluralCase,
];

export const COMMON_PIPES = [
  AsyncPipe, UpperCasePipe, LowerCasePipe, JsonPipe, SlicePipe,
  DecimalPipe, PercentPipe, TitleCasePipe, CurrencyPipe, DatePipe,
  I18nPluralPipe, I18nSelectPipe, KeyValuePipe,
];
```

and the module itself is nothing but a re-export bundle:

```ts
@NgModule({
  imports: [COMMON_DIRECTIVES, COMMON_PIPES],
  exports: [COMMON_DIRECTIVES, COMMON_PIPES],
})
export class CommonModule {}
```

with the doc comment, verbatim:
> *"Exports all the basic Angular directives and pipes, such as `NgIf`, `NgForOf`, `DecimalPipe`, and so
> on. Re-exported by `BrowserModule`, which is included automatically in the root `AppModule` when you
> create a new app with the CLI `new` command."*

🔴 **And NG8113 will never tell you it is unused** (§2.3) — the rule only inspects entries that resolve
to a directive or a pipe, and `CommonModule` resolves to neither. So `imports: [CommonModule]` is the
one import that goes stale silently. That is the strongest single argument the chunk has.

⛔ Do **not** claim a bundle-size figure for this. §1.6 shows the compiler drops unused *directives*
from the emitted definition; the honest cost statement is "the module class reference is always
emitted, and the diagnostic that would have caught staleness is blind to it".

**What `CommonModule` legitimately still gives you**, and what to import instead:

| You actually wanted | v22 answer |
|---|---|
| `*ngIf` | `@if` — no import |
| `*ngFor` | `@for` — no import (`track` is required) |
| `[ngSwitch]` | `@switch` — no import |
| `async` pipe | `import { AsyncPipe } from '@angular/common'` |
| `date`, `currency`, `json`, `keyvalue`, `slice`, … | import the individual pipe class |
| `ngClass` / `ngStyle` | `NgClass` / `NgStyle` — **not deprecated in 22.1.5**; the `ngclass-to-class` / `ngstyle-to-style` schematics exist to move you to plain `class`/`style` bindings, which need no import |
| `ngTemplateOutlet` / `ngComponentOutlet` | `NgTemplateOutlet` / `NgComponentOutlet` — no built-in replacement |

### 3.6 `formatExtendedError` — the "Find more at" suffix and the version subdomain

`typecheck/extended/api/format-extended-error.ts`, verbatim:

```ts
export const EXTENDED_ERROR_DETAILS_PAGE_BASE_URL: string = (() => {
  const versionSubDomain = VERSION.major !== '0' ? `v${VERSION.major}.` : '';
  return `https://${versionSubDomain}angular.dev/extended-diagnostics`;
})();

export function formatExtendedError(code: ErrorCode, message: null | false | string): string {
  // Note: Runtime error codes are prefixed with 0 (e.g., NG0100-999) while compiler errors
  // use plain numbers (e.g., NG1001), keeping them distinct despite numerical overlap.
  const fullCode = `NG${Math.abs(code)}`;
  const errorMessage = `${fullCode}${message ? ': ' + message : ''}`;
  const addPeriodSeparator = !errorMessage.match(/[.,;!?\n]$/);
  const separator = addPeriodSeparator ? '.' : '';

  return `${errorMessage}${separator} Find more at ${EXTENDED_ERROR_DETAILS_PAGE_BASE_URL}/${fullCode}`;
}
```

So on Angular 22 an extended diagnostic points at `https://v22.angular.dev/extended-diagnostics/NG8103`,
version-pinned. Only checks that go through `formatExtendedError` get that suffix — NG8103 and NG8116
do; **NG8113 does not** (§2.2).

The embedded comment is itself the cleanest statement of the numbering scheme:
> *"Runtime error codes are prefixed with 0 (e.g., NG0100-999) while compiler errors use plain numbers
> (e.g., NG1001), keeping them distinct despite numerical overlap."*

### 3.7 The debugging ladder for the page

Given `'app-user-card' is not a known element`, in order:

1. **Is the failing file the parent or the child?** It is always the file whose *template* contains the
   tag. The child is fine.
2. **Is `AppUserCard` in that file's `imports` array?** If no, that is the whole bug.
3. **Is the selector actually `app-user-card`?** Compare `@Component.selector` on the child.
4. **Is the child `standalone: false`?** Then you get NG2011 instead when you try to import it — import
   its NgModule, or delete the flag.
5. **Is the child in a library shipped as `.d.ts`?** Then NG2011's helpful "import its NgModule instead"
   related-information is missing (§2.6) and you have to find the module yourself.
6. **Is it a genuine web component?** `CUSTOM_ELEMENTS_SCHEMA` in `@Component.schemas` — and note
   `schemas` is per-component now, not per-module, and is NG2010 if the component is not standalone.

`CUSTOM_ELEMENTS_SCHEMA` and `NO_ERRORS_SCHEMA` are both still exported from `@angular/core` at v22.1.5
(`goldens/public-api/core/index.api.md`).

---

## §4 · Chunk 07 — "What replaced each `NgModule` responsibility"

*(planned file `07-what-replaced-each-ngmodule-responsibility.md`, `sidebar_position: 7`)*

⚠️ Chunk **01b** already prints a **six-row** bootstrap-oriented table
(`platformBrowser().bootstrapModule` → `bootstrapApplication`, `bootstrap`, `providers`,
`imports: [BrowserModule]`, `imports: [AppRoutingModule]`, `declarations`). This chunk is the
**field-by-field, complete** version including `exports`, `schemas`, `entryComponents`, `id` and `jit`.
Do not re-explain `BrowserModule` or `TESTABILITY_PROVIDERS`; cross-link 01b.

### 4.1 The complete `NgModule` interface at v22.1.5

`packages/core/src/metadata/ng_module.ts` — these are **all** the fields, in source order:

```ts
providers?: Array<Provider | EnvironmentProviders>;
declarations?: Array<Type<any> | any[]>;
imports?: Array<Type<any> | ModuleWithProviders<{}> | any[]>;
exports?: Array<Type<any> | any[]>;
bootstrap?: Array<Type<any> | any[]>;
schemas?: Array<SchemaMetadata | any[]>;
id?: string;
jit?: true;
```

🔴 **`entryComponents` is not in that list.** It was **removed in 16.0.0**. Confirmed two ways:
present in `ng_module.ts` at tag `15.2.10`, absent at `16.2.12`; and the v16.0.0 release notes carry the
breaking change, verbatim (the typo *"anyting"* is upstream — quote it as written or paraphrase):

> *"`entryComponents` has been deleted from the `@NgModule` and `@Component` public APIs. Any usages can
> be removed since they weren't doing anyting."*
> *"`ANALYZE_FOR_ENTRY_COMPONENTS` injection token has been deleted. Any references can be removed."*

Its v15.2.10 deprecation notice, for the historical half of the row:

```ts
/**
 * ...
 * @see [Entry Components](guide/entry-components)
 * @deprecated
 * Since 9.0.0. With Ivy, this property is no longer necessary.
 * (You may need to keep these if building a library that will be consumed by a View Engine
 * application.)
 */
entryComponents?: Array<Type<any>|any[]>;
```

The two survivors that nobody thinks about, verbatim doc comments from v22.1.5:

```ts
/**
 * A name or path that uniquely identifies this NgModule in `getNgModuleById`.
 * If left `undefined`, the NgModule is not registered with `getNgModuleById`.
 */
id?: string;

/**
 * When present, this module is ignored by the AOT compiler.
 * It remains in distributed code, and the JIT compiler attempts to compile it
 * at run time, in the browser.
 * To ensure the correct behavior, the app must import `@angular/compiler`.
 */
jit?: true;
```

(`id` has its own runtime errors: `NG_MODULE_ID_NOT_FOUND = 920` and `DUPLICATE_NG_MODULE_ID = 921`, and
its own compiler warning `WARN_NGMODULE_ID_UNNECESSARY = -6100`, whose enum doc reads: *"Indicates that
an NgModule is declared with `id: module.id`. This is an anti-pattern that is disabled explicitly in the
compiler, that was originally based on a misunderstanding of `NgModule.id`."*)

### 4.2 The substitution table — the deliverable of this chunk

| `@NgModule` field | v22 replacement | The precise mechanism |
|---|---|---|
| `declarations` | **Nothing.** A class no longer belongs to anything. It is referenced by whoever needs it, in *their* `imports`. | `StandaloneComponentScopeReader` puts the component in its own scope (§1.3). The class is its own unit of compilation. |
| `imports` (a module) | `imports` on the **component** that needs the template dependency, **plus** a `provide*()` call in `ApplicationConfig.providers` for the provider half. | The one field split into two, because a module conflated two jobs. |
| `imports` (`X.forRoot()`) | `provideX()` in the provider array. Passing a `ModuleWithProviders` to a component's `imports` is **NG2012** with a bespoke message (§2.6). | `RouterModule.forRoot(routes)` → `provideRouter(routes)`. |
| `exports` | **Nothing.** There is no re-export step; a component names the class directly. If you want a convenience bundle, use a plain exported `const` array (`export const SHARED_UI = [Card, Badge] as const;`) — `imports` flattens nested arrays (§1.5). | The scope reader has no notion of "exported by a component". Only NgModules have `exported.dependencies`. |
| `providers` | `ApplicationConfig.providers` (app-wide) · `Route.providers` (per route subtree) · `@Component.providers` (per component instance) · `@Injectable({providedIn: 'root'})` (the class provides itself, and is tree-shakable) | `Route.providers` is `Array<Provider \| EnvironmentProviders>` and its doc says *"The `Router` will create a new `EnvironmentInjector` for this `Route` and use it for this `Route` and its `children`."* |
| `bootstrap` | The **first argument** of `bootstrapApplication`. A standalone class in `@NgModule.bootstrap` is **NG6009** (`NGMODULE_BOOTSTRAP_IS_STANDALONE`, enum doc: *"Raised when a standalone component is part of the bootstrap list of an NgModule."*) — chunk 01b owns that error. | |
| `schemas` | `schemas` on the **component**, and only on a standalone one. `'schemas' is only valid on a component that is standalone.` (NG2010) | `CUSTOM_ELEMENTS_SCHEMA` / `NO_ERRORS_SCHEMA`, both still exported from `@angular/core` 22.1.5. Per-component means a web-component escape hatch no longer leaks across a whole module. |
| `entryComponents` | **Gone since 16.0.0.** Nothing replaces it; Ivy made it unnecessary in v9. Dynamic creation is `createComponent()` / `ViewContainerRef.createComponent()`. | `createComponent<C>(component, {environmentInjector, hostElement?, elementInjector?, projectableNodes?, directives?, bindings?})` — the v22 signature, from the core public-API golden. |
| `id` | Still exists, still `NgModule`-only. No standalone equivalent because nothing needs to look a component up by module id. | |
| `jit` | Still exists, still `NgModule`-only. | |

### 4.3 The `providers` half deserves its own paragraph

angular.dev `guide/ngmodules/overview`, verbatim — the sentence that explains why module providers were
so hard to reason about:

> *"An `NgModule` can specify `providers` for injected dependencies. These providers are available to:
> Any standalone component, directive, or pipe that imports the NgModule, and the `declarations` and
> `providers` of any _other_ NgModule that imports the NgModule."*

and on `forRoot`:

> *"Some NgModules define a static `forRoot` method that accepts some configuration and returns an array
> of providers. The name "`forRoot`" is a convention that indicates that these providers are intended to
> be added exclusively to the _root_ of your application during bootstrap."*

> *"Any providers included in this way are eagerly loaded, increasing the JavaScript bundle size of your
> initial page load."*

That last sentence is Angular's own words for the cost, so you may quote it — but it is a doc claim
about `forRoot`, not a measurement you made.

`EnvironmentProviders` is a **branded phantom type**, from `goldens/public-api/core/index.api.md`:

```ts
// @public
export type EnvironmentProviders = {
    ɵbrand: 'EnvironmentProviders';
};
```

which is the whole trick: a `provide*()` function returns a value the type system will not let you put
in a `@Component.providers` array, and the runtime backs it up with NG0207 (§5.4). The constructor is
public:

```ts
export function makeEnvironmentProviders(providers: (Provider | EnvironmentProviders)[]): EnvironmentProviders;
```

whose doc comment states the intent, verbatim:
> *"Wrap an array of `Provider`s into `EnvironmentProviders`, preventing them from being accidentally
> referenced in `@Component` in a component injector."*

### 4.4 The runtime `NgModule` scope algorithm, if the chunk wants to show the "before"

`packages/core/src/render3/deps_tracker/deps_tracker.ts`, `computeNgModuleScope` — this is the ambient
scope in twenty lines:

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

**Every declaration shares one `compilation` set.** That is "ambient and transitive" in code: import a
module anywhere in the chain and every component declared in the importing module can use everything
that chain exports, whether it says so or not.

---

## §5 · Chunk 08 — "Interop, honestly — `importProvidersFrom`"

*(planned file `08-ngmodule-interop-importprovidersfrom.md`, `sidebar_position: 8`)*

### 5.1 The signature and what it returns

`goldens/public-api/core/index.api.md` at v22.1.5:

```ts
export function importProvidersFrom(...sources: ImportProvidersSource[]): EnvironmentProviders;

export type ImportProvidersSource =
  | Type<unknown>
  | ModuleWithProviders<unknown>
  | Array<ImportProvidersSource>;
```

The implementation, verbatim from `packages/core/src/di/provider_collection.ts` — note the two brands it
stamps on the result:

```ts
export function importProvidersFrom(...sources: ImportProvidersSource[]): EnvironmentProviders {
  return {
    ɵproviders: internalImportProvidersFrom(true, sources),
    ɵfromNgModule: true,
  } as InternalEnvironmentProviders;
}
```

`ɵfromNgModule: true` is what lets NG0207 produce a *different, more specific* message for
`importProvidersFrom` than for a generic `EnvironmentProviders` (§5.4).

Its own doc comment, verbatim — the first paragraph is the whole contract:

> *"Collects providers from all NgModules and standalone components, including transitively imported
> ones."*

> *"Providers extracted via `importProvidersFrom` are only usable in an application injector or another
> environment injector (such as a route injector). They should not be used in component providers."*

with both sanctioned call sites shown in the `@usageNotes`, verbatim:

```ts
await bootstrapApplication(RootComponent, {
  providers: [
    importProvidersFrom(NgModuleOne, NgModuleTwo)
  ]
});
```

```ts
export const ROUTES: Route[] = [
  {
    path: 'foo',
    providers: [
      importProvidersFrom(NgModuleOne, NgModuleTwo)
    ],
    component: YourStandaloneComponent
  }
];
```

and the return-tag, verbatim: *"@returns Collected providers from the specified list of types."*

### 5.2 🔴 What it costs — read it off `walkProviderTree`

`provider_collection.ts`, `walkProviderTree` doc comment, verbatim:

> *"The logic visits an `InjectorType`, an `InjectorTypeWithProviders`, or a standalone `ComponentType`,
> and all of its transitive providers and collects providers."*

> *"If an `InjectorTypeWithProviders` that declares providers besides the type is specified, the function
> will return "true" to indicate that the providers of the type definition need to be processed. This
> allows us to process providers of injector types after all imports of an injector definition are
> processed. (following View Engine semantics: see FW-1349)"*

The walk itself:

```ts
export function internalImportProvidersFrom(
  checkForStandaloneCmp: boolean,
  ...sources: (ImportProvidersSource | AbstractType<unknown>)[]
): Provider[] {
  const providersOut: SingleProvider[] = [];
  const dedup = new Set<Type<unknown> | AbstractType<unknown>>(); // already seen types
  let injectorTypesWithProviders: InjectorTypeWithProviders<unknown>[] | undefined;

  const collectProviders: WalkProviderTreeVisitor = (provider) => {
    providersOut.push(provider);
  };

  deepForEach(sources, (source) => { /* ... walkProviderTree ... */ });
  // ...
}
```

Four costs, each of them readable in that code and none of them a measurement:

1. **It is eager and total.** Every provider in the module's transitive `imports` graph is pushed into a
   flat array **at bootstrap**, before your first component renders. Not lazy, not per-feature.
2. **Nothing tree-shakes.** The module class is referenced by value in your `main.ts` provider array, so
   the bundler must keep the module and everything its injector definition references — which is the
   entire point `provideX()` functions were invented to fix.
3. **You cannot see what you got.** The result is `EnvironmentProviders`, an opaque brand. There is no
   list to read, no way to take half.
4. **Cycles are only checked in dev mode:**
   ```ts
   // Check for circular dependencies.
   if (ngDevMode && parents.indexOf(defType) !== -1) {
     const defName = stringify(defType);
     const path = parents.map(stringify).concat(defName);
     throw cyclicDependencyErrorWithDetails(defName, path);
   }
   ```
   Deduplication (`dedup`) is not dev-only, so a diamond import is collapsed in both modes; a genuine
   cycle only reports in dev.

The `ModuleWithProviders` half is processed **after** everything else, which is an ordering fact with
teeth — a `forRoot()` config wins over the same token provided by a plain module in the same call:

```ts
// Collect all providers from `ModuleWithProviders` types.
if (injectorTypesWithProviders !== undefined) {
  processInjectorTypesWithProviders(injectorTypesWithProviders, collectProviders);
}
```

(Combine with the brief's verified `R3Injector.processProvider` fact — **last non-multi provider wins** —
to make the consequence concrete.)

### 5.3 NG0800 — passing it a standalone component

```ts
if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp) {
  const cmpDef = getComponentDef(source);
  if (cmpDef?.standalone) {
    throw new RuntimeError(
      RuntimeErrorCode.IMPORT_PROVIDERS_FROM_STANDALONE,
      `Importing providers supports NgModule or ModuleWithProviders but got a standalone component "${stringifyForError(
        source,
      )}"`,
    );
  }
}
```

`IMPORT_PROVIDERS_FROM_STANDALONE = 800` (`packages/core/src/errors.ts`), so the code is **NG0800**.
🔴 The check is `ngDevMode`-guarded — in a production build it silently does nothing useful instead of
throwing.

Note the `checkForStandaloneCmp` parameter: the framework's *own* internal call passes `false`
(`internalImportProvidersFrom(false, componentDef.type)` in `StandaloneService`, §1.4) precisely because
it *is* walking a standalone component. Public API forbids it; the internal path depends on it.

### 5.4 NG0207 — using it in the wrong place

`packages/core/src/render3/errors_di.ts`. Two distinct messages under one code:

```ts
} else if (isEnvironmentProviders(provider)) {
  if (provider.ɵfromNgModule) {
    throw new RuntimeError(
      RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
      `Invalid providers from 'importProvidersFrom' present in a non-environment injector. 'importProvidersFrom' can't be used for component providers.`,
    );
  } else {
    throw new RuntimeError(
      RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
      `Invalid providers present in a non-environment injector. 'EnvironmentProviders' can't be used for component providers.`,
    );
  }
}
```

`PROVIDER_IN_WRONG_CONTEXT = -207` → **NG0207**.

angular.dev's NG0207 page (https://angular.dev/errors/NG0207) covers it well; verbatim:

> *"This error occurs when `EnvironmentProviders` are used in a context that only accepts regular
> providers, such as a component's `providers` array. Environment providers are designed for
> application-wide configuration and can only be used in environment injectors (like the root injector
> configured in `bootstrapApplication` or route configurations)."*

> *"Functions like `provideHttpClient()` return `EnvironmentProviders`, which cannot be used at the
> component level"*

> *"The error message specifies which provider caused the issue. Check that all items in your component's
> `providers` array are regular providers, not environment providers returned by functions like
> `provideHttpClient()`, `provideRouter()`, or `importProvidersFrom()`."*

### 5.5 `loadChildren` with a legacy module

The type still accepts an `NgModule` class, from `goldens/public-api/router/index.api.md` at v22.1.5:

```ts
export type LoadChildren = LoadChildrenCallback;

export type LoadChildrenCallback = () =>
  | Type<any>
  | NgModuleFactory<any>
  | Routes
  | Observable<Type<any> | Routes | DefaultExport<Type<any>> | DefaultExport<Routes>>
  | Promise<NgModuleFactory<any> | Type<any> | Routes | DefaultExport<Type<any>> | DefaultExport<Routes>>;
```

Both shapes, verbatim from `packages/router/src/models.ts`:

```ts
[{
  path: 'lazy',
  loadChildren: () => import('./lazy-route/lazy.module').then(mod => mod.LazyModule),
}];
```
```ts
[{
  path: 'lazy',
  loadChildren: () => import('./lazy-route/lazy.routes').then(mod => mod.ROUTES),
}];
```

> *"If the lazy-loaded routes are exported via a `default` export, the `.then` can be omitted"*

```ts
[{
  path: 'lazy',
  loadChildren: () => import('./lazy-route/lazy.routes'),
}];
```

🔴 **The injector-parenting rule**, verbatim from `Route.providers`' own doc comment — this is the
sentence that makes the hybrid work:

> *"A `Provider` array to use for this `Route` and its `children`. The `Router` will create a new
> `EnvironmentInjector` for this `Route` and use it for this `Route` and its `children`. If this route
> also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be used as the
> parent of the lazy loaded module."*

So a lazy `NgModule` reached by `loadChildren` gets its own module injector, parented to the route's
environment injector. Providers stay scoped to that route subtree — which is the one case where
`loadChildren` with a module is genuinely better than hoisting `importProvidersFrom` to the root.

### 5.6 The migration's own bridging output — a complete worked before/after

From `packages/core/schematics/ng-generate/standalone-migration/README.md`, this is what the
`standalone-bootstrap` mode produces. It is the canonical shape of a bridged bootstrap, and it is a
primary source, so the chunk can print it as-is:

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

Read what the migration chose: `RouterModule.forRoot(...)` became `provideRouter(...)`,
`BrowserAnimationsModule` became `provideAnimations()`, and only `SharedModule` — which has no
`provide*` equivalent — stayed behind `importProvidersFrom`. **That is the rule in one example:
`importProvidersFrom` is the residue after every module with a real function has been converted.**

The migration states this policy explicitly:

> *"If an API with a standalone equivalent is detected, it may be converted automatically as well. E.g.
> `RouterModule.forRoot` will become `provideRouter`."*

### 5.7 The one-way door

`importProvidersFrom` is a bridge in one direction only. There is no `exportProvidersTo`, no way to get
a component's `imports` into a module, and no supported way to unwrap an `EnvironmentProviders` back
into a readable list. Its type is `{ ɵbrand: 'EnvironmentProviders' }` (§4.3) and the real payload lives
on the non-public `ɵproviders`. **Anything that reads `ɵproviders` is reaching into private API** — say
so if the page is tempted to show it.

---

## §6 · Chunk 09 — "The standalone migration schematic"

*(planned file `09-the-standalone-migration-schematic.md`, `sidebar_position: 9`)*

### 6.1 The command and its two options

`packages/core/schematics/collection.json` at v22.1.5, verbatim entry:

```json
"standalone-migration": {
  "description": "Converts the entire application or a part of it to standalone",
  "factory": "./bundles/standalone-migration.cjs#migrate",
  "schema": "./ng-generate/standalone-migration/schema.json",
  "aliases": ["standalone"]
}
```

Note the alias — `ng g @angular/core:standalone` and `ng g @angular/core:standalone-migration` are the
same schematic.

`schema.json`, verbatim, which is where the **three modes and their exact string values** live:

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

🔴 **The `mode` values are `convert-to-standalone`, `prune-ng-modules`, `standalone-bootstrap`** — not
the prose labels. Chunk 01b already cites `--mode=standalone-bootstrap`; that is correct.

### 6.2 🔴 The REQUIRED order, in Angular's own words

`README.md` of the schematic, verbatim:

> *"The standalone migration involves multiple distinct operations, and as such has to be run multiple
> times. Authors should verify that the app still works between each of the steps. If the application is
> large, it can be easier to use the `path` option to migrate specific sub-sections of the app
> individually."*

> *"The migration is made up the following modes that are intended to be run in the order they are listed
> in: 1. Convert declarations to standalone. 2. Remove unnecessary NgModules. 3. Switch to standalone
> bootstrapping API."*

The ten-step flow, verbatim:

> *"1. `ng generate @angular/core:standalone`. 2. Select the "Convert all components, directives and pipes
> to standalone" option. 3. Verify that the app works and commit the changes. 4. `ng generate
> @angular/core:standalone`. 5. Select the "Remove unnecessary NgModule classes" option. 6. Verify that
> the app works and commit the changes. 7. `ng generate @angular/core:standalone`. 8. Select the
> "Bootstrap the application using standalone APIs" option. 9. Verify that the app works and commit the
> changes. 10. Run your linting and formatting checks, and fix any failures. Commit the result."*

The non-interactive equivalent, safe to write as shell **source** (never as a transcript):

```bash
ng generate @angular/core:standalone --mode=convert-to-standalone
# verify, commit
ng generate @angular/core:standalone --mode=prune-ng-modules
# verify, commit
ng generate @angular/core:standalone --mode=standalone-bootstrap
# verify, commit, then run your formatter and linter
```

angular.dev's version of the same list (https://angular.dev/reference/migrations/standalone), verbatim:

> *"Run the migration in the order listed below, verifying that your code builds and runs between each
> step"*

> *"NOTE: While the schematic can automatically update most code, some edge cases require developer
> intervention. You should plan to apply manual fixes after each step of the migration. Additionally, the
> new code generated by the schematic may not match your code's formatting rules."*

and the README's blunter version, verbatim:

> *"The schematic often needs to generate new code or copy existing code to different places. This means
> that likely the formatting won't match your app anymore and there may be some lint failures. The
> application should compile, but it's expected that the author will fix up any formatting and linting
> failures."*

### 6.3 Prerequisites, verbatim

> *"Before using the schematic, please ensure that the project: 1. Is using Angular 15.2.0 or later.
> 2. Builds without any compilation errors. 3. Is on a clean Git branch and all work is saved."*

### 6.4 What each mode does

**Mode 1 — `convert-to-standalone`.** angular.dev, verbatim:
> *"In this mode, the migration converts all components, directives and pipes to standalone by removing
> `standalone: false` and adding dependencies to their `imports` array."*

🔴 The exception, verbatim from the README:
> *"**Note:** NgModules which bootstrap a component are explicitly ignored in this step, because they are
> likely to be root modules and they would have to be bootstrapped using `bootstrapApplication` instead
> of `bootstrapModule`. Their declarations will be converted automatically as a part of the "Switch to
> standalone bootstrapping API" step."*

Full before/after from the README, verbatim — note what happens to the **module**: the converted classes
move from `declarations` into `imports`, and the module survives:

```typescript
// BEFORE — app.module.ts
@NgModule({
  imports: [CommonModule],
  declarations: [MyComp, MyDir, MyPipe],
})
export class AppModule {}
```
```typescript
// AFTER — app.module.ts
@NgModule({
  imports: [CommonModule, MyComp, MyDir, MyPipe],
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

⚠️ Note it emitted `imports: [NgIf, …]` — the **individual directive**, not `CommonModule`. And it left
`*ngIf` in the template. So the migration produces code that is standalone but still v16-flavoured; the
control-flow and common-to-standalone schematics are the follow-ups (§8.4).

**Mode 2 — `prune-ng-modules`.** The removal criteria, verbatim (identical in both sources):

> *"A module is considered "safe to remove" if it: Has no `declarations`. Has no `providers`. Has no
> `bootstrap` components. Has no `imports` that reference a `ModuleWithProviders` symbol or a module that
> can't be removed. Has no class members. Empty constructors are ignored."*

and the marker it leaves when it cannot finish the job, verbatim:

```typescript
/* TODO(standalone-migration): clean up removed NgModule reference manually */
```

with the README's example of an inline reference it cannot delete:

```typescript
console.log(
  /* TODO(standalone-migration): clean up removed NgModule reference manually */ ImporterModule,
);
```

🔴 Read the criteria as a checklist for *why your module survived*. A module with a single `provider`
survives. A module with an empty constructor is fine; a module with one method is not. A module that
imports `RouterModule.forRoot(...)` is not removable because that is a `ModuleWithProviders`.

**Mode 3 — `standalone-bootstrap`.** The seven steps it performs, verbatim from the README:

> *"1. Generate the `bootstrapApplication` call to replace the `bootstrapModule` one. 2. Convert the
> `declarations` of the module that is being bootstrapped to `standalone`. These modules were skipped
> explicitly in the first step of the migration. 3. Copy any `providers` from the bootstrapped module
> into the `providers` option of `bootstrapApplication`. 4. Copy any classes from the `imports` array of
> the rootModule to the `providers` option of `bootstrapApplication` and wrap them in an
> `importsProvidersFrom` function call. 5. Adjust any dynamic import paths so that they're correct when
> they're copied over. 6. If an API with a standalone equivalent is detected, it may be converted
> automatically as well. E.g. `RouterModule.forRoot` will become `provideRouter`. 7. Remove the root
> module."*

⚠️ Step 4 says **`importsProvidersFrom`** — a typo for `importProvidersFrom` in the upstream README. The
generated code in the same file is correct. If you quote step 4, note the typo or quote around it.

> *"If the migration detects that the `providers` or `imports` of the root module are referencing code
> outside of the class declaration, it will attempt to carry over as much of it as it can to the new
> location. If some of that code is exported, it will be imported in the new location, otherwise it will
> be copied over."*

The full worked example is in §5.6 — do not print it twice; this chunk owns it and chunk 08 cross-links.

### 6.5 🔴 What the schematic cannot do

angular.dev, verbatim. **Common problems:**

> *"Compilation errors - if the project has compilation errors, Angular cannot analyze and migrate it
> correctly."*
> *"Files not included in a tsconfig - the schematic determines which files to migrate by analyzing your
> project's `tsconfig.json` files. The schematic excludes any files not captured by a tsconfig."*
> *"Code that cannot be statically analyzed - the schematic uses static analysis to understand your code
> and determine where to make changes. The migration may skip any classes with metadata that cannot be
> statically analyzed at build time."*

**Limitations:**

> *"Because unit tests are not ahead-of-time (AoT) compiled, `imports` added to components in unit tests
> might not be entirely correct."*
> *"The schematic relies on direct calls to Angular APIs. The schematic cannot recognize custom wrappers
> around Angular APIs. For example, if there you define a custom `customConfigureTestModule` function
> that wraps `TestBed.configureTestingModule`, components it declares may not be recognized."*

(The *"if there you define"* wording is upstream.)

**After the migration**, verbatim:

> *"Find and remove any remaining `NgModule` declarations: since the ["Remove unnecessary NgModules"
> step](#remove-unnecessary-ngmodules) cannot remove all modules automatically, you may have to remove
> the remaining declarations manually."*
> *"Run the project's unit tests and fix any failures."*

That test warning plus the AoT limitation is the single most valuable gotcha in this chunk: **the
migration is least reliable exactly where you have the least type checking.**

### 6.6 What this schematic is *not*

Three separate things a reader will confuse it with:

| Command | What it does | Since |
|---|---|---|
| `ng update @angular/core@19` | Runs `explicit-standalone-flag`, which adds `standalone: false` and strips `standalone: true`. **Chunk 03 owns this.** | 19.0.0 |
| `ng g @angular/core:standalone` | The three-mode migration above. | 15.2.0 minimum target |
| `ng g @angular/core:cleanup-unused-imports` | Deletes NG8113-flagged entries. **Chunk 05 owns this.** | 19.1.0 |
| `ng g @angular/core:common-to-standalone` | Replaces `CommonModule` with the individual symbols. **Chunk 06's fix, in schematic form.** | 21.0.0 |
| `ng g @angular/core:control-flow` | Rewrites `*ngIf`/`*ngFor`/`ngSwitch` to `@if`/`@for`/`@switch`. | 17 |

---

## §7 · Chunk 10 — "Why standalone makes the graph splittable"

*(planned file `10-why-standalone-makes-the-graph-splittable.md`, `sidebar_position: 10`)*

### 7.1 🔴 The concrete fact: `@defer` refuses non-standalone dependencies

angular.dev `guide/templates/defer` → https://angular.dev/guide/templates/defer. Verbatim, and this is
the load-bearing quote of the whole chunk:

> *"In order for the dependencies within a `@defer` block to be deferred, they need to meet two
> conditions:"*
> *"1. **They must be standalone.** Non-standalone dependencies cannot be deferred and are still eagerly
> loaded, even if they are inside of `@defer` blocks."*
> *"1. **They cannot be referenced outside of `@defer` blocks within the same file.** If they are
> referenced outside the `@defer` block or referenced within ViewChild queries, the dependencies will be
> eagerly loaded."*

(The numbering `1.` / `1.` is upstream markdown; both render as 1 and 2.)

And restated later in its own section, *"Does `@defer` work with `NgModule`?"*, verbatim:

> *"`@defer` blocks are compatible with both standalone and NgModule-based components, directives and
> pipes. However, **only standalone components, directives and pipes can be deferred**. NgModule-based
> dependencies are not deferred and are included in the eagerly loaded bundle."*

🔴 **Note the failure mode: it is silent.** There is no error, no warning. The block still renders, the
triggers still fire, and the code is simply in the main bundle. That is the sharpest gotcha this chunk
has — a `standalone: false` left over from a half-finished migration turns `@defer` into decoration.

The nuance that saves this from being over-claimed, verbatim:

> *"The _transitive_ dependencies of the components, directives and pipes used in the `@defer` block do
> not strictly need to be standalone; transitive dependencies can still be declared in an `NgModule` and
> participate in deferred loading."*

So the rule is precise: **the classes named directly in the deferred template must be standalone**; what
*they* depend on need not be.

### 7.2 The mechanism — one dynamic import per dependency

Verbatim from the same guide:

> *"The code for any components, directives, and pipes inside the `@defer` block is split into a separate
> JavaScript file and loaded only when necessary, after the rest of the template has been rendered."*

> *"Angular's compiler produces a [dynamic import](…) statement for each component, directive, and pipe
> used in the `@defer` block. The main content of the block renders after all the imports resolve.
> Angular does not guarantee any particular order for these imports."*

and from the `deferredImports` field's own doc (`packages/core/src/metadata/directives.ts`), which is the
internal mechanism behind it:

> *"Angular *always* generates dynamic imports for such symbols and removes the regular/eager import."*

**Why locality is what makes this possible**, in one sentence you can defend: the compiler can rewrite an
eager `import` into a dynamic one **only if it knows every template that references the symbol**. With
`imports`, that set is one file. With an ambient `NgModule` scope, the symbol is visible to every
component declared in the module and to every module that imports it transitively — so no single
rewrite is safe. That is an argument from §1.3 and §4.4, not a doc quote; phrase it as reasoning, not as
a citation.

### 7.3 The three eager-loading traps, all from primary sources

**(a) Referenced outside the block.** Quoted in §7.1. Includes `viewChild` queries.

**(b) Barrel files.** angular.dev, verbatim:

> *"If you're using `@defer` but not seeing a separate lazy chunk in your build output, check how you're
> importing the deferred component. Importing through a barrel file (`index.ts`) is a common culprit —
> bundlers see the barrel as a single module and keep all its exports together, so your component ends up
> in the main bundle regardless of `@defer`."*

with its example, verbatim:

```typescript
// index.ts
export {HeavyComponent} from './heavy.component';
export {OtherComponent} from './other.component';
```
```typescript
// parent.component.ts
import {HeavyComponent} from './index'; // pulls in OtherComponent too
```

**(c) HMR.** angular.dev, verbatim:

> *"When Hot Module Replacement (HMR) is active, all `@defer` block chunks are fetched eagerly, overriding
> any configured triggers. To restore the standard trigger behavior, you must disable HMR by serving your
> application with the `--no-hmr` flag."*

This is why "my `@defer` block loads immediately in `ng serve`" is usually not a bug. Runtime code
`DEFER_IN_HMR_MODE = -751` exists for the same reason.

**(d) SSR.** Verbatim:

> *"By default, when rendering an application on the server (either using SSR or SSG), defer blocks always
> render their `@placeholder` (or nothing if a placeholder is not specified) and triggers are not invoked.
> On the client, the content of the `@placeholder` is hydrated and triggers are activated."*

⚠️ Incremental hydration is the exception — and per the lane brief's correction block,
`withIncrementalHydration` is **deprecated in v22**: it is on by default with `provideClientHydration`,
and you opt *out* with `withNoIncrementalHydration()`. Do not present `withIncrementalHydration()` as the
modern call.

### 7.4 The compiler's used/unused split, restated for this chunk

§1.6's `componentDependenciesToDeclarations` code, plus this from `handler.ts` — the compiler tracks
**eager** and **whole-template** usage separately, which is precisely the bookkeeping `@defer` needs:

```ts
// Set of Directives and Pipes used across the entire template,
// including all defer blocks.
const wholeTemplateUsed = new Set<ClassDeclaration>(eagerlyUsed);
for (const bound of deferBlocks.values()) {
  for (const dir of bound.getUsedDirectives()) {
    wholeTemplateUsed.add(dir.ref.node);
  }
  for (const name of bound.getUsedPipes()) {
    if (!pipes.has(name)) {
      continue;
    }
    wholeTemplateUsed.add(pipes.get(name)!.ref.node);
  }
}
```

and, in `handleDependencyCycles`, the line that shows **NgModules are never deferrable**:

```ts
const eagerDeclarations = Array.from(declarations.values()).filter((decl) => {
  return decl.kind === R3TemplateDependencyKind.NgModule || eagerlyUsed.has(decl.ref.node);
});
```

🔴 `decl.kind === R3TemplateDependencyKind.NgModule ||` — an NgModule dependency is **unconditionally
eager**. That is the source-level counterpart to the doc sentence in §7.1, and it is stronger evidence
than the doc alone.

### 7.5 The other halves of the locality payoff

Beyond `@defer`, three claims this chunk can make and support:

1. **Route-level code splitting.** `loadComponent` takes a component directly
   (`() => Type<unknown> | Observable<…> | Promise<…>`), no module in between — from the v22.1.5 router
   public API. And `ng g @angular/core:route-lazy-loading` exists to convert eager route references,
   described in `collection.json` verbatim: *"Updates route definitions to use lazy-loading of components
   instead of eagerly referencing them"*.
2. **Per-component compilation caching.** `StandaloneComponentScopeReader` keys its cache on the
   component class (`private cache = new Map<ClassDeclaration, StandaloneScope | null>()`), so a scope is
   computed once per component and invalidated per component. An `NgModule` scope is keyed on the module
   and invalidated for every declaration in it.
3. **"Who uses this directive?" is a text search.** Because the only way into a template scope is a class
   reference in an `imports` array, `grep -rn 'MyDirective'` is a complete answer. Under module scope it
   was not, because the reference could be three modules away. This is an argument, not a quote — say so.

---

## §8 · Chunk 11 — "Where `NgModule` still legitimately appears"

*(planned file `11-where-ngmodule-still-legitimately-appears.md`, `sidebar_position: 11`)*

### 8.1 The framing — Angular's own recommendation, verbatim

angular.dev `guide/ngmodules/overview`, its opening banner:

> *"IMPORTANT: The Angular team recommends using [standalone components](guide/components) instead of
> `NgModule` for all new code. Use this guide to understand existing code built with `@NgModule`."*

and further down:

> *"IMPORTANT: The Angular team recommends using [bootstrapApplication](api/platform-browser/bootstrapApplication)
> instead of `bootstrapModule` for all new code. Use this guide to understand existing applications
> bootstrapped with `@NgModule`."*

🔴 **"Recommends against" is not "deprecates".** `@NgModule` carries **no** `@deprecated` tag in the
v22.1.5 typings (§0.3). Say both halves.

### 8.2 Third-party libraries — `@angular/material` 22.1.5 as the worked case

Verified against the published typings at `@angular/material@22.1.5` (`types/button.d.ts`, read from
unpkg). `MatButtonModule` still exists **and** every component in it is standalone:

```ts
declare class MatButtonModule {
    static ɵfac: i0.ɵɵFactoryDeclaration<MatButtonModule, never>;
    static ɵmod: i0.ɵɵNgModuleDeclaration<MatButtonModule, never,
      [typeof MatRippleModule, typeof MatButton, typeof MatMiniFabButton, typeof MatIconButton, typeof MatFabButton],
      [typeof i2.BidiModule, typeof MatButton, typeof MatMiniFabButton, typeof MatIconButton, typeof MatFabButton]>;
    static ɵinj: i0.ɵɵInjectorDeclaration<MatButtonModule>;
}
```

Read the four type arguments of `ɵɵNgModuleDeclaration<T, Declarations, Imports, Exports>`:

- **`Declarations` is `never`** — the module declares nothing.
- `Imports` and `Exports` list the standalone components themselves.

So `MatButtonModule` in v22 is **a convenience re-export bundle, not a compilation scope.** And
`MatButton`'s own definition confirms the standalone flag (the second-to-last type argument of
`ɵɵComponentDeclaration` is `true`):

```ts
static ɵcmp: i0.ɵɵComponentDeclaration<MatButton, "button[matButton], a[matButton], …",
  ["matButton", "matAnchor"], { "appearance": { "alias": "matButton"; "required": false; }; },
  {}, never, [ /* ngContentSelectors */ ], true, never>;
```

**The rule for the page:** in 2026, a library `NgModule` is usually a *bundle*, and importing it is
usually the lazy option — `imports: [MatButton]` is the smaller, more honest import, and NG8113 can then
tell you when it goes stale (§2.3 — it cannot tell you that about `MatButtonModule`).

### 8.3 `TestBed` — the `DynamicTestModule` you never wrote

🔴 **`TestBed` builds an `NgModule` for every test, in every Angular app, standalone or not.**
`packages/core/testing/src/test_bed_compiler.ts`, verbatim:

```ts
constructor(
  private platform: PlatformRef,
  private additionalModuleTypes: Type<any> | Type<any>[],
) {
  class DynamicTestModule {}
  this.testModuleType = DynamicTestModule as any;
}
```

That anonymous class is the module every `TestBed.configureTestingModule({...})` call configures. It is
why a stack trace in a test says `DynamicTestModule` and why `TestBed`'s API is shaped like `@NgModule`
metadata (`declarations`, `imports`, `providers`, `schemas`) even in a v22 app with no modules in it.

And it enforces the standalone rule in the same file:

```ts
configureTestingModule(moduleDef: TestModuleMetadata): void {
  // Enqueue any compilation tasks for the directly declared component.
  if (moduleDef.declarations !== undefined) {
    // Verify that there are no standalone components
    assertNoStandaloneComponents(
      moduleDef.declarations,
      this.resolvers.component,
      '"TestBed.configureTestingModule" call',
    );
    // ...
  }
  // ...
}
```

```ts
function assertNoStandaloneComponents(
  types: Type<any>[],
  resolver: Resolver<any>,
  location: string,
) {
  types.forEach((type) => {
    if (!getAsyncClassMetadataFn(type)) {
      const component = resolver.resolve(type);
      if (component && (component.standalone == null || component.standalone)) {
        throw new Error(ɵgenerateStandaloneInDeclarationsError(type, location));
      }
    }
  });
}
```

🔴 Note `component.standalone == null || component.standalone` — **an omitted flag counts as
standalone**, matching the compiler's v19+ default.

The message, verbatim from `packages/core/src/render3/jit/module.ts`:

```ts
export function generateStandaloneInDeclarationsError(type: Type<any>, location: string) {
  const prefix = `Unexpected "${stringifyForError(type)}" found in the "declarations" array of the`;
  const suffix =
    `"${stringifyForError(type)}" is marked as standalone and can't be declared ` +
    'in any NgModule - did you intend to import it instead (by adding it to the "imports" array)?';
  return `${prefix} ${location}, ${suffix}`;
}
```

Assembled, the exact string a test author sees:

```
Unexpected "UserCard" found in the "declarations" array of the "TestBed.configureTestingModule" call,
"UserCard" is marked as standalone and can't be declared in any NgModule - did you intend to import it
instead (by adding it to the "imports" array)?
```

The same function is reused for real modules, with `location` being `` `"${moduleType}" NgModule` ``:

```ts
const def = getPipeDef(type) || getComponentDef(type) || getDirectiveDef(type);
if (def?.standalone) {
  const location = `"${stringifyForError(moduleType)}" NgModule`;
  errors.push(generateStandaloneInDeclarationsError(type, location));
}
```

**The one-line rule for tests in v22: `imports`, never `declarations`.**

Adjacent verified fact worth a line: `verifySemanticsOfNgModuleDef` opens with

```ts
// skip verifications of standalone components, directives, and pipes
if (isStandalone(moduleType)) return;
```

— a standalone class passed where a module was expected is skipped, not diagnosed.

### 8.4 `createNgModule` — the supported imperative escape hatch

Still `@public` in v22.1.5 (`goldens/public-api/core/index.api.md`):

```ts
export function createNgModule<T>(ngModule: Type<T>, parentInjector?: Injector): NgModuleRef<T>;
```

⚠️ **`createNgModuleRef` was removed in v22.0.0** (chunk 03's fact) — as were `ComponentFactory` and
`ComponentFactoryResolver`. `createNgModule` is the survivor. Use it, name the removed one as removed.

Its natural companions in the same golden:

```ts
export function createEnvironmentInjector(providers: Array<Provider | EnvironmentProviders>, parent: EnvironmentInjector, debugName?: string | null): EnvironmentInjector;

export function createComponent<C>(component: Type<C>, options: {
    environmentInjector: EnvironmentInjector;
    hostElement?: Element;
    elementInjector?: Injector;
    projectableNodes?: Node[][];
    directives?: (Type<unknown> | DirectiveWithBindings<unknown>)[];
    bindings?: Binding[];
}): ComponentRef<C>;

export function reflectComponentType<C>(component: Type<C>): ComponentMirror<C> | null;
```

`ComponentMirror` exposes `get isStandalone(): boolean;` — so a library that must branch on standalone-ness
at runtime has a supported way to ask, alongside `isStandalone(type)` (chunk 03 covers the latter).

### 8.5 The AngularJS hybrid

`@angular/upgrade` is published at **22.1.5** and `UpgradeModule` is a live, undeprecated `NgModule`.
From `goldens/public-api/upgrade/static/index.api.md` at `v22.1.5`:

```ts
// @public
export class UpgradeModule {
    $injector: any;
    constructor(
    injector: Injector,
    ngZone: NgZone,
    platformRef: PlatformRef);
    bootstrap(element: Element, modules?: string[], config?: any): any;
    injector: Injector;
    ngZone: NgZone;
    static ɵmod: i0.ɵɵNgModuleDeclaration<UpgradeModule, never, never, never>;
}
```

Its neighbours in the same golden, all `@public`: `downgradeComponent`, `downgradeInjectable`,
`downgradeModule`, `getAngularJSGlobal`, `setAngularJSGlobal`, `UpgradeComponent`. Note
`UpgradeComponent`'s `ɵdir` declaration ends `…, true, never>` — **it is standalone**; only
`UpgradeModule` is a module. And one overload is marked deprecated:

```ts
// @public @deprecated
export function downgradeModule<T>(moduleOrBootstrapFn: NgModuleFactory<T>): string;
```

A hybrid app is the one place where a root `NgModule` is not a legacy artefact but the mechanism: the
AngularJS injector and the Angular injector have to be bridged, and `UpgradeModule` is that bridge.

### 8.6 The other places, briefly

- **`platformBrowser().bootstrapModule(AppModule)`** — not deprecated, still generated by
  `ng new --standalone=false`. Chunk **01b** owns it; cross-link, do not re-print the templates.
- **`@angular/platform-browser-dynamic`** — published at 22.1.5, both exports marked
  `@public @deprecated` since v20 (§0.3). It is the JIT platform. If you see it in a build, that is a
  finding, not a style preference.
- **`RouterModule`** — still a real `NgModule` in v22.1.5 with `forRoot`/`forChild`
  (`static forRoot(routes: Routes, config?: ExtraOptions): ModuleWithProviders<RouterModule>`), and still
  declaring/exporting `RouterOutlet`, `RouterLink`, `RouterLinkActive`, `ɵEmptyOutletComponent`. The
  standalone path is `provideRouter(routes)` + `imports: [RouterOutlet, RouterLink]`.
- **`CommonModule`** — alive, not deprecated, and legitimately convenient for a template that really does
  use six of its members. Chunk 06 owns the argument.
- **A migration in progress.** A module surviving `prune-ng-modules` because it has one provider (§6.4)
  is not a failure; it is the criteria working.

### 8.7 The honest bottom line for the page

`NgModule` in 2026 is a **compatibility surface**, not an architecture. Every place it legitimately
survives is one of four:

1. **A bundle** — a library re-exporting standalone classes for import convenience (`MatButtonModule`).
2. **A bridge** — `UpgradeModule`, or a module reached through `importProvidersFrom` (§5).
3. **A framework internal you did not write** — `DynamicTestModule`.
4. **Code that has not been migrated yet** — and for that there is a schematic (§6).

If a module in a 2026 codebase is none of those four, it is the fourth one and nobody has noticed.

---

## §9 · Where angular.dev and the v22.1.5 source disagree

🔴 **In every case the source wins, and a page that touches the disagreement should say so.**

### 9.1 NG8002's page names the wrong runtime code — CONFIRMED

`adev/src/content/reference/errors/NG8002.md` → https://angular.dev/errors/NG8002, verbatim:

> *"The runtime error for this is `NG0304: '${tagName}' is not a known element: …'`."*

That is the **element** error. The runtime error for an unknown **property** is
`UNKNOWN_BINDING = 303` → **NG0303**, message `Can't bind to 'x' since it isn't a known property of 'y'`
(`packages/core/src/errors.ts`; `packages/core/src/render3/instructions/element_validation.ts`).

NG8001's page cites NG0304 correctly:
> *"This is the compiler equivalent of a common runtime error `NG0304: '${tagName}' is not a known
> element: ...`."*

So the correct pairing is NG8001↔NG0304 and NG8002↔NG0303, and the NG8002 page copied the wrong line.
**Chunk 06 must say this.** There is also no `NG0303.md` or `NG0304.md` in the adev error reference at
all — the directory listing has NG0300, NG0301, NG0302, then jumps to NG0318.

### 9.2 The DI troubleshooting guide still shows `NullInjectorError` — from the lane brief, carried here

`NullInjectorError: No provider for X!` **no longer exists in v20+**. `null_injector.ts` throws
``No provider found for `X`.`` with `error.name = 'ɵNotFound'` and `formatRuntimeError` prefixes
`NG0201: `. angular.dev's DI troubleshooting guide is stale. Not this topic's subject, but if any chunk
here reaches for that string — don't.

### 9.3 "Extended diagnostics require `strictTemplates`" vs NG8113's actual gate — NUANCE

angular.dev (https://angular.dev/extended-diagnostics), verbatim:
> *"Extended diagnostics will emit when [`strictTemplates`](tools/cli/template-typecheck#strict-mode) is
> enabled."*

But NG8113 is implemented as a `SourceFileValidatorRule`, and `runAdditionalChecks` guards only the
extended checks with `this.strictTemplates` (§2.4). Read literally, NG8113 would emit with
`strictTemplates: false`. ⚠️ **This is source reading, not a run** — record it as *"the source suggests
X; nothing was executed to confirm it"*, and note that since `strictTemplates` defaults to `true` in v22
(§0.5) the distinction is nearly always moot.

### 9.4 The compiler's own NG8002 message still recommends `CommonModule` — BY DESIGN, BUT DATED

For `ng-`-prefixed tags the compiler emits *"If '${name}' is an Angular directive, then add
'CommonModule' to the '@Component.imports' of this component"* (§3.3), while the control-flow migration
doc says *"you don't need to import `CommonModule` anymore"* (§3.5a). Both are in the shipped v22.1.5
tree. Not a bug — the DOM schema checker has no way to know you meant `@if` — but it is exactly why
readers keep adding `CommonModule`. **Chunk 06 should name this collision explicitly.**

### 9.5 The NG2010 related-information still says "add `standalone: true`"

`Did you forget to add 'standalone: true' to this @Component?` (§2.6) is v14-era phrasing shipped in
v22.1.5. In v22 the actual fix is almost always to delete a `standalone: false`. Not a contradiction with
any doc — a contradiction with the version's own defaults. Worth one sentence in chunk 05.

### 9.6 Upstream typos to quote carefully, not silently fix

| Where | Text as written |
|---|---|
| v16.0.0 release notes | *"they weren't doing anyting"* |
| standalone-migration README, step 4 | *"wrap them in an `importsProvidersFrom` function call"* (should be `importProvidersFrom`) |
| extended-diagnostics overview | *"The compiler will still exist with status code 0"* (should be *exit*) |
| adev standalone migration, Limitations | *"if there you define a custom `customConfigureTestModule` function"* |

If you quote these, quote them as written. Do not present a cleaned-up quote as verbatim.

---

## §10 · UNSETTLED — write as uncertain or leave out

1. **Whether NG8113 actually emits with `strictTemplates: false`.** §9.3. Source reading says yes; the
   docs say the family requires `strictTemplates`. **No sandbox, so unverified.** Write: *"the compiler
   source runs this rule outside the `strictTemplates` gate; the documentation says extended diagnostics
   require `strictTemplates`. Since `strictTemplates` defaults to `true` in v22, the distinction rarely
   surfaces."*
2. **Any bundle-size number for `CommonModule`, for an unused import, or for `importProvidersFrom`.**
   Nothing was built. ⛔ No figures, no percentages, no "adds N kB". §1.6 gives the qualitative,
   source-backed statement; use only that.
3. **Any compilation-time number.** angular.dev says unused imports *"can increase your compilation
   time"* (§2.8) — that sentence may be quoted as Angular's claim. No measurement of it exists here.
4. **The exact release that dropped `@developerPreview` from `standalone`.** Chunk 03 already establishes
   the evidence is the typings diff between 14.3.0 and 15.2.10 and that **no changelog sentence announces
   it**. Do not invent one.
5. **Whether `ng g @angular/core:standalone` accepts `--mode` non-interactively in every CLI
   configuration.** The schema declares `mode` with an `x-prompt`, so the flag exists; the exact
   interactive/non-interactive behaviour was not exercised. Present the flags as the schema declares
   them, not as observed CLI behaviour.
6. **Whether third-party libraries other than `@angular/material` still ship NgModules.** Only Material
   22.1.5 and `@angular/upgrade` 22.1.5 were checked. Do not generalise to "most libraries" — say
   "Angular Material 22.1.5, for example".
7. **`@angular/material` release-history claims.** Only the current 22.1.5 typings were read. The
   `angular/components` repo tags did not resolve through the API here, so nothing historical about
   Material can be asserted.
8. **The precise first version of `MatButton` being standalone.** Not checked. Only "standalone in
   22.1.5" is supported.
9. **Whether NG8113 fires for a symbol used only inside a `@defer` block.** The rule compares against
   `getUsedDirectives`/`getUsedPipes` from the `TemplateTypeChecker`, while the *emit* path distinguishes
   `eagerlyUsed` from `wholeTemplateUsed` (§7.4). Which set the type-checker's `getUsedDirectives`
   corresponds to was **not** traced to the bottom. If a chunk wants to claim it, trace
   `TemplateTypeChecker.getUsedDirectives` first, or write it as unknown.
10. **Any claim about what `ngtsc` emits as generated code (`ɵɵ` instruction calls, `ɵcmp` literals).**
    Nothing here is a compiled-output dump. The only generated-code shapes in this bank are the *type
    declarations* in published `.d.ts` files (§8.2), which are source, not output. If a chunk shows a
    `ɵcmp` literal it must be labelled `// pseudo-code — illustrative of the shape`.

---

## §11 · Source inventory

### Read from `angular/angular` at tag `v22.1.5`

| Path | Used by |
|---|---|
| `packages/core/src/metadata/directives.ts` | §0.7, §1.1, §7.2 |
| `packages/core/src/metadata/ng_module.ts` | §4.1 |
| `packages/core/src/errors.ts` | §0.6, §3.1, §5.3, §5.4 |
| `packages/core/src/di/provider_collection.ts` | §4.3, §5.1, §5.2, §5.3 |
| `packages/core/src/render3/errors_di.ts` | §5.4 |
| `packages/core/src/render3/standalone_service.ts` | §1.4 |
| `packages/core/src/render3/definition.ts` | §1.4 |
| `packages/core/src/render3/component_ref.ts` | §6-adjacent (orphan component, NG0981) |
| `packages/core/src/render3/deps_tracker/deps_tracker.ts` | §1.7, §4.4 |
| `packages/core/src/render3/jit/module.ts` | §8.3 |
| `packages/core/src/render3/instructions/element_validation.ts` | §3.4 |
| `packages/core/testing/src/test_bed_compiler.ts` | §8.3 |
| `packages/core/schematics/collection.json` | §6.1, §6.6 |
| `packages/core/schematics/ng-generate/standalone-migration/{README.md,schema.json}` | §6 |
| `packages/core/schematics/ng-generate/cleanup-unused-imports/{schema.json,unused_imports_migration.ts}` | §2.5 |
| `packages/common/src/common_module.ts`, `src/directives/index.ts`, `src/pipes/index.ts`, `src/directives/ng_if.ts` | §0.3, §3.5d |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts` | §0.6, §2.6, §2.7 |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts` | §0.6 |
| `packages/compiler-cli/src/ngtsc/core/src/compiler.ts` | §0.5, §2.1, §2.4 |
| `packages/compiler-cli/src/ngtsc/validation/src/source_file_validator.ts` | §2.4 |
| `packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts` | §2.1–2.3 |
| `packages/compiler-cli/src/ngtsc/scope/src/standalone.ts` | §1.3 |
| `packages/compiler-cli/src/ngtsc/scope/src/util.ts` | §2.6 |
| `packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts` | §1.5, §1.6, §2.6, §7.4 |
| `packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts` | §1.5, §2.6 |
| `packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts` | §2.7 |
| `packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts` | §3.2, §3.3 |
| `packages/compiler-cli/src/ngtsc/typecheck/extended/api/format-extended-error.ts` | §3.6 |
| `packages/compiler-cli/src/ngtsc/typecheck/extended/checks/missing_control_flow_directive/index.ts` | §3.5b |
| `packages/compiler-cli/src/ngtsc/typecheck/extended/checks/missing_structural_directive/index.ts` | §2.7 |
| `packages/language-service/src/codefixes/fix_unused_standalone_imports.ts` | §2.5 |
| `packages/router/src/models.ts` | §5.5 |
| `goldens/public-api/core/index.api.md` | §4.1, §4.3, §5.1, §8.4 |
| `goldens/public-api/router/index.api.md` | §5.5, §8.6 |
| `goldens/public-api/upgrade/static/index.api.md` | §8.5 |
| `goldens/public-api/platform-browser-dynamic/index.api.md` | §0.3 |
| `adev/src/content/guide/components/anatomy-of-components.md` | §1.2 |
| `adev/src/content/guide/ngmodules/overview.md` | §1.8, §4.3, §8.1 |
| `adev/src/content/guide/templates/defer.md` | §7 |
| `adev/src/content/guide/templates/control-flow.md` | §3.5a |
| `adev/src/content/reference/migrations/standalone.md` | §6 |
| `adev/src/content/reference/migrations/cleanup-unused-imports.md` | §2.5 |
| `adev/src/content/reference/migrations/common-to-standalone.md` | §6.6 |
| `adev/src/content/reference/migrations/control-flow.md` | §3.5a |
| `adev/src/content/reference/extended-diagnostics/overview.md` | §2.1 |
| `adev/src/content/reference/extended-diagnostics/NG8113.md` | §2.8 |
| `adev/src/content/reference/errors/{NG8001,NG8002,NG0207}.md` | §3, §5.4, §9.1 |
| `adev/src/content/reference/configs/angular-compiler-options.md` | §0.5 |

### Read from `angular/angular-cli` at tag `v22.1.7`

- `packages/schematics/angular/component/files/__name@dasherize@if-flat__/__name@dasherize__.__type@dasherize__.ts.template` — §0.4
- `packages/schematics/angular/application/files/standalone-files/src/app/app.config.ts.template` — §0.4
- `packages/schematics/angular/workspace/files/tsconfig.json.template` — §0.4, §0.5

### Read at other tags (historical, for §0.8 and §4.1 only)

`packages/core/src/metadata/ng_module.ts` at `12.2.17`, `15.2.10`, `16.2.12`, `17.3.12`, `18.2.14`,
`19.2.25`, `20.3.30`, `21.2.22` · `packages/core/schematics/collection.json` at `19.0.0`, `19.1.0`,
`19.2.0`, `20.0.0`, `21.0.0` ·
`packages/compiler-cli/src/ngtsc/validation/src/rules/unused_standalone_imports_rule.ts` at `18.2.14`
(absent) and `19.0.0` (present) · `gh api repos/angular/angular/releases/tags/16.0.0`.
⚠️ Tags before v16 have **no `v` prefix**.

### Read from the npm registry (2026-09-06)

`https://registry.npmjs.org/-/package/<pkg>/dist-tags` for `@angular/core`, `@angular/cli`,
`@angular/build`, `@angular/ssr`, `@angular/material`, `@angular/cdk`, `@angular/animations`,
`@angular/upgrade`, `@angular/platform-browser-dynamic` ·
`https://registry.npmjs.org/@angular/core` (peers + publish time for 22.1.5) ·
`https://registry.npmjs.org/@angular/material/22.1.5` (exports map, peers) ·
`https://unpkg.com/@angular/material@22.1.5/types/button.d.ts`.

### Every angular.dev URL below returned HTTP 200 on 2026-09-06 — safe for `> Verified:` lines

```
https://angular.dev/guide/components/anatomy-of-components
https://angular.dev/guide/ngmodules/overview
https://angular.dev/guide/templates/defer
https://angular.dev/guide/templates/control-flow
https://angular.dev/reference/migrations/standalone
https://angular.dev/reference/migrations/cleanup-unused-imports
https://angular.dev/reference/migrations/common-to-standalone
https://angular.dev/reference/migrations/control-flow
https://angular.dev/reference/configs/angular-compiler-options
https://angular.dev/extended-diagnostics
https://angular.dev/extended-diagnostics/NG8113
https://angular.dev/errors/NG8001
https://angular.dev/errors/NG8002
https://angular.dev/errors/NG0207
https://angular.dev/api/core/importProvidersFrom
https://angular.dev/api/core/createNgModule
https://angular.dev/api/core/isStandalone
```

GitHub source links take the form
`https://github.com/angular/angular/blob/v22.1.5/<path>` — the tag exists and the `v` prefix is required.

---

## §12 · Reminders for whoever writes from this bank

- **300 lines is a file-size cap, never a content budget.** If your chunk needs more, write it all and
  split into a lettered sibling (`06-x.md` + `06b-y.md`), never renumber, and report the split.
- **Every link ends in `.md` and keeps its numeric prefix.** `ls` before you link. Chunks 04–11 are being
  written in parallel — **do not link a sibling chunk.** Anything not on disk is
  **bold text plus *(not written yet)***.
- **The footer is exactly:**
  `← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **<NN+1 · label>** *(not written yet)*`
- **MDX:** backtick `<app-user-card>`, `Signal<T>`, `Type<any>`, `ReadonlyArray<any>`,
  `EnvironmentProviders`, `ComponentDef<unknown>`, `@if {}`, `{{ interpolation }}`, and anything with a
  brace. Use `{/* … */}`, never `<!-- … -->`.
- ⛔ **Never add a ` ```console ` fence.** Nothing here was run.
- **Pick ONE gotcha form per page** — inline `**★ Symptom: …** Cause: … Fix: …`, or the
  `### Name` / `**Symptom.**` / `**Cause.**` / `**Fix.**` block form — and stay consistent.
- **Never write "the fix is X" without showing X in code.**
