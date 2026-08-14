---
title: "01 · Args as the source of truth"
sidebar_label: "01 · Args"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [args reference](https://storybook.js.org/docs/writing-stories/args)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

`args` are a story's inputs **as data**. That is the entire idea, and four
separate Storybook features exist only because of it.

```tsx
// args — data
export const Primary: Story = {args: {variant: 'primary', label: 'Save'}};

// not args — frozen JSX
export const Primary: Story = {render: () => <Button variant="primary" label="Save" />};
```

Both render the same pixels. Only the first one is useful.

## What being data buys you

| Feature | Why it needs args to be data |
|---|---|
| **Controls** | The panel is generated from the args' shape — it cannot inspect JSX |
| **Autodocs** | The props table and the live canvas read the same args |
| **`play` functions** | Receive `args` and can assert against the values the story declares |
| **Composition** | `{...Default.args, orders: []}` — you cannot spread JSX |
| **Portable stories** | `composeStories` hands the args to a test as props |

Hardcode props in `render` and you lose all five at once. This is the single
biggest "Storybook isn't doing anything for us" cause: the stories were written
as JSX snapshots, so the tool has nothing to work with.

## How args resolve

Three sources, merged in order:

```
meta.args          defaults for every story in the file
  + story.args     overrides for this export
  + live edits     the Controls panel, session-only
  ─────────────────
  = the props the component actually receives
```

**Live edits are session-only.** Reloading, or navigating away and back, resets to
what the file declares. That is deliberate — a story must render the same for
everyone — but it catches people who spent ten minutes tuning a control and
expected it to persist. If a combination is worth keeping, it is worth being a
named export.

The merge rules are the ones from
[Phase 1 topic 01](../phase-1-story-format/01-component-story-format.md): merge
not replace, and shallow.

## Args in `render`

If you need `render`, the args must still flow through, or you have opted out of
everything above:

```tsx
// ❌ Controls panel goes dead — the args exist but nothing consumes them.
export const InAForm: Story = {
  args: {label: 'Submit', variant: 'primary'},
  render: () => (
    <form>
      <Button label="Submit" variant="primary" />
    </form>
  ),
};

// ✅ Args still drive the component.
export const InAForm: Story = {
  args: {label: 'Submit', variant: 'primary'},
  render: (args) => (
    <form onSubmit={(e) => e.preventDefault()}>
      <Button {...args} />
    </form>
  ),
};
```

The symptom of getting this wrong is the panel reporting **"This story has no
controls"**, or showing controls that do nothing when you drag them.

## Args a component does not take

Args are not restricted to props. An arg can drive the `render` function itself:

```tsx
const meta = {
  component: OrderTable,
  argTypes: {
    rowCount: {control: {type: 'range', min: 0, max: 500, step: 10}},
  },
} satisfies Meta<typeof OrderTable>;

export const Scaling: Story = {
  args: {rowCount: 50},
  render: ({rowCount, ...args}) => (
    <OrderTable {...args} orders={makeOrders(rowCount)} />
  ),
};
```

`rowCount` is not a prop of `OrderTable`. It is a **knob for the story**, and it
turns "does this table survive 500 rows" from a code edit into a slider. This is
the pattern for anything expensive or awkward to express as a literal prop value.

## Args and the play function

```tsx
const meta = {
  component: Button,
  args: {onClick: fn()},          // fn() from 'storybook/test' — topic 04
} satisfies Meta<typeof Button>;

export const Clicks: Story = {
  args: {label: 'Save'},
  play: async ({canvas, userEvent, args}) => {
    await userEvent.click(canvas.getByRole('button', {name: args.label}));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

The play function reads `args.label` rather than repeating the string `'Save'`.
Change the arg and the test follows. This is only possible because args are data
the story can hand back to you.

## Designing good args

- **One arg per meaningful axis.** If `variant` and `size` vary independently,
  they are two args and the Controls panel is a matrix. If they never vary
  independently, they are one.
- **Put stable defaults on the meta, differences on the story.** A story whose
  args restate the meta's is noise; a story whose args are only the delta reads as
  a sentence: *"the default, but empty"*.
- **Callbacks get `fn()`, always.** An undefined callback is a crash waiting for a
  click; `fn()` is a spy the Actions panel shows and the play function asserts on.
- **Avoid deep object args when you can.** The shallow merge bites, and the
  `object` control is a raw JSON editor that is easy to break. Prefer several flat
  args, or a story-level knob that builds the object in `render`.

## Gotchas

**Symptom — "This story has no controls."** *Cause:* the story has no args, or a
`render` hardcodes the props instead of spreading `args`. *Fix:* drive the
component from args and spread them in `render`. The panel reflects the args, not
what is on screen.

**Symptom — dragging a control changes nothing.** *Cause:* same root — `render`
ignores its `args` parameter. *Fix:* `render: (args) => <Component {...args} />`.

**Symptom — a carefully tuned control combination vanished on reload.** *Cause:*
control edits are session-only by design; the file is the source of truth. *Fix:*
if it is worth keeping, make it a named export.

**Symptom — a story renders with a prop nobody set here.** *Cause:* `meta.args`
supplies it to every story in the file. *Fix:* override it explicitly, or stop
putting it on the meta if the stories do not actually share it.

**Symptom — an object arg lost fields when overridden.** *Cause:* the merge is
shallow, so an object value is replaced wholesale. *Fix:* spread the meta's value,
or flatten the args.

**Symptom — clicking a button in a story throws "onClick is not a function".**
*Cause:* the callback has no arg at all. *Fix:* `onClick: fn()` on the meta, so
every story in the file has a safe, assertable spy.

## Interview questions

**★ Why are `args` better than hardcoding props in the story's JSX?**
Because they are data rather than markup, and four features read that data:
Controls generates its panel from it, Autodocs builds the props table and canvas
from it, `play` functions receive it and can assert against it, and stories can be
composed and handed to tests by spreading it. Hardcoding props in `render` opts out
of all four at once.

**★ A story shows "This story has no controls". What is wrong?**
Either it declares no args, or its `render` hardcodes props instead of spreading
`args`. The panel is generated from the args, not from what is rendered — so a
story can look perfect and still have nothing to control.

**★ Where do a story's final args come from?**
Three sources merged in order: `meta.args`, then the story's own `args`, then
session-only edits made in the Controls panel. Story args override meta args per
key, the merge is shallow, and live edits never persist across a reload.

**Can an arg be something the component does not accept as a prop?**
Yes, and it is a useful pattern. An arg like `rowCount` can drive the `render`
function — building 500 rows from a slider — turning something you would otherwise
edit in code into something a reviewer can explore.

**Why should callbacks be `fn()` rather than left undefined?**
Because undefined means a click throws, and a real inline function is neither
visible in the Actions panel nor assertable. `fn()` from `storybook/test` gives a
spy that logs to Actions and that a play function can assert was called with the
right payload.

---

**Next →** [02 · argTypes and control inference](./02-argtypes-and-inference.md)
