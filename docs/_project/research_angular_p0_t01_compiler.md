---
name: research-angular-p0-01-compiler-with-a-framework-attached
description: Banked primary-source research for Angular Phase 0 topic 01-compiler-with-a-framework-attached — verbatim quotes and URLs for every remaining chunk.
metadata:
  type: reference
---

# Research bank — Angular Phase 0 · topic 01 `compiler-with-a-framework-attached`

Researched **2026-09-06** against `angular/angular` at tag **`v22.1.5`**, the angular.dev docs
*source* (`adev/src/content/**` at the same tag — this is the exact text angular.dev renders), the
repo `CHANGELOG.md`, and `registry.npmjs.org`. **No sandbox was run and none may be.**

Chunks 01–05 are already written. This bank serves the **twelve remaining chunks, 06 → 17**.
Jump to your own section. §1 is mandatory for everyone. §2 is the contradiction list — every
chunk that touches one of these must handle it explicitly rather than silently picking a side.

**How to read the code blocks below.** Everything in a fenced block that is attributed to a
`packages/...` path is **verbatim source read at `v22.1.5`**. Anything illustrative is labelled
`// ILLUSTRATIVE`. There are no terminal transcripts, bundle sizes or compiled-output dumps in
this bank, and none may be invented from it.

---

## §1 — Facts every chunk needs

### 1.1 The version spine (re-measured 2026-09-06 from `registry.npmjs.org` dist-tags)

| | |
|---|---|
| `@angular/core` / `@angular/compiler` / `@angular/compiler-cli` | `latest` = **22.1.5**, `next` = 22.2.0-next.5 |
| `@angular/cli` / `@angular/build` | `latest` = **22.1.7**, `next` = 22.2.0-next.6 |
| LTS | v21 → 21.2.22 · v20 → 20.3.30 · v19 out of support at 19.2.25 |
| `@angular/compiler-cli` peer | `typescript: ">=6.0 <6.1"`, `@angular/compiler: "22.1.5"` |
| `@angular/core` peer | `rxjs: "^6.5.3 \|\| ^7.4.0"`, `zone.js: "~0.15.0 \|\| ~0.16.0"` (**optional**), `@angular/compiler: "22.1.5"` (**optional**) |
| engines (both) | `node: "^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0"` |
| `@angular/compiler-cli` bin | `ngc` → `bundles/src/bin/ngc.js`, `ng-xi18n` → `bundles/src/bin/ng_xi18n.js` |

🔴 **`@angular/compiler` is an OPTIONAL peer of `@angular/core`.** That is the tree-shaking
argument made concrete: an AOT app does not need the compiler at runtime. Source:
`registry.npmjs.org/@angular/core/22.1.5` → `peerDependenciesMeta`.

### 1.2 The `> Verified:` line these chunks should carry

```
> Verified: 2026-09-06 against angular.dev — [Page title](url), [Page title](url) — and `angular/angular`
> at tag `v22.1.5`: [`path/file.ts`](https://github.com/angular/angular/blob/v22.1.5/path/file.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
```

GitHub blob URLs take the form
`https://github.com/angular/angular/blob/v22.1.5/<path>` (the `v` prefix is required).
angular.dev doc URLs used here:

- `https://angular.dev/tools/cli/aot-compiler` ⚠️ STALE — see §2
- `https://angular.dev/tools/cli/template-typecheck` ⚠️ STALE on defaults — see §2
- `https://angular.dev/reference/configs/angular-compiler-options` ✅ current on defaults
- `https://angular.dev/extended-diagnostics`
- `https://angular.dev/guide/templates/defer`
- `https://angular.dev/guide/templates/expression-syntax`
- `https://angular.dev/errors/NG1001` · `/NG2003` · `/NG3003` · `/NG8001` · `/NG8002` · `/NG8003` · `/NG8023`
- `https://angular.dev/extended-diagnostics/NG8109` · `/NG8113` · `/NG8021`

### 1.3 What chunks 01–05 already said — do not repeat, do cross-reference

| chunk | file | already covers |
|---|---|---|
| 01 | `01-the-template-is-a-separate-language.md` | the four-stage pipeline (tokenize → HTML AST → template AST → template function); `templateUrl` vs `template` compile identically; why Angular has its own parser |
| 02 | `02-what-a-template-expression-may-contain.md` | value literals; the two globals (`undefined`, `$any`); `$`-prefixed locals; the supported/unsupported operator tables; why `new` and bitwise are out |
| 03 | `03-declarations-and-the-let-block.md` | declarations banned; `@let` as a block; `ɵɵdeclareLet` / `ɵɵstoreLet` / `ɵɵreadContextLet` |
| 04 | `04-arrow-functions-in-templates.md` | the arrow-function doc/source contradiction; `ɵɵarrowFunction`; NG8111 |
| 05 | `05-expressions-statements-and-safe-navigation.md` | binding vs action context; `$event`; the v22 `?.` → `undefined` change |

Links from your chunk to these use the plain filename, e.g. `[02](02-what-a-template-expression-may-contain.md)`.

### 1.4 The one structural fact that ties the topic together

The compiler's job is to turn a `@Component` class into **three artefacts**:

1. a **static field** `ɵcmp` on the class, built by `ɵɵdefineComponent` (chunk 06)
2. a **static field** `ɵfac`, built by `ɵɵdefineComponent`'s sibling factory compiler (chunk 06)
3. a **type declaration** in the emitted `.d.ts`, `ɵɵComponentDeclaration<…>` (chunk 06)

…plus, for the duration of the build only, a **fourth**: the Type Check Block, emitted into a
synthetic `.ngtypecheck.ts` file that is never written to disk (chunk 14).

Everything else in this topic is a consequence of one of those four.

### 1.5 MDX hazards specific to *this* topic's vocabulary

Backtick every one of these when it appears in prose:
`ComponentDef<T>` · `ComponentTemplate<T>` · `DynamicValue<R>` · `Reference<ts.Declaration>` ·
`ts.TransformerFactory<ts.SourceFile>` · `Promise<string>` · `Array<Promise<DependencyType>>` ·
`ɵɵComponentDeclaration<…>` · `<app-child/>` · `<large-component />` · `<my-cmp>` ·
`{provide: X, useFactory: f}` · `@defer {}` · `{{ interpolation }}` · `<ng-template>`.
Anything containing `{` or `}` outside a fence is a JSX delimiter.

---

## §2 — Where angular.dev and the v22.1.5 source DISAGREE

🔴 **The source wins, and the page must say so.** These are all first-hand: both sides were read.

| # | Claim | angular.dev says | `v22.1.5` source says | Where it bites |
|---|---|---|---|---|
| **C1** | `strictTemplates` default | *"In this optional phase … You can enable this phase explicitly by setting the `strictTemplates` configuration option"* (aot-compiler) and the whole three-mode story on template-typecheck | `compiler.ts` — `private get strictTemplates(): boolean { return this.options.strictTemplates !== false; }` with the comment *"strictTemplate is `true` by default. Explicit opt-out is required to disable strictness"* | 14, 15, 17 |
| **C2** | Same, within angular.dev | template-typecheck.md never mentions a default; **angular-compiler-options.md says *"Default is `true`."*** — two angular.dev pages disagree with each other | — | 14 |
| **C3** | `fullTemplateTypeCheck` | template-typecheck.md documents three modes keyed on it, and ends *"an option of last resort is to turn off full mode entirely with `fullTemplateTypeCheck: false`"* | **Not present in the v22 public option surface.** `goldens/public-api/compiler-cli/compiler_options.api.md` lists `LegacyNgcOptions` as only `allowEmptyCodegenFiles`, `flatModuleId`, `flatModuleOutFile`, `preserveWhitespaces`, `strictInjectionParameters`. Only a stale code comment in `compiler.ts` still names it | 14 |
| **C4** | AOT phase descriptions | aot-compiler.md's phases 1–3 describe the **ViewEngine collector**, `.metadata.json`, `StaticReflector`, code folding, `strictMetadataEmit` | ngtsc has no collector and emits no `.metadata.json`. It is a `ts.CustomTransformers` pipeline with a `StaticInterpreter` partial evaluator | 09, 10, 13 |
| **C5** | "No arrow functions" in metadata | aot-compiler.md: *"The AOT compiler does not support function expressions … and arrow functions"*, with a `providers: [{provide: server, useFactory: () => new Server()}]` example said to fail | `providers` is **never statically evaluated**. `annotations/directive/src/shared.ts` wraps it verbatim: `new WrappedNodeExpr(directive.get('providers')!)`. An arrow function there is emitted unchanged | 09, 10 |
| **C6** | Destructuring in metadata | The old AOT metadata rules treat it as unsupported | `partial_evaluator/src/interpreter.ts` has a full `visitBindingElement` that walks the binding pattern back to the closest `ts.VariableDeclaration` and index-accesses the resolved initializer. Destructuring **works** when the initializer resolves | 10 |
| **C7** | Stale compiler options | angular-compiler-options.md documents `annotationsAs`, `disableExpressionLowering`, `enableResourceInlining`, `enableLegacyTemplate`, `generateCodeForLibraries`, `skipMetadataEmit`, `skipTemplateCodegen`, `strictMetadataEmit` | **None of the eight is in the v22 public option surface** (`compiler_options.api.md`) | 13, 15 |
| **C8** | Template-error file name | aot-compiler.md: *"The file name reported in the error message, `my.component.ts.MyComponent.html`, is a synthetic file"* | `typecheck/diagnostics/src/diagnostic.ts` builds it as `` `${componentSf.fileName} (${componentName} template)` `` for indirect mappings, and uses `mapping.templateUrl` for external ones. There is no `.ts.X.html` form | 17 |
| **C9** | Extended-diagnostic roster | the overview table lists **16** checks | `ExtendedTemplateDiagnosticName` at `v22.1.5` has **18** members — the table omits `unusedLetDeclaration` (NG8112) and `controlFlowPreventingContentProjection` (NG8011) | 15 |
| **C10** | `@defer` dependency conditions | defer.md: *"they need to meet two conditions"* | `component/src/handler.ts` `registerDeferrableCandidate` bails out on **eight** distinct checks, and `DeferredSymbolTracker.canDefer` adds a ninth at the whole-import-declaration level. ⚠️ **2026-09-06 — attribution disputed, count is not.** The agent that wrote `11b` read the function and counted **nine `return`s inside `registerDeferrableCandidate` itself**, the ninth being `!allDeferredDecls.has(decl.node)` — a *candidate filter*, not a rejection. Both readings agree on **eight failure conditions**; they disagree on where the ninth lives. `11b` ships the eight-failures framing with `canDefer` as condition 9. **Re-read the source before asserting either attribution.** | 11 |
| **C11** | NG0304 | NG8001 and NG8002 both point at *"a common runtime error `NG0304`"* | `RuntimeErrorCode.UNKNOWN_ELEMENT = 304` exists in `packages/core/src/errors.ts`, but **NG0304 has no page** in `reference/errors/overview.md` — the link is dangling | 17 |

Two further points that are **not** contradictions but are commonly mis-stated:

- **C12** — The Ivy design docs (`packages/compiler/design/architecture.md`,
  `separate_compilation.md`) are 2018 drafts still shipped in the repo. **Cite their architecture
  claims; never their artefacts.** They describe `ngcc`, `.metadata.json`, `NgComponentDef`,
  `tag: 'greet'`, Tsickle ordering and "as of TypeScript 2.7" — all obsolete. Chunks 06, 08 and 12
  lean on them and must say which half they are quoting.
- **C13** — angular.dev's expression-syntax guide lists **tagged template strings as a supported
  template literal**. That is about *template expressions*. **Decorator metadata is a different
  language** — `StaticInterpreter.visitExpression` handles `ts.isTemplateExpression` and
  `ts.isNoSubstitutionTemplateLiteral` but **not** `ts.isTaggedTemplateExpression`, so a tagged
  template in `@Component({...})` resolves to `DynamicValue.fromUnsupportedSyntax`. Do not
  conflate the two languages.

---

## §06 — What the compiler emits: `ɵcmp`

### The canonical "before / after" — from the Ivy architecture design doc

`packages/compiler/design/architecture.md` (⚠️ 2018 draft — quote it for **shape**, and say so;
its `tag:` field and `NgComponentDef` type are both obsolete). Verbatim, the input:

```ts
import {Component, Input} from '@angular/core';

@Component({
  selector: 'greet',
  template: '<div> Hello, {{name}}! </div>',
})
export class GreetComponent {
  @Input() name: string;
}
```

and the doc's "In `ngtsc` this is instead emitted as":

```js
const i0 = require('@angular/core');
class GreetComponent {}
GreetComponent.ɵcmp = i0.ɵɵdefineComponent({
  type: GreetComponent,
  tag: 'greet',
  factory: () => new GreetComponent(),
  template: function (rf, ctx) {
    if (rf & RenderFlags.Create) {
      i0.ɵɵelementStart(0, 'div');
      i0.ɵɵtext(1);
      i0.ɵɵelementEnd();
    }
    if (rf & RenderFlags.Update) {
      i0.ɵɵadvance();
      i0.ɵɵtextInterpolate1('Hello ', ctx.name, '!');
    }
  },
});
```

and the `.d.ts`:

```ts
import * as i0 from '@angular/core';
export class GreetComponent {
  static ɵcmp: i0.NgComponentDef<GreetComponent, 'greet', {input: 'input'}>;
}
```

Doc sentence worth quoting: > *"The information needed by reference inversion and type-checking is
included in the type declaration of the `ɵcmp` in the `.d.ts`."*

🔴 **What is wrong with the draft, measured at `v22.1.5`:** the field is `selectors`, not `tag`;
the factory is a separate `ɵfac` static, not a `factory:` property; the `.d.ts` type is
`ɵɵComponentDeclaration` with **ten** type parameters, not `NgComponentDef` with three; and the
whole call is wrapped in `noSideEffects`. Chunk 06 should show the draft, then correct it field
by field from the sources below.

### The emission order, from the compiler

`packages/compiler/src/render3/view/compiler.ts` — `baseDirectiveFields` then
`compileComponentFromMetadata`. Verbatim comments and calls, in the order they run:

```ts
// e.g. `type: MyDirective`
definitionMap.set('type', meta.type.value);

// e.g. `selectors: [['', 'someDir', '']]`
if (selectors.length > 0) {
  definitionMap.set('selectors', asLiteral(selectors));
}
```

then, in `compileComponentFromMetadata`:

```ts
definitionMap.set('decls', o.literal(tpl.root.decls as number));
definitionMap.set('vars', o.literal(tpl.root.vars as number));
if (tpl.consts.length > 0) {
  if (tpl.constsInitializers.length > 0) {
    definitionMap.set(
      'consts',
      o.arrowFn([], [...tpl.constsInitializers, new o.ReturnStatement(o.literalArr(tpl.consts))]),
    );
  } else {
    definitionMap.set('consts', o.literalArr(tpl.consts));
  }
}
definitionMap.set('template', templateFn);
```

`dependencies` has two shapes:

```ts
if (
  meta.declarationListEmitMode !== DeclarationListEmitMode.RuntimeResolved &&
  meta.declarations.length > 0
) {
  definitionMap.set(
    'dependencies',
    compileDeclarationList(
      o.literalArr(meta.declarations.map((decl) => decl.type)),
      meta.declarationListEmitMode,
    ),
  );
} else if (meta.declarationListEmitMode === DeclarationListEmitMode.RuntimeResolved) {
  const args = [meta.type.value];
  if (meta.rawImports) {
    args.push(meta.rawImports);
  }
  definitionMap.set('dependencies', o.importExpr(R3.getComponentDepsFactory).callFn(args));
}
```

and `compileDeclarationList` documents the four modes inline — quote these comments, they are the
clearest statement of why `dependencies` is sometimes a function:

```ts
case DeclarationListEmitMode.Direct:
  // directives: [MyDir],
  return list;
case DeclarationListEmitMode.Closure:
  // directives: function () { return [MyDir]; }
  return o.arrowFn([], list);
case DeclarationListEmitMode.ClosureResolved:
  // directives: function () { return [MyDir].map(ng.resolveForwardRef); }
  const resolvedList = list.prop('map').callFn([o.importExpr(R3.resolveForwardRef)]);
  return o.arrowFn([], resolvedList);
case DeclarationListEmitMode.RuntimeResolved:
  throw new Error(`Unsupported with an array of pre-resolved dependencies`);
```

Two more emission facts from the same function, both good gotcha material:

```ts
if (!hasStyles && meta.encapsulation === core.ViewEncapsulation.Emulated) {
  // If there is no style, don't generate css selectors on elements
  meta.encapsulation = core.ViewEncapsulation.None;
}

// Only set view encapsulation if it's not the default value
if (meta.encapsulation !== core.ViewEncapsulation.Emulated) {
  definitionMap.set('encapsulation', o.literal(meta.encapsulation));
}
```

— i.e. **a component with no styles silently compiles as `ViewEncapsulation.None`**, and
`encapsulation` is omitted from the emitted def whenever it is `Emulated`.

### `ɵɵdefineComponent` itself

`packages/core/src/render3/definition.ts`, verbatim:

```ts
export function ɵɵdefineComponent<T>(
  componentDefinition: ComponentDefinition<T>,
): ComponentDef<any> {
  return noSideEffects(() => {
    // Initialize ngDevMode. This must be the first statement in ɵɵdefineComponent.
    // See the `initNgDevMode` docstring for more information.
    (typeof ngDevMode === 'undefined' || ngDevMode) && initNgDevMode();

    const baseDef = getNgDirectiveDef(componentDefinition as DirectiveDefinition<T>);
    const def: Writable<ComponentDef<T>> = {
      ...baseDef,
      decls: componentDefinition.decls,
      vars: componentDefinition.vars,
      template: componentDefinition.template,
      consts: componentDefinition.consts || null,
      ngContentSelectors: componentDefinition.ngContentSelectors,
      onPush: componentDefinition.changeDetection !== ChangeDetectionStrategy.Eager,
      directiveDefs: null!, // assigned in noSideEffects
      pipeDefs: null!, // assigned in noSideEffects
      dependencies: (baseDef.standalone && componentDefinition.dependencies) || null,
      getStandaloneInjector: baseDef.standalone
        ? (parentInjector: EnvironmentInjector) => {
            return parentInjector.get(StandaloneService).getOrCreateStandaloneInjector(def);
          }
        : null,
      getExternalStyles: null,
      signals: componentDefinition.signals ?? false,
      data: componentDefinition.data || {},
      encapsulation: componentDefinition.encapsulation || ViewEncapsulation.Emulated,
      styles: componentDefinition.styles || EMPTY_ARRAY,
      _: null,
      schemas: componentDefinition.schemas || null,
      tView: null,
      id: '',
    };
    // …
    initFeatures(def);
    const dependencies = componentDefinition.dependencies;
    def.directiveDefs = extractDefListOrFactory(dependencies, extractDirectiveDef);
    def.pipeDefs = extractDefListOrFactory(dependencies, getPipeDef);
    def.id = getComponentId(def);

    return def;
  });
}
```

🔴 **Two v22-specific things to notice in that literal.**

1. `onPush: componentDefinition.changeDetection !== ChangeDetectionStrategy.Eager` — **OnPush is
   the default in v22**. `packages/core/src/change_detection/constants.ts`:

   ```ts
   export enum ChangeDetectionStrategy {
     OnPush = 0,   // "NOTE: OnPush is enabled by default."
     Eager = 1,
     /**
      * This value is equivalent to setting `Eager` and is due to be removed.
      * @deprecated Use `Eager` instead.
      */
     Default = 1,
   }
   ```

   CHANGELOG v22.0.0 breaking change, verbatim: > *"Component with undefined `changeDetection`
   property are now `OnPush` by default. Specify `changeDetection: ChangeDetectionStrategy.Eager`
   to keep the previous behavior."* and the feature line *"Set default Component changeDetection
   strategy to OnPush"* (commit `eae8f7e30b`).

2. `dependencies: (baseDef.standalone && componentDefinition.dependencies) || null` — a
   non-standalone component's `dependencies` are **dropped on the floor** at runtime; its
   directives come from the NgModule scope instead.

### `noSideEffects` — the whole tree-shaking trick in six lines

`packages/core/src/util/closure.ts`, verbatim including the doc comment:

```ts
/**
 * Convince closure compiler that the wrapped function has no side-effects.
 *
 * Closure compiler always assumes that `toString` has no side-effects. We use this quirk to
 * allow us to execute a function but have closure compiler mark the call as no-side-effects.
 * It is important that the return value for the `noSideEffects` function be assigned
 * to something which is retained otherwise the call to `noSideEffects` will be removed by closure
 * compiler.
 */
export function noSideEffects<T>(fn: () => T): T {
  return {toString: fn}.toString() as unknown as T;
}
```

### The runtime shape: `ComponentDef<T>`

`packages/core/src/render3/interfaces/definition.ts`. The interface header carries a warning worth
quoting: > *"NOTE: Always use `defineComponent` function to create this object, never create the
object directly since the shape of this object can change between versions."*

The load-bearing field doc comments, verbatim:

- `id` — *"Unique ID for the component. Used in view encapsulation and to keep track of the injector in standalone components."*
- `template: ComponentTemplate<T>` — *"The View template of the component."*
- `consts: TConstantsOrFactory | null` — *"Constants associated with the component's view."*
- `decls: number` — *"The number of nodes, local refs, and pipes in this component template. Used to calculate the length of the component's LView array, so we can pre-fill the array and set the binding start index."*
- `vars: number` — *"The number of bindings in this component template (including pure fn bindings). Used to calculate the length of the component's LView array, so we can pre-fill the array and set the host binding start index."*
- `directiveDefs` — *"Registry of directives and components that may be found in this view. The property is either an array of `DirectiveDef`s or a function which returns the array of `DirectiveDef`s. The function is necessary to be able to support forward declarations."*
- `dependencies` — *"Unfiltered list of all dependencies of a component, or `null` if none."*
- `tView: TView | null` — *"Ivy runtime uses this place to store the computed tView for the component. This gets filled on the first run of component."*
- `_?: unknown` — *"Used to store the result of `noSideEffects` function so that it is not removed by closure compiler. The property should never be read."*

And `ComponentTemplate<T>` itself:

```ts
export type ComponentTemplate<T> = {
  // Note: the ctx parameter is typed as T|U, as using only U would prevent a template with
  // e.g. ctx: {} from being assigned to ComponentTemplate<any> as TypeScript won't infer U = any
  // in that scenario. By including T this incompatibility is resolved.
  <U extends T>(rf: RenderFlags, ctx: T | U): void;
};
```

The `ComponentDefinition<T>` input interface's `template` doc comment contains a second,
*older* shape sketch (`function Template<T>(ctx:T, creationMode: boolean)`) plus a list of common
instructions — it is out of date on the signature but useful as a list; if you quote it, say it
is a stale docstring, because the real signature is `(rf, ctx)`.

### `consts` — what the numbers in an instruction call point at

`packages/core/src/render3/instructions/element.ts`, `ɵɵelementStart` docstring, verbatim:

> *"@param index Index of the element in the LView array. @param name Name of the DOM Node.
> @param attrsIndex Index of the element's attributes in the `consts` array. @param localRefsIndex
> Index of the element's local references in the `consts` array."*
> *"Attributes and localRefs are passed as an array of strings where elements with an even index
> hold an attribute name and elements with an odd index hold an attribute value, ex.:
> `['id', 'warning5', 'class', 'alert']`"*

### `ɵfac`

The field name is set in `packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts`,
verbatim:

```ts
export function compileNgFactoryDefField(metadata: R3FactoryMetadata): CompileResult {
  const res = compileFactoryFunction(metadata);
  return {
    name: 'ɵfac',
    initializer: res.expression,
    statements: res.statements,
    type: res.type,
    deferrableImports: null,
  };
}
```

`packages/compiler/src/render3/r3_factory.ts` — the generated factory takes one parameter and
names it `__ngFactoryType__`:

```ts
export function compileFactoryFunction(meta: R3FactoryMetadata): R3CompiledExpression {
  const t = o.variable('__ngFactoryType__');
  // …
  const typeForCtor = !isDelegatedFactoryMetadata(meta)
    ? new o.BinaryOperatorExpr(o.BinaryOperator.Or, t, meta.type.value)
    : t;
```

— i.e. the emitted body instantiates `__ngFactoryType__ || MyComponent`, which is how a subclass
reuses a base class's factory.

`FactoryTarget`, from `packages/compiler/src/compiler_facade_interface.ts`:

```ts
export enum FactoryTarget {
  Directive = 0,
  Component = 1,
  Injectable = 2,
  Pipe = 3,
  NgModule = 4,
  Service = 5,
}
```

(`Service = 5` is new in v22, for the `@Service` decorator.)

Unresolvable constructor dependencies do **not** stop the build outright — they emit a call to
`ɵɵinvalidFactoryDep(index)`, from `r3_factory.ts`:

```ts
if (dep.token === null) {
  return o.importExpr(R3.invalidFactoryDep).callFn([o.literal(index)]);
}
```

### What lands in the `.d.ts`

`packages/compiler/src/render3/view/compiler.ts`:

```ts
export function createComponentType(meta: R3ComponentMetadata<R3TemplateDependency>): o.Type {
  const typeParams = createBaseDirectiveTypeParams(meta);
  typeParams.push(stringArrayAsType(meta.template.ngContentSelectors));
  typeParams.push(o.expressionType(o.literal(meta.isStandalone)));
  typeParams.push(createHostDirectivesType(meta));
  if (meta.isSignal) {
    typeParams.push(o.expressionType(o.literal(meta.isSignal)));
  }
  return o.expressionType(o.importExpr(R3.ComponentDeclaration, typeParams));
}

function createBaseDirectiveTypeParams(meta: R3DirectiveMetadata): o.Type[] {
  // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
  // string literal, which must be on one line.
  const selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;

  return [
    typeWithParameters(meta.type.type, meta.typeArgumentCount),
    selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
    meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
    o.expressionType(getInputsTypeExpression(meta)),
    o.expressionType(stringMapAsLiteralExpression(meta.outputs)),
    stringArrayAsType(meta.queries.map((q) => q.propertyName)),
  ];
}
```

And the declaration type itself, `packages/core/src/render3/interfaces/public_definitions.ts` —
🔴 **it is `unknown`**:

```ts
/**
 * @publicApi
 */
export type ɵɵComponentDeclaration<
  T,
  Selector extends String,
  ExportAs extends string[],
  // `string` keys are for backwards compatibility with pre-16 versions.
  InputMap extends {
    [key: string]: string | {alias: string | null; required: boolean; isSignal?: boolean};
  },
  OutputMap extends {[key: string]: string},
  QueryFields extends string[],
  NgContentSelectors extends string[],
  // Optional as this was added in Angular v14. All pre-existing components
  // are not standalone.
  IsStandalone extends boolean = false,
  HostDirectives = never,
  IsSignal extends boolean = false,
> = unknown;
```

