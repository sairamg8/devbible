---
title: "`compilationMode` decides how much of your program the transformer is allowed to read, and `experimental-local` narrows that to a single file — which makes the same source, at the same Angular version, compile in one build configuration and fail in another"
sidebar_label: "13d · compilationMode and local mode"
sidebar_position: 13.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/api/src/public_options.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/directive/src/shared.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts);
> and angular.dev [Angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).
> Documentation-validated; **no sandbox run** — no build was executed in either mode and no output was compared.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A transformer can only read what is in the `ts.Program` it was handed. `compilationMode` is the option that decides how much of that program the Angular compiler is permitted to look at while compiling any one file, and it has three settings that are not variations on a theme — they are three different products. `full` is the default and reads the whole program. `partial` produces an intermediate form for publication and is the subject of the previous chunk. `experimental-local` compiles each file *without its dependencies*, which is a different compiler contract wearing the same option name, and it is the reason a codebase can compile perfectly for you and fail for a colleague on the same commit at the same Angular version.**

## The three modes, verbatim

`TargetOptions.compilationMode` in `public_options.ts`:

> *"Specifies the compilation mode to use. The following modes are available:"*
> *"- 'full': generates fully AOT compiled code using Ivy instructions."*
> *"- 'partial': generates code in a stable, but intermediate form suitable for publication to NPM."*
> *"- 'experimental-local': generates code based on each individual source file without using its dependencies. This mode is suitable only for fast edit/refresh during development. It will be eventually replaced by the value `local` once the feature is ready to be public."*
> *"The default value is 'full'."*

angular.dev documents only two of the three:

> *"`'full'` — Generates fully AOT-compiled code according to the version of Angular that is currently being used."*
> *"`'partial'` — Generates code in a stable, but intermediate form suitable for a published library."*

🔴 **The mode that changes what your source is allowed to contain is the one the public reference does not list.** If you are reading angular.dev to decide whether a construct is legal, you are reading about `full` — and `full` is the most permissive of the three.

## What each one is actually for

| mode | reads | produces | who runs it |
|---|---|---|---|
| `full` | the whole `ts.Program` | `ɵɵdefineComponent` and friends, final for this Angular version | the default, every ordinary `ng build` |
| `partial` | the whole `ts.Program` | `ɵɵngDeclareComponent` and friends, an intermediate form | a library build, before publishing to npm |
| `experimental-local` | **one file** | `ɵɵdefineComponent`, from that file alone | a fast development rebuild, and nothing else |

The two that are constantly confused are `partial` and `experimental-local`, because both sound like "less than full". They are unrelated:

- **`partial` narrows the output.** It reads everything, then declines to bake in decisions that depend on the Angular version, so a consumer's build can finish the job at their version. Its output is not runnable until the linker processes it. That is the whole of **[12 · Ivy and locality](12-ivy-and-locality.md)**.
- **`experimental-local` narrows the input.** It reads one file, then emits final, runnable code from it. Nothing further processes the output; the compromise is entirely on the analysis side.

## What "without using its dependencies" removes

[13](13-where-the-compiler-runs-ngtsc.md) established that a transformer cannot look outside the `ts.Program`. Local mode goes further and says the transformer may not look outside **this file**, even though the rest of the program is right there. The compilation unit shrinks from "everything the tsconfig included" to "the file being compiled".

The part of the compiler that notices first is the partial evaluator ([09c](09c-the-partial-evaluator-is-the-grammar.md)). Folding `const SELECTOR = 'app-invoice';` from a neighbouring module requires following an import and reading a declaration in another file — legal in `full`, out of reach in local mode by definition. The compiler does not fail silently; it has a dedicated assertion with a dedicated message, and `annotations/directive/src/shared.ts` calls it before the type check on `selector`:

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
```

Two error codes exist for exactly this, and unusually their numbers are stated inside their own doc comments in `error_code.ts`:

> `LOCAL_COMPILATION_UNRESOLVED_CONST = 11001` — *"In local compilation mode a const is required to be resolved statically but cannot be so since it is imported from a file outside of the compilation unit. This usually happens with const being used as Angular decorators parameters such as `@Component.template`, `@HostListener.eventName`, etc."*

> `LOCAL_COMPILATION_UNSUPPORTED_EXPRESSION = 11003` — *"In local compilation mode a certain expression or syntax is not supported. This is usually because the expression/syntax is not very common and so we did not add support for it yet."*

The full catalogue of what triggers them, with the message text for each, is [10d](10d-import-cycles-and-local-compilation.md). What belongs here is the *shape* of the failure rather than its individual instances.

## 🔴 The portability trap

Every other constraint in this topic is a property of your source. This one is not.

**The same file, at the same Angular version, with the same TypeScript, compiles under one build configuration and fails under another.** Local compilation mode is opt-in through `angularCompilerOptions`, so the two builds differ by a line of JSON that lives nowhere near the code that fails:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2022"
  },
  "angularCompilerOptions": {
    "strictTemplates": true,
    "compilationMode": "experimental-local"
  }
}
```

