---
title: "`withInterceptorsFromDi()` provides one function through an intermediate token so that including it twice yields the *same* reference — it is the framework's own best worked example of why identity, not equality, is what a `multi` provider array is de-duplicated on"
sidebar_label: "10d · The two interceptor systems"
sidebar_position: 10.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Setting up `HttpClient`](https://angular.dev/guide/http/setup); and `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts),
> [`goldens/public-api/common/http/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/common/http/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular has two interceptor systems and neither is going away this release: functional interceptors
registered by `withInterceptors`, and class-based ones registered against the `HTTP_INTERCEPTORS`
multi token and bridged into the chain by `withInterceptorsFromDi()`. The bridge is three lines long
and every one of them is deliberate** — it provides the bridging function through an intermediate
non-multi token so that repeated inclusion produces the *same function object*, which is the only
thing the `Set` in [10c](10c-the-interceptor-chain-internals.md) can collapse. That is the mechanism;
the policy is that the framework recommends the functional ones and has written down an intent to
phase the DI ones out, without deprecating them.

## The bridge, and the comment that explains it

```ts
export function withInterceptorsFromDi(): HttpFeature<HttpFeatureKind.LegacyInterceptors> {
  // Note: the legacy interceptor function is provided here via an intermediate token
  // (`LEGACY_INTERCEPTOR_FN`), using a pattern which guarantees that if these providers are
  // included multiple times, all of the multi-provider entries will have the same instance of the
  // interceptor function. That way, the `HttpINterceptorHandler` will dedup them and legacy
  // interceptors will not run multiple times.
  return makeHttpFeature(HttpFeatureKind.LegacyInterceptors, [
    {
      provide: LEGACY_INTERCEPTOR_FN,
      useFactory: legacyInterceptorFnFactory,
    },
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useExisting: LEGACY_INTERCEPTOR_FN,
      multi: true,
    },
  ]);
}
```

(The `HttpINterceptorHandler` typo is in the source at `v22.1.5`; it is quoted here as written.)

**Why the indirection is load-bearing.** `LEGACY_INTERCEPTOR_FN` is an ordinary, *non-multi* provider:
declare it twice in one injector and the last record wins, so there is exactly one record, one factory
invocation and one memoised instance. The multi entry is `useExisting`, which resolves *through* that
token rather than calling a factory of its own. So N inclusions of `withInterceptorsFromDi()` in one
injector give N multi entries that are all the identical function object, and
`Array.from(new Set([...]))` collapses them to one.

Write it the obvious way instead and the guarantee evaporates:

```ts
// ⛔ what the indirection exists to avoid: each multi entry invokes the factory separately,
//    producing two distinct closures that no Set can collapse
{provide: HTTP_INTERCEPTOR_FNS, useFactory: legacyInterceptorFnFactory, multi: true}
```

🔴 **This is the pattern to steal for your own libraries.** If a `provide*` function of yours might
legitimately be called more than once in one injector and contributes to a `multi` token, route the
value through a non-multi token and register `useExisting`. Building your own `provide*`/`with*` pair
is [04](04-writing-your-own-provide-function.md).

## The class-based side of the bridge

```ts
export const HTTP_INTERCEPTORS = new InjectionToken<readonly HttpInterceptor[]>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'HTTP_INTERCEPTORS' : '',
);
```

Its doc comment is one sentence:

> *"A multi-provider token that represents the array of registered `HttpInterceptor` objects."*

and its `@see` tag points at the
[HTTP interceptors guide](https://angular.dev/guide/http/interceptors). Note the token description is
`ngDevMode`-gated to the empty string, so in a production build this token has no readable name at
all — the same dev-only-message pattern that collapses Angular's runtime errors to a bare code
([03](03-environmentproviders-vs-provider.md)).

🔴 **`HTTP_INTERCEPTORS` on its own does nothing.** The chain is built exclusively from
`HTTP_INTERCEPTOR_FNS` and `HTTP_ROOT_INTERCEPTOR_FNS`; the class-based token is read only by
`legacyInterceptorFnFactory`, which is reachable only if `withInterceptorsFromDi()` was passed. A
provider array containing `HTTP_INTERCEPTORS` entries and no `withInterceptorsFromDi()` compiles,
bootstraps, and silently intercepts nothing.

```ts
// ✅ both halves are required
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: LegacyAuthInterceptor, multi: true },
  provideHttpClient(withInterceptorsFromDi()),
],
```

## The whole legacy set occupies one slot

`withInterceptorsFromDi()` contributes exactly **one** entry to `HTTP_INTERCEPTOR_FNS`, no matter how
many class interceptors are registered. So every class-based interceptor runs as a single block, at
the position where `withInterceptorsFromDi()` sits among the arguments to `provideHttpClient()` —
which is the ordering rule from [10](10-http-features.md) applied to a feature rather than a function:

```ts
provideHttpClient(
  withInterceptors([correlationIdInterceptor]),   // runs first
  withInterceptorsFromDi(),                        // the whole legacy block runs second
  withInterceptors([logInterceptor]),              // runs third
),
```

⚠️ **How the class interceptors order *within* that block is decided inside
`legacyInterceptorFnFactory`, which was not read for this page.** Do not assert that it follows the
`HTTP_INTERCEPTORS` array order — read the factory before you rely on it. The framework's own guidance
points the same way:

> *"HELPFUL: Functional interceptors (through `withInterceptors`) have more predictable ordering and we recommend them over DI-based interceptors."*

## Discouraged, not deprecated — and the difference matters

The JSDoc says both halves plainly:

> *"Includes class-based interceptors configured using a multi-provider in the current injector into the configured `HttpClient` instance."*
> *"Prefer `withInterceptors` and functional interceptors instead, as support for DI-provided interceptors may be phased out in a later release."*

⚠️ **`withInterceptorsFromDi` carries no `@deprecated` tag in v22.1.5** and the public-API golden marks
it plain `// @public`. "May be phased out in a later release" is an intent, not a deprecation, and it
is not the same statement as `HttpClientModule`'s, which *is* deprecated
([02](02-why-provide-functions-replaced-forroot.md)). Conflating the two produces a migration ticket
with the wrong urgency. Note also that the golden's `// @public` is API-Extractor's release tag and
never Angular's stability marker — the trap [08g](08g-tracing-and-the-experimental-end.md) documents
for the router applies verbatim here.

