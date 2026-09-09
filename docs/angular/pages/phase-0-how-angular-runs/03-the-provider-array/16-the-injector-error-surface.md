---
title: "`NullInjectorError: No provider for X!` is not what Angular 22 throws — the class does not exist, the name is `ɵNotFound`, the code is `NG0201`, and angular.dev still documents the error you will never see"
sidebar_label: "16 · The injector error surface"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/null_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/null_injector.ts) (entire file body, verbatim),
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts),
> the `@angular/core` public-API golden, and the adev sources for
> [`errors/NG0201.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0201.md) and
> [`guide/di/debugging-and-troubleshooting-di.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/guide/di/debugging-and-troubleshooting-di.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The most-searched Angular error string is a string Angular no longer produces.** `NullInjectorError` was a class; at `v22.1.5` there is no such class in `@angular/core`, nothing throws that name, and the message it used to carry has been rewritten. What you get instead is a `RuntimeError` whose `name` is deliberately set to `ɵNotFound`, whose code is `NG0201`, and whose text reads `` No provider found for `X`. `` — different verb order, backticks, a full stop instead of an exclamation mark. Angular's own documentation has not caught up, in two separate places, and one of those places is the error-reference page for `NG0201` itself. This chunk establishes what is actually thrown and shows the stale documentation side by side with the source, because recognising the discrepancy is what stops you searching for an error that does not exist. The chunks after it take the message apart clause by clause ([16b](16b-how-the-message-is-assembled.md), [16c](16c-what-a-production-build-tells-you.md)), show how to recognise it in code ([16d](16d-catching-it-in-code.md), [16e](16e-the-two-message-shapes.md), [16f](16f-how-a-token-is-printed.md)), work through the three quite different mistakes that all present as one symptom ([16g](16g-not-there-or-not-reachable.md), [16h](16h-when-it-is-a-different-token.md)) and close with the codes that are mistaken for it ([16i](16i-the-codes-next-door.md), [16j](16j-the-errors-with-no-code.md)).

## The class you are searching for was deleted

**`NullInjectorError` is not a class in `@angular/core` at `v22.1.5`.** It is not in the
public-API golden — `grep -c NullInjectorError goldens/public-api/core/index.api.md` at tag
`v22.1.5` returns **0** — and nothing in the runtime constructs one. The string survives in
exactly two places in the repository, both of them prose: the DI troubleshooting guide, and the
doc comment on `InjectionToken` that [12e](12e-untyped-values-and-string-tokens.md) quotes. Both
are stale.

What actually throws is thirteen lines. Verbatim, the entire body of
[`packages/core/src/di/null_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/null_injector.ts)
at `v22.1.5`:

```ts
export class NullInjector implements Injector {
  get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND): any {
    if (notFoundValue === THROW_IF_NOT_FOUND) {
      const message = ngDevMode ? `No provider found for \`${stringify(token)}\`.` : '';
      const error = createRuntimeError(message, RuntimeErrorCode.PROVIDER_NOT_FOUND);

      // Note: This is the name used by the primitives to identify a not found error.
      error.name = 'ɵNotFound';

      throw error;
    }
    return notFoundValue;
  }
}
```

Read the four facts off it. The thrown object is a `RuntimeError`, not a `NullInjectorError`.
Its `name` is deliberately overwritten to **`ɵNotFound`**. Its message is
`` No provider found for `X`. `` — *found for*, backticks round the token, a full stop, no
exclamation mark. And its code is `RuntimeErrorCode.PROVIDER_NOT_FOUND`, which
[`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts)
defines as `PROVIDER_NOT_FOUND = -201` and which every message renders as **`NG0201`**.

## Four differences, every one of them observable

| | What angular.dev's DI guide shows | What `v22.1.5` throws |
|---|---|---|
| `error.name` | `NullInjectorError` | **`ɵNotFound`** |
| message | `` No provider for UserClient! `` | `` No provider found for `UserClient`. `` |
| error code | *"None (displayed as `NullInjectorError`)"* | **`NG0201`** |
| path label | `Dependency path: App -> AuthClient -> UserClient` | `` Path: App -> AuthClient -> UserClient. `` |

