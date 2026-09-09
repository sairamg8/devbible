---
title: "Import attributes set a loader for one import instead of every file with that extension, and package import conditions can replace `fileReplacements` entirely — as long as you know that \"optimized\" means `optimization.scripts`, not a configuration named production"
sidebar_label: "10c · Import attributes and conditions"
sidebar_position: 10.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration),
> quoted verbatim, cross-checked against the `conditions` option in
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`, and Node's
> [community conditions definitions](https://nodejs.org/api/packages.html#community-conditions-definitions).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two features that look like footnotes and are not.** Import attributes fix the scope problem that
makes the [`loader`](10b-the-loader-option.md) map awkward — a loader for *this* import rather than
for every file with that extension. And package import conditions do what `fileReplacements` was
invented for, using a mechanism that is Node's rather than Angular's, which means editors and type
checkers understand it. The catch in both is precision: one needs an exact TypeScript `module`
setting, and the other hinges on a definition of "optimized" that has nothing to do with the word
production.

## Per-file loaders via import attributes

> *"The presence of the import attribute takes precedence over all other loading behavior including
> JS/TS and any `loader` build option values."*

```ts
// @ts-expect-error TypeScript cannot provide types based on attributes yet
import contents from './some-file.svg' with {loader: 'text'};
```

That precedence is the point: it overrides the `loader` map *and* the default handling of JavaScript
and TypeScript, per import. It is the answer to the problem in
[10b](10b-the-loader-option.md) where setting `".css": "empty"` globally to silence one library also
erases every other CSS import.

Two requirements, both verbatim:

> *"An additional requirement to use import attributes is that the TypeScript `module` option must
> be set to `esnext` to allow TypeScript to successfully build the application code. Once `ES2025`
> is available within TypeScript, this change will no longer be needed."*

> *"At this time, TypeScript does not support type definitions that are based on import attribute
> values. The use of `@ts-expect-error`/`@ts-ignore` or the use of individual type definition files
> (assuming the file is only imported with the same loader attribute) is currently required."*

🔴 **The `@ts-expect-error` is not a smell here; it is the documented usage.** TypeScript cannot yet
derive a type from an attribute value, so every such import needs either the suppression comment or
a dedicated `.d.ts` that is only valid because the file is always imported with the same attribute.

The dynamic form works too, with one constraint:

```ts
async function loadSvg(): Promise<string> {
  // @ts-expect-error TypeScript cannot provide types based on attributes yet
  return import('./some-file.svg', {with: {loader: 'text'}}).then((m) => m.default);
}
```

> *"For the import expression, the `loader` value must be a string literal to be statically
> analyzed. A warning will be issued if the value is not a string literal."*

A computed loader — from a variable, a ternary, a config lookup — cannot be analysed at build time,
so it warns rather than working.

The `file` loader's result is a runtime path:

```ts
// @ts-expect-error TypeScript cannot provide types based on attributes yet
import imagePath from './image.webp' with {loader: 'file'};

console.log(imagePath); // media/image-ULK2SIIB.webp
```

*(That comment is angular.dev's own illustration of the hashed media path, reproduced from the
documentation — it is not output produced here. It also corroborates the `media` default for
emitted assets.)*

And one dev-server interaction worth knowing before it costs you an afternoon:

> *"HELPFUL: When using the development server and using a `loader` attribute to import a file from
> a Node.js package, that package must be excluded from prebundling via the development server
> `prebundle` option."*

## Import and export conditions — the `fileReplacements` replacement

> *"Several import/export [conditions](https://nodejs.org/api/packages.html#community-conditions-definitions)
> are automatically applied to support these project needs:*
> *- For optimized builds, the `production` condition is enabled.*
> *- For non-optimized builds, the `development` condition is enabled.*
> *- For browser output code, the `browser` condition is enabled."*

Conditions are a Node feature. You declare a subpath import in `package.json` and let resolution
pick the file:

```ts
import {verboseLogging} from '#logger';
```

```json
{
  "imports": {
    "#logger": {
      "development": "./src/logging/debug.ts",
      "default": "./src/logging/noop.ts"
    }
  }
}
```

```json
{
  "imports": {
    "#crashReporter": {
      "browser": "./src/browser-logger.ts",
      "default": "./src/server-logger.ts"
    }
  }
}
```

> *"HELPFUL: If currently using the `fileReplacements` build option, this feature may be able to
> replace its usage."*

**Why this is better than `fileReplacements` where it fits:** the substitution is expressed in
`package.json` in a format Node, TypeScript, editors and other bundlers all understand, rather than
in a build-tool option that only the Angular CLI reads. Go-to-definition works. A test runner
resolves it the same way. And the `browser` condition gives you a client/server split that
`fileReplacements` — a per-configuration list — cannot express at all.

The schema names the defaults precisely: *"Custom package resolution conditions used to resolve
conditional exports/imports. Defaults to `['module', 'development'/'production']`. The following
special conditions are always present if the requirements are satisfied: 'default', 'import',
'require', 'browser', 'node'."*

## 🔴 "Optimized" is `optimization.scripts`, not the word production

> *"An optimized build is determined by the value of the `optimization` option. When `optimization`
> is set to `true` or more specifically if `optimization.scripts` is set to `true`, then the build is
> considered optimized. This classification applies to both `ng build` and `ng serve`. In a new
> project, `ng build` defaults to optimized and `ng serve` defaults to non-optimized."*

**The name of the configuration never enters the calculation.** A `staging` configuration that
leaves `optimization` at its default gets the `production` condition. A `production` configuration
with `optimization: false` gets the `development` condition. And the generated `development`
configuration sets `optimization: false`, which is the only reason `ng serve` resolves the
development branch.

The consequence is a debugging rule worth internalising: when a conditional import resolves to the
wrong file, do not look at the configuration's name — look at `optimization.scripts` for the
configuration that actually ran.

## Gotchas

**★ Symptom: `import x from './a.svg' with {loader: 'text'}` fails to compile.** Cause: import
attributes require the TypeScript `module` option to be `esnext`. Fix: set it, and note this is a
temporary requirement the documentation expects to lift once `ES2025` lands in TypeScript:

```jsonc
// tsconfig.json
{ "compilerOptions": { "module": "esnext" } }
```

**★ Symptom: a `#logger` subpath import resolves to the noop file under `ng serve`, or to the debug
file in a production build.** Cause: the condition follows `optimization.scripts`, not the
configuration's name — someone set `optimization: true` in `development`, or `false` in
`production`. Fix: read the option that actually decides it:

