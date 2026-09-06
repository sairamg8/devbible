---
title: "Before it compiles anything the Angular compiler validates its own configuration and can fail with six NG4xxx codes that name no file of yours — and the option list on angular.dev still documents eight options that do not exist in v22, which is why the golden API file, not the reference page, is the authority"
sidebar_label: "13e · The option surface"
sidebar_position: 13.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts) (`verifyCompatibleTypeCheckOptions`, `verifyEmitDeclarationOnly`),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts),
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts),
> [`goldens/public-api/compiler-cli/compiler_options.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/compiler-cli/compiler_options.api.md);
> and angular.dev [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options), ⚠️ whose option list is stale and is corrected below.
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured from a terminal.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Because `ngtsc` runs inside `tsc`, its configuration lives inside `tsc`'s configuration file — a second top-level block called `angularCompilerOptions`, sitting beside TypeScript's own `compilerOptions` in the same `tsconfig.json`. The compiler checks that block for internal contradictions *before* it analyses a single decorator, and can fail the build with an error that names no file, no line and no symbol of yours. There are six such codes. Separately, and more quietly, angular.dev's reference page for that block still documents eight options the v22 compiler does not have, which means the page can tell you to configure something that will be read by nobody.**

## Two blocks, one file, two owners

angular.dev states the division:

> *"The `ngc` command is a wrapper around TypeScript's `tsc` compiler command. The Angular Compiler is primarily configured through `tsconfig.json` while Angular CLI is primarily configured through `angular.json`."*

So a real project has three places configuration can live and they are not interchangeable:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2022",
    "moduleResolution": "bundler"
  },
  "angularCompilerOptions": {
    "strictTemplates": true,
    "typeCheckHostBindings": true,
    "extendedDiagnostics": {
      "defaultCategory": "error"
    }
  }
}
```

`compilerOptions` is TypeScript's and TypeScript validates it. `angularCompilerOptions` is Angular's and **Angular** validates it. `angular.json` is the CLI's, and it selects which tsconfig each target uses — which is why "the same project" can be compiled with two different Angular option sets depending on whether you ran `ng build`, `ng test` or `ngc -p`.

## The compiler validates its configuration before it compiles

Two methods on `NgCompiler` run these checks: `verifyCompatibleTypeCheckOptions` and `verifyEmitDeclarationOnly`. The full family, from `error_code.ts`:

| code | enum member |
|---|---|
| NG4001 | `CONFIG_FLAT_MODULE_NO_INDEX` |
| NG4002 | `CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK` |
| NG4003 | `CONFIG_EXTENDED_DIAGNOSTICS_IMPLIES_STRICT_TEMPLATES` |
| NG4004 | `CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CATEGORY_LABEL` |
| NG4005 | `CONFIG_EXTENDED_DIAGNOSTICS_UNKNOWN_CHECK` |
| NG4006 | `CONFIG_EMIT_DECLARATION_ONLY_UNSUPPORTED` |

The message texts, verbatim from `compiler.ts`. The first is by far the most commonly hit, and matching it to NG4003 is by enum name:

```text
Angular compiler option "extendedDiagnostics" is configured, however "strictTemplates" is disabled.

Using "extendedDiagnostics" requires that "strictTemplates" is also enabled.

One of the following actions is required:
1. Remove "strictTemplates: false" to enable it.
2. Remove "extendedDiagnostics" configuration to disable them.
```

```text
Angular compiler option "extendedDiagnostics.defaultCategory" has an unknown diagnostic category: "<value>".

Allowed diagnostic categories are:
<list>
```

and the third, as it appears in the source:

```ts
messageText: 'TS compiler option "emitDeclarationOnly" is not supported.',
```

Two things about that family are worth carrying away.

**These fire before analysis.** They are not the compiler telling you a component is wrong; they are the compiler telling you it cannot start. If a build fails with a code in the NG40xx range and no file location, stop reading the source and open the tsconfig the build resolved.

**NG4002 names an option that is no longer public.** `CONFIG_STRICT_TEMPLATES_IMPLIES_FULL_TEMPLATE_TYPECHECK` refers to `fullTemplateTypeCheck`, which is not among the five `LegacyNgcOptions` members in the v22 golden and is named only by a stale code comment in `compiler.ts`. ⚠️ Whether that diagnostic can still be produced at 22.1.5 was not determined here; treat the code as documented-but-probably-unreachable rather than as a check you can rely on.

## Why `emitDeclarationOnly` is rejected rather than accommodated

This one is legible directly from [13](13-where-the-compiler-runs-ngtsc.md). `prepareEmit` returns two transformer arrays: `before`, which produces the JavaScript, and `afterDeclarations`, which produces the `.d.ts`. Angular's `ivyTransformFactory` — the transformer that adds `ɵcmp`, `ɵfac` and the rest — is in `before`. `emitDeclarationOnly` asks TypeScript to skip the JavaScript emit entirely, which is the emit Angular's class-defining work rides on.

⚠️ **The source states the diagnostic, not the reason.** The paragraph above is an inference from the transformer split, offered because it makes the diagnostic legible; it is not quoted from the compiler. What is quoted is the refusal, and the refusal is absolute — there is no option to soften it.

The practical shape of the mistake is a library tsconfig written for a types-only package and then reused:

```json
{
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": true
  }
}
```

The fix is to emit both, which is what any Angular library needs anyway:

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "outDir": "dist/ui-kit"
  },
  "angularCompilerOptions": {
    "compilationMode": "partial",
    "strictTemplates": true
  }
}
```

## 🔴 angular.dev's option list is stale, and here is the authority instead

`reference/configs/angular-compiler-options.md` still documents eight options that are **not in the v22 public option surface** as recorded by `goldens/public-api/compiler-cli/compiler_options.api.md`:

`annotationsAs` · `disableExpressionLowering` · `enableResourceInlining` · `enableLegacyTemplate` · `generateCodeForLibraries` · `skipMetadataEmit` · `skipTemplateCodegen` · `strictMetadataEmit`

Every one of them belongs to the pre-Ivy compiler — the metadata collector, `.metadata.json`, code folding, the world the AOT guide still describes. Setting any of them in a v22 project does nothing. It also fails silently: an unrecognised key inside `angularCompilerOptions` is not a TypeScript error, because TypeScript does not own that block.

The `LegacyNgcOptions` that **do** survive at `v22.1.5` are five:

| option | note |
|---|---|
| `allowEmptyCodegenFiles` | deprecated — *"This option is not used anymore."* |
| `flatModuleId` | flat-module output |
| `flatModuleOutFile` | flat-module output; NG4001 fires if the index cannot be determined |
| `preserveWhitespaces` | template whitespace handling |
| `strictInjectionParameters` | see below |

`strictInjectionParameters`, verbatim from `public_options.ts`:

> *"Always report errors a parameter is supplied whose injection type cannot be determined. When this value option is not provided or is `false`, constructor parameters of classes marked with `@Injectable` whose type cannot be resolved will produce a warning. With this option `true`, they produce an error."*

angular.dev adds: > *"For library projects created with the Angular CLI, the development configuration default is `true`."*

Two `MiscOptions` are worth knowing by name because their behaviour is surprising if you meet it cold:

> **`compileNonExportedClasses`** — *"Whether the compiler should avoid generating code for classes that haven't been exported. Defaults to `true`."*

🔴 **Read that doc comment against the option's own name and they point opposite ways.** The name says "compile non-exported classes"; the sentence says the option controls whether the compiler should *avoid* generating code for them. Both cannot be true of a default of `true`. **I could not settle which reading is correct from the sources read for this page** — the doc comment is the only description of the option and it is self-contradictory in context. Do not set this option on the strength of either reading.

> **`forbidOrphanComponents`** — *"Enables the runtime check to guard against rendering a component without first loading its NgModule. This check is only applied to the current compilation unit, i.e., a component imported from another library without option set will not issue error if rendered in orphan way."*

That second one is the compilation-unit boundary again, stated in an option's own documentation — see [13d](13d-compilation-mode-and-the-local-portability-trap.md) for what the unit is and how it shrinks.

🔴 **The rule to carry: when angular.dev and the compiler disagree about whether an option exists, the golden wins.** `goldens/public-api/compiler-cli/compiler_options.api.md` is generated from the compiler's own public API and is checked in CI against the source; the reference page is prose maintained by hand. Read the golden at the tag you are actually on. The same principle settles the `strictTemplates` default, which is **[14 · Template type checking](14-template-type-checking.md)**, and the extended-diagnostics roster, which is **15 · Extended diagnostics** *(not written yet)*.

## Gotchas

**★ Symptom: the build fails with a message about `extendedDiagnostics` and `strictTemplates` and no file location at all.** Cause: NG4003 — you configured `extendedDiagnostics` while `strictTemplates` is explicitly `false`, and the compiler refuses to start because the extended checks are built on the strict type-check infrastructure. The error text names both fixes itself. Fix: pick one, and prefer the first:

```json
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "extendedDiagnostics": {
      "defaultCategory": "warning"
    }
  }
}
```

**★ Symptom: an option copied out of a blog post or an old project has no effect whatsoever — no error, no warning, no behaviour change.** Cause: it is one of the eight pre-Ivy options angular.dev still documents, or a typo. `angularCompilerOptions` is Angular's block, so TypeScript will not flag an unknown key in it, and the compiler ignores what it does not recognise. Fix: verify the key exists at your version against the golden rather than against the reference page:

```bash
# 1. the exact compiler version this project resolves
node -p "require('@angular/compiler-cli/package.json').version"

