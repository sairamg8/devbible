---
title: "The four `@angular/core` providers that belong to no subsystem — a debugger the docs promise will not be tree-shaken, a token override that costs nothing until you use it, an attribute switch whose deprecation applies to the attributes and not the function, and one tagged `@experimental`"
sidebar_label: "11g · The standalone core providers"
sidebar_position: 11.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts),
> [`core/src/application/stability_debug_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/stability_debug_impl.ts),
> [`core/src/defer/idle_service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/idle_service.ts),
> [`core/src/webmcp/provide_tools.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/webmcp/provide_tools.ts),
> and the `core` public-API golden. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These four take no features, belong to no subsystem, and turn up in `app.config.ts` one at a
time — usually because somebody was debugging something.** They are grouped here because that is
genuinely what they have in common, and because each carries one fact that is easy to get wrong: a
deprecation that applies to the output rather than the function, a provider that the documentation
promises will *not* be removed from production, a default that costs nothing until you override it,
and an `@experimental` tag that means no deprecation period is owed.

## `provideNgReflectAttributes()`

From [`core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts):

> *"Enables the logic to produce `ng-reflect-*` attributes on elements with bindings."*
>
> *"Note: this is a dev-mode only setting and it will have no effect in production mode. In
> production mode, the `ng-reflect-*` attributes are *never* produced by Angular."*
>
> *"Important: using and relying on the `ng-reflect-*` attributes is not recommended, they are
> deprecated and only present for backwards compatibility. Angular will stop producing them in one
> of the future versions."*

⚠️ **Be precise about what is deprecated here.** The *attributes* are described as deprecated in
prose; the **function is not tagged `@deprecated`** — the golden carries a plain `// @public`. So a
codebase calling `provideNgReflectAttributes()` gets no strikethrough in the editor, no `ng update`
migration, and no build warning. The only signal is the sentence above, and the deadline is
"one of the future versions", which is deliberately not a version number.

Note also the first Note: this is **dev-mode only and has no effect in production**, which is the
opposite arrangement to `provideStabilityDebugging()` below. If your tests select on `ng-reflect-*`
attributes, that is the thing with a shelf life, and the fix is a test id attribute rather than a
framework flag — because the attributes are going away whether or not the function does.

## `provideStabilityDebugging()`

From [`core/src/application/stability_debug_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/stability_debug_impl.ts):

> *"Provides an application initializer that will log information about what tasks are keeping the
> application from stabilizing if the application does not stabilize within 9 seconds."*
>
> *"The logged information includes the stack of the tasks preventing stability. This stack can be
> traced back to the source in the application code."*
>
> *"If you are using Zone.js, it is recommended that you also temporarily import
> \"zone.js/plugins/task-tracking\"."*
>
> *"IMPORTANT: Neither the zone.js task tracking plugin nor this utility are removed from production
> bundles. They are intended for temporary use while debugging stability issues during development,
> including for optimized production builds."*
>
> `@publicApi 21.1`

```ts
import 'zone.js/plugins/task-tracking';

bootstrapApplication(AppComponent, {providers: [provideStabilityDebugging()]});
```

🔴 **Two facts that only bite in combination.** [`provideClientHydration()` already adds it in dev
mode](11-hydration-animations-and-the-rest.md), so under SSR you usually have it without asking; and
it is **explicitly not stripped from production bundles**. Adding it by hand while debugging and
forgetting to remove it is therefore a real, permanent shipping cost.

Read charitably, though, the IMPORTANT is not a warning so much as a design statement: *"including
for optimized production builds"* means it is meant to be usable against a production build you are
diagnosing, which is exactly the situation where a stability bug is most likely to appear and least
likely to reproduce locally. It is a tool you deliberately leave in for a while — not one you leave
in forever.

The **9-second** threshold is the number to remember, because it makes the diagnostic legible:
silence is the pass condition. If you see output, the application has been un-stable for nine
seconds, and the stack it prints names the task holding it — usually a timer, a never-completing
observable, or a pending HTTP request. That same stability point is what ends the transfer cache's
window in [11d](11d-the-http-transfer-cache.md), which is why a hanging application and a
long-lived transfer cache are the same bug seen from two directions.

## `provideIdleServiceWith()`

From [`core/src/defer/idle_service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/idle_service.ts):

