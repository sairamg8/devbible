---
title: "01 · Component Story Format"
sidebar_label: "01 · Component Story Format"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [CSF reference](https://storybook.js.org/docs/api/csf)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

A story file is an **ES module with a convention**, not a config file. That single
sentence explains almost everything about how it behaves.

```tsx
// Button.stories.tsx
import type {Meta, StoryObj} from '@storybook/react';
import {Button} from './Button';

const meta = {
  component: Button,
  title: 'Components/Button',
} satisfies Meta<typeof Button>;

export default meta;                       // ← metadata about the component
type Story = StoryObj<typeof meta>;

export const Primary: Story = {            // ← one state
  args: {variant: 'primary', label: 'Place order'},
};

export const Disabled: Story = {           // ← another state
  args: {variant: 'primary', label: 'Place order', disabled: true},
};
```

**The default export is metadata about the component. Every named export is one
state of it.** There is no registration call, no `describe`, no plugin. Storybook
imports the module and reads its exports.

## The three levels

Configuration exists at three levels, and they **merge**, outermost first:

```
preview.ts   (global)   → every story in the project
      ↓
meta         (file)     → every story in this file
      ↓
story        (export)   → this story only
```

Later levels override earlier ones **per key**, not wholesale. This is the single
most misunderstood behaviour in CSF, and it gets its own section below.

## What goes on `meta`

```tsx
const meta = {
  component: Button,                        // the component these stories are for
  title: 'Components/Button',               // sidebar path — optional, see topic 04
  tags: ['autodocs'],                       // opt into a generated docs page
  parameters: {layout: 'centered'},         // display config for every story here
  args: {variant: 'primary'},               // DEFAULT args for every story here
  argTypes: {
    variant: {control: 'select', options: ['primary', 'secondary']},
  },
  decorators: [(Story) => <div style={{padding: 24}}><Story /></div>],
} satisfies Meta<typeof Button>;
```

Anything shared by every story in the file belongs here. Repeating
`parameters: {layout: 'centered'}` on each story is not just verbose — it means a
change to that setting is a change to every export.

## What goes on a story

```tsx
export const Loading: Story = {
  args: {isLoading: true},                  // merged over meta.args
  parameters: {backgrounds: {default: 'dark'}},
  name: 'Loading (slow network)',           // display name, overrides the export name
  tags: ['!autodocs'],                      // opt this one story out
  play: async ({canvas, userEvent}) => {},  // Phase 6
};
```

## `args` merge, they do not replace

```tsx
const meta = {
  component: Button,
  args: {variant: 'primary', size: 'md'},
} satisfies Meta<typeof Button>;

export const LongLabel: Story = {
  args: {label: 'A considerably longer button label'},
};

// LongLabel actually renders with:
//   {variant: 'primary', size: 'md', label: 'A considerably longer button label'}
```

This is usually what you want — DRY defaults, per-story overrides. It becomes a
bug when you assume a story is a clean slate:

```tsx
const meta = {
  component: Alert,
  args: {severity: 'error', dismissible: true},
} satisfies Meta<typeof Alert>;

// ❌ "Why is the info alert dismissible?" — because meta said so and nobody
// overrode it here.
export const Info: Story = {args: {severity: 'info'}};

// ✅ Override it explicitly.
export const Info: Story = {args: {severity: 'info', dismissible: false}};
```

The merge is **shallow**. An object-valued arg is replaced wholesale, not deep
merged:

```tsx
const meta = {args: {user: {name: 'Ada', role: 'admin'}}} satisfies Meta<typeof Profile>;

// user is now {name: 'Grace'} — role is GONE, not 'admin'.
export const Grace: Story = {args: {user: {name: 'Grace'}}};

// Spread it yourself if you meant to patch.
export const Grace: Story = {args: {user: {name: 'Grace', role: 'admin'}}};
```

## `render` — and when not to use it

Storybook's default is `<Component {...args} />`. When a story cannot be expressed
as one component with one set of props, supply a `render`:

```tsx
// Legitimate: two instances side by side for a design review.
export const BeforeAfter: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 24}}>
      <Card title="Old design" variant="default" />
      <Card title="New design" variant="highlighted" />
    </div>
  ),
};
```

```tsx
// ❌ Pointless: this is exactly what Storybook does by default, and writing it
// out by hand is how the Controls panel stops tracking your args.
export const Primary: Story = {
  render: (args) => <Button {...args} />,
  args: {variant: 'primary', label: 'Click'},
};

// ✅
export const Primary: Story = {args: {variant: 'primary', label: 'Click'}};
```

If you do need `render` **and** working controls, spread the args through:

```tsx
export const InsideAForm: Story = {
  args: {variant: 'primary', label: 'Submit'},
  render: (args) => (
    <form onSubmit={(e) => e.preventDefault()}>
      <Button {...args} />           {/* ← args still flow, controls still work */}
    </form>
  ),
};
```

## Why CSF is a module, and what that buys you

Because a story file is just a module, a story is just a value — importable
anywhere:

```tsx
// Button.test.tsx — the story is the fixture
import {composeStories} from '@storybook/react';
import * as stories from './Button.stories';

const {Primary, Disabled} = composeStories(stories);
```

`composeStories` applies the meta, the decorators and the global `preview.ts`
config, and hands you a renderable component. **The demo and the test fixture stop
being two things.** That is the payoff of the format being a module rather than a
registry.

## Gotchas

**Symptom — a story renders with a prop you never set.** *Cause:* `meta.args`
supplies defaults to every story in the file, and story `args` merge over them
rather than replacing them. *Fix:* override the key explicitly in the story. When
a file's stories genuinely have nothing in common, do not put `args` on the meta.

**Symptom — an object arg lost half its fields.** *Cause:* the merge is shallow;
an object value is replaced, not deep merged. *Fix:* spread the meta's value
yourself, or keep object args out of the meta.

**Symptom — the Controls panel stopped working for one story.** *Cause:* a
`render` that ignores its `args` parameter and hardcodes props. *Fix:* spread
`args` into the component inside `render`, or drop `render` if it was only
reproducing the default.

**Symptom — a story does not appear, and there is no error.** *Cause:* it is not a
named export — it is a `const` that was never exported, or it was exported from a
file the `stories` glob does not match. *Fix:* check the export keyword first,
then the glob (topic 02).

**Symptom — Storybook complains about an export it should be ignoring.**
*Cause:* every named export in a story file is assumed to be a story, including
your helper `const sampleRows = [...]`. *Fix:* do not export helpers from a story
file — keep them unexported, or move them to a sibling module.

## Interview questions

**★ What is Component Story Format?**
A convention over ES modules: the default export is metadata about the component
(which component, sidebar title, shared parameters, shared args), and every named
export is one story — one state of that component. There is no registration API,
which is what makes a story an ordinary importable value.

**★ How do `args` on the meta and `args` on a story interact?**
They merge, per key, with the story winning — the story does not replace the
meta's args. That gives DRY defaults, but it surprises people who assume a story
starts blank. The merge is also shallow, so an object-valued arg is replaced
wholesale rather than deep merged.

**★ When should a story use `render`, and when is it a mistake?**
Use it when the story cannot be expressed as one component with one props object —
multiple instances, wrapping markup, composition. It is a mistake when it just
reproduces the default `<Component {...args} />`, because that adds noise and, if
you forget to spread `args`, silently breaks the Controls panel.

**Why is it useful that a story file is a plain module?**
Because a story is then just an exported value, so other tools can import it. With
`composeStories` you get the story with its meta, decorators and global config
already applied, which means your unit test and your Storybook demo are the same
fixture and cannot drift apart.

**What are the three levels of configuration and how do they combine?**
Global (`preview.ts`), file (`meta`), and story. They merge outermost-first, with
the more specific level overriding per key. Knowing the order is how you explain
why an override "did not apply" — usually the value is being set at a level you
were not looking at.

---

**Next →** [02 · File structure and the stories glob](./02-file-structure-and-the-glob.md)
