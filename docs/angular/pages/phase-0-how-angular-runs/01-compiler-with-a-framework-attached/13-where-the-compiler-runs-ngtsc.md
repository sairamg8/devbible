---
title: "`ngtsc` is not a compiler that runs before `tsc` or after it — it is a list of `ts.CustomTransformers` handed to TypeScript's own emit, and that single return type is why the output is additive, why plain `tsc` silently produces an Angular app that cannot render, and why the TypeScript peer range is a pin rather than a suggestion"
sidebar_label: "13 · Where the compiler runs: ngtsc"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`packages/compiler-cli/src/ngtsc/typecheck/src/shim.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/typecheck/src/shim.ts),
> [`packages/compiler/design/architecture.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/architecture.md) — ⚠️ a 2018 draft; its extension-point list is still exact, its `.d.ts` sentence is not, and both are handled below;
> and angular.dev [Ahead-of-time (AOT) compilation](https://angular.dev/tools/cli/aot-compiler), ⚠️ which still describes the pre-Ivy metadata collector and is corrected below.
> Documentation-validated; **no sandbox run** — no build was executed and no compiler output was captured.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every constraint the previous twelve chunks described — selectors that must fold to literals, metadata that cannot call a function, errors reported in a file TypeScript never opened, a `.d.ts` carrying `ɵɵComponentDeclaration` — is a consequence of one method signature. `NgCompiler.prepareEmit()` returns `{transformers: ts.CustomTransformers}`. Angular does not read your TypeScript and write JavaScript. It hands `tsc` a list of AST-to-AST transforms and lets `tsc` do the emitting. Everything additive about the output, everything strict about the input, and the entire coupling to TypeScript's internals follows from that one decision.**

## The eighteen lines that settle it

`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`, verbatim at `v22.1.5` — two blocks are elided exactly where the source has a conditional push and a conditional declaration branch, and those elisions are marked:

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

🔴 **Read the return type out loud: `ts.CustomTransformers`.** That is a TypeScript public type, and the object it wraps is the second argument to `ts.Program.emit`. The Angular compiler's final act is to hand TypeScript a plain data structure and step out of the way. It never writes a file, never parses your TypeScript itself, and never produces a byte of JavaScript on its own.

## TypeScript offers three ways in. Angular takes the second, on purpose

`packages/compiler/design/architecture.md`, verbatim — the design doc enumerates the options that existed and then names the one taken:

> *"TypeScript supports the following extension points to alter its output. You can, 1. Modify the TypeScript source it sees (`CompilerHost.getSourceFile`) 2. Alter the list of transforms (`CustomTransformers`) 3. Intercept the output before it is written (`WriteFileCallback`)"*

> *"It is not recommended to alter the source code as this complicates the managing of source maps, makes it difficult to support incremental parsing, and is not supported by TypeScript's language service plug-in model."*

> *"Angular transforms the `.js` output by adding Angular specific transforms to the list of transforms executed by TypeScript."*

Three sentences, three engineering decisions. Option 1 was rejected because rewriting source destroys the source-map chain and the language service's model of the file — which is exactly why the Angular Language Service can be the *same compiler* running in your editor rather than a re-implementation. Option 3 is a string-level hack. Option 2 is the only one that keeps TypeScript in charge of positions, maps and incrementality.

⚠️ **The same doc then says something that stopped being true years ago:** *"As of TypeScript 2.7, there is no similar transformer pipe-line for `.d.ts` files so the .d.ts files will be altered during the `WriteFileCallback`."* At `v22.1.5` the `.d.ts` work is done through `afterDeclarations`, a first-class TypeScript hook — you can see it in `prepareEmit` above. Cite the extension-point list from this doc; never cite its `.d.ts` claim.

## What is actually in the two arrays

| transformer | array | what it does |
|---|---|---|
| `ivyTransformFactory` | `before` | adds the `ɵcmp` / `ɵdir` / `ɵpipe` / `ɵprov` / `ɵinj` / `ɵfac` statics and removes the decorators |
| `aliasTransformFactory` | `before` | emits the private re-exports (`generateDeepReexports`) that make remote scoping work |
| `defaultImportTracker.importPreservingTransformer()` | `before` | stops TypeScript eliding a default import whose only surviving reference is inside generated code |
| `angularJitApplicationTransform` | `before`, conditional | pushed only when the compilation contains JIT declarations |
| `signalMetadataTransform` | `before` | *"Typescript transformer to add debugName metadata to signal functions."* |
| `declarationTransformFactory` | `afterDeclarations` | writes `ɵɵComponentDeclaration<…>` and its siblings into the emitted `.d.ts` |

Two of those rows are worth stopping on because they are pure evidence of the architecture.

**`defaultImportTracker` exists because TypeScript's import elision does not know about Angular.** `tsc` drops an import whose imported binding is never referenced in a value position after type erasure. Angular's transformer adds references *after* that decision would otherwise be made, so a default import used only by generated code would vanish and the emitted module would throw at load. A compiler that owned its own emit would never need this; a transformer sharing someone else's emit does.

**`untagAllTsFiles` exists because of a TypeScript version-specific bug**, and the comment says so: *"Untag all the files, otherwise TS 5.4 may end up emitting references to typecheck files (see #56945 and #57135)."* A workaround naming a specific TypeScript minor, living in Angular's emit path, is the most direct evidence you will find for the argument in [13b](13b-ngc-is-tsc-and-the-typescript-pin.md).

## `before` and `afterDeclarations` are two halves of one emit

There is not a JavaScript build and then a declarations build. `ts.Program.emit` runs once with both hooks installed: the `before` chain rewrites the source AST on its way to `.js`, and the `afterDeclarations` chain rewrites the *declaration* AST on its way to `.d.ts`. That is precisely what "additive" means in [06](06-what-the-compiler-emits.md) — one emit, producing your `.js` and your `.d.ts`, with Angular's static fields in the first and Angular's type declarations in the second.

The consequence people trip on is the inverse: **there is no configuration in which you get Angular's `.d.ts` declarations without also running the `.js` emit**, because the two hooks belong to the same `emit` call. That is why `emitDeclarationOnly` is rejected outright with its own diagnostic — see [13e](13e-the-option-surface-and-config-time-diagnostics.md).

## Nothing is emitted until analysis has finished, and `templateUrl` can make analysis asynchronous

The first statement in `prepareEmit` is `const compilation = this.ensureAnalyzed();`. Analysis — reading every decorator, evaluating the metadata, resolving templates and styles, building the scope of every component — happens before a single transformer is constructed. `NgCompiler`'s `analyzeAsync` doc comment explains the one case where the caller must drive that phase itself:

> *"Normally, this operation happens lazily whenever `getDiagnostics` or `prepareEmit` are called. However, certain consumers may wish to allow for an asynchronous phase of analysis, where resources such as `styleUrls` are resolved asynchronously. In these cases `analyzeAsync` must be called first, and its `Promise` awaited prior to calling any other APIs of `NgCompiler`."*

That sentence is the whole reason `templateUrl` and `template` compile identically for you ([01](01-the-template-is-a-separate-language.md)) but not for the tool: an external template is a file read, and a file read is asynchronous, so the *build integration* — not the compiler — has to be given a chance to await it. Anything embedding `NgCompiler` in a build with a virtual or network-backed filesystem must do this:

```ts
// pseudo-code — the shape of a custom build integration around NgCompiler
const ngCompiler = NgCompiler.fromTicket(ticket, adapter);

// 🔴 Required first when resources resolve asynchronously. Skipping it means
// prepareEmit() runs analysis synchronously and an async resource loader
// cannot participate.
await ngCompiler.analyzeAsync();

const {transformers} = ngCompiler.prepareEmit();
program.emit(undefined, undefined, undefined, undefined, transformers);
```

## Your `ts.Program` contains files you never wrote

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

Each one starts life holding a single statement: `'export const USED_FOR_NG_TYPE_CHECKING = true;'`.

🔴 **There is one `.ngtypecheck.ts` per source file, it is in your main program, and it is never written to disk** (`shouldEmit = false`). The doc comment gives the reason and it is a performance reason, not a design flourish: TypeScript will only reuse a program's work when building a second program if *the file sets are identical*, so the main program is padded with the same shims the type-checking program needs. What eventually goes inside them is **14 · Template type checking** *(not written yet)*; the fact that they exist, and exist in both programs, belongs here.

## What being a transformer forbids

Three limits fall straight out of the architecture, and each one is a chunk of this topic:

1. **It cannot change what TypeScript read.** The design doc rules out `getSourceFile` interception. So there is no preprocessing step, no macro expansion, no "Angular fixes it up before `tsc` sees it". Your `@Component({...})` argument is evaluated as a TypeScript expression by a partial evaluator ([09c](09c-the-partial-evaluator-is-the-grammar.md)), not rewritten into something friendlier.
2. **It cannot look outside the `ts.Program`.** Anything not reachable from the tsconfig's file set is invisible. That is what NG3003 import cycles ([10d](10d-import-cycles-and-local-compilation.md)) and local compilation mode ([13d](13d-compilation-mode-and-the-local-portability-trap.md)) are both about, from opposite directions.
3. **It cannot run when `tsc` does not run.** A toolchain that transpiles TypeScript without type-checking or emitting through `tsc` — esbuild's transform API, SWC, Babel's TypeScript preset, `ts-jest` in isolated-modules mode — never constructs an `NgCompiler`, never installs the transformers, and therefore produces classes with **no `ɵcmp`**. They compile, they load, and nothing renders. [08e](08e-only-compiled-classes-are-renderable.md) is what that failure looks like from the runtime's side.

⚠️ **angular.dev's AOT page describes a compiler that no longer exists.** Its three-phase story — a metadata collector, `.metadata.json` files, a `StaticReflector`, code folding, `strictMetadataEmit` — is ViewEngine. `ngtsc` has no collector and emits no `.metadata.json`. Read that page for vocabulary and intent; read `compiler.ts` for behaviour.

## Gotchas

**★ Symptom: `tsc --noEmit` is green in CI and `ng build` fails on the same commit.** Cause: they are two different programs. Plain `tsc` never constructs an `NgCompiler`, so it produces exactly zero Angular diagnostics — no template checks, no metadata checks, no scope checks — and a template is either a string literal it does not parse or a file it does not include. Fix: make the Angular build the type-check gate, and stop shipping a script whose name promises something it does not do:

```json
{
  "scripts": {
    "typecheck": "ng build --configuration development",
    "typecheck:ts-only": "tsc --noEmit -p tsconfig.json"
  }
}
```

**★ Symptom: components built by a Jest/SWC/esbuild-transform pipeline throw at render time, while the same code works under `ng build`.** Cause: those transforms replace `tsc` rather than wrapping it, so Angular's `before` transformers never run and the emitted class has no `ɵcmp` static. Fix: compile Angular code through a toolchain that owns a real `ts.Program` — the Angular CLI's own test builder, or a Jest transform that runs the Angular compiler — rather than a transpile-only transform:

```json
{
  "scripts": {
    "test": "ng test"
  }
}
```

**Symptom: a codemod or lint rule that walks `program.getSourceFiles()` reports files that do not exist on disk.** Cause: the shim generator inserted one `.ngtypecheck.ts` per source file into the main program. They are synthetic and never emitted. Fix: filter them, along with declaration files, before you do anything with the list:

```ts
const authoredSources = program
  .getSourceFiles()
  .filter((sf) => !sf.isDeclarationFile && !sf.fileName.endsWith('.ngtypecheck.ts'));
```

**Symptom: a custom builder resolves `templateUrl` from a virtual filesystem and gets a missing-resource failure, while the same templates load under the CLI.** Cause: `prepareEmit` runs analysis synchronously through `ensureAnalyzed`, and a synchronous analysis cannot await an async resource loader. Fix: drive the async phase explicitly before touching any other `NgCompiler` API — `await ngCompiler.analyzeAsync();` — as shown above. The doc comment is unambiguous that this must happen *"prior to calling any other APIs of `NgCompiler`"*.

**Symptom: a runtime library that reads decorator metadata finds nothing in a production build.** Cause: `ivyTransformFactory` adds the static definitions **and removes the decorators**; after AOT there is no decorator left in the emitted JavaScript to reflect on. Fix: stop reflecting on Angular decorators and carry the information in something the compiler will not delete — a provider keyed by an `InjectionToken`, or a plain static:

```ts
import {InjectionToken, inject} from '@angular/core';

export const AUDIT_LABEL = new InjectionToken<string>('AUDIT_LABEL');

@Component({
  selector: 'app-invoice-row',
  template: `<span>{{ label }}</span>`,
  providers: [{provide: AUDIT_LABEL, useValue: 'invoice-row'}],
})
export class InvoiceRowComponent {
  readonly label = inject(AUDIT_LABEL);
}
```

**Symptom: the editor shows an error the build does not, or the reverse.** Cause: the Angular Language Service is the same compiler, but it is a different *instance*, potentially at a different version — `compiler.ts` carries the comment *"the language service extension may be running with the latest version of the compiler against an older version of Angular"*, so this skew is a designed-for condition, not a bug report. Fix: treat the build as authoritative and reproduce disagreements there before changing code. ⚠️ I did not verify which editor setting selects the workspace's language-service version, so this page does not name one.

**Symptom: a second custom TypeScript transformer sees classes that still have decorators, or sees classes that no longer do, depending on the build.** Cause: order inside the `before` array is fixed by `prepareEmit` and Angular's `ivyTransformFactory` is first; anything a build integration appends runs after decorator removal. Fix: do not write transformers that depend on Angular decorators being present. Read the emitted static instead, or do the work at analysis time through a compiler plugin rather than at emit time.

## Interview questions

**★ Is `ngtsc` a separate compiler that runs before `tsc`, after it, or neither?**
Neither. It is a set of TypeScript transformers installed into TypeScript's own emit. `NgCompiler.prepareEmit()` returns `{transformers: ts.CustomTransformers}` with two arrays — `before`, which rewrites the source AST on its way to `.js`, and `afterDeclarations`, which rewrites the declaration AST on its way to `.d.ts`. There is one program, one type checker and one emit; Angular's contribution is additive nodes inside them. The reason this is worth being precise about is that every "why can't the compiler just…" question in Angular has the same answer: because whatever you are asking for would require reading or writing something TypeScript is not offering the transformer.

**★ TypeScript offers three extension points. Which one does Angular use and why not the others?**
The design doc lists them: modify the source TypeScript sees via `CompilerHost.getSourceFile`, alter the list of transforms via `CustomTransformers`, or intercept output via `WriteFileCallback`. Angular uses the second. Its own stated reason for avoiding the first is that altering source *"complicates the managing of source maps, makes it difficult to support incremental parsing, and is not supported by TypeScript's language service plug-in model"* — that last clause is why the Angular Language Service can be the real compiler running in your editor instead of a second implementation that drifts. The third is a string-level intercept with no AST and no positions.

**★ Why does a green `tsc --noEmit` tell you almost nothing about an Angular build?**
Because `tsc` on its own never builds an `NgCompiler`, so none of Angular's analysis runs. Templates in `templateUrl` files are not even in the program; templates in `template` strings are string literals `tsc` has no reason to parse. Metadata is just an object literal. Nothing checks that a selector folds to a string, that an imported symbol is a directive, or that a binding target exists. `tsc` will happily report success on a project whose every template is broken, and it will emit classes with no `ɵcmp`, which load fine and render nothing.

**Why is there a transformer whose entire job is to preserve a default import?**
Because import elision is TypeScript's decision and it is made against the program as TypeScript sees it, not as Angular will leave it. If a default import's only value-position reference ends up inside code Angular generates, `tsc` would drop the import and the module would fail at load. `defaultImportTracker.importPreservingTransformer()` exists to keep that import alive. It is a small piece of code that tells you exactly how much of the emit Angular does not own.

**What are the `.ngtypecheck.ts` files, and why are they in the main program rather than only in the type-checking one?**
They are synthetic per-file shims added by `TypeCheckShimGenerator`, each starting as `export const USED_FOR_NG_TYPE_CHECKING = true;` and each marked `shouldEmit = false`, so none is ever written to disk. The reason they exist in the *main* program is stated in the class's own doc comment: TypeScript will only reuse the main program's information when constructing the type-checking program if the set of files in each is exactly the same. Padding the main program with the shims is what makes template type checking incremental rather than a second full parse of everything.

**A build tool transpiles your components without running `tsc`. What breaks, and when do you find out?**
The transformers never run, so no class gets a `ɵcmp`, `ɵdir`, `ɵpipe` or `ɵfac`, and every decorator is either erased or left as an unused call. Nothing fails at build time — the JavaScript is syntactically fine. You find out at runtime, the first time Angular is asked to render one of those classes and finds no definition on it. This is the standard failure mode of an Angular project wired into a transpile-only Jest or esbuild pipeline, and it is why the answer is always to compile through something that owns a real `ts.Program`.

**Why can `templateUrl` force an asynchronous phase when `template` cannot?**
Because an external template is a resource that has to be fetched, and a build integration may fetch it from something other than a synchronous filesystem. `NgCompiler` therefore exposes `analyzeAsync`, whose doc comment says analysis normally happens lazily inside `getDiagnostics` or `prepareEmit` but that a consumer wanting asynchronous resource resolution *"must"* call `analyzeAsync` first and await it before any other API. For the developer writing the component this changes nothing — the two forms compile identically. For the person writing the build, it is the difference between resources loading and not.

---

← Prev: **12 · Ivy and locality** *(not written yet)* · Index: [Topic index](README.md) · Next → [`ngc` is `tsc`, and that is why the TypeScript pin is hard](13b-ngc-is-tsc-and-the-typescript-pin.md)