# 2. does the key survive a round-trip through the compiler's own option reader?
node -p "Object.keys(require('./tsconfig.json').angularCompilerOptions).join('\n')"
```

Then open `goldens/public-api/compiler-cli/compiler_options.api.md` **at the tag printed by step 1** on GitHub and search for the key. If it is not in the golden, the compiler has no field to read it into.

**★ Symptom: a library build fails with `TS compiler option "emitDeclarationOnly" is not supported.`** Cause: NG4006. Angular's class-defining transformer lives in the `before` array, which runs on the JavaScript emit path; `emitDeclarationOnly` removes that path. Fix: emit both outputs — remove the flag and give the build an `outDir`:

```json
{
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": false,
    "outDir": "dist/ui-kit"
  }
}
```

**Symptom: `extendedDiagnostics.defaultCategory` is rejected with `has an unknown diagnostic category`.** Cause: NG4004 — the value is not one of the categories the compiler accepts, and the error prints the allowed list for you. Fix: use one of the printed values; the common mistake is a TypeScript-style category name or a capitalised one:

```json
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "extendedDiagnostics": {
      "defaultCategory": "error",
      "checks": {
        "nullishCoalescingNotNullable": "warning"
      }
    }
  }
}
```

**Symptom: an option works in `ng build` and not in `ng test`, or vice versa.** Cause: they resolve different tsconfigs through `angular.json`, and `angularCompilerOptions` is per-tsconfig. A setting added to `tsconfig.app.json` is invisible to a test target pointing at `tsconfig.spec.json`. Fix: put shared Angular options in the base `tsconfig.json` and let the target configs extend it, then confirm which file each target actually uses:

```bash
node -p "JSON.stringify(require('./angular.json').projects['my-app'].architect, null, 2)" | grep tsConfig
```

**Symptom: an unexported component compiles into nothing and there is no error anywhere.** Cause: `compileNonExportedClasses` is in play. ⚠️ Its doc comment and its name disagree about which value does what, as noted above, so this page will not tell you which setting produces the symptom — what it will tell you is that the option exists, that it is about exported-ness rather than about your code, and that the symptom is silent by construction because a class with no definition is still valid JavaScript. Fix: remove the option entirely and export the class, which is correct under either reading:

```ts
// ⛔ exported-ness is load-bearing for this option, and the option's own
//    documentation is ambiguous. Do not rely on either behaviour.
@Component({selector: 'app-badge', template: `<span class="badge"></span>`})
class BadgeComponent {}

