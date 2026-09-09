---
title: "Every clause of an `NG0201` is produced by one of four functions, so you can read a DI error backwards — `Path:` comes from an unwind, `Source:` names where the walk began and not where it failed, and the missing minus sign is a guide-page marker"
sidebar_label: "16b · How the message is assembled"
sidebar_position: 16.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`core/src/error_details_base_url.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/error_details_base_url.ts) — all quoted verbatim.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A DI error message is a template, not a narrative, and once you have read the four functions that build it you can name the source of every clause you see.** `formatRuntimeErrorCode` produces the `NG0…` prefix and erases the sign that told it whether a guide page exists. `formatErrorMessage` appends ` Source: ….` and ` Path: A -> B -> C.`, each under a condition worth knowing. `prependTokenToDependencyPath` builds the path by unwinding the call stack rather than by walking anything. And one `catch` block in `r3_injector.ts` decides, per build mode, whether any of it happens at all. Two details in there are routinely misread — `previousInjector` is not the parent injector, and `Source:` names the injector that *started* the resolution rather than the one that failed — and both send people looking in the wrong place.

## Three functions build the string, and you can predict it exactly

Nothing about the message is opaque. It is a template assembled by three functions in two
files, and once you have read them you can look at any `NG0201` and say which clause came from
where.

The formatter, verbatim from
[`packages/core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts)
at `v22.1.5`:

```ts
export function formatRuntimeErrorCode<T extends number = RuntimeErrorCode>(code: T): string {
  // Error code might be a negative number, which is a special marker that instructs the logic to
  // generate a link to the error details page on angular.io.
  // We also prepend `0` to non-compile-time errors.
  return `NG0${Math.abs(code)}`;
}

export function formatRuntimeError<T extends number = RuntimeErrorCode>(
  code: T,
  message: null | false | string,
): string {
  const fullCode = formatRuntimeErrorCode(code);

  let errorMessage = `${fullCode}${message ? ': ' + message : ''}`;

  if (ngDevMode && code < 0) {
    const addPeriodSeparator = !errorMessage.match(/[.,;!?\n]$/);
    const separator = addPeriodSeparator ? '.' : '';
    errorMessage = `${errorMessage}${separator} Find more at ${ERROR_DETAILS_PAGE_BASE_URL}/${fullCode}`;
  }
  return errorMessage;
}
```

`ERROR_DETAILS_PAGE_BASE_URL` is `'https://angular.dev/errors'`, from
[`error_details_base_url.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/error_details_base_url.ts).

Two conventions fall out of that function and they explain most of the error surface:

- **A negative code means the error has a guide page.** The enum's own header comment says so
  verbatim: *"Note: the minus sign denotes the fact that a particular code has a detailed guide
  on angular.io. This extra annotation is needed to avoid introducing a separate set to store
  error codes which have guides, which might leak into runtime code."* `Math.abs` erases the
  sign for display, so **you never see the minus** — but it is still there on the error object.
- **The `Find more at …` suffix is dev-only.** `if (ngDevMode && code < 0)`. A production build
  never appends it, even for a code that has a page.

And the message-assembly half, verbatim from
[`packages/core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts):

