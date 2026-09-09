---
title: "The merge de-duplicates nothing, validates nothing and cannot do either — it hands the injector an array whose element references are shared with both inputs, and that sharing is the only reason a duplicated interceptor sometimes runs once"
sidebar_label: "17b · What the merge does not do"
sidebar_position: 17.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [`EnvironmentProviders`](https://angular.dev/api/core/EnvironmentProviders) — and `angular/angular`
> at tag `v22.1.5`:
> [`core/src/application/application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts),
> [`core/src/di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Points 4, 5 and 6 of [17](17-the-server-config-merge.md)'s list: the merge never touches its
inputs, it inspects nothing it concatenates, and it accepts any number of configs. The middle one is
the one that costs people time — every contradiction check in this topic lives inside an individual
`provide*` call, so two features that would throw if written in one call are silently legal when
split across two configs that are merged afterwards.**

The compensating detail is that the merged array's *elements* are the same object references the
input configs hold. That is invisible almost everywhere and load-bearing in exactly one place:
`HttpClient` de-duplicates interceptors by reference.

## It does not de-duplicate, and cannot

This is not a design shortcut, it is a consequence of the type it operates on.
`ApplicationConfig.providers` is `Array<Provider | EnvironmentProviders>`, and the
`EnvironmentProviders` doc comment says outright what that costs, verbatim from
[`di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts):

> *"This wrapper type prevents access to the `Provider`s inside."*

So when the merge sees the result of `provideRouter(routes)` it sees an opaque branded object — no
token list, no way to tell that it collides with a second `provideRouter` call in the other config.
[03](03-environmentproviders-vs-provider.md) covers the brand and why it exists.

De-duplication would have to happen inside the injector instead, and it does not happen there either:
the provider processing overwrites for a non-multi token and appends for a multi one, which is
exactly the behaviour the whole two-config arrangement depends on. There is no layer that removes a
duplicate, at any point, ever.

## It does not validate

Every contradiction check in this topic fires **at call time, inside one `provide*` function**:

| Check | Where it runs | Chunk |
|---|---|---|
| `withXsrfConfiguration()` + `withNoXsrfProtection()` | inside `provideHttpClient(...)` | [09b](09b-inside-provide-http-client.md) |
| `withRequestsMadeViaParent()` + `withFetch()`/`withXhr()` | inside `provideHttpClient(...)` | [10f](10f-requests-made-via-parent.md) |
| conflicting hydration features (`NG5001`) | inside `provideClientHydration(...)` | [11e](11e-the-contradiction-checks.md) |
| zone **and** zoneless (`NG0408`) | at bootstrap, over the built injector | [05c](05c-the-redundant-opt-in-and-ng0408.md) |

Only the last of those survives a split across two files, because it is the only one that inspects
the assembled injector rather than one call's argument list. The others see one call each, and each
call is individually legal:

```ts
// app.config.ts
providers: [provideHttpClient(withXhr())],

// app.config.server.ts — a SECOND, separate call. No check compares the two.
providers: [provideHttpClient(withFetch()), provideServerRendering(withRoutes(serverRoutes))],
```

Nothing throws. The outcome is decided by array position and by the last-wins rule, not by a
diagnostic. 🔴 **So the review unit for an SSR application is the merged array, not either file** —
read `[...appConfig.providers, ...serverConfig.providers]` as one list, because that is precisely
what the injector is handed.

## Identity: what is new after a merge, and what is shared

Three separate answers, and mixing them up is how a "why did my config change" investigation starts:

| | New object? | Notes |
|---|---|---|
| the returned config | **yes, always** | it is `reduce`'s seed literal, created per call |
| `result.providers` | **yes** | a fresh array from the spread, on every fold step |
| the elements inside it | **no** | the same provider references the input configs hold |

The inputs are therefore never mutated: `Object.assign`'s target is the accumulator, never `curr`,
and the accumulator starts as a literal nobody else has a reference to. Pushing onto
`config.providers` after the merge does not touch `appConfig.providers`.

🔴 **The shared element references are observable in one place, and there they are load-bearing.**
`HttpInterceptorHandler` de-duplicates interceptor functions **by reference**, from
[`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts):

```ts
      const dedupedInterceptorFns = Array.from(
        new Set([...this.injector.get(HTTP_INTERCEPTOR_FNS), ...rootInterceptorFns]),
      );
```

So an interceptor named in *both* configs runs **once** if both files import the same function, and
**twice** if either file wraps it in a fresh arrow. Same module, same import, one execution; an
inline `(req, next) => authInterceptor(req, next)` in one of them is a different reference and the
`Set` cannot collapse it. [10c](10c-the-interceptor-chain-internals.md) has the chain construction
this sits inside.

The same rule quietly saves the most common duplication of all. Calling `provideHttpClient()` in both
configs pushes `xsrfInterceptorFn` into `HTTP_INTERCEPTOR_FNS` twice — from
[`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts):

```ts
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useValue: xsrfInterceptorFn,
      multi: true,
    },
```

It is the same module-level function reference both times, so the `Set` collapses it and XSRF
protection still runs once. That is luck built into the design rather than a check, and it does not
extend to *your* interceptors unless you import them the same way in both files.

## Any number of configs, including zero and one

`...configs` is a rest parameter folded by `reduce` with a seed, so:

- **zero configs** — `mergeApplicationConfig()` returns the seed, `{providers: []}`. A valid, empty
  `ApplicationConfig`.
- **one config** — returns a **shallow clone**: the seed with that config's keys assigned onto it and
  a fresh `providers` array holding the same elements.
- **three or more** — folded left, so the rightmost still wins every non-multi collision.

That is what makes a programmatically-built argument list safe rather than a special case:

```ts
// legal at every length, including zero
const layers: ApplicationConfig[] = [appConfig, ...(wantsDebug ? [debugConfig] : [])];
export const config = mergeApplicationConfig(...layers);
```

And a three-layer arrangement — shared, plus a browser-only debug layer, plus the server layer — is
the normal way to keep a dev-only provider out of the server injector:

```ts
// src/app/app.config.ts — shared by both builds
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes)],
};

