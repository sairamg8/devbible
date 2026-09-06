---
title: "Requests pass through `withInterceptors([a, b, c])` in the order you wrote it and responses unwind in the reverse of it — one `reduceRight` in `HttpInterceptorHandler` is the entire proof, and array position is the only ordering API there is"
sidebar_label: "10 · Interceptor order"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Interceptor order is the most-asked and most-guessed question about `HttpClient`, and it is not a
convention — it is two lines of code. `withInterceptors` maps your array to one `multi: true` provider
per function, so the array index becomes the multi-array index; `HttpInterceptorHandler` then folds
that multi array with `reduceRight`, which makes the *first* entry the outermost wrapper and therefore
the first to see a request and the last to see a response.** There is no priority field, no `order`
option and no sort anywhere in the HTTP package. This chunk proves the rule from the source and traces
the fold step by step, including the one place the framework's own comment reads backwards.

## Registration — one `multi` provider per function, in array order

`withInterceptors` is a `.map`, and nothing else
([`provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts)):

```ts
export function withInterceptors(
  interceptorFns: HttpInterceptorFn[],
): HttpFeature<HttpFeatureKind.Interceptors> {
  return makeHttpFeature(
    HttpFeatureKind.Interceptors,
    interceptorFns.map((interceptorFn) => {
      return {
        provide: HTTP_INTERCEPTOR_FNS,
        useValue: interceptorFn,
        multi: true,
      };
    }),
  );
}
```

`.map` preserves order and `multi: true` **appends**, so `withInterceptors([a, b, c])` produces three
provider records that land in the multi array as `a, b, c`. The token itself is one line, and its doc
comment is the whole contract
([`interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts)):

> *"A multi-provided token of `HttpInterceptorFn`s."*

One entry is already in that array before your first feature is read. `provideHttpClient` pushes the
XSRF interceptor into its base provider list and *then* loops over the features:

```ts
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useValue: xsrfInterceptorFn,
      multi: true,
    },
  ];

  for (const feature of features) {
    providers.push(...feature.ɵproviders);
  }
```

🔴 **So index 0 is always `xsrfInterceptorFn`**, whatever you pass to `withInterceptors`. That is not
a documented promise — it is a consequence of where the push sits relative to the loop, and it is
deliberate: a request cannot leave the application without the XSRF interceptor having had first
refusal. The loop is also why **the order of the feature arguments themselves matters**, which is the
part people miss. The full `provideHttpClient` body is
[09 · `provideHttpClient()` and the backend](09-provide-http-client-and-the-backend.md).

## Execution — `reduceRight`, and the comment that states the rule

