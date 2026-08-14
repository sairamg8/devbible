---
title: "05 · Naming, titles and the sidebar"
sidebar_label: "05 · Naming and the sidebar"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against [Naming components and hierarchy](https://storybook.js.org/docs/writing-stories/naming-components-and-hierarchy)
> and the [parameters reference](https://storybook.js.org/docs/api/parameters).
> **No sandbox run** — this page carries no console output.

The sidebar is the interface. Nobody reads a Storybook by opening files, so
whether it is usable at 200 components is decided by two strings and one sort
config.

## The hierarchy comes from `title`

```tsx
const meta = {
  component: Button,
  title: 'Components/Forms/Button',
} satisfies Meta<typeof Button>;
```

Slashes are the tree. That gives:

```
Components
└── Forms
    └── Button
        ├── Primary
        ├── Secondary
        └── Disabled
```

**Component name from `title`, story names from the export names.** An export
called `WithLongLabel` displays as "With Long Label" — Storybook splits camelCase
into words for you. Override it per story when the generated name is not what you
want to read:

```tsx
export const SlowNetwork: Story = {
  name: 'Loading (slow network)',
  args: {isLoading: true},
};
```

## Omitting `title`

If you leave `title` off, Storybook generates one from the file's path relative to
the matching `stories` glob entry, with any `titlePrefix` prepended.

This is the better default on a codebase whose directory structure already means
something. It has one real advantage — **the sidebar cannot drift from the file
tree**, because it *is* the file tree — and one real cost: moving a file changes
its story id, which breaks bookmarks, and breaks any tool that stored ids
(a visual-diff baseline, for instance).

Pick one policy and hold it:

| Policy | Use when |
|---|---|
| **No `title`, structure by directory** | your folders already reflect how people think about the components |
| **Explicit `title` everywhere** | the sidebar should group by domain rather than by where the code happens to live |

What does not work is half of each, which is how you end up with `Components/Button`
and `components/forms/Button` as two separate top-level trees that look like a bug.

## Ordering with `storySort`

Alphabetical is the default and it is rarely what you want — "Atoms, Molecules,
Organisms" sorts as "Atoms, Molecules, Organisms" by luck, but "Introduction"
lands between "Forms" and "Layout".

Configure it in `preview.ts`, under `parameters.options`:

```ts
// .storybook/preview.ts
const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        method: 'alphabetical',
        order: ['Introduction', 'Design System', ['Colors', 'Typography'], 'Components', '*'],
        locales: 'en-US',
      },
    },
  },
};
export default preview;
```

The pieces:

| Key | What it does |
|---|---|
| `method` | `'alphabetical'`, `'alphabetical-by-kind'`, or `'custom'` |
| `order` | an explicit list; **anything not named appears after the listed items** |
| nested array | sorts the second level — `['Colors', 'Typography']` orders inside `Design System` |
| `locales` | the locale for alphabetical comparison, e.g. `'en-US'` |
| `includeNames` | whether story names take part in sorting; **defaults to `false`** |

`'*'` is the useful idiom: it marks where the unlisted remainder goes, so you can
pin a few things to the top and let the rest sort itself.

For anything the declarative form cannot express, `storySort` also accepts a
function, which receives each story's title, name and import path along with its
id.

## `tags`

Tags are how a story opts into or out of behaviour, and they merge across the three
levels like everything else:

```tsx
const meta = {
  component: Button,
  tags: ['autodocs'],           // this file gets a generated docs page
} satisfies Meta<typeof Button>;

export const Primary: Story = {args: {primary: true}};

export const EdgeCase: Story = {
  tags: ['!autodocs'],          // …but keep this one out of the docs page
  args: {label: 'x'.repeat(200)},
};
```

The `!` prefix removes an inherited tag. That is the mechanism behind "why is my
scratch story in the published documentation" — it inherited `autodocs` from the
meta and nothing removed it.

## Naming that survives 200 components

- **Group by what a person is looking for, not by your folder layout** — unless the
  folder layout already is that. `Forms/DatePicker` beats `Components/DatePicker`
  when there are forty components.
- **Name stories after the state, not the props.** `Loading`, `Empty`,
  `PermissionDenied` — not `IsLoadingTrue`. The reader is looking for a situation.
- **Put `Default` first** and let the rest sort naturally. It is the one everybody
  opens.
- **Reserve a top-level section for prose** — `Introduction`, `Getting Started` —
  and pin it first with `order`. A Storybook that opens on a random button teaches
  a newcomer nothing.
- **Do not encode status in the name.** `Button (deprecated)` sorts strangely and
  cannot be filtered. Use a tag.

## Gotchas

**Symptom — the same component appears twice in the sidebar under slightly
different paths.** *Cause:* two `title` values differing in case or wording, or a
mix of explicit titles and generated ones. *Fix:* pick one policy for the whole
project. Titles are case-sensitive strings, not identifiers.

**Symptom — `order` was set and the sidebar ignored part of it.** *Cause:* entries
in `order` must match the **top-level title segment** exactly; anything unmatched
falls through to the end, which looks like being ignored. *Fix:* check the spelling
against the actual title string, and use `'*'` to place the remainder explicitly.

**Symptom — a bookmarked story URL 404s after a refactor.** *Cause:* the story id
derives from the title, which derives from the file path when `title` is omitted —
so moving the file changed the id. *Fix:* expected behaviour. If stable ids matter
(they do once a visual-diff service has baselines), set explicit titles.

**Symptom — a scratch story ended up in the published docs page.** *Cause:*
`tags: ['autodocs']` on the meta is inherited by every story in the file. *Fix:*
`tags: ['!autodocs']` on that story. The `!` prefix removes an inherited tag.

**Symptom — story names sort in an order that looks random.** *Cause:*
`includeNames` defaults to `false`, so story names are not part of the sort — the
order you see is the export order. *Fix:* set `includeNames: true` if you want them
sorted, or simply order the exports in the file, which is often clearer anyway.

## Interview questions

**★ How is the Storybook sidebar hierarchy determined?**
From each file's `title`, with `/` as the separator; story names come from the
export names, camelCase-split, and can be overridden per story with `name`. If
`title` is omitted, it is generated from the file path relative to the matching
`stories` entry, plus any `titlePrefix`.

**★ What is the trade-off between explicit titles and path-generated ones?**
Generated titles cannot drift from the file tree, because they are the file tree —
but moving a file changes the story id, breaking bookmarks and any stored baselines.
Explicit titles give stable ids and let you group by domain rather than by code
layout, at the cost of having to keep them consistent by hand. Mixing the two is
what produces duplicate-looking sidebar trees.

**How do you control the order of sections in the sidebar?**
`parameters.options.storySort` in `preview.ts` — `method` for the algorithm, `order`
for an explicit list with `'*'` marking where unlisted items go, nested arrays for
second-level ordering, and `locales` for alphabetical comparison. A function form
exists for anything the declarative shape cannot express.

**What does `tags: ['!autodocs']` do?**
Removes an inherited `autodocs` tag for that story. Tags merge down from global to
meta to story, and the `!` prefix is the opt-out — which is the fix for a scratch
story that turned up in the published documentation because the meta opted the
whole file in.

**How would you keep a 200-component Storybook navigable?**
Group by what someone is searching for rather than by folder layout, name stories
after states rather than prop values, pin an `Introduction` section first via
`order`, keep one titling policy across the project, and use tags rather than
names to carry status.

---

**← Prev** [04 · CSF factories](./04-csf-factories.md) ·
**Next →** [06 · Reusing stories](./06-reusing-stories.md)
