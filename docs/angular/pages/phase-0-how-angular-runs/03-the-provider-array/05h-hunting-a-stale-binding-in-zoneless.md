---
title: "A zoneless application that mutates state outside the notification set renders the wrong value and reports nothing, and a periodic exhaustive `checkNoChanges` is the only supported way to make that silence audible"
sidebar_label: "05h · Hunting a stale binding"
sidebar_position: 5.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless) (both sentences on
> `provideCheckNoChangesConfig`, quoted verbatim); and `angular/angular` at tag `v22.1.5`:
> [`change_detection/scheduling/exhaustive_check_no_changes.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/exhaustive_check_no_changes.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Zone.js made "I forgot to tell Angular" impossible by patching the browser, and removing it made
that failure mode possible for the first time. In a zoneless application a mutation that reaches none
of the scheduler's notification triggers leaves the DOM showing the previous value with no error, no
warning and no log — the screen is simply wrong, quietly, and usually only on one machine. This is
the failure `provideCheckNoChangesConfig({exhaustive: true, interval})` exists for: it periodically
re-evaluates every binding in every attached view and reports the ones whose value has moved without
a refresh. This chunk is the workflow — detect with the interval, diagnose with the synchronous
check, fix by making the state notify — and the several ways a finding can mislead you. The provider
itself is [05e](05e-provide-check-no-changes-config.md), and the timer's mechanics are
[05g](05g-the-check-no-changes-interval.md).**

## Why this failure mode is new, and why an assertion is the only detector

A zoneless application refreshes only when something notifies the scheduler, and the set of things
that do is small and closed — the six APIs enumerated in
[05c](05c-the-redundant-opt-in-and-ng0408.md). Mutate a plain object field from a `setInterval`
callback, a WebSocket message handler, a third-party library's callback, or a promise chain a library
owns, and nothing in that list fires. The component's state is now newer than its DOM, and every
mechanism Angular has for telling you something is wrong is downstream of a change detection run that
is never scheduled.

The zoneless guide names the tool and what it produces:

> *"`provideCheckNoChangesConfig({exhaustive: true, interval: <milliseconds>})` can be used to periodically check to ensure that no bindings have been updated without a notification."*
>
> *"Angular throws `ExpressionChangedAfterItHasBeenCheckedError` if there is an updated binding that would not have refreshed by the zoneless change detection."*

That second sentence is the mechanism in one line. `checkNoChanges` re-evaluates each binding
expression and compares the result with the value last written to the DOM. In a zone application a
difference meant "something mutated state *during* change detection", which is the classic
`ExpressionChangedAfterItHasBeenCheckedError`. In a zoneless application the same comparison catches
a strictly larger set: anything that mutated state *at any point* without notifying. Same assertion,
new and much more valuable failure.

🔴 **`exhaustive: true` is not optional for this job.** The default verification pass skips unmarked
`OnPush` views ([05e](05e-provide-check-no-changes-config.md)), and a component whose state changed
without a notification is by definition not marked. Without `exhaustive: true` the poll would skip
precisely the views you are hunting.

## The workflow: detect with the interval, diagnose without it

The interval and the synchronous check are two different instruments and the order matters. Start
with the interval, because you do not yet know which screen is wrong:

```ts
import { ApplicationConfig, EnvironmentProviders, Provider } from '@angular/core';
import { provideCheckNoChangesConfig } from '@angular/core';
import { environment } from '../environments/environment';

const debugProviders: (Provider | EnvironmentProviders)[] = environment.production
  ? []
  : [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })];

export const appConfig: ApplicationConfig = {
  providers: [...debugProviders],
};
```

Then, once a finding has named a component, drop the `interval` and keep the exhaustive check alone.
The synchronous form runs as part of the verification pass immediately after change detection, so its
failure happens inside the change detection run rather than inside a timer callback — the difference
between a stack that names the poll and a stack that names the code path:

```ts
// step 2 — reproduce with the synchronous check, which fails inside change detection
provideCheckNoChangesConfig({ exhaustive: true }),
```

## What a finding looks like in code

The class of bug the poll exists to find, and the fix. Both components are correct-looking, and only
one of them updates:

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

// ⛔ zoneless: the timer mutates a plain field, nothing notifies the scheduler,
//    the template keeps rendering the value from the last refresh
@Component({
  selector: 'app-ticker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ seconds }}`,
})
export class BrokenTickerComponent {
  seconds = 0;
  constructor() {
    setInterval(() => (this.seconds += 1), 1000);
  }
}