```bash
node -p "JSON.stringify(require('./angular.json').projects['my-app'].targets.build.configurations, null, 2)"
```

**★ Symptom: a `staging` configuration unexpectedly got the `production` condition.** Cause: it
inherits the default `optimization: true` and the word *staging* means nothing to the resolver. Fix:
say what you mean on the configuration itself:

```json
{ "configurations": { "staging": { "optimization": { "scripts": false } } } }
```

**★ Symptom: a dynamic `import()` with a loader attribute warns and does not apply the loader.**
Cause: *"the `loader` value must be a string literal to be statically analyzed"* — a variable cannot
be resolved at build time. Fix: inline the literal, and branch on the import rather than on the
loader:

```ts
const contents = await import('./some-file.svg', {with: {loader: 'text'}});
```

**★ Symptom: an import attribute on a file from a `node_modules` package does nothing under
`ng serve` and works in a build.** Cause: the package was prebundled by the dev server, so the
attribute never reached the build pipeline. Fix: exclude that package from prebundling:

```json
{ "options": { "prebundle": { "exclude": ["some-package"] } } }
```

**★ Symptom: `@ts-expect-error` above an import attribute reports "unused '@ts-expect-error'
directive".** Cause: the suppression is only needed while TypeScript cannot type the attribute; if
you also added a `.d.ts` for the extension, there is no error left to expect. Fix: keep one
mechanism, not both — either the declaration file or the suppression comment.

**★ Symptom: you replaced `fileReplacements` with conditions and a unit test now imports the wrong
file.** Cause: the test runner applies its own conditions, and neither `production` nor
`development` is necessarily among them. Fix: make the fallback correct rather than relying on the
runner — `default` is what resolves when no named condition matches:

```json
{ "imports": { "#logger": { "development": "./src/logging/debug.ts", "default": "./src/logging/noop.ts" } } }
```

**★ Symptom: an import attribute was ignored in favour of the `loader` map.** Cause: it should be
the reverse — the attribute *"takes precedence over all other loading behavior"* — so the attribute
is probably malformed or on a dynamic import with a non-literal value. Fix: check the syntax is the
`with {…}` form on a static import, and that the loader name is quoted.

**★ Symptom: go-to-definition lands on the wrong implementation for a `#`-prefixed import.** Cause:
editors resolve the `default` condition when they cannot infer a build condition. Fix: this is
expected and is still strictly better than `fileReplacements`, where the editor has no way to
resolve the substitution at all — point the `default` branch at the implementation you most want to
read.

## Interview questions

**★ What do import attributes give you that the `loader` build option does not?**
Scope. `loader` is a map from file extension to loader and applies to the entire build, so silencing
one library's side-effect CSS import with `".css": "empty"` erases every CSS import in the project.
An import attribute sets the loader for one import, and it *"takes precedence over all other loading
behavior including JS/TS and any `loader` build option values."* The cost is ergonomic: TypeScript
cannot derive a type from an attribute value yet, so each one needs a `@ts-expect-error` or a
dedicated declaration file, and the `module` option must be `esnext`.

**★ How can package import conditions replace `fileReplacements`, and why would you want them to?**
By declaring a subpath import in `package.json` whose branches are chosen by condition — the CLI
enables `production` for optimized builds, `development` for non-optimized ones, and `browser` for
browser output. The reason to prefer it is that the mechanism is Node's rather than the CLI's, so
TypeScript, editors, test runners and other bundlers all understand it: go-to-definition works and a
test resolves the same way the build does. `fileReplacements` is a build-tool option nothing else
can see. Conditions also express a client/server split through `browser`, which a per-configuration
replacement list cannot do at all.

**★ A conditional import resolves to the production implementation in a configuration named
`staging`. Why?**
Because "optimized" is defined by the `optimization` option, not by the configuration's name. When
`optimization` is `true`, or specifically when `optimization.scripts` is `true`, the build is
optimized and the `production` condition applies — and a configuration that does not mention
`optimization` inherits the default, which is optimized. The word `staging` is never consulted. The
same rule explains why `ng serve` resolves `development`: the generated `development` configuration
sets `optimization: false`.

**Why does a dynamic import need a string literal for the loader?**
Because the loader has to be known when the build runs, and a variable's value is not. The
documentation says the value *"must be a string literal to be statically analyzed"* and that a
warning is issued otherwise — a warning rather than an error, so the import still compiles and
simply does not get the loader you intended. It is a good example of a build-time versus run-time
boundary that the syntax does nothing to signal.

**What does the `conditions` option default to, and what is always available?**
`['module', 'development'/'production']` — the second entry chosen by whether the build is
optimized. On top of that, the schema states that `default`, `import`, `require`, `browser` and
`node` are always present when their requirements are satisfied. Knowing the always-present set
matters because `default` is your fallback branch, and it is what resolves in any environment that
does not set a build condition, editors and test runners included.

{/* FOOTER */}
