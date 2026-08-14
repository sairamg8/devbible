---
title: "Phase 1 — The story format"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the [CSF reference](https://storybook.js.org/docs/api/csf),
> the [CSF factories reference](https://storybook.js.org/docs/8/api/csf/csf-factories),
> [Naming components and hierarchy](https://storybook.js.org/docs/writing-stories/naming-components-and-hierarchy)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — no page in this phase carries a console block.

**6 topics · 6 pages.** CSF is the entire authoring API. Everything in later
phases is "a story, plus something wrapped around it", so this phase is
load-bearing for all of them.

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [Component Story Format](./01-component-story-format.md) | <span className="db-tier t-master">Master</span> | Default export = metadata, named exports = states; args **merge**, and shallowly |
| 02 | [File structure and the stories glob](./02-file-structure-and-the-glob.md) | <span className="db-tier t-master">Master</span> | Colocate; a file outside the glob does not exist and nothing tells you |
| 03 | [Typing stories](./03-typing-stories.md) | <span className="db-tier t-understand">Understand</span> | `satisfies` on the meta, `StoryObj<typeof meta>` on the story — both, or neither works |
| 04 | [CSF factories](./04-csf-factories.md) | <span className="db-tier t-understand">Understand</span> | `definePreview` → `preview.meta()` → `meta.story()`; experimental, CSF 3 is not deprecated |
| 05 | [Naming, titles and the sidebar](./05-naming-and-the-sidebar.md) | <span className="db-tier t-understand">Understand</span> | The sidebar is the interface; `title`, `storySort` and tags decide whether it survives 200 components |
| 06 | [Reusing stories](./06-reusing-stories.md) | <span className="db-tier t-know">Know</span> | `composeStories` makes the demo and the test fixture one artifact |

## The one idea

**A story file is an ES module with a convention, not a config file.**

Every behaviour in this phase follows from it. Named exports are stories because
Storybook reads the module's exports — which is why your exported helper turns
into a broken story. A story is importable because it is a value — which is why
`composeStories` can hand it to a test. There is no registration API to look up,
and no plugin lifecycle to learn.

## The three merge rules, in one place

They cause more confusion than anything else in CSF, and they are all the same
rule applied at different levels.

1. **Config merges global → meta → story**, per key, more specific winning.
2. **`args` merge rather than replace** — a story inherits `meta.args` it did not
   override.
3. **The merge is shallow** — an object-valued arg is replaced wholesale, never
   deep merged.

Most "why is this story rendering with a prop I never set" questions are rule 2,
and most "why did half my object disappear" questions are rule 3.

## Where this connects

| Track | Relationship |
|---|---|
| **TypeScript** | Topic 03 is `satisfies` and `typeof` doing real work — the best small example of both in this bible |
| **React** | A story is a component invocation; `render` is where that becomes explicit |
| **Jest & RTL** | Topic 06 — `composeStories` is the bridge, and it is why the two tracks are not duplicating fixtures |

## Phase gate

Move on when you can:

- write a story file from memory, with types, and say why it is `satisfies` and
  `StoryObj<typeof meta>` rather than the alternatives;
- explain why a new `.stories.tsx` did not appear, without opening Storybook;
- predict the resolved `args` of a story given `preview.ts`, the meta and the
  story — including what happens to an object-valued arg;
- read a CSF-factories file without thinking it is a different tool.

---

**Start →** [01 · Component Story Format](./01-component-story-format.md) ·
**← Prev phase** [Phase 0 · How Storybook runs](../phase-0-how-storybook-runs/README.md)
