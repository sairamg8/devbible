---
title: "Assembled from the source rather than captured, the development message has four clauses and the production message has six characters — `NG0201`, with no token, no path, no source and no link, by two independent mechanisms"
sidebar_label: "16c · What production tells you"
sidebar_position: 16.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`core/src/di/null_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/null_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the most practically useful fact in the whole error surface: a DI failure in a production build tells you the code and absolutely nothing else.** Not the token, not the dependency path, not the injector, not even the link to the guide page. Two independent mechanisms guarantee it — `NullInjector` builds an empty message when `ngDevMode` is falsy, and the catch block in `r3_injector.ts` throws away the original error and constructs a bare one — so no build flag short of a development build brings the text back, and source maps do not help because the string was never generated. The same section of source also contains the single best-argued comment in the DI code, explaining why the dev-only logic is a branch rather than an early `return`, and that argument applies directly to validation you write in your own `provide*` functions.

## Assembling the message by hand

🔴 **This is a construction from the four functions above, not a captured console transcript** —
there is no sandbox here and nothing was run. Take a `UserClient` that is nowhere provided,
injected by an `AuthClient` that is injected by `App`, all resolving through the root
environment injector, in a development build:

1. `NullInjector.get` builds `text` = `` No provider found for `UserClient`. ``
2. Each `R3Injector.get` on the way out calls `prependTokenToDependencyPath`, so
   `error.ngTokenPath` becomes `['App', 'AuthClient', 'UserClient']`.
3. The outermost frame calls `augmentRuntimeError(error, this.source)`. `this.source` is the
   injector's `debugName`; [01](01-app-config-and-what-bootstrap-does-with-it.md) already quoted
   `internalCreateApplication` passing the literal `'Environment Injector'` in dev mode.
4. `formatErrorMessage` appends `` Source: Environment Injector.`` then, because the path has
   three entries, `` Path: App -> AuthClient -> UserClient.``
5. `formatRuntimeError(-201, …)` prefixes `NG0201: `. The text already ends in `.`, so
   `addPeriodSeparator` is `false` and no extra period is inserted before the link.

```text
NG0201: No provider found for `UserClient`. Source: Environment Injector. Path: App -> AuthClient -> UserClient. Find more at https://angular.dev/errors/NG0201
```

That block is **assembled from the source above and is illustrative** — it is what the template
produces for those inputs, not something that was observed.

## The production form: `NG0201`, and nothing else

`throw new RuntimeError(errorCode, null)`. Follow `null` through `formatRuntimeError`:
`` `${fullCode}${message ? ': ' + message : ''}` `` — `null` is falsy, so the second term is the
empty string. `ngDevMode` is falsy, so no `Find more at …`. The entire message is the six
characters `NG0201`.

🔴 **A DI failure in a production build tells you the code and nothing else.** No token name, no
path, no source, no link. Two independent mechanisms guarantee it, which is why no build flag
short of a development build brings the text back:

- the `else` branch above discards the original error and constructs a bare one;
- and even if it did not, `NullInjector` set `message` to `''` in the first place, and
  `internalCreateApplication` set `debugName` to `''` too — chunk 01 quotes the ternary
  `debugName: typeof ngDevMode === 'undefined' || ngDevMode ? 'Environment Injector' : ''`.

The practical consequence: **you cannot debug an `NG0201` from a production log.** Reproduce it
against a development build of the same route, or ship a development build to a staging origin
that reproduces the same routing and the same server config. Adding source maps to the
production bundle does not help — the string was never generated.

## Why the dev-only logic is a branch instead of an early `return`

The comment above the branch is one of the most quietly useful things in the DI source:

> *"Note: we use `if (ngDevMode) { ... }` instead of an early return. ESBuild is conservative about removing dead code that follows `return;` inside a function body, so the block may remain in the bundle. Using a conditional ensures the dev-only logic is reliably tree-shaken in production builds."*

That is the same tree-shaking argument [04](04-writing-your-own-provide-function.md) makes about
`ngDevMode` validation in your own `provide*` functions, stated by the framework about itself.
`ngDevMode` is substituted with `false` at build time; a `false` branch is eliminated; a
statement after a `return` is not reliably eliminated. If you are writing dev-only code that
must not ship, the shape of that block is the shape to copy.

## Gotchas

**★ Symptom: production logs contain `NG0201` with no other text and you cannot reproduce it locally.** Cause: two independent mechanisms strip everything. `NullInjector` sets `message` to `''` when `ngDevMode` is falsy, and the catch block replaces the error with `new RuntimeError(errorCode, null)`. Fix: source maps do not help — the string was never generated. Reproduce against a development build of the same route, or stand up a staging origin serving a development build with the same server config (**17 · The server config merge** *(not written yet)* is where a server-only provider difference would come from).

**★ Symptom: `Find more at https://angular.dev/errors/NG0201` shows locally and never in production, and you suspect the link is being stripped by a logger.** Cause: `if (ngDevMode && code < 0)` in `formatRuntimeError`. It is not stripped; it is never appended. Fix: none needed — but do not build a log parser that expects it.

