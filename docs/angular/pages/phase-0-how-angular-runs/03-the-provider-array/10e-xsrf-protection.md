---
title: "`withXsrfConfiguration({})` contributes zero providers and still throws when paired with `withNoXsrfProtection()`, because the contradiction check reads the feature's `ɵkind` and never looks at what it provided — and `withNoXsrfProtection()` does not remove the XSRF interceptor, it flips a flag the interceptor reads"
sidebar_label: "10e · XSRF protection"
sidebar_position: 10.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**. The default cookie and header names were **not read**
> and are deliberately not stated here.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two features configure XSRF and they are the only pair `provideHttpClient` refuses outright. The
interesting part is that the refusal is not about providers — it is about `ɵkind` tags.** The
validation builds a `Set` of the feature kinds and asks whether both are present, so a
`withXsrfConfiguration({})` that contributes literally zero providers still trips it. The second
surprise is what "no XSRF protection" means mechanically: the interceptor is still registered, still
index 0, still runs on every request. It just reads a token that is now `false` and does nothing.

## The two features, in full

```ts
export function withXsrfConfiguration({
  cookieName,
  headerName,
}: {
  cookieName?: string;
  headerName?: string;
}): HttpFeature<HttpFeatureKind.CustomXsrfConfiguration> {
  const providers: Provider[] = [];
  if (cookieName !== undefined) {
    providers.push({provide: XSRF_COOKIE_NAME, useValue: cookieName});
  }
  if (headerName !== undefined) {
    providers.push({provide: XSRF_HEADER_NAME, useValue: headerName});
  }

  return makeHttpFeature(HttpFeatureKind.CustomXsrfConfiguration, providers);
}

export function withNoXsrfProtection(): HttpFeature<HttpFeatureKind.NoXsrfProtection> {
  return makeHttpFeature(HttpFeatureKind.NoXsrfProtection, [
    {
      provide: XSRF_ENABLED,
      useValue: false,
    },
  ]);
}
```

Their JSDoc, which states the incompatibility from both sides:

> *"Customizes the XSRF protection for the configuration of the current `HttpClient` instance."*
> *"This feature is incompatible with the `withNoXsrfProtection` feature."*

> *"Disables XSRF protection in the configuration of the current `HttpClient` instance."*
> *"This feature is incompatible with the `withXsrfConfiguration` feature."*

Three things are readable directly from those bodies.

**Only the fields you supply are provided.** Each `push` is guarded by `!== undefined`, so
`withXsrfConfiguration({headerName: 'X-CSRF-TOKEN'})` overrides the header name and leaves the cookie
name at its default. Passing an explicit `undefined` is identical to omitting the key.

**`withXsrfConfiguration({})` provides nothing at all.** Both guards fail, `providers` stays empty,
and the feature record is `{ɵkind: CustomXsrfConfiguration, ɵproviders: []}` — a call that changes no
behaviour whatsoever and still carries a kind tag.

**Disabling is a value, not a removal.** `withNoXsrfProtection()` provides `XSRF_ENABLED` as `false`;
it does not remove the `{provide: HTTP_INTERCEPTOR_FNS, useValue: xsrfInterceptorFn, multi: true}`
entry that `provideHttpClient` pushed before the feature loop ([10](10-http-features.md)). The
interceptor still occupies index 0 of the chain, still runs on every request, and no-ops because it
reads the flag.

⚠️ **The default cookie and header names are not stated on this page.** They live in the
`XSRF_COOKIE_NAME` and `XSRF_HEADER_NAME` token declarations, which were not read for this chunk. Read
the token definitions or the HTTP security guide before hard-coding a name on the server side — a
guessed default is exactly the kind of confident, specific, wrong fact that survives review.

## The contradiction check reads kinds, not providers

`provideHttpClient` validates before it assembles anything:

```ts
  if (ngDevMode) {
    const featureKinds = new Set(features.map((f) => f.ɵkind));
    if (
      featureKinds.has(HttpFeatureKind.NoXsrfProtection) &&
      featureKinds.has(HttpFeatureKind.CustomXsrfConfiguration)
    ) {
      throw new Error(
        `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the same call to provideHttpClient(), which is a contradiction.`,
      );
    }
```

🔴 **`features.map((f) => f.ɵkind)` never looks at `ɵproviders`.** So the empty
`withXsrfConfiguration({})` above is indistinguishable from a fully populated one as far as the check
is concerned, and the pair throws even though nothing would have conflicted. That is a real bug report
— the fix is to delete the empty call, not to "make it emptier".

Two more properties of that check are worth stating precisely, because both change what you can rely
on:

- It is inside `if (ngDevMode)`, so **a production build performs no validation at all** and simply
  takes both feature's providers. Since `withXsrfConfiguration({})` provides nothing, the effective
  production behaviour of that particular pair is "XSRF disabled", silently.
- It is a plain `new Error`, **not** a `RuntimeError`, so there is **no `NGxxxx` code** to search for.
  Do not expect one, and do not invent one when writing a runbook. The full `provideHttpClient` body
  and its second validation are **09 · `provideHttpClient()` and the backend** *(not written yet)*.

## There is no feature that turns XSRF back on

`XSRF_ENABLED` is a plain, non-multi provider, so within one injector the last record for the token
wins — and `withNoXsrfProtection()` is the only feature in the HTTP surface that provides it. There is
no `withXsrfProtection()`. Once any `provideHttpClient()` call in an injector's array disables it,
nothing in the documented feature surface re-enables it for that injector; a child injector that calls
`provideHttpClient()` afresh gets its own configuration
([10c](10c-the-interceptor-chain-internals.md)).

