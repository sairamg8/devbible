---
title: "The HTTP transfer cache is on by default, lives for exactly one window — bootstrap until first stability — and is switched off by mutating an object the provider array hands out, not by a flag anyone reads twice"
sidebar_label: "11d · The HTTP transfer cache"
sidebar_position: 11.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against **Angular 22.1.5** — angular.dev
> [Hydration](https://angular.dev/guide/hydration); and `angular/angular` at tag `v22.1.5`:
> [`platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts),
> [`goldens/public-api/platform-browser/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The transfer cache is the reason a server-rendered Angular page does not fetch everything twice,
and almost nobody configures it, because it is on by default and its two configuration functions are
mutually exclusive with each other and with the default.** It is also the piece of
`provideClientHydration()` with the clearest privacy consequence: whatever it caches is serialised
into the HTML document the browser downloads.

Three things are worth reading carefully — the ternary that decides whether you get the default, the
two-line lifetime mechanism in the tail of the provider array, and what `withNoHttpTransferCache()`
actually costs.

## Options replace the default; they do not layer on it

From the body ([11 · Hydration, animations and the rest](11-hydration-animations-and-the-rest.md)):

```ts
featuresKind.has(HydrationFeatureKind.NoHttpTransferCache) || hasHttpTransferCacheOptions
  ? []
  : ɵwithHttpTransferCache({}),
```

Read the `||`. The default `ɵwithHttpTransferCache({})` call is skipped if **either** the opt-out or
the options feature is present. In the options case that is correct rather than surprising, because
`withHttpTransferCacheOptions(...)` contributes its own `ɵproviders` — pushed into `providers` by the
loop above — carrying the configured version. The default and the configured form are mutually
exclusive by construction, not by a check.

🔴 **The practical consequence is that options are a replacement, not a patch.** If you pass
`withHttpTransferCacheOptions({includeHeaders: ['x-request-id']})`, you are describing the whole
configuration, not adding one field to a default. Anything you leave out takes the library's own
default for that field, not the `{}` call's — and `{}` was the empty object anyway, so in practice
the two coincide today. State everything you want regardless; relying on the coincidence is how a
config breaks the next time the default object gains a field.

The two functions, from the JSDoc:

> *"Disables HTTP transfer cache. Effectively causes HTTP requests to be performed twice: once on the
> server and other one on the browser."* — `withNoHttpTransferCache`

> *"The function accepts an object, which allows to configure cache parameters, such as which headers
> should be included (no headers are included by default), whether POST requests should be cached or
> a callback function to determine if a particular request should be cached."* —
> `withHttpTransferCacheOptions`

Three knobs, then: header inclusion, POST caching, and a per-request predicate. ⚠️ **No headers are
included by default** — that parenthesis is the source of a whole class of "it works against the API
and not after hydration" bugs, covered below.

## The lifetime, and the mutable object that ends it

The last two entries of the returned array are the whole mechanism:

```ts
{
  provide: CACHE_ACTIVE,
  useValue: {isActive: true},
},
{
  provide: APP_BOOTSTRAP_LISTENER,
  multi: true,
  useFactory: () => {
    const appRef = inject(ApplicationRef);
    const cacheState = inject(CACHE_ACTIVE);

    return () => {
      appRef.whenStable().then(() => {
        cacheState.isActive = false;
      });
    };
  },
},
```

🔴 **`CACHE_ACTIVE` is provided as a mutable object, `{isActive: true}`, not as a boolean.** That is
deliberate and it is the only way this could work: a `useValue: true` would be captured by value at
every injection site and could never be changed afterwards. Handing out an object means every
consumer holds the same reference, and flipping one field is visible to all of them immediately.
This is a pattern worth stealing whenever you need a DI-provided value that changes exactly once
during startup.

The listener itself is an `APP_BOOTSTRAP_LISTENER` — the same `multi` token
[06 · Startup and error listener providers](06-startup-and-error-listener-providers.md) covers — and
it does not do the work directly. It returns a function which, when the application bootstraps,
attaches a `.then()` to `appRef.whenStable()`. So the sequence is: bootstrap → listener runs →
subscribes to stability → first stability → `isActive = false`.

**The cache is therefore active from bootstrap until the application first becomes stable, and never
again.** That window is exactly the hydration window, which is the point: it suppresses the
duplicate requests a hydrating client would otherwise make for data the server already fetched, and
then gets out of the way so normal `HttpClient` behaviour resumes. A request your application makes
thirty seconds later, in response to a click, goes to the network like any other.

⚠️ **"First stability" is a property of the whole application, not of your feature.** Anything that
keeps the app un-stable — a long-running timer, a never-completing observable, a pending request —
extends the window for everyone, and anything that makes it stable early ends it. This is the same
`whenStable()` that [11g](11g-the-standalone-core-providers.md)'s stability debugger reports on when
it does not arrive within nine seconds.

## What turning it off actually costs

`withNoHttpTransferCache()` does what its JSDoc says: every request that the server made during
rendering is made again by the browser during hydration. For a page whose server render issued five
API calls, that is five extra round trips on the client, at the exact moment the user is waiting for
interactivity.

There are legitimate reasons to want it — a response containing per-user data you do not want
embedded in a document that might be cached by a CDN, for instance — but the wholesale opt-out is
almost never the right tool for them. The per-request callback in
`withHttpTransferCacheOptions()` expresses the actual requirement: cache the catalogue, do not cache
the account summary.

## Gotchas

**★ Symptom: every request fires twice — once on the server, once again in the browser immediately
after hydration.** Cause: `withNoHttpTransferCache()`. Its own JSDoc says precisely this: *"Disables
HTTP transfer cache. Effectively causes HTTP requests to be performed twice: once on the server and
other one on the browser."* Fix: remove it; if it was added because one response must not be
serialised into the HTML, use the per-request callback in `withHttpTransferCacheOptions()` instead.

**★ Symptom: a response header your client code depends on is missing after hydration, but present
when you call the API directly.** Cause: the transfer cache includes **no headers by default** —
that is the JSDoc's own parenthesis. The cached response the hydrating client reads is not
byte-identical to the one the server received. Fix: name the headers you need in the
`includeHeaders` option, and be deliberate — every header you include is copied into the HTML
payload the browser downloads.

**★ Symptom: a `POST` is repeated on the client after hydration.** Cause: POST caching is a separate
option, and the default does not cache them. Fix: if the POST is genuinely a read disguised as a
write — a search endpoint that takes a body, say — turn POST caching on in the options. If it is a
real mutation, the repetition is a bug in issuing it during server rendering at all, not a cache
setting.

**★ Symptom: per-user data appears in the page source.** Cause: the transfer cache serialises cached
responses into the served HTML, and it is on by default. Fix: exclude those requests with the
per-request callback. ⚠️ Treat this as a review item on any SSR application handling personal data:
the default is "cache everything the server fetched", and the document it lands in is the one you
may also be putting behind a CDN.

**★ Symptom: you pass `withHttpTransferCacheOptions()` and expect it to layer on top of the
defaults.** Cause: it does not — the `||` in the ternary treats the options feature as *replacing*
the default `ɵwithHttpTransferCache({})` call. Fix: state every option you want, not only the ones
you are changing.

**★ Symptom: a request made a few seconds after load, from a click, is not served from the transfer
cache.** Cause: by design — the cache is switched off when the application first becomes stable,
which normally happens before the user can click anything. Fix: nothing, this is correct. If you
wanted a durable client-side cache, that is a different tool entirely; the transfer cache exists
only to stop the hydration double-fetch.

**★ Symptom: the transfer cache seems to stay active far longer than expected.** Cause: the
application is not reaching stability — a `setInterval`, a pending request, or an observable that
never completes will hold `whenStable()` open, and `isActive` is only flipped in its `.then()`. Fix:
diagnose the stability problem itself; `provideStabilityDebugging()` names the offending task, and
[11g](11g-the-standalone-core-providers.md) covers it. The cache behaviour is a symptom here, not
the bug.

## Interview questions

**★ What is the lifetime of the HTTP transfer cache, and what ends it?**
It is active from bootstrap until the application first becomes stable. `provideClientHydration()`
provides `CACHE_ACTIVE` as a mutable object `{isActive: true}` and registers an
`APP_BOOTSTRAP_LISTENER` that sets `isActive` to `false` once `appRef.whenStable()` resolves. That
window is exactly the hydration window: it suppresses the duplicate requests a hydrating client
would otherwise make for data the server already fetched, and then gets out of the way.

**★ Why is `CACHE_ACTIVE` provided as `{isActive: true}` rather than as `true`?**
Because the value has to change after injection. A `useValue: true` is captured by value at every
injection site, so nothing could ever switch it off. Providing an object means every consumer holds
one shared reference and a single field assignment in the bootstrap listener is immediately visible
to all of them. It is the general trick for a DI-provided value that flips once during startup, and
it is worth recognising because the alternative people usually reach for — a `BehaviorSubject` or a
signal — is heavier than the requirement.

**★ You need to keep one endpoint's responses out of the transfer cache because they contain
per-user data. What do you reach for, and what do you have to be careful about?**
`withHttpTransferCacheOptions()` with the per-request callback the JSDoc describes — *"a callback
function to determine if a particular request should be cached"* — not `withNoHttpTransferCache()`,
which disables the cache wholesale and makes every request run twice. Two cautions beyond the API
choice: options **replace** the default configuration rather than merging with it, so restate
everything you want; and the underlying concern is correct, because cached responses are embedded in
the served HTML and readable by anyone who receives that document.

**★ A page's data loads correctly on the server and the client re-fetches all of it. Name three
different causes.**
`withNoHttpTransferCache()` in the config, which is the direct one. A request the client issues after
first stability, which is outside the cache's window by design and is a question about *when* the
client asks rather than *whether* the cache works. Or a request that does not match what the server
made — a different URL, method, or a header-dependent variation — because the cache is keyed on the
request the server actually issued. The order to check them in is config first, then timing, then
request identity.

---

← Prev: [Incremental hydration and event replay](11c-incremental-hydration-and-event-replay.md) · Index: [Topic index](README.md) · Next → [11e · The contradiction checks](11e-the-contradiction-checks.md)
