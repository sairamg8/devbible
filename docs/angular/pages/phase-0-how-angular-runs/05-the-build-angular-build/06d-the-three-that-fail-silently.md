---
title: "Three dev-server options fail silently rather than loudly — `inspect` does nothing on a client-rendered app, `define` is declared separately on both builders so a value set for one is absent from the other, and `prebundle` is switched off by a cache flag in a different part of the file"
sidebar_label: "06d · The three that fail silently"
sidebar_position: 6.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — every option description and default quoted
> from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`, cross-checked against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> for the options declared on both builders, with the prebundling prose from angular.dev —
> [tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A closed schema protects you from typos and from nothing else.** `additionalProperties: false`
catches the key that does not exist; it cannot catch a key that exists, is spelled correctly, is
accepted, and then has no effect. Three of the dev server's nineteen options are in that category,
and each has a different reason: `inspect` is conditional on a build setting, `define` is declared
independently on two schemas that do not share values, and `prebundle` has a prerequisite that lives
in a completely different part of `angular.json`. None of them errors. All of them cost an
afternoon.

| Option | Default | Why it can be set correctly and still do nothing |
|---|---|---|
| `inspect` | `false` | *"only has an effect when 'SSR' or 'SSG' are enabled"* |
| `define` | — | declared separately on `build` and `serve`; no inheritance either way |
| `prebundle` | `true` | *"the Angular CLI cache must also be enabled"* — a workspace-level flag |

## `inspect` — inert on most projects

> `inspect` — *"Activate debugging inspector. This option only has an effect when 'SSR' or 'SSG'
> are enabled."* Default `false`.

It attaches the Node inspector to the **server-side** execution of your application. On a purely
client-rendered project there is no application code running in Node for a debugger to bind to, so
the option is accepted and does nothing — no error, no inspector URL, no hint that the condition
was not met. Browser devtools are what you want for client code; `inspect` is for the code that runs
during server rendering or prerendering, which is a different program in a different process.

The condition is on the **build** target, not the serve target, which is why it is easy to miss: you
set an option on `serve` and its precondition is two objects away.

## `define` — declared twice, inherited never

`define` carries the *identical* description on the dev-server and `application` schemas:

> *"Defines global identifiers that will be replaced with a specified constant value when found in
> any JavaScript or TypeScript code including libraries. The value will be used directly. String
> values must be put in quotes. Identifiers within Angular metadata such as Component Decorators
> will not be replaced."*

Three sentences in there, each its own trap.

**"The value will be used directly"** — the substitution is textual and the result is parsed as an
expression. `"API_HOST": "http://localhost:3000"` substitutes an unquoted URL into your code, which
is a syntax or reference error, not a string.

**"String values must be put in quotes"** — the fix for that: quote twice, once for JSON and once
for the JavaScript literal. The same rule is what lets you substitute numbers, booleans and other
identifiers, by not quoting them.

**"Identifiers within Angular metadata … will not be replaced"** — a `define`d name inside a
`@Component` decorator stays as written. This is the one that reads as a bug, because the same
identifier is substituted correctly everywhere else in the same file.

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "define": {
      "API_HOST": "'http://localhost:3000'",
      "API_RETRY": "1",
      "FEATURE_FLAG": "true"
    }
  }
}
```

🔴 **Setting `define` on the build target does not set it on the serve target.** They are separate
declarations on separate schemas — the same relationship `watch`, `poll` and `verbose` have. That is
usually a feature rather than a nuisance: a localhost API host while serving and a real one while
building is exactly the case the duplication makes expressible. The full `define` semantics,
including how `--define` on the command line merges with the file, are
**10 · Features only this builder has** *(not written yet)*.

## `prebundle` — a performance lever with a remote off-switch

> `prebundle` — *"Enable and control the Vite-based development server's prebundling capabilities.
> To enable prebundling, the Angular CLI cache must also be enabled."* Default `true`.

🔴 **The second sentence is a coupling to a completely different part of `angular.json`.** The
workspace-level `cli.cache` block — disabled in CI, or after one bad cache, and then forgotten —
turns prebundling off as a side effect. Nothing warns, because a disabled cache is a perfectly
legitimate configuration and the dev server still works; it is just slower, and slower has no error
code.

The option takes an object as well as a boolean, and angular.dev is explicit about which form to
prefer:

> *"By default, `prebundle` is set to `true` but can be set to `false` to fully disable prebundling.
> However, excluding specific dependencies is recommended instead since rebuild times will increase
> with prebundling disabled."*

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": {
      "exclude": ["some-dep"]
    }
  }
}
```

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": false
  }
}
```

What prebundling does to a dependency graph, and the situations angular.dev names as reasons to
customise it, are **05 · Vite is only the dev server** *(not written yet)*.

## Gotchas

**★ Symptom: `--inspect` attaches no debugger and prints no inspector URL.** Cause: *"This option
only has an effect when 'SSR' or 'SSG' are enabled."* A client-rendered application has no Node
process executing application code, so the flag is silently inert. Fix: enable server rendering on
the build target the serve target names, then serve:

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "browser": "src/main.ts",
    "server": "src/main.server.ts",
    "tsConfig": "tsconfig.app.json",
    "ssr": { "entry": "src/server.ts" }
  }
}
```

**★ Symptom: `define` values applied by `ng build` are missing under `ng serve`.** Cause: `define`
is declared on the two schemas separately; a value on the build target's `options` does not reach
the dev server. Fix: set it on the target the running command executes — or on both, if both need
it:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "define": { "API_HOST": "'http://localhost:3000'" }
  }
}
```

