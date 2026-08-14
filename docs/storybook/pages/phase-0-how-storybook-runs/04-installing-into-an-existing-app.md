---
title: "04 · Installing into an existing app"
sidebar_label: "04 · Installing into an app"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [Storybook install docs](https://storybook.js.org/docs/get-started/install)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

`npx storybook@latest init` gets you a working Storybook in about a minute. On an
empty project that is the end of the job. On a two-year-old application with a
real provider tree it is roughly **a third** of it, and the remaining two-thirds
are the reason people conclude "Storybook doesn't work with our stack".

It works. It just does not know anything about your app.

## What `init` does and does not do

| Does | Does not |
|---|---|
| detects your framework and builder | read your `vite.config.ts` / `webpack.config.js` |
| writes `.storybook/main.ts` and `preview.ts` | mirror your path aliases |
| installs the right packages | import your global stylesheet |
| adds `storybook` / `build-storybook` scripts | replicate your provider tree |
| generates example stories that work | know your env vars exist |

Everything in the right-hand column is manual, and every item in it produces a
different confusing failure. Do them deliberately, in order, and the whole thing
takes an afternoon rather than a week.

## The four steps, in order

### Step 1 — install, and change nothing

```bash
npx storybook@latest init
```

On 10.x this requires **Node 20.19+ or 22.12+**.

### Step 2 — verify the baseline before touching anything

```bash
npx storybook dev -p 6006
```

The generated example stories must render with **zero** errors first. This is not
ceremony. If you skip it and go straight to a real component, and something
breaks, you cannot tell whether the problem is the install, your aliases, your
providers or your component. Confirm each layer before adding the next.

### Step 3 — replicate the app's provider tree

Find your app's real root. It looks something like this:

```tsx
// src/main.tsx — the real app
<QueryClientProvider client={queryClient}>
  <Provider store={store}>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </Provider>
</QueryClientProvider>
```

Storybook needs the **same shape, in the same nesting order**, as global
decorators — not a simplified version, because a component that reads from the
outermost provider will crash if you only replicated the inner two:

```tsx
// .storybook/preview.tsx
import type {Preview} from '@storybook/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {MemoryRouter} from 'react-router-dom';
import {ThemeProvider} from '../src/theme';
import {rootReducer} from '../src/app/rootReducer';
import '../src/index.css';   // ← the app's entry does this; Storybook must too

const preview: Preview = {
  decorators: [
    (Story) => {
      // A FRESH client per render — see gotcha 1.
      const queryClient = new QueryClient({
        defaultOptions: {queries: {retry: false}},
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
    (Story) => {
      const store = configureStore({reducer: rootReducer});
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
    (Story) => (
      // MemoryRouter, not BrowserRouter — see gotcha 2.
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default preview;
```

Three deliberate differences from the app, each of which is a gotcha below:
`MemoryRouter` instead of `BrowserRouter`, `retry: false` on queries, and fresh
instances created **inside** each decorator rather than at module scope.

### Step 4 — mirror the bundler aliases

Storybook runs its own bundler instance with its own config. Your app's aliases
are not inherited.

```ts
// .storybook/main.ts
import type {StorybookConfig} from '@storybook/react-vite';
import path from 'node:path';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {name: '@storybook/react-vite', options: {}},
  async viteFinal(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      // must match the app's vite.config.ts exactly
      '@': path.resolve(__dirname, '../src'),
    };
    return config;
  },
};

export default config;
```

⚠️ On 10.x this file **must be valid ESM**. `__dirname` is not defined in a true
ES module — if your project is `"type": "module"`, use
`path.dirname(fileURLToPath(import.meta.url))` instead. This is one of the most
common 8.x → 10.x upgrade failures.

### The payoff

With steps 3 and 4 done once, every story afterwards is this:

```tsx
// UserMenu.stories.tsx — reads Redux and the router, and mentions neither
import type {Meta, StoryObj} from '@storybook/react';
import {UserMenu} from './UserMenu';

const meta = {component: UserMenu, title: 'Layout/UserMenu'} satisfies Meta<typeof UserMenu>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
```

**That** is what the afternoon bought.

## Adopting it without a six-month migration

The failure pattern is universal: a team installs Storybook, writes four stories,
declares "we'll backfill the rest later", and later never comes.

Do not backfill. Instead:

1. **Require a story for new and changed components only.** Coverage accumulates
   where the code is actually moving, which is where it is worth having.
2. **Story the components with the most states first** — tables, forms, empty
   states, anything with a loading and an error branch. Never start with the
   button; it has one state and teaches the team nothing.
3. **Give stories a job that fails the build** (the test runner, Phase 9). A story
   nothing depends on gets abandoned; one that gates a merge does not.

### The monorepo adjustments `init` does not make

Running `init` at a package root in a workspace repo typically needs three fixes:

- the `stories` glob only covers that package — widen it to sibling packages if
  the Storybook is meant to be shared;
- aliases pointing at workspace packages need adding to `viteFinal`, and
  source-vs-built resolution decided (source imports are better for HMR);
- if the design system is its own package, decide now whether it gets its own
  Storybook or is composed into a root one — see Phase 10.

## Gotchas

**Symptom — "Could not find react-redux context value" on the first real story,
though the example stories work.** *Cause:* the generated `preview.ts` has no
awareness of your app's providers. *Fix:* Step 3. Replicate the whole tree, in the
app's nesting order — a partial replication fails for exactly the components that
read from the provider you skipped.

**Symptom — interacting with one story changes what a different story renders.**
*Cause:* the store or `QueryClient` was created **once at module scope**, so every
story shares one mutable instance and state leaks across navigation. *Fix:*
construct it **inside** the decorator function, which runs per render, giving each
story genuinely isolated state.

**Symptom — routing behaves strangely, or Storybook's own URL changes when a story
navigates.** *Cause:* `BrowserRouter` reads and writes the real browser URL, and
inside the preview iframe that collides with Storybook's own navigation. *Fix:*
`MemoryRouter` with explicit `initialEntries`. It also lets two stories render the
same component at different routes — which is how you story an active vs inactive
nav link.

**Symptom — the component renders correctly but looks wrong; no error anywhere.**
*Cause:* the app's global stylesheet — Tailwind's output, a reset, the file
defining your CSS custom properties — is imported by the app's entry, which
Storybook never runs. *Fix:* `import '../src/index.css'` in `preview.ts`. This is
the nastiest one on the page precisely because nothing fails: it looks fine unless
you know what correct looks like.

**Symptom — `Cannot resolve '@/newFeature'` in Storybook only, months after
setup.** *Cause:* `viteFinal`/`webpackFinal` aliases are a hand-maintained
duplicate of the app's bundler config. Someone added an alias to the app and not
to Storybook. *Fix:* import and spread the app's actual config in `viteFinal`
rather than retyping the aliases, so there is one source of truth. Where that is
not possible, a comment in both files naming the other is the cheap version. This
is the same drift class as Jest's `moduleNameMapper`.

**Symptom — `main.ts` fails to load after upgrading from 8.x.** *Cause:* 10.x
requires the config to be valid ESM; a `require()`, a `module.exports`, or a bare
`__dirname` will not run. *Fix:* convert to `import`/`export default`, and replace
`__dirname` with `path.dirname(fileURLToPath(import.meta.url))`.

## Interview questions

**★ You ran `storybook init` on an existing app and the example stories work, but
the first real story crashes. What is wrong?**
Nothing is wrong — `init` installs a working baseline but has no knowledge of the
application. The component reads from a provider (store, router, theme, query
client) that Storybook's preview does not supply. The fix is to replicate the
app's provider tree as global decorators in `preview.tsx`, in the same nesting
order the app uses.

**★ Why create the Redux store inside the decorator rather than at module scope?**
Because a module-scope instance is created once and shared by every story, so
state mutated in one story leaks into another on navigation, and stories stop
being reproducible. A decorator function runs per story render, so constructing it
inside gives each story a fresh, isolated store. The same argument applies to
`QueryClient`.

**★ Why `MemoryRouter` rather than `BrowserRouter` in Storybook?**
`BrowserRouter` reads and writes the actual browser URL, which collides with
Storybook's own iframe-based navigation and gives no controllable starting route.
`MemoryRouter` keeps routing state in memory and scoped to the story, and
`initialEntries` lets different stories render the same component at different
routes.

**A component renders in Storybook with no errors but looks visually broken. Where
do you look first?**
The global stylesheet. The app imports it in its entry file, which Storybook never
executes, so the preview document has no reset, no tokens and no utility classes.
It has to be imported in `preview.ts`. It is a nastier failure than a crash
because nothing reports it.

**Storybook can't resolve an import that the app resolves fine. Why?**
Storybook runs its own bundler with its own config and does not inherit the app's
aliases. They are mirrored by hand in `viteFinal`/`webpackFinal`, so they drift —
usually when someone adds an alias to the app months later. Spreading the app's
real config rather than retyping the aliases removes the drift.

**How would you introduce Storybook to a large existing codebase without a
migration project?**
Do not backfill. Require stories for new and changed components only, start with
the components that have the most states rather than the simplest ones, and give
stories a job that fails CI — the test runner — so they cannot quietly rot.

---

**← Prev** [03 · The renderer architecture](./03-renderers-and-builders.md) ·
**Next →** [05 · Storybook 10 and the package consolidation](./05-storybook-10-and-package-consolidation.md)