// src/app/app.config.browser.ts — browser only; main.ts must be repointed at this
export const browserConfig = mergeApplicationConfig(appConfig, {
  providers: [provideCheckNoChangesConfig({exhaustive: true, interval: 1000})],
});

// src/app/app.config.server.ts — server only
export const config = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
});
```

Both branches start from `appConfig`, and because each merge produces a fresh object and a fresh
array, neither branch can affect the other. The debug provider exists in the browser injector and
does not exist in the server one — the arrangement [05g](05g-the-check-no-changes-interval.md) asks
for when it warns that anything in the shared array is registered during server-side rendering too.
[17e](17e-what-belongs-in-which-config.md) works through which providers earn a place in which file.

## Gotchas

**★ Symptom: you expected duplicate `provideX()` calls across two configs to collapse.** Cause:
nothing de-duplicates. The merge cannot see inside an `EnvironmentProviders` value at all — *"This
wrapper type prevents access to the `Provider`s inside."* — and the injector does not de-duplicate
either; it overwrites non-multi and appends multi. Fix: call each `provide*` function once, in the
config that should own it, and let the other config override only the specific token it needs:

```ts
// ⛔ two provideRouter calls -> ROUTES is multi -> .flat() yields both tables
appConfig:    { providers: [provideRouter(routes)] }
serverConfig: { providers: [provideRouter(routes)] }

// ✅ one call, in the shared config
appConfig:    { providers: [provideRouter(routes)] }
serverConfig: { providers: [provideServerRendering(withRoutes(serverRoutes))] }
```

**★ Symptom: two features that contradict each other produce no error, because they are in different
config files.** Cause: the contradiction checks run inside a single `provide*` call at the moment
that call is made; two separate calls in two files are each individually valid, and
`mergeApplicationConfig` inspects nothing. Fix: review the merged array as one list. The one check
that does survive the split is NG0408, because it inspects the built injector rather than an argument
list — do not generalise from it.

**★ Symptom: an interceptor declared in both configs runs twice on the server, and a colleague's runs
once.** Cause: `HttpInterceptorHandler` de-duplicates by **function reference** using `new Set`. Two
files importing the same `authInterceptor` collapse to one; a fresh arrow wrapper in either file is a
different reference and does not. Fix: declare the interceptor list once, in the shared config, and
let the server config carry only server-specific features:

```ts
// ⛔ different references, so the Set cannot collapse them
appConfig:    provideHttpClient(withInterceptors([(req, next) => auth(req, next)]))
serverConfig: provideHttpClient(withInterceptors([(req, next) => auth(req, next)]))

