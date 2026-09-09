---
title: "`define` replaces identifiers with source code at build time — which is why the value `\"prod\"` fails the build naming a variable you never wrote, and why nothing happens inside an Angular decorator"
sidebar_label: "10 · `define`"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration),
> quoted verbatim, cross-checked against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and the `dev-server` schema at tag `v22.1.7`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`define` is Angular's `DefinePlugin`, promoted from something you needed a custom webpack config
and a third-party builder to reach into a first-class option with a schema.** It is worth knowing
precisely because both of its failure modes are quiet: a quoting rule that produces an error naming
an identifier you never typed, and a documented blind spot inside Angular metadata where the
replacement simply does not happen and nothing warns you.

## `define` — build-time value replacement

> *"The `define` option allows identifiers present in the code to be replaced with another value at
> build time. This is similar to the behavior of Webpack's `DefinePlugin` which was previously used
> with some custom Webpack configurations that used third-party builders."*

```json
{
  "builder": "@angular/build:application",
  "options": {
    "define": {
      "SOME_NUMBER": "5",
      "ANOTHER": "'this is a string literal, note the extra single quotes'",
      "REFERENCE": "globalThis.someValue.noteTheAbsentSingleQuotes"
    }
  }
}
```

🔴 **Read those three values carefully, because the quoting rule is the whole option.**

> *"HELPFUL: All replacement values are defined as strings within the configuration file. If the
> replacement is intended to be an actual string literal, it should be enclosed in single quote
> marks. This allows the flexibility of using any valid JSON type as well as a different identifier
> as a replacement."*

Every value is a string in JSON, and the string is substituted **as source code**. So `"5"` becomes
the number `5`; `"'hello'"` becomes the string `hello`; and
`"globalThis.someValue.noteTheAbsentSingleQuotes"` becomes an expression referring to something else
entirely. The JSON quotes are transport; the *inner* single quotes are what make it a string.

The command line composes with the file:

> *"The CLI will merge `--define` values from the command line with `define` values from
> `angular.json`, including both in a build. Command line usage takes precedence if the same
> identifier is present for both."*

```bash
ng build --define SOME_NUMBER=5 --define "ANOTHER='these will overwrite existing'"
```

```bash
export MY_APP_API_HOST="http://example.com"
export API_RETRY=3
ng build --define API_HOST=\'$MY_APP_API_HOST\' --define API_RETRY=$API_RETRY
```

Note the escaped single quotes in that last line: the shell must be prevented from eating them,
because the build needs them to know the value is a string literal.

TypeScript has to be told these identifiers exist, since nothing declares them in your source:

```ts
declare const SOME_NUMBER: number;
declare const ANOTHER: string;
declare const GIT_HASH: string;
declare const API_HOST: string;
declare const API_RETRY: number;
```

🔴 **The one limitation that catches people:**

> *"IMPORTANT: This option will not replace identifiers contained within Angular metadata such as a
> Component or Directive decorator."*

The schema says the same thing: *"Defines global identifiers that will be replaced with a specified
constant value when found in any JavaScript or TypeScript code including libraries. The value will
be used directly. String values must be put in quotes. Identifiers within Angular metadata such as
Component Decorators will not be replaced."*

So a `define`d identifier works in a method body and does nothing in a `@Component` decorator's
`templateUrl`, `selector` or `host`. There is no warning; the identifier simply survives into the
metadata unchanged.

⚠️ **`define` is also on the `dev-server` schema, with an identical description.** That is easy to
miss and occasionally exactly what you want: values for `ng serve` that differ from the ones the
build uses, set on the `serve` target rather than by adding a configuration.

## Gotchas

**★ Symptom: a `define`d identifier is not replaced inside a `@Component` decorator, and no warning
appears.** Cause: documented and deliberate — *"will not replace identifiers contained within
Angular metadata such as a Component or Directive decorator."* Fix: move the value out of the
metadata and into class code, where the replacement does happen:

```ts
declare const API_HOST: string;

@Component({ selector: 'app-root', template: '{{ host }}' })
export class App {
  readonly host = API_HOST;
}
```

**★ Symptom: `"define": { "API": "prod" }` fails the build with an error about an undefined variable
`prod`.** Cause: the value is substituted as source code, so `prod` is an identifier, not a string.
Fix: put single quotes inside the JSON string:

```json
{ "define": { "API": "'prod'" } }
```

**★ Symptom: a `--define` on the command line was ignored in favour of the `angular.json` value.**
Cause: it is the other way round — command line takes precedence — so what you are seeing is
probably a shell quoting problem that changed the identifier or the value. Fix: quote the whole
argument so the shell does not eat the inner quotes:

```bash
ng build --define "ANOTHER='these will overwrite existing'"
```

**★ Symptom: TypeScript errors that `SOME_NUMBER` does not exist, though the build replaces it
fine.** Cause: `define` is a build-time substitution and the type system knows nothing about it.
Fix: declare the identifiers, ideally in one file the whole app includes:

```ts
// src/build-defines.d.ts
declare const SOME_NUMBER: number;
declare const API_HOST: string;
```

**★ Symptom: an environment variable interpolated into `--define` produced a string in one shell and
an identifier in another.** Cause: whether the single quotes survive depends on the shell and the
escaping. Fix: escape them explicitly, exactly as the documentation does:

```bash
ng build --define API_HOST=\'$MY_APP_API_HOST\'
```

## Interview questions

**★ What does the `define` option do, and what is the single most common mistake with it?**
It replaces identifiers in your code with a value at build time, the way webpack's `DefinePlugin`
did — Angular exposes it as a first-class option so that a build no longer needs a custom webpack
config to do it. The mistake is quoting. Every value is written as a JSON string, and that string is
substituted *as source code*, so `"5"` is the number five and `"prod"` is an identifier named `prod`
that does not exist. A string literal needs its own inner single quotes: `"'prod'"`. The failure is
a build error naming a variable you never wrote, which is confusing until you know the rule.

**★ Where does `define` not work, and why does that matter?**
Inside Angular metadata — a `@Component` or `@Directive` decorator. The documentation states it and
the schema repeats it, and there is no warning when it happens: the identifier simply survives
unreplaced. It matters because the metadata is exactly where people reach for it, wanting a
build-time `selector` prefix or `templateUrl`. The workaround is to move the value into class code,
which the replacement does reach. Worth knowing that this is a consequence of *when* the
substitution happens relative to the Angular compiler, not an arbitrary restriction.

**`define` appears on two schemas. Which, and why is that useful?**
On the `application` builder and on `dev-server`, with the same description. It means you can define
values for `ng serve` independently of `ng build` — set on the `serve` target rather than by
introducing another configuration. It is easy to miss because most option documentation treats
`serve` as merely referencing `build` through `buildTarget`.

**★ Why can `define` not reach inside a decorator, when it can reach into a method body of the same
class?**
Because the replacement operates on the JavaScript and TypeScript code the bundler sees, while
Angular metadata is consumed by the Angular compiler as data rather than executed as code. The
documentation and the schema both state the restriction rather than explaining it, so the honest
answer names the boundary — code yes, metadata no — and notes that it fails silently, which is what
makes it worth memorising rather than deriving.

{/* FOOTER */}
