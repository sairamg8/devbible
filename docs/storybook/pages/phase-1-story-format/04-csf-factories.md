---
title: "04 · CSF factories"
sidebar_label: "04 · CSF factories"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against the [CSF factories reference](https://storybook.js.org/docs/8/api/csf/csf-factories)
> and the [Storybook 10.3 release post](https://storybook.js.org/blog/storybook-10-3/).
> **No sandbox run** — this page carries no console output.

⚠️ **Experimental.** The reference labels this API experimental and says it may
change. CSF 1, 2 and 3 remain supported and **none of them is deprecated**. Read
this to recognise the syntax and to make an informed adoption decision — not
because the object form is going away.

## What it replaces

The object form you have been writing gets its types from annotations you supply:

```tsx
// CSF 3 — the plain-object form
import type {Meta, StoryObj} from '@storybook/react';
import {Button} from './Button';

const meta = {component: Button} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {args: {primary: true}};
```

The factory form derives them from a chain instead:

```tsx
// CSF factories
import preview from '#.storybook/preview';
import {Button} from './Button';

const meta = preview.meta({
  component: Button,
  parameters: {layout: 'centered'},
});

export const Primary = meta.story({
  args: {primary: true},
});
```

No `Meta`, no `StoryObj`, no `satisfies`, no `type Story`. Each link in the chain
knows what the previous one produced, so `Primary` is fully typed without you
naming a type once.

## The three definitions

The chain starts in your config files, which is why this is more than a story-file
change.

```ts
// .storybook/main.ts
import {defineMain} from '@storybook/react-vite/node';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
});
```

```ts
// .storybook/preview.ts
import {definePreview} from '@storybook/react-vite';
import addonA11y from '@storybook/addon-a11y';

export default definePreview({
  addons: [addonA11y()],
  parameters: {
    a11y: {options: {xpath: true}},
  },
});
```

```tsx
// Button.stories.tsx
import preview from '#.storybook/preview';
import {Button} from './Button';

const meta = preview.meta({component: Button});

export const Primary = meta.story({args: {primary: true}});
export const Disabled = meta.story({args: {primary: true, disabled: true}});
```

Note the **`#.storybook/preview`** import. That `#` is a Node **subpath import**,
declared in `package.json`:

```json
{
  "imports": {
    "#.storybook/preview": "./.storybook/preview.ts"
  }
}
```

It exists so every story file can reach the preview without a relative path that
depends on how deep the file is nested. It is also the first thing to check when
the import does not resolve.

Two further differences worth noticing:

- **Addons are imported and called**, not named as strings — `addonA11y()` inside
  `addons: [...]` in `definePreview`. That is what carries an addon's types into
  the chain, and it is why an addon that does not export annotations cannot
  participate yet.
- **The default export is no longer required** in a story file. `preview.meta()`
  registers the metadata; exporting it is optional.

## Testing: `.run()`

Because a story built by `meta.story()` is a richer object, it carries its own
test entry point:

```tsx
await Primary.run();
```

`run()` mounts the component and executes Storybook's full lifecycle — decorators,
loaders, `beforeEach`, and the play function — which is what makes a story usable
as a test fixture without `composeStories`.

## Should you adopt it?

**On a new project, on React, if you want the type ergonomics: yes, with the
experimental caveat understood.** The chain removes real boilerplate and a whole
class of mis-typing — the `StoryObj<typeof Button>` versus `StoryObj<typeof meta>`
mistake from [topic 03](./03-typing-stories.md) cannot be made, because you never
write the type.

**On an existing project: probably not yet.** The costs are concrete:

| Cost | Detail |
|---|---|
| Config rewrite | `main.ts` and `preview.ts` both change form |
| `package.json` change | the subpath import has to be declared |
| Addon support | community addons that do not export annotations cannot be used in `definePreview` |
| Experimental | the API may change; you would be migrating twice |
| **No mixing within a file** | a single file is one format or the other |

That last row is the one that decides it in practice. You **can** migrate file by
file — old and new formats coexist across a project — but not line by line inside
one file. So the migration unit is a whole story file, and there is no way to try
it on one story.

**Renderer support:** React first, extended to Vue, Angular and Web Components in
**10.3** (April 2026). Check your renderer before planning anything.

## Gotchas

**Symptom — `Cannot find module '#.storybook/preview'`.** *Cause:* the subpath
import is not declared. *Fix:* add an `imports` field to `package.json` mapping
`#.storybook/preview` to the file. This is a Node feature, not a Storybook one, so
the error text will not mention Storybook.

**Symptom — a story file half-converted throws confusing type errors.** *Cause:*
CSF 3 and the factory form mixed in the same file. *Fix:* convert the file
completely or not at all. Different files may use different formats; one file may
not.

**Symptom — an addon works in the string form and cannot be used in
`definePreview`.** *Cause:* `definePreview` takes imported addon *annotations*, and
not every community addon exports them yet. *Fix:* keep that addon configured the
old way, or stay on CSF 3 for now. This is the most common blocker on a real
project.

**Symptom — you converted and the tooling still behaves as before.** *Cause:*
`main.ts` still uses the plain object rather than `defineMain`, so the chain never
starts. *Fix:* all three definitions are part of the same feature — converting only
the story files gets you the syntax without the type inference.

**Symptom — a colleague's PR mixes both formats across the codebase.** *Cause:*
nothing prevents it, and both are valid. *Fix:* this is genuinely fine — decide as
a team whether that is acceptable, because there is no technical forcing function,
only consistency.

## Interview questions

**★ What are CSF factories and what problem do they solve?**
A type-safe alternative to the plain-object story format: `definePreview` in
`preview.ts` produces a `preview` object, `preview.meta()` produces a meta, and
`meta.story()` produces a story. Each link infers from the previous one, so you get
full type safety and autocompletion without writing `Meta`, `StoryObj`,
`satisfies` or a `Story` type alias.

**★ Is CSF 3 deprecated?**
No. CSF 1, 2 and 3 all remain supported and undeprecated, and the factory API is
itself still labelled experimental. Adopting it is an ergonomics decision, not a
migration you are being pushed into.

**What does the `#.storybook/preview` import mean?**
It is a Node subpath import declared in `package.json`'s `imports` field, so story
files can reach the preview object without relative paths that depend on nesting
depth. When it fails to resolve, the cause is usually that the `imports` entry was
never added — and the error will not mention Storybook.

**Can you migrate a project to CSF factories gradually?**
File by file, yes — formats can coexist across a project. Within a single file, no:
a file is entirely one format or the other. So the smallest migration unit is a
whole story file, and you cannot trial it on one story.

**What would stop you adopting it on an existing codebase?**
Addon support, mainly — `definePreview` takes imported addon annotations, and
community addons that do not export them cannot participate. Beyond that: it is
experimental so you may migrate twice, `main.ts`, `preview.ts` and `package.json`
all change, and on a non-React renderer you need at least 10.3.

---

**← Prev** [03 · Typing stories](./03-typing-stories.md) ·
**Next →** [05 · Naming, titles and the sidebar](./05-naming-and-the-sidebar.md)