Note where that key sits. `compilationMode` is an **Angular** compiler option, so it belongs in `angularCompilerOptions`, beside `strictTemplates` — not in TypeScript's `compilerOptions`. angular.dev states the division plainly: *"The Angular Compiler is primarily configured through `tsconfig.json` while Angular CLI is primarily configured through `angular.json`."* Both blocks live in the same file, which is exactly why the mistake is easy.

**The trap has a direction, and the direction is the useful part.** Metadata that survives local compilation survives every mode, because local mode is strictly the smallest reading window. The converse does not hold. So:

- Code written and tested only in `full` may fail the moment anyone enables local mode — a colleague chasing rebuild speed, a monorepo's development configuration, a tool that turns it on for you.
- Code written to compile in local mode is portable everywhere with no further thought.

The habit that makes the question disappear is the one [09e](09e-selector-must-reduce-to-a-string.md) argues for from the other direction: **selectors and templates are literals in the decorator, always**, and anything you wanted to share lives outside the decorator — spread into the object literal, or moved to a class field where the compiler never evaluates it at all.

## Two options that name the compilation unit explicitly

Local mode is not an isolated switch; the compiler carries options that exist because of it.

**`onlyExplicitDeferDependencyImports`**, from `public_options.ts`, verbatim:

> *"Specifies whether Angular compiler should rely on explicit imports via `@Component.deferredImports` field for `@defer` blocks and generate dynamic imports only for types from that list. This flag is needed to enable stricter behavior internally to make sure that local compilation with specific internal configuration can support `@defer` blocks."*

Read that last clause: `@defer` chunk splitting works because the compiler can see which imports a component's template actually uses ([11](11-why-defer-can-split-a-bundle.md)), and *seeing which imports are used* is a whole-file-set operation. Under local compilation the compiler needs to be told explicitly, through `deferredImports`, which is what the option is for. The eight conditions that make a dependency deferrable in normal mode are [11b](11b-the-nine-conditions-and-the-barrel-trap.md).

**`forbidOrphanComponents`**, verbatim:

> *"Enables the runtime check to guard against rendering a component without first loading its NgModule. This check is only applied to the current compilation unit, i.e., a component imported from another library without option set will not issue error if rendered in orphan way."*

The phrase *"only applied to the current compilation unit"* is the compilation-unit boundary stated in an option's own documentation. A check the compiler cannot apply outside its unit is a check that stops at the edge of what the transformer may read — the same edge, described from the runtime's side.

## What this page does not claim

The doc's own scoping sentence is *"This mode is suitable only for fast edit/refresh during development."* That is a strong statement and it is where the evidence stops. **I did not determine which specific analyses degrade under local compilation beyond the partial evaluator's reach** — in particular, what happens to template type checking when the compiler cannot see the components a template references was not established from the sources read for this page. Do not infer a list; take the doc's restriction at face value and do not ship a production build from this mode.

## Gotchas

**★ Symptom: CI is red with NG11001 and your machine is green, on the same commit.** Cause: the two builds are not using the same `compilationMode`. It is opt-in per tsconfig, so a development configuration that enables it and a CI configuration that does not will disagree about code neither of them changed. Fix: compare the two `angularCompilerOptions` blocks before touching TypeScript, and reproduce locally by pointing the build at CI's tsconfig:

```bash
node -p "require('./tsconfig.json').angularCompilerOptions"
node -p "require('./tsconfig.app.json').angularCompilerOptions"
npx ng build --configuration production
```

**★ Symptom: a teammate turns on local mode "for build speed" and half the components stop compiling.** Cause: nothing is wrong with the components; the reading window shrank and every metadata constant that lived one import away is now outside the unit. Fix: make the metadata local rather than turning the mode back off, because the local-clean form works in every mode:

```ts
// ⛔ compiles under `full`, fails under `experimental-local`
import {INVOICE_SELECTOR} from './selectors';

@Component({
  selector: INVOICE_SELECTOR,
  template: `<span>{{ total }}</span>`,
})
export class InvoiceRowComponent {
  total = 0;
}
```

```ts
// ✅ compiles under every mode
@Component({
  selector: 'app-invoice-row',
  template: `<span>{{ total }}</span>`,
})
export class InvoiceRowComponent {
  total = 0;
}
```

**★ Symptom: `compilationMode` appears to do nothing.** Cause: it was put in `compilerOptions` instead of `angularCompilerOptions`. TypeScript does not know the key, Angular never sees it, and depending on your TypeScript settings you may not even get a warning. Fix: move it into the Angular block:

```json
{
  "compilerOptions": {
    "strict": true
  },
  "angularCompilerOptions": {
    "compilationMode": "experimental-local"
  }
}
```

**Symptom: `@defer` blocks stop producing separate chunks after enabling local mode.** Cause: deferrable-dependency detection needs to know which imported symbols a template uses, which is not a single-file question. The compiler carries `onlyExplicitDeferDependencyImports` precisely so that *"local compilation with specific internal configuration can support `@defer` blocks"*. Fix: name the deferred dependencies explicitly rather than relying on inference:

```ts
@Component({
  selector: 'app-dashboard',
  imports: [HeaderComponent],
  deferredImports: [HeavyChartComponent],
  template: `
    <app-header />
    @defer (on viewport) {
      <app-heavy-chart />
    } @placeholder {
      <div class="chart-skeleton"></div>
    }
  `,
})
export class DashboardComponent {}
```

**Symptom: a value moved "into the compilation unit" and NG11001 persists.** Cause: in local mode the compilation unit is the **file**, not the project, the directory or the library. A sibling module is outside it. Fix: inline the value into the decorator — the only placement that is unconditionally safe — or hold it in a class field, which the compiler never evaluates.

**Symptom: `experimental-local` disappears from a future tsconfig, or a colleague writes `compilationMode: "local"` and it is rejected.** Cause: the doc says the name is temporary — *"It will be eventually replaced by the value `local` once the feature is ready to be public."* At 22.1.5 the accepted value is still `experimental-local`. Fix: pin the exact string your compiler version accepts, and treat the option as a development-only setting that is checked whenever Angular moves:

```bash
node -p "require('@angular/compiler-cli/package.json').version"
```

## Interview questions

**★ What does `compilationMode: 'experimental-local'` change, and what does it not change?**
It shrinks the compilation unit to a single file: the compiler generates code *"based on each individual source file without using its dependencies"*. What changes is the compiler's reading window, which means the partial evaluator can no longer follow an import to fold a constant, so anything it would have resolved from another file becomes NG11001. What does not change is the shape of the output — it still emits `ɵɵdefineComponent` and friends, final and runnable, unlike `partial`. And nothing about your expressions changed either; a constant that was legal is still legal, it is just no longer reachable.

**★ Two developers, same commit, same Angular, same TypeScript. One build fails with NG11001. Where do you look first?**
At the tsconfig each build resolved, specifically the `angularCompilerOptions` block, and specifically `compilationMode`. It is the only setting in this topic that changes what your source is allowed to contain rather than what it means. Diffing source is wasted effort — the source is identical by construction. The second place to look is *which* tsconfig each build used, because `ng build` resolves it through `angular.json`'s target while a directly-invoked compiler uses whatever `-p` was given.

**★ `partial` and `experimental-local` both sound like "less than full". How are they actually different?**
They compromise on opposite sides. `partial` reads the whole program and narrows the *output* — it emits `ɵɵngDeclare*` calls rather than final definitions, so that a consumer's linker can finish the compilation at the consumer's Angular version. It is for publishing to npm and its output is not runnable as-is. `experimental-local` narrows the *input* — it reads one file — and emits final, runnable code. It is for rebuild speed during development and the documentation restricts it to that. Mixing them up leads to publishing an unlinkable library or shipping production code from a development-only mode.

**Why does local compilation need an option like `onlyExplicitDeferDependencyImports` at all?**
Because `@defer`'s chunk splitting depends on the compiler knowing which of a component's imported symbols are used only inside deferred blocks, and that is a question about the component's whole import graph. Under local compilation the compiler is not reading the dependencies, so it cannot infer the set. The option's own documentation says it exists *"to make sure that local compilation with specific internal configuration can support `@defer` blocks"* — the answer is to have the developer declare the deferrable dependencies in `deferredImports` rather than have the compiler deduce them.

**Is there a way to write Angular metadata that is safe in every compilation mode, and what is the cost?**
Yes: keep everything the compiler evaluates as a literal inside the decorator. Selectors, templates, host-listener event names — all literals, none of them imported. Metadata written to survive local compilation survives every other mode, and the reverse does not hold, so this is a strictly stronger habit at no build-time cost. The price is expressive: you cannot share a selector constant across components, and you lose the refactoring convenience of a single named string. Anything you genuinely want to share moves out of the decorator entirely — into a class field the compiler never evaluates, or spread into the object literal so the compiler still sees the resulting properties.

---

← Prev: [13c · The NG code is a TS code](13c-the-ng-error-code-is-a-typescript-code.md) · Index: [Topic index](README.md) · Next → [The option surface and the diagnostics raised before compilation](13e-the-option-surface-and-config-time-diagnostics.md)