// ✅ declared once
appConfig:    provideHttpClient(withInterceptors([authInterceptor]))
serverConfig: provideServerRendering(withRoutes(serverRoutes))
```

**★ Symptom: you added a provider directly to the merged `config` object and cannot predict whether
it wins.** Cause: `config.providers` is already the flattened concatenation — pushing appends, so it
wins every non-multi collision, while re-assigning `config.providers` replaces the concatenation and
throws both configs away. Fix: put the provider in the config it belongs to and let the merge do the
ordering:

```ts
// ⛔ wins by accident of position, and hides where the provider came from
const config = mergeApplicationConfig(appConfig, serverConfig);
config.providers.push({provide: API_BASE, useValue: 'http://localhost:4000'});

// ✅
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {provide: API_BASE, useValue: 'http://localhost:4000'},
  ],
};
```

**★ Symptom: `mergeApplicationConfig(appConfig)` with one argument, and mutating the result does not
change the original.** Cause: a single-argument call returns a shallow clone — the seed object with
`appConfig`'s keys assigned and a **fresh** `providers` array. Fix: nothing to fix if you wanted a
clone, which is a legitimate use; if you wanted to edit `appConfig`, edit `appConfig`.

**Symptom: a helper that spreads a computed list of configs throws on an empty list.** Cause: it is
not `mergeApplicationConfig` throwing — the zero-argument call returns `{providers: []}` quite
happily. Look at whatever consumed the result. Fix: none needed for the merge itself; the arity is
genuinely unconstrained despite the doc comment saying *"Two or more configurations to be merged."*

## Interview questions

**★ Does `mergeApplicationConfig` mutate its arguments?**
No. `Object.assign`'s target is the accumulator, and `reduce`'s seed is a fresh `{providers: []}`
literal created on every call, so the first fold step mutates that literal and every later step
mutates the same accumulator. The inputs are only ever read. The returned `providers` array is also
new — it comes from a spread — but its **elements** are the same references the input configs hold,
which is why interceptor de-duplication by reference works across a merge at all.

**★ What would it take for `mergeApplicationConfig` to de-duplicate providers, and why does it not?**
It would need to see inside the values it is concatenating, and it structurally cannot: most entries
are `EnvironmentProviders`, whose doc comment says *"This wrapper type prevents access to the
`Provider`s inside."* Even with access, de-duplication would have to distinguish "the same provider
listed twice, drop one" from "a deliberate override, keep the last" from "a multi provider, keep
both" — and only the injector knows which, because only it has the `multi` flag off the processed
record. The honest division of labour is the one that exists: the merge builds an array, the provider
processing decides what the array means.

**★ You have `provideHttpClient(withXhr())` in the browser config and `provideHttpClient(withFetch())`
in the server config. Why is that not a configuration error?**
Because the check that would catch a contradiction lives inside `provideHttpClient` and only sees the
features passed to *that* call. Two calls are two argument lists, each internally consistent. The
merge does not compare them, and neither does the injector — it just applies last-wins to
`HttpBackend`. The behaviour is well-defined (the server's call is later, so `fetch` wins there) and
it is defined by array position rather than by anything that would tell you if you got the order
wrong.

**★ An interceptor is registered in both configs. Does it run twice?**
It depends on whether the two registrations are the same function reference.
`HttpInterceptorHandler` builds its chain from `Array.from(new Set([...]))`, so identical references
collapse and the interceptor runs once — which is why `provideHttpClient()` in both configs does not
double XSRF protection, since `xsrfInterceptorFn` is one module-level function. An inline arrow in
either file creates a distinct reference, the `Set` keeps both, and the interceptor runs twice. This
is the one place where "the merged array shares its elements with the inputs" becomes visible
behaviour.

**Is `mergeApplicationConfig` limited to two configs, as its doc comment implies?**
No. The comment says *"Two or more configurations to be merged"*, but the implementation is
`(...configs: ApplicationConfig[])` folded with a seed, so zero works (returns `{providers: []}`) and
one works (returns a shallow clone with a fresh providers array). That matters when the argument list
is built programmatically, because a spread of a possibly-empty array is then safe rather than a case
you have to guard.

← Prev: [The server config merge](17-the-server-config-merge.md) · Index: [Topic index](README.md) · Next → [The generated server files](17c-the-generated-server-files.md)