Every row changes something you would type into a search box, a `catch` block, or a log
alert. That is why this page exists.

## The guide that is wrong, quoted so you can recognise it

From
[`adev/src/content/guide/di/debugging-and-troubleshooting-di.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/guide/di/debugging-and-troubleshooting-di.md)
at tag `v22.1.5`, published at
[angular.dev/guide/di/debugging-and-troubleshooting-di](https://angular.dev/guide/di/debugging-and-troubleshooting-di):

> *"### NullInjectorError: No provider for [Service]"*
>
> *"**Error code:** None (displayed as `NullInjectorError`)"*
>
> *"This error occurs when Angular cannot find a provider for a token in the injector hierarchy. The error message includes a dependency path showing where the injection was attempted."*

and the illustration it prints:

```text
NullInjectorError: No provider for UserClient!
  Dependency path: App -> AuthClient -> UserClient
```

🔴 **Three of those four lines are wrong for `v22.1.5`.** There is a code and it is `NG0201`;
the name is `ɵNotFound`; the message reads *found for* with backticks and a full stop; and the
path is introduced by ` Path: ` on the **same line**, not by an indented `Dependency path:`.
The one sentence that stays true is the mechanism — Angular does walk the hierarchy, and the
guide's ordering of that walk is correct:

> *"1. **Element injector** - The current component or directive / 2. **Parent element injectors** - Up the DOM tree through parent components / 3. **Environment injector** - The route or application injector / 4. **NullInjector** - Throws `NullInjectorError` if not found"*

Keep the first three steps, discard the fourth's name. 🔴 **The resolution order itself is
Phase 6's subject**, not this topic's — this topic is about what goes in the array
([12d](12d-lifetime-is-the-whole-question.md) draws the same boundary). What belongs here is
only the diagnostic: which injector gave up, and why.

## The error-reference page is the stale one, and it is worth reading as evidence

[`adev/src/content/reference/errors/NG0201.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0201.md)
at `v22.1.5`, published at [angular.dev/errors/NG0201](https://angular.dev/errors/NG0201), in
full:

> *"# No Provider Found"*
>
> *"You see this error when you try to inject a service but have not declared a corresponding provider. A provider is a mapping that supplies a value that you can inject into the constructor of a class in your application."*
>
> *"## Debugging the error"*
>
> *"Work backwards from the object where the error states that a provider is missing: `No provider for ${this}!`. This is commonly thrown in services, which require non-existing providers."*
>
> *"To fix the error ensure that your service is registered in the list of providers of an `NgModule` or has the `@Service` decorator at top."*
>
> *"The most common solution is to add a provider in `@Service`"*

🔴 The interesting thing is that this page is **half-updated**. `` `No provider for ${this}!` ``
is the pre-v20 template string, complete with the `!` and the interpolation braces left in.
But `@Service` is genuinely v22 surface — `export const Service: ServiceDecorator;` is in the
`v22.1.5` public-API golden. Someone did a find-and-replace of `@Injectable` → `@Service`
across the error pages and did not re-read the message strings underneath.

That is the shape of doc drift worth internalising: **a page can be freshly edited and still
describe a runtime that no longer exists.** The date on a doc page tells you when the prose was
touched, never when the behaviour was checked. Source over docs, every time — and this topic's
standing rule when the two disagree is that the source wins and the page says so out loud.

## Gotchas

**★ Symptom: you searched the codebase, the docs and the web for `NullInjectorError` and found only stale results.** Cause: the class does not exist at `v22.1.5` — zero occurrences in the `@angular/core` public-API golden — and the runtime never produces that name. Fix: search for `NG0201`, or for `ɵNotFound`, or for the literal `No provider found for`. Those three cover both message shapes and the error's `name`.

**★ Symptom: angular.dev's NG0201 page describes a message with an exclamation mark and you have never seen one.** Cause: the page still quotes `` `No provider for ${this}!` ``, the pre-v20 template, while having been find-and-replaced from `@Injectable` to `@Service`. Fix: read `null_injector.ts` instead. When docs and source disagree the source wins, and a recently-edited page is not a recently-verified page.

**★ Symptom: the DI troubleshooting guide's `Dependency path:` line does not appear in your console.** Cause: the guide shows a two-line layout that the formatter does not produce. `formatErrorMessage` emits `` Path: A -> B -> C.`` inline, on the same line, after the `Source:` clause. Fix: grep your logs for `Path: `, with the trailing space, not for `Dependency path`.

**★ Symptom: a log-alerting rule that fired on `NullInjectorError` has been silent for a year and you assumed DI was healthy.** Cause: the string changed at the v20 boundary; nothing in a rule engine tells you a pattern stopped matching. Fix: alert on the code, which is stable and present in every build including production —

```ts
// the pattern to match is the code, not the prose
const isDiFailure = (msg: string) => /\bNG020[01]\b/.test(msg);
```

**★ Symptom: an assistant, a tutorial or an accepted Stack Overflow answer tells you the message is `No provider for X!`, and you start suspecting your install.** Cause: every corpus written before the v20 line carries the old string, and the change is invisible in a release-notes diff because a message string is not API — nothing was deprecated, nothing was renamed in a signature. Fix: the two identifiers that survive a version change are the numeric code and the error name. Check them against the tag you are actually on before trusting any prose about DI errors:

```bash
# the two version-independent handles on this failure
git -C angular grep -n "PROVIDER_NOT_FOUND" v22.1.5 -- packages/core/src
git -C angular grep -n "ɵNotFound" v22.1.5 -- packages/core
```

## Interview questions

**★ A colleague's v22 application throws a DI error. They search for `NullInjectorError`, land on the Angular docs, and follow them. What is wrong with that?**
Everything except the mechanism. `NullInjectorError` is not a class in `@angular/core` at `v22.1.5` — it appears zero times in the public-API golden — and nothing throws that name. What is thrown is a `RuntimeError` whose `name` is set explicitly to `ɵNotFound`, whose code is `NG0201` (`PROVIDER_NOT_FOUND = -201`), and whose message reads `` No provider found for `X`. `` with backticks and a full stop rather than `No provider for X!`. The DI troubleshooting guide additionally states *"Error code: None"*, which is wrong, and prints the path on a second indented line labelled `Dependency path:`, which the formatter does not produce — it emits `` Path: A -> B -> C.`` inline. The part of the guide that is still correct is the search order: element injector, parent element injectors, environment injector, then the end of the chain. The general lesson is the one worth saying out loud in an interview: a documentation page can be freshly edited and still describe a runtime that no longer exists — this one had `@Injectable` replaced with `@Service`, which is genuinely v22 surface, while the message string underneath was left at its pre-v20 text.

**★ Angular follows semantic versioning. Why did the DI error message change without a major-version deprecation, and what does that tell you to depend on?**
Because a message string is not part of the public API surface. What semver covers here is the exported symbols in `goldens/public-api/` — signatures, types, decorators — and no golden records what `NullInjector` interpolates into a template literal. So the text can be rewritten in a minor release with nothing to deprecate and nothing in a migration schematic. The practical rule that follows is about what you build on: never assert on error prose in a test, never pattern-match it in a log rule, and never teach it as a fact without a tag. The stable handles are the numeric code, which is a member of an enum the framework treats as long-lived, and — for programmatic use — the published `isNotFound` guard from `@angular/core/primitives/di`, which exists precisely so the internal `ɵ`-prefixed name it checks can change without breaking anyone. The corollary for documentation is uncomfortable and worth saying: because nothing verifies the strings quoted on the error-reference pages, those pages can drift for two major versions without a single test failing, which is exactly what happened to `NG0201`.

← Prev: [The injector that is never destroyed](15e-the-injector-that-is-never-destroyed.md) · Index: [Topic index](README.md) · Next → [How the message is assembled](16b-how-the-message-is-assembled.md)