// ✅ unambiguous under every setting
@Component({selector: 'app-badge', template: `<span class="badge"></span>`})
export class BadgeComponent {}
```

**Symptom: a flat-module library build fails with NG4001 and no component is at fault.** Cause: `CONFIG_FLAT_MODULE_NO_INDEX` — `flatModuleOutFile` was set but the compiler could not determine which file is the module's index. Fix: give the compilation exactly one entry file, and name it, rather than letting the tsconfig include a directory:

```json
{
  "files": ["src/public-api.ts"],
  "angularCompilerOptions": {
    "flatModuleOutFile": "ui-kit.js",
    "flatModuleId": "@acme/ui-kit"
  }
}
```

## Interview questions

**★ Why does Angular have a second options block in `tsconfig.json` rather than using `compilerOptions`?**
Because `compilerOptions` is TypeScript's schema and TypeScript validates it — an unknown key there is an error. Angular's options are not TypeScript's, and `ngtsc` is a guest inside `tsc`, so they live in a sibling top-level key that TypeScript passes through untouched. The consequence is asymmetric validation: a typo in `compilerOptions` is caught immediately, and a typo in `angularCompilerOptions` is caught by whatever checks Angular chooses to run. Angular runs six config checks, all in the NG40xx range, and everything else it does not recognise is silently ignored.

**★ A build fails with an error whose text mentions no file, no line and no symbol. What class of error is that and where do you look?**
Almost certainly a configuration diagnostic in the NG4001–NG4006 range, raised by `verifyCompatibleTypeCheckOptions` or `verifyEmitDeclarationOnly` before analysis begins. There is nothing to fix in the source. The place to look is the `angularCompilerOptions` block of the tsconfig that *this* build resolved, which is not necessarily the one at the repository root — `angular.json` selects it per target, so `ng build` and `ng test` can be reading different files.

**★ angular.dev documents an option and your build ignores it. Who is wrong?**
The page. `goldens/public-api/compiler-cli/compiler_options.api.md` is generated from the compiler's public API and enforced in CI; the reference page is hand-maintained prose. At `v22.1.5` the page still documents eight pre-Ivy options — `annotationsAs`, `disableExpressionLowering`, `enableResourceInlining`, `enableLegacyTemplate`, `generateCodeForLibraries`, `skipMetadataEmit`, `skipTemplateCodegen`, `strictMetadataEmit` — none of which is in the golden. They belong to the ViewEngine metadata pipeline that Ivy removed. Setting one costs you nothing and buys you nothing, which is the worst possible failure mode because there is no signal at all.

**Why can Angular not support `emitDeclarationOnly`?**
Because the transformer that adds `ɵcmp`, `ɵdir`, `ɵpipe` and `ɵfac` is in the `before` array, which TypeScript runs on the path to the JavaScript emit. `emitDeclarationOnly` removes that path. The `afterDeclarations` transformer that writes `ɵɵComponentDeclaration` into the `.d.ts` would still run, so you would get type declarations describing definitions that were never generated. The compiler refuses rather than emitting that inconsistency, with `CONFIG_EMIT_DECLARATION_ONLY_UNSUPPORTED`. Note that the source states the refusal and not the reason — the reasoning here is read off the transformer split, not quoted.

**What does `strictInjectionParameters` change, and why is it a legacy option?**
It promotes a warning to an error: with it off, a constructor parameter of an `@Injectable` class whose injection type cannot be resolved produces a warning; with it on, it produces an error. It is classified under `LegacyNgcOptions` because it dates from the era when unresolvable DI was survivable, and it is one of only five legacy options still in the v22 surface. angular.dev notes that CLI-generated library projects default it to `true` in the development configuration, which means a library author has usually been running with it on without ever setting it.

**Why does `forbidOrphanComponents` say the check is "only applied to the current compilation unit"?**
Because a compiler cannot check something it is not compiling. A component that arrives from a published library was compiled by somebody else's build, with somebody else's options, and this build never sees its source. The sentence is the compilation-unit boundary showing through an option's documentation — the same boundary that makes local compilation mode a portability trap and that makes NG3003 import cycles a question about which files are in the program rather than about your code.

---

← Prev: [13d · `compilationMode` and local mode](13d-compilation-mode-and-the-local-portability-trap.md) · Index: [Topic index](README.md) · Next → **[14 · Template type checking](14-template-type-checking.md)**