**★ Symptom: a `define`d identifier is not replaced inside a `@Component` decorator.** Cause: the
schema says so outright — *"Identifiers within Angular metadata such as Component Decorators will
not be replaced."* Fix: read the value into a module-level constant outside the decorator and
reference that constant from the class:

```ts
declare const API_HOST: string;

export const apiHost = API_HOST;
```

```ts
import { Component } from '@angular/core';
import { apiHost } from './build-constants';

@Component({
  selector: 'app-status',
  template: `<p>Talking to {{ host }}</p>`,
})
export class StatusComponent {
  readonly host = apiHost;
}
```

**★ Symptom: a `define`d string arrives in the bundle as a bare identifier and the app throws a
reference error.** Cause: the value is *"used directly"*, so `"API_HOST": "http://localhost:3000"`
is substituted as an expression, not as a string. Fix: quote it twice — JSON quotes plus a literal
pair of single quotes inside them:

```json
"define": {
  "API_HOST": "'http://localhost:3000'",
  "FEATURE_FLAG": "true",
  "MAX_RETRIES": "3"
}
```

**★ Symptom: `ng serve` got noticeably slower after someone disabled the CLI cache.** Cause:
`prebundle` states the dependency itself — *"To enable prebundling, the Angular CLI cache must also
be enabled."* Disabling the cache disables prebundling as a side effect, with no warning. Fix: leave
the workspace `cli.cache` block alone in a development workspace; if caching must be off somewhere,
make it CI rather than the shared `angular.json`.

**Symptom: a locally linked dependency shows stale code under `ng serve` but correct code under
`ng build`.** Cause: prebundling processed that dependency once and is serving the processed copy.
Fix: exclude the one package rather than disabling prebundling wholesale — the docs recommend this
form specifically because a full disable increases every rebuild:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": { "exclude": ["my-linked-dep"] }
  }
}
```

**Symptom: TypeScript reports `Cannot find name 'API_HOST'` for an identifier `define` will
substitute.** Cause: `define` is a bundler-level substitution; the compiler has never heard of the
name. Fix: declare it, in a `.d.ts` the app's `tsConfig` includes:

```ts
declare const API_HOST: string;
declare const FEATURE_FLAG: boolean;
declare const MAX_RETRIES: number;
```

## Interview questions

**★ When does `--inspect` actually do something?**
Only when the served application executes code in Node — that is, when SSR or SSG is enabled on the
build target. The schema states the constraint directly: *"This option only has an effect when 'SSR'
or 'SSG' are enabled."* For a purely client-rendered app there is no server-side application code to
attach a debugger to, so the flag is accepted and inert. This matters because the failure mode is
silence rather than an error, and the natural next step — watching the log for an inspector URL that
will never appear — wastes real time. Client-side code is debugged in the browser's devtools; that
is not what this option is for. Note too that the precondition sits on a *different target* from the
option, which is why it is easy to miss when reading `angular.json`.

**★ `define` is declared on both the build and the dev-server schemas. Why, and what does that mean
in practice?**
Because they are separate builders with separate option surfaces, and a value you want substituted
while serving is not necessarily the one you want substituted while building. In practice: setting
`define` on `build.options` does not affect `ng serve`; setting it on `serve.options` does not
affect `ng build`; and you can deliberately give the same identifier different values for the two —
a localhost API host while serving, a real one while building. That last case is why the duplication
is useful rather than merely redundant, and it is the same pattern as `watch`, `poll` and `verbose`,
which are also declared independently on both builders with no inheritance in either direction.

**★ Why does `"API_HOST": "http://localhost:3000"` in `define` break the build?**
Because the schema says the replacement value is *"used directly"* — it is substituted as source
text and then parsed as an expression, so an unquoted URL is not a string, it is a syntax error or a
reference to an identifier that does not exist. The schema's own next sentence is the fix: *"String
values must be put in quotes."* You need two levels of quoting, the JSON string plus a literal pair
of single quotes inside it, giving `"'http://localhost:3000'"`. The upside of the same rule is that
numbers, booleans and even other identifiers substitute correctly by simply not quoting them, which
is what makes `define` more useful than a string-only mechanism would be.

**★ What is the relationship between `prebundle` and the CLI cache, and why does it catch people?**
`prebundle` requires the cache — *"To enable prebundling, the Angular CLI cache must also be
enabled."* The two settings live in different parts of `angular.json`: one is a dev-server option on
a project's target, the other is a workspace-level `cli` block. So disabling the cache for an
unrelated reason silently removes prebundling and slows every `ng serve` start and rebuild, and
nothing warns because a disabled cache is a legitimate configuration. When someone reports "the dev
server got slow and nobody touched the dev server", the cache flag is the first thing to read.

**Why does angular.dev recommend excluding a dependency from prebundling rather than turning
prebundling off?**
Because the two differ enormously in cost. Prebundling processes third-party dependencies so that
rebuilds do not have to re-traverse them; excluding one package removes that package from the
optimisation, while disabling the feature removes it for every dependency in the project. The docs
put it directly: *"excluding specific dependencies is recommended instead since rebuild times will
increase with prebundling disabled."* The usual reason to want either is a locally linked package
whose processed copy has gone stale — a one-package problem, and it deserves a one-package fix.

**What do these three failures have in common, and how would you catch the next one?**
Each is an option whose *precondition* lives somewhere other than the option. `inspect`'s
precondition is on the build target; `define`'s is which target the running command reads;
`prebundle`'s is a workspace-level cache flag. A closed schema cannot help with any of them, because
nothing about the key is wrong. The general defence is to read the option's own description before
assuming it applies — all three state their condition in their own schema text, which is exactly why
this page quotes descriptions verbatim rather than summarising them.

{/* FOOTER */}