// ✅ a signal write notifies the scheduler, so the view is marked and refreshed
@Component({
  selector: 'app-ticker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ seconds() }}`,
})
export class TickerComponent {
  readonly seconds = signal(0);
  constructor() {
    setInterval(() => this.seconds.update((n) => n + 1), 1000);
  }
}
```

The same shape appears wherever state arrives from outside Angular — a WebSocket `onmessage`, an
`IntersectionObserver` callback, a charting library's event, a `postMessage` handler. The fix is
always the same in kind: the value that the template reads has to be something whose write notifies,
which in v22 means a signal.

## Gotchas

**★ Symptom: an error is reported from a `setTimeout`, with no user code in the stack, naming a
component you were not interacting with.** Cause: the periodic check runs from a timer outside the
Angular zone and routes each failure through `errorHandler.handleError(e)`
([05g](05g-the-check-no-changes-interval.md)), so what you get is a *report*, not a throw at the site
of the mutation — the stack belongs to the poll. Fix: use the interval only to find out *which*
screen is affected, then remove it and reproduce with the synchronous check, whose failure happens
inside the change detection run:

```ts
// step 1 — is anything stale at all?
provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 }),

// step 2 — once you know the screen, get a useful stack
provideCheckNoChangesConfig({ exhaustive: true }),
```

**★ Symptom: the poll is configured, the screen is visibly stale, and nothing is ever reported.**
Cause: the findings are delivered by `errorHandler.handleError(e)` and by nothing else. An
`ErrorHandler` that posts to a remote service, filters by message, or ignores anything that is not an
`HttpErrorResponse` absorbs every finding silently. Fix: make the development handler log locally as
well as report ([06g](06g-error-handler-and-ng0402.md)):

```ts
@Injectable()
export class ReportingErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error(error); // ← without this the interval check is invisible
    this.telemetry.capture(error);
  }
}
```

**★ Symptom: the check reports nothing and the team concludes the application has no stale
bindings.** Cause: "found nothing" and "there is nothing" are different statements here, and at least
four things produce the first without the second — the poll defers whenever a tick is in flight and
can keep deferring on a busy screen; `ChangeDetectorRef.detach()`ed subtrees are outside the scope
entirely ([05e](05e-provide-check-no-changes-config.md)); a stale value that happens to compare
equal to the value already rendered produces nothing to report; and the provider does nothing at all in a
production build ([05f](05f-check-no-changes-in-production-and-developer-preview.md)). Fix: treat a
clean run as weak evidence, and exercise the suspect screen deliberately while the poll is armed
rather than waiting for it to find things on its own.

**Symptom: the finding names a child component, and the mutation is in a service three layers away.**
Cause: the check reports *where the binding is*, because that is what it evaluates — the expression
in the template whose value moved. It has no idea what wrote the underlying state. Fix: use the
binding as the entry point, not the answer. Follow the expression back to its source and make that
source notify:

```ts
// ⛔ the service mutates a shared object; the child's binding is where it surfaces
class CartService { items: Item[] = []; add(item: Item) { this.items.push(item); } }

// ✅ the source notifies, so every consumer refreshes
class CartService {
  readonly items = signal<readonly Item[]>([]);
  add(item: Item) { this.items.update((current) => [...current, item]); }
}
```

**Symptom: someone leaves `interval` configured permanently "as a monitor".** Cause: it reads like
continuous protection, and it is not — it does nothing in production
([05f](05f-check-no-changes-in-production-and-developer-preview.md)), it cannot be turned off once
registered ([05g](05g-the-check-no-changes-interval.md)), it walks every attached view again on every
round in development, and its reports arrive in the same channel as real application errors, where
they train the team to ignore that channel. Fix: use it as an instrument for a specific hunt, and
take it out again:

```ts
// debug.providers.ts
// ARMED 2026-09-06 while chasing the stale cart total. Remove when that ticket closes.
export const debugProviders = environment.production
  ? []
  : [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })];
