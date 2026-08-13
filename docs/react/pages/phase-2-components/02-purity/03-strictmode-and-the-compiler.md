---
title: "StrictMode, the Compiler and how purity is enforced"
sidebar_label: "03 · How purity is enforced"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Keeping Components Pure](https://react.dev/learn/keeping-components-pure),
> [`<StrictMode>`](https://react.dev/reference/react/StrictMode) and
> [React Compiler](https://react.dev/learn/react-compiler). The measured
> dev-vs-prod behaviour is on
> [Phase 0 · StrictMode](../../phase-0-how-react-runs/07-strictmode.md); this
> page cites documentation only.

**Nothing enforces purity at runtime in production. React ships two tools that
make impurity *visible* during development — and understanding what each one
cannot see is the difference between "no warnings" and "correct".**

## Why doubling is the test

`StrictMode` calls your component function twice on every render in development.
react.dev gives the reasoning in one sentence:

> **Pure functions only calculate, so calling them twice won't change
> anything**—just like calling `double(2)` twice doesn't change what's returned.

and the purpose:

> **By calling the component functions twice, Strict Mode helps find components
> that break these rules.**

That is the whole design. React cannot inspect your function for purity, so it
does the one thing that turns an invisible violation into a visible one: it
runs it again and lets the damage double. A module counter reaches 2 instead of
1. An array gets two entries. A logged line appears twice.

The measured dev-versus-prod behaviour — which calls double, which do not, and
what the effect-cleanup sequence looks like — is on the
[Phase 0 page](../../phase-0-how-react-runs/07-strictmode.md), which has the real
console output behind it. What matters here is what the doubling means: **the
second call is not overhead, it is the test.** If the second call changes
anything, the component was already broken; `StrictMode` only told you.

## What StrictMode double-invokes

Everything React considers part of "calculating the UI":

- The component function body.
- `useState`'s lazy initialiser.
- `useMemo` and `useCallback` calculations.
- `useReducer` reducers.
- Class `constructor`, `render` and `shouldComponentUpdate`.
- The updater functions passed to `setState`.

That list is the second rule of purity turned into a checklist. A reducer with a
side effect, a `useMemo` that pushes to an array, an updater that calls an API —
all of these are impure in exactly the same way a component body is, and
`StrictMode` treats them the same way.

Effects are handled differently: they are mounted, unmounted and mounted again,
which tests a different property — that setup and cleanup are symmetric. That is
Phase 4's subject.

## What StrictMode cannot catch

This is the section that matters, because a clean development run is routinely
mistaken for proof.

**It does not run in production.** Its cost is a development-only cost, and its
coverage is development-only coverage. A code path that only executes for a
production-only condition is never tested.

**It only double-mounts on the initial mount** — effects on later updates are
not doubled.

**It cannot see impurity that is idempotent.** Writing `window.title = x` twice
produces the same result as writing it once. The component is impure, will break
under concurrent rendering, and `StrictMode` says nothing.

**It cannot see impurity in code that did not run.** A mutation inside an `if`
branch that was false during your development session is invisible.

**It cannot see impurity in event handlers**, because handlers are not doubled —
correctly, since they are allowed to have effects.

**It does not fix anything.** react.dev is explicit that the tool surfaces the
problem; the repair is yours. And the most common repair is the wrong one — a
`useRef` guard that suppresses the second run. Phase 0's
[wrong fix, and the right one](../../phase-0-how-react-runs/07-strictmode.md)
covers why that keeps the disease and hides the symptom.

## The React Compiler is the stricter checker

The Compiler memoizes automatically by rewriting your components — which it can
only do if the components are pure. So before it rewrites anything it
*analyses*, and where the analysis finds a rule violation it **bails out and
leaves that component alone** rather than producing wrong code.

That bail-out is the most useful purity signal available today, for a reason
`StrictMode` cannot match: it is **static**. It does not need the impure branch
to execute during your session. It reads the code.

Two practical consequences:

1. **"The Compiler skipped this component" is a purity report.** Enable the
   compiler's diagnostics and the list of skipped components is, in effect, a
   list of your rule violations — including ones no test has ever hit.
2. **Turning the Compiler on can change behaviour in impure components.** Not
   because the Compiler is wrong, but because the extra memoization changes how
   many times your function runs, and an impure function's output depends on
   that count. If enabling it breaks a component, the component was already
   broken.

The lint rules ship in `eslint-plugin-react-hooks` — Compiler 1.0 moved them
there — so you get the same analysis without adopting the Compiler itself. The
Compiler's own mechanics, its `_c()` slot output and how to enable it are on the
[Phase 0 Compiler page](../../phase-0-how-react-runs/11-the-compiler.md).

## Purity and the features that depend on it

It is worth naming the specific features that break, because "React might call
it twice" sounds hypothetical until you list them:

| Feature | What it assumes | What impurity does |
|---|---|---|
| **Automatic batching** | Render can be deferred | Effects fire at unexpected times relative to state |
| **`memo` / the Compiler** | Skipping a render is safe | The skipped render's side effect never happens |
| **Transitions** | A render can be interrupted and restarted | The abandoned render's side effect already happened |
| **Suspense** | A render can be thrown away and retried | Same — the effect cannot be rolled back |
| **`<Activity>`** | A subtree can be hidden and restored | Setup runs again against state that assumed once-only |
| **Server rendering** | The same input renders the same HTML | Hydration mismatch |
| **Offscreen prerendering** | Rendering something invisible is free | Prerendering fires your side effect |

Every row is the same bet: *calling this function is free of consequences.* That
is what purity buys, and it is why React states the rule absolutely rather than
as a preference.

## A practical audit

Reading a component for purity is a five-question pass, and it is fast enough to
do on every review:

1. **What does it read?** Anything not props, state or context is suspect.
2. **What does it write?** Anything created before this render is a violation.
3. **Would running the body twice change anything observable?** If yes, that is
   the bug, whether or not `StrictMode` has surfaced it.
4. **Is any of that in a `useMemo`, `useCallback` or reducer?** Same rules apply
   there; people often check the body and stop.
5. **Does the Compiler skip it?** If so, it has already found something.

## Gotchas

**Symptom:** "It works in production, so it is fine."
**Cause:** `StrictMode` is development-only, so production is where the bug is
*hidden*, not where it is absent. Concurrent features make it appear later,
under load, intermittently.
**Fix:** treat a development-only symptom as a real bug with a delayed
production date.

**Symptom:** a component breaks the moment the React Compiler is enabled.
**Cause:** it is impure, and the extra memoization changed how often it runs.
**Fix:** fix the purity violation. Adding `"use no memo"` to opt the component
out silences the compiler and keeps the bug.

**Symptom:** removing `<StrictMode>` makes a bug go away.
**Cause:** the same misreading. Removing it removes the detector.
**Fix:** keep it on. If a third-party component makes the noise intolerable, the
right move is to fix or replace that component, not to disable the check for the
whole app.

**Symptom:** a `useMemo` calculation has a side effect and nobody noticed.
**Cause:** purity reviews usually stop at the component body.
**Fix:** apply the same two rules to memos, callbacks, reducers and updaters —
`StrictMode` already double-invokes all of them.

**Symptom:** an effect's cleanup does not undo its setup, and it only shows up
after navigation.
**Cause:** that is a symmetry failure, not a purity failure — a different rule,
tested by the double *mount* rather than the double *render*.
**Fix:** Phase 4. Make setup and cleanup mirror each other.

## Interview questions

**★ Why does React call components twice in development?**
Because purity cannot be checked by inspection, but it can be checked by
repetition: a pure function called twice produces the same result and changes
nothing, so any observable difference is a rule violation. It is a detector, not
overhead — and it runs only in development, so users never pay for it.

**★ What can StrictMode not catch?**
Anything it cannot execute or cannot observe: production-only code paths,
branches that did not run during your session, impurity that happens to be
idempotent, event handlers (which are deliberately exempt), and effects after
the first mount. A clean development run is weak evidence, not proof.

**★ How does the React Compiler relate to purity?**
It requires it. The Compiler only memoizes components it can prove follow the
rules, and it silently skips the ones it cannot — so the list of skipped
components is a static purity report, covering code that never ran. It is a
stricter checker than `StrictMode` for that reason. It also means enabling the
Compiler can surface latent bugs, because changing how often an impure function
runs changes its output.

**Someone "fixes" a doubled API call with a `useRef` guard. What is wrong with
that?**
It suppresses the symptom and keeps the defect. The effect still cannot be
safely re-run, so it will misbehave the next time React remounts the component —
navigation, Fast Refresh, or an `<Activity>` boundary restoring a hidden
subtree. The correct fix is to make the effect re-runnable, usually with an
`AbortController` in the cleanup.

**Does StrictMode double-invoke `useMemo`?**
Yes — along with `useState` initialisers, `useCallback` calculations, reducers
and `setState` updater functions. All of them are "calculating the UI" and all
of them are held to the same two rules.

**Why is impurity worse under concurrent rendering than it was before?**
Because React can now begin a render, abandon it, and start again. A side effect
performed during the abandoned render has already happened and there is no
mechanism to undo it. In the synchronous model every render committed, so the
damage was at least consistent.

---

← Prev: [What purity still allows](02-what-is-allowed.md) ·
Index: [Purity](README.md) ·
Next → [Composition over configuration](../03-composition/README.md)