The NgModule spellings map straight across, and both modules are deprecated
([02](02-why-provide-functions-replaced-forroot.md)): `HttpClientXsrfModule.withOptions(...)` is
`withXsrfConfiguration(...)`, and `HttpClientXsrfModule.disable()` is `withNoXsrfProtection()`.

## Gotchas

**★ Symptom: `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in
the same call to provideHttpClient(), which is a contradiction.` — and your `withXsrfConfiguration`
call is empty.** Cause: the check reads `ɵkind`, never `ɵproviders`, so an empty configuration object
counts as a full one. Fix: delete the call that contributes nothing —

```ts
// ⛔ throws in dev, even though the first call provides no providers at all
provideHttpClient(withXsrfConfiguration({}), withNoXsrfProtection()),

// ✅
provideHttpClient(withNoXsrfProtection()),
```

**★ Symptom: you called `withNoXsrfProtection()` and the XSRF interceptor is still in the chain.**
Cause: the feature sets `XSRF_ENABLED` to `false`; it does not unregister anything, and there is no
mechanism to remove an entry from a `multi` array. The interceptor runs at index 0 on every request
and no-ops. Fix: nothing to fix — that is the design. If an XSRF header is genuinely still being sent,
it is not this interceptor; look for a second `provideHttpClient()` in a nearer injector, or your own
code setting the header.

**★ Symptom: the contradiction throws in `ng serve` and the same configuration ships silently.**
Cause: the whole validation block is `if (ngDevMode)`, so a production build never runs it — and
because `withXsrfConfiguration({})` provides nothing, the surviving behaviour of that pair in
production is XSRF *disabled*. Fix: never treat a dev-only throw as the gate; the configuration must be
correct in the source, and CI must build and boot a development configuration if you want the check to
run at all.

**Symptom: you changed `headerName` and the cookie is still read under the old name.** Cause: each
field is pushed only when it is not `undefined`, so a partial object overrides only what it names. Fix:
supply both when both differ from the defaults —

```ts
provideHttpClient(
  withXsrfConfiguration({ cookieName: 'CSRF-TOKEN', headerName: 'X-CSRF-TOKEN' }),
),
```

**Symptom: `withXsrfConfiguration({ cookieName: options.cookieName })` silently stops overriding when
`options.cookieName` is absent.** Cause: an explicit `undefined` fails the `!== undefined` guard
exactly like a missing key, so the property is never provided. Fix: build the object conditionally
rather than passing possibly-undefined fields —

```ts
const xsrf = options.cookieName === undefined
  ? withXsrfConfiguration({ headerName: options.headerName })
  : withXsrfConfiguration({ cookieName: options.cookieName, headerName: options.headerName });

provideHttpClient(xsrf),
```

**Symptom: one team disables XSRF in a shared `provide*` helper and no other configuration can turn it
back on.** Cause: `XSRF_ENABLED` is provided as `false` and there is no feature that provides it as
`true`; ordinary last-wins cannot help because nothing later provides the token. Fix: remove
`withNoXsrfProtection()` from the shared helper and make it a caller decision — a shared helper that
silently disables a security control for every consumer is the defect, not the ordering.

## Interview questions

**★ `withXsrfConfiguration({})` contributes zero providers. Why does pairing it with
`withNoXsrfProtection()` still throw?**
Because the validation is written over feature *kinds*, not over providers:
`new Set(features.map((f) => f.ɵkind))` and then two `has` calls. Every `with*` function returns a
branded record carrying a `ɵkind` tag whether or not it provides anything, so the empty configuration
is indistinguishable from a populated one at validation time. It is a fair design — the check is meant
to catch a contradictory *intent*, and writing `withXsrfConfiguration({})` alongside
`withNoXsrfProtection()` is contradictory intent even if it happens to be behaviourally inert — but it
does surprise people, and the fix is to delete the inert call rather than to argue with the check.

**★ Does `withNoXsrfProtection()` remove the XSRF interceptor from the chain?**
No. It provides `XSRF_ENABLED` as `false`, and that is all it does. The interceptor was pushed into
`HTTP_INTERCEPTOR_FNS` by `provideHttpClient` before the feature loop ran, it is still index 0, and it
still executes on every request — it reads the flag and does nothing. There is no mechanism in Angular
DI for removing an entry from a `multi` array, which is why every "disable" feature in the framework
is a value override rather than a deletion. The practical consequence is that seeing the interceptor in
a chain dump tells you nothing about whether XSRF is active.

**★ The contradiction check is inside `if (ngDevMode)`. What does that mean for a production
incident?**
It means the misconfiguration does not throw in production — it *resolves*. Both features' providers
are collected as if nothing were wrong, and because `withXsrfConfiguration({})` provides nothing while
`withNoXsrfProtection()` provides `XSRF_ENABLED: false`, the production behaviour of that exact pair is
XSRF quietly disabled. There is also no `NGxxxx` code to grep for, because the throw is a plain
`new Error`, not a `RuntimeError`. So the check is a development aid, not a safety net: the guarantee
has to come from the configuration being right in source and from CI booting a development build.

**Can XSRF be re-enabled after a shared provider helper disabled it?**
Not through the documented feature surface, within the same injector. `withNoXsrfProtection()` is the
only feature that provides `XSRF_ENABLED`, there is no `withXsrfProtection()`, and last-wins cannot
save you because nothing later provides the token. A child injector that calls `provideHttpClient()`
itself gets a fresh configuration and its own handler, so the practical escape is a different injector
rather than a different provider order — and the real fix is that a shared helper should not be
disabling a security control on behalf of its callers.

---

← Prev: [The two interceptor systems](10d-the-two-interceptor-systems.md) · Index: [Topic index](README.md) · Next → [Requests made via parent](10f-requests-made-via-parent.md)