**This is the single best fact in chunk 06.** The type has no structure and no runtime — it is a
phantom whose *type arguments* are the entire published metadata of the component. A downstream
compilation reads the selector, the input map, the output map, the query field names, the
`ngContent` selectors and the standalone/signal flags straight back out of the type arguments of a
type that erases to nothing. That is how a library compiled six months ago still type-checks
against your template today, and it is why the `.d.ts` is the interchange format rather than a
JSON sidecar (contrast `.metadata.json`, C4/C12).

The sibling declarations in the same file, for a table: `ɵɵDirectiveDeclaration` (same shape but
`NgContentSelectors extends never = never` — *"Directives have no NgContentSelectors slot, but
instead express a `never` type so that future fields align"*, from `createDirectiveType`),
`ɵɵPipeDeclaration<T, Name, IsStandalone>`, `ɵɵNgModuleDeclaration<T, Declarations, Imports,
Exports>`, `ɵɵInjectorDeclaration<T>`, and

```ts
export type ɵɵFactoryDeclaration<T, CtorDependencies extends CtorDependency[]> = (
  parent?: Type<any>,
) => any;
```

with `CtorDependency` documenting the `@Attribute` / `@Optional` / `@Host` / `@Self` / `@SkipSelf`
flags it carries.

### Interview-question seeds for 06

- Why is `ɵɵComponentDeclaration` declared as `unknown`? (Nothing reads it at runtime; only the
  type arguments matter; erasing to `unknown` costs nothing in the emitted `.d.ts`.)
- Why is `dependencies` sometimes a function rather than an array? (Forward declarations — the
  `Closure` / `ClosureResolved` modes above.)
- Why are `decls` and `vars` numbers rather than something the runtime counts? (Chunk 07.)
- What happens to `dependencies` on a non-standalone component? (Dropped: the `baseDef.standalone &&`
  guard.)
- Why is `ɵɵdefineComponent`'s whole body inside `noSideEffects`?

---

## §07 — The create pass and the update pass

### `RenderFlags`

`packages/core/src/render3/interfaces/definition.ts`, verbatim, doc comment and all:

```ts
/**
 * Flags passed into template functions to determine which blocks (i.e. creation, update)
 * should be executed.
 *
 * Typically, a template runs both the creation block and the update block on initialization and
 * subsequent runs only execute the update block. However, dynamically created views require that
 * the creation block be executed separately from the update block (for backwards compat).
 */
export const enum RenderFlags {
  /* Whether to run the creation block (e.g. create elements and directives) */
  Create = 0b01,

  /* Whether to run the update block (e.g. refresh bindings) */
  Update = 0b10,
}
```

⚠️ Note the docstring says "typically … runs both" while the *code* makes two separate calls.
Both are true: at initialisation the creation block runs, then the update block runs, but they are
**two invocations of the same function**, not one invocation with both bits set. Say it that way.

### The two call sites — this is the whole "why one function" answer

`packages/core/src/render3/instructions/render.ts`:

```ts
export function renderView<T>(tView: TView, lView: LView<T>, context: T): void {
  ngDevMode && assertEqual(isCreationMode(lView), true, 'Should be run in creation mode');
  ngDevMode && assertNotReactive(renderView.name);
  enterView(lView);
  try {
    const viewQuery = tView.viewQuery;
    if (viewQuery !== null) {
      executeViewQueryFn<T>(RenderFlags.Create, viewQuery, context);
    }

    // Execute a template associated with this view, if it exists. A template function might not be
    // defined for the root component views.
    const templateFn = tView.template;
    if (templateFn !== null) {
      executeTemplate<T>(tView, lView, templateFn, RenderFlags.Create, context);
    }
```

`packages/core/src/render3/instructions/change_detection.ts` (inside `refreshView`):

```ts
    resetPreOrderHookFlags(lView);

    setBindingIndex(tView.bindingStartIndex);
    if (templateFn !== null) {
      executeTemplate(tView, lView, templateFn, RenderFlags.Update, context);
    }
```

🔴 The line **`setBindingIndex(tView.bindingStartIndex)`** immediately before the update call is
the mechanism behind `vars`: every update instruction consumes the *next* binding slot from a
cursor that is reset to a compile-time-known offset at the top of each update pass.

### `executeTemplate`

`packages/core/src/render3/instructions/shared.ts`, verbatim:

```ts
export function executeTemplate<T>(
  tView: TView,
  lView: LView<T>,
  templateFn: ComponentTemplate<T>,
  rf: RenderFlags,
  context: T,
) {
  const prevSelectedIndex = getSelectedIndex();
  const isUpdatePhase = rf & RenderFlags.Update;
  try {
    setSelectedIndex(-1);
    if (isUpdatePhase && lView.length > HEADER_OFFSET) {
      // When we're updating, inherently select 0 so we don't
      // have to generate that instruction for most update blocks.
      selectIndexInternal(tView, lView, HEADER_OFFSET, !!ngDevMode && isInCheckNoChangesMode());
    }

    const preHookType = isUpdatePhase
      ? ProfilerEvent.TemplateUpdateStart
      : ProfilerEvent.TemplateCreateStart;
    profiler(preHookType, context as unknown as {}, templateFn);
    templateFn(rf, context);
  } finally {
    setSelectedIndex(prevSelectedIndex);

    const postHookType = isUpdatePhase
      ? ProfilerEvent.TemplateUpdateEnd
      : ProfilerEvent.TemplateCreateEnd;
    profiler(postHookType, context as unknown as {}, templateFn);
  }
}
```

That comment — *"When we're updating, inherently select 0 so we don't have to generate that
instruction for most update blocks"* — is the reason `ɵɵadvance` in the design-doc example is
called with no argument and why the *first* element of an update block usually needs no `advance`
at all.

### `ɵɵadvance`

`packages/core/src/render3/instructions/advance.ts`, verbatim, docstring and body:

```ts
/**
 * Advances to an element for later binding instructions.
 *
 * Used in conjunction with instructions like {@link property} to act on elements with specified
 * indices, for example those created with {@link element} or {@link elementStart}.
 *
 * ```ts
 * (rf: RenderFlags, ctx: any) => {
 *   if (rf & 1) {
 *     text(0, 'Hello');
 *     text(1, 'Goodbye')
 *     element(2, 'div');
 *   }
 *   if (rf & 2) {
 *     advance(2); // Advance twice to the <div>.
 *     property('title', 'test');
 *   }
 *  }
 * ```
 * @param delta Number of elements to advance forwards by.
 *
 * @codeGenApi
 */
export function ɵɵadvance(delta: number = 1): void {
  ngDevMode && assertGreaterThan(delta, 0, 'Can only advance forward');
  selectIndexInternal(
    getTView(),
    getLView(),
    getSelectedIndex() + delta,
    !!ngDevMode && isInCheckNoChangesMode(),
  );
}
```

🔴 **`ɵɵadvance` is relative and forward-only** (`assertGreaterThan(delta, 0, 'Can only advance
forward')`). That single assertion is the reason the update block must visit slots in the same
order the create block declared them, and therefore why a template's shape is fixed at compile
time.

`selectIndexInternal` does more than move a cursor — it flushes lifecycle hooks, and the comment
explaining the ordering is excellent gotcha material:

```ts
export function selectIndexInternal(
  tView: TView,
  lView: LView,
  index: number,
  checkNoChangesMode: boolean,
) {
  ngDevMode && assertIndexInDeclRange(lView[TVIEW], index);

  // Flush the initial hooks for elements in the view that have been added up to this point.
  // PERF WARNING: do NOT extract this to a separate function without running benchmarks
  if (!checkNoChangesMode) {
    const hooksInitPhaseCompleted =
      (lView[FLAGS] & LViewFlags.InitPhaseStateMask) === InitPhaseState.InitPhaseCompleted;
    if (hooksInitPhaseCompleted) {
      const preOrderCheckHooks = tView.preOrderCheckHooks;
      if (preOrderCheckHooks !== null) {
        executeCheckHooks(lView, preOrderCheckHooks, index);
      }
    } else {
      const preOrderHooks = tView.preOrderHooks;
      if (preOrderHooks !== null) {
        executeInitAndCheckHooks(lView, preOrderHooks, InitPhaseState.OnInitHooksToBeRun, index);
      }
    }
  }

  // We must set the selected index *after* running the hooks, because hooks may have side-effects
  // that cause other template functions to run, thus updating the selected index, which is global
  // state. If we run `setSelectedIndex` *before* we run the hooks, in some cases the selected index
  // will be altered by the time we leave the `ɵɵadvance` instruction.
  setSelectedIndex(index);
}
```

So: **`ngOnInit` and `ngDoCheck` on a child fire from inside the parent's `ɵɵadvance` call**, not
from some separate hook-walking phase. That explains the interleaving of parent bindings and child
init hooks that surprises people reading a stack trace.

### The slot model — `LView` is an array with a fixed-size header

`packages/core/src/render3/interfaces/view.ts`, verbatim:

```ts
// Below are constants for LView indices to help us look up LView members
// without having to remember the specific indices.
// Uglify will inline these when minifying so there shouldn't be a cost.
export const HOST = 0;
export const TVIEW = 1;

// Shared with LContainer
export const FLAGS = 2;
export const PARENT = 3;
export const NEXT = 4;
export const T_HOST = 5;
// End shared with LContainer

export const HYDRATION = 6;
export const CLEANUP = 7;
export const CONTEXT = 8;
export const INJECTOR = 9;
export const ENVIRONMENT = 10;
export const RENDERER = 11;
export const CHILD_HEAD = 12;
export const CHILD_TAIL = 13;
// FIXME(misko): Investigate if the three declarations aren't all same thing.
export const DECLARATION_VIEW = 14;
export const DECLARATION_COMPONENT_VIEW = 15;
export const DECLARATION_LCONTAINER = 16;
export const PREORDER_HOOK_FLAGS = 17;
export const QUERIES = 18;
export const ID = 19;
export const EMBEDDED_VIEW_INJECTOR = 20;
export const ON_DESTROY_HOOKS = 21;
export const EFFECTS_TO_SCHEDULE = 22;
export const EFFECTS = 23;
export const REACTIVE_TEMPLATE_CONSUMER = 24;
export const AFTER_RENDER_SEQUENCES_TO_ADD = 25;
export const ANIMATIONS = 26;

/**
 * Size of LView's header. Necessary to adjust for it when setting slots.
 *
 * IMPORTANT: `HEADER_OFFSET` should only be referred to the in the `ɵɵ*` instructions to translate
 * instruction index into `LView` index. All other indexes should be in the `LView` index space and
 * there should be no need to refer to `HEADER_OFFSET` anywhere else.
 */
export const HEADER_OFFSET = 27;
```

and `LView` itself:

```ts
/**
 * `LView` stores all of the information needed to process the instructions as
 * they are invoked from the template. Each embedded view and component view has its
 * own `LView`. When processing a particular view, we set the `viewData` to that
 * `LView`. When that view is done processing, the `viewData` is set back to
 * whatever the original `viewData` was before (the parent `LView`).
 *
 * Keeping separate state for each view facilities view insertion / deletion, so we
 * don't have to edit the data array based on which views are present.
 */
export interface LView<T = unknown> extends Array<any> {
```

🔴 **`interface LView<T> extends Array<any>`** — the view is literally a JavaScript array, 27
header slots, then the `decls` slots, then the `vars` slots, then the runtime-sized "expando"
region. `ɵɵelementStart(0, 'div')` writes `LView[27]`.

### `TView` — the compile-time/runtime boundary, stated by Angular itself

Same file, verbatim:

```ts
/**
 * The static data for an LView (shared between all templates of a
 * given type).
 *
 * Stored on the `ComponentDef.tView`.
 */
export interface TView {
  /**
   * This is a blueprint used to generate LView instances for this TView. Copying this
   * blueprint is faster than creating a new LView from scratch.
   */
  blueprint: LView;
  // …
  /**
   * The binding start index is the index at which the data array
   * starts to store bindings only. Saving this value ensures that we
   * will begin reading bindings at the correct point in the array when
   * we are in update mode.
   *
   * -1 means that it has not been initialized.
   */
  bindingStartIndex: number;

  /**
   * The index where the "expando" section of `LView` begins. The expando
   * section contains injectors, directive instances, and host binding values.
   * Unlike the "decls" and "vars" sections of `LView`, the length of this
   * section cannot be calculated at compile-time because directives are matched
   * at runtime to preserve locality.
   *
   * We store this start index so we know where to start checking host bindings
   * in `setHostBindings`.
   */
  expandoStartIndex: number;
```

🔴 **The `expandoStartIndex` comment is the best single sentence in the topic**:
> *"Unlike the "decls" and "vars" sections of `LView`, the length of this section cannot be
> calculated at compile-time because directives are matched at runtime to preserve locality."*

It says outright *why* `decls` and `vars` are compile-time constants and why directive instances
are not — and it names locality as the reason. Chunks 07, 08 and 12 should all reach for it.

### A binding instruction, end to end

`packages/core/src/render3/instructions/property.ts`, verbatim:

```ts
/**
 * Update a property on a selected element.
 *
 * Operates on the element selected by index via the {@link select} instruction.
 *
 * If the property name also exists as an input property on one of the element's directives,
 * the component property will be set instead of the element property. This check must
 * be conducted at runtime so child components that add new `@Inputs` don't have to be re-compiled
 *
 * @param propName Name of property. Because it is going to DOM, this is not subject to
 *        renaming as part of minification.
 * @param value New value to write.
 * @param sanitizer An optional function used to sanitize the value.
 * @returns This function returns itself so that it may be chained
 * (e.g. `property('name', ctx.name)('title', ctx.title)`)
 *
 * @codeGenApi
 */
export function ɵɵproperty<T>(
  propName: string,
  value: T,
  sanitizer?: SanitizerFn | null,
): typeof ɵɵproperty {
  const lView = getLView();
  const bindingIndex = nextBindingIndex();
  if (bindingUpdated(lView, bindingIndex, value)) {
    const tView = getTView();
    const tNode = getSelectedTNode();
    setPropertyAndInputs(tNode, lView, propName, value, lView[RENDERER], sanitizer);
    ngDevMode && storePropertyBindingMetadata(tView.data, tNode, propName, bindingIndex);
  }
  return ɵɵproperty;
}
```

Three separate teaching points in fourteen lines:

1. `nextBindingIndex()` — the binding slot is **implicit and positional**. Nobody passes it. It is
   the count in `vars`.
2. `bindingUpdated(lView, bindingIndex, value)` — the "diff" is a single `Object.is`-style compare
   against the previous value stored in that one array slot. There is no tree to walk.
3. > *"This check must be conducted at runtime so child components that add new `@Inputs` don't
   have to be re-compiled"* — a locality receipt inside a rendering instruction.
4. `return ɵɵproperty;` — instructions are **chainable**, which is why the emitted code reads
   `ɵɵproperty('name', ctx.name)('title', ctx.title)`.

### Gotcha seeds for 07

- Manually reordering nodes in a template changes every subsequent `advance` delta — which is why
  you can never hand-edit generated output, and why `decls` drifting out of sync is a compiler bug
  class rather than a user error.
- Hooks fire *inside* `ɵɵadvance`; a `console.log` in `ngOnInit` of a child appears between two of
  the parent's binding updates.
- `checkNoChangesMode` deliberately skips the hook flush — the second pass in dev mode is not a
  faithful replay.
- A component with no `template` function at all is legal (`templateFn !== null` guards in both
  passes) — that is the root-component-view case.

### Interview-question seeds for 07

- Why is the create block and the update block one function rather than two?
- What is `decls` counting, and why can the compiler know it but not the number of directive
  instances?
- Why is `ɵɵadvance` forward-only, and what would break if it were not?
- What actually performs the "diff" in Angular, and what is its granularity?

---

## §08 — Instructions, not a virtual DOM

### The argument as Angular's own design doc makes it

`packages/compiler/design/architecture.md`, section "The selector problem", verbatim — this is the
tree-shaking case in the authors' own words:

> *"To interpret the content of a template, the runtime needs to know what component and directives
> to apply to the element and what pipes are referenced by binding expressions. The list of
> candidate components, directives, and pipes are determined by the `NgModule` in which the
> component is declared. Since the module and component are in separate source files, mapping which
> components, directives, and pipes referenced is left to the runtime. Unfortunately, this leads to
> a tree-shaking problem. Since there no direct link between the component and types the component
> references then all components, directives, and pipes declared in the module, and any module
> imported from the module, must be available at runtime or risk the template failing to be
> interpreted correctly. Including everything can lead to a very large program which contains many
> components the application doesn't actually use."*

> *"The process of removing unused code is traditionally referred to as "tree-shaking". To determine
> what codes is necessary to include, a tree-shakers produces the transitive closure of all the code
> referenced by the bootstrap function. If the bootstrap code references a module then the
> tree-shaker will include everything imported or declared into the module."*

> *"This problem can be avoided if the component would contain a list of the components, directives,
> and pipes on which it depends allowing the module to be ignored altogether. The program then need
> only contain the types the initial component rendered depends on and on any types those
> dependencies require."*

> *"The process of determining this list is called reference inversion because it inverts the link
> from the module (which hold the dependencies) to component into a link from the component to its
> dependencies."*

🔴 **"Reference inversion" is the historical name for what is now just `dependencies` on a
standalone component's `ɵcmp`.** The 2018 doc describes it as an optional production-build step
against an NgModule scope; standalone made it the default and made the scope local. Chunk 08 can
draw that line straight to chunk 12 and to topic 02.

### The instruction set is a la carte

`packages/compiler/src/render3/r3_identifiers.ts` at `v22.1.5` declares **215** named identifiers
that the compiler may reference. Not all are instructions — the file also holds definition
functions, declaration types, features and sanitizers — but the breadth is the point: the emitted
template function imports only the handful its own template needs, so the bundler drops the rest.

Families you can name without inventing anything (all read from `r3_identifiers.ts`):

| family | members |
|---|---|
| element creation | `ɵɵelement` `ɵɵelementStart` `ɵɵelementEnd` `ɵɵelementContainer` `ɵɵelementContainerStart` `ɵɵelementContainerEnd` |
| DOM-only variants | `ɵɵdomElement` `ɵɵdomElementStart` `ɵɵdomElementEnd` `ɵɵdomElementContainer` `ɵɵdomTemplate` `ɵɵdomListener` `ɵɵdomProperty` |
| text and interpolation | `ɵɵtext` `ɵɵtextInterpolate` `ɵɵtextInterpolate1` … `ɵɵtextInterpolate8` `ɵɵtextInterpolateV` |
| generic interpolation | `ɵɵinterpolate` `ɵɵinterpolate1` … `ɵɵinterpolate8` `ɵɵinterpolateV` |
| bindings | `ɵɵproperty` `ɵɵattribute` `ɵɵclassProp` `ɵɵclassMap` `ɵɵstyleProp` `ɵɵstyleMap` `ɵɵariaProperty` `ɵɵtwoWayProperty` `ɵɵtwoWayListener` `ɵɵtwoWayBindingSet` |
| control flow | `ɵɵconditional` `ɵɵconditionalCreate` `ɵɵconditionalBranchCreate` `ɵɵrepeater` `ɵɵrepeaterCreate` `ɵɵrepeaterTrackByIndex` `ɵɵrepeaterTrackByIdentity` |
| `@let` | `ɵɵdeclareLet` `ɵɵstoreLet` `ɵɵreadContextLet` (see chunk 03) |
| `@defer` | `ɵɵdefer` plus 22 trigger variants (`ɵɵdeferOnIdle`, `ɵɵdeferPrefetchOnViewport`, `ɵɵdeferHydrateOnInteraction`, …) |
| pure functions | `ɵɵpureFunction0` … `ɵɵpureFunction8` `ɵɵpureFunctionV` |
| pipes | `ɵɵpipe` `ɵɵpipeBind1` … `ɵɵpipeBind4` `ɵɵpipeBindV` |
| queries | `ɵɵviewQuery` `ɵɵcontentQuery` `ɵɵviewQuerySignal` `ɵɵcontentQuerySignal` `ɵɵqueryRefresh` `ɵɵqueryAdvance` `ɵɵloadQuery` |
| i18n | `ɵɵi18n` `ɵɵi18nStart` `ɵɵi18nEnd` `ɵɵi18nExp` `ɵɵi18nApply` `ɵɵi18nAttributes` `ɵɵi18nPostprocess` |
| navigation | `ɵɵadvance` `ɵɵnextContext` `ɵɵgetCurrentView` `ɵɵrestoreView` `ɵɵresetView` `ɵɵreference` |
| features | `ɵɵNgOnChangesFeature` `ɵɵInheritDefinitionFeature` `ɵɵProvidersFeature` `ɵɵHostDirectivesFeature` `ɵɵExternalStylesFeature` `ɵɵControlFeature` |
| sanitizers | `ɵɵsanitizeHtml` `ɵɵsanitizeStyle` `ɵɵsanitizeUrl` `ɵɵsanitizeResourceUrl` `ɵɵsanitizeScript` `ɵɵsanitizeUrlOrResourceUrl` `ɵɵvalidateAttribute` |

🔴 The arithmetic families (`…1` through `…8` plus `…V`) exist **because a fixed-arity call
tree-shakes and a variadic one does not**: a template that interpolates two expressions references
`ɵɵtextInterpolate2` and nothing else. `ɵɵpureFunction0…8` is the same trick for memoised
sub-expressions. This is a design consequence of instructions-not-vnodes that has no analogue in a
virtual-DOM framework, and it is the honest answer to "why does the API surface look like that".

Also on the list, relevant to chunks 03 and 04 respectively: `ɵɵdeclareLet` / `ɵɵstoreLet` /
`ɵɵreadContextLet` and `ɵɵarrowFunction`.

### The payoff, in Angular's own doc

`adev/src/content/tools/cli/aot-compiler.md`, the "Reasons you might want to use AOT" table,
verbatim rows:

> *"Smaller Angular framework download size — There's no need to download the Angular compiler if
> the application is already compiled. The compiler is roughly half of Angular itself, so omitting
> it dramatically reduces the application payload."*

> *"Faster rendering — With AOT, the browser downloads a pre-compiled version of the application.
> The browser loads executable code so it can render the application immediately, without waiting
> to compile the application first."*

> *"Fewer asynchronous requests — The compiler inlines external HTML templates and CSS style sheets
> within the application JavaScript, eliminating separate ajax requests for those source files."*

> *"Better security — AOT compiles HTML templates and components into JavaScript files long before
> they are served to the client. With no templates to read and no risky client-side HTML or
> JavaScript evaluation, there are fewer opportunities for injection attacks."*

Backed by hard evidence, not just prose: `@angular/compiler` is an **optional** peer dependency of
`@angular/core@22.1.5` (§1.1). The compiler genuinely is absent from a production AOT bundle.

⛔ **Do not attach a byte count to "roughly half".** There is no sandbox and no measurement in this
bank. Quote the doc's phrase and stop.

### What it costs — argue this honestly, it is the half most pages skip

Each cost below is grounded in something already quoted:

1. **The template's shape is frozen at compile time.** `decls` and `vars` are literals in the def
   (chunk 06); `ɵɵadvance` is forward-only (chunk 07). A vnode framework can return a different
   tree shape on every render; an Angular template cannot. Everything dynamic has to go through a
   first-class construct — `@if`, `@for`, `@defer`, `ng-template`, `ViewContainerRef` — rather than
   through ordinary control flow in the render function.
2. **You cannot compute a template.** There is no `render()` you can write by hand in the ordinary
   path. This is the same constraint chunk 01 draws and the reason the template is a separate
   language at all.
3. **A dynamic component still needs a def.** Anything Angular renders must have been through the
   compiler; there is no "render this arbitrary vnode" escape hatch equivalent to
   `React.createElement`.
4. **Debugging output is unreadable by design.** The emitted function is positional and slot-based
   — the reader of a stack trace sees `MyComponent_Template` and slot indices, not their markup.
   (`ClassDebugInfo` in `definition.ts` — `className`, `filePath`, `lineNumber`,
   `forbidOrphanRendering` — exists precisely to claw some of that back in dev mode.)
5. **The runtime cannot make assumptions the compiler did not encode.** Where a vnode diff is
   general, an instruction stream is exact — and any information the compiler failed to emit
   (which directives match, which host bindings exist) has to be recovered at runtime in the
   expando region, which is why that region's length *"cannot be calculated at compile-time"*.

### The contrast, in the other frameworks' own words

Vue, `https://vuejs.org/guide/extras/rendering-mechanism.html`, verbatim:

> *"We call this hybrid approach **Compiler-Informed Virtual DOM**."*

> *"The virtual DOM implementation in React and most other virtual-DOM implementations are purely
> runtime: the reconciliation algorithm cannot make any assumptions about the incoming virtual DOM
> tree, so it has to fully traverse the tree and diff the props of every vnode in order to ensure
> correctness."*

> *"In Vue, the framework controls both the compiler and the runtime. This allows us to implement
> many compile-time optimizations that only a tightly-coupled renderer can take advantage of. The
> compiler can statically analyze the template and leave hints in the generated code so that the
> runtime can take shortcuts whenever possible."*

That paragraph is the cleanest available statement of the *spectrum* Angular sits on: Vue keeps the
vnode tree and annotates it; Angular removes the tree entirely and emits the annotations as
executable code. Full comparison material is in §16.

### Gotcha seeds for 08

- "Angular has no virtual DOM" is true and usually mis-taught as "therefore it is faster". The
  honest claim is *different*, not *faster*: no measurement is offered here.
- Reading the emitted output to debug is a trap — it is positional and the indices mean nothing
  without `consts` and the `TView`.
- The `…1` / `…2` / `…V` instruction families look like API bloat and are actually the tree-shaking
  contract.

### Interview-question seeds for 08

- Why does Angular emit `ɵɵtextInterpolate2` instead of a variadic `interpolate([...])`?
- What is "reference inversion" and what modern feature replaced it?
- What can a virtual-DOM framework do that an instruction stream cannot, and how does Angular
  cover that gap?
- `@angular/compiler` is an optional peer dependency of `@angular/core`. Why, and what breaks if
  you remove it?

---

## §09 — Static analysability is the load-bearing constraint

### NG1001, in the docs' own words

`adev/src/content/reference/errors/NG1001.md`, verbatim and complete on the "why":

> *"To make the metadata extraction in the Angular compiler faster, the decorators `@NgModule`,
> `@Pipe`, `@Component`, `@Directive`, and `@Injectable` accept only object literals as arguments."*

> *"This is an intentional change in Ivy, which enforces stricter argument requirements for
> decorators than View Engine. Ivy requires this approach because it compiles decorators by moving
> the expressions into other locations in the class output."*

The doc links its own justification to
`https://github.com/angular/angular/issues/30840#issuecomment-498869540`.

### The three NG1001 message strings, read from source

There is not one message — there are three, and which one you get tells you where you went wrong.

`packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts` — `resolveLiteral`:

```ts
if (decorator.args === null || decorator.args.length !== 1) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARITY_WRONG,
    decorator.node,
    `Incorrect number of arguments to @${decorator.name} decorator`,
  );
}
const meta = unwrapExpression(decorator.args[0]);

if (!ts.isObjectLiteralExpression(meta)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    meta,
    `Decorator argument must be literal.`,
  );
}
```

`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts` — the directive/component path:

```ts
const meta = unwrapExpression(decorator.args[0]);
if (!ts.isObjectLiteralExpression(meta)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    meta,
    `@${decorator.name} argument must be an object literal`,
  );
}
```

and, for query decorators taking an options object:

```ts
const optionsExpr = unwrapExpression(args[1]);
if (!ts.isObjectLiteralExpression(optionsExpr)) {
  throw new FatalDiagnosticError(
    ErrorCode.DECORATOR_ARG_NOT_LITERAL,
    optionsExpr,
    `@${name} options must be an object literal`,
  );
}
```

🔴 So `@ViewChild('ref', SOME_OPTIONS)` fails with the **same NG1001 code** as
`@Component(CONFIG)` — a fact no doc states.

Note `unwrapExpression` runs first, so a parenthesised or `as`-cast literal
(`@Component({...} as ComponentDef)`) is still recognised as a literal. `NG1002` is the
arity error and shares the same call site.

### The partial evaluator — exactly what it can and cannot read

`packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts`,
`StaticInterpreter.visitExpression` — **the complete dispatch**, verbatim:

```ts
private visitExpression(node: ts.Expression, context: Context): ResolvedValue {
  let result: ResolvedValue;
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  } else if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  } else if (ts.isStringLiteral(node)) {
    return node.text;
  } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  } else if (ts.isTemplateExpression(node)) {
    result = this.visitTemplateExpression(node, context);
  } else if (ts.isNumericLiteral(node)) {
    return parseFloat(node.text);
  } else if (ts.isObjectLiteralExpression(node)) {
    result = this.visitObjectLiteralExpression(node, context);
  } else if (ts.isIdentifier(node)) {
    result = this.visitIdentifier(node, context);
  } else if (ts.isPropertyAccessExpression(node)) {
    result = this.visitPropertyAccessExpression(node, context);
  } else if (ts.isCallExpression(node)) {
    result = this.visitCallExpression(node, context);
  } else if (ts.isConditionalExpression(node)) {
    result = this.visitConditionalExpression(node, context);
  } else if (ts.isPrefixUnaryExpression(node)) {
    result = this.visitPrefixUnaryExpression(node, context);
  } else if (ts.isBinaryExpression(node)) {
    result = this.visitBinaryExpression(node, context);
  } else if (ts.isArrayLiteralExpression(node)) {
    result = this.visitArrayLiteralExpression(node, context);
  } else if (ts.isParenthesizedExpression(node)) {
    result = this.visitParenthesizedExpression(node, context);
  } else if (ts.isElementAccessExpression(node)) {
    result = this.visitElementAccessExpression(node, context);
  } else if (ts.isAsExpression(node)) {
    result = this.visitExpression(node.expression, context);
  } else if (ts.isNonNullExpression(node)) {
    result = this.visitExpression(node.expression, context);
  } else if (this.host.isClass(node)) {
    result = this.visitDeclaration(node, context);
  } else {
    return DynamicValue.fromUnsupportedSyntax(node);
  }
  if (result instanceof DynamicValue && result.node !== node) {
    return DynamicValue.fromDynamicInput(node, result);
  }
  return result;
}
```

🔴 **That `else` is the whole rule.** Anything not in the list above is
`DynamicValue.fromUnsupportedSyntax`. Read off it, without inventing anything:

- **not there:** `ts.isNewExpression` → `new Foo()` in metadata is unsupported syntax
- **not there:** `ts.isTaggedTemplateExpression` → tagged templates in metadata are unsupported
  (contrast the *template* language, which does support them — see C13)
- **not there:** `ts.isArrowFunction` / `ts.isFunctionExpression` → an inline function **as a value
  to be evaluated** is unsupported (but see the `providers` exception below — most fields are never
  evaluated at all)
- **not there:** `ts.isSpreadElement` at expression position (it is handled only inside array
  literals, via `visitSpreadElement`)
- **not there:** `ts.isTypeOfExpression`, `await`, `yield`, class expressions, `delete`, `void`
- **present but easy to miss:** `as` and `!` are transparent — they simply recurse into the operand

### The operators the evaluator implements

Same file, `BINARY_OPERATORS`, verbatim:

```ts
private readonly BINARY_OPERATORS = new Map<ts.SyntaxKind, BinaryOperatorDef>([
  [ts.SyntaxKind.PlusToken, literalBinaryOp((a, b) => a + b)],
  [ts.SyntaxKind.MinusToken, literalBinaryOp((a, b) => a - b)],
  [ts.SyntaxKind.AsteriskToken, literalBinaryOp((a, b) => a * b)],
  [ts.SyntaxKind.SlashToken, literalBinaryOp((a, b) => a / b)],
  [ts.SyntaxKind.PercentToken, literalBinaryOp((a, b) => a % b)],
  [ts.SyntaxKind.AmpersandToken, literalBinaryOp((a, b) => a & b)],
  [ts.SyntaxKind.BarToken, literalBinaryOp((a, b) => a | b)],
  [ts.SyntaxKind.CaretToken, literalBinaryOp((a, b) => a ^ b)],
  [ts.SyntaxKind.LessThanToken, literalBinaryOp((a, b) => a < b)],
  [ts.SyntaxKind.LessThanEqualsToken, literalBinaryOp((a, b) => a <= b)],
  [ts.SyntaxKind.GreaterThanToken, literalBinaryOp((a, b) => a > b)],
  [ts.SyntaxKind.GreaterThanEqualsToken, literalBinaryOp((a, b) => a >= b)],
  [ts.SyntaxKind.EqualsEqualsToken, literalBinaryOp((a, b) => a == b)],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, literalBinaryOp((a, b) => a === b)],
  [ts.SyntaxKind.ExclamationEqualsToken, literalBinaryOp((a, b) => a != b)],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, literalBinaryOp((a, b) => a !== b)],
  [ts.SyntaxKind.LessThanLessThanToken, literalBinaryOp((a, b) => a << b)],
  [ts.SyntaxKind.GreaterThanGreaterThanToken, literalBinaryOp((a, b) => a >> b)],
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, literalBinaryOp((a, b) => a >>> b)],
  [ts.SyntaxKind.AsteriskAsteriskToken, literalBinaryOp((a, b) => Math.pow(a, b))],
  [ts.SyntaxKind.AmpersandAmpersandToken, referenceBinaryOp((a, b) => a && b)],
  [ts.SyntaxKind.BarBarToken, referenceBinaryOp((a, b) => a || b)],
]);
```

and the unary ones:

```ts
  [ts.SyntaxKind.TildeToken, (a) => ~a],
  [ts.SyntaxKind.MinusToken, (a) => -a],
  [ts.SyntaxKind.PlusToken, (a) => +a],
  [ts.SyntaxKind.ExclamationToken, (a) => !a],
```

🔴 **`??` (`QuestionQuestionToken`) is absent.** So `selector: MAYBE_SELECTOR ?? 'app-fallback'` is
`DynamicValue.fromUnsupportedSyntax` even though `||` in the same position works. That is a
delicious, checkable gotcha, and the inverse of the *template* language, where `??` is supported
and bitwise operators are not (chunk 02). **The two languages have different operator sets in
opposite directions.**

Also worth saying plainly: `&`, `|`, `^`, `<<`, `>>`, `>>>` are all **supported in decorator
metadata** and all **rejected in templates** (chunk 02). Same repository, same product, two
grammars.

`visitBinaryExpression` falls through explicitly:

```ts
const tokenKind = node.operatorToken.kind;
if (!this.BINARY_OPERATORS.has(tokenKind)) {
  return DynamicValue.fromUnsupportedSyntax(node);
}
```

### Calling a function from metadata — the single-return rule

🔴 **The compiler *will* call your helper function, if the body is exactly one `return`.** This is
the fact that overturns the folk rule "you cannot build a `@Component` argument with a helper".

`visitFunctionBody`, verbatim:

```ts
private visitFunctionBody(
  node: ts.CallExpression,
  fn: FunctionDefinition,
  context: Context,
): ResolvedValue {
  if (fn.body === null) {
    return DynamicValue.fromUnknown(node);
  } else if (fn.body.length !== 1 || !ts.isReturnStatement(fn.body[0])) {
    return DynamicValue.fromComplexFunctionCall(node, fn);
  }
  const ret = fn.body[0] as ts.ReturnStatement;

  const args = this.evaluateFunctionArguments(node, context);
  const newScope: Scope = new Map<ts.ParameterDeclaration, ResolvedValue>();
  const calleeContext = {...context, scope: newScope};
  fn.parameters.forEach((param, index) => {
    let arg = args[index];
    if (param.node.dotDotDotToken !== undefined) {
      arg = args.slice(index);
    }
    if (arg === undefined && param.initializer !== null) {
      arg = this.visitExpression(param.initializer, calleeContext);
    }
    newScope.set(param.node, arg);
  });

  return ret.expression !== undefined
    ? this.visitExpression(ret.expression, calleeContext)
    : undefined;
}
```

Rest parameters and default parameter values are both handled. The failure message when the body
has more than one statement is, verbatim from `partial_evaluator/src/diagnostics.ts`:

> *"Unable to evaluate function call of complex function. A function must have exactly one return
> statement."*

with a second related note: *"Function is declared here."*

The docs' own version of this rule, `aot-compiler.md` (ViewEngine-era wording but the *rule* is
unchanged): > *"The collector accepts any function or static method that contains a single `return`
statement."* — and its worked `wrapInArray` example is still valid:

```ts
export function wrapInArray<T>(value: T): T[] {
  return [value];
}

@NgModule({
  declarations: wrapInArray(Typical),
})
export class TypicalModule {}
```

> *"The compiler treats this usage as if you had written: `@NgModule({declarations: [Typical]})`"*

The doc also names the canonical real-world instance: > *"The Angular `RouterModule` exports two
macro static methods, `forRoot` and `forChild`, to help declare root and child routes."*

### Where metadata is evaluated, and where it is *not*

🔴 **Most `@Component` fields are never statically evaluated.** The evaluator runs only where the
compiler needs a *value*. Everything else is captured as a raw TypeScript node and re-emitted
verbatim. `packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`:

```ts
const providers: Expression | null = directive.has('providers')
  ? new WrappedNodeExpr(
      annotateForClosureCompiler
        ? wrapFunctionExpressionsInParens(directive.get('providers')!)
        : directive.get('providers')!,
    )
  : null;
```

`WrappedNodeExpr` means: *take this TypeScript AST node and print it back out unchanged*. So
`providers: [{provide: SERVER, useFactory: () => new Server()}]` compiles fine in Ivy — see C5.
This is the answer to "why does `providers` let me write an arrow function when `selector` won't
let me write a variable?"

Fields that **are** evaluated (each `evaluator.evaluate(...)` call site in
`annotations/directive/src/shared.ts` and `annotations/component/src/{handler,resources}.ts`):
`selector`, `exportAs`, `host`, `inputs`, `outputs`, `queries` and their `read` / `descendants` /
`static` / `emitDistinctChangesOnly` options, `hostDirectives`, `standalone`, `encapsulation`,
`changeDetection`, `preserveWhitespaces`, `imports`, `deferredImports`, `schemas`, `template`,
`templateUrl`, `styles`, `styleUrl`/`styleUrls`, `interpolation`.

### `selector` — why it cannot be computed

`annotations/directive/src/shared.ts`, verbatim:

```ts
if (directive.has('selector')) {
  const expr = directive.get('selector')!;
  const resolved = evaluator.evaluate(expr);
  assertLocalCompilationUnresolvedConst(
    compilationMode,
    resolved,
    null,
    'Unresolved identifier found for @Component.selector field! Did you ' +
      'import this identifier from a file outside of the compilation unit? ' +
      'This is not allowed when Angular compiler runs in local mode. Possible ' +
      'solutions: 1) Move the declarations into a file within the compilation ' +
      'unit, 2) Inline the selector',
  );
  if (typeof resolved !== 'string') {
    throw createValueHasWrongTypeError(expr, resolved, `selector must be a string`);
  }
  // use default selector in case selector is an empty string
  selector = resolved === '' ? defaultSelector : resolved;
  if (!selector) {
    throw new FatalDiagnosticError(
      ErrorCode.DIRECTIVE_MISSING_SELECTOR,
```

Note the nuance: **`selector` may be an identifier** — `const SEL = 'app-x'; @Component({selector: SEL})`
compiles, because the evaluator folds it. What it may not be is anything that does not *reduce to
a string*. "Cannot be computed" is too strong; "must reduce to a string literal at build time, in
this compilation unit" is exact. Empty string falls back to the default selector, and an absent
one raises `DIRECTIVE_MISSING_SELECTOR` (NG2004).

### `imports` — the same nuance, sharper

`annotations/component/src/handler.ts` evaluates it with two resolvers layered on:

```ts
const importResolvers = combineResolvers([
  createModuleWithProvidersResolver(this.reflector, this.isCore),
  createForwardRefResolver(this.isCore),
]);

if (rawImports) {
  const expr = rawImports;
  const imported = this.evaluator.evaluate(expr, importResolvers);
  const {imports: flattened, diagnostics} = validateAndFlattenComponentImports(
    imported,
    expr,
    false /* isDeferred */,
  );
```

`annotations/component/src/util.ts` — `validateAndFlattenComponentImports`, the messages verbatim:

```ts
const errorMessage = isDeferred
  ? `'deferredImports' must be an array of components, directives, or pipes.`
  : `'imports' must be an array of components, directives, pipes, or NgModules.`;
```

and the specific, very helpful one for the `forRoot()` mistake:

```ts
} else if (isLikelyModuleWithProviders(ref)) {
  // …
  diagnostics.push(
    makeDiagnostic(
      ErrorCode.COMPONENT_UNKNOWN_IMPORT,
      origin,
      `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. ` +
        `These calls are not used to configure components and are not valid in standalone component imports - ` +
        `consider importing them in the application bootstrap instead.`,
    ),
  );
}
```

The function **recurses into nested arrays** (`if (Array.isArray(ref)) { …validateAndFlatten… }`),
so `imports: [COMMON_IMPORTS, MyThing]` is legal and flattened. `forwardRef(() => X)` is unwrapped
by the resolver.

🔴 **But**: it only maps a diagnostic to the *individual element* when the expression is a literal
array whose length matches and which has no spread:

```ts
let refExpr = expr;
if (
  ts.isArrayLiteralExpression(expr) &&
  expr.elements.length === imports.length &&
  !expr.elements.some(ts.isSpreadAssignment)
) {
  refExpr = expr.elements[i];
}
```

Otherwise the squiggle lands on the whole `imports:` expression. And, far more importantly,
**`@defer` splitting requires the literal-identifier form** (chunk 11). So "`imports` must be
identifiers" is wrong as a *compilation* rule and right as a *lazy-loading* rule — chunk 09 should
state the compilation rule correctly and hand the lazy-loading rule to chunk 11.

Missing `standalone` while having `imports` gives, verbatim:

```ts
`'${importsField}' is only valid on a component that is standalone.`
```

with related information `` `Did you forget to add 'standalone: true' to this @Component?` `` —
and the component is then **poisoned**: *"Poison the component so that we don't spam further
template type-checking errors that result from misconfigured imports."*

### The `DynamicValue` taxonomy — the vocabulary of every metadata failure

`partial_evaluator/src/dynamic.ts`, verbatim doc comments:

| reason | doc comment |
|---|---|
| `DYNAMIC_INPUT` | *"A value could not be determined statically, because it contains a term that could not be determined statically. (E.g. a property assignment or call expression where the lhs is a `DynamicValue`, a template literal with a dynamic expression, an object literal with a spread assignment which could not be determined statically, etc.)"* |
| `DYNAMIC_STRING` | *"A string could not be statically evaluated. (E.g. a dynamically constructed object property name or a template literal expression that could not be statically resolved to a primitive value.)"* |
| `EXTERNAL_REFERENCE` | *"An external reference could not be resolved to a value which can be evaluated. For example a call expression for a function declared in `.d.ts`, or accessing native globals such as `window`."* |
| `UNSUPPORTED_SYNTAX` | *"Syntax that `StaticInterpreter` doesn't know how to evaluate, for example a type of `ts.Expression` that is not supported."* |
| `UNKNOWN_IDENTIFIER` | *"A declaration of a `ts.Identifier` could not be found."* |
| `INVALID_EXPRESSION_TYPE` | *"A value could be resolved, but is not an acceptable type for the operation being performed. For example, attempting to call a non-callable expression."* |
| `COMPLEX_FUNCTION_CALL` | *"A function call could not be evaluated as the function's body is not a single return statement."* |
| `DYNAMIC_TYPE` | *"A value that could not be determined because it contains type information that cannot be statically evaluated… E.g. evaluating a tuple. `declare const foo: [string];` Evaluating `foo` gives a DynamicValue wrapped in an array with a reason of DYNAMIC_TYPE. This is because the static evaluator has a `string` type for the first element of this tuple, and the value of that string cannot be determined statically."* |
| `SYNTHETIC_INPUT` | *"A value could not be determined because one of the inputs to its evaluation is a synthetically produced value."* |
| `UNKNOWN` | *"A value could not be determined statically for any reason other the above."* |

### How the failure is reported

`annotations/common/src/diagnostics.ts` — `createValueHasWrongTypeError` builds a **message chain**,
which is why NG1010 errors read as two stacked sentences:

```ts
if (value instanceof DynamicValue) {
  chainedMessage = 'Value could not be determined statically.';
  relatedInformation = traceDynamicValue(node, value);
} else if (value instanceof Reference) {
  const target = value.debugName !== null ? `'${value.debugName}'` : 'an anonymous declaration';
  chainedMessage = `Value is a reference to ${target}.`;

  const referenceNode = identifierOfNode(value.node) ?? value.node;
  relatedInformation = [makeRelatedInformation(referenceNode, 'Reference is declared here.')];
} else {
  chainedMessage = `Value is of type '${describeResolvedType(value)}'.`;
}
```

So the shape you actually see is
`selector must be a string` → `Value could not be determined statically.` → a trace.
`describeResolvedType` renders a `DynamicValue` as the literal string
`(not statically analyzable)`, a `ResolvedModule` as `(module)`, a `KnownFn` as `Function`.

### Gotcha seeds for 09

- `??` in metadata is unsupported while `||` works.
- A helper function *does* work if its body is a single `return`.
- `providers` accepts arrow functions; `selector` does not accept anything non-string. Same
  decorator, different rules, because only one of the two is evaluated.
- `@ViewChild(X, OPTIONS)` and `@Component(CONFIG)` fail with the same error code.
- `imports: [...SHARED]` (spread) compiles, but the diagnostic loses per-element position — and
  see chunk 11 for what it costs you in lazy loading.
- `Module.forRoot()` in a standalone component's `imports` has its own dedicated message.

### Interview-question seeds for 09

- Why does Angular require an object literal in `@Component` when JavaScript would happily accept a
  variable?
- The compiler can call `wrapInArray(Typical)` but not `buildDeclarations()`. What is the rule, and
  why is it drawn there?
- Why can `providers` contain an arrow function while `selector` cannot contain a function call?
- What does `Value could not be determined statically.` actually mean, and what should you look at
  next?

---

## §10 — Metadata errors, one by one

Chunk 09 explains the rule; chunk 10 is the symptom → cause → fix catalogue. Every message below
was read from source at `v22.1.5`. ⚠️ Several of the "classic" AOT metadata rules on angular.dev
are **ViewEngine-era and no longer true** — C4, C5, C6. Mark them as such rather than repeating
them.

### The related-information trace strings — the reader's actual breadcrumb

`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`,
`TraceDynamicValueVisitor`. These **ten** strings are what appears under a metadata error; a page
that lists them lets the reader map a message straight to a cause. Verbatim:

🔴 **Corrected 2026-09-06 — this said "nine" and the table below it has ten rows.** Ten is right:
`dynamic.ts` declares exactly ten `DynamicValue` reasons and each maps 1:1 to one visitor, none
left over. (Eleven if you count *messages* — `visitComplexFunctionCall` emits a second note.)
Found while writing `10-metadata-errors-one-by-one.md`, which states the count openly. **Count the
table before quoting a number out of this bank's prose** — this is the second such defect.

| visitor | message |
|---|---|
| `visitDynamicInput` | `Unable to evaluate this expression statically.` |
| `visitSyntheticInput` | `Unable to evaluate this expression further.` |
| `visitDynamicString` | `A string value could not be determined statically.` |
| `visitExternalReference` | `` A value for 'NAME' cannot be determined statically, as it is an external declaration. `` (or `an anonymous declaration`) |
| `visitComplexFunctionCall` | `Unable to evaluate function call of complex function. A function must have exactly one return statement.` + `Function is declared here.` |
| `visitInvalidExpressionType` | `Unable to evaluate an invalid expression.` |
| `visitUnknown` | `Unable to evaluate statically.` |
| `visitUnknownIdentifier` | `Unknown reference.` |
| `visitDynamicType` | `Dynamic type.` |
| `visitUnsupportedSyntax` | `This syntax is not supported.` |

The trace is deliberately de-duplicated one entry per statement, which is why long chains collapse:

```ts
/**
 * Determines the closest parent node that is to be considered as container, which is used to reduce
 * the granularity of tracing the dynamic values to a single entry per container. Currently, full
 * statements and destructuring patterns are considered as container.
 */
```

### 10.1 — Non-exported symbols

**Two different errors live here and they are usually confused.**

**(a) Reference-emit failure (NG3004, `IMPORT_GENERATION_FAILURE`).** The compiler needs to write
an import to your class from *another* file and cannot.
`packages/compiler-cli/src/ngtsc/imports/src/emitter.ts`, verbatim:

```ts
const message = makeDiagnosticChain(
  `Unable to import ${typeKind} ${nodeNameForError(result.ref.node)}.`,
  [makeDiagnosticChain(result.reason)],
);
throw new FatalDiagnosticError(ErrorCode.IMPORT_GENERATION_FAILURE, origin, message, [
  makeRelatedInformation(result.ref.node, `The ${typeKind} is declared here.`),
]);
```

The strategy doc comment above it explains *why* several attempts are made before it gives up:

> *"There are many potential ways a given `Reference` could be referred to in the context of a
> given file. A local declaration could be available, the `Reference` could be importable via a
> relative import within the project, or an absolute import into `node_modules` might be
> necessary."*

**(b) Private-export checking (NG3001, `SYMBOL_NOT_EXPORTED`)** — a library-only diagnostic, from
`packages/compiler-cli/src/ngtsc/entry_point/src/private_export_checker.ts`, verbatim:

```ts
messageText: `Unsupported private ${descriptor} ${name}. This ${descriptor} is visible to consumers via ${visibleVia}, but is not exported from the top-level library entrypoint.`,
```

where `visibleVia` is either the literal string `NgModule exports` or a `A -> B -> C` path built
from the reference graph.

The **same code** is reused for a third, quite different case in
`annotations/directive/src/shared.ts` — input transform functions:

```ts
throw new FatalDiagnosticError(
  ErrorCode.SYMBOL_NOT_EXPORTED,
  type,
  `Symbol must be exported in order to be used as the type of an Input transform function`,
  [makeRelatedInformation(declaration.node, `The symbol is declared here.`)],
);
```

**Relaxation, new in v22.1.4.** `MiscOptions.compileNonExportedClasses` — *"Whether the compiler
should avoid generating code for classes that haven't been exported. Defaults to `true`."* — and
the v22.1.4 CHANGELOG language-service line, verbatim: *"compile non-exported classes if
standalone"* (commit `7f0265e43a`). Chunk 10 should say plainly that "everything must be exported"
is no longer the blanket rule it was, and that the surviving rule is about **cross-file
references**, not about export-ness per se.

### 10.2 — `export let` and uninitialised variables

`interpreter.ts`, `visitVariableDeclaration`, verbatim including the TODO — quote the TODO, it is
an unusually honest piece of source:

```ts
private visitVariableDeclaration(node: ts.VariableDeclaration, context: Context): ResolvedValue {
  const value = this.host.getVariableValue(node);
  if (value !== null) {
    return this.visitExpression(value, context);
  } else if (isVariableDeclarationDeclared(node)) {
    // If the declaration has a literal type that can be statically reduced to a value, resolve to
    // that value. If not, the historical behavior for variable declarations is to return a
    // `Reference` to the variable, as the consumer could use it in a context where knowing its
    // static value is not necessary.
    //
    // Arguably, since the value cannot be statically determined, we should return a
    // `DynamicValue`. This returns a `Reference` because it's the same behavior as before
    // `visitType` was introduced.
    //
    // TODO(zarend): investigate switching to a `DynamicValue` and verify this won't break any
    // use cases, especially in ngcc
    if (node.type !== undefined) {
      const evaluatedType = this.visitType(node.type, context);
      if (!(evaluatedType instanceof DynamicValue)) {
        return evaluatedType;
      }
    }
    return this.getReference(node, context);
  } else {
    return undefined;
  }
}
```

Read off it, precisely:

- an **initialised** local/imported variable folds to its initialiser
- an **ambient** declaration (`declare const X: 'app-foo'`) folds via its *type* if the type is a
  literal type — that is the `visitType` branch, and it is why `declare const SEL: 'app-x'` works
  where `declare const SEL: string` does not
- an ambient declaration with a non-literal type yields a `Reference`, which then fails downstream
  as `Value is a reference to 'SEL'.`
- an **uninitialised, non-ambient** `export let X;` resolves to **`undefined`** — not an error at
  the evaluator, but a wrong-type error at the consumer (`selector must be a string` →
  `Value is of type 'undefined'.`)

`isVariableDeclarationDeclared` is a `DeclareKeyword` modifier check:

```ts
modifiers !== undefined && modifiers.some((mod) => mod.kind === ts.SyntaxKind.DeclareKeyword)
```

### 10.3 — Destructuring ✅ actually supported

See C6. `visitBindingElement`, verbatim:

```ts
private visitBindingElement(node: ts.BindingElement, context: Context): ResolvedValue {
  const path: ts.BindingElement[] = [];
  let closestDeclaration: ts.Node = node;

  while (
    ts.isBindingElement(closestDeclaration) ||
    ts.isArrayBindingPattern(closestDeclaration) ||
    ts.isObjectBindingPattern(closestDeclaration)
  ) {
    if (ts.isBindingElement(closestDeclaration)) {
      path.unshift(closestDeclaration);
    }

    closestDeclaration = closestDeclaration.parent;
  }

  if (
    !ts.isVariableDeclaration(closestDeclaration) ||
    closestDeclaration.initializer === undefined
  ) {
    return DynamicValue.fromUnknown(node);
  }

  let value = this.visit(closestDeclaration.initializer, context);
  for (const element of path) {
    let key: number | string;
    if (ts.isArrayBindingPattern(element.parent)) {
      key = element.parent.elements.indexOf(element);
    } else {
      const name = element.propertyName || element.name;
      if (ts.isIdentifier(name)) {
        key = name.text;
      } else {
        return DynamicValue.fromUnknown(element);
      }
    }
    value = this.accessHelper(element, value, key, context);
    if (value instanceof DynamicValue) {
      return value;
    }
  }

  return value;
}
```

So `const {selector} = CONFIG;` and `const [first] = SELECTORS;` both resolve, provided the
initializer itself resolves. What fails: a destructured **function parameter**, a destructured
declaration with **no initializer** (`DynamicValue.fromUnknown` → `Unable to evaluate statically.`),
and a **computed property name** in the pattern.

### 10.4 — Ambient types and tuples

`DYNAMIC_TYPE` doc comment (§09 table) already contains the worked example:
`declare const foo: [string];` → *"the static evaluator has a `string` type for the first element
of this tuple, and the value of that string cannot be determined statically. The type `string`
permits it to be 'foo', 'bar' or any arbitrary string, so we evaluate it to a DynamicValue."*
The trace line the user sees is `Dynamic type.`

The evaluator's type-side handling includes `ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword`
(so `readonly ['a','b'] as const` tuples work), `visitTupleType`, `visitTypeQuery` (`typeof X`),
`visitImportType` and `visitTypeReference`, with `DynamicValue.fromDynamicType(node)` as the
fallthrough.

### 10.5 — Computed enum members

`visitEnumDeclaration`, verbatim:

```ts
private visitEnumDeclaration(node: ts.EnumDeclaration, context: Context): ResolvedValue {
  const enumRef = this.getReference(node, context);
  const map = new Map<string, EnumValue>();
  node.members.forEach((member, index) => {
    const name = this.stringNameFromPropertyName(member.name, context);
    if (name !== undefined) {
      const resolved = member.initializer ? this.visit(member.initializer, context) : index;
      map.set(name, new EnumValue(enumRef, name, resolved));
    }
  });
  return map;
}
```

Read off it: an enum with **no** initialiser folds to its ordinal `index`; one **with** an
initialiser folds only if the initialiser itself folds. A member whose name is a computed property
that does not resolve to a string is **silently dropped from the map** (`if (name !== undefined)`)
rather than erroring — so the failure surfaces later as a missing key, which is a nasty
symptom-far-from-cause gotcha.

Enum values matter concretely for `encapsulation` and `changeDetection`.
`annotations/common/src/evaluation.ts`, `resolveEnumValue`, verbatim message:

```ts
throw createValueHasWrongTypeError(
  expr,
  value,
  `${field} must be a member of ${enumSymbolName} enum from @angular/core`,
);
```

— i.e. `encapsulation must be a member of ViewEncapsulation enum from @angular/core`. And note it
must be **from `@angular/core`**: an identically-shaped local enum is rejected
(`isAngularCoreReferenceWithPotentialAliasing`).

⚠️ There is a **local-compilation shortcut** for exactly this field which is worth showing because
it is startlingly literal — `resolveEncapsulationEnumValueLocally` compares `expr.getText().trim()`
against the string `ViewEncapsulation.<Key>`:

```ts
const exprText = expr.getText().trim();

for (const key in ViewEncapsulation) {
  if (!Number.isNaN(Number(key))) {
    continue;
  }

  const suffix = `ViewEncapsulation.${key}`;

  // Check whether the enum is imported by name or used by import namespace (e.g.,
  // core.ViewEncapsulation.None)
  if (exprText === suffix || exprText.endsWith(`.${suffix}`)) {
```

### 10.6 — Tagged templates, `new`, and everything else off the list

All of these hit the final `else` of `visitExpression` and produce
`DynamicValue.fromUnsupportedSyntax` → the trace line `This syntax is not supported.`

Angular's own historical rule for `new`, from `aot-compiler.md` (ViewEngine wording, but the
*direction* still matches): > *"New instances — The compiler only allows metadata that create
instances of the class `InjectionToken` from `@angular/core`."* In ngtsc the mechanism is
different (there is simply no `ts.isNewExpression` branch), so if you cite the doc, say the
constraint survived and the mechanism did not.

Do **not** repeat the doc's foldability table (`aot-compiler.md`, "Foldable syntax") as current —
it describes the ViewEngine collector. If you want a table, build it from `visitExpression` and
`BINARY_OPERATORS` (§09), which is what actually runs.

### 10.7 — NG3003, import cycles

`adev/src/content/reference/errors/NG3003.md`, verbatim on the mechanism:

> *"There is already an import from `child.ts` to `parent.ts` since the `Child` references the
> `Parent` in its constructor."* … *"The generated code for this template must therefore contain a
> reference to the `Child` class. In order to make this reference, the compiler would have to add
> an import from `parent.ts` to `child.ts`, which would cause an import cycle."*

and the escape hatch, verbatim:

> *"If you are using NgModules, to avoid adding imports that create cycles, additional code is
> added to the `NgModule` class where the component that wires up the dependencies is declared.
> This is known as "remote scoping"."*

> *"Unfortunately, "remote scoping" code is side-effectful —which prevents tree shaking— and cannot
> be used in libraries. So when building libraries using the `"compilationMode": "partial"`
> setting, any component that would require a cyclic import will cause this `NG3003` compiler error
> to be raised."*

🔴 The consequence a standalone-era reader needs spelled out: **standalone components have no
NgModule to remote-scope into, so NG3003 is a hard error for them too.** The three documented fixes,
verbatim:

> *"Try to rearrange your dependencies to avoid the cycle. For example, using an intermediate
> interface that is stored in an independent file that can be imported to both dependent files
> without causing an import cycle."*
> *"Move the classes that reference each other into the same file, to avoid any imports between
> them."*
> *"Convert import statements to type-only imports (using `import type` syntax) if the imported
> declarations are only used as types, as type-only imports do not contribute to cycles."*

The error text from source, `annotations/component/src/handler.ts`:

```ts
throw new FatalDiagnosticError(
  ErrorCode.IMPORT_CYCLE_DETECTED,
  node,
  'One or more import cycles would need to be created to compile this component, ' +
    'which is not supported by the current compiler configuration.',
  relatedMessages,
);
```

with `makeCyclicImportInfo(dir.ref, dir.isComponent ? 'component' : 'directive', cycle)` producing
one related note per offending dependency. The doc shows the note's shape:

> *"The component Child is used in the template but importing it would create a cycle:
> /parent.ts -> /child.ts -> /parent.ts"*

The remote-scoping branch in the same function is worth showing — it is what happens *instead of*
the error when an NgModule is available:

```ts
const moduleSymbol = this.semanticDepGraphUpdater.getSymbol(scope.ngModule);
// …
moduleSymbol.addRemotelyScopedComponent(symbol, symbol.usedDirectives, symbol.usedPipes);
```

### 10.8 — Template and stylesheet resolution errors

`annotations/component/src/resources.ts`, verbatim.

Missing both (**NG2001**):

```ts
throw new FatalDiagnosticError(
  ErrorCode.COMPONENT_MISSING_TEMPLATE,
  decorator.node,
  '@Component is missing a template. Add either a `template` or `templateUrl`',
);
```

`templateUrl` that is not a string:

```ts
const templateUrl = evaluator.evaluate(templateUrlExpr);
if (typeof templateUrl !== 'string') {
  throw createValueHasWrongTypeError(
    templateUrlExpr,
    templateUrl,
    'templateUrl must be a string',
  );
}
```

`templateUrl` that will not resolve → `makeResourceNotFoundError(templateUrl, templateUrlExpr,
ResourceTypeForDiagnostics.Template)` (**NG2008**, `COMPONENT_RESOURCE_NOT_FOUND`), and — a real
incremental-build subtlety worth a gotcha:

```ts
if (depTracker !== null) {
  // The analysis of this file cannot be re-used if the template URL could
  // not be resolved. Future builds should re-analyze and re-attempt resolution.
  depTracker.recordDependencyAnalysisFailure(node.getSourceFile());
}
```

`template` that is not a string literal but does not fold to a string:

```ts
if (typeof resolvedTemplate !== 'string') {
  throw createValueHasWrongTypeError(
    template.expression,
    resolvedTemplate,
    'template must be a string',
  );
}
```

🔴 **The hidden cost of a non-literal `template`.** Same file — a string-literal template gets a
`'direct'` source mapping into the real bytes of your `.ts`; anything else gets `'indirect'`:

```ts
// Indirect templates cannot be mapped to a particular byte range of any input file, since
// they're computed by expressions that may span many files. Don't attempt to map them back
// to a given file.
sourceMapUrl = null;
```

So `template: TEMPLATE_CONST` compiles — and then every template error in it points at a synthetic
filename instead of at your source (chunk 17). That is a superb symptom → cause → fix gotcha:
**fix = inline the string literal, or move it to `templateUrl`.**

Related v22 error from the same family, `COMPONENT_INVALID_STYLE_URLS` (NG2021): *"Raised when a
component has both `styleUrls` and `styleUrl`."*

### 10.9 — Local compilation mode (`compilationMode: 'experimental-local'`)

Two dedicated codes, from `error_code.ts`, verbatim doc comments:

> `LOCAL_COMPILATION_UNRESOLVED_CONST = 11001` — *"In local compilation mode a const is required to
> be resolved statically but cannot be so since it is imported from a file outside of the
> compilation unit. This usually happens with const being used as Angular decorators parameters
> such as `@Component.template`, `@HostListener.eventName`, etc."*

> `LOCAL_COMPILATION_UNSUPPORTED_EXPRESSION = 11003` — *"In local compilation mode a certain
> expression or syntax is not supported. This is usually because the expression/syntax is not very
> common and so we did not add support for it yet."*

The two messages users see, verbatim from source (both quoted in full in §09 and §10.8): the
`@Component.selector` one and the `@Component.template` one, the latter offering three fixes —
*"1) Move the declaration into a file within the compilation unit, 2) Inline the template, 3) Move
the template into a separate .html file and include it using @Component.templateUrl"*.

### 10.10 — The rest of the NG2xxx family, for a completeness table

From `error_code.ts` doc comments, verbatim, all v22.1.5:

| code | name | doc comment |
|---|---|---|
| NG2005 | `UNDECORATED_PROVIDER` | *"Raised when an undecorated class is passed in as a provider to a module or a directive."* |
| NG2006 | `DIRECTIVE_INHERITS_UNDECORATED_CTOR` | *"Raised when a Directive inherits its constructor from a base class without an Angular decorator."* |
| NG2007 | `UNDECORATED_CLASS_USING_ANGULAR_FEATURES` | *"Raised when an undecorated class that is using Angular features has been discovered."* |
| NG2010 | `COMPONENT_NOT_STANDALONE` | *"Raised when a component has `imports` but is not marked as `standalone: true`."* |
| NG2011 | `COMPONENT_IMPORT_NOT_STANDALONE` | *"Raised when a type in the `imports` of a component is a directive or pipe, but is not standalone."* |
| NG2012 | `COMPONENT_UNKNOWN_IMPORT` | *"Raised when a type in the `imports` of a component is not a directive, pipe, or NgModule."* |
| NG2016 | `INJECTABLE_INHERITS_INVALID_CONSTRUCTOR` | *"Raised when a type with Angular decorator inherits its constructor from a base class which has a constructor that is incompatible with Angular DI."* |
| NG2020 | `CONFLICTING_INPUT_TRANSFORM` | *"Raised when a component specifies both a `transform` function on an input and has a corresponding `ngAcceptInputType_` member for the same input."* |
| NG2022 | `COMPONENT_UNKNOWN_DEFERRED_IMPORT` | *"Raised when a type in the `deferredImports` of a component is not a component, directive or pipe."* |
| NG2023 | `NON_STANDALONE_NOT_ALLOWED` | *"Raised when a `standalone: false` component is declared but `strictStandalone` is set."* |
| NG2027 | `COMPONENT_ANIMATIONS_CONFLICT` | *"A component is using both the `animations` property and `animate.enter` or `animate.leave` in the template."* (new in v22) |
| NG2028 | `SERVICE_CONSTRUCTOR_DI` | *"Raised when an `@Service` class is using constructor dependency injection."* (new in v22) |
| NG1006 | `DECORATOR_COLLISION` | *"This error code indicates that there are incompatible decorators on a type or a class field."* |
| NG1012 | `DUPLICATE_DECORATED_PROPERTIES` | — |
| NG1050–1054 | initializer-API family | e.g. NG1050 *"Raised when an initializer API is annotated with an unexpected decorator. e.g. `@Input` is also applied on the class member using `input`."*; NG1054 *"Raised whenever there are duplicate binding property names for outputs, inputs & models."* (the v22 "throw on duplicate input/outputs" breaking change) |
| NG1100 | `INCORRECTLY_DECLARED_ON_STATIC_MEMBER` | *"An Angular feature, like inputs, outputs or queries is incorrectly declared on a static member."* |
| NG5001 | `HOST_BINDING_PARSE_ERROR` | *"Raised when a host expression has a parse error, such as a host listener or host binding expression containing a pipe."* |
| NG5002 | `TEMPLATE_PARSE_ERROR` | *"Raised when the compiler cannot parse a component's template."* |

### Interview-question seeds for 10

- `export let SELECTOR;` with no initialiser. What error do you get, and why is it not "unknown
  identifier"?
- Why does `declare const SEL: 'app-x'` work in a `selector` but `declare const SEL: string` not?
- You get NG3003 on a standalone component. Remote scoping is not available to you — name two fixes
  and say which one costs nothing at runtime.
- `template: MY_TEMPLATE` compiles. What did you lose?

---

## §11 — Why `@defer` can split a bundle no bundler could

### What the guide says — start here, then go past it

`adev/src/content/guide/templates/defer.md`, verbatim:

> *"The code for any components, directives, and pipes inside the `@defer` block is split into a
> separate JavaScript file and loaded only when necessary, after the rest of the template has been
> rendered."*

> *"In order for the dependencies within a `@defer` block to be deferred, they need to meet two
> conditions:"*
> *"1. **They must be standalone.** Non-standalone dependencies cannot be deferred and are still
> eagerly loaded, even if they are inside of `@defer` blocks."*
> *"2. **They cannot be referenced outside of `@defer` blocks within the same file.** If they are
> referenced outside the `@defer` block or referenced within ViewChild queries, the dependencies
> will be eagerly loaded."*

> *"The transitive dependencies of the components, directives and pipes used in the `@defer` block
> do not strictly need to be standalone; transitive dependencies can still be declared in an
> `NgModule` and participate in deferred loading."*

> *"Angular's compiler produces a dynamic import statement for each component, directive, and pipe
> used in the `@defer` block. The main content of the block renders after all the imports resolve.
> Angular does not guarantee any particular order for these imports."*

> *"Keep in mind the dependencies of the placeholder block are eagerly loaded."* (and the same is
> said of `@loading` and `@error`)

> *"`@defer` blocks are compatible with both standalone and NgModule-based components, directives
> and pipes. However, **only standalone components, directives and pipes can be deferred**.
> NgModule-based dependencies are not deferred and are included in the eagerly loaded bundle."*

### The real condition list — eight bail-outs, read from source

`packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts`,
`registerDeferrableCandidate`, verbatim — **every `return` is a silently un-deferred dependency**:

```ts
private registerDeferrableCandidate(
  componentClassDecl: ClassDeclaration,
  element: ts.Expression,
  isDeferredImport: boolean,
  allDeferredDecls: Set<ClassDeclaration>,
  eagerlyUsedDecls: Set<ClassDeclaration>,
  resolutionData: ComponentResolutionData,
) {
  const node = tryUnwrapForwardRef(element, this.reflector) || element;

  if (!ts.isIdentifier(node)) {
    // Can't defer-load non-literal references.
    return;
  }

  const imp = this.reflector.getImportOfIdentifier(node);
  if (imp === null) {
    // Can't defer-load symbols which aren't imported.
    return;
  }

  const decl = this.reflector.getDeclarationOfIdentifier(node);
  if (decl === null) {
    // Can't defer-load symbols which don't exist.
    return;
  }

  if (!isNamedClassDeclaration(decl.node)) {
    // Can't defer-load symbols which aren't classes.
    return;
  }

  // Are we even trying to defer-load this symbol?
  if (!allDeferredDecls.has(decl.node)) {
    return;
  }

  if (eagerlyUsedDecls.has(decl.node)) {
    // Can't defer-load symbols that are eagerly referenced as a dependency
    // in a template outside of a defer block.
    return;
  }

  // Is it a standalone directive/component?
  const dirMeta = this.metaReader.getDirectiveMetadata(new Reference(decl.node));
  if (dirMeta !== null && !dirMeta.isStandalone) {
    return;
  }

  // Is it a standalone pipe?
  const pipeMeta = this.metaReader.getPipeMetadata(new Reference(decl.node));
  if (pipeMeta !== null && !pipeMeta.isStandalone) {
    return;
  }

  if (dirMeta === null && pipeMeta === null) {
    // This is not a directive or a pipe.
    return;
  }

  // Keep track of how this class made it into the current source file.
  // Store the full `Import` info so that callers can correctly determine the
  // exported name (handling aliasing) and the module specifier.
  resolutionData.deferrableDeclToImportDecl.set(decl.node, imp);

  this.deferredSymbolTracker.markAsDeferrableCandidate(
    node,
    imp.node,
    componentClassDecl,
    isDeferredImport,
  );
}
```

🔴 Turn each comment into a symptom → cause → fix pair. In particular:

- *"Can't defer-load non-literal references."* — `imports: [...SHARED_IMPORTS]` or
  `imports: MY_IMPORTS` un-defers **everything**, because the array elements are not identifiers.
  This is the concrete cost of the §09 nuance.
- *"Can't defer-load symbols which aren't imported."* — a class declared **in the same file** as
  the component can never be deferred. There is no import declaration to rewrite.
- `forwardRef(() => X)` **is** unwrapped (`tryUnwrapForwardRef`) — that one works.

### The ninth condition, and the true barrel mechanism

`packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts`. The class doc:

> *"Allows to register a symbol as deferrable and keep track of its usage. This information is
> later used to determine whether it's safe to drop a regular import of this symbol (actually the
> entire import declaration) in favor of using a dynamic import for cases when defer blocks are
> used."*

and the decisive function, verbatim:

```ts
/**
 * Whether all symbols from a given import declaration have no references
 * in a source file, thus it's safe to use dynamic imports.
 */
canDefer(importDecl: ts.ImportDeclaration): boolean {
  if (!this.imports.has(importDecl)) {
    return false;
  }

  const symbolsMap = this.imports.get(importDecl)!;
  for (const refs of symbolsMap.values()) {
    if (refs === AssumeEager || refs.size > 0) {
      // There may be still eager references to this symbol.
      return false;
    }
  }

  return true;
}
```

🔴 **This is the fact the docs do not have.** The unit of deferral is the **whole
`import { … } from '…'` declaration**, not the symbol. If one named import in that statement still
has any eager reference anywhere in the file, the statement cannot be removed, so **none** of its
symbols can be defer-loaded — including the one you wrapped in `@defer`.

```ts
// ILLUSTRATIVE — the shape of the trap, not compiler output
import {HeavyChart, TinyBadge} from './widgets';   // one declaration, two symbols

@Component({
  imports: [HeavyChart, TinyBadge],
  template: `
    <tiny-badge />
    @defer { <heavy-chart /> }
  `,
})
export class Dashboard {}
```

`TinyBadge` is used eagerly, so `canDefer` on that import declaration returns `false`, so
`HeavyChart` ships in the main bundle even though it is only used inside `@defer`. **Fix: split the
import statement.**

```ts
import {TinyBadge} from './widgets';
import {HeavyChart} from './widgets/heavy-chart';
```

Two supporting details from the same file:

```ts
/**
 * Given an import declaration node, extract the names of all imported symbols
 * and return them as a map where each symbol is a key and `AssumeEager` is a value.
 *
 * The logic recognizes the following import shapes:
 *
 * Case 1: `import {a, b as B} from 'a'`
 * Case 2: `import X from 'a'`
 * Case 3: `import * as x from 'a'`
 */
```

```ts
// If the entire import is a type-only import, none of the symbols can be eager.
if (importDecl.importClause.phaseModifier === ts.SyntaxKind.TypeKeyword) {
  return symbolMap;
}
```

and, in `lookupIdentifiersInSourceFile`, a subtle one worth a gotcha of its own:

```ts
// Don't record references from the declaration itself or inside
// type nodes which will be stripped from the JS output.
// Note that `ts.isTypeNode` returns `true` for `ExpressionWithTypeArguments`,
// which is used for both `extends` and `implements` heritage clauses. An `extends`
// clause on a class is a value expression that survives in the emitted JavaScript,
// so references within it must be recorded.
```

— so a `implements Foo` reference does not block deferral, but `extends Foo` does.

### The barrel-file trap, as documented

Same guide, `## Barrel files and lazy chunks`, verbatim:

> *"If you're using `@defer` but not seeing a separate lazy chunk in your build output, check how
> you're importing the deferred component. Importing through a barrel file (`index.ts`) is a common
> culprit — bundlers see the barrel as a single module and keep all its exports together, so your
> component ends up in the main bundle regardless of `@defer`."*

> *"The fix is straightforward — import directly from the component's own file… That's enough for
> the bundler to split it into its own chunk and load it lazily when the trigger fires."*

⚠️ Note the doc blames the **bundler**. The `canDefer` rule above is an *additional*, earlier
failure inside Angular's own compiler. A good chunk 11 distinguishes the two: Angular can decline
to emit the dynamic import at all, and even when it emits one, the bundler can decline to split.
Both produce the same symptom — "no lazy chunk" — and they have different fixes.

### What the compiler emits

`packages/compiler/src/render3/view/compiler.ts`, `compileDeferResolverFunction`, verbatim:

```ts
export function compileDeferResolverFunction(
  meta: R3DeferResolverFunctionMetadata,
): o.ArrowFunctionExpr {
  const depExpressions: o.Expression[] = [];

  if (meta.mode === DeferBlockDepsEmitMode.PerBlock) {
    for (const dep of meta.dependencies) {
      if (dep.isDeferrable) {
        // Callback function, e.g. `m () => m.MyCmp;`.
        const innerFn = o.arrowFn(
          // Default imports are always accessed through the `default` property.
          [new o.FnParam('m', o.DYNAMIC_TYPE)],
          o.variable('m').prop(dep.isDefaultImport ? 'default' : dep.symbolName),
        );

        // Dynamic import, e.g. `import('./a').then(...)`.
        const importExpr = new o.DynamicImportExpr(dep.importPath!)
          .prop('then')
          .callFn([innerFn], undefined, undefined, [
            // Necessary, because we might not generate extensions for the path
            // and TS may try to enforce it based on the compiler options.
            tsIgnoreComment(),
          ]);
        depExpressions.push(importExpr);
      } else {
        // Non-deferrable symbol, just use a reference to the type. Note that it's important to
        // go through `typeReference`, rather than `symbolName` in order to preserve the
        // original reference within the source file.
        depExpressions.push(dep.typeReference);
      }
    }
  } else {
    // … PerComponent branch, same shape, no isDeferrable check …
  }

  return o.arrowFn([], o.literalArr(depExpressions));
}
```

🔴 **The `else` branch is the visible symptom of failure**: a non-deferrable dependency is emitted
as a plain reference *inside the same array*, so the resolver function still exists and still
"works" — it just resolves that entry synchronously and the class stays in the eager bundle. There
is no error, no warning, and the `@defer` block still functions. That is why this fails silently.

The two emit modes, from the same file's `compileComponentFromMetadata`:

```ts
let allDeferrableDepsFn: o.ReadVarExpr | null = null;
if (
  meta.defer.mode === DeferBlockDepsEmitMode.PerComponent &&
  meta.defer.dependenciesFn !== null
) {
  const fnName = `${templateTypeName}_DeferFn`;
  constantPool.statements.push(
    new o.DeclareVarStmt(fnName, meta.defer.dependenciesFn, undefined, o.StmtModifier.Final),
  );
  allDeferrableDepsFn = o.variable(fnName);
}
```

— so in `PerComponent` mode you get one hoisted `MyComponent_DeferFn` const shared by every
`@defer` block in the component; in `PerBlock` mode each block gets its own inline arrow.
`handler.ts` selects the mode: `DeferBlockDepsEmitMode.PerComponent` when
`@Component.deferredImports` is in play (and in local-compilation mode), `PerBlock` otherwise.

### The runtime side

`packages/core/src/defer/interfaces.ts`, verbatim:

```ts
/**
 * Describes the shape of a function generated by the compiler
 * to download dependencies that can be defer-loaded.
 */
export type DependencyResolverFn = () => Array<Promise<DependencyType> | DependencyType>;
```

🔴 The `| DependencyType` in that union **is** the un-deferred case, expressed in the type system.

`packages/core/src/defer/instructions.ts`, `ɵɵdefer` — the docstring names every parameter:

```ts
/**
 * Creates runtime data structures for defer blocks.
 *
 * @param index Index of the `defer` instruction.
 * @param primaryTmplIndex Index of the template with the primary block content.
 * @param dependencyResolverFn Function that contains dependencies for this defer block.
 * @param loadingTmplIndex Index of the template with the loading block content.
 * @param placeholderTmplIndex Index of the template with the placeholder block content.
 * @param errorTmplIndex Index of the template with the error block content.
 * @param loadingConfigIndex Index in the constants array of the configuration of the loading.
 *     block.
 * @param placeholderConfigIndex Index in the constants array of the configuration of the
 *     placeholder block.
 * @param enableTimerScheduling Function that enables timer-related scheduling if `after`
 *     or `minimum` parameters are setup on the `@loading` or `@placeholder` blocks.
 * @param flags A set of flags to define a particular behavior (e.g. to indicate that
 *              hydrate triggers are present and regular triggers should be deactivated
 *              in certain scenarios).
 *
 * @codeGenApi
 */
export function ɵɵdefer(
  index: number,
  primaryTmplIndex: number,
  dependencyResolverFn?: DependencyResolverFn | null,
  loadingTmplIndex?: number | null,
  placeholderTmplIndex?: number | null,
  errorTmplIndex?: number | null,
  loadingConfigIndex?: number | null,
  placeholderConfigIndex?: number | null,
  enableTimerScheduling?: typeof ɵɵdeferEnableTimerScheduling | null,
  flags?: TDeferDetailsFlags | null,
) {
```