## Migrating one interceptor

```ts
// before — class-based, registered against HTTP_INTERCEPTORS
@Injectable()
export class LegacyAuthInterceptor implements HttpInterceptor {
  constructor(private readonly auth: AuthStore) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.token();
    if (token === null) {
      return next.handle(req);
    }
    return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
}
```

```ts
// after — a function, registered by position
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  if (token === null) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```

Three mechanical differences to check on every conversion: constructor injection becomes `inject()`
called synchronously at the top of the body ([10c](10c-the-interceptor-chain-internals.md)); `next` is
a function rather than an object with `.handle`; and the registration moves out of `providers` into an
array position, which is where the ordering risk lives.

## Gotchas

**★ Symptom: you provided `HTTP_INTERCEPTORS` and the interceptor never runs — no error, no warning.**
Cause: the chain is built from `HTTP_INTERCEPTOR_FNS`; the class token is only consulted through the
bridge. Without `withInterceptorsFromDi()` there is no bridge. Fix: add the feature, or migrate the
class to a function —

```ts
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: LegacyAuthInterceptor, multi: true },
  provideHttpClient(withInterceptorsFromDi()),
],
```

**★ Symptom: you deleted `withInterceptorsFromDi()` while tidying `app.config.ts` and every class
interceptor stopped running, silently.** Cause: the same asymmetry — the `HTTP_INTERCEPTORS` providers
are still perfectly valid providers, they are simply never read. Nothing validates that a registered
interceptor is reachable. Fix: treat `withInterceptorsFromDi()` and the `HTTP_INTERCEPTORS` entries as
one unit; if you remove the feature, remove the providers in the same commit and convert them.

**★ Symptom: converting one class interceptor to a function changed the order of the others.** Cause:
it left the single legacy slot and became its own entry at the position of the `withInterceptors`
argument you added. Fix: keep the relative order explicit while the migration is partial by placing
the new call immediately adjacent to the bridge —

```ts
provideHttpClient(
  withInterceptorsFromDi(),                  // the four that are still classes
  withInterceptors([authInterceptor]),       // the one just converted, still after them
),
```