```

and the resting state that ticket closes back to:

```ts
// debug.providers.ts
export const debugProviders: (Provider | EnvironmentProviders)[] = [];
```

**Symptom: turning the poll on floods the console with findings from a third-party component you
cannot change.** Cause: exhaustive checking covers every attached view including those from libraries,
and a library written for zone applications may mutate its own state from patched callbacks it
assumes are patched. Fix: there is no per-component opt-out for the check. Isolate the hunt — run the
poll on a route or a build that does not include that component, or fix the state at your boundary by
copying the library's values into signals you control:

```ts
readonly rows = signal<readonly Row[]>([]);
onLibraryUpdate(rows: readonly Row[]) {
  this.rows.set(rows); // your binding reads a signal, not the library's mutable field
}
```

## Interview questions

**★ A zoneless application shows a stale value on one screen and no error anywhere. How do you find
it?**
Arm `provideCheckNoChangesConfig({exhaustive: true, interval: 1000})` in a development-only provider
array and watch what the `ErrorHandler` reports. The zoneless guide's own description is that it
*"can be used to periodically check to ensure that no bindings have been updated without a
notification"*, and that Angular throws `ExpressionChangedAfterItHasBeenCheckedError` for *"an updated
binding that would not have refreshed by the zoneless change detection"* — so the report names the
binding. Then remove the interval and reproduce with `{exhaustive: true}` alone, because the
synchronous verification pass fails inside the change detection run and gives you a stack that
includes the code path instead of a timer. The fix is almost always to move the state behind a signal
so writing it notifies the scheduler.

**★ Why is `exhaustive: true` mandatory for this hunt rather than a refinement?**
Because the thing you are looking for is, by construction, an unmarked view. A component whose state
changed without notifying the scheduler was never marked for check, and the default verification pass
skips unmarked `OnPush` views — that is the blind spot in
[05e](05e-provide-check-no-changes-config.md). Running the poll without `exhaustive: true` would
inspect exactly the views that cannot be the problem. The two options are not independent knobs for
this workflow: the interval decides *when* the check runs and `exhaustive` decides whether it can see
anything worth finding.

**★ Zone applications never had this failure mode. What exactly did Zone.js do that made it
impossible, and what did removing it buy?**
Zone.js patched the browser's asynchronous APIs — timers, event listeners, promises, XHR — so that
any callback returning to the application also notified Angular that a change detection run was due.
"I mutated state and forgot to tell Angular" could not happen, because the mutation almost always
happened inside a patched callback. Removing it means notification is explicit, and explicit means
forgettable. What it buys is everything the zoneless guide is about: no polyfill in the bundle, no
monkey-patching of globals, no full-tree checks on every patched event, and change detection driven
by what actually changed. The periodic exhaustive check is the safety net that makes the trade
survivable while a codebase is still half-migrated.

**A clean run of the interval check — is that evidence the application has no stale bindings?**
Weak evidence at best, and understanding why is the difference between using the tool and trusting
it. The poll defers whenever a tick is scheduled or running, so a busy screen can starve it silently.
Detached subtrees are outside its documented scope. It only detects differences a binding expression
actually produces, so state that is stale but coincidentally equal is invisible. And it does nothing
at all in a production build. A clean run means "nothing was found in the views that were checked, in
the moments it managed to check them" — which is worth having, and is not a proof.

**What do you do with a finding that names a binding in a third-party component?**
Not much directly, which is worth saying honestly: there is no per-component opt-out from exhaustive
checking, and you cannot make someone else's component notify. The productive move is at the
boundary — copy whatever the library exposes into signals you own, so the bindings *you* render are
driven by state whose writes notify, and treat the library's own internal rendering as its problem.
If the library mutates state from callbacks it assumes Zone.js has patched, it is a zone-era library
and the finding is really telling you about a dependency, not a bug in your code.

---

← Prev: [05g · The `checkNoChanges` interval](05g-the-check-no-changes-interval.md) · Index: [Topic index](README.md) · Next → [06 · Startup and error-listener providers](06-startup-and-error-listener-providers.md)