Every one of the sub-blocks is *just another template slot index* — that is the tie back to chunk
07's slot model, and it is why the `@placeholder` / `@loading` / `@error` dependencies are eager:
they live in ordinary templates in the same `decls` range.

### `deferredImports` and NG8014

`@Component.deferredImports` is the explicit form. When the compiler cannot remove the import
declaration behind it, `handler.ts` emits, verbatim:

```ts
const diagnostic = makeDiagnostic(
  ErrorCode.DEFERRED_DEPENDENCY_IMPORTED_EAGERLY,
  importDecl,
  `This import contains symbols that are used both inside and outside of the ` +
    `\`@Component.deferredImports\` fields in the file. This renders all these ` +
    `defer imports useless as this import remains and its module is eagerly loaded. ` +
    `To fix this, make sure that all symbols from the import are *only* used within ` +
    `\`@Component.deferredImports\` arrays and there are no other references to those ` +
    `symbols present in this file.`,
);
```

🔴 **That message is `canDefer` speaking out loud.** With `imports` the same situation is silent;
with `deferredImports` you get told. That asymmetry is worth its own gotcha: *if you suspect a
`@defer` block is not splitting, move the dependency to `deferredImports` to turn the silence into
a diagnostic.*

The companion errors, from `error_code.ts` doc comments, verbatim:

- NG8012 `DEFERRED_PIPE_USED_EAGERLY` — *"A pipe imported via `@Component.deferredImports` is used
  outside of a `@defer` block in a template."*
- NG8013 `DEFERRED_DIRECTIVE_USED_EAGERLY` — *"A directive/component imported via
  `@Component.deferredImports` is used outside of a `@defer` block in a template."*
- NG8014 `DEFERRED_DEPENDENCY_IMPORTED_EAGERLY` — *"A directive/component/pipe imported via
  `@Component.deferredImports` is also included into the `@Component.imports` list."*

### HMR turns the whole feature off

`handler.ts`, verbatim:

```ts
// Dependencies can't be deferred during HMR, because the HMR update module can't have
// … are deferred, their imports will be deleted so we may lose the reference to them.
this.canDeferDeps = !enableHmr;
```

`packages/core/src/defer/instructions.ts`, the dev-mode warning, verbatim:

```ts
RuntimeErrorCode.DEFER_IN_HMR_MODE,
'Angular has detected that this application contains `@defer` blocks ' +
  'and the hot module replacement (HMR) mode is enabled. All `@defer` ' +
  'block dependencies will be loaded eagerly.',
```

and the guide, verbatim: > *"When Hot Module Replacement (HMR) is active, all `@defer` block chunks
are fetched eagerly, overriding any configured triggers. To restore the standard trigger behavior,
you must disable HMR by serving your application with the `--no-hmr` flag."*

🔴 **This is the #1 false alarm.** "My `@defer` block loads immediately in `ng serve`" is usually
HMR, not a mistake. Lead a gotcha with it.

### The `onlyExplicitDeferDependencyImports` escape hatch

`public_options.ts`, verbatim: > *"Specifies whether Angular compiler should rely on explicit
imports via `@Component.deferredImports` field for `@defer` blocks and generate dynamic imports
only for types from that list. This flag is needed to enable stricter behavior internally to make
sure that local compilation with specific internal configuration can support `@defer` blocks."*

### SSR

Guide, verbatim: > *"By default, when rendering an application on the server (either using SSR or
SSG), defer blocks always render their `@placeholder` (or nothing if a placeholder is not
specified) and triggers are not invoked. On the client, the content of the `@placeholder` is
hydrated and triggers are activated."*

⚠️ Per the lane brief: incremental hydration is **on by default** with `provideClientHydration` in
v22 and `withIncrementalHydration` is deprecated — opt out with `withNoIncrementalHydration()`. The
guide sentence above still says *"you can enable the Incremental Hydration feature"*; if you quote
it, note the v22 default. (The CHANGELOG v22.0.0 platform-browser line is *"make incremental
hydration default behavior"*, commit `68628dd45b`.)

### Compile-time trigger diagnostics (all `@defer`, all v22-relevant)

From `error_code.ts` doc comments, verbatim:

- NG8010 `INACCESSIBLE_DEFERRED_TRIGGER_ELEMENT` — *"The trigger of a `defer` block cannot access
  its trigger element, either because it doesn't exist or it's in a different view."*
- NG8019 `DEFER_IMPLICIT_TRIGGER_MISSING_PLACEHOLDER` — *"An `@defer` block with an implicit trigger
  does not have a placeholder"*
- NG8020 `DEFER_IMPLICIT_TRIGGER_INVALID_PLACEHOLDER` — *"The `@placeholder` for an implicit
  `@defer` trigger is not set up correctly"* (its example is multiple root nodes)
- NG8021 `DEFER_TRIGGER_MISCONFIGURATION` — *"Raised when an `@defer` block defines unreachable or
  redundant triggers. Examples: multiple main triggers, 'on immediate' together with other mains or
  any prefetch, prefetch timer delay that is not earlier than the main timer, or an identical
  prefetch"* — this one is an **extended diagnostic**, see §15, and it is new in v22
  (CHANGELOG: *"Adds warning for prefetch without main defer trigger"*, commit `7f9450219f`).

### Interview-question seeds for 11

- Angular's compiler emits a dynamic import that no bundler could have inferred. What information
  does the compiler have that the bundler does not?
- Two people report "`@defer` isn't producing a chunk". One is on `ng serve`; one has a barrel
  file. Diagnose both.
- Why does `imports: [...SHARED]` break lazy loading when it compiles perfectly?
- What is the difference in *observable behaviour* between `imports` and `deferredImports` when a
  dependency can't be deferred?
- `DependencyResolverFn` returns `Array<Promise<DependencyType> | DependencyType>`. Why is the
  non-promise arm of that union there?

---

## §12 — Ivy and locality

⚠️ **Both design docs cited here are 2018 drafts still in the repo.** Cite their *architecture*
claims; never their artefacts (`ngcc`, `.metadata.json`, `NgComponentDef`, Tsickle, "as of
TypeScript 2.7"). See C12. A page that quotes them without that caveat has misled the reader.

### The thesis sentence

`packages/compiler/design/separate_compilation.md`, verbatim — **this is the quote the chunk is
built around**:

> *"The mental model of Ivy is that the decorator is the compiler. That is, the decorator can be
> thought of as parameters to a class transformer that transforms the class by generating
> definitions based on the decorator parameters. A `@Component` decorator transforms the class by
> adding an `ɵcmp` static property, `@Directive` adds `ɵdir`, `@Pipe` adds `ɵpipe`, etc. In most
> cases the values supplied to the decorator are sufficient to generate the definition. However, in
> the case of interpreting the template, the compiler needs to know the selector defined for each
> component, directive and pipe that are in the scope of the template."*

And the reason it exists:

> *"In Ivy, the runtime is crafted in a way that allows for separate compilation by performing at
> runtime much of what was previously pre-calculated by the compiler. This allows the definition of
> components to change without requiring modules and components that depend on them to be
> recompiled."*

The contrast it is arguing against, same doc, verbatim:

> *"In 5.0 and prior versions of Angular the compiler performs whole program analysis and generates
> template and injector definitions that use this global knowledge to flatten injector scope
> definitions, inline directives into the component, pre-calculate queries, pre-calculate content
> projection, etc. This global knowledge requires that module and component factories are generated
> as the final global step when compiling a module. If any of the transitive information changed,
> then all factories need to be regenerated."*

> *"Separate component and module compilation is supported only at the module definition level and
> only from the source. That is, npm packages must contain the metadata necessary to generate the
> factories. They cannot contain, themselves, the generated factories. This is because if any of
> their dependencies change, their factories would be invalid, preventing them from using version
> ranges in their dependencies."*

🔴 **That last sentence is the whole business case.** Pre-Ivy, a published library could not ship
compiled output *because semver ranges existed*. Ivy's locality is what made "compile once, publish,
link at the consumer's version" possible. Chunk 12 should land that.

The doc's field-destination table is a good, compact artefact to adapt (it lists where each piece
of a `CompileDirectiveSummary` ends up), with the doc's own conclusion, verbatim:

> *"Only one definition is generated per class. All components are directives so a `ɵcmp` contains
> all the `ɵdir` information. All directives are injectable so `ɵcmp` and `ɵdir` contain `ɵprov`
> information."*

> *"The only pieces of information that are not generated into the definition are the directive
> selector and the pipe name as they go into the module scope."*

### Locality as an enforced engineering rule

`packages/compiler/design/architecture.md`, "Compiler design", verbatim — this is locality stated
as a *constraint on the compiler's own code*, which is far stronger than stating it as a slogan:

> *"Each "Compiler" which transforms a single decorator into a static field will operate as a "pure
> function". Given input metadata about a particular type and decorator, it will produce an object
> describing the field to be added to the type, as well as the initializer value for that field (in
> Output AST format)."*

> *"A Compiler must not depend on any inputs not directly passed to it (for example, it must not
> scan sources or metadata for other symbols). This restriction is important for two reasons:"*
> *"1. It helps to enforce the Ivy locality principle, since all inputs to the Compiler will be
> visible."*
> *"2. It protects against incorrect builds during `--watch` mode, since the dependencies between
> files will be easily traceable."*

> *"Compilers will also not take Typescript nodes directly as input, but will operate against
> information extracted from TS sources by the transformer. In addition to helping enforce the rules
> above, this restriction also enables Compilers to run at runtime during JIT mode."*

🔴 **Reason 2 is the under-told half.** Locality is not only about publishing libraries — it is what
makes incremental rebuild *correct*. Same doc, "Watch mode", verbatim:

> *"This mode works for the Angular transformer and most of the decorator compilers, because they
> operate only using the metadata from one particular file. The exception is the `@Component`
> decorator, which requires the selector scope for the module in which the component is declared
> in. Effectively, this means that all components within a selector scope must be recompiled
> together, as any changes to the component selectors or type names, for example, will invalidate
> the compilation of all templates of all components in the scope. Since TypeScript will not track
> these changes, it's the responsibility of `ngtsc` to ensure the re-compilation of the right set of
> files."*

And the one place locality genuinely breaks, verbatim from the same doc:

> *"This transformation is done file by file with no global knowledge except during the
> type-checking and for reference inversion discussed below."*

> *"Most of the compilers are straight forward translations of the metadata specified in the
> decorator to the information provided in the corresponding definition and, therefore, do not
> require anything outside the source file to perform the conversion. However, the component, during
> production builds and for type checking a template require the module scope of the component
> which requires information from other files in the program."*

So: **locality is exact for `@Injectable`, `@Pipe`, `@Directive`; approximate for `@Component`.**
Standalone shrank the exception from "the whole module scope" to "the `imports` array of this one
class" — which is why topic 02 and this chunk are the same story told from two ends.

### Locality's receipts inside the runtime

Three quotes already banked, all of which say *the runtime pays a cost so the compiler can stay
local*. Chunk 12 should collect them:

1. `TView.expandoStartIndex` (§07): > *"Unlike the "decls" and "vars" sections of `LView`, the
   length of this section cannot be calculated at compile-time because directives are matched at
   runtime to preserve locality."*
2. `ɵɵproperty` (§07): > *"This check must be conducted at runtime so child components that add new
   `@Inputs` don't have to be re-compiled"*
3. `ComponentDef.tView` (§06): > *"Ivy runtime uses this place to store the computed tView for the
   component. This gets filled on the first run of component."* — the `TView` is *computed at first
   render*, not baked at build time, for the same reason.

### Partial compilation — locality taken to its conclusion

`TargetOptions.compilationMode`, from `public_options.ts`, verbatim:

> *"Specifies the compilation mode to use. The following modes are available:"*
> *"- 'full': generates fully AOT compiled code using Ivy instructions."*
> *"- 'partial': generates code in a stable, but intermediate form suitable for publication to
> NPM."*
> *"- 'experimental-local': generates code based on each individual source file without using its
> dependencies. This mode is suitable only for fast edit/refresh during development. It will be
> eventually replaced by the value `local` once the feature is ready to be public."*
> *"The default value is 'full'."*

angular.dev's version, `reference/configs/angular-compiler-options.md`, verbatim:

> *"`'full'` — Generates fully AOT-compiled code according to the version of Angular that is
> currently being used."*
> *"`'partial'` — Generates code in a stable, but intermediate form suitable for a published
> library."*

The partial-mode output calls `ɵɵngDeclare*` instead of `ɵɵdefine*`. From
`packages/core/src/render3/jit/partial.ts`, verbatim:

```ts
/**
 * Compiles a partial directive declaration object into a full directive definition object.
 *
 * @codeGenApi
 */
export function ɵɵngDeclareDirective(decl: R3DeclareDirectiveFacade): unknown {
  const compiler = getCompilerFacade({
    usage: JitCompilerUsage.PartialDeclaration,
    kind: 'directive',
    type: decl.type,
  });
  return compiler.compileDirectiveDeclaration(
    angularCoreEnv,
    `ng:///${decl.type.name}/ɵfac.js`,
    decl,
  );
}
```

The full family, from `r3_identifiers.ts`: `ɵɵngDeclareComponent`, `ɵɵngDeclareDirective`,
`ɵɵngDeclarePipe`, `ɵɵngDeclareInjectable`, `ɵɵngDeclareInjector`, `ɵɵngDeclareNgModule`,
`ɵɵngDeclareFactory`, `ɵɵngDeclareService`, `ɵɵngDeclareClassMetadata`,
`ɵɵngDeclareClassMetadataAsync`.

**The linker** is a published entry point of `@angular/compiler-cli`, from its `package.json`
`exports` at `v22.1.5`:

```json
"./linker": {
  "types": "./linker/index.d.ts",
  "default": "./bundles/linker/index.js"
},
"./linker/babel": {
  "types": "./linker/babel/index.d.ts",
  "default": "./bundles/linker/babel/index.js"
}
```

— a Babel plugin. That is how a library published as `ɵɵngDeclareComponent(...)` becomes
`ɵɵdefineComponent(...)` **at the application's Angular version, during the application's build**.
🔴 **The library is compiled once and linked N times.** That sentence is the payoff of the whole
chunk.

Note also from the same `partial.ts` the source-URL string `` `ng:///${decl.type.name}/ɵfac.js` `` —
the linker/JIT path names its generated functions so they appear meaningfully in a stack trace.

### Version skew is a first-class, coded concern

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts` at `v22.1.5` — five separate feature gates,
each reading the **resolved `@angular/core` version**, not the compiler's own. Verbatim:

```ts
    // Standalone by default is enabled since v19. We need to toggle it here,
    // because the language service extension may be running with the latest
    // version of the compiler against an older version of Angular.
    this.implicitStandaloneValue =
      this.angularCoreVersion === null ||
      coreVersionSupportsFeature(this.angularCoreVersion, '>= 19.0.0');
```

and, from the surrounding lines and `getTypeCheckingConfig`:

| field | gate |
|---|---|
| `enableBlockSyntax` (`@if` / `@for` / `@switch`) | `>= 17.0.0` |
| `enableLetSyntax` (`@let`) | `>= 18.1.0` |
| `implicitStandaloneValue` | `>= 19.0.0` |
| `allowSignalsInTwoWayBindings` | `>= 17.2.0-0` |
| `allowDomEventAssertion` | `>= 20.2.0` |

with this comment on the signals one, verbatim:

> *"Check whether the loaded version of `@angular/core` in the `ts.Program` supports unwrapping
> writable signals for type-checking. Only Angular versions greater than 17.2 have the necessary
> symbols to type check signals in two-way bindings. We also allow version 0.0.0 in case somebody is
> using Angular at head."*

🔴 **This is the single most concrete demonstration of locality in the codebase.** The *template
language itself* — whether `@if` parses, whether `@let` parses, whether a component is standalone by
default — is decided by the version of `@angular/core` your file resolves to. A v18-pinned library
in a monorepo compiles under the v22 compiler as a v18 library. Chunk 12 should show the table.

### What locality bought the ecosystem — the concrete list

Every item traceable to something quoted above:

1. **Libraries publish compiled output.** (separate_compilation.md background; the `./linker` entry
   point.)
2. **Semver ranges work again.** (separate_compilation.md: factories "would be invalid, preventing
   them from using version ranges".)
3. **Incremental rebuilds are correct and narrow.** (architecture.md watch-mode section.)
4. **Templates tree-shake.** (`dependencies` on the def, §06; reference inversion, §08.)
5. **`@defer` can split a chunk.** (§11 — the compiler knows this component's dependency list
   locally, which is exactly what a bundler does not.)
6. **Mixed-version monorepos compile.** (the five feature gates above.)
7. **JIT and AOT are the same compiler.** (architecture.md: *"this restriction also enables
   Compilers to run at runtime during JIT mode"*; and `ɵɵngDeclare*` is literally the JIT path
   re-used for partial output.)

### Interview-question seeds for 12

- "The decorator is the compiler." What does that sentence rule out?
- Locality is supposed to mean a class compiles from its own file alone. Where does that break, and
  what did standalone do to the exception?
- Why could a pre-Ivy library not ship compiled factories to npm?
- A monorepo has one package pinned to Angular 18 and another on 22. Which of the two compilers
  runs, and what decides whether `@let` is legal in the v18 package's templates?
- What is `compilationMode: 'partial'` for, and what does the consumer do with its output?

---

## §13 — Where the compiler runs: `ngtsc`

### It is not a separate pass. It is a TypeScript transformer.

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`, `NgCompiler.prepareEmit()`, verbatim — this
is the definitive proof and it should be the centrepiece of the chunk:

```ts
/**
 * Fetch transformers and other information which is necessary for a consumer to `emit` the
 * program with Angular-added definitions.
 */
prepareEmit(): {
  transformers: ts.CustomTransformers;
} {
  const compilation = this.ensureAnalyzed();

  // Untag all the files, otherwise TS 5.4 may end up emitting
  // references to typecheck files (see #56945 and #57135).
  untagAllTsFiles(this.inputProgram);

  const coreImportsFrom = compilation.isCore ? getR3SymbolsFile(this.inputProgram) : null;
  let importRewriter: ImportRewriter;
  if (coreImportsFrom !== null) {
    importRewriter = new R3SymbolsImportRewriter(coreImportsFrom.fileName);
  } else {
    importRewriter = new NoopImportRewriter();
  }

  const defaultImportTracker = new DefaultImportTracker();

  const before: ts.TransformerFactory<ts.SourceFile>[] = [
    ivyTransformFactory(/* … */),
    aliasTransformFactory(compilation.traitCompiler.exportStatements),
    defaultImportTracker.importPreservingTransformer(),
  ];
  // … JIT transform pushed conditionally …
  // Typescript transformer to add debugName metadata to signal functions.
  before.push(signalMetadataTransform(this.inputProgram));

  const afterDeclarations: ts.TransformerFactory<ts.SourceFile>[] = [];
  // …
    afterDeclarations.push(
      declarationTransformFactory(
        compilation.dtsTransforms,
        compilation.reflector,
        compilation.refEmitter,
        importRewriter,
      ),
    );
  // …
  return {transformers: {before, afterDeclarations} as ts.CustomTransformers};
}
```

🔴 **Read that return type out loud: `ts.CustomTransformers`.** Angular does not read your
TypeScript and write JavaScript. It hands `tsc` a list of AST-to-AST transforms and lets `tsc`
do the emitting. Everything else in this topic follows from that one decision.

The design doc says why that choice was forced, `architecture.md`, verbatim:

> *"TypeScript supports the following extension points to alter its output. You can, 1. Modify the
> TypeScript source it sees (`CompilerHost.getSourceFile`) 2. Alter the list of transforms
> (`CustomTransformers`) 3. Intercept the output before it is written (`WriteFileCallback`)"*

> *"It is not recommended to alter the source code as this complicates the managing of source maps,
> makes it difficult to support incremental parsing, and is not supported by TypeScript's language
> service plug-in model."*

> *"Angular transforms the `.js` output by adding Angular specific transforms to the list of
> transforms executed by TypeScript."*

⚠️ The same doc then says *"As of TypeScript 2.7, there is no similar transformer pipe-line for
`.d.ts` files so the .d.ts files will be altered during the `WriteFileCallback`."* — **obsolete**.
At `v22.1.5` the `.d.ts` work is done through `afterDeclarations`, a first-class TypeScript hook.
Cite the extension-point list, flag the `.d.ts` sentence as historical.

The transformer list itself, named:

| transformer | job |
|---|---|
| `ivyTransformFactory` | adds `ɵcmp` / `ɵdir` / `ɵpipe` / `ɵprov` / `ɵinj` / `ɵfac` statics and removes the decorators |
| `aliasTransformFactory` | private re-exports (`generateDeepReexports`) |
| `defaultImportTracker.importPreservingTransformer()` | stops TS eliding a default import that is now only referenced from generated code |
| `angularJitApplicationTransform` (conditional) | only when JIT declarations exist |
| `signalMetadataTransform` | *"Typescript transformer to add debugName metadata to signal functions."* |
| `declarationTransformFactory` (in `afterDeclarations`) | writes `ɵɵComponentDeclaration<…>` etc. into the `.d.ts` |

And the analysis phase that must run first, `analyzeAsync`, whose doc comment explains why
`templateUrl` forces asynchrony:

> *"Normally, this operation happens lazily whenever `getDiagnostics` or `prepareEmit` are called.
> However, certain consumers may wish to allow for an asynchronous phase of analysis, where
> resources such as `styleUrls` are resolved asynchronously. In these cases `analyzeAsync` must be
> called first, and its `Promise` awaited prior to calling any other APIs of `NgCompiler`."*

`architecture.md`'s flow list is still broadly accurate for the ordering and worth adapting (steps
1–8, "Create the `ts.Program`" … "During the emit callback for .d.ts files…"), with the caveat
about step 8 and about Tsickle.

### `ngc`

From the published `@angular/compiler-cli@22.1.5` `package.json`:

```json
"bin": {
  "ngc": "./bundles/src/bin/ngc.js",
  "ng-xi18n": "./bundles/src/bin/ng_xi18n.js"
}
```

angular.dev, `reference/configs/angular-compiler-options.md`, verbatim:

> *"Most of the time, you interact with the Angular Compiler indirectly using Angular CLI. When
> debugging certain issues, you might find it useful to invoke the Angular Compiler directly. You
> can use the `ngc` command provided by the `@angular/compiler-cli` npm package to call the compiler
> from the command line."*

> *"The `ngc` command is a wrapper around TypeScript's `tsc` compiler command. The Angular Compiler
> is primarily configured through `tsconfig.json` while Angular CLI is primarily configured through
> `angular.json`."*

> *"Besides the configuration file, you can also use `tsc` command line options to configure `ngc`."*

That last sentence is the cleanest one-liner for the whole chunk: **`ngc` takes `tsc`'s flags
because `ngc` is `tsc`.**

### 🔴 Why the TypeScript peer pin is hard

`packages/compiler-cli/src/typescript_support.ts` at `v22.1.5`, verbatim:

```ts
/**
 * Minimum supported TypeScript version
 * ∀ supported typescript version v, v >= MIN_TS_VERSION
 *
 * Note: this check is disabled in g3, search for
 * `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3.
 */
const MIN_TS_VERSION = '6.0.0';

/**
 * Supremum of supported TypeScript versions
 * ∀ supported typescript version v, v < MAX_TS_VERSION
 * MAX_TS_VERSION is not considered as a supported TypeScript version
 *
 * Note: this check is disabled in g3, search for
 * `angularCompilerOptions.disableTypeScriptVersionCheck` config param value in g3.
 */
