---
title: "03 · Providers in decorators"
sidebar_label: "03 · Providers"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [decorators documentation](https://storybook.js.org/docs/writing-stories/decorators)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

This is the topic that decides whether writing a story costs two lines or twenty.

Do it once, properly, and every story afterwards is `export const Default: Story =
{}`. Do it badly and every story file re-implements your app's root.

## The global provider decorator

Mirror your app's real root, as **one decorator with explicit JSX nesting**
([topic 02](./02-decorator-order.md) explains why not four array entries):

```tsx
// .storybook/preview.tsx
import type {Preview} from '@storybook/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {ThemeProvider} from '../src/theme';
import '../src/index.css';

const preview: Preview = {
  decorators: [
    (Story, context) => {
      // Fresh per render — see "one instance per story" below.
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {retry: false, gcTime: 0},
          mutations: {retry: false},
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider mode={context.globals.theme}>
            <MemoryRouter initialEntries={[context.parameters.route ?? '/']}>
              <Story />
            </MemoryRouter>
          </ThemeProvider>
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
```

Three things in there are deliberate and each is a section below: the fresh client
per render, `retry: false`, and `MemoryRouter` reading a parameter.

## 🔴 One instance per story, not one per module

The single most damaging mistake in this phase:

```tsx
// ❌ Created once, shared by every story, for the lifetime of the session.
const queryClient = new QueryClient();
const store = configureStore({reducer: rootReducer});

const preview: Preview = {
  decorators: [(Story) => (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Story />
      </Provider>
    </QueryClientProvider>
  )],
};
```

Every story now shares one mutable cache and one mutable store. Consequences, in
the order you will meet them:

- a mutation fired in one story changes what a later story renders;
- a story passes when you open it directly and fails after visiting another —
  **order-dependent behaviour that no URL reproduces**;
- the test runner, which visits every story in sequence, produces failures that do
  not reproduce locally.

```tsx
// ✅ Constructed inside the decorator, which runs per story render.
decorators: [(Story) => {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const store = configureStore({reducer: rootReducer});
  return (/* … */);
}],
```

The cost is a fresh store per render. That is the point.

## Configure for isolation, not for production

Your app's provider settings are tuned for a real network. A story has none.

| Provider | Production setting | In Storybook | Why |
|---|---|---|---|
| TanStack Query | `retry: 3` | **`retry: false`** | a failing request retries three times before your error story shows anything |
| TanStack Query | `gcTime` default | `gcTime: 0` | stops cache surviving between stories |
| Router | `BrowserRouter` | **`MemoryRouter`** | must not touch the real URL — it collides with Storybook's own navigation |
| Redux | real middleware | mock reducers, or a preloaded state | you want a known state, not a reachable one |
| i18n | lazy-loaded catalogues | eagerly loaded | avoids a flash of keys in every snapshot |

`retry: false` in particular: without it, a story demonstrating an error state sits
in a loading spinner for several seconds first, and a visual-regression snapshot
catches whichever moment it happened to be in.

## Making a provider configurable per story

A global decorator that reads `context.parameters` lets any story adjust it
without its own decorator:

```tsx
// preview.tsx
<MemoryRouter initialEntries={[context.parameters.route ?? '/']}>
```

```tsx
// A story that needs a specific route
export const OnOrderDetail: Story = {
  parameters: {route: '/orders/42'},
};
```

The same shape works for a preloaded Redux state, a mocked user, or a feature flag:

```tsx
<Provider store={configureStore({
  reducer: rootReducer,
  preloadedState: context.parameters.preloadedState,
})}>
```

```tsx
export const AsAdmin: Story = {
  parameters: {preloadedState: {auth: {user: adminUser}}},
};
```

**This is the pattern to reach for before adding a story-level decorator.** It
keeps the provider wiring in one place and turns per-story variation into data —
the same argument as args over JSX in Phase 2.

## Scoped providers

Not everything belongs globally
([topic 01](./01-what-a-decorator-is.md)). A store for the six connected
components goes on those files' metas:

```tsx
// CartBadge.stories.tsx
const meta = {
  component: CartBadge,
  decorators: [(Story) => {
    const store = configureStore({
      reducer: {cart: () => ({items: ['sku_1', 'sku_2']})},
    });
    return <Provider store={store}><Story /></Provider>;
  }],
} satisfies Meta<typeof CartBadge>;
```

The other eighty-four components stay provider-free, and if one of them starts
reading from the store it crashes — which is the signal you want.

## Gotchas

**Symptom — interacting with one story changes what a different story renders.**
*Cause:* the store or `QueryClient` was constructed at module scope and is shared.
*Fix:* construct it inside the decorator, which runs per story render.

**Symptom — a test passes locally and fails in the test runner, or vice versa.**
*Cause:* the same shared-instance problem. The runner visits stories in sequence,
so leaked state that you never noticed clicking around becomes deterministic
failure. *Fix:* as above.

**Symptom — an error-state story shows a spinner for several seconds first.**
*Cause:* the query client is retrying with production settings. *Fix:* `retry:
false` in the Storybook client.

**Symptom — routing breaks Storybook's own navigation, or the sidebar URL
changes.** *Cause:* `BrowserRouter` reads and writes the real URL, and the preview
is an iframe inside Storybook's own routing. *Fix:* `MemoryRouter` with explicit
`initialEntries`.

**Symptom — you are adding a story-level decorator for the third time to vary one
value.** *Cause:* the global decorator is not parameterised. *Fix:* have it read
`context.parameters`, and let stories set data instead of writing decorators.

**Symptom — a component renders but its data never arrives.** *Cause:* the provider
is present but has no data source — a `QueryClient` with no mocked responses will
sit fetching forever. *Fix:* mock at the network layer, or pass the data as props
for the story. A provider is not a data source.

## Interview questions

**★ Why must a store or QueryClient be created inside the decorator rather than at
module scope?**
Because a module-scope instance is created once and shared by every story, so
mutations in one leak into another. That produces order-dependent behaviour no URL
reproduces, and failures in the test runner — which visits stories in sequence —
that do not reproduce locally. A decorator function runs per story render, so
constructing it inside gives each story genuine isolation.

**★ How should provider configuration in Storybook differ from production?**
It should be tuned for isolation rather than for a real network: `retry: false` and
`gcTime: 0` on the query client so error states appear immediately and caches do
not survive between stories, `MemoryRouter` instead of `BrowserRouter` so routing
never touches the real URL, and known preloaded state instead of reachable state.

**★ How do you let individual stories vary a globally-provided value without each
writing its own decorator?**
Have the global decorator read `context.parameters` — for example
`initialEntries={[context.parameters.route ?? '/']}` — so a story sets
`parameters: {route: '/orders/42'}`. Provider wiring stays in one place and
per-story variation becomes data, which is the same argument as args over hardcoded
JSX.

**Why `MemoryRouter` rather than `BrowserRouter`?**
`BrowserRouter` reads and writes the actual browser URL, which collides with
Storybook's own iframe-based navigation and gives no controllable starting route.
`MemoryRouter` keeps routing in memory, scoped to the story, and `initialEntries`
lets different stories render the same component at different routes.

**A component renders but its data never loads, even though the QueryClient
provider is present. Why?**
Because a provider is not a data source. The client has nothing to fetch from in
isolation, so it stays pending. Either mock at the network layer or pass the data
in as props for that story.

---

**← Prev** [02 · Decorator order](./02-decorator-order.md) ·
**Next →** [04 · The story context](./04-the-story-context.md)
