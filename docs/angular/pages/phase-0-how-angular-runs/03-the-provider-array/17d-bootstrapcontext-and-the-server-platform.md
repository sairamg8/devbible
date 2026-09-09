---
title: "bootstrapApplication's third argument is optional in the signature and mandatory on the server, because v21 stopped caching the platform injector in a module global — and the throw you get without it is the other half of that same change"
sidebar_label: "17d · BootstrapContext and NG0401"
sidebar_position: 17.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) at `v21.0.0`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**One Node process renders many requests at once. A platform injector reached through a module-level
global is therefore shared between requests, and v21 fixed that by not caching it — which means the
global is `null` on the server, which means `bootstrapApplication` has no way to find a platform
unless you hand it one. `BootstrapContext` is that hand-off, and NG0401 is what happens when the
argument is missing.**

The two halves of the change are in different files and only make sense together: `createPlatform`
refuses to store the injector, and `internalCreateApplication` throws when it cannot find one.

## What v21 changed, verbatim

The v21.0.0 CHANGELOG states it plainly:

> *"The server-side bootstrapping process has been changed to eliminate the reliance on a global platform injector."*

with the before-and-after it prescribes:

```ts
// v20 and earlier
const bootstrap = () => bootstrapApplication(AppComponent, config);

// v21 and later
const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);
```

> *"A schematic is provided to automatically update `main.server.ts` files to pass the `BootstrapContext` to the `bootstrapApplication` call."*

> *"In addition, `getPlatform()` and `destroyPlatform()` will now return `null` and be a no-op respectively when running in a server environment."*

That last sentence is the observable consequence for existing code, and it is a breaking change with
no migration: any code path that reached the platform through `getPlatform()` gets `null` on the
server from v21 onwards.

## The reason is concurrency, and the source says so

`createPlatform` does not store the injector under `ngServerMode` — the line
[14c](14c-what-root-resolves-to-and-the-other-scopes.md) quotes:

```ts
  _platformInjector = typeof ngServerMode === 'undefined' || !ngServerMode ? injector : null;
```

with the comment that explains why, also verbatim:

> *"During SSR, using this setting and using an injector from the global can cause the injector to be used for a different request due to concurrency."*

Read the two together and the design is forced. In the browser there is one page, one platform, and a
module-level cache is a convenience. On the server there are N concurrent renders sharing one module
instance, so a cache is a cross-request leak — a `providedIn: 'platform'` service holding a user's
token would hand it to whoever else was mid-render. Not caching it is the fix; passing the platform
explicitly per bootstrap is what replaces the cache.

🔴 **This is also why a `providedIn: 'platform'` service is a per-request singleton on the server and
a per-page singleton in the browser** — the same fact from the other direction.
[14c](14c-what-root-resolves-to-and-the-other-scopes.md) has the full scope table;
[06e](06e-platform-initializers.md) covers what a platform initializer does with it.

## What happens if you omit the argument

`internalCreateApplication` guards for exactly this, verbatim from
[`create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts):

```ts
  if (typeof ngServerMode !== 'undefined' && ngServerMode && !platformRef) {
    throw new RuntimeError(
      RuntimeErrorCode.PLATFORM_NOT_FOUND,
      ngDevMode &&
        'Missing Platform: This may be due to using `bootstrapApplication` on the server without passing a `BootstrapContext`. ' +
          'Please make sure that `bootstrapApplication` is called with a `context` argument.',
    );
  }
```

Four things to read out of it:

1. **It is a runtime throw, not a compile error.** The third parameter is
   `context?: BootstrapContext | undefined` — genuinely optional in the browser — so omitting it is a
   type-correct program and TypeScript will never mention it.
2. **It is guarded by `ngServerMode`**, so it can only fire in a server build. A browser bundle that
   omits the argument is correct, which is why the same source file works in both places until it
   does not.
3. **The condition is `!platformRef`, not "the context was undefined".** The check is about the
   platform being unreachable; the missing argument is the overwhelmingly common cause and the
   message says so cautiously — *"This **may** be due to…"*.
4. **The message text is behind `ngDevMode`.** In a production server build the second argument to
   `RuntimeError` is `false` and the whole thing collapses to the bare code, per the formatting
   machinery in [`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts).
   A production SSR failure therefore gives you a code and nothing else, which is worth knowing before
   you are reading production logs at 2am.

The code surfaces as **NG0401**. ⚠️ This page did not read the `RuntimeErrorCode` enum entry itself,
so whether the value is negative — which is what decides if the dev-mode message ends with a
`Find more at https://angular.dev/errors/NG0401` suffix — is unconfirmed here. Do not promise the
reader a guide-page link for it.

## Where this leaves the provider array

`BootstrapContext` is not a provider and does not go in the array. It is worth a page in this topic
for one reason: **it is the only part of the server bootstrap that the merged config cannot express.**
You can put every server-specific provider in `app.config.server.ts` and still have a server build
that throws before any of them is read, because the failure is in the entry point rather than the
configuration. When an SSR application fails at bootstrap, the order to check is:

1. `main.server.ts` — is the context taken and passed through? (NG0401)
2. the merged array — is the failing token provided by *either* config?
3. only then the individual `provide*` calls.

## Gotchas

**★ Symptom: `NG0401` at server bootstrap, with the dev-mode message "Missing Platform: This may be
due to using `bootstrapApplication` on the server without passing a `BootstrapContext`. Please make
sure that `bootstrapApplication` is called with a `context` argument."** Cause: `main.server.ts`
calls `bootstrapApplication` with
two arguments. Almost always a file that predates v21 and was never migrated, or a hand-written
server entry point. Fix: take the context and pass it through:

```ts
// ⛔ v20 shape — throws in a v21+ server build
const bootstrap = () => bootstrapApplication(App, config);

// ✅
const bootstrap = (context: BootstrapContext) => bootstrapApplication(App, config, context);
export default bootstrap;
```

**★ Symptom: the compiler is happy and the server still throws about a missing platform.** Cause: the
third parameter is optional in the signature, because it is genuinely optional in the browser. The
enforcement is a runtime guard on `ngServerMode`, not a type. Fix: as above — and stop treating "it
compiles" as evidence about the server entry point. If you want a compile-time guarantee, give
yourself one:

```ts
// a local alias that makes the context non-optional for server bootstraps
const bootstrapOnServer = (context: BootstrapContext) => bootstrapApplication(App, config, context);
export default bootstrapOnServer;
```

**★ Symptom: an SSR failure in production logs shows `NG0401` and nothing else.** Cause: the message
string is guarded by `ngDevMode`, so a production build passes `false` and `formatRuntimeError`
returns only the code. Fix: reproduce against a development server build to get the sentence, or
learn the code — this is the same behaviour for every `RuntimeError` in the framework, not a
peculiarity of this one.

**★ Symptom: `getPlatform()` returns `null` on the server after upgrading to v21.** Cause: a stated
breaking change — *"`getPlatform()` and `destroyPlatform()` will now return `null` and be a no-op
respectively when running in a server environment."* There is no longer a global platform to return,
because `createPlatform` deliberately stores `null` under `ngServerMode`. Fix: reach what you need
through the application injector rather than walking up to the platform:

```ts
// ⛔ null on the server since v21
const injector = getPlatform()!.injector;

// ✅ the per-request injector, from the bootstrap promise
const appRef = await bootstrapApplication(App, config, context);
const value = appRef.injector.get(SOME_TOKEN);
```

**★ Symptom: `destroyPlatform()` in a server-side test helper appears to do nothing.** Cause: same
change — it is documented as a **no-op** in a server environment, not as an error. Fix: nothing to
call instead at the platform level; destroy the `ApplicationRef` you created, which is per-request
anyway.

**★ Symptom: a `providedIn: 'platform'` service you expected to be process-wide is per-request under
SSR.** Cause: the injector is never cached in the module global on the server, so each request's
`BootstrapContext` brings its own. Fix: nothing in DI — this is the correct and intended behaviour.
If you genuinely want process-wide state on a server, hold it outside Angular's injector and own the
concurrency yourself. [14c](14c-what-root-resolves-to-and-the-other-scopes.md) covers the scopes.

**★ Symptom: after `ng update`, `main.server.ts` changed on its own.** Cause: v21 shipped a schematic
for exactly this — *"A schematic is provided to automatically update `main.server.ts` files to pass
the `BootstrapContext` to the `bootstrapApplication` call."* Fix: none, it is the correct edit. Read
it rather than reverting it; a revert reintroduces NG0401 on the next server build.

**Symptom: you pass the context in `main.ts` as well, "for symmetry".** Cause: a reasonable instinct
and a harmless mistake — but the browser has no `BootstrapContext` to pass, and inventing one is not
a thing you can do. Fix: leave `main.ts` with two arguments; the parameter's optionality exists
precisely so one signature serves both environments.

## Interview questions

**★ Why did v21 add a third argument to `bootstrapApplication`, and what breaks without it?**
To remove the reliance on a global platform injector on the server — the CHANGELOG's own words are
*"The server-side bootstrapping process has been changed to eliminate the reliance on a global
platform injector."* The motivation is concurrency: one Node process renders many requests
simultaneously, and an injector reached through a module-level global can end up serving a different
request; the platform source says exactly that. Without the argument, a server build throws
`RuntimeErrorCode.PLATFORM_NOT_FOUND` — NG0401 — because the guard is `ngServerMode && !platformRef`.
The browser is unaffected, which is why the parameter is optional in the type.

**★ The parameter is optional in the signature but mandatory on the server. Why is that not just a
design mistake?**
Because the same function is the browser's bootstrap entry point, where there is nothing to pass. A
required parameter would break every browser application; two separate functions would duplicate the
whole of `internalCreateApplication`. The chosen trade is an optional parameter plus a runtime guard
that can only fire in a server build. The cost is real and worth naming in an interview: the failure
mode moved from compile time to runtime, and the message says *"may be due to"* rather than knowing.

**★ Where does a `providedIn: 'platform'` service live during SSR, given that there is no global
platform?**
In the platform injector created for that request and handed in through the `BootstrapContext`, so it
is a per-request singleton rather than a process-wide one. That is the point of the v21 change: a
process-wide platform singleton under concurrent rendering is a cross-request data leak waiting to
happen, and the source comment names the failure mode — *"can cause the injector to be used for a
different request due to concurrency."*

**★ An SSR application fails at bootstrap with no useful message in production. How do you triage it?**
Start at the entry point, not the config. Check that `main.server.ts` takes a `BootstrapContext` and
passes it as the third argument, because NG0401 fires before any provider is read and its message is
suppressed outside dev mode. Then read the *merged* array — `appConfig` plus `serverConfig` as one
list — because a missing token could be provided by either file, and a token provided in both is
resolved by position rather than by anything that warns. Only after that is it worth looking at
individual `provide*` calls. Reproducing against a development server build is what gets you the
message text back.

**Is `BootstrapContext` something you can provide or inject?**
No — it is a parameter of `bootstrapApplication`, not a token in the provider array, and that is
exactly why it needs its own page in a topic about the provider array. It is the one part of the
server bootstrap that no amount of correct configuration can supply: a perfectly merged config still
throws if the entry point drops the argument.

{/* FOOTER */}
