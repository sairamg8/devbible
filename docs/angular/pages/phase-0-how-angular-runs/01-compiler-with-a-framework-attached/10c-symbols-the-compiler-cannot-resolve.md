---
title: "Three different failures look like \"the compiler cannot see my symbol\" and have three unrelated fixes — the declaration was never found, the declaration was found but lives in a `.d.ts`, or the declaration was found and the compiler could not write an import to it"
sidebar_label: "10c · Symbols it cannot resolve"
sidebar_position: 10.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/dynamic.ts),
> [`packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/partial_evaluator/src/diagnostics.ts),
> [`packages/compiler-cli/src/ngtsc/imports/src/emitter.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/imports/src/emitter.ts),
> [`packages/compiler-cli/src/ngtsc/entry_point/src/private_export_checker.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/entry_point/src/private_export_checker.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts);
> and the `angular/angular` [CHANGELOG](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) at 22.1.4.
> Documentation-validated; **no sandbox run** — every message below is a string literal read from one of those files.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
>
> † on a code number means: the enum name is verbatim from source, **the number is not** — it comes from research prose rather than a line of `error_code.ts`. Match on the message text.

**"The compiler cannot find my symbol" is not one problem. It is three, they produce three different trace strings, and the fix for each is useless against the other two. Either the identifier had no declaration anywhere in the program (`Unknown reference.`), or it had one but the declaration is a `.d.ts` with no body behind it (`… as it is an external declaration.`), or the value resolved perfectly and the compiler then failed at a completely later stage, when it tried to *write an import* to the thing it had resolved (`Unable to import class Foo.`). The last of those is the one people call "everything must be exported", and that description has been wrong for a while.**

## `Unknown reference.` — the declaration was never found

**Symptom.** A headline such as `selector must be a string`, then `Value could not be determined statically.`, then a related-information note reading exactly `Unknown reference.`

**Cause.** `UNKNOWN_IDENTIFIER`, whose doc comment in `partial_evaluator/src/dynamic.ts` is a single sentence, verbatim:

> *"A declaration of a `ts.Identifier` could not be found."*

The evaluator resolved the identifier's *symbol* through the TypeScript checker and got nothing it could walk to. In an application this almost always means one of three things: the name is a global with no declaration inside the `ts.Program`; the file that declares it is excluded by `tsconfig.json`'s `files` / `include` / `exclude`, so it is not in the program at all; or the name exists only in type space and there is no value behind it.

🔴 **The third one is the trap, because your editor is happy.** A name declared with `declare` in a `.d.ts` that your editor picks up through `typeRoots` but your `tsconfig.app.json` does not include is fully typed and completely invisible to the compiler.

**Fix.** Put a real value declaration into the program and import it.

```ts
// src/app/card-config.ts — a real module, inside the program.
export const CARD_SELECTOR = 'app-user-card';
```

```ts
// src/app/user-card.ts
import {Component} from '@angular/core';
import {CARD_SELECTOR} from './card-config';

@Component({
  selector: CARD_SELECTOR,
  template: `<h2 class="name">{{ name }}</h2>`,
})
export class UserCard {
  protected readonly name = 'Ada';
}
```

If you *thought* the file was in the program, check `tsconfig.app.json` rather than the code — an `include` of `["src/**/*.ts"]` with the constant living in a sibling `config/` directory produces exactly this error and nothing else.

## `… as it is an external declaration.` — the body is not in your program

**Symptom.** The trace note `A value for 'NAME' cannot be determined statically, as it is an external declaration.`, with the real identifier in place of `NAME` — or `an anonymous declaration` when the node has no name.

**Cause.** `EXTERNAL_REFERENCE`, doc comment verbatim:

> *"An external reference could not be resolved to a value which can be evaluated. For example a call expression for a function declared in `.d.ts`, or accessing native globals such as `window`."*

Read that carefully, because it names the two cases and they feel very different from each other. Reaching for `window`, `document`, `globalThis` or `process` in metadata is obviously build-time nonsense. But **calling a function that lives in a compiled package is the same error**, and it does not feel like nonsense at all.

🔴 **This is the failure that appears when you move a helper into a library.** A single-return helper in your own source folds — the partial evaluator reads the body and inlines the result (chunk 09, and **10g · Calls, enums and the values in between** *(not written yet)* for the single-return rule). Publish that helper in a package and the package ships a `.d.ts` declaring `export declare function buildSelector(name: string): string;` with no body anywhere the compiler can reach. Same call, same arguments, same result at runtime, and now a build error — because the *body* moved out of the program even though the *name* did not.

**Fix.** The value has to be computable inside the compilation. Either keep the helper in application source, or publish the computed constant rather than the function that computes it.

```ts
// ⛔ node_modules/@acme/tokens/index.d.ts ships only this:
//    export declare function buildSelector(prefix: string): string;
//    → `A value for 'buildSelector' cannot be determined statically, as it is
//       an external declaration.`

// ✅ publish the answers, not the machine that makes them.
// node_modules/@acme/tokens/index.d.ts:
//    export declare const CARD_SELECTOR: 'acme-card';
```

```ts
import {Component} from '@angular/core';
import {CARD_SELECTOR} from '@acme/tokens';

@Component({
  selector: CARD_SELECTOR,
  template: `<ng-content />`,
})
export class AcmeCard {}
```

⚠️ **The published constant must have a literal type, not `string`.** `export declare const CARD_SELECTOR: string;` resolves to a `Reference`, not a value, and you get `Value is a reference to 'CARD_SELECTOR'.` instead — a different error with a different fix, covered in [10e](10e-values-that-resolve-but-do-not-fold.md). The `as const` on the library side is load-bearing.

## `Unable to import class Foo.` — the value was fine, the import was not

**Symptom.** `Unable to import class UserCard.`, with a nested second sentence explaining the attempt, and a related-information note `The class is declared here.` No `Value could not be determined statically.` anywhere — because nothing failed to evaluate.

**Cause.** `IMPORT_GENERATION_FAILURE` (NG3004†). This fires much later than the evaluator. The compiler has your class, has decided the generated code in *some other file* must refer to it, and cannot write an import statement that reaches it. From `imports/src/emitter.ts`, verbatim:

```ts
const message = makeDiagnosticChain(
  `Unable to import ${typeKind} ${nodeNameForError(result.ref.node)}.`,
  [makeDiagnosticChain(result.reason)],
);
throw new FatalDiagnosticError(ErrorCode.IMPORT_GENERATION_FAILURE, origin, message, [
  makeRelatedInformation(result.ref.node, `The ${typeKind} is declared here.`),
]);
```

The doc comment above the emitter strategy explains why it takes several attempts before giving up — verbatim:

> *"There are many potential ways a given `Reference` could be referred to in the context of a given file. A local declaration could be available, the `Reference` could be importable via a relative import within the project, or an absolute import into `node_modules` might be necessary."*

So the error means *all* of those failed, and `result.reason` — the nested sentence — is the one piece of the message that tells you which situation you are in. **Read the nested sentence, not the headline.**

**Fix.** Give the class a reachable name: export it from its file.

```ts
// src/app/shared/icon-button.ts

// ⛔ nothing outside this file can name it, so nothing outside this file can import it.
// @Directive({selector: '[appIconButton]'})
// class IconButton {}

// ✅
import {Directive} from '@angular/core';

@Directive({
  selector: '[appIconButton]',
  host: {'class': 'icon-button', 'type': 'button'},
})
export class IconButton {}
```

## 🔴 "Everything must be exported" is no longer the rule

That folk rule is a summary of the error above, and it over-generalises in a way that matters. `MiscOptions` in the compiler options surface carries a flag whose doc comment reads, verbatim:

> *"Whether the compiler should avoid generating code for classes that haven't been exported. Defaults to `true`."*

⚠️ **The option's name and that sentence point in opposite directions** — `compileNonExportedClasses` reads as "do compile them", the sentence reads as "avoid generating code for them", and the excerpt available to this page does not settle which sense `true` carries. **I am not going to guess.** What *is* settled is the v22.1.4 CHANGELOG line for the language service, verbatim: *"compile non-exported classes if standalone"* (commit `7f0265e43a`).

The accurate statement of the surviving rule is narrower and more useful than "export everything":

**A class must be reachable by an import from the file that will refer to it.** If nothing outside its own file ever refers to it, export-ness is not the compiler's business. The classic case is a directive used only by components declared in the same file — no cross-file reference is generated, so no import needs writing, so nothing fails. The classic *counter*-case is a component listed in another component's `imports` array: that generates a reference from a second file, and the import has to be writable.

## `Unsupported private class Foo.` — the library-only variant

**Symptom.** `Unsupported private class UserCard. This class is visible to consumers via NgModule exports, but is not exported from the top-level library entrypoint.` Only when building a **library**, never in an application.

**Cause.** `SYMBOL_NOT_EXPORTED` (NG3001†), from `entry_point/src/private_export_checker.ts`, verbatim:

```ts
messageText: `Unsupported private ${descriptor} ${name}. This ${descriptor} is visible to consumers via ${visibleVia}, but is not exported from the top-level library entrypoint.`,
```

`visibleVia` is either the literal string `NgModule exports` or a path through the reference graph rendered as `A -> B -> C`. That path is the whole value of the message: it tells you *by which chain* a consumer can end up holding your private type, which is usually a chain you did not know existed.

**Fix.** Re-export from the entry point — the file `package.json`'s `exports` map points at, conventionally `public-api.ts`:

```ts
// projects/acme-ui/src/public-api.ts
export {AcmeCard} from './lib/acme-card';
export {IconButton} from './lib/icon-button';
export {ACME_THEME} from './lib/theme-token';
```

## The same code, a third meaning: input transforms

**Symptom.** `Symbol must be exported in order to be used as the type of an Input transform function`, with `The symbol is declared here.` underneath.

**Cause.** The same `ErrorCode.SYMBOL_NOT_EXPORTED` reused for something quite different, from `annotations/directive/src/shared.ts`, verbatim:

```ts
throw new FatalDiagnosticError(
  ErrorCode.SYMBOL_NOT_EXPORTED,
  type,
  `Symbol must be exported in order to be used as the type of an Input transform function`,
  [makeRelatedInformation(declaration.node, `The symbol is declared here.`)],
);
```

The reason is that a transform's *parameter type* is written into the emitted `.d.ts` as the input's accepted type, so a downstream compilation has to be able to name it. An unexported local type has no name a consumer can write.

**Fix.** Export the type the transform accepts.

```ts
import {Directive, Input} from '@angular/core';

// ⛔ `type Density = 'compact' | 'cosy';`  — unexported, so the emitted .d.ts cannot name it.
// ✅
export type Density = 'compact' | 'cosy';

function toDensity(value: Density | ''): Density {
  return value === '' ? 'compact' : value;
}

@Directive({
  selector: '[appDensity]',
  host: {'[attr.data-density]': 'density'},
})
export class DensityDirective {
  @Input({transform: toDensity})
  density: Density = 'cosy';
}
```

## Gotchas

**★ Symptom: a helper that folded fine in `src/` starts failing the moment you extract it into a shared library.** Cause: the library ships a `.d.ts` with a declaration and no body, so the call becomes an `EXTERNAL_REFERENCE` — `A value for 'NAME' cannot be determined statically, as it is an external declaration.` Fix: publish the value instead of the function, with a literal type so it folds rather than resolving to a `Reference`:

```ts
// projects/acme-tokens/src/public-api.ts — publish answers, not machinery.
export const CARD_SELECTOR = 'acme-card' as const;
export const PANEL_SELECTOR = 'acme-panel' as const;
```

**★ Symptom: `Unable to import class X.` on a class you can see, in a file you can open, with no evaluation error anywhere.** Cause: this is not an evaluator failure at all — the value resolved and the *import writer* failed. It fires when a reference must cross a file boundary and no strategy could produce a specifier. Fix: export the class. And read the nested second sentence, which is `result.reason` and is the only part of the diagnostic that says which attempt failed.

**★ Symptom: `Unknown reference.` on a constant your editor autocompletes and type-checks.** Cause: your editor's program and your build's program are not the same set of files. The editor may be using the root `tsconfig.json` while `ng build` uses `tsconfig.app.json` with a narrower `include`. Fix: check the build config, not the code:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {"outDir": "./out-tsc/app"},
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts", "src/**/*.ts", "config/**/*.ts"]
}
```

**Symptom: NG3001† on a library build, naming a class you deliberately kept internal.** Cause: it is not internal — the checker found a reference path from your public surface to it, and the `A -> B -> C` fragment in the message is that path. Fix: either export it (accepting it as public API) or break the path so the public type no longer mentions it. Do not silence it; a consumer really can reach the type and really cannot name it.

**Symptom: an unexported directive works fine for months, then errors the day someone adds it to another component's `imports`.** Cause: the rule is about cross-file *references*, not about export-ness in general. Until that day nothing outside its file referred to it, so no import ever needed writing. Fix: export it — and understand that the edit that broke it is in the *other* file, which is why the blame looks wrong in version control.

**Symptom: you add `compileNonExportedClasses` to `angularCompilerOptions` expecting the export errors to stop, and nothing changes.** Cause: the flag lives in `MiscOptions`, its doc comment and its name describe opposite behaviours, and the change it is associated with at v22.1.4 is a **language-service** fix — CHANGELOG, verbatim: *"compile non-exported classes if standalone"*. Fix: treat it as unsettled and solve the actual problem, which is export-ness of the referenced class. This page does not claim to know what the flag does at build time, and neither should a decision you ship.

**Symptom: `Value is of type '(module)'.` when you meant to reference a value from a barrel.** Cause: `import * as tokens from './tokens'` gives a `ResolvedModule`, which `describeResolvedType` renders as `(module)`. Fix: dereference it — `tokens.CARD_SELECTOR` — or import the binding by name. The namespace object itself is never a valid metadata value.

**Symptom: an input transform errors about exports while the input itself is fine.** Cause: the transform's parameter type is written into the emitted `.d.ts` as the input's accepted type, so it must be nameable downstream — a stricter requirement than the class's own. Fix: export the type, as shown above. Widening the parameter to `unknown` also silences it, and is the wrong fix: it removes the type from your published API rather than publishing it.

## Interview questions

**★ Three different Angular errors all mean roughly "I cannot find your symbol". Distinguish them.**
`Unknown reference.` means the identifier had no declaration in the `ts.Program` — usually a file excluded by the build's `tsconfig`, or a global. `A value for 'X' cannot be determined statically, as it is an external declaration.` means the declaration was found and is a `.d.ts` with no body, which covers both `window` and every function you import from a compiled package. `Unable to import class X.` means the value resolved fine and the compiler then failed to write an import statement to it from another file. The first is a program-membership problem, the second is a where-does-the-body-live problem, and the third is a visibility problem. Applying the fix for any one of them to either of the others does nothing.

**★ A single-return helper folds in application source and breaks when published in a library. Why, and what would you publish instead?**
Because the partial evaluator folds a function call by reading the function's body, and a published package ships a type declaration with no body. In application source the body is a node in the program; in `node_modules` it is compiled JavaScript the compiler never parses for this purpose, with only a `.d.ts` alongside. The fix is to publish the computed value rather than the computation — `export const CARD_SELECTOR = 'acme-card' as const;` — and the `as const` matters, because a declared `string` type resolves to a `Reference` rather than a value and fails one step later with a different message.

**★ Is "every class Angular touches must be exported" true?**
Not as stated. The real rule is that a class must be reachable by a written import *from the file that will refer to it*, and the compiler only writes such an import when the generated code in one file has to name a class in another. A directive used only within its own file never triggers it. That is also why the error can appear on a file you did not edit: adding a component to a second component's `imports` array is what creates the cross-file reference. And as of v22.1.4 the language service explicitly compiles non-exported standalone classes, so even the tooling no longer treats export-ness as the gate.

**Why does an input `transform` function's parameter type have to be exported when a private helper type elsewhere in the class does not?**
Because the parameter type becomes part of the component's published API. The compiler writes the transform's accepted type into the emitted `.d.ts` so that a downstream template type-check knows what may be bound to that input. A type that is not exported has no name a consumer's compilation can write, so the declaration would be unwritable. Nothing else in the class body is published that way, which is why the constraint looks arbitrary until you know where the type ends up.

**A library build reports `Unsupported private class Foo … visible to consumers via A -> B -> C`. What is that arrow chain and why is it the most useful part of the message?**
It is the path through the reference graph by which a consumer of your public entry point can end up holding the private type — for example, a public component whose public input takes a type whose property is `Foo`. It is the useful part because the error is almost never about the class you named it on; it is about a leak somewhere up that chain. Reading it tells you whether the correct fix is to export `Foo` (it really is public API and you had not noticed) or to change a type partway along the chain so the leak closes.

---

← Prev: [10b · The decorator argument itself](10b-the-decorator-argument-itself.md) · Index: [Topic index](README.md) · Next → [Import cycles and local compilation](10d-import-cycles-and-local-compilation.md)
