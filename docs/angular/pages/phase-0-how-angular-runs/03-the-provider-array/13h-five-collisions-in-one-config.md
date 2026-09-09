---
title: "One forty-line `app.config.ts` where five different collision rules apply at once, walked entry by entry — and then the same rules applied across two files by `mergeApplicationConfig`, where the server config wins for the same reason your array beats the framework's"
sidebar_label: "13h · Five collisions in one config"
sidebar_position: 13.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/application/application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every rule in this chunk family is individually obvious and collectively invisible, which is why the
last thing it owes you is one file where all of them are live at once.** The configuration below is
not contrived — every line in it is something a real application has, and it is the accumulation, not
any single line, that makes the outcome hard to predict. Read it, predict the behaviour, then check
yourself against the walkthrough.

## The configuration

```ts
import {ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {provideRouter, withInMemoryScrolling} from '@angular/router';

import {adminRoutes} from './admin/admin.routes';
import {authInterceptor} from './core/auth.interceptor';
import {ConsoleErrorHandler} from './core/console-error-handler';
import {loggingInterceptor} from './core/logging.interceptor';
import {publicRoutes} from './public/public.routes';
import {SentryErrorHandler} from './core/sentry-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(publicRoutes, withInMemoryScrolling({scrollPositionRestoration: 'top'})),
    provideRouter(adminRoutes),
    provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor])),
    provideZoneChangeDetection({eventCoalescing: true}),
    {provide: ErrorHandler, useClass: SentryErrorHandler},
    {provide: ErrorHandler, useClass: ConsoleErrorHandler},
  ],
};
```

## The walkthrough, entry by entry

**`provideRouter` twice — `ROUTES` accumulates.** Two `{provide: ROUTES, multi: true}` entries, so
`inject(ROUTES).flat()` yields `[...publicRoutes, ...adminRoutes]` in that order. If `publicRoutes`
ends in a `{path: '**'}` wildcard — and public route tables usually do — every admin route is
unreachable, with no error and no warning. The route table is not the only casualty: two
`APP_BOOTSTRAP_LISTENER` entries are registered too, so initial navigation, preloading setup and the
scroller's `init()` each run twice ([13e](13e-multi-tokens-append.md)).

**`withInMemoryScrolling` is attached to the first call only — and that does not matter.** The
feature contributes `{provide: ROUTER_SCROLLER, useFactory: …}`, a non-multi token in the application
injector; there is exactly one entry for it, so the scroller is configured. Features are not scoped to
"their" route table. This is the one line in the file whose position genuinely does not matter.

**`withInterceptors([authInterceptor, loggingInterceptor])` — array order is execution order.** The
registered array is `xsrfInterceptorFn, authInterceptor, loggingInterceptor`, because
`provideHttpClient` pushes the XSRF entry into its base array before the feature loop runs. So the
outbound order is XSRF, then auth, then logging — meaning `loggingInterceptor` sees the request *after*
`authInterceptor` has attached its header, which may or may not be what the person who wrote "logging"
wanted ([10b](10b-choosing-interceptor-positions.md)).

**`provideZoneChangeDetection({eventCoalescing: true})` — overrides a default you never wrote.** The
framework prepended `{provide: ZONELESS_ENABLED, useValue: true}` and `{provide: NgZone, useClass: NoopNgZone}`
via `provideZonelessChangeDetectionInternal()`, and your array is spread last into `allAppProviders`,
so `false` and a real `NgZone` win. No warning fires, because `provideZonelessChangeDetection()` was
never *called* — NG0408 checks the intent markers, not the mode
([13c](13c-last-wins-in-practice.md)).

**Two `ErrorHandler` providers — the last one silently wins.** `ConsoleErrorHandler` is the effective
handler. `SentryErrorHandler` is imported, bundled, registered, and never constructed. Nothing warns,
because a duplicate non-multi provider is the same operation the framework relies on for every one of
its own defaults. This is the entry most likely to survive code review, and the one whose failure mode
is worst: production errors stop reaching your error tracker and the application looks healthy.

**`provideBrowserGlobalErrorListeners()` — order-independent here, but not unrelated.** It writes no
token that anything else in this file writes, so it can sit anywhere. It does, however, route uncaught
errors through the application's `ErrorHandler`, which is the token the previous paragraph just broke
— so the two entries interact through *behaviour* while being independent in *ordering*
([06g](06g-error-handler-and-ng0402.md)).