```ts
export function createRuntimeError(message: string, code: number, path?: string[]): Error {
  // Cast to `any`, so that extra info can be monkey-patched onto this instance.
  const error = new RuntimeError(code, message) as any;

  // Monkey-patch a runtime error code and a path onto an Error instance.
  error[NG_RUNTIME_ERROR_CODE] = code;
  error[NG_RUNTIME_ERROR_MESSAGE] = message;
  if (path) {
    error[NG_TOKEN_PATH] = path;
  }
  return error;
}

export function prependTokenToDependencyPath(
  error: any,
  token: ProviderToken<unknown> | {multi: true; provide: ProviderToken<unknown>},
): void {
  error[NG_TOKEN_PATH] ??= [];
  // Append current token to the current token path. Since the error
  // is bubbling up, add the token in front of other tokens.
  const currentPath = error[NG_TOKEN_PATH];
  // Do not append the same token multiple times.
  let pathStr: string;
  if (typeof token === 'object' && 'multi' in token && token?.multi === true) {
    assertDefined(token.provide, 'Token with multi: true should have a provide property');
    pathStr = stringifyForError(token.provide);
  } else {
    pathStr = stringifyForError(token);
  }

  if (currentPath[0] !== pathStr) {
    (error[NG_TOKEN_PATH] as string[]).unshift(pathStr);
  }
}

export function augmentRuntimeError(error: any, source: string | null): Error {
  const tokenPath: string[] = error[NG_TOKEN_PATH];
  const errorCode = error[NG_RUNTIME_ERROR_CODE];
  const message = error[NG_RUNTIME_ERROR_MESSAGE] || error.message;
  error.message = formatErrorMessage(message, errorCode, tokenPath, source);
  return error;
}

function formatErrorMessage(
  text: string,
  code: number,
  path: string[] = [],
  source: string | null = null,
): string {
  let pathDetails = '';
  // If the path is empty or contains only one element (self) -
  // do not append additional info the error message.
  if (path && path.length > 1) {
    pathDetails = ` Path: ${path.join(' -> ')}.`;
  }
  const sourceDetails = source ? ` Source: ${source}.` : '';
  return formatRuntimeError(code, `${text}${sourceDetails}${pathDetails}`);
}
```

## Who drives it: one catch block in `r3_injector.ts`

