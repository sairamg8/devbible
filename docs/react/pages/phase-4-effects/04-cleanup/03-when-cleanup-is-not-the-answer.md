---
title: "When cleanup is not the answer"
sidebar_label: "03 · When cleanup is not the answer"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
> (§ Not an Effect: Buying a product, § Not an Effect: Initializing the
> application) and [`useEffect`](https://react.dev/reference/react/useEffect).
> No sandbox script backs this page; claims are cited, not measured.

**Some effects fire twice in development and no cleanup will fix them, because
the problem is not a missing inverse — it is that the code was never an effect.
Recognising these two cases is what stops you writing a guard.**

The recipes in [chunk 02](02-cleanup-recipes.md) all shared an assumption: that
rendering is what should have caused the work. When that assumption fails, the
double-invocation stops being a cleanup problem and becomes a bug report.

## Not an effect: buying a product

```jsx
// 🔴 Wrong: This Effect fires twice in development, exposing a problem in the code.
useEffect(() => {
  fetch('/api/buy', { method: 'POST' });
}, []);
```

There is no cleanup that fixes this, and looking for one is the wrong move:

> You wouldn't want to buy the product twice. However, this is also why you
> shouldn't put this logic in an Effect. What if the user goes to another page
> and then presses Back? Your Effect would run again. You don't want to buy the
> product when the user *visits* a page; you want to buy it when the user
> *clicks* the Buy button.

```jsx
function handleClick() {
  // ✅ Buying is an event because it is caused by a particular interaction.
  fetch('/api/buy', { method: 'POST' });
}
```

This is [topic 01](../01-what-an-effect-is-for.md)'s effects-versus-events
distinction arriving as a production incident. Ask the "why did this happen?"
question: the purchase happened because *the user clicked Buy*, not because a
component rendered. Rendering is a thing React may do more than once, at times
of its choosing. Anything you would not want done twice must not be attached to
it.

Note what separates this from the analytics recipe, which also POSTs and also
needs no cleanup. `logVisit` really is caused by rendering — visiting the page
is the event — and its duplicate is confined to development and harmless. A
purchase is caused by an interaction and its duplicate is a charge on someone's
card. **Same HTTP verb, opposite answers**, because the test is causation and
consequence, not the method name.

## The remount principle

The general rule react.dev draws from that example is the reason `StrictMode`
behaves the way it does at all:

> This illustrates that if remounting breaks the logic of your application, this
> usually uncovers existing bugs. From a user's perspective, visiting a page
> shouldn't be different from visiting it, clicking a link, then pressing Back to
> view the page again. React verifies that your components abide by this
> principle by remounting them once in development.

**The extra cycle is not a simulation of an unlikely event.** Back-navigation is
a completely ordinary thing for a user to do, and it remounts the component for
real, in production, with `StrictMode` nowhere in the picture. So does a tab
switch that unmounts a panel, a route change and return, a list item that scrolls
out of a virtualised window and back.

Which reframes the development behaviour entirely. It is not React being awkward
about a development-only concern; it is React running a journey your users take
anyway, early enough that you see it on your machine first. An effect that only
works the first time was always broken — `StrictMode` just declines to let you
ship it unnoticed. [Topic 05](../05-strictmode-double-invocation.md) takes this
apart in full.

## Not an effect: initializing the application

Logic that must run exactly once per page load does not belong in a component at
all. No component-scoped mechanism can promise "once", for the reason just
established — components mount more than once:

```jsx
if (typeof window !== 'undefined') { // Check if we're running in the browser.
  checkAuthToken();
  loadDataFromLocalStorage();
}

function App() {
  // ...
}
```

> This guarantees that such logic only runs once after the browser loads the
> page.

Module-level code runs when the module is first evaluated, which happens once per
page load no matter how many times any component mounts. That is a real "once",
and an effect with `[]` never was one.

The `typeof window` guard is there because the module is **also evaluated during
server rendering**, where `localStorage` and friends do not exist — the
client-only constraint from [topic 01](../01-what-an-effect-is-for.md). Without
it the import itself throws on the server, which is a harder failure than the one
you were avoiding.

This is the correct home for the third-party SDK initialisation that people reach
for `useEffect(…, [])` to express — analytics clients, error reporters, feature
flag providers. If the SDK must be initialised once and only once, an effect is
structurally incapable of guaranteeing it.

## The decision, in order

When an effect misbehaves under the double-invocation, work through it in this
order — the first question is the one most often skipped:

1. **What caused this?** An interaction → move it to an event handler and stop.
   Rendering → continue.
2. **Must it happen exactly once per page load?** → module level, outside the
   component, with a `typeof window` guard.
3. **Is the setup idempotent, read-only, or a harmless fire-and-forget?** → no
   cleanup needed.
4. **Otherwise** → write the cleanup that makes setup → cleanup → setup
   indistinguishable from setup alone.

A ref guard is never any of the four. It appears when step 1 was skipped and step
4 looked hard.

## Gotchas

**Symptom:** a POST fires twice in development and someone proposes a `hasRun`
ref.
**Cause:** the action is caused by an interaction, not by rendering, so it is in
the wrong place entirely.
**Fix:** move it to the event handler. A guard would also break on
back-navigation, which remounts the component in production and would fire the
effect again for real.

**Symptom:** third-party SDK initialisation runs more than once.
**Cause:** it is in an effect, and no effect can promise "once" — mounting is not
a once-per-page event.
**Fix:** module-level code with a `typeof window` guard, outside the component.

**Symptom:** moving initialisation to module level broke the server build with
`localStorage is not defined`.
**Cause:** the module is evaluated during server rendering too.
**Fix:** the `typeof window !== 'undefined'` guard, which is why react.dev's
example carries it.

**Symptom:** an analytics POST and a purchase POST get treated as the same
problem, and one of them gets a guard it does not need.
**Cause:** classifying by the HTTP method instead of by what caused the call.
**Fix:** ask what caused it and what a duplicate costs. Visiting causes the
analytics ping and a dev duplicate costs nothing; clicking causes the purchase
and a duplicate costs money.

**Symptom:** an effect works on first visit and misbehaves after navigating away
and pressing Back.
**Cause:** it assumed one mount per page load. Back-navigation remounts, in
production.
**Fix:** the same fix `StrictMode` was pointing at — cleanup, or the realisation
that the code belongs in an event handler or at module level.

**Symptom:** state is seeded from `localStorage` in an effect and flashes the
default value first.
**Cause:** an initialisation concern expressed as an effect, so it necessarily
runs after the first commit.
**Fix:** read it during initialisation instead — lazy initial state
([Phase 3 · 09](../../phase-3-state/09-lazy-initial-state.md)), or module level
if it is application-wide.

## Interview questions

**★ An API call fires twice in development. How do you decide whether that is a
missing cleanup or a design error?**
Ask what caused it. If rendering caused it, it is an effect and it needs a
cleanup that makes the second run harmless. If an interaction caused it — buying,
submitting, sending — it should never have been an effect, and no cleanup can fix
it, because back-navigation would run it again in production for real. The
double-invocation is surfacing an existing bug, not creating one.

**★ What is `StrictMode`'s remount actually verifying?**
That visiting a page is indistinguishable from visiting it, navigating away, and
pressing Back. That is a real user journey, not a synthetic one, and it remounts
components in production. If remounting breaks the app, the docs' position is
that this usually uncovers a bug that was already there — the development cycle
just made it happen on your machine first.

**★ Where does application initialisation belong, if not an effect?**
At module level, outside any component, guarded with a `typeof window` check so
it does not run during server rendering. Module code is evaluated once when the
module is first evaluated, which is a genuine once-per-page-load. No
component-scoped mechanism can promise "once", because components mount more than
once — including on ordinary back-navigation in production.

**Analytics and a purchase are both POSTs with no natural inverse. Why does one
need no cleanup and the other need moving?**
Because the test is causation and consequence, not the HTTP method. Visiting the
page is what causes the analytics ping, so it genuinely is an effect, and its
duplicate is confined to development where the data does not matter. Clicking Buy
is what causes the purchase, so it is an event, and its duplicate is a real
charge. Same verb, opposite answers.

**Why is `typeof window !== 'undefined'` needed around module-level
initialisation?**
Because the module is evaluated during server rendering as well as in the
browser, and browser APIs do not exist there. Without the guard the import itself
throws on the server. It is the module-level form of the same client-only
constraint that makes effects browser-only in the first place.

**What is the order of questions when an effect misbehaves on its second run?**
What caused this — an interaction means it belongs in an event handler. Then:
must it happen exactly once per page load, in which case it belongs at module
level. Then: is the setup idempotent, read-only or a harmless fire-and-forget, in
which case no cleanup is needed. Only then do you write the cleanup. A ref guard
is never the answer to any of them.

---

← Prev: [Cleanup recipes](02-cleanup-recipes.md) · Index: [Cleanup](README.md)
