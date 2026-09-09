---
title: "The other three Known Issues are all about visibility — a warning that only fires in CI, worker code that is compiled but never type-checked, and an esbuild error that blames your browser targets when the real cause is Zone.js"
sidebar_label: "09b · What the build stops telling you"
sidebar_position: 9.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the Known Issues section of
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)
> and [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build), quoted verbatim, plus
> [`packages/angular/build/src/tools/esbuild/commonjs-checker.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/commonjs-checker.ts)
> and `execute-build.ts` at tag `v22.1.7`.
> Documentation-validated; **no sandbox run** — any warning block below is quoted from angular.dev,
> not produced here.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These three do not change what your code has to be; they change what the build will tell you about
it.** One check is silently conditional on optimization, so it only ever fires in CI. One category of
file is compiled without being type-checked, so its errors survive into the browser. And one genuine
error arrives with a misleading explanation, which the CLI corrects by appending a note — a detail
worth knowing because the surface message sends you to the wrong fix. The three that concern your
code and its output are [09 · What breaks when you switch](09-what-breaks-when-you-switch.md).

## 4 · Web workers are compiled but not type-checked

> *"Web Workers can be used within application code using the same syntax (`new Worker(new
> URL('<workerfile>', import.meta.url))`) that is supported with the `browser` builder. However, the
> code within the Worker will not currently be type-checked by the TypeScript compiler. TypeScript
> code is supported just not type-checked. Additionally, any nested workers will not be processed by
> the build system. A nested worker is a Worker instantiation within another Worker file."*

Two separate limitations in one paragraph. **Type errors inside a worker file do not fail the
build** — the code compiles and ships. And **a worker instantiated from inside another worker is not
processed at all**, which is a build-time omission rather than a type-checking one.

If workers carry real logic, type-check them out of band rather than trusting the build:

```bash
npx tsc --noEmit -p tsconfig.worker.json
```

## 5 · The CommonJS warning that only appears in CI

> *"Angular CLI outputs warnings if it detects that your browser application depends on CommonJS
> modules. When you encounter a CommonJS dependency, consider asking the maintainer to support
> ECMAScript modules, contributing that support yourself, or using an alternative dependency which
> meets your needs. If the best option is to use a CommonJS dependency, you can disable these
> warnings by adding the CommonJS module name to `allowedCommonJsDependencies` option in the `build`
> options located in `angular.json`."*

The real message, from `commonjs-checker.ts`, is
`` Module '<request>' used by '<importer>' is not ESM ``, carrying the note *"CommonJS or AMD
dependencies can cause optimization bailouts."*

The escape hatch, whose schema description is *"A list of CommonJS or AMD packages that are allowed
to be used without a build time warning. Use `'*'` to allow all."*:

```json
{
  "builder": "@angular/build:application",
  "options": {
    "allowedCommonJsDependencies": ["lodash"]
  }
}
```

🔴 **The check only runs when scripts are optimized:**

```ts
// Check metafile for CommonJS module usage if optimizing scripts
if (optimizationOptions.scripts) {
  const messages = checkCommonJSModules(metafile, options.allowedCommonJsDependencies);
  executionResult.addWarnings(messages);
}
```

The generated `development` configuration sets `optimization: false`, so **the warning never appears
under `ng serve`**. A developer who only ever serves locally meets it for the first time in a CI
build — which is precisely the moment it is least welcome and least expected.

## 6 · A Zone.js top-level-await error that blames the wrong thing

esbuild reports top-level `await` failures in terms of the target environment and browser versions.
In a Zone.js application that explanation is misleading, and the CLI knows it:

```ts
// If Zone.js is used, augment top-level await errors with a more helpful message.
// esbuild's default error mentions "target environment" with browser versions, but
// the actual reason is that async/await is downleveled for Zone.js compatibility.
if (!isZonelessApp(options.polyfills)) {
  for (const error of bundlingResult.errors) {
    if (error.text?.startsWith(TOP_LEVEL_AWAIT_ERROR_TEXT)) {
      error.notes ??= [];
      error.notes.push({
        text:
          'Top-level await is not supported in applications that use Zone.js. ' +
          'Consider removing Zone.js or moving this code into an async function. \n' +
          'For more information about zoneless Angular applications, visit: https://angular.dev/guide/zoneless',
        location: null,
      });
    }
  }
}
```

**The real cause is that `async`/`await` is downlevelled for Zone.js compatibility**, not that your
browser targets are too old. Raising the browserslist range will not help. The two actual fixes are
in the note: move the `await` inside an async function, or go zoneless.

## Gotchas

**★ Symptom: a CommonJS warning appears in CI and never locally.** Cause: the check is guarded by
`if (optimizationOptions.scripts)`, and the generated `development` configuration sets
`optimization: false`. Fix: run the production configuration locally before pushing, rather than
discovering the warning in a pipeline:

```bash
ng build --configuration production
```

**★ Symptom: an esbuild error about the target environment and browser versions, in an app whose
browserslist is already permissive.** Cause: top-level `await` in a Zone.js application — the real
reason is that `async`/`await` is downlevelled for Zone.js, and the CLI appends a note saying so.
Fix: move the await into an async function, or drop Zone.js:

```ts
async function bootstrapConfig() {
  const config = await fetch('/config.json').then((r) => r.json());
  return config;
}
```

**★ Symptom: a type error inside a web worker never fails the build, then explodes at run time.**
Cause: worker code is compiled but *"not type-checked by the TypeScript compiler"*. Fix: type-check
worker files as a separate step in CI:

```bash
npx tsc --noEmit -p tsconfig.worker.json
```

**★ Symptom: a worker created inside another worker silently does not exist in the output.** Cause:
nested workers *"will not be processed by the build system"* — this is not type-checking, it is the
build skipping the file. Fix: flatten the design so every worker is instantiated from application
code, not from another worker.

**★ Symptom: you added `allowedCommonJsDependencies` and the warning persists for a different
package.** Cause: the option is an allowlist of exact package names, not a global switch. Fix: add
each one, or — knowing what it costs in optimization bailouts — allow everything explicitly:

```json
{ "options": { "allowedCommonJsDependencies": ["*"] } }
```

## Interview questions

**★ Why does the CommonJS warning appear in CI but never on a developer's machine?**
Because the check is conditional on optimization: `if (optimizationOptions.scripts)` guards the call
to `checkCommonJSModules`, and the generated `development` configuration sets `optimization: false`.
`ng serve` and a development build therefore never run it. It is a good example of a build check
whose visibility depends on configuration rather than on correctness, and the practical response is
to run the production configuration locally before pushing.

**An esbuild error names your target environment and browser versions. Your browserslist is already
wide. What is actually wrong?**
Almost certainly top-level `await` in an application that still uses Zone.js. `async`/`await` is
downlevelled for Zone.js compatibility, so the construct genuinely cannot be emitted regardless of
browser support — but esbuild's own message frames it as a target problem. The CLI detects this case
and appends a note saying that top-level await is unsupported with Zone.js and suggesting either
moving the code into an async function or going zoneless. Raising the browserslist range does
nothing.

**★ What do these three have in common as a class of problem?**
Each one weakens a signal rather than breaking a behaviour. The CommonJS check is real but
conditional on optimization, so a developer who only serves locally never sees it. Worker files are
genuinely compiled, so nothing looks missing — only type-checking is absent. The top-level-await
error is genuinely raised, but its default text names browser targets when the cause is Zone.js
downlevelling. In every case the build is doing something reasonable and the reader's model of what
"the build checks" is quietly wrong, which is a much harder failure to notice than a red pipeline.

---

← Prev: [What breaks when you switch](09-what-breaks-when-you-switch.md) · Index: [Topic index](README.md) · Next → [`define`](10-features-only-this-builder-has.md)
