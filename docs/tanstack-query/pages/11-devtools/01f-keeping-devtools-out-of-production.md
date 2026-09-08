---
title: "The devtools exclude themselves from production builds on an exact string comparison against NODE_ENV — which means you never have to gate them by hand, and also that one non-standard environment name silently deletes the panel from the build you most wanted it in"
sidebar_label: "01f · Devtools in production"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Devtools](https://tanstack.com/query/latest/docs/framework/react/devtools) (fetched 2026-09-08, including the *Devtools in production* example verbatim). Documentation-validated, **no sandbox run, no bundle sizes and no build output** — bundler behaviour is described mechanically, not measured. Target: **@tanstack/react-query 5.102.8**; the panel ships as `@tanstack/react-query-devtools`.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

**Two facts do all the work on this page. The first is that you do not have to do anything to keep the panel out of production — the package excludes itself, on an exact equality check against `process.env.NODE_ENV`. The second is the consequence nobody plans for: an exact equality check has exactly one passing value, so a build that sets `NODE_ENV` to `staging`, `test`, `qa` or nothing at all gets the production behaviour, and the panel you mounted is simply not there. Everything else here is about the deliberate opposite case — when you *want* the panel in a production build, how the documented lazy-load recipe achieves it, and what you are exposing when you do.**

## The default: it removes itself

> *"By default, React Query Devtools are only included in bundles when `process.env.NODE_ENV === 'development'`, so you don't need to worry about excluding them during a production build."*

Read the mechanism into that sentence, because it explains every way it goes wrong.

Bundlers replace `process.env.NODE_ENV` with a literal string at build time. Once it is a literal, a comparison against `'development'` is a constant, the branch that pulls in the panel becomes unreachable, and dead-code elimination drops it along with everything it imports. This is the same machinery React itself uses to strip development warnings, and it has the same two properties:

1. **It is a string comparison, not a boolean.** `'production'`, `'staging'`, `'test'` and `undefined` are all equally *not* `'development'`.
2. **It happens in the bundler, not at runtime.** Nothing decides at page load whether to show the panel; the code is either in the bundle or it is not.

So the correct usage is the one chunk 1 shows: import the component and render it unconditionally inside the provider. **Do not wrap it in your own `if (import.meta.env.DEV)`** — you gain nothing the package is not already doing, and you add a second, independent condition that can disagree with the first.

## The trap the sentence creates

Your staging pipeline sets `NODE_ENV=staging` because something else in the stack wanted that. The build succeeds, the app works, and the panel is gone — with no warning, no error, and an import statement still sitting in your source that appears to prove it should be there.

Diagnosing this from the app is nearly impossible, and diagnosing it from the build config takes ten seconds once you know the rule is an exact match on the single string `development`. The general lesson is worth carrying beyond this library: **`NODE_ENV` is not a free-form environment label.** Tooling across the JavaScript ecosystem treats it as a three-valued enum, and using it to name your deployment tier will keep breaking things in ways that look unrelated. Name deployment tiers in your own variable and leave `NODE_ENV` to the bundler.

## When you *do* want the panel in production

There are legitimate reasons: a bug that reproduces only against production data, a staging build that must ship as a production bundle, an internal tool where the cache is the most useful diagnostic on offer. The documented recipe does not disable the exclusion — it adds a **second, lazily loaded** copy from a production-safe entry point:

```tsx
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Example } from './Example'

const queryClient = new QueryClient()

const ReactQueryDevtoolsProduction = React.lazy(() =>
  import('@tanstack/react-query-devtools/build/modern/production.js').then(
    (d) => ({
      default: d.ReactQueryDevtools,
    }),
  ),
)

function App() {
  const [showDevtools, setShowDevtools] = React.useState(false)

  React.useEffect(() => {
    // @ts-expect-error
    window.toggleDevtools = () => setShowDevtools((old) => !old)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Example />
      <ReactQueryDevtools initialIsOpen />
      {showDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtoolsProduction />
        </React.Suspense>
      )}
    </QueryClientProvider>
  )
}
```

> *"With this, calling `window.toggleDevtools()` will download the devtools bundle and show them."*

Five details in that example are load-bearing and easy to skim past:

- **Both components are rendered.** The ordinary `ReactQueryDevtools` is still there for development, where it works and the lazy one is redundant; in a production build it is the inert one. The lazy import is the one that carries the panel into production.
- **The import specifier is a subpath, not the package root** — `@tanstack/react-query-devtools/build/modern/production.js`. The root entry is the one that removes itself. For bundlers that support the package's `exports` map, the documentation gives the shorter form `@tanstack/react-query-devtools/production`.
- **`React.lazy` plus a dynamic `import()` is what keeps the cost at zero** until someone asks. The bundler emits a separate async chunk; users who never call the toggle never download it.
- **`React.Suspense` with `fallback={null}`** is mandatory around a lazy component, and `null` is the right fallback — the panel is not part of the page's content and must not push a spinner into the UI.
- **The toggle is installed on `window` from an effect**, so it exists only on the client and only after the component mounts. `// @ts-expect-error` is there because `window` has no `toggleDevtools` in the DOM typings.

## What you are exposing when you ship it

The panel renders cached response bodies. In a production build pointed at production data, that is every field of every response the user's session has fetched — names, addresses, order histories, whatever your API returns — and, if any of it is embedded in a response, tokens. Anyone who can call `window.toggleDevtools()` can read all of it, and so can anyone standing behind them.

The lazy recipe is already a meaningful control, because the panel does not exist on the page until a deliberate console call. Whether that is sufficient depends entirely on what your API returns; if it is not, gate the toggle behind something your backend actually enforces — a staff flag on the session, a signed feature flag — rather than a client-side check that any user can flip. And keep in mind the panel adds no privilege: everything it shows already travelled to that browser. The change is in how easy it is to read.

⚠️ **The devtools page also points at browser extensions as a separate route.** I did not re-verify their details in this pass, so nothing here describes them — but conceptually an extension shifts the panel out of your bundle entirely, which is the only option on this page that ships no additional code at all.

## Gotchas

**★ The panel is missing in your staging build and present locally, with identical source.** Cause: inclusion is an exact match on `process.env.NODE_ENV === 'development'`. A build that sets `NODE_ENV` to `staging`, `test`, or leaves it unset does not match, and the panel is eliminated at build time. Fix: either build staging with `NODE_ENV=development` (which changes React's behaviour too, so rarely what you want), or use the documented production lazy-load recipe, which is the intended answer for exactly this case.

**★ CI cannot resolve `@tanstack/react-query-devtools/production` even though it builds locally.** Cause: the short subpath depends on the bundler honouring the package's `exports` map; an older bundler or a resolver configured for legacy resolution will not find it. Fix: use the long form the documentation also gives — `@tanstack/react-query-devtools/build/modern/production.js` — which is a real file path and does not depend on `exports` support.

**★ `window.toggleDevtools is not a function` in the console of the production build.** Cause: the assignment happens in an effect, so it exists only after that component has mounted on the client — before hydration, after an error boundary has swallowed the subtree, or on a page where that component never renders, there is nothing to call. Fix: confirm the component is mounted, and if you need the toggle earlier, install it at module scope in a client-only module rather than in an effect.

**★ TypeScript starts failing with "Unused '@ts-expect-error' directive" after you add a global type for `window`.** Cause: `@ts-expect-error` is an assertion that the next line *does* error; once you declare `toggleDevtools` on the global `Window` interface, the error disappears and the directive itself becomes the error. Fix: when you add the declaration, delete the comment. This is a real build break in a file most people copy once and never revisit.

**★ You wrapped `<ReactQueryDevtools />` in your own environment check and now it never appears anywhere.** Cause: two independent conditions. The package's own check already handles production; yours adds a second gate that must also pass, and framework-specific flags (`import.meta.env.DEV`, a custom `__DEV__`, a runtime config object) do not always agree with the `NODE_ENV` literal the bundler substituted. Fix: render it unconditionally and let the package decide, which is exactly what the documented sentence promises.

**★ You moved the package to `devDependencies` and the production lazy import broke the deploy.** Cause: the lazy import is a real import in a production build, so the package must be installed on the build machine — and `npm ci --omit=dev` prunes exactly that. Fix: if you use the production recipe, it belongs in `dependencies`. Chunk 1 states the other half of this rule; the two halves must agree, and the failure is choosing one for the install and the other for the code.

**★ A bundle analysis shows a devtools chunk in your production output and you assume the exclusion failed.** Cause: if you adopted the lazy recipe, a separate async chunk is the intended outcome — that is what makes the download conditional. The exclusion applies to the root entry, not to a subpath you deliberately imported. Fix: check whether the chunk is *async* and whether the main entry references it eagerly; a separate chunk that nothing imports at startup costs your users nothing.

**★ The lazily loaded production panel renders unstyled or is blocked by your Content Security Policy.** Cause: it is the same panel with the same style injection, and production is where a strict CSP actually applies. Fix: the options from chunk 1 still apply here — pass `styleNonce` with the nonce your server emits, and `shadowDOMTarget` if the app mounts inside a shadow root. A recipe that works in development and dies in production is usually a CSP that only exists in production.

**★ In a Next.js App Router project, the recipe fails to compile.** Cause: it uses `useState`, `useEffect` and `window`, so the file must be a Client Component. Fix: put the whole devtools wrapper in its own `'use client'` module and render that from the layout. Keeping it in a dedicated module also means the dynamic import boundary is unambiguous.

**★ You are relying on the exclusion to keep the panel away from users, and someone imported the production entry point directly.** Cause: the default protects the *root* specifier only; the production subpath is a public entry that always includes the panel, and one import anywhere in the graph brings it in. Fix: if this matters, make it greppable — a single devtools module that the rest of the codebase never bypasses, and a lint rule banning the subpath elsewhere.

## Interview questions

**★ How do the devtools stay out of a production bundle, and what do you have to do to make that happen?**
Nothing — that is the point. The documentation states that they *"are only included in bundles when `process.env.NODE_ENV === 'development'`, so you don't need to worry about excluding them during a production build."* The mechanism is standard bundler behaviour: `process.env.NODE_ENV` is replaced with a string literal at build time, the comparison against `'development'` becomes a constant, and dead-code elimination removes the unreachable branch and everything it imported. The practical instruction is therefore to import and render the component unconditionally inside the provider, and specifically *not* to add your own environment gate, because a second condition expressed in a different flag can disagree with the first and the failure is a panel that is silently absent everywhere.

**★ Your staging environment has no devtools. Where do you look first?**
At `NODE_ENV` in the staging build. The check is an exact string equality against `development`, so any other value — including a tier name like `staging` that someone set for unrelated reasons, or an unset variable — produces the production behaviour and eliminates the panel at build time. There is nothing to see at runtime; the code is not in the bundle. The correct fix is usually not to change `NODE_ENV`, since that also changes React's own development behaviour and would make staging stop resembling production, but to adopt the documented production lazy-load, which is designed precisely for a production-mode build that still needs the panel.

**★ Walk through the production lazy-load recipe and say what each piece is for.**
A second component is created with `React.lazy` around a dynamic import of the devtools' production entry point — `@tanstack/react-query-devtools/build/modern/production.js`, or the shorter `@tanstack/react-query-devtools/production` where the bundler supports package exports — because the root entry is the one that removes itself. The lazy wrapper means the bundler emits a separate async chunk, so the code is downloaded only when it is first rendered; the docs put it as *"calling `window.toggleDevtools()` will download the devtools bundle and show them."* State controls whether it renders, an effect exposes the toggle on `window` so it can be called from the console with no UI of its own, and the lazy element is wrapped in `React.Suspense` with a `null` fallback because a lazy component must have a boundary and the panel is not page content. The example also keeps the ordinary devtools component rendered for development, where it is the one that works.

**★ What are the risks of shipping the panel in a production build, and how would you mitigate them?**
The panel renders cached response bodies, so anyone who can open it reads every response the current session has fetched, including personal data and any token an API happened to return. It also exposes real cache actions, which means real requests and, in the case of removal, local data that cannot be recovered. It grants no new access — the data is already in that browser — but it lowers the effort to read it to a single console call, and it is readable by anyone looking at the screen. Mitigations, in increasing strength: keep it lazy so nothing exists on the page until the toggle is called; gate the toggle on a privilege the server actually asserts rather than a client-side flag; and, if the data is sensitive enough, do not ship it at all and reproduce against a copy of production data instead.

**★ Why is using `NODE_ENV` to name your deployment tier a bad idea, using this library as the example?**
Because a large amount of JavaScript tooling treats `NODE_ENV` as a small enum with special values, and reacts to it in ways that have nothing to do with your intent. Here, the exact string `development` is the only value that includes the devtools; every other value strips them. React uses the same variable to choose between its development and production builds, and bundlers use it to decide what to eliminate. Setting it to `staging` therefore silently changes several unrelated behaviours at once, and each one fails quietly — a missing panel, missing warnings, different error messages — with no single log line pointing at the cause. Deployment tiers belong in a variable you own, checked by code you wrote.

---

← [Panel actions](./01e-panel-actions-and-cache-effects.md) · [Topic index](../README.md) · Next → [AbortSignal integration](../12-query-cancellation/01-abortsignal-integration.md)
