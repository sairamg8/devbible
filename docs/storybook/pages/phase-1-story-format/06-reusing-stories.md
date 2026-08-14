---
title: "06 · Reusing stories"
sidebar_label: "06 · Reusing stories"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against the [portable stories reference](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest)
> and the [CSF reference](https://storybook.js.org/docs/api/csf).
> **No sandbox run** — this page carries no console output.

A story is an exported value in an ordinary module, so it can be imported. That
one fact is what stops your Storybook and your test suite from being two
descriptions of the same thing.

## Composing one story from another

Within a file, a story is just an object — spread it:

```tsx
export const Default: Story = {
  args: {orders: sampleOrders, currency: 'GBP'},
};

export const Empty: Story = {
  ...Default,
  args: {...Default.args, orders: []},
};

export const EmptyInEuros: Story = {
  ...Empty,
  args: {...Empty.args, currency: 'EUR'},
};
```

Note `...Default.args` explicitly. Spreading `...Default` alone copies
`parameters`, `decorators` and `play`, but replacing `args` wholesale would lose
`currency` — the same shallow-merge rule as
[topic 01](./01-component-story-format.md), applied by hand.

**When to stop.** Two levels of composition is fine and expresses "the empty case
of the default case". A four-deep chain means the reader has to walk backwards
through four objects to know what actually renders, and a change at the root
silently changes all of them. At that point write the args out.

## Importing stories into tests

`composeStories` applies everything Storybook would apply — the meta, the
decorators, `preview.ts` globals, loaders — and hands back renderable components:

```tsx
// OrderTable.test.tsx
import {render, screen} from '@testing-library/react';
import {composeStories} from '@storybook/react';
import * as stories from './OrderTable.stories';

const {Default, Empty, FailedToLoad} = composeStories(stories);

test('renders every order', () => {
  render(<Default />);
  expect(screen.getAllByRole('row')).toHaveLength(sampleOrders.length + 1);
});

test('shows the empty state', () => {
  render(<Empty />);
  expect(screen.getByText('No orders yet')).toBeInTheDocument();
});
```

`composeStory` (singular) does the same for one story when you do not want the
whole module.

**Why this matters more than it looks:** without it, the test file re-declares the
empty state, the error state and the loaded state as its own fixtures. Two
descriptions of the same states, in two files, maintained by two different habits.
They will drift, and the story is the one that drifts silently, because nothing
fails when it goes stale.

A composed story also **runs its `play` function** when you call it, so an
interaction already written for Storybook does not need rewriting for the test.

### Under CSF factories

The factory form gives a story its own entry point instead:

```tsx
await Primary.run();
```

`run()` mounts the component and executes the full lifecycle — decorators,
loaders, `beforeEach`, play. Same idea, no `composeStories` call. See
[topic 04](./04-csf-factories.md).

## Reusing across files

You can import a story from another story file, but ask what you actually want
first:

- **Shared *data*?** Put it in a fixtures module — `orders.fixtures.ts` — and
  import that from both. This is almost always the right answer.
- **Shared *setup*?** That is a decorator, global or per-file. Phase 3.
- **Genuinely the same story in two places?** Reconsider. Two sidebar entries for
  one thing is a navigation problem, not a reuse win.

The one solid cross-file case is a **composite** component whose story wants a
child in a known state:

```tsx
// OrderPage.stories.tsx
import {Empty as EmptyTable} from '../OrderTable/OrderTable.stories';

export const NoOrders: Story = {
  args: {tableProps: EmptyTable.args},
};
```

This is a real coupling and worth being deliberate about: changing `EmptyTable`'s
args now changes a story in another file, and nothing in either file says so.

## Gotchas

**Symptom — a composed story spread from another lost half its args.** *Cause:*
`{...Default, args: {orders: []}}` replaces `args` wholesale rather than merging.
*Fix:* `args: {...Default.args, orders: []}`. Spreading the story and spreading its
args are two separate operations.

**Symptom — a test using a story fails though the story renders fine in
Storybook.** *Cause:* the test rendered the raw export instead of the composed one,
so the meta, decorators and `preview.ts` config were never applied. *Fix:*
`composeStories(stories)` and render what it returns, not the imported object.

**Symptom — changing one story broke several others.** *Cause:* a composition
chain several levels deep. *Fix:* flatten it. Composition is for expressing "this
state, but empty", not for building an inheritance tree.

**Symptom — a helper you exported for reuse now shows up as a broken story.**
*Cause:* every named export in a story file is treated as a story. *Fix:* put
shared values in a separate fixtures module and import from there.

**Symptom — a cross-file story import creates a circular import.** *Cause:* two
story files importing each other's stories. *Fix:* extract the shared fixture to a
third module. This is the point at which "reuse the story" has become the wrong
tool.

## Interview questions

**★ How can a Storybook story be reused as a test fixture?**
`composeStories` (or `composeStory`) takes the story module and returns renderable
components with the meta, decorators and global `preview.ts` config already
applied. Rendering one runs the same thing Storybook renders — including its `play`
function — so the demo and the test fixture are one artifact instead of two
descriptions that drift.

**★ Why does that matter beyond saving typing?**
Because the alternative is declaring the empty, loading and error states twice, in
two files. When they diverge it is the story that goes stale silently — nothing
fails, it just stops describing the component. Sharing the fixture removes the
possibility rather than relying on discipline.

**How do you build one story from another, and what is the trap?**
Spread it — `{...Default, args: {...Default.args, orders: []}}`. The trap is
spreading the story without spreading its args: `args` is replaced wholesale, not
merged, so the other args vanish.

**When is importing a story from another story file the right call?**
Rarely — mainly for a composite component whose story needs a child in a known
state. For shared data use a fixtures module; for shared setup use a decorator. And
be aware the import is a real coupling that neither file advertises.

**What is `run()` in CSF factories?**
The factory equivalent of composing a story for a test: it mounts the component and
runs Storybook's full lifecycle — decorators, loaders, `beforeEach` and the play
function — directly off the story object, without a `composeStories` call.

---

**← Prev** [05 · Naming, titles and the sidebar](./05-naming-and-the-sidebar.md) ·
**Next →** the phase index — [Phase 1 overview](./README.md)