> *"Configures Angular to use the given DI token as its `IdleService`."*
>
> *"The given token must be available for injection from the root injector, and the injected value
> must implement the `IdleService` interface."*

with the token it overrides:

```ts
export const IDLE_SERVICE = new InjectionToken<IdleService>(ngDevMode ? 'IDLE_SERVICE' : '', {
  factory: () => new RequestIdleCallbackService(),
});
```

Two details here generalise well past this provider.

**The default is a tree-shakable `factory` on the token itself**, not an entry in some root
providers array. An application that never overrides it pays nothing for the possibility of
overriding — the mechanism is the token's own factory, and the override is a normal provider that
happens to win. This is the shape [14 · `providedIn: 'root'` vs listing in the array](README.md)
exists to compare, met here in its purest form.

**The description string is `ngDevMode ? 'IDLE_SERVICE' : ''`.** That is the framework's standard
trick for keeping a readable token name in development while dropping the string literal from the
production bundle — the token's description is only ever used to build error messages, which
production does not produce in full anyway. When you write your own `InjectionToken` on a hot path,
that is the pattern to copy.

The `IdleService` behind it is what a `@defer (on idle)` block uses to decide the browser is idle,
which is why the override exists at all: `requestIdleCallback` behaves inconsistently under some
test runners and embedded browsers, and swapping the implementation through DI is more honest than
monkey-patching the global.

## `provideExperimentalWebMcpTools()`

