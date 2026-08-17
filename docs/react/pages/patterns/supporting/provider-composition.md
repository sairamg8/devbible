---
title: "Provider composition"
sidebar_label: "05 · Provider composition"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [`createContext`](https://react.dev/reference/react/createContext),
> [`useContext`](https://react.dev/reference/react/useContext),
> [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context),
> [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context),
> and the [React 19 release notes](https://react.dev/blog/2024/12/05/react-19)
> for `<Context>` as a provider. Judgements about how to organise an application
> are marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**Nine nested `<Provider>` tags at the root of your app. One fix is cosmetic and
one is real, and it matters which you reach for.**

## The shape everyone ends up with

```jsx
export default function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            <FeatureFlagProvider>
              <ToastProvider>
                <ModalProvider>
                  <AnalyticsProvider>
                    <Router />
                  </AnalyticsProvider>
                </ModalProvider>
              </ToastProvider>
            </FeatureFlagProvider>
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
```

Nothing here is wrong, exactly. It is just unreadable, it re-indents on every
addition, and reordering two providers means retyping the whole block.

## Fix one: flatten it (cosmetic, and that is fine)

Fold an array of providers instead of nesting them by hand:

```jsx
function composeProviders(...providers) {
  return function Providers({ children }) {
    return providers.reduceRight(
      (tree, [Provider, props = {}]) => <Provider {...props}>{tree}</Provider>,
      children,
    );
  };
}

const AppProviders = composeProviders(
  [QueryProvider,       { client }],
  [ThemeProvider,       { theme: 'system' }],
  [AuthProvider],
  [I18nProvider,        { locale }],
  [FeatureFlagProvider],
  [ToastProvider],
  [ModalProvider],
  [AnalyticsProvider],
);

export default function App() {
  return <AppProviders><Router /></AppProviders>;
}
```

Two details that are easy to get wrong:

**`reduceRight`, not `reduce`.** The array reads outermost-first, matching the
JSX it replaces. `reduce` would invert the nesting and put `AnalyticsProvider`
outside `QueryProvider` — which usually still renders, and is exactly the kind of
bug that surfaces weeks later as "auth is undefined on first paint".

**Tuples, not bare components.** A plain `composeProviders(A, B, C)` cannot pass
props, and the first provider that needs one forces a rewrite of the helper.

⚠️ **This changes nothing about behaviour.** The rendered tree is identical —
same components, same depth, same re-renders. It is a readability change, and
it is worth being honest that it is only that.

## Fix two: have fewer providers at the root (the real one)

The flattened list makes a question visible that the nested version hid: **why
is all of this at the root?**

A provider at the root says *every component in this application may need this
value*. For a theme, that is true. For a modal controller used on three admin
screens, it is not — and hoisting it to the root costs you:

- **Mount cost on first paint.** Every root provider initialises before anything
  renders, including the ones nine tenths of your routes never read.
- **A re-render surface.** Every consumer re-renders when a provider's `value`
  *identity* changes, and `useContext` has no selector. A chatty provider at the
  root is a chatty provider over your whole tree —
  [the context re-render problem](../phase-5-refs-context-reducers/05-context-re-render-problem.md).
- **A testing tax.** Every test that renders anything now needs the whole stack,
  which is why
  [wrappers and providers](../phase-14-correctness/10-wrappers-and-providers.md)
  exists as a topic at all.

*(Judgement, not documentation:)* the useful question for each provider is **what
is the smallest subtree that needs this?** — and then mount it there. A route,
a layout, a feature folder. The root is for what is genuinely global, and most
applications discover that this is three or four things, not nine.

This is [colocation](../phase-2-components/10-component-boundaries.md) applied to
providers.

## Provider count is not the metric

Two things make the count go *up* on purpose, and neither is a problem to solve.

**Splitting state from dispatch.** React's own recommended app-state shape is two
contexts — one for the state, one for the dispatcher — precisely so that
components which only dispatch do not re-render when the state changes.
[Context plus reducer](../phase-5-refs-context-reducers/12-context-plus-reducer.md)
is the page, and it deliberately turns one provider into two.

**Splitting a fat context.** One context holding `{user, theme, locale}` re-renders
every consumer when any of the three changes. Three contexts do not. Again: more
providers, less work.

So "reduce the number of providers" is the wrong instruction. **Reduce the number
of providers at the root**, and split the ones that are doing several jobs.

## What React 19 changed

`<Context>` is now usable directly as a provider — `.Provider` is no longer
required:

```jsx
const ThemeContext = createContext('light');

<ThemeContext value="dark">{children}</ThemeContext>      {/* React 19 */}
<ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>  {/* still works */}
```

That does not reduce nesting, but it does remove a token per level.
[`createContext` and `useContext`](../phase-5-refs-context-reducers/04-createcontext-usecontext.md)
covers the change and what `.Provider` still means.

## Providers and Server Components

A provider is stateful, so it is a Client Component and needs `'use client'`.
That does **not** mean everything below it becomes client-rendered — a client
provider can wrap server-rendered content passed in as `children`:

```jsx
// app/layout.jsx — a Server Component
<ThemeProvider>          {/* client */}
  <Dashboard />          {/* stays a Server Component */}
</ThemeProvider>
```

This is the single most useful RSC technique, and it is taught in
[Server Components as `children`](../phase-10-server-components/07-server-components-as-children.md).
It also means the flattening helper above has to live in a client module, and the
tree it wraps does not.

## Gotchas

**Defining a provider component inside `App` remounts the entire tree on every
render.** A new function identity is a new component type, so React unmounts and
remounts everything below — all state lost. `composeProviders(...)` must be called
at **module level**, not inside the component that uses it.

**The array hides an ordering dependency.** If `ThemeProvider` reads from
`SettingsProvider`, the list is not a set — it is a sequence with a constraint,
and nothing in the code says so. Comment the constrained pairs; a flat array
makes them look independent, which is exactly the failure mode flattening
introduces.

**An unmemoized `value` makes the depth irrelevant.** `value={{user, logout}}`
creates a new object every render, so every consumer re-renders regardless of how
neatly the providers are arranged. Fixing indentation while leaving this in place
solves the cosmetic problem and none of the real one.

**Error boundaries and `<Suspense>` are not providers, and their position is
load-bearing.** An error boundary above a provider cannot show a fallback that
uses that provider's value. Do not sweep them into the same fold.

**A provider whose default value is used is usually a missing provider.** The
default only applies when no matching provider is above — see
[the default context value](../phase-5-refs-context-reducers/13-default-context-value.md),
and prefer a custom hook that throws.

## Interview questions

**What is wrong with nine nested providers?**
Readability, mostly — the tree itself is fine. The real problem it points at is
that most of those providers are at the root when they are needed by a subtree,
which costs mount time, widens the re-render surface, and makes every test set up
the whole stack.

**How do you flatten them, and what does that buy?**
Fold an array of `[Provider, props]` tuples with `reduceRight` so the array reads
outermost-first. It buys readability and nothing else — the rendered tree is
identical.

**Why `reduceRight` rather than `reduce`?**
So the first entry in the array ends up outermost, matching the JSX being
replaced. `reduce` inverts the order, which often still renders and fails subtly
later.

**Is fewer providers always better?**
No. Splitting state from dispatch, and splitting a fat context into focused ones,
both increase the count and reduce re-renders. The goal is fewer providers *at
the root*, not fewer providers.

**Can a Client Component provider wrap Server Components?**
Yes, when the server content is passed as `children` rather than imported inside
the provider. That is the standard RSC composition technique.

---

← Prev: [Prop getters](04-prop-getters.md) · Index: [React patterns](README.md) · Next → [06 · Container and presentational](06-container-and-presentational.md)