The chain is assembled inside `HttpInterceptorHandler.handle`
([`backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts)):

```ts
      // Note: interceptors are wrapped right-to-left so that final execution order is
      // left-to-right. That is, if `dedupedInterceptorFns` is the array `[a, b, c]`, we want to
      // produce a chain that is conceptually `c(b(a(end)))`, which we build from the inside
      // out.
      this.chain = dedupedInterceptorFns.reduceRight(
        (nextSequencedFn, interceptorFn) =>
          chainedInterceptorFn(nextSequencedFn, interceptorFn, this.injector),
        interceptorChainEndFn as ChainedInterceptorFn<unknown>,
      );
```

The load-bearing sentence is the framework stating its own rule:

> *"interceptors are wrapped right-to-left so that final execution order is left-to-right."*

How `dedupedInterceptorFns` is assembled — the de-duplication, the memoisation and the root
interceptors spliced onto the end — is [10c](10c-the-interceptor-chain-internals.md). This section is
only about what the fold does with it.

### Trace the fold rather than trusting the shorthand

`Array.prototype.reduceRight` takes the accumulator as its **first** parameter and visits elements
from the end. Here the accumulator is `nextSequencedFn` — the "next" that will be handed to the
interceptor currently being wrapped. For `[auth, normalize, log]`:

| Step | Element visited | Accumulator in | Accumulator out |
|---|---|---|---|
| seed | — | — | `interceptorChainEndFn` — the innermost link, which dispatches to the backend |
| 1 | `log` | `end` | `L = chainedInterceptorFn(end, log)` |
| 2 | `normalize` | `L` | `N = chainedInterceptorFn(L, normalize)` |
| 3 | `auth` | `N` | `A = chainedInterceptorFn(N, auth)` |

`this.chain` is `A`, the wrapper built **last**, so it is the **outermost** and the first thing a
request meets. `auth`'s `next` is `N`; `normalize`'s `next` is `L`; `log`'s `next` reaches the
backend. Execution is `auth → normalize → log → backend`: the array, read left to right.

⚠️ **The comment's shorthand `c(b(a(end)))` reads backwards, and it is worth knowing that before you
quote it in a code review.** Under the natural reading of `f(x)` as "`f` wraps `x`", the fold above
produces `a(b(c(end)))`; under the "built from" reading, the first thing built is `c`'s wrapper, so
the expression is *still* `a(b(c(end)))`. The letters in the shorthand are the reverse of the letters
in the code either way. **The first sentence of the comment is the normative one**, it agrees with the
code, and the trace above is what actually happens.

### Responses unwind through the same nest, outward

Each interceptor returns the observable it built on top of `next(req)`, so `log` pipes onto the
backend's observable, `normalize` pipes onto `log`'s, and `auth` pipes onto `normalize`'s. For every
`HttpEvent` that comes back, the operators registered in the **last** interceptor run first and those
in the **first** interceptor run last. Requests go down the array; responses and errors come back up
it. What that means for where you put a logger, an error normaliser or a cache — and why no single
position does two jobs — is [10b](10b-choosing-interceptor-positions.md).

## Gotchas

**★ Symptom: the interceptor you listed first appears to run second.** Cause: it is never the ordering
rule — array order *is* execution order, proved by the fold above. Something else added an entry: a
second `provideHttpClient()` in a nearer injector (its handler has its own chain), an
`HTTP_ROOT_INTERCEPTOR_FNS` registration, which is always spliced in *after* yours
([10c](10c-the-interceptor-chain-internals.md)), or a `withInterceptorsFromDi()` block sitting at a
different feature position ([10d](10d-the-two-interceptor-systems.md)). Fix: put every functional
interceptor in **one** `withInterceptors` call, so the array you read is the array that runs —

```ts
provideHttpClient(
  withInterceptors([authInterceptor, normalizeInterceptor, logInterceptor]),
),
```

**★ Symptom: two `withInterceptors(...)` calls in one `provideHttpClient()`, and you expect the second
to replace the first.** Cause: features are pushed in argument order —
`for (const feature of features) providers.push(...feature.ɵproviders)` — and the token is `multi`, so
**both arrays register and concatenate**. `provideHttpClient(withInterceptors([a]), withInterceptors([b]))`
runs `a` then `b`. Nothing is replaced and nothing warns. Fix: one call, one array.

**★ Symptom: you assumed the class-based interceptors run before, or after, all the functional ones.**
Cause: `withInterceptorsFromDi()` contributes exactly one entry to the same multi array, and
`withJsonpSupport()` contributes one more, so **each lands wherever its feature sits in the argument
list** — not first, not last. Fix: read the feature argument order as interceptor order and write it
deliberately —

```ts
provideHttpClient(
  withInterceptorsFromDi(),                        // the whole legacy block runs at this position
  withInterceptors([normalizeInterceptor, logInterceptor]),
),
```

**Symptom: you added a `priority` or `order` property to your interceptor and it is ignored.** Cause:
there is no such option. `HttpInterceptorFn` is a bare function type, `withInterceptors` reads nothing
but the array, and the fold applies no comparator. Fix: express priority as position, and if the
ordering is load-bearing, name it in the array itself so a reviewer cannot reorder it innocently —

```ts
// order is the contract: auth must precede the logger, the logger must be last
export const API_INTERCEPTOR_CHAIN: HttpInterceptorFn[] = [
  authInterceptor,
  normalizeInterceptor,
  logInterceptor,
];

provideHttpClient(withInterceptors(API_INTERCEPTOR_CHAIN)),
```

## Interview questions

**★ Is `withInterceptors([a, b, c])` executed `a, b, c` or `c, b, a`, and what in the source settles
it?**
`a, b, c`. Two things settle it. `withInterceptors` is a `.map` producing one `multi: true` provider
per function, so array index becomes multi-array index; then `HttpInterceptorHandler.handle` folds
that array with `reduceRight`, whose accumulator is the "next" handed to each interceptor. Because
`reduceRight` visits from the right, the wrapper for `a` is built **last** and is therefore the
outermost — the first to receive a request. The source comment says it outright: *"interceptors are
wrapped right-to-left so that final execution order is left-to-right."* Be ready for the follow-up
about that comment's `c(b(a(end)))` shorthand: it is the reverse of what the fold builds, and the
sentence, not the shorthand, is what matches the code.

**★ Where does the XSRF interceptor sit, and can anything get in front of it?**
Index 0, always. `provideHttpClient` pushes `{provide: HTTP_INTERCEPTOR_FNS, useValue: xsrfInterceptorFn, multi: true}`
into its base provider array *before* the `for (const feature of features)` loop, so every entry from
every feature lands after it. Nothing you pass to `provideHttpClient()` can precede it — which is the
point: a request cannot leave without the XSRF interceptor having had a chance to attach the token.
The only construction that could conceivably beat it is a raw `HTTP_INTERCEPTOR_FNS` multi provider
placed earlier in the same `providers` array; the record ordering between a plain provider and an
`EnvironmentProviders` value in one array was not verified for this page, so do not build on it in
either direction. **13 · Order dependence** *(not written yet)* is where that belongs.

**★ Does the order of the arguments to `provideHttpClient()` matter?**
For interceptors, yes — and that surprises people who have learned that most `with*` features are
order-independent. The features are drained by a plain `for` loop that spreads each feature's
`ɵproviders` into one array, so anything a feature contributes to a `multi` token inherits the
argument position. `withInterceptors`, `withInterceptorsFromDi` and `withJsonpSupport` all contribute
to `HTTP_INTERCEPTOR_FNS`, so their relative argument order is their relative execution order. For
features that contribute ordinary single-token providers — the backend swap, the XSRF configuration —
the last one wins instead, which is a different rule for the same loop.

**Registration happens at bootstrap and requests happen much later. Does the *time* an interceptor was
registered affect where it runs?**
No. Nothing in the chain looks at registration time; the fold reads one array, in index order, the
first time a handler serves a request. What creates the illusion of a time effect is that different
injectors have different handlers and therefore different arrays — a lazily loaded route that calls
`provideHttpClient()` builds a fresh chain, so an interceptor registered "later" in wall-clock terms
may genuinely run first, because it is at index 1 of a different array. The mechanism there is one
handler per configuring injector, covered in [10c](10c-the-interceptor-chain-internals.md).

---

← Prev: [09e · `HttpClientModule`, the end of the road](09e-httpclientmodule-end-of-the-road.md) · Index: [Topic index](README.md) · Next → [Choosing interceptor positions](10b-choosing-interceptor-positions.md)