Every environment injector's `get()` wraps its lookup in the same `try`/`catch`, and that catch
is what turns a leaf failure into a path. Verbatim from
[`packages/core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts):

```ts
    } catch (error: any) {
      // If there was a cyclic dependency error or a token was not found,
      // an error is thrown at the level where the problem was detected.
      // The error propagates up the call stack and the code below appends
      // the current token into the path. As a result, the full path is assembled
      // at the very top of the call stack, so the final error message can be
      // formatted to include that path.
      const errorCode = getRuntimeErrorCode(error);
      if (
        errorCode === RuntimeErrorCode.CYCLIC_DI_DEPENDENCY ||
        errorCode === RuntimeErrorCode.PROVIDER_NOT_FOUND
      ) {
        // Note: we use `if (ngDevMode) { ... }` instead of an early return.
        // ESBuild is conservative about removing dead code that follows `return;`
        // inside a function body, so the block may remain in the bundle.
        // Using a conditional ensures the dev-only logic is reliably tree-shaken
        // in production builds.
        if (ngDevMode) {
          prependTokenToDependencyPath(error, token);

          if (previousInjector) {
            // We still have a parent injector, keep throwing
            throw error;
          } else {
            // Format & throw the final error message when we don't have any previous injector
            throw augmentRuntimeError(error, this.source);
          }
        } else {
          throw new RuntimeError(errorCode, null);
        }
      } else {
        throw error;
      }
```

Two subtleties are easy to misread and both matter when you are staring at a real error.

🔴 **`previousInjector` is not the parent injector.** It is the value `setCurrentInjector(this)`
returned at the top of the same `get()` call — the injector that was *current* before this one
took over. The comment says *"We still have a parent injector"*, which is a misnomer. What the
branch really tests is *"am I the outermost `get()` on this call stack?"*. Only the outermost
frame reaches `augmentRuntimeError`.

🔴 **So `Source:` names the injector where the resolution *started*, not the one that failed.**
The JSDoc on `augmentRuntimeError` says exactly this, verbatim:
*"@param source Extra info about the injector which started the resolution process, which
eventually failed."* If you read `Source: Environment Injector.` as *"the application injector
is missing the provider"*, you will look in the wrong place — it means *"the walk began at the
application injector"*, which for a root-provided consumer it always does.

## Gotchas

**★ Symptom: your error message has no `Path:` clause and you assume the error is truncated.** Cause: `if (path && path.length > 1)`. A token requested directly by application code, with nothing between it and the failure, has a one-entry path, and the formatter deliberately omits it. Fix: nothing to fix — read the absence as information. It means the failing injection is the one you wrote, not one three services deep.

**★ Symptom: `Source: Environment Injector.` and you conclude the application injector is where the provider should go.** Cause: it means the walk *started* there. The `augmentRuntimeError` JSDoc is explicit: *"Extra info about the injector which started the resolution process, which eventually failed."* Every root-provided consumer starts there. Fix: use `Source:` to identify the consumer's injector, then ask whether the provider's injector is an ancestor of it — which for a route provider and a root consumer it never is.

**★ Symptom: the `Path:` names a token you are certain nobody injects.** Cause: for a `multi` provider the path entry is `stringifyForError(token.provide)`, the *token being contributed to*, not the provider object. An `HTTP_INTERCEPTORS` or `ENVIRONMENT_INITIALIZER` entry appears in the path under the multi token's name. Fix: read that entry as "something contributing to this multi token failed", and look at the factories registered against it.

**★ Symptom: a service appears once in the `Path:` although two different services inject it.** Cause: `if (currentPath[0] !== pathStr)` — `prependTokenToDependencyPath` skips a token that is already at the head of the path. Fix: the path is a chain, not a census. It shows one route to the failure, which is enough to fix it.

## Interview questions

**★ How is `Path: App -> AuthClient -> UserClient` assembled, given that the failure happens at the bottom of the chain?**
By unwinding. `NullInjector` throws an error with a monkey-patched code and message. Every `R3Injector.get` on the stack catches it, checks `getRuntimeErrorCode(error)` against `CYCLIC_DI_DEPENDENCY` and `PROVIDER_NOT_FOUND`, and — in development only — calls `prependTokenToDependencyPath(error, token)`, which `unshift`s its own token onto `error.ngTokenPath` unless that token is already at the head. It then rethrows if `previousInjector` is truthy. Only the outermost frame, where `setCurrentInjector` returned nothing, calls `augmentRuntimeError(error, this.source)`, which is where the path is joined with ` -> ` and the whole string is formatted. The source comment describes it exactly: *"the full path is assembled at the very top of the call stack, so the final error message can be formatted to include that path."* The detail that catches people is that `previousInjector` is not the parent injector — it is whatever injector was current before this `get()` — so the test is really "am I the outermost call", not "do I have a parent".

**★ What does the `Source:` clause actually name?**
The injector where the resolution *started*, not the one that failed. `augmentRuntimeError`'s JSDoc says *"Extra info about the injector which started the resolution process, which eventually failed"*, and the value is the injector's `source` field, which for the application injector is the `debugName` `'Environment Injector'` that `internalCreateApplication` supplies in development. Since every root-provided service resolves from the application injector, `Source: Environment Injector.` is the common case and carries almost no information on its own. Where it *is* informative is when it names something else — a route injector's debug name, or a custom `createEnvironmentInjector(providers, parent, debugName)` — because then you know which subtree the consumer lives in, and can ask whether the provider's injector is an ancestor of it.

**★ What is the minus sign in `PROVIDER_NOT_FOUND = -201` for?**
It marks the codes that have a guide page on angular.dev, and the enum's header comment says so verbatim: *"the minus sign denotes the fact that a particular code has a detailed guide on angular.io. This extra annotation is needed to avoid introducing a separate set to store error codes which have guides, which might leak into runtime code."* It is a deliberate space optimisation — encoding a boolean in the sign of an existing constant rather than shipping a second lookup table into the bundle. `formatRuntimeErrorCode` erases it with `Math.abs`, so the rendered code is always positive, and `formatRuntimeError` uses `code < 0` to decide whether to append `Find more at …`. The consequence that catches people is that the *object* still carries the negative value, so a check against `201` never matches while a check against `-201` does.

**★ Why does the `Path:` clause disappear for a single-token failure, and is that a good design?**
`formatErrorMessage` guards it: `if (path && path.length > 1)`, with the comment *"If the path is empty or contains only one element (self) - do not append additional info the error message."* It is a good design, because a one-element path is `Path: UserClient.` after a message that already said `No provider found for UserClient.` — pure noise. The cost is that the absence has to be interpreted rather than read, and people assume the error was truncated. Treating the absence as a signal is the right habit: no `Path:` in a development build means the failing injection is the one you wrote, not one buried three services deep, and that is genuinely useful narrowing.

← Prev: [The injector error surface](16-the-injector-error-surface.md) · Index: [Topic index](README.md) · Next → [What production tells you](16c-what-a-production-build-tells-you.md)