## The same file, fixed

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter([...adminRoutes, ...publicRoutes], withInMemoryScrolling({scrollPositionRestoration: 'top'})),
    provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor])),
    provideZoneChangeDetection({eventCoalescing: true}),
    {provide: ErrorHandler, useClass: SentryErrorHandler},
  ],
};
```

Four changes, and each one removes a collision rather than reordering around it: one `provideRouter`
call with the wildcard-bearing table last, one `ErrorHandler`, and the interceptor array left explicit
so its order is a visible decision. The result has **exactly one entry per token**, which is the
property that makes a provider array safe to refactor — with one entry per token, position is
irrelevant, and it stays irrelevant when somebody spreads a helper constant into the middle of it next
quarter.

## Order dependence across two files — `mergeApplicationConfig`

The whole function, from
[`core/src/application/application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts):

```ts
/**
 * Merge multiple application configurations from left to right.
 *
 * @param configs Two or more configurations to be merged.
 * @returns A merged [ApplicationConfig](api/core/ApplicationConfig).
 *
 * @publicApi
 */
export function mergeApplicationConfig(...configs: ApplicationConfig[]): ApplicationConfig {
  return configs.reduce(
    (prev, curr) => {
      return Object.assign(prev, curr, {providers: [...prev.providers, ...curr.providers]});
    },
    {providers: []},
  );
}
```

🔴 **It is a concatenation, not a merge.** Nothing is de-duplicated, replaced or reconciled — the
providers arrays are spread end to end. So "merge from left to right" cashes out as: **the rightmost
config's providers are last in the flattened array, and therefore win every non-multi collision.**
That is the same `Map.set` from [13](13-order-dependence.md), applied one level up.

The CLI's generated server configuration relies on exactly this:

```ts
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

`appConfig` first, `serverConfig` second — so anything the server config provides beats the browser
config for the same token, which is the intended direction. Reverse the arguments and the browser
config wins, silently:

```ts
// ⛔ The server's overrides are now dead for every non-multi token.
export const config = mergeApplicationConfig(serverConfig, appConfig);
```

And the multi half applies too: a `provideAppInitializer()` in each config produces **two**
initializers on the server, both of which run, and a `provideRouter()` in each produces two route
tables. **17 · The server config merge** *(not written yet)* is the chunk that covers the server
surface itself; what belongs here is that `mergeApplicationConfig` introduces no new rule at all — it
is array concatenation feeding the same two operations.

⚠️ One detail worth reading carefully: `Object.assign(prev, curr, {providers: […]})` passes the
combined providers array as a **third** argument, so it overwrites the `providers` key that `curr`
just wrote onto the accumulator. Without that third argument a plain `Object.assign(prev, curr)` would
discard `prev.providers` entirely. The function is correct; it is just correct in a way that rewards a
second reading.

## Gotchas

**★ Symptom: your error tracker stopped receiving anything after a release, and the application is
otherwise healthy.** Cause: a second `{provide: ErrorHandler, …}` entered the array — often through a
shared providers constant — and last-wins silently retired the tracker's handler. Fix: one
`ErrorHandler` entry in the whole configuration, and if two behaviours are genuinely wanted, compose
them in one class rather than providing twice:

```ts
{
  provide: ErrorHandler,
  useFactory: () => new CompositeErrorHandler([new SentryErrorHandler(), new ConsoleErrorHandler()]),
}
```

**★ Symptom: admin routes 404 in production but work when you navigate directly during development.**
Cause: two `provideRouter()` calls, and the first table's `{path: '**'}` shadows the second table
after `.flat()`. The direct-navigation case can mask it if the wildcard's component happens to
redirect. Fix: one call, wildcard-bearing table last:
`provideRouter([...adminRoutes, ...publicRoutes])`.

**★ Symptom: a router feature attached to the "wrong" `provideRouter()` call appears to be ignored.**
Cause: it is not ignored — features write application-level tokens and are not scoped to the route
table they were passed alongside. If a feature seems inactive, the cause is a second entry for the
same token, not the call it was attached to. Fix: check for a duplicate feature or a hand-written
provider for that token ([13c](13c-last-wins-in-practice.md)).

**★ Symptom: `mergeApplicationConfig(serverConfig, appConfig)` and the server behaves like the
browser.** Cause: the function concatenates left to right, so the *last* argument's providers are
later in the flattened array and win. Reversing the arguments reverses every non-multi override at
once. Fix: `mergeApplicationConfig(appConfig, serverConfig)` — the order the CLI generates, for this
reason.

**★ Symptom: an app initializer runs twice under SSR and once in the browser.** Cause: it is provided
in both `appConfig` and the server config, and `APP_INITIALIZER` is multi — concatenation appends, so
the server injector has two entries. Fix: provide it once, in the shared browser config, and reserve
the server config for providers that are genuinely server-only.

**★ Symptom: you added a provider to the merged `config` object rather than to either input, and it
lost to something in `appConfig`.** Cause: `mergeApplicationConfig` returns a new object whose
`providers` is already the concatenation; pushing onto it afterwards appends at the end and *wins*,
while re-declaring `providers` replaces the concatenation entirely. Fix: put the provider in the
config it belongs to and let the merge do the ordering — mutating the merged result is how a
configuration stops being readable.

**★ Symptom: a review passed a configuration with two entries for one token because both entries were
individually correct.** Cause: nothing in the toolchain flags it — not the compiler, not the injector,
not the linter. Duplicate non-multi providers are legal by design. Fix: adopt the one-entry-per-token
rule as a review checklist item, and prefer composing behaviour inside a single provider to listing
two.

## Interview questions

**★ Walk me through what this configuration actually does.** *(the twenty lines at the top of this
page)*
Two `provideRouter` calls give one concatenated route table with `publicRoutes` first, so a wildcard
there shadows the admin routes, plus two bootstrap listeners that each run initial navigation and
preloader setup. `withInMemoryScrolling` is fine wherever it sits, because it writes a non-multi
application-level token with no competitor. The interceptor chain is XSRF, auth, logging, because XSRF
is pushed before the feature loop and the array literal is the execution order.
`provideZoneChangeDetection` beats the framework's zoneless defaults because your array is spread last
into `allAppProviders`, and it warns about nothing because `provideZonelessChangeDetection` was never
called. And `ConsoleErrorHandler` silently replaces `SentryErrorHandler`. Five rules, one file, one
diagnostic between them — and the diagnostic that does exist is for a case this file does not contain.

**★ `mergeApplicationConfig(appConfig, serverConfig)` — which config wins, and is "wins" even the
right word?**
The right-hand one wins for non-multi tokens, and "wins" is the right word only for those. The
function is `Object.assign(prev, curr, {providers: [...prev.providers, ...curr.providers]})` folded
left, so the result is a plain concatenation with the server's providers last; the injector then
applies last-wins per token. For multi tokens nothing wins — both contribute, so an app initializer
declared in both configs runs twice on the server. It is worth saying explicitly that
`mergeApplicationConfig` introduces no merge semantics of its own; it is array concatenation, and every
observable consequence comes from `processProvider`.

**★ You inherit a 60-line `app.config.ts` with an intermittent bug. What is your first move, and what
is explicitly not?**
The first move is to list, per token, how many entries in the *flattened* array write it — expanding
every helper constant and reading the body of every `provide*` call. What is explicitly not a move is
reordering, because a reorder flips every colliding token simultaneously and produces no diagnostic
for any of them; a configuration that starts working after a swap has told you nothing about which
collision was the bug. The endpoint is one entry per token, at which point ordering stops being a
variable at all.

**Why does the fixed version of the configuration not simply reorder the two `ErrorHandler` entries?**
Because two entries for one non-multi token is the defect, not their order. Leaving both in place and
putting the wanted one last produces correct behaviour and preserves a trap: the next person to
introduce a shared providers constant, or to spread this array into a `mergeApplicationConfig` call,
moves the winner without touching either line. Deleting the loser makes the outcome independent of
position, which is the only durable state.

**Is there any legitimate reason to provide the same non-multi token twice in one array?**
Not within one array you control. The legitimate use of last-wins is *across* boundaries — your array
beating the framework's prepended defaults, or a server config beating a browser config — where the
two entries are in different files owned by different concerns and the override is the deliberate
interface between them. Two entries in one literal have no such separation, and the second one is
always either a mistake or an undocumented decision.

{/* FOOTER */}