const MAX_TS_VERSION = '6.1.0';
```

```ts
export function checkVersion(version: string, minVersion: string, maxVersion: string) {
  if (compareVersions(version, minVersion) < 0 || compareVersions(version, maxVersion) >= 0) {
    throw new Error(
      `The Angular Compiler requires TypeScript >=${minVersion} and <${maxVersion} but ${version} was found instead.`,
    );
  }
}
```

So the exact string a reader will search for is:
`The Angular Compiler requires TypeScript >=6.0.0 and <6.1.0 but <yours> was found instead.`

Matching published metadata (§1.1): `"typescript": ">=6.0 <6.1"`, marked
`peerDependenciesMeta.typescript.optional: true` in the repo `package.json`.

The escape hatch, from `MiscOptions` verbatim: > *"`disableTypeScriptVersionCheck` — Disable
TypeScript Version Check."* and angular.dev: > *"When `true`, the compiler does not look at the
TypeScript version and does not report an error when an unsupported version of TypeScript is used.
Not recommended, as unsupported versions of TypeScript might have undefined behavior. Default is
`false`."*

**The v22 receipts**, CHANGELOG 22.0.0 breaking changes, verbatim:
> *"* TypeScript versions older than 6.0 are no longer supported."*
and the core feature line *"drop support for TypeScript 5.9"* (commit `8fe025f514`).
`packages/compiler-cli/package.json` at `v22.1.5` pins `devDependencies.typescript` to exactly
`"6.0.3"`.

**Why the window is one minor version wide** — argue it from what ngtsc actually consumes, all of
which is visible in the sources quoted across this bank:

- `ts.TransformerFactory` / `ts.CustomTransformers` with `before` and `afterDeclarations`
- the `ts.TypeChecker` (`getSymbolAtLocation`, `getAliasedSymbol`)
- `ts.SyntaxKind` — the partial evaluator switches on roughly 25 node kinds and on individual
  operator tokens; `ts.identifierToKeywordKind`; `importClause.phaseModifier`
- `ts.DiagnosticCategory`, `ts.DiagnosticWithLocation`, `ts.DiagnosticMessageChain`,
  `ts.DiagnosticRelatedInformation` — Angular's whole error surface **is** TypeScript diagnostics
- `ts.createSourceFile`, `ts.ScriptTarget.Latest`, `ts.ScriptKind.TS` for the type-check shims
- `ts.getOriginalNode`, `node.getStart()`, `node.getWidth()` for source positions
- program reuse for watch mode

None of that is public-stable API in TypeScript's semver sense. A one-minor window is the honest
consequence.

### The NG error-code encoding — a verifiable detail worth the whole chunk

`packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts`, verbatim below except that the two ANSI escape
bytes inside the regex have been stripped for this file — in the real source each `[` in the
matcher is preceded by a literal escape character, because the matcher has to reach *through*
`tsc`'s colouring to find the code:

```ts
const ERROR_CODE_MATCHER = /(\[\d+m ?)TS-99(\d+: ?\[\d+m)/g;

const ERROR_CODE_MARKER = 99;

/**
 * During formatting of `ts.Diagnostic`s, the numeric code of each diagnostic is prefixed with the
 * hard-coded "TS" prefix. For Angular's own error codes, a prefix of "NG" is desirable. To achieve
 * this, all Angular error codes start with "-99" so that the sequence "TS-99" can be assumed to
 * correspond with an Angular specific error code. This function replaces those occurrences with
 * just "NG".
 *
 * @param errors The formatted diagnostics
 */
export function replaceTsWithNgInErrors(errors: string): string {
  return errors.replace(ERROR_CODE_MATCHER, '$1NG$2');
}

export function ngErrorCode(code: ErrorCode): number {
  const absoluteCode = Math.abs(code);
  return -(ERROR_CODE_MARKER * 10 ** decimalDigits(absoluteCode) + absoluteCode);
}

export function formatCompilerErrorCode(code: number): string {
  return `NG${Math.abs(code)}`;
}
```

🔴 **`NG1001` is really TypeScript diagnostic `-991001`, formatted by `tsc` as `TS-991001`, and
then string-replaced to `NG1001`.** That is the most vivid available demonstration of "Angular is a
TypeScript plugin", and it is checkable in twelve lines of source.

Same file — the reason some `ErrorCode` enum members are **negative**:

```ts
/**
 * Given a raw TypeScript diagnostic code, returns the corresponding {@link ErrorCode} if it is a
 * negative Angular error code that has an associated error guide, or `null` otherwise.
 */
export function errorCodeWithGuideFromDiagnosticCode(code: number): ErrorCode | null {
  const absoluteErrorCode = absoluteErrorCodeFromDiagnosticCode(code);
  if (absoluteErrorCode === null) {
    return null;
  }

  const codeWithGuide = -absoluteErrorCode;
  return ErrorCode[codeWithGuide] !== undefined ? codeWithGuide : null;
}

/**
 * Appends a "Find more at <url>" guide link to the message text of a diagnostic.
 */
export function addDiagnosticDetails(code: ErrorCode, messageText: string): string {
  const details = `Find more at ${ERROR_DETAILS_PAGE_BASE_URL}/${formatCompilerErrorCode(code)}`;
  return appendMessageText(messageText, details);
}
```

🔴 **A negative value in the `ErrorCode` enum means "this code has a documentation page".** Verify
it. The negative members at `v22.1.5` are exactly:

`-1001` `-2003` `-2009` `-3003` `-6100` `-8001` `-8002` `-8003` `-8023` `-8024`

and the "Compiler errors" table in `adev/src/content/reference/errors/overview.md` lists exactly:

`NG1001` `NG2003` `NG2009` `NG3003` `NG6100` `NG8001` `NG8002` `NG8003` `NG8023` `NG8024`

**Ten and ten, in the same order.** The enum's sign bit is a build-time index into the docs site.
Nothing on angular.dev says this; it is pure source reading, and it is the kind of fact this corpus
exists for.

The URL is computed at runtime from the framework version —
`packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts`, verbatim:

```ts
export const DOC_PAGE_BASE_URL: string = (() => {
  const full = VERSION.full;
  const isPreRelease =
    full.includes('-next') || full.includes('-rc') || full === '0.0.0' + '-PLACEHOLDER';
  const prefix = isPreRelease ? 'next' : `v${VERSION.major}`;
  return `https://${prefix}.angular.dev`;
})();

/**
 * Base URL for the error details page.
 *
 * Keep the files below in full sync:
 *  - packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts
 *  - packages/core/src/error_details_base_url.ts
 */
export const ERROR_DETAILS_PAGE_BASE_URL: string = (() => {
  return `${DOC_PAGE_BASE_URL}/errors`;
})();
```

— so on Angular 22 the link printed in your terminal is `https://v22.angular.dev/errors/NG1001`,
and on a `-next` build it is `https://next.angular.dev/errors/…`. Gotcha: **the link in your
terminal is version-pinned; the one you reach by searching is not.**

And the error carrier itself, `diagnostics/src/error.ts`, with an unusually candid comment:

```ts
export class FatalDiagnosticError extends Error {
  // …
  // Trying to hide `.message` from `Error` to encourage users to look
  // at `diagnosticMessage` instead.
  declare message: never;
```

### The synthetic files ngtsc adds to your program

`packages/compiler-cli/src/ngtsc/typecheck/src/shim.ts`, verbatim:

```ts
/**
 * A `ShimGenerator` which adds type-checking files to the `ts.Program`.
 *
 * This is a requirement for performant template type-checking, as TypeScript will only reuse
 * information in the main program when creating the type-checking program if the set of files in
 * each are exactly the same. Thus, the main program also needs the synthetic type-checking files.
 */
export class TypeCheckShimGenerator implements PerFileShimGenerator {
  readonly extensionPrefix = 'ngtypecheck';
  readonly shouldEmit = false;
  // …
  static shimFor(fileName: AbsoluteFsPath): AbsoluteFsPath {
    return absoluteFrom(fileName.replace(/\.tsx?$/, '.ngtypecheck.ts'));
  }
}
```

with the placeholder content each one starts as:
`'export const USED_FOR_NG_TYPE_CHECKING = true;'`

🔴 **Your `ts.Program` contains one `.ngtypecheck.ts` file per source file that you never wrote and
that is never emitted** (`shouldEmit = false`). Chunk 13 states the fact; chunk 14 explains what
goes into them.

### Config-time diagnostics raised before any compilation happens

`compiler.ts`, `verifyCompatibleTypeCheckOptions` and `verifyEmitDeclarationOnly` — verbatim. The
first is the most commonly hit:

```
Angular compiler option "extendedDiagnostics" is configured, however "strictTemplates" is disabled.

Using "extendedDiagnostics" requires that "strictTemplates" is also enabled.

One of the following actions is required:
1. Remove "strictTemplates: false" to enable it.
2. Remove "extendedDiagnostics" configuration to disable them.
```

```
Angular compiler option "extendedDiagnostics.defaultCategory" has an unknown diagnostic category: "<value>".

Allowed diagnostic categories are:
<list>
```

```ts
messageText: 'TS compiler option "emitDeclarationOnly" is not supported.',
```

Full NG4xxx family from `error_code.ts`: `CONFIG_FLAT_MODULE_NO_INDEX = 4001`,
`CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK = 4002`,
`CONFIG_EXTENDED_DIAGNOSTICS_IMPLIES_STRICT_TEMPLATES = 4003`,
`CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CATEGORY_LABEL = 4004`,
`CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CHECK = 4005`,
`CONFIG_EMIT_DECLARATION_ONLY_UNSUPPORTED = 4006`.

### ⚠️ Stale options on angular.dev — say this plainly

`reference/configs/angular-compiler-options.md` still documents eight options that are **not in the
v22 public option surface** (`goldens/public-api/compiler-cli/compiler_options.api.md`):
`annotationsAs`, `disableExpressionLowering`, `enableResourceInlining`, `enableLegacyTemplate`,
`generateCodeForLibraries`, `skipMetadataEmit`, `skipTemplateCodegen`, `strictMetadataEmit`.
The five `LegacyNgcOptions` that **do** survive are `allowEmptyCodegenFiles` (deprecated:
*"This option is not used anymore."*), `flatModuleId`, `flatModuleOutFile`, `preserveWhitespaces`,
`strictInjectionParameters`.

`strictInjectionParameters`, verbatim from `public_options.ts`: > *"Always report errors a parameter
is supplied whose injection type cannot be determined. When this value option is not provided or is
`false`, constructor parameters of classes marked with `@Injectable` whose type cannot be resolved
will produce a warning. With this option `true`, they produce an error."* (angular.dev adds: *"For
library projects created with the Angular CLI, the development configuration default is `true`."*)

Two `MiscOptions` worth naming, verbatim: `compileNonExportedClasses` — *"Whether the compiler
should avoid generating code for classes that haven't been exported. Defaults to `true`."* — and
`forbidOrphanComponents` — *"Enables the runtime check to guard against rendering a component
without first loading its NgModule. This check is only applied to the current compilation unit,
i.e., a component imported from another library without option set will not issue error if rendered
in orphan way."*

### Gotcha seeds for 13

- Bumping TypeScript ahead of Angular breaks the build with a message that names neither your code
  nor your dependencies. Fix: pin TypeScript to the range in `@angular/compiler-cli`'s
  `peerDependencies`; do not reach for `disableTypeScriptVersionCheck`.
- A `TS-99xxxx` code leaking into a log or a CI parser is an Angular error whose `NG` replacement
  did not run — the replacement is a *formatting* step, so anything reading raw
  `ts.Diagnostic.code` sees the negative number.
- `.ngtypecheck.ts` files showing up in an editor's "go to file", a coverage report or a glob are
  expected, not corruption.

### Interview-question seeds for 13

- Angular's compiler produces TypeScript diagnostics with negative codes beginning `-99`. Why?
- Why can Angular 22 not run on TypeScript 5.9 when your own code compiles fine on both?
- What is `.ngtypecheck.ts` and why must it exist in the *main* program, not only the type-checking
  one?
- `ngc` accepts `tsc`'s command-line flags. What does that tell you about the architecture?
- Some `ErrorCode` members are negative and some positive. What does the sign mean?

---

## §14 — Template type checking

### 🔴 Lead with the v22 change: `strictTemplates` is ON by default

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts` at `v22.1.5`, verbatim:

```ts
/**
 * strictTemplate is `true` by default.
 * Explicit opt-out is required to disable strictness
 */
private get strictTemplates(): boolean {
  return this.options.strictTemplates !== false;
}
```

The same getter at `v21.2.22`, for the diff:

```ts
const strictTemplates = !!this.options.strictTemplates;
return strictTemplates || !!this.options.fullTemplateTypeCheck;
```

**So the default flipped in v22.0.0.** Corroboration in the repo:

- `adev/src/content/reference/configs/angular-compiler-options.md`, verbatim: > *"`strictTemplates`
  — When `true`, enables strict template type checking. … Default is `true`."*
- CHANGELOG 22.0.0, migrations: *"add strictTemplates to tsconfig during ng update"* (commit
  `682aaf943f`) and *"Fix typo for strict-template migration"* (`1415d86980`)
- CHANGELOG 22.0.0, migrations: *"Disabling nullishCoalescingNotNullable & optionalChainNotNullable
  on ng update"* (commit `6a435658e2`) — the team expected the flip to light up two diagnostics
  across existing code and pre-emptively suppressed them
- CHANGELOG 22.0.0, breaking changes / compiler, verbatim: > *"This change will trigger the
  `nullishCoalescingNotNullable` and `optionalChainNotNullable` diagnostics on exisiting projects.
  You might want to disable those 2 diagnotiscs in your `tsconfig` temporarily."* (typos are in the
  original — quote it as-is or paraphrase, but do not silently correct a verbatim quote)
- CHANGELOG 22.1.4, language-service: *"account for strictTemplates being enabled by default"*
  (commit `a99fb915c0`)

⚠️ **`angular.dev/tools/cli/template-typecheck` has not been updated for this** and still frames
`strictTemplates` as something you turn on, alongside a `fullTemplateTypeCheck` that no longer
exists in the public option surface. C1, C2, C3. This is the single most important thing chunk 14
must get right; a page repeating the doc's three-mode story is a wrong page in v22.

### `typeCheckHostBindings` — also on by default, also newer than the guide

`compiler.ts`:

```ts
const typeCheckHostBindings = this.options.typeCheckHostBindings ?? true;
```

angular.dev, `angular-compiler-options.md`, verbatim: > *"`typeCheckHostBindings` — When `true`,
enables type checking of expressions in the `host` object literal and `@HostBinding`/`@HostListener`
decorators of components and directives. Default is `true`."*

It is not mentioned at all on the template-typecheck page. Related error, from `error_code.ts`:
`HOST_BINDING_PARSE_ERROR = 5001` — *"Raised when a host expression has a parse error, such as a
host listener or host binding expression containing a pipe."*

### The flags — public names, internal names, and what each one actually does

`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts` supplies the **public** option and
its doc; `compiler.ts` `getTypeCheckingConfig()` maps it to the **internal**
`TypeCheckingConfig` field. Both matter: the internal name is what appears in Angular's own tests
and issues.

| public option | internal field(s) | `public_options.ts` doc, verbatim |
|---|---|---|
| `strictInputTypes` | `checkTypeOfInputBindings` **and** `applyTemplateContextGuards` | *"Whether to check the type of a binding to a directive/component input against the type of the field on the directive/component. For example, if this is `false` then the expression `[input]="expr"` will have `expr` type-checked, but not the assignment of the resulting type to the `input` property of whichever directive or component is receiving the binding. If set to `true`, both sides of the assignment are checked. Defaults to `false`."* |
| `strictInputAccessModifiers` | `honorAccessModifiersForInputBindings` | *"Whether to check if the input binding attempts to assign to a restricted field (readonly, private, or protected) on the directive/component. Defaults to `false`, even if "strictTemplates" and/or "strictInputTypes" is set. Note that if `strictInputTypes` is not set, or set to `false`, this flag has no effect. Tracking issue for enabling this by default: https://github.com/angular/angular/issues/38400"* |
| `strictNullInputTypes` | `strictNullInputBindings` | *"Whether to use strict null types for input bindings for directives. If this is `true`, applications that are compiled with TypeScript's `strictNullChecks` enabled will produce type errors for bindings which can evaluate to `undefined` or `null` where the inputs's type does not include `undefined` or `null` in its type. If set to `false`, all binding expressions are wrapped in a non-null assertion operator to effectively disable strict null checks. Defaults to `false`."* |
| `strictAttributeTypes` | `checkTypeOfAttributes` | *"Whether to check text attributes that happen to be consumed by a directive or component. For example, in a template containing `<input matInput disabled>` the `disabled` attribute ends up being consumed as an input with type `boolean` by the `matInput` directive. At runtime, the input will be set to the attribute's string value, which is an empty string for attributes without a value, so with this flag set to `true`, an error would be reported."* |
| `strictSafeNavigationTypes` | `strictSafeNavigationTypes` | *"Whether to use a strict type for null-safe navigation operations. If this is `false`, then the return type of `a?.b` or `a?()` will be `any`. If set to `true`, then the return type of `a?.b` for example will be the same as the type of the ternary expression `a != null ? a.b : a`."* |
| `strictDomLocalRefTypes` | `checkTypeOfDomReferences` | *"Whether to infer the type of local references. If this is `true`, the type of a `#ref` variable on a DOM node in the template will be determined by the type of `document.createElement` for the given DOM node. If set to `false`, the type of `ref` for DOM nodes will be `any`."* |
| `strictOutputEventTypes` | `checkTypeOfOutputEvents` **and** `checkTypeOfAnimationEvents` | *"Whether to infer the type of the `$event` variable in event bindings for directive outputs or animation events. If this is `true`, the type of `$event` will be inferred based on the generic type of `EventEmitter`/`Subject` of the output. If set to `false`, the `$event` variable will be of type `any`."* |
| `strictDomEventTypes` | `checkTypeOfDomEvents` | *"Whether to infer the type of the `$event` variable in event bindings to DOM events. If this is `true`, the type of `$event` will be inferred based on TypeScript's `HTMLElementEventMap`, with a fallback to the native `Event` type. If set to `false`, the `$event` variable will be of type `any`."* |
| `strictContextGenerics` | `useContextGenericType` | *"Whether to include the generic type of components when type-checking the template. If no component has generic type parameters, this setting has no effect. If a component has generic type parameters and this setting is `true`, those generic parameters will be included in the context type for the template. If `false`, any generic parameters will be set to `any` in the template context type."* |
| `strictLiteralTypes` | `strictLiteralTypes` | *"Whether object or array literals defined in templates use their inferred type, or are interpreted as `any`. Defaults to `false` unless `strictTemplates` is set."* |
| `typeCheckHostBindings` | (separate path) | *"Whether type checking of host bindings is enabled."* |
| `strictTemplates` | all of the above | *"If `true`, implies all template strictness flags below (unless individually disabled). Defaults to `true`"* |

🔴 **Two flags each drive two internal fields.** `strictInputTypes` also turns on template context
guards (that is how `*ngIf` / `@if` narrows a type in a template — see the doc's `*ngFor` example),
and `strictOutputEventTypes` also covers animation events. Neither fact is on the template-typecheck
page; both are read straight from `getTypeCheckingConfig`.

Note the doc's own summary line, verbatim: > *"Unless otherwise commented, each following option is
set to the value for `strictTemplates` (`true` when `strictTemplates` is `true` and conversely, the
other way around)."*

### The checks you cannot turn off, and the ones you cannot turn on

Read straight off `getTypeCheckingConfig`'s `strictTemplates` branch, verbatim:

```ts
typeCheckingConfig = {
  applyTemplateContextGuards: strictTemplates,
  checkQueries: false,
  checkTemplateBodies: true,
  alwaysCheckSchemaInTemplateBodies: true,
  checkTypeOfInputBindings: strictTemplates,
  honorAccessModifiersForInputBindings: false,
  checkControlFlowBodies: true,
  strictNullInputBindings: strictTemplates,
  checkTypeOfAttributes: strictTemplates,
  // Even in full template type-checking mode, DOM binding checks are not quite ready yet.
  checkTypeOfDomBindings: false,
  checkTypeOfOutputEvents: strictTemplates,
  checkTypeOfAnimationEvents: strictTemplates,
  // Checking of DOM events currently has an adverse effect on developer experience,
  // e.g. for `<input (blur)="update($event.target.value)">` enabling this check results in:
  // - error TS2531: Object is possibly 'null'.
  // - error TS2339: Property 'value' does not exist on type 'EventTarget'.
  checkTypeOfDomEvents: strictTemplates,
  checkTypeOfDomReferences: strictTemplates,
  // Non-DOM references have the correct type in View Engine so there is no strictness flag.
  checkTypeOfNonDomReferences: true,
  // Pipes are checked in View Engine so there is no strictness flag.
  checkTypeOfPipes: true,
  strictSafeNavigationTypes: strictTemplates,
  useContextGenericType: strictTemplates,
  strictLiteralTypes: true,
  enableTemplateTypeChecker: this.enableTemplateTypeChecker,
  useInlineTypeConstructors,
  controlFlowPreventingContentProjection:
    this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
  unusedStandaloneImports:
    this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
  allowSignalsInTwoWayBindings,
  allowDomEventAssertion,
};
```

Three groups worth a table on the page:

- **Always on, no flag:** `checkTemplateBodies`, `checkControlFlowBodies`,
  `alwaysCheckSchemaInTemplateBodies`, `checkTypeOfNonDomReferences`, `checkTypeOfPipes`,
  `strictLiteralTypes`.
- **Always off, no public flag:** `checkQueries`, `checkTypeOfDomBindings` (> *"Even in full
  template type-checking mode, DOM binding checks are not quite ready yet."*),
  `honorAccessModifiersForInputBindings` (unless `strictInputAccessModifiers` is set).
- **The one with a written-down UX rationale:** `checkTypeOfDomEvents`, whose comment names the two
  exact TypeScript errors it produces — a gift for a gotcha, because
  `(blur)="update($event.target.value)"` is precisely what people write.

The `else` branch (`strictTemplates: false`) turns *everything* off, including
`checkTemplateBodies` — that is the old "basic mode", still reachable, now by explicit opt-out.

### The Type Check Block

`packages/compiler/src/typecheck/type_check_block.ts` at `v22.1.5` — **the TCB is generated as a
string of TypeScript source**, verbatim:

```ts
/**
 * Given a component and metadata, compose a "type check block" function.
 *
 * @param env an `TcbEnvironment` into which type-checking code will be generated.
 * @param component metadata about the component class.
 * @param name Name of the generated function.
 * @param meta metadata about the component's template and the function being generated.
 * @param domSchemaChecker used to check and record errors regarding improper usage of DOM elements
 * and bindings.
 * @param oobRecorder used to record errors regarding template elements which could not be correctly
 * translated into types during TCB generation.
 */
export function generateTypeCheckBlock(
  env: TcbEnvironment,
  component: TcbComponentMetadata,
  name: string,
  meta: TcbTypeCheckBlockMetadata,
  domSchemaChecker: DomSchemaChecker<unknown>,
  oobRecorder: OutOfBandDiagnosticRecorder<unknown>,
): string {
```

and the assembly at the end of the same function, verbatim:

```ts
const thisParamStr = `this: ${ctxRawType.print()}${typeArgsStr}`;
// …
const bodyStr = `{\n${statements.join('\n')}\n}`;
const funcDeclStr = `function ${name}${typeParamsStr}(${thisParamStr}) ${bodyStr}`;

return `/*${meta.id}*/\n${funcDeclStr}`;
```

with the wrapper and its two documented purposes:

```ts
// Wrap the body in an if statement. This serves two purposes:
// 1. It allows us to distinguish between the sections of the block (e.g. host or template).
// 2. It allows the `ts.Printer` to produce better-looking output.
return `if (${wrapperExpression}) {\n${statements}\n}`;
```

— the template scope is wrapped in `if (true) { … }` and the host-bindings scope in a separate
guard from `createHostBindingsBlockGuard()`.

So the shape is:

```ts
// ILLUSTRATIVE — the SHAPE of a TCB, assembled from generateTypeCheckBlock's own string
// concatenation above. Not a dump of real generated output.
/*tcb-id*/
function _tcb1(this: UserCard) {
  if (true) {
    // one statement per binding, reference, variable and directive in the template
  }
  if (/* host bindings guard */) {
    // one statement per host binding
  }
}
```

The function-name prefix, from `typecheck/src/type_check_file.ts`:

```ts
export const TCB_FUNCTION_PREFIX = '_tcb';
```

and the file that holds them, verbatim:

```ts
/**
 * An `Environment` representing the single type-checking file into which most (if not all) Type
 * Check Blocks (TCBs) will be generated.
 *
 * The `TypeCheckFile` hosts multiple TCBs and allows the sharing of declarations (e.g. type
 * constructors) between them. Rather than return such declarations via `getPreludeStatements()`, it
 * hoists them to the top of the generated `ts.SourceFile`.
 */
export class TypeCheckFile extends Environment {
```

🔴 **The whole of template type-checking is: turn the template into TypeScript, hand it to
TypeScript, and map the errors back.** Angular implements no type system of its own. That single
sentence is chunk 14's thesis, and everything above is evidence for it.

### Errors TypeScript raises that Angular must swallow

`typecheck/src/diagnostics.ts`, verbatim — because TCB code is machine-written, four TypeScript
diagnostics are artefacts rather than user errors:

```ts
/**
 * Determines if the diagnostic should be reported. Some diagnostics are produced because of the
 * way TCBs are generated; those diagnostics should not be reported as type check errors of the
 * template.
 */
export function shouldReportDiagnostic(diagnostic: ts.Diagnostic): boolean {
  const {code} = diagnostic;
  if (code === 6133 /* $var is declared but its value is never read. */) {
    return false;
  } else if (code === 6199 /* All variables are unused. */) {
    return false;
  } else if (code === 2695 /* Left side of comma operator is unused and has no side effects. */) {
    return false;
  } else if (code === 7006 /* Parameter '$event' implicitly has an 'any' type. */) {
    return false;
  }
  return true;
}
```

and the translation step, verbatim:

```ts
/**
 * Attempts to translate a TypeScript diagnostic produced during template type-checking to their
 * location of origin, based on the comments that are emitted in the TCB code.
 *
 * If the diagnostic could not be translated, `null` is returned to indicate that the diagnostic
 * should not be reported at all. This prevents diagnostics from non-TCB code in a user's source
 * file from being reported as type-check errors.
 */
export function translateDiagnostic(
```

🔴 **`/*id*/` comments in the generated string are the source map.** That is why the TCB carries
`` `/*${meta.id}*/` `` at the top and why an untranslatable diagnostic is dropped entirely rather
than shown at a nonsense location. Chunk 17 picks up what the translated diagnostic looks like.

### When a TCB cannot be put in the shared file

`error_code.ts`, verbatim doc comments:

- NG8900 `INLINE_TCB_REQUIRED` — *"The template type-checking engine would need to generate an
  inline type check block for a component, but the current type-checking environment doesn't support
  it."*
- NG8901 `INLINE_TYPE_CTOR_REQUIRED` — *"The template type-checking engine would need to generate an
  inline type constructor for a directive or component, but the current type-checking environment
  doesn't support it."*

The switch is `useInlineTypeConstructors = this.programDriver.supportsInlineOperations`. A
non-exported or non-referenceable component type forces the TCB **into your own file**, which some
environments (notably the language service, historically) cannot do. v22.0.0 changed this — the
CHANGELOG language-service line, verbatim: *"Typecheck templates which would require inline
typecheck blocks"* (commit `4f9c824dd9`).

### The escape hatches, from the guide

`adev/src/content/tools/cli/template-typecheck.md`, verbatim:

> *"Disable checking of a binding expression by surrounding the expression in a call to the `$any()`
> cast pseudo-function. The compiler treats it as a cast to the `any` type just like in TypeScript
> when a `<any>` or `as any` cast is used."*

> *"In the template, include the non-null assertion operator `!` at the end of a nullable
> expression"* — with the `async` caveat: *"In the case of the `async` pipe, notice that the
> expression needs to be wrapped in parentheses, as in `<user-detail [user]="(user$ | async)!">`"*

> *"Setting the option `strictNullInputTypes` to `false` disables strict null checks within Angular
> templates. This flag applies for all components that are part of the application."*

and the three named false-positive classes, verbatim:

> *"When a library's typings are wrong or incomplete (for example, missing `null | undefined` if the
> library was not written with `strictNullChecks` in mind)"*
> *"When a library's input types are too narrow and the library hasn't added appropriate metadata
> for Angular to figure this out. This usually occurs with disabled or other common Boolean inputs
> used as attributes, for example, `<input disabled>`."*
> *"When using `$event.target` for DOM events (because of the possibility of event bubbling,
> `$event.target` in the DOM typings doesn't have the type you might expect)"*

⚠️ **`ngAcceptInputType_` is deprecated.** Same guide, verbatim: > *"Since TypeScript 4.3, the
setter could have been declared to accept `boolean|''` as type, making the input setter coercion
field obsolete. As such, input setters coercion fields have been deprecated."* Its companion error
is NG2020 `CONFLICTING_INPUT_TRANSFORM`. Teach `transform:` on `input()`, mention
`ngAcceptInputType_` only as the thing you will meet in old libraries.

### v22 type-checking changes worth naming

From CHANGELOG 22.0.0, verbatim:

- compiler, breaking: > *"data prefixed attribute no-longer bind inputs nor outputs."*
- compiler, breaking: > *"The compiler will throw when there a when inputs, outputs or model are
  binding to the same input/outputs."* (NG1054 `DUPLICATE_BINDING_NAME`)
- compiler, breaking: > *"`in` variables will throw in template expressions."*
- compiler-cli, breaking: > *"Elements with multiple matching selectors will now throw at compile
  time."* (NG8023, see §17)
- compiler feat: *"allow safe navigation to correctly narrow down nullables"* (`47fcbc4704`) and
  *"Angular expressions with optional chaining returns `undefined`"* (`2896c93cc1`) — chunk 05
  already owns this; cross-reference rather than repeat
- compiler-cli fix: *"animation events not type checked properly when bound through HostListener
  decorator"* and *"resolve TCB mapping failure for safe property reads with as any"*
- compiler-cli feat: *"support external TCBs with copied content in specific mode"* — matching the
  `hasCopiedSource` / `setSourceContent` members on `TypeCheckFile`

### Gotcha seeds for 14

- Upgrading to v22 lights up template errors in a project that never set `strictTemplates`. Cause:
  the default flipped. Fix: either fix the templates, or add `"strictTemplates": false` explicitly
  — and know that this also disables extended diagnostics (NG4003) and drops you all the way to
  basic mode, not to "full mode", because `fullTemplateTypeCheck` is gone.
- `strictInputAccessModifiers` is `false` even under `strictTemplates` — binding to a `private`
  input is not caught by default.
- `(blur)="update($event.target.value)"` fails under `strictTemplates` with `TS2531` / `TS2339`;
  the compiler's own source comment predicts exactly this.
- `#ref` on a DOM element is typed from `document.createElement`; on a directive it is typed
  regardless of any flag (`checkTypeOfNonDomReferences: true`).
- A `@let` or a template variable that TypeScript thinks is unused produces `TS6133` — and Angular
  deliberately suppresses it. If you see `6133` from a template, something else is wrong.

### Interview-question seeds for 14

- Angular type-checks templates without implementing a type system. How?
- What is a Type Check Block, what file does it live in, and does it ever reach disk?
- `strictTemplates` implies nine other flags. Name the two that each drive more than one internal
  behaviour, and say what the second behaviour is.
- Why does Angular suppress TypeScript error 6133 during template checking?
- You set `strictTemplates: false` on Angular 22 to unblock a release. What else did you just turn
  off?

---

## §15 — Extended diagnostics

### What they are, in the docs' own words

`adev/src/content/reference/extended-diagnostics/overview.md`, verbatim, the whole framing:

> *"There are many coding patterns that are technically valid to the compiler or runtime, but which
> may have complex nuances or caveats. These patterns may not have the intended effect expected by a
> developer, which often leads to bugs. The Angular compiler includes "extended diagnostics" which
> identify many of these patterns, in order to warn developers about the potential issues and
> enforce common best practices within a codebase."*

> *"Extended diagnostics are warnings by default and do not block compilation."*

The category table, verbatim:

| Error category | Effect |
|---|---|
| `warning` | *"Default - The compiler emits the diagnostic as a warning but does not block compilation. The compiler will still exist with status code 0, even if warnings are emitted."* |
| `error` | *"The compiler emits the diagnostic as an error and fails the compilation. The compiler will exit with a non-zero status code if one or more errors are emitted."* |
| `suppress` | *"The compiler does not emit the diagnostic at all."* |

(The `warning` row's "will still exist" is a typo for "exit" in the original. Quote as-is or
paraphrase; do not silently fix a verbatim quote.)

Configuration, verbatim:

```json
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "invalidBananaInBox": "suppress"
      },
      "defaultCategory": "error"
    }
  }
}
```

> *"The `checks` field maps the name of individual diagnostics to their associated category."*
> *"The `defaultCategory` field is used for any diagnostics that are not explicitly listed under
> `checks`. If not set, such diagnostics will be treated as `warning`."*
> *"Extended diagnostics will emit when `strictTemplates` is enabled. This is required to allow the
> compiler to better understand Angular template types and provide accurate and meaningful
> diagnostics."*

🔴 That last sentence has a v22 consequence the doc has not caught up with: since `strictTemplates`
now defaults to **true** (§14), **extended diagnostics are on by default too**. Every per-check page
repeats the same line — e.g. NG8109's: > *"`strictTemplates` must be enabled for any extended
diagnostic to emit. `interpolatedSignalNotInvoked` has no additional requirements beyond
`strictTemplates`."*

### 🔴 The semver caveat — quote this in full, it is the reason the chunk exists

Verbatim:

> *"The Angular team intends to add or enable new extended diagnostics in **minor** versions of
> Angular. This means that upgrading Angular may show new warnings in your existing codebase. This
> enables the team to deliver features more quickly and to make extended diagnostics more accessible
> to developers."*

> *"However, setting `"defaultCategory": "error"` will promote such warnings to hard errors. This can
> cause a minor version upgrade to introduce compilation errors, which may be seen as a semver
> non-compliant breaking change. Any new diagnostics can be suppressed or demoted to warnings via the
> above configuration, so the impact of a new diagnostic should be minimal to projects that treat
> extended diagnostics as errors by default. Defaulting to error is a very powerful tool; just be
> aware of this semver caveat when deciding if `error` is the right default for your project."*

The bar for a new check, verbatim — a good "how Angular thinks" sidebar:

> *"Extended diagnostics should generally: Detect a common, non-obvious developer mistake with
> Angular templates · Clearly articulate why this pattern can lead to bugs or unintended behavior ·
> Suggest one or more clear solutions · Have a low, preferably zero, false-positive rate · Apply to
> the vast majority of Angular applications (not specific to an unofficial library) · Improve
> program correctness or performance (not style, that responsibility falls to a linter)"*

### 🔴 The roster: 18 in source, 16 in the docs table

`packages/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.ts` at
`v22.1.5`, verbatim and complete — **this is the authoritative list, and it is the value you write
in `checks`**:

```ts
/**
 * Enum holding the name of each extended template diagnostic. The name is used as a user-meaningful
 * value for configuring the diagnostic in the project's options.
 *
 * See the corresponding `ErrorCode` for documentation about each specific error.
 * packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts
 *
 * @publicApi
 */
export enum ExtendedTemplateDiagnosticName {
  INVALID_BANANA_IN_BOX = 'invalidBananaInBox',
  NULLISH_COALESCING_NOT_NULLABLE = 'nullishCoalescingNotNullable',
  OPTIONAL_CHAIN_NOT_NULLABLE = 'optionalChainNotNullable',
  MISSING_CONTROL_FLOW_DIRECTIVE = 'missingControlFlowDirective',
  MISSING_STRUCTURAL_DIRECTIVE = 'missingStructuralDirective',
  TEXT_ATTRIBUTE_NOT_BINDING = 'textAttributeNotBinding',
  UNINVOKED_FUNCTION_IN_EVENT_BINDING = 'uninvokedFunctionInEventBinding',
  MISSING_NGFOROF_LET = 'missingNgForOfLet',
  SUFFIX_NOT_SUPPORTED = 'suffixNotSupported',
  SKIP_HYDRATION_NOT_STATIC = 'skipHydrationNotStatic',
  INTERPOLATED_SIGNAL_NOT_INVOKED = 'interpolatedSignalNotInvoked',
  CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION = 'controlFlowPreventingContentProjection',
  UNUSED_LET_DECLARATION = 'unusedLetDeclaration',
  UNINVOKED_TRACK_FUNCTION = 'uninvokedTrackFunction',
  UNUSED_STANDALONE_IMPORTS = 'unusedStandaloneImports',
  UNPARENTHESIZED_NULLISH_COALESCING = 'unparenthesizedNullishCoalescing',
  UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION = 'uninvokedFunctionInTextInterpolation',
  DEFER_TRIGGER_MISCONFIGURATION = 'deferTriggerMisconfiguration',
}
```

The docs' overview table lists 16, verbatim (code → name):

`NG8101 invalidBananaInBox` · `NG8102 nullishCoalescingNotNullable` · `NG8103 missingControlFlowDirective` ·
`NG8104 textAttributeNotBinding` · `NG8105 missingNgForOfLet` · `NG8106 suffixNotSupported` ·
`NG8107 optionalChainNotNullable` · `NG8108 skipHydrationNotStatic` · `NG8109 interpolatedSignalNotInvoked` ·
`NG8111 uninvokedFunctionInEventBinding` · `NG8113 unusedStandaloneImports` ·
`NG8114 unparenthesizedNullishCoalescing` · `NG8115 uninvokedTrackFunction` ·
`NG8116 missingStructuralDirective` · `NG8117 uninvokedFunctionInTextInterpolation` ·
`NG8021 deferTriggerMisconfiguration`

🔴 **Missing from the table but present in the enum and configurable:**
`unusedLetDeclaration` (**NG8112**) and `controlFlowPreventingContentProjection` (**NG8011**).
Neither has a doc page. Both are real, both accept `warning` / `error` / `suppress`. C9.

Also worth stating: **the code range is not a reliable guide.** Most are NG81xx, but
`controlFlowPreventingContentProjection` is **NG8011** and `deferTriggerMisconfiguration` is
**NG8021** — both in the NG80xx template-semantics range. The `checks` **name**, not the code, is
what you configure.

Missing codes inside the NG81xx range, from `error_code.ts`, with their real meanings — useful so a
reader is not left wondering:

- **NG8110** `UNSUPPORTED_INITIALIZER_API_USAGE` — a hard error, not an extended diagnostic:
  *"Initializer-based APIs can only be invoked from inside of an initializer."*
- **NG8118** `FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION` — also a hard error: *"A required
  initializer is being invoked in a forbidden context such as a property initializer or a
  constructor."*

### Each check, from `error_code.ts`'s own doc comments (verbatim)

| code | name | doc comment / example |
|---|---|---|
| NG8011 | `controlFlowPreventingContentProjection` | *"A control flow node is projected at the root of a component and is preventing its direct descendants from being projected, because it has more than one root node."* |
| NG8021 | `deferTriggerMisconfiguration` | *"Raised when an `@defer` block defines unreachable or redundant triggers. Examples: multiple main triggers, 'on immediate' together with other mains or any prefetch, prefetch timer delay that is not earlier than the main timer, or an identical prefetch"* |
| NG8101 | `invalidBananaInBox` | *"A two way binding in a template has an incorrect syntax, parentheses outside brackets. For example: `<div ([foo])="bar" />`"* |
| NG8102 | `nullishCoalescingNotNullable` | *"The left side of a nullish coalescing operation is not nullable. `{{ foo ?? bar }}` When the type of foo doesn't include `null` or `undefined`."* |
| NG8103 | `missingControlFlowDirective` | *"A known control flow directive (e.g. `*ngIf`) is used in a template, but the `CommonModule` is not imported."* |
| NG8104 | `textAttributeNotBinding` | *"A text attribute is not interpreted as a binding but likely intended to be. For example: `attr.x="value"`, `class.blue="true"`, `style.margin-right.px="5"` … All of the above attributes will just be static text attributes and will not be interpreted as bindings by the compiler."* |
| NG8105 | `missingNgForOfLet` | *"NgForOf is used in a template, but the user forgot to include let in their statement."* |
| NG8106 | `suffixNotSupported` | *"Style bindings support suffixes like `style.width.px`, `.em`, and `.%`. These suffixes are not supported for attribute bindings. For example `[attr.width.px]="5"` becomes `width.px="5"` when bound. This is almost certainly unintentional…"* |
| NG8107 | `optionalChainNotNullable` | *"The left side of an optional chain operation is not nullable. `{{ foo?.bar }}` `{{ foo?.['bar'] }}` `{{ foo?.() }}` When the type of foo doesn't include `null` or `undefined`."* |
| NG8108 | `skipHydrationNotStatic` | *"`ngSkipHydration` should not be a binding (it should be a static attribute). … cannot be a binding and can not have values other than "true" or an empty value"* |
| NG8109 | `interpolatedSignalNotInvoked` | *"Signal functions should be invoked when interpolated in templates."* |
| NG8111 | `uninvokedFunctionInEventBinding` | *"A function in an event binding is not called. For example: `<button (click)="myFunc"></button>` This will not call `myFunc` when the button is clicked."* |
| NG8112 | `unusedLetDeclaration` | *"A `@let` declaration in a template isn't used."* |
| NG8113 | `unusedStandaloneImports` | *"A symbol referenced in `@Component.imports` isn't being used within the template."* |
| NG8114 | `unparenthesizedNullishCoalescing` | *"An expression mixes nullish coalescing and logical and/or without parentheses."* |
| NG8115 | `uninvokedTrackFunction` | *"The function passed to `@for` track is not invoked. … For the track function to work properly, it must be invoked."* |
| NG8116 | `missingStructuralDirective` | *"A structural directive is used in a template, but the directive is not imported."* |
| NG8117 | `uninvokedFunctionInTextInterpolation` | *"A function in a text interpolation is not invoked."* |

Three of these have full doc pages worth quoting on the page:

**NG8113**, verbatim: > *"This diagnostic detects cases where the `imports` array of a `@Component`
contains symbols that aren't used within the template."* / *"The unused imports add unnecessary
noise to your code and can increase your compilation time."* / *"Delete the unused import."*

**NG8109**, verbatim: > *"Angular Signals are zero-argument functions (`() => T`). When executed,
they return the current value of the signal. This means they are meant to be invoked when used in
template interpolations to render their value."*

**NG8021**, verbatim on its four cases: *"`immediate` with prefetch triggers"*, *"Prefetch timer not
earlier than main timer"*, *"Prefetch without main triggers"*, *"Identical prefetch and main
triggers"* — with this excellent explanatory sentence for the third: > *"This configuration may
suggest that the prefetch will only run when `someFlag` becomes true. However, since the main
trigger still defaults to `on idle`, the deferred content can be fetched earlier during the
browser's idle period, effectively bypassing the intended condition."*

### 🔴 Two checks are not purely extended diagnostics

From `getTypeCheckingConfig` (§14), verbatim:

```ts
controlFlowPreventingContentProjection:
  this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
unusedStandaloneImports:
  this.options.extendedDiagnostics?.defaultCategory || DiagnosticCategoryLabel.Warning,
```

and, later:

```ts
if (
  this.options.extendedDiagnostics?.checks?.controlFlowPreventingContentProjection !== undefined
) {
  typeCheckingConfig.controlFlowPreventingContentProjection =
    this.options.extendedDiagnostics.checks.controlFlowPreventingContentProjection;
}
if (this.options.extendedDiagnostics?.checks?.unusedStandaloneImports !== undefined) {
  typeCheckingConfig.unusedStandaloneImports =
    this.options.extendedDiagnostics.checks.unusedStandaloneImports;
}
```

These two are fields of the **`TypeCheckingConfig`** — they are produced by the type-checker itself
rather than by the extended-diagnostics pass, and their category is plumbed through by hand. They
are configured exactly like the others, so the distinction is invisible to a user and highly
visible to anyone reading source. Say so.

### Getting the configuration wrong

`compiler.ts`, `verifyCompatibleTypeCheckOptions` — all three messages verbatim (also in §13):

- NG4003 — `extendedDiagnostics` configured while `strictTemplates: false`, with two numbered
  actions
- NG4004 — *"Angular compiler option "extendedDiagnostics.defaultCategory" has an unknown diagnostic
  category: "X". Allowed diagnostic categories are: …"* (and the per-check variant, *"Angular
  compiler option "extendedDiagnostics.checks['X']" has an unknown diagnostic category…"*)
- NG4005 — *"Angular compiler option "extendedDiagnostics.checks" has an unknown check: "X". Allowed
  check names are: …"*

Both NG4004 and NG4005 print the full allowed list into the message, which makes them
self-documenting — a nice detail.

The categories themselves, `public_options.ts`, verbatim:

```ts
/**
 * A label referring to a `ts.DiagnosticCategory` or `'suppress'`, meaning the associated diagnostic
 * should not be displayed at all.
 *
 * @publicApi
 */
export enum DiagnosticCategoryLabel {
  /** Treat the diagnostic as a warning, don't fail the compilation. */
  Warning = 'warning',

  /** Treat the diagnostic as a hard error, fail the compilation. */
  Error = 'error',

  /** Ignore the diagnostic altogether. */
  Suppress = 'suppress',
}
```

### v22 movement in this area

- **NG8021 is new in v22** — CHANGELOG 22.0.0 compiler-cli: *"Adds warning for prefetch without main
  defer trigger"* (`7f9450219f`)
- **22.1.5** compiler-cli: *"check uninvoked signal aliases in extended diagnostic"* (`d90698dae7`)
  — NG8109 got smarter one patch before this bank was written
- **22.1.3** compiler-cli: *"restrict possible event handler check to property names longer than 2
  characters"* (`6f1171991a`)
- 22.0.0 migrations: *"Disabling nullishCoalescingNotNullable & optionalChainNotNullable on ng
  update"* (`6a435658e2`) — the upgrade path writes `suppress` for two checks into your tsconfig

### Gotcha seeds for 15

- Setting `"defaultCategory": "error"` makes every future Angular minor a potential build break —
  and the docs say so in as many words.
- `"strictTemplates": false` silently disables every extended diagnostic, and if you also configured
  `extendedDiagnostics`, it is not silent: you get NG4003 and the build fails.
- The name you put in `checks` is the enum's string value, not the NG code, and two configurable
  checks (`unusedLetDeclaration`, `controlFlowPreventingContentProjection`) are not in the docs
  table at all.
- After `ng update` to v22, your tsconfig may contain `nullishCoalescingNotNullable: "suppress"` and
  `optionalChainNotNullable: "suppress"` that the migration wrote for you. Those are real diagnostics
  you have turned off — revisit them.

### Interview-question seeds for 15

- What is the difference between an extended diagnostic and a compiler error, and why is that line
  drawn where it is?
- Why would promoting extended diagnostics to errors be a semver hazard, and whose semver is at
  stake?
- Why do extended diagnostics require `strictTemplates`, and what changed about that requirement in
  v22?
- Where does the string you write in `extendedDiagnostics.checks` come from?

---

## §16 — Arriving from React, Vue or Svelte

🔴 **The dispatch line "Svelte also compiles, React does not" is wrong and must not be written.**
All four frameworks compile something. What differs is **what** is compiled, **what the output
is**, and **whether the compile step is required**. Build the chunk around those three axes, not
around a compiles/doesn't-compile binary.

### Vue — templates are compiled, and the output is still a virtual DOM

`https://vuejs.org/guide/extras/rendering-mechanism.html`, verbatim:

> *"**Compile**: Vue templates are compiled into **render functions**: functions that return virtual
> DOM trees."* (section: Render Pipeline)

> *"We call this hybrid approach **Compiler-Informed Virtual DOM**."*

> *"The virtual DOM implementation in React and most other virtual-DOM implementations are purely
> runtime: the reconciliation algorithm cannot make any assumptions about the incoming virtual DOM
> tree, so it has to fully traverse the tree and diff the props of every vnode in order to ensure
> correctness."*

> *"In Vue, the framework controls both the compiler and the runtime. This allows us to implement
> many compile-time optimizations that only a tightly-coupled renderer can take advantage of. The
> compiler can statically analyze the template and leave hints in the generated code so that the
> runtime can take shortcuts whenever possible."*

> *"Vue also provides APIs that allow us to skip the template compilation step and directly author
> render functions."* (section: Templates vs. Render Functions)

The three named optimisations, verbatim:

> *"The `foo` and `bar` divs are static - re-creating vnodes and diffing them on each re-render is
> unnecessary. The renderer creates these vnodes during the initial render, caches them, and reuses
> the same vnodes for every subsequent re-render."* (Cache Static)

> *"Bitwise checks are extremely fast. With the patch flags, Vue is able to do the least amount of
> work necessary when updating elements with dynamic bindings."* (Patch Flags)

> *"This is called **Tree Flattening**, and it greatly reduces the number of nodes that need to be
> traversed during virtual DOM reconciliation. Any static parts of the template are effectively
> skipped."* (Tree Flattening)

🔴 **Vue is the closest comparison to Angular, not the furthest.** Both have a template language,
both compile it ahead of time, both use the compiler's static knowledge to avoid runtime work.
The difference is the *artefact*: Vue emits a render function returning a vnode tree with patch
flags; Angular emits a function that mutates the DOM directly through slot-indexed instructions.
Vue keeps the tree and annotates it; Angular deletes the tree and keeps only the annotations.
Vue's own "purely runtime" / "compiler-informed" spectrum is the right frame — Angular is the far
end of it.

### React — the compiler is real, and it is optional

`https://react.dev/learn/react-compiler/introduction`, verbatim:

> *"React Compiler is a new build-time tool that automatically optimizes your React app."*

> *"React Compiler is now stable and has been tested extensively in production. While it is still an
> optional addition to React today, in the future some features may require the compiler in order to
> fully work."*

> *"React Compiler automatically optimizes your React application at build time."*

> *"React Compiler automatically applies the optimal memoization, ensuring your app only re-renders
> when necessary."*

> *"It works with plain JavaScript, and understands the Rules of React, so you don't need to rewrite
> any code to use it."*

and from `https://react.dev/learn/react-compiler`, verbatim:

> *"Learn what React Compiler does and how it automatically optimizes your React application by
> handling memoization for you, eliminating the need for manual `useMemo`, `useCallback`, and
> `React.memo`."*

🔴 **The accurate statement is: React has a compiler, it is optional, and it does a completely
different job.** React Compiler inserts memoization into ordinary JavaScript; it does not turn
markup into a different artefact. JSX itself is *also* compiled — by Babel or `tsc`, into
`createElement`/`jsx()` calls — but that is a mechanical syntax transform, not an analysis. So React
has **two** compile steps, neither of which is Angular's kind:

| | JSX transform | React Compiler | Angular `ngtsc` |
|---|---|---|---|
| required? | yes (JSX is not JS) | no — *"still an optional addition"* | yes |
| what it reads | syntax only | your component functions, plus the Rules of React | your decorator metadata **and** your template |
| what it produces | function calls returning elements | the same code with memoization inserted | `ɵcmp` + a DOM-mutating template function + `.d.ts` type metadata |
| can it fail your build on your *markup*? | no | no | yes — NG8001, NG8002, NG5002, every `strictTemplates` error |

That last row is the honest one-line answer to "what is different about Angular".

### Svelte — a compiler, and the docs are sparse on the rest

`https://svelte.dev/docs/svelte/overview`, verbatim:

> *"Svelte is a framework for building user interfaces on the web. It uses a compiler to turn
> declarative components written in HTML, CSS and JavaScript … into lean, tightly optimized
> JavaScript."*

⚠️ **UNSETTLED.** The current Svelte docs pages read for this bank (`/docs/svelte/overview` and
`/docs/svelte/faq`) do **not** contain a sentence stating that Svelte has no virtual DOM or
quantifying its runtime. The only adjacent line found, on the FAQ, is contextual — *"Components can
be compiled (since Svelte is a compiler and not a normal library)"* — in a section about testing.
The "Svelte has no virtual DOM" claim is widely repeated and comes from Svelte's own blog, which is
out of scope for this corpus. **Write it as: the documentation describes Svelte as a compiler
producing "lean, tightly optimized JavaScript"; it does not, on the pages checked, make a
virtual-DOM claim.** Do not assert the absence of a virtual DOM as a documented fact.

### Angular's side of the comparison — quotes already in this bank

- *"The mental model of Ivy is that the decorator is the compiler."* (§12)
- *"The compiler is roughly half of Angular itself, so omitting it dramatically reduces the
  application payload."* (§08)
- *"Detect template errors earlier — The AOT compiler detects and reports template binding errors
  during the build step before users can see them."* (aot-compiler.md, verbatim)
- *"Better security — AOT compiles HTML templates and components into JavaScript files long before
  they are served to the client. With no templates to read and no risky client-side HTML or
  JavaScript evaluation, there are fewer opportunities for injection attacks."* (aot-compiler.md)
- And the shape of the constraint, from chunk 01 onward: the template is a **separate language**
  with its own grammar, its own error codes and its own operator set (chunks 02–05).

### The comparison table to build the chunk around

Four axes, every cell traceable to a quote above or elsewhere in this bank:

| | React | Vue | Svelte | Angular |
|---|---|---|---|---|
| Is there a compile step for markup? | yes (JSX → function calls) | yes (template → render function) | yes (component → JavaScript) | yes (template → instruction stream) |
| Is markup a separate language? | no — JSX is an expression syntax over JS | yes — a template language | yes — a template language | **yes**, with its own grammar and error codes |
| What is emitted? | `createElement`/`jsx()` calls returning elements | a render function returning vnodes, plus patch flags | *"lean, tightly optimized JavaScript"* | `ɵcmp` with a slot-indexed template function |
| Is there a runtime vnode diff? | yes, *"purely runtime"* | yes, but compiler-informed | not stated in the docs checked | no — `bindingUpdated` per slot (§07) |
| Optional optimising compiler? | yes — React Compiler, *"still an optional addition"* | n/a (built in) | n/a (it *is* the compiler) | n/a (built in) |
| Can the build fail on your markup? | no | type errors only with `vue-tsc`; not the default | limited | **yes, extensively** — §14, §15, §17 |

### The one thing to say to each audience

- **From React:** your build step is a syntax transform plus (optionally) a memoiser. Angular's is
  an *analysis*. That is why Angular can refuse to compile your markup and React cannot, and why
  Angular needs the metadata restrictions in §09.
- **From Vue:** you already have everything except the last step. Angular takes the same
  compiler-informed idea and removes the vnode tree, paying for it with a template shape that is
  fixed at build time (§08).
- **From Svelte:** you already believe "the framework is a compiler". Angular agrees — *"the
  decorator is the compiler"* — but keeps a substantial runtime, because locality (§12) means much
  of what could be pre-computed deliberately is not.

### Gotcha seeds for 16

- "Angular compiles, React doesn't" is a claim you will be corrected on. React ships an optional
  compiler and JSX has always been compiled.
- "Vue is virtual DOM, Angular is not" is true but hides that Vue's compiler does the *same kind* of
  static template analysis Angular's does.
- Reaching for a `render()` function because you came from React is a dead end: chunk 01's
  separate-language rule is why.

### Interview-question seeds for 16

- All four of React, Vue, Svelte and Angular have a compile step. What does Angular's do that the
  others' do not?
- Vue calls its approach a "Compiler-Informed Virtual DOM". Where does Angular sit on that spectrum
  and what does it give up?
- React Compiler is optional. Why can Angular's compiler never be?
- What can Angular's compiler tell you at build time that a JSX transform structurally cannot?

---

## §17 — Consequences you actually hit

This chunk is the topic's landing page for the error surface. Everything below is a real string
read from `v22.1.5`, so a reader searching their terminal will match it.

### 🔴 The error in a file TypeScript never compiled

`packages/compiler-cli/src/ngtsc/typecheck/diagnostics/src/diagnostic.ts` — `makeTemplateDiagnostic`
has **three** source-mapping cases, and which one you land in decides what filename you see.

**`'direct'`** — the template is a plain string literal in the decorator. Verbatim comment:

```ts
// For direct mappings, the error is shown inline as ngtsc was able to pinpoint a string
// constant within the `@Component` decorator for the template. This allows us to map the error
// directly into the bytes of the source file.
```

and the diagnostic points at `mapping.node.getSourceFile()` with the span's own byte offsets —
i.e. **your `.ts` file, at the right character**.

**`'indirect'`** and **`'external'`** — verbatim:

```ts
} else if (mapping.type === 'indirect' || mapping.type === 'external') {
  // For indirect mappings (template was declared inline, but ngtsc couldn't map it directly
  // to a string constant in the decorator), the component's file name is given with a suffix
  // indicating it's not the TS file being displayed, but a template.
  // For external temoplates, the HTML filename is used.
  const componentSf = mapping.componentClass.getSourceFile();
  const componentName = mapping.componentClass.name.text;
  const fileName =
    mapping.type === 'indirect'
      ? `${componentSf.fileName} (${componentName} template)`
      : mapping.templateUrl;
```

🔴 **So the three filenames a reader can see are:**

1. `src/app/user-card.ts` — inline string-literal template (`direct`)
2. `src/app/user-card.html` — `templateUrl` (`external`), a file `tsc` has never parsed
3. `src/app/user-card.ts (UserCard template)` — an inline template that was **computed**, e.g.
   `template: TEMPLATE_CONST` (`indirect`) — a filename that does not exist on disk at all

⚠️ **angular.dev's aot-compiler page is wrong about case 3.** It says the synthetic name is
`my.component.ts.MyComponent.html`. At `v22.1.5` it is `<path> (<ComponentName> template)`. C8. The
doc's *explanation* is still exactly right and worth quoting: > *"is a synthetic file generated by
the template compiler that holds contents of the `MyComponent` class template. The compiler never
writes this file to disk."*

The synthetic file is manufactured by parsing the template text **as if it were a TypeScript source
file**, from the same file:

```ts
const TemplateSourceFile = Symbol('TemplateSourceFile');
// …
function getParsedTemplateSourceFile(
  fileName: string,
  mapping: TemplateSourceMappingWithSourceFile,
): ts.SourceFile {
  if (mapping[TemplateSourceFile] === undefined) {
    mapping[TemplateSourceFile] = parseTemplateAsSourceFile(fileName, mapping.template);
  }
```

And every non-direct diagnostic gains a second breadcrumb, verbatim:

```ts
relatedInformation.push({
  category: ts.DiagnosticCategory.Message,
  code: 0,
  file: componentSf,
  // mapping.node represents either the 'template' or 'templateUrl' expression. getStart()
  // and getEnd() are used because they don't include surrounding whitespace.
  start: mapping.node.getStart(),
  length: mapping.node.getEnd() - mapping.node.getStart(),
  messageText: `${typeForMessage} occurs in the template of component ${componentName}.`,
});
```

where `typeForMessage` is `Error` / `Warning` / `Suggestion` / `Message`. So the full experience is:
**an error located in an `.html` file, plus a note pointing back at the `templateUrl:` string in the
`.ts`.** That pairing is the single most disorienting thing about Angular for a newcomer, and it has
a precise, quotable mechanism.

There is even a fallback for when the synthetic file cannot be built, verbatim:

```ts
const failureChain = makeDiagnosticChain(
  `Failed to report an error in '${fileName}' at ${span.start.line + 1}:${
    span.start.col + 1
  }`,
  [makeDiagnosticChain((e as Error)?.stack ?? `${e}`)],
);
```

— if you ever see `Failed to report an error in '…' at 12:4` followed by a stack trace, that is
this branch, and it means the diagnostic machinery itself failed, not your template.

The diagnostics also carry `source: 'ngtsc'` and a `typeCheckId`, which is how tooling tells an
Angular template diagnostic from an ordinary TypeScript one.

### NG8001 — `'x' is not a known element`

`packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts`, verbatim — the **compile-time** message,
assembled piece by piece:

```ts
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
```

🔴 **The message adapts three ways** — standalone vs NgModule wording, and hyphen vs no-hyphen in
the tag name choosing between `CUSTOM_ELEMENTS_SCHEMA` and `NO_ERRORS_SCHEMA`. That is why two
people quoting "the NG8001 message" quote different text.

Preceded by a real subtlety, verbatim:

```ts
// HTML elements inside an SVG `foreignObject` are declared in the `xhtml` namespace.
// We need to strip it before handing it over to the registry because all HTML tag names
// in the registry are without a namespace.
const name = tagName.replace(REMOVE_XHTML_REGEX, '');
```

The doc, `errors/NG8001.md`, verbatim: > *"One or more elements cannot be resolved during
compilation because the element is not defined by the HTML spec, or there is no component or
directive with such element selector."* and > *"This is the compiler equivalent of a common runtime
error `NG0304: '${tagName}' is not a known element: ...`."*

⚠️ C11: `RuntimeErrorCode.UNKNOWN_ELEMENT = 304` exists in `packages/core/src/errors.ts`, but
**NG0304 has no page** in the error encyclopedia. The doc's cross-reference is dangling. Note it;
do not link it.

### NG8002 — `Can't bind to 'x' since it isn't a known property of 'y'`

Same file, verbatim:

```ts
const decorator = hostIsStandalone ? '@Component' : '@NgModule';
const schemas = `'${decorator}.schemas'`;
let errorMsg = `Can't bind to '${name}' since it isn't a known property of '${tagName}'.`;
// …
} else if (tagName.indexOf('-') > -1) {
  errorMsg +=
    `\n1. If '${
      tagName
    }' is an Angular component and it has '${name}' input, then verify that it is ${
      hostIsStandalone
        ? "included in the '@Component.imports' of this component"
        : 'part of this module'
    }.` +
    `\n2. If '${tagName}' is a Web Component then add 'CUSTOM_ELEMENTS_SCHEMA' to the ${schemas} of this component to suppress this message.` +
    `\n3. To allow any property add 'NO_ERRORS_SCHEMA' to the ${schemas} of this component.`;
}
```

Note the earlier branch: `REGISTRY.validateProperty(name)` runs **first** and reports its own
message under the same NG8002 code — so NG8002 covers both "no such property on this element" and
"this property name is itself invalid".

The doc, `errors/NG8002.md`, verbatim: > *"This error arises when attempting to bind to a property
that does not exist. Any property binding must correspond to either: A native property on the HTML
element, or An `input()`/`@Input()` property of a component or directive applied to the element."*

### NG8003 — missing reference target

`errors/NG8003.md`, verbatim: > *"Angular can't find a directive with `{{ PLACEHOLDER }}` export
name. This is common with a missing import or a missing `exportAs` on a directive."* and > *"This is
the compiler equivalent of a common runtime error NG0301: Export Not Found."*

### NG8023 — new in v22, and a genuinely new class of build failure

CHANGELOG 22.0.0 breaking change, compiler-cli, verbatim: > *"Elements with multiple matching
selectors will now throw at compile time."* Introduced by *"introduce NG8023 compile-time diagnostic
for duplicate selectors"* (commit `ca67828ee2`).

`errors/NG8023.md`, verbatim:

> *"Two or more components in the compilation scope match the same element in a template. Because
> Angular can associate only one component with a given element, selectors must be unique enough to
> prevent ambiguity."*

> *"NOTE: This is the build-time equivalent of the runtime error NG0300: Selector Collision.
> Detecting this at compile time means the error surfaces immediately."*

with a complete runnable example (`[stroked-button]` + `[raised-button]` on one `<button>`) and the
debugging hint > *"If you're having trouble finding multiple components with this selector tag name,
check for components from imported component libraries, such as Angular Material."*

🔴 **This is the cleanest possible illustration of the topic's thesis**: something that used to be a
runtime surprise is now a compile error, purely because the compiler already knows the local
dependency list (§12). Pair it with NG8001/NG0304 and NG8003/NG0301 — a table of **compile-time
error ↔ runtime equivalent** is the right artefact for this chunk:

| compile-time | runtime equivalent | what moved |
|---|---|---|
| NG8001 Invalid Element | NG0304 unknown element | element resolution |
| NG8002 Invalid Attribute | NG0304 family | property/input resolution |
| NG8003 Missing Reference Target | NG0301 Export Not Found | `#ref="exportAs"` resolution |
| NG8023 Multiple Components Match | NG0300 Selector Collision | directive matching (**new in v22**) |
| NG8004 `MISSING_PIPE` | NG0302 Pipe Not Found | pipe resolution |

(`MISSING_PIPE = 8004` doc comment in `error_code.ts` is truncated in source — *"No matching pipe
was found for a"* — an amusing detail, and evidence for the pairing.)

### NG3003 — import cycles

Fully covered in §10.7. In chunk 17 it belongs as *the* example of an error whose cause is neither
in the file you edited nor in the file it names, and whose fix is architectural. Reuse the doc's
verbatim cycle rendering:

> *"The component Child is used in the template but importing it would create a cycle:
> /parent.ts -> /child.ts -> /parent.ts"*

### The template-only semantic errors (NG80xx), for completeness

From `error_code.ts` doc comments, verbatim — these are the errors that exist *only* because the
template is a compiled language:

| code | name | doc comment |
|---|---|---|
| NG8005 | `WRITE_TO_READ_ONLY_VARIABLE` | *"The left-hand side of an assignment expression was a template variable. … Template variables are read-only."* |
| NG8006 | `DUPLICATE_VARIABLE_DECLARATION` | *"A template variable was declared twice."* (example: `*ngFor="let i of items; let i = index"`) |
| NG8007 | `SPLIT_TWO_WAY_BINDING` | *"A template has a two way binding (two bindings created by a single syntactical element) in which the input and output are going to different places."* |
| NG8008 | `MISSING_REQUIRED_INPUTS` | *"A directive usage isn't binding to one or more required inputs."* |
| NG8009 | `ILLEGAL_FOR_LOOP_TRACK_ACCESS` | *"The tracking expression of a `for` loop block is accessing a variable that is unavailable"* |
| NG8015 | `ILLEGAL_LET_WRITE` | *"An expression is trying to write to an `@let` declaration."* (chunk 03) |
| NG8016 | `LET_USED_BEFORE_DEFINITION` | *"An expression is trying to read an `@let` before it has been defined."* (chunk 03) |
| NG8017 | `CONFLICTING_LET_DECLARATION` | *"A `@let` declaration conflicts with another symbol in the same scope."* (chunk 03) |
| NG8018 | `UNCLAIMED_DIRECTIVE_BINDING` | *"A binding inside selectorless directive syntax did not match any inputs/outputs of the directive."* |
| NG8022 | `FORM_FIELD_UNSUPPORTED_BINDING` | *"Raised when the user has an unsupported binding on a `FormField` directive."* (v22, signal forms) |
| NG8024 | `CONFLICTING_HOST_DIRECTIVE_BINDING` | *"Raised when a host directive input/output is exposed multiple times under the same name."* |
| NG8025–8029 | foreign-component family | *"Raised when a foreign component node has an unsupported Angular binding"*, *"Raised when a `@content` block is not used as a direct child of a foreign component"*, and three more — all new in v22 |

### The expression that works in the class and fails in the template

Chunk 02 owns the *rule*; chunk 17 owns the *experience*. The one-line framing, which follows
directly from chunk 01: the class body is TypeScript and the template is not, so `Math.max(a, b)`
is fine one line above and a parse failure one line below. The error is NG5002
`TEMPLATE_PARSE_ERROR` — *"Raised when the compiler cannot parse a component's template."* Link to
[02](02-what-a-template-expression-may-contain.md) rather than restating the tables.

Two v22 additions to that list, from CHANGELOG 22.0.0 breaking changes, verbatim:
> *"data prefixed attribute no-longer bind inputs nor outputs."* and > *"`in` variables will throw in
> template expressions."*

### The v22 upgrade wall

Everything a reader hitting v22 for the first time will experience at once, all sourced above:

1. `strictTemplates` is now on (§14) — a project that never enabled it gets the full strict error
   set on first build.
2. Extended diagnostics therefore emit (§15), including `nullishCoalescingNotNullable` and
   `optionalChainNotNullable`, which the CHANGELOG explicitly warns about and which the `ng update`
   migration suppresses for you.
3. `?.` now returns `undefined` rather than `null` (chunk 05).
4. `OnPush` is the default `changeDetection` (§06).
5. Duplicate selectors are now NG8023 compile errors, not runtime NG0300.
6. TypeScript must be `>=6.0 <6.1` (§13).
7. `data-` prefixed attributes no longer bind, and `in` throws in template expressions.

That list is the chunk's payoff paragraph: **every item is the compiler being given more to check,
which is the whole topic in one release.**

### Gotcha seeds for 17

- An error in `user-card.html` with no `user-card.html` in `tsconfig.json`'s `include`. Cause: the
  template type-checker owns that file, not `tsc`. Fix: nothing — it is working correctly; read the
  "Error occurs in the template of component X" note to get back to the `.ts`.
- An error located in `foo.ts (Foo template)`, a file that does not exist. Cause: an `indirect`
  source mapping from a non-literal `template:`. Fix: inline the literal or move to `templateUrl`.
- `Failed to report an error in '…' at 3:12` plus a stack. Cause: the diagnostic machinery, not your
  code.
- NG8001 tells you to add `CUSTOM_ELEMENTS_SCHEMA` for `my-widget` and `NO_ERRORS_SCHEMA` for
  `widget`. Cause: the hyphen test. Fix: the message is right — but prefer fixing `imports`.
- NG8023 appearing on an upgrade to v22 on markup that has worked for years. Cause: it was NG0300 at
  runtime before and nobody noticed.

### Interview-question seeds for 17

- A template error names an `.html` file. Which tool produced it, and why does TypeScript not know
  that file exists?
- What is the difference between NG8001 and NG0304, and why does Angular have both?
- Why can Angular report a duplicate-selector collision at build time in v22 when it could not
  before?
- You changed one file and got NG3003 in another. Explain the mechanism and give a fix that costs
  nothing at runtime.
- Name three v22 changes that turn something previously silent into a build error, and say what they
  have in common.

---

## §18 — UNSETTLED: claims I could not confirm

Every item here was attempted honestly and left open. **Write these as explicitly uncertain, or
leave them out.** "The documentation does not state whether X" is a legitimate sentence in this
corpus; a confident invention is not.

1. **Svelte and the virtual DOM.** `svelte.dev/docs/svelte/overview` and `/docs/svelte/faq` were
   read. Neither states that Svelte has no virtual DOM, nor quantifies its runtime. The only
   documented characterisation is *"It uses a compiler to turn declarative components written in
   HTML, CSS and JavaScript … into lean, tightly optimized JavaScript."* **§16 must not assert the
   absence of a virtual DOM as documented fact.**

2. **Any size, time or bundle number, anywhere.** aot-compiler.md's *"The compiler is roughly half of
   Angular itself"* is the only quantity in this bank and it is a doc quote, not a measurement. There
   is no sandbox. Do not convert it to bytes, do not compare framework sizes, do not estimate a
   `@defer` chunk size.

3. **Byte-exact generated output.** No chunk may print "here is what the compiler emits for this
   component" as fact. The architecture.md example (§06) is a 2018 draft; the
   `compileDeferResolverFunction` and `generateTypeCheckBlock` bodies (§11, §14) are the *compiler's
   own string-building code*, which is far better evidence, but the assembled result is still
   illustrative. Every such block must be labelled, or the sentence "this is the shape, read from
   `<file>`" must appear next to it.

4. **When exactly `strictTemplates` flipped, at commit granularity.** Confirmed by direct diff that
   `v21.2.22` had `!!this.options.strictTemplates` and `v22.0.0` had `this.options.strictTemplates
   !== false`, so the flip is in v22.0.0. **No CHANGELOG entry announces it as a breaking change** —
   the only traces are the two migration entries and the v22.1.4 language-service fix. If a chunk
   wants to name a commit, it must find one; this bank did not.

5. **Whether `ɵɵdefineComponent`'s emitted field order is stable.** §06 lists the order in which
   `compileComponentFromMetadata` calls `definitionMap.set(...)`, which is the order in the source at
   `v22.1.5`. Whether that is a guarantee is not stated anywhere; the `ComponentDef` doc comment
   explicitly warns *"the shape of this object can change between versions."* Present the order as
   "what the compiler does today", not as a contract.

6. **Whether `NG0304` is reachable in v22 at all.** `RuntimeErrorCode.UNKNOWN_ELEMENT = 304` exists;
   `element_validation.ts` produces "is not a known element" text; but the error encyclopedia has no
   page and this bank did not trace a runtime path that throws it under default v22 settings (with
   `strictTemplates` on, NG8001 fires first at build time). **Say the code exists and that the docs
   do not document it; do not claim you can still trigger it.**

7. **The exact set of `@Component` fields the partial evaluator touches.** §09 lists the fields with
   an `evaluator.evaluate(...)` call site found in `annotations/directive/src/shared.ts` and
   `annotations/component/src/{handler,resources}.ts`. Other handlers (`ng_module`, `pipe`,
   `injectable`, `service`) were not read exhaustively. Do not present the list as complete for
   every decorator — scope it to `@Component` / `@Directive`.

8. **The behaviour of `ɵɵngDeclare*` under the linker in detail.** The entry points
   (`@angular/compiler-cli/linker`, `/linker/babel`) and the `partial.ts` dispatch were read; the
   linker's own version-negotiation logic (`minVersion` handling in partial declarations) was **not**
   read. §12 should say "the linker re-compiles the declaration at the application's Angular
   version" and stop there.

9. **Whether `checkQueries: false` has ever been true.** It is hard-coded `false` in both branches of
   `getTypeCheckingConfig`. No option exposes it. No doc mentions it. Note it as "queries are not
   type-checked in the TCB" and do not speculate about why.

10. **How the `unusedStandaloneImports` check interacts with a non-literal `imports` array.** §09
    shows the diagnostic loses per-element position on a spread; whether NG8113 still fires at all in
    that case was not determined. If a chunk wants to make that claim, it needs a source read this
    bank did not do.

---

## §19 — Source index

Everything cited above, with the exact path or URL. GitHub blobs:
`https://github.com/angular/angular/blob/v22.1.5/<path>`.

### `angular/angular` at `v22.1.5` — framework source

| path | used by |
|---|---|
| `packages/compiler/design/architecture.md` | 06, 08, 12, 13 |
| `packages/compiler/design/separate_compilation.md` | 12 |
| `packages/core/src/render3/definition.ts` | 06 |
| `packages/core/src/render3/interfaces/definition.ts` | 06, 07 |
| `packages/core/src/render3/interfaces/public_definitions.ts` | 06 |
| `packages/core/src/render3/interfaces/view.ts` | 07 |
| `packages/core/src/render3/instructions/advance.ts` | 07 |
| `packages/core/src/render3/instructions/shared.ts` | 07 |
| `packages/core/src/render3/instructions/render.ts` | 07 |
| `packages/core/src/render3/instructions/change_detection.ts` | 07 |
| `packages/core/src/render3/instructions/element.ts` | 06, 07 |
| `packages/core/src/render3/instructions/property.ts` | 07, 12 |
| `packages/core/src/render3/jit/partial.ts` | 12 |
| `packages/core/src/util/closure.ts` | 06, 08 |
| `packages/core/src/change_detection/constants.ts` | 06 |
| `packages/core/src/errors.ts` | 17 |
| `packages/core/src/defer/instructions.ts` | 11 |
| `packages/core/src/defer/interfaces.ts` | 11 |

### `angular/angular` at `v22.1.5` — compiler source

| path | used by |
|---|---|
| `packages/compiler/src/render3/view/compiler.ts` | 06, 11 |
| `packages/compiler/src/render3/r3_factory.ts` | 06 |
| `packages/compiler/src/render3/r3_identifiers.ts` | 08, 12 |
| `packages/compiler/src/render3/partial/component.ts` | 12 |
| `packages/compiler/src/compiler_facade_interface.ts` | 06 |
| `packages/compiler/src/typecheck/type_check_block.ts` | 14 |
| `packages/compiler/src/typecheck/ops/scope.ts` | 14 |

### `angular/angular` at `v22.1.5` — `compiler-cli` source

| path | used by |
|---|---|
| `packages/compiler-cli/package.json` | 13, §1.1 |
| `packages/compiler-cli/src/typescript_support.ts` | 13 |
| `packages/compiler-cli/src/ngtsc/core/src/compiler.ts` | 12, 13, 14, 15 |
| `packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts` | 12, 13, 14, 15 |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts` | 09, 10, 11, 13, 15, 17 |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts` | 09, 13 |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts` | 13 |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts` | 13 |
| `packages/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.ts` | 15 |
| `packages/compiler-cli/src/ngtsc/partial_evaluator/src/interpreter.ts` | 09, 10 |
| `packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts` | 09 |
| `packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts` | 09, 10 |
| `packages/compiler-cli/src/ngtsc/annotations/common/src/evaluation.ts` | 09, 10 |
| `packages/compiler-cli/src/ngtsc/annotations/common/src/diagnostics.ts` | 09 |
| `packages/compiler-cli/src/ngtsc/annotations/common/src/factory.ts` | 06 |
| `packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts` | 09, 10 |
| `packages/compiler-cli/src/ngtsc/annotations/component/src/handler.ts` | 09, 10, 11 |
| `packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts` | 09 |
| `packages/compiler-cli/src/ngtsc/annotations/component/src/resources.ts` | 10, 17 |
| `packages/compiler-cli/src/ngtsc/imports/src/emitter.ts` | 10 |
| `packages/compiler-cli/src/ngtsc/imports/src/deferred_symbol_tracker.ts` | 11 |
| `packages/compiler-cli/src/ngtsc/entry_point/src/private_export_checker.ts` | 10 |
| `packages/compiler-cli/src/ngtsc/typecheck/src/type_check_file.ts` | 14 |
| `packages/compiler-cli/src/ngtsc/typecheck/src/shim.ts` | 13, 14 |
| `packages/compiler-cli/src/ngtsc/typecheck/src/dom.ts` | 17 |
| `packages/compiler-cli/src/ngtsc/typecheck/src/diagnostics.ts` | 14 |
| `packages/compiler-cli/src/ngtsc/typecheck/diagnostics/src/diagnostic.ts` | 17 |
| `goldens/public-api/compiler-cli/compiler_options.api.md` | 13, 14 |
| `goldens/public-api/compiler-cli/error_code.api.md` | 09, 15 |
| `CHANGELOG.md` | 06, 13, 14, 15, 17 |

### angular.dev docs (read as `adev/src/content/**` at `v22.1.5`)

| doc source path | live URL | used by | status |
|---|---|---|---|
| `tools/cli/aot-compiler.md` | `https://angular.dev/tools/cli/aot-compiler` | 06, 08, 09, 10, 13, 16, 17 | ⚠️ **STALE** (C4, C5, C8) |
| `tools/cli/template-typecheck.md` | `https://angular.dev/tools/cli/template-typecheck` | 14 | ⚠️ **STALE on defaults** (C1, C3) |
| `reference/configs/angular-compiler-options.md` | `https://angular.dev/reference/configs/angular-compiler-options` | 12, 13, 14, 15 | ✅ current on defaults, ⚠️ stale option list (C7) |
| `reference/extended-diagnostics/overview.md` | `https://angular.dev/extended-diagnostics` | 15 | ⚠️ roster incomplete (C9) |
| `reference/extended-diagnostics/NG8109.md` | `https://angular.dev/extended-diagnostics/NG8109` | 15 | ✅ |
| `reference/extended-diagnostics/NG8113.md` | `https://angular.dev/extended-diagnostics/NG8113` | 15 | ✅ |
| `reference/extended-diagnostics/NG8021.md` | `https://angular.dev/extended-diagnostics/NG8021` | 11, 15 | ✅ |
| `reference/errors/overview.md` | `https://angular.dev/errors` | 13, 17 | ✅ |
| `reference/errors/NG1001.md` | `https://angular.dev/errors/NG1001` | 09 | ✅ |
| `reference/errors/NG2003.md` | `https://angular.dev/errors/NG2003` | 10 | ✅ |
| `reference/errors/NG3003.md` | `https://angular.dev/errors/NG3003` | 10 | ✅ |
| `reference/errors/NG8001.md` | `https://angular.dev/errors/NG8001` | 17 | ⚠️ links dangling NG0304 (C11) |
| `reference/errors/NG8002.md` | `https://angular.dev/errors/NG8002` | 17 | ⚠️ same |
| `reference/errors/NG8003.md` | `https://angular.dev/errors/NG8003` | 17 | ✅ |
| `reference/errors/NG8023.md` | `https://angular.dev/errors/NG8023` | 17 | ✅ new in v22 |
| `guide/templates/defer.md` | `https://angular.dev/guide/templates/defer` | 11 | ⚠️ "two conditions" understates (C10); incremental-hydration line predates the v22 default |
| `guide/templates/expression-syntax.md` | `https://angular.dev/guide/templates/expression-syntax` | 09 (C13), chunks 02–05 | ⚠️ arrow-function contradiction, owned by chunk 04 |

### Non-Angular primary sources

| URL | used by |
|---|---|
| `https://vuejs.org/guide/extras/rendering-mechanism.html` | 08, 16 |
| `https://react.dev/learn/react-compiler` | 16 |
| `https://react.dev/learn/react-compiler/introduction` | 16 |
| `https://svelte.dev/docs/svelte/overview` | 16 |
| `https://svelte.dev/docs/svelte/faq` | 16 (negative result — see §18.1) |

### Package metadata (registry.npmjs.org, read 2026-09-06)

`@angular/core` · `@angular/compiler-cli` · `@angular/cli` · `@angular/build` dist-tags, and the
full `22.1.5` manifests for `@angular/core` and `@angular/compiler-cli`.

---

## §20 — Reading order for a writer

If you are writing one chunk, read: **§1**, then **§2** (skim for your chunk number in the "Where it
bites" column), then your own section, then the sections of your immediate neighbours so the seams
join.

If you are writing several, the dependency order is:
**06 → 07 → 08** (the emitted artefact, then how it runs, then why it is shaped that way),
**09 → 10** (the rule, then the catalogue),
**11** and **12** both lean on 06 and 09,
**13** stands alone but supplies the error-code encoding that 15 and 17 reuse,
**14 → 15** (type checking, then the warnings layered on it),
**16** and **17** are the topic's two closing arguments and should be written last, after everything
they summarise exists.