**Symptom: a colleague opens a ticket to remove `withInterceptorsFromDi()` "because it is deprecated".**
Cause: it is not. The JSDoc says support *may* be phased out in a later release and the golden marks
it `// @public` with no `@deprecated` tag; what is deprecated is `HttpClientModule`, which happens to
call it. Fix: retitle the ticket as a migration to functional interceptors, justified by ordering
predictability, and schedule it — there is no removal date to work back from.

**Symptom: the relative order of two class interceptors changes after an upgrade, or does not match
the order you registered them.** Cause: the block's internal ordering is `legacyInterceptorFnFactory`'s
business, and it is exactly what the setup guide means by functional interceptors having *"more
predictable ordering"*. Fix: convert the pair whose order matters into functional interceptors, where
the order is the array you wrote and nothing else.

## Interview questions

**★ Why does `withInterceptorsFromDi()` provide its function through an intermediate
`LEGACY_INTERCEPTOR_FN` token instead of providing it directly?**
So that repeated inclusion yields the *same function object*. `LEGACY_INTERCEPTOR_FN` is a non-multi
provider, so declaring it twice leaves one record, one factory call and one memoised instance; the
multi entry is `useExisting`, so every copy of it resolves to that same instance. The chain builder
de-duplicates with `Array.from(new Set([...]))`, which compares references — so identical references
collapse and the class interceptors run once. Provide the factory directly on the multi token instead
and each entry invokes it separately, producing distinct closures that nothing can collapse. The
source comment states the intent outright, and this is the framework's own best demonstration that a
`multi` array is de-duplicated on identity, not on equality.

**★ Both interceptor systems exist in v22. Which do you use, and what exactly does the framework say?**
Functional, via `withInterceptors`. The setup guide says *"Functional interceptors (through
`withInterceptors`) have more predictable ordering and we recommend them over DI-based interceptors"*,
and the `withInterceptorsFromDi` JSDoc adds *"Prefer `withInterceptors` and functional interceptors
instead, as support for DI-provided interceptors may be phased out in a later release."* The precise
statement — and the one that matters in a planning meeting — is that the DI bridge is **discouraged
with a stated intent to phase out, not deprecated**: no `@deprecated` tag, no removal version, and a
plain `// @public` entry in the golden.

**Where in the chain do class-based interceptors run when an application uses both systems?**
As one contiguous block, at the argument position of `withInterceptorsFromDi()` in the
`provideHttpClient()` call — because the feature contributes exactly one entry to
`HTTP_INTERCEPTOR_FNS` regardless of how many classes are registered. So they are neither first nor
last by nature; they sit wherever you placed the feature. How they order *among themselves* is decided
inside `legacyInterceptorFnFactory`, which is precisely the unpredictability the guide's recommendation
refers to, and is not something to assert from the `HTTP_INTERCEPTORS` array order without reading it.

**What breaks if you register `HTTP_INTERCEPTORS` and forget `withInterceptorsFromDi()`?**
Nothing breaks — that is the problem. The providers are valid, the injector accepts them, bootstrap
succeeds, and the interceptors are never consulted, because the chain reads only
`HTTP_INTERCEPTOR_FNS` and `HTTP_ROOT_INTERCEPTOR_FNS`. There is no diagnostic for a registered but
unreachable interceptor. In review, treat the token and the feature as a single unit that must appear
or disappear together.

**You have six class-based interceptors to migrate. What is the order-safe procedure?**
Convert them as a set, not one at a time, because each conversion moves an interceptor out of the
single legacy slot into its own array position and therefore changes the relative order of everything
else. If the migration must be incremental, keep the new `withInterceptors([...])` call immediately
adjacent to `withInterceptorsFromDi()` — before it or after it, matching where the converted
interceptor used to sit relative to the block — so the observable order does not move while the set
shrinks. The end state is one `withInterceptors` call containing all six in a written-down order, and
the bridge deleted along with the `HTTP_INTERCEPTORS` providers.

---

← Prev: [Chain internals](10c-the-interceptor-chain-internals.md) · Index: [Topic index](README.md) · Next → [XSRF protection](10e-xsrf-protection.md)