**★ Symptom: a dev-only validation you copied from framework code is still in your production bundle.** Cause: you wrote it as a guard clause. ESBuild will not reliably remove statements that *follow* a `return`, only branches whose condition folds to `false` — which is what the comment in `r3_injector.ts` says in as many words. Fix: wrap, never guard —

```ts
// ✗ the body may survive into the production bundle
export function provideReportFeature(options: ReportOptions): EnvironmentProviders {
  if (!ngDevMode) return makeEnvironmentProviders([{provide: REPORT_OPTIONS, useValue: options}]);
  assertValidReportOptions(options);
  return makeEnvironmentProviders([{provide: REPORT_OPTIONS, useValue: options}]);
}

// ✓ ngDevMode folds to false and the whole branch is eliminated
export function provideReportFeature(options: ReportOptions): EnvironmentProviders {
  if (ngDevMode) {
    assertValidReportOptions(options);
  }
  return makeEnvironmentProviders([{provide: REPORT_OPTIONS, useValue: options}]);
}
```

## Interview questions

**★ Why does a DI failure in a production build carry no token name?**
Because two separate mechanisms strip it. `NullInjector` builds the message as `` ngDevMode ? `No provider found for \`${stringify(token)}\`.` : '' `` — outside development the message is the empty string from the start. And the catch block in `R3Injector.get` discards the original error entirely in the non-`ngDevMode` branch: `throw new RuntimeError(errorCode, null)`. `formatRuntimeError` then renders `` `${fullCode}${message ? ': ' + message : ''}` ``, and `null` is falsy, so the entire message is the six characters `NG0201`. There is no `Source:`, no `Path:` — `internalCreateApplication` passes `debugName: ''` in production too — and no `Find more at` link, because that is guarded by `ngDevMode && code < 0`. The practical consequence is the one that matters: you cannot diagnose an `NG0201` from a production log, and source maps do not help, because the string was never generated. You reproduce it against a development build.

**★ Why is the dev-only logic written as `if (ngDevMode) { … } else { … }` rather than an early return?**
The source answers it directly: *"ESBuild is conservative about removing dead code that follows `return;` inside a function body, so the block may remain in the bundle. Using a conditional ensures the dev-only logic is reliably tree-shaken in production builds."* `ngDevMode` is substituted with a constant at build time, so a conditional whose test folds to `false` has its whole branch eliminated; statements sequenced after a `return` are not eliminated with the same confidence. This is worth knowing beyond trivia because it is the exact pattern you should copy in your own `provide*` validation ([04](04-writing-your-own-provide-function.md)): put dev-only checks inside `if (ngDevMode)`, never after a guard clause.

{/* FOOTER */}
