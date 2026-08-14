---
title: "05 · Loaders and beforeEach"
sidebar_label: "05 · Loaders and beforeEach"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against the [loaders documentation](https://storybook.js.org/docs/writing-stories/loaders/)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

Decorators wrap. These two **run before the story renders**, which is a different
job, and a decorator is the wrong tool for it.

## Loaders — async data before render

A loader is an async function that runs before the story renders; whatever it
returns is injected into the render context as `loaded`.

```tsx
const meta = {
  component: OrderTable,
  loaders: [
    async () => ({
      orders: await (await fetch('/api/orders')).json(),
    }),
  ],
} satisfies Meta<typeof OrderTable>;

export const FromTheApi: Story = {
  render: (args, {loaded: {orders}}) => <OrderTable {...args} orders={orders} />,
};
```

Loaders run at **all levels that apply** — global, component, story — before the
story renders on the canvas, and their results are merged into `loaded`.

### Use it sparingly

A story that fetches from a live API has given up the property that makes stories
useful: **it no longer renders the same thing every time.** The empty state depends
on the database, the loading state cannot be reached deliberately, and a visual
snapshot changes when someone adds a row.

| Prefer | Over a loader |
|---|---|
| static fixtures as `args` | fetching the real data |
| network mocking (MSW and similar) | fetching the real data |
| a story per state | one story whose state depends on the server |

Legitimate uses: lazy-loading a genuinely heavy asset, loading a locale catalogue,
or a deliberately-labelled story that documents integration against a real
endpoint.

## `beforeEach` — setup with cleanup

`beforeEach` is an async function that runs before the story, and **can return a
cleanup function** which runs after the story — when it is remounted or navigated
away from.

```tsx
const meta = {
  component: Countdown,
  async beforeEach() {
    MockDate.set('2026-08-14T12:00:00Z');
    return () => {
      MockDate.reset();          // runs after the story
    };
  },
} satisfies Meta<typeof Countdown>;
```

It can be defined globally in `preview.ts`, on the meta, or on a single story.

**This is what a decorator with a side effect should have been.** Compare with
[topic 01](./01-what-a-decorator-is.md)'s bad example: a decorator that registers a
listener has no natural cleanup hook, so you had to invent a wrapper component and
a `useEffect`. `beforeEach` has cleanup built in.

| Need | Use |
|---|---|
| wrap the story in markup or a provider | **decorator** |
| async data before render | **loader** |
| set up and tear down environment state | **`beforeEach`** |

Environment state means: frozen clocks, seeded randomness, mocked `matchMedia`,
network handlers, `localStorage`. None of those are markup, and all of them leak
if they are not cleaned up.

## The determinism argument

Both of these exist mostly in service of one goal, and it becomes concrete in
Phase 8: **a story must render identically every time**. The four usual sources of
drift and their fixes:

| Drift | Fix |
|---|---|
| `new Date()` in the component | freeze the clock in `beforeEach`, reset in cleanup |
| `Math.random()` | seed it in `beforeEach` |
| live API data | fixtures or mocks, not a loader |
| leaked state from the previous story | cleanup from `beforeEach`; fresh providers per render |

A story that fails the "open it twice, get the same pixels" test is not yet
finished, and it will be a flaky visual-regression check later.

## Gotchas

**Symptom — a story renders correctly alone and differently after visiting
another.** *Cause:* setup with no teardown — a mocked clock, a global handler, a
`localStorage` key. *Fix:* return a cleanup function from `beforeEach`. A decorator
cannot do this without a wrapper component and a `useEffect`.

**Symptom — visual snapshots differ on every run.** *Cause:* the component reads
the real clock or real randomness. *Fix:* freeze both in `beforeEach` with cleanup.
See Phase 8.

**Symptom — a story is slow, or blank until a request finishes.** *Cause:* a loader
fetching from a real API. *Fix:* fixtures as args, or network mocking. Reserve
loaders for genuinely heavy assets.

**Symptom — `loaded` is `undefined` in `render`.** *Cause:* the loader is defined at
a level that does not apply to that story, or its return value is not an object —
results are merged, so a loader must return an object to contribute keys. *Fix:*
return `{key: value}`, and check which level the loader is on.

**Symptom — a story's empty state stopped being empty.** *Cause:* it fetches live
data and someone added a row. *Fix:* the state should be declared in the story, not
discovered from a server. This is the whole argument against loaders for data.

## Interview questions

**★ What is the difference between a decorator, a loader and `beforeEach`?**
A decorator wraps the story in markup — providers, layout. A loader is an async
function that runs before render and injects its result into the render context as
`loaded`. `beforeEach` runs before the story and can return a cleanup function that
runs after it. Markup, data, and environment setup respectively.

**★ Why is `beforeEach` better than a decorator for a mocked clock?**
Because it has teardown. A decorator has no natural cleanup hook, so a side effect
set up in one requires a wrapper component with a `useEffect` cleanup to avoid
leaking across story navigation. `beforeEach` returns a cleanup function that runs
when the story is remounted or navigated away from.

**★ Why should a loader rarely fetch from a real API?**
Because it breaks the property that makes stories useful — that they render the
same thing every time. The empty state then depends on the database, the loading
state cannot be reached deliberately, and visual snapshots change whenever the data
does. Use fixtures or network mocking, and one story per state.

**A story renders correctly on its own but differently after you visit another
story. What would you look for?**
Setup without teardown — a frozen clock, a global event handler, a seeded value, a
`localStorage` key — or a provider instance created at module scope and shared. The
fixes are a cleanup function from `beforeEach` and constructing providers inside
the decorator.

**Where can `beforeEach` be defined?**
Globally in `preview.ts`, on the component meta, or on an individual story — the
same three levels as decorators, parameters and args.

---

**← Prev** [04 · The story context](./04-the-story-context.md) ·
**Next →** the phase index — [Phase 3 overview](./README.md)
