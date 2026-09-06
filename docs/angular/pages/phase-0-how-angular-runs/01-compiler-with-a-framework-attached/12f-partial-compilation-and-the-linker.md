---
title: "Partial compilation is locality taken to its conclusion — a library emits `ɵɵngDeclare*` calls instead of definitions, ships them to npm, and the consumer's build runs a Babel plugin that turns each declaration into a real definition at the application's Angular version, so the library is compiled once and linked N times"
sidebar_label: "12f · Partial compilation and the linker"
sidebar_position: 12.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`: [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts) (`compilationMode`, verbatim), [`packages/core/src/render3/jit/partial.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/jit/partial.ts) (verbatim), [`packages/compiler/src/render3/r3_identifiers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/r3_identifiers.ts) (the `ɵɵngDeclare*` family), `packages/compiler-cli/package.json` (the `./linker` and `./linker/babel` exports, verbatim), [`packages/compiler/design/separate_compilation.md`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/design/separate_compilation.md); and angular.dev [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> ⚠️ **Explicitly not confirmed here:** the linker's own version-negotiation logic — how a partial declaration's minimum-version marker is handled — was **not** read for this topic. This page states that the linker re-compiles the declaration at the application's Angular version and stops there.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A library cannot ship fully compiled Angular output, because the output targets one runtime's
private ABI and a library declares a *range*. That was true before Ivy too — and pre-Ivy it was
fatal, because whole-program compilation meant a library could not ship compiled output *at all*.
Locality is what made the third option possible: compile the class from its own decorator into a
**stable intermediate form**, publish that, and let the consumer's build finish the job. The
intermediate form is a call to `ɵɵngDeclareComponent` (or one of nine siblings) instead of
`ɵɵdefineComponent`; the thing that finishes the job is a Babel plugin published as
`@angular/compiler-cli/linker/babel`. The library is compiled once and linked N times, and the whole
scheme works only because the compilation of that class never needed anything outside its own
file.**

## The business case, in the design doc's own words

`separate_compilation.md` on why pre-Ivy npm packages shipped metadata rather than factories,
verbatim:

> *"Separate component and module compilation is supported only at the module definition level and
> only from the source. That is, npm packages must contain the metadata necessary to generate the
> factories. They cannot contain, themselves, the generated factories. This is because if any of
> their dependencies change, their factories would be invalid, preventing them from using version
> ranges in their dependencies."*

🔴 **The constraint was semver.** A `peerDependencies` range says "I do not know what I will run
against". Whole-program-compiled output is valid for exactly one resolved graph. The two are
incompatible, so pre-Ivy libraries shipped `.metadata.json` and every application recompiled every
library it used. Locality removed the *whole-program* half of the problem, leaving only the *version*
half — and partial compilation is the answer to that remainder.

## The three modes

`TargetOptions.compilationMode`, from `public_options.ts`, verbatim:

> *"Specifies the compilation mode to use. The following modes are available:"*
> *"- 'full': generates fully AOT compiled code using Ivy instructions."*
> *"- 'partial': generates code in a stable, but intermediate form suitable for publication to
> NPM."*
> *"- 'experimental-local': generates code based on each individual source file without using its
> dependencies. This mode is suitable only for fast edit/refresh during development. It will be
> eventually replaced by the value `local` once the feature is ready to be public."*
> *"The default value is 'full'."*

angular.dev states the first two more briefly, verbatim:

> *"`'full'` — Generates fully AOT-compiled code according to the version of Angular that is
> currently being used."*
> *"`'partial'` — Generates code in a stable, but intermediate form suitable for a published
> library."*

Two words carry the design: **stable** and **intermediate**. Stable, because the declaration format
is a contract across versions in a way `ɵɵdefineComponent`'s arguments explicitly are not.
Intermediate, because it is not executable Angular yet — something must convert it.

⚠️ `'experimental-local'` is a *third* thing and not a publishing mode. Its errors are covered in
[10d](10d-import-cycles-and-local-compilation.md), and the mechanism belongs to chunk
**13 · Where the compiler runs: `ngtsc`** *(not written yet)*.

## What partial mode emits

Ten `ɵɵngDeclare*` entry points exist, listed in `r3_identifiers.ts`. Counted from that list:

| Declaration | Replaces |
|---|---|
| `ɵɵngDeclareComponent` | `ɵɵdefineComponent` |
| `ɵɵngDeclareDirective` | `ɵɵdefineDirective` |
| `ɵɵngDeclarePipe` | `ɵɵdefinePipe` |
| `ɵɵngDeclareInjectable` | `ɵɵdefineInjectable` |
| `ɵɵngDeclareInjector` | `ɵɵdefineInjector` |
| `ɵɵngDeclareNgModule` | `ɵɵdefineNgModule` |
| `ɵɵngDeclareFactory` | the `ɵfac` factory |
| `ɵɵngDeclareService` | the v22 `@Service` definition |
| `ɵɵngDeclareClassMetadata` | the dev-mode class metadata |
| `ɵɵngDeclareClassMetadataAsync` | the deferred-dependency variant of the same |

The runtime half is small and it gives the game away. From
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

🔴 **Read `getCompilerFacade` and `JitCompilerUsage.PartialDeclaration`.** The partial-declaration
path is the **just-in-time compiler**, invoked with a different usage tag. That is
`architecture.md`'s design clause paying off: *"this restriction also enables Compilers to run at
runtime during JIT mode"* — because a Compiler consumes a plain metadata object rather than
TypeScript nodes, the same code can finish a declaration at build time in the linker, or at run time
in the browser if the declaration is reached without having been linked.

Note the third argument too — `` `ng:///${decl.type.name}/ɵfac.js` `` is a source URL, so functions
generated down this path get a meaningful name in a stack trace instead of being anonymous.

## The linker

`@angular/compiler-cli` publishes it as a top-level entry point. From its `package.json` `exports`
at `v22.1.5`, verbatim:

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

**A Babel plugin.** That single fact settles what the linker is and where it runs: over
already-emitted JavaScript, in the consumer's bundling pipeline, not over TypeScript in a compiler
pass. It can therefore process a package downloaded from npm, which no TypeScript transformer could.
In a CLI application `@angular/build` runs it for you; in a bespoke pipeline you wire the plugin in
yourself.

⚠️ **What this page does not claim.** The linker's version-negotiation logic — how it handles a
declaration's minimum-version marker, and what it does when a package was built by a *newer* Angular
than the application — was not read while researching this topic. The claim here is the narrow one:
**the linker re-compiles the declaration at the application's Angular version.**

## Gotchas

**★ Symptom: your library works in your own workspace and consumers on a different Angular version get failures inside your components.** Cause: `compilationMode` defaults to `'full'`, and full mode emits `ɵɵdefine*` calls against one runtime's private ABI while your `peerDependencies` promise a range. Fix: build the library in partial mode. In a CLI workspace this belongs in the library's production tsconfig — **verify it is there rather than assuming the generator set it**:

```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "../../dist/order-widgets"
  },
  "angularCompilerOptions": {
    "compilationMode": "partial"
  },
  "exclude": ["**/*.spec.ts"]
}
```

**★ Symptom: you cannot tell whether a package you depend on — or one you just published — is partial or full.** Cause: nothing in `package.json` records it; the evidence is in the emitted JavaScript. Fix: look for the declaration calls. A partial build contains `ɵɵngDeclare*`; a full build contains `ɵɵdefine*`:

```bash
# Partial-mode output: declarations waiting to be linked.
grep -rl 'ngDeclareComponent' node_modules/@acme/order-widgets/fesm2022/

# Full-mode output: final definitions, valid only against one Angular version.
grep -rl 'defineComponent' node_modules/@acme/order-widgets/fesm2022/
```

**★ Symptom: a partial-mode library is consumed by a build that is not Angular's, and the components never work — the declarations are still declarations in the output bundle.** Cause: linking is a Babel plugin the consumer's pipeline has to run. `@angular/build` runs it; a hand-rolled webpack or Rollup pipeline with a plain TypeScript loader does not. Fix: add the published plugin entry point to the Babel configuration in that pipeline:

```json
{
  "plugins": ["@angular/compiler-cli/linker/babel"]
}
```

⚠️ The plugin's own options were not read for this topic — the entry point above is what the package
publishes; consult its `linker/babel` types before configuring anything beyond enabling it.

**Symptom: an *application* was built with `compilationMode: 'partial'` — usually because a tsconfig was copied from a library — and behaviour is subtly wrong or startup does unexpected work.** Cause: partial output is *"an intermediate form suitable for publication to NPM"*, not a deployable application; the default is `'full'` for a reason. Fix: remove the option from the application's tsconfig so it takes the default, and keep partial mode confined to the tsconfig the library builder uses:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
```

## Interview questions

**★ Why could a pre-Ivy Angular library not ship compiled factories to npm?**
Because the pre-Ivy compiler did whole-program analysis, and a whole-program result is only valid
for one fully resolved dependency graph. A library declares peer *ranges*, so it does not know what
it will run against — and the design doc says exactly this: npm packages *"cannot contain,
themselves, the generated factories … because if any of their dependencies change, their factories
would be invalid, preventing them from using version ranges in their dependencies."* The workaround
was to publish metadata and have every application recompile every library, which is why an Angular
build used to be as expensive as it was. Locality removed the whole-program dependency; partial
compilation then handled what remained, which is that the *emitted definition format itself* is
private and versioned.

**★ What is `compilationMode: 'partial'` for, and what does the consumer actually do with its output?**
It is for publication. Instead of emitting `ɵɵdefineComponent(...)`, the compiler emits
`ɵɵngDeclareComponent(...)` — the options doc calls it *"a stable, but intermediate form suitable
for publication to NPM"*. The published package therefore contains a description of the component
rather than a compiled definition, plus the normal `.d.ts` carrying the metadata a consumer's
type-checker needs. The consumer's build runs the Angular linker, published as a Babel plugin at
`@angular/compiler-cli/linker/babel`, which converts each declaration into a real definition at the
application's Angular version. The library is compiled once by its author and linked once per
consuming application — which is what makes "one library, many Angular versions" possible at all.

**The linker is a Babel plugin. What does that tell you about where it can and cannot run?**
It tells you it operates on **emitted JavaScript**, inside the consumer's bundling pipeline, rather
than on TypeScript inside a compiler pass. That is the only workable choice: the thing being linked
arrives from npm as JavaScript, with no sources and no TypeScript program to attach a transformer
to. It also means linking is something a build can simply *fail to do* — if a pipeline processes
Angular packages without that plugin, the `ɵɵngDeclare*` calls survive into the bundle unconverted.
And it explains why the conversion has to be doable from a plain data object: a Babel plugin has no
type checker, so everything the conversion needs must already be in the declaration.

**How is partial compilation the same mechanism as just-in-time compilation?**
Literally the same code path. `ɵɵngDeclareDirective` in `@angular/core` calls `getCompilerFacade`
with `usage: JitCompilerUsage.PartialDeclaration` and then
`compiler.compileDirectiveDeclaration(...)` — the JIT compiler, told it is finishing a partial
declaration rather than compiling a decorator. That is possible because of the design rule quoted in
[12](12-ivy-and-locality.md): *"Compilers will also not take Typescript nodes directly as input, but
will operate against information extracted from TS sources by the transformer. In addition to
helping enforce the rules above, this restriction also enables Compilers to run at runtime during
JIT mode."* One compiler with three entry points — build-time transformer, runtime decorator,
declaration linker — rather than three compilers.

**What have you deliberately not claimed about the linker, and why does that matter?**
The version-negotiation logic. A partial declaration carries a minimum-version marker, and how the
linker uses it — in particular what happens when a package was built by a *newer* Angular than the
consuming application — was not read while researching this topic, so this page says only that the
declaration is re-compiled at the application's version. It matters because that is exactly the
question someone debugging a cross-version library failure needs answered, and a confident guess
would be worse than a gap: it would send them looking for a configuration problem in the wrong
place. The correct next step is to read the linker's own sources under
`@angular/compiler-cli/linker`, not to infer from the entry-point list.

---

← Prev: [12e · What locality costs](12e-what-locality-costs.md) · Index: [Topic index](README.md) · Next → [12g · Version skew is a coded concern](12g-version-skew-is-a-coded-concern.md)