From [`core/src/webmcp/provide_tools.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/webmcp/provide_tools.ts) — 🔴 note the tag:

> *"Provides a list of WebMCP tools tied to the lifecycle of the associated `Injector`."*
>
> *"The tools are automatically registered when the environment is initialized and unregistered when
> the associated injector is destroyed."*
>
> *"The `tools[number].execute` function is invoked in the injection context of the associated
> `Injector`."*
>
> *"@returns An `{@link EnvironmentProviders}` that can be used in `bootstrapApplication` or route
> providers."*
>
> `@experimental`

**`@experimental`, not `@publicApi`** — no deprecation period is owed and the signature may change
in a minor. The name carries the warning in the identifier itself, which is the convention this
topic met before at
[08g · Tracing and the experimental end](08g-tracing-and-the-experimental-end.md): Angular's
experimental surface is usually labelled twice, in the tag and in the name, so that a reader of the
call site sees it without opening the docs.

Three structurally interesting lines. The tools are registered on **environment initialization** and
unregistered on **injector destruction**, so the lifetime is the injector's rather than the
application's. `execute` runs **in the injection context** of that injector, which means a tool can
call `inject()` directly instead of capturing services in a closure. And the return type is
`EnvironmentProviders` with the doc explicitly sanctioning **route providers** — which is the
pattern **15 · Route-level `providers`** *(not written yet)* exists to cover, and the reason the
injector-scoped lifetime is a feature rather than an implementation detail: register a lazy
feature's tools with that feature's route, and they disappear when the user navigates away.

## Gotchas

**★ Symptom: `provideStabilityDebugging()` is still in your production bundle.** Cause: by design.
The JSDoc's IMPORTANT states it is not removed from production bundles, deliberately, so it can be
used against an optimised build. Fix: remove the call when you are done debugging — nothing else
will. And check whether you needed it: under SSR, `provideClientHydration()` installs it in dev mode
already.

**★ Symptom: you add `provideStabilityDebugging()` and get no output at all.** Cause: the
application stabilised. The initializer logs only if stability is not reached **within 9 seconds** —
silence is the pass condition, not a wiring failure. ⚠️ If you are on Zone.js and the output names
no useful stack, the JSDoc's other recommendation applies: temporarily import
`zone.js/plugins/task-tracking`.

**★ Symptom: your SSR dev build already logs stability diagnostics and you never configured
anything.** Cause: `provideClientHydration()` installs `provideStabilityDebugging()` behind its
dev-mode ternary. Fix: nothing — read the output. This is also why hand-adding it for an SSR
debugging session is usually redundant.

**★ Symptom: `ng-reflect-*` attributes are missing in production and your end-to-end tests select on
them.** Cause: the JSDoc is explicit — *"In production mode, the `ng-reflect-*` attributes are
*never* produced by Angular"* — and `provideNgReflectAttributes()` is a dev-mode-only setting. Fix:
select on a `data-testid` instead. The attributes are additionally described as deprecated, so this
is worth doing before the removal rather than after.

**★ Symptom: you searched for a `@deprecated` tag on `provideNgReflectAttributes` to justify
removing it, and found none.** Cause: the deprecation in the doc comment is about the
`ng-reflect-*` **attributes**, not about the function; the golden marks the function plain
`// @public`. Fix: make the argument on the attributes, which is where the deprecation actually is —
and do not report the function as deprecated, because a reviewer checking will find it is not.

**★ Symptom: `@defer (on idle)` never fires under your test runner.** Cause: the runner's
`requestIdleCallback` never calls back, and the default `IDLE_SERVICE` factory is
`RequestIdleCallbackService`. Fix: `provideIdleServiceWith()` with a token whose value implements
`IdleService` — that is what the provider exists for. ⚠️ The token must be injectable **from the
root injector**; the JSDoc says so, and a token provided at a route will not satisfy it.

**★ Symptom: you provided your own idle service and the type checks pass but nothing changes.**
Cause: `provideIdleServiceWith()` takes the **token**, not the implementation — *"Configures Angular
to use the given DI token as its `IdleService`"* — so the token you pass must itself be provided
somewhere the root injector can see. Fix: provide the token as well as naming it.

**★ Symptom: `provideExperimentalWebMcpTools` disappeared or changed shape in a minor upgrade.**
Cause: it is `@experimental`, so no deprecation period is owed and the usual "one major of runway"
expectation does not apply. Fix: pin your expectations to the tag, not to the version number — this
is the same contract as the experimental router surface in
[08g](08g-tracing-and-the-experimental-end.md).

**★ Symptom: a WebMCP tool's `execute` cannot reach a service you expected it to have.** Cause: it
runs in the injection context of the **associated injector** — the one whose providers array
contained the call. A tool registered at the application root cannot see a service provided at a
route. Fix: register the tools at the injector that has the services, which is what the route-provider
support in the return type is for.

## Interview questions

**★ Someone adds `provideStabilityDebugging()` to diagnose a hanging SSR build and leaves it in.
What have they shipped?**
The stability debugger, in production, permanently — its JSDoc states outright that neither it nor
the Zone.js task-tracking plugin is removed from production bundles, and that this is intentional so
it can be used against optimised builds. There is a second, subtler waste: under SSR
`provideClientHydration()` already installs it in dev mode, so the hand-added call was probably
redundant for the debugging session it was added for.

**★ `IDLE_SERVICE` is declared as `new InjectionToken(ngDevMode ? 'IDLE_SERVICE' : '', {factory: …})`.
Explain both halves.**
The `factory` makes the default tree-shakable and self-contained: the token knows how to build its
own value, so no root providers entry is needed and an application that never overrides it pays
nothing. The `ngDevMode` ternary on the description keeps a readable name for development error
messages while dropping the string literal from production, where those messages are minified
anyway. Together they are the framework's default shape for "a replaceable default that costs
nothing", and both halves are worth copying in application code.

**★ What is the difference between `@experimental` and `@deprecated` as a planning input?**
`@deprecated` is a promise about the past: the API works now, and there is a stated removal version
you can plan against — `provideAnimationsAsync` naming v23, for instance. `@experimental` is the
absence of a promise about the future: no deprecation period is owed, so the shape can change in a
minor release. Practically, deprecated code is safe to keep and schedule; experimental code is safe
to try and must be re-checked on every upgrade. `provideExperimentalWebMcpTools` also carries the
warning in its identifier, so a call site announces it without documentation.

**★ Why does `provideNgReflectAttributes()` exist at all if the attributes it enables are deprecated
and dev-mode only?**
Because the attributes used to be produced unconditionally in development and were removed from that
default, which broke tooling and tests that relied on them. The provider is the compatibility door:
it lets a codebase that has not yet migrated turn them back on in development while it does. That
is why the function carries no deprecation of its own — the deprecation belongs to the attributes,
and the function is the thing making a deprecated feature survivable in the meantime.

---

← Prev: [Animations are deprecated](11f-animations-are-deprecated.md) · Index: [Topic index](README.md) · Next → **12 · What does *not* belong in the array** *(not written yet)*
